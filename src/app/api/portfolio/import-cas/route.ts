import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { extractText, getDocumentProxy } from 'unpdf';
import { deobfuscateFromTransport, encryptPII, maskPAN, maskFolio, maskName, maskEmail } from '@/lib/encryption';
import { calculateXIRR, calculateCAGR, buildCashFlowsFromTransactions } from '@/lib/xirr';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

interface CASTransaction {
  date: string;
  description: string;
  amount: number;
  units: number;
  nav: number;
  balance: number;
  type: 'BUY' | 'SELL' | 'SIP' | 'SWP' | 'SWITCH_IN' | 'SWITCH_OUT' | 'DIVIDEND' | 'REDEMPTION';
}

interface CASFolio {
  folioNumber: string;
  amc: string;
  schemeName: string;
  schemeCode?: string;
  costValue?: number;
  pan: string;
  registrar: string;
  closingBalance: number;
  closingNav?: number;
  closingValue?: number;
  transactions: CASTransaction[];
}

interface ParsedCAS {
  investorName: string;
  email: string;
  pan: string;
  statementPeriod: { from: string; to: string };
  folios: CASFolio[];
  summary: {
    totalFolios: number;
    totalSchemes: number;
    totalInvested: number;
    currentValue: number;
  };
}

function parseCASText(text: string): ParsedCAS {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const fullText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const parsed: ParsedCAS = {
    investorName: '',
    email: '',
    pan: '',
    statementPeriod: { from: '', to: '' },
    folios: [],
    summary: { totalFolios: 0, totalSchemes: 0, totalInvested: 0, currentValue: 0 }
  };

  const AMC_LIST = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Nippon', 'DSP', 'Motilal', 'Canara', 'Quant', 'NJ', 'Tata', 'UTI', 'Aditya Birla', 'Franklin', 'Mirae', 'PPFAS', 'Edelweiss', 'IDFC', 'L&T', 'Invesco', 'Sundaram', 'Baroda', 'Union', 'HSBC', 'Quantum', 'Mahindra', 'PGIM', 'Bandhan', 'WhiteOak', 'JM', 'LIC', '360 ONE', 'Groww'];

  function detectAmc(name: string): string {
    for (const amc of AMC_LIST) {
      if (name.toUpperCase().includes(amc.toUpperCase())) return amc;
    }
    return '';
  }

  function parseNum(s: string): number {
    return parseFloat(s.replace(/,/g, '').replace(/\s/g, '')) || 0;
  }

  function classifyTxn(desc: string, units: number, amount: number): CASTransaction['type'] {
    const d = desc.toLowerCase();
    if (d.includes('redemption') || d.includes('redeem')) return 'REDEMPTION';
    if (d.includes('switch') && d.includes('out')) return 'SWITCH_OUT';
    if (d.includes('switch') && d.includes('in')) return 'SWITCH_IN';
    if (d.includes('sip') || d.includes('systematic investment')) return 'SIP';
    if (d.includes('swp') || d.includes('systematic withdrawal')) return 'SWP';
    if (d.includes('dividend')) return 'DIVIDEND';
    if (units < 0 || d.includes('sell')) return 'SELL';
    return 'BUY';
  }

  // ── 1. Extract investor info ──
  // CAMS/KFIN CAS: first few lines have investor name
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    // Name patterns
    if (!parsed.investorName) {
      // "Name: VIJAY MALIK" or standalone capitalized name on first non-header line
      const nameMatch = line.match(/^(?:Name\s*[:]\s*)?([A-Z][A-Z\s]{3,40})$/);
      if (nameMatch && !line.includes('Consolidated') && !line.includes('Statement') && !line.includes('Account') && !line.includes('CAMS') && !line.includes('Folio') && !line.includes('Mutual')) {
        parsed.investorName = nameMatch[1].trim();
      }
      // NSDL CAS: "NSDL ID: 12345678 VIJAY MALIK"
      const nsdlMatch = line.match(/NSDL ID:\s*\d+\s+([A-Z][A-Z\s]+?)(?:\s+H\s*NO|\s+FLAT|\s+\d|$)/i);
      if (nsdlMatch) parsed.investorName = nsdlMatch[1].trim();
    }
    // Email
    const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && !parsed.email) parsed.email = emailMatch[1];
  }

  // PAN
  const panPatterns = [
    /PAN\s*[:\-]?\s*([A-Z]{5}[0-9]{4}[A-Z])/i,
    /\[([A-Z]{5}[0-9]{4}[A-Z])\]/,
    /PAN\s*[:\-]?\s*([A-Z]{2,3}X{3,6}[0-9A-Z]{1,2}[A-Z])/i
  ];
  for (const p of panPatterns) {
    const m = fullText.match(p);
    if (m) { parsed.pan = m[1].toUpperCase(); break; }
  }

  // Statement period
  const periodMatch = fullText.match(/(?:Statement|period)\s*(?:for the period\s*)?(?:from\s+)?(\d{2}-[A-Za-z]{3}-\d{4})\s+to\s+(\d{2}-[A-Za-z]{3}-\d{4})/i);
  if (periodMatch) {
    parsed.statementPeriod.from = periodMatch[1];
    parsed.statementPeriod.to = periodMatch[2];
  }


  // ── 2. STRATEGY: Line-by-line CAMS/KFINTECH parser ──
  // Detects "Folio No:" headers, scheme names, transaction rows, and closing balance lines
  let currentFolio: CASFolio | null = null;
  let currentScheme: string = '';
  let currentRegistrar = '';
  let expectingSchemeName = false;

  const folioHeaderRe = /Folio\s+No\s*[:.]?\s*([\d\/\s]+)/i;
  const txnDateRe = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\-\d,]+\.?\d*)\s+([\-\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/;
  const closingBalRe = /Closing\s+Unit\s+Balance\s*[:.]?\s*([\d,]+\.\d+)/i;
  const navOnDateRe = /NAV\s+on\s+\d{2}-[A-Za-z]{3}-\d{4}\s*[:.]?\s*(?:INR\s+)?(?:₹\s*)?([\d,]+\.\d+)/i;
  const valuationRe = /Valuation\s+on\s+\d{2}-[A-Za-z]{3}-\d{4}\s*[:.]?\s*(?:INR\s+)?(?:₹\s*)?([\d,]+\.\d+)/i;
  const registrarRe = /Registrar\s*[:.]?\s*(CAMS|KFIN(?:TECH)?|FRANKLIN|SUNDARAM|CAMS\/KFIN)/i;
  const costValueRe = /Cost\s+Value\s*[:.]?\s*(?:INR\s+)?(?:₹\s*)?([\d,]+\.\d+)/i;

  function finalizeFolio() {
    if (currentFolio && currentFolio.closingBalance > 0) {
      if (!currentFolio.closingValue && currentFolio.closingNav) {
        currentFolio.closingValue = currentFolio.closingBalance * currentFolio.closingNav;
      }
      parsed.folios.push(currentFolio);
    }
    currentFolio = null;
    currentScheme = '';
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Folio header — starts a new folio context
    const folioMatch = line.match(folioHeaderRe);
    if (folioMatch) {
      finalizeFolio(); // save previous if any
      const folioNum = folioMatch[1].replace(/\s/g, '').replace(/\/+$/, '');
      // Extract PAN from same line: "PAN: ABCDE1234F"
      const linePan = line.match(/PAN\s*[:.]?\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
      if (linePan && !parsed.pan) parsed.pan = linePan[1].toUpperCase();
      
      currentFolio = {
        folioNumber: folioNum,
        amc: '',
        schemeName: '',
        pan: linePan ? linePan[1] : parsed.pan,
        registrar: '',
        closingBalance: 0,
        transactions: []
      };
      expectingSchemeName = true;
      continue;
    }

    // Scheme name: line after folio header (not a date, not registrar)
    if (expectingSchemeName && currentFolio && !currentFolio.schemeName) {
      const regMatch = line.match(registrarRe);
      if (regMatch) {
        currentRegistrar = regMatch[1];
        currentFolio.registrar = currentRegistrar;
        continue;
      }
      // Skip header-like lines
      if (line.match(/^(Date|Transaction|Amount|Units|NAV|Balance)/i)) continue;
      // This should be the scheme name
      if (line.length > 10 && !line.match(/^\d{2}-[A-Za-z]{3}-\d{4}/) && !line.match(/^Closing/) && !line.match(/^Registrar/i)) {
        currentFolio.schemeName = line.replace(/\s*\(Advisor.*$/i, '').trim();
        currentFolio.amc = detectAmc(currentFolio.schemeName);
        expectingSchemeName = false;
        continue;
      }
    }

    // Registrar
    const regMatch2 = line.match(registrarRe);
    if (regMatch2 && currentFolio) {
      currentFolio.registrar = regMatch2[1];
      continue;
    }

    // Transaction row: DD-MMM-YYYY Description Amount Units NAV Balance
    if (currentFolio) {
      const txMatch = line.match(txnDateRe);
      if (txMatch) {
        const amount = parseNum(txMatch[3]);
        const units = parseNum(txMatch[4]);
        const nav = parseNum(txMatch[5]);
        const balance = parseNum(txMatch[6]);
        const desc = txMatch[2].trim();
        currentFolio.transactions.push({
          date: txMatch[1],
          description: desc,
          amount: Math.abs(amount),
          units: Math.abs(units),
          nav,
          balance,
          type: classifyTxn(desc, units, amount)
        });
        continue;
      }

      // Closing Unit Balance
      const closingMatch = line.match(closingBalRe);
      if (closingMatch) {
        currentFolio.closingBalance = parseNum(closingMatch[1]);
        continue;
      }

      // NAV on date
      const navMatch = line.match(navOnDateRe);
      if (navMatch) {
        currentFolio.closingNav = parseNum(navMatch[1]);
        continue;
      }

      // Valuation
      const valMatch = line.match(valuationRe);
      if (valMatch) {
        currentFolio.closingValue = parseNum(valMatch[1]);
        continue;
      }

      // Cost value
      const costMatch = line.match(costValueRe);
      if (costMatch) {
        currentFolio.costValue = parseNum(costMatch[1]);
        continue;
      }

      // Sometimes "Closing Unit Balance" is on a line with NAV+valuation all together
      const combinedRe = /Closing.*?(\d[\d,]*\.\d{3,}).*?NAV.*?(\d[\d,]*\.\d{2,}).*?(?:Valuation|Value).*?(\d[\d,]*\.\d{2})/i;
      const combinedMatch = line.match(combinedRe);
      if (combinedMatch) {
        currentFolio.closingBalance = parseNum(combinedMatch[1]);
        currentFolio.closingNav = parseNum(combinedMatch[2]);
        currentFolio.closingValue = parseNum(combinedMatch[3]);
        continue;
      }

      // New folio starting without an explicit "Folio No:" (some NSDL CAS formats)
      // Detect by seeing another scheme-like line after transactions ended
    }
  }
  // Finalize last folio
  finalizeFolio();

  // ── 3. STRATEGY: NSDL ISIN-based fallback (if line-by-line found nothing) ──
  if (parsed.folios.length === 0) {
    const flatText = fullText.replace(/\s+/g, ' ');
    const isinRegex = /\b(INF[A-Z0-9]{9})\b/g;
    const foundIsins = new Set<string>();
    let match;
    while ((match = isinRegex.exec(flatText)) !== null) {
      foundIsins.add(match[1]);
    }

    for (const isin of foundIsins) {
      if (parsed.folios.some(f => f.schemeCode === isin)) continue;
      const isinIndex = flatText.indexOf(isin);
      if (isinIndex === -1) continue;
      const afterIsin = flatText.substring(isinIndex + isin.length, isinIndex + 500);
      if (afterIsin.match(/^\s*\d{2}-[A-Za-z]{3}-\d{4}/)) continue;

      // Extract: SCHEME_NAME units nav value
      const numPattern = /(\d[\d,]*\.\d{3,})\s+(\d[\d,]*\.\d{2,})\s+(\d[\d,]*\.\d{2})/;
      const numMatch = afterIsin.match(numPattern);
      if (!numMatch) continue;

      const units = parseNum(numMatch[1]);
      const nav = parseNum(numMatch[2]);
      const value = parseNum(numMatch[3]);
      if (units <= 0) continue;

      let schemeName = afterIsin.substring(0, afterIsin.indexOf(numMatch[0])).replace(/\s+/g, ' ').trim()
        .replace(/^\s*ISIN\s*/i, '').replace(/Sub Total.*$/i, '').replace(/\s*\d[\d,]*\.\d+\s*$/g, '').trim();
      if (!schemeName || schemeName.length < 5) schemeName = `Fund ${isin}`;

      parsed.folios.push({
        folioNumber: isin,
        amc: detectAmc(schemeName),
        schemeName,
        schemeCode: isin,
        pan: parsed.pan,
        registrar: 'NSDL',
        closingBalance: units,
        closingNav: nav,
        closingValue: value,
        transactions: []
      });
    }
  }

  // ── 4. Calculate summary ──
  parsed.summary.totalFolios = new Set(parsed.folios.map(f => f.folioNumber)).size;
  parsed.summary.totalSchemes = parsed.folios.length;

  for (const folio of parsed.folios) {
    if (folio.closingValue) {
      parsed.summary.currentValue += folio.closingValue;
    } else if (folio.closingBalance && folio.closingNav) {
      folio.closingValue = folio.closingBalance * folio.closingNav;
      parsed.summary.currentValue += folio.closingValue;
    }
    if (folio.costValue) {
      parsed.summary.totalInvested += folio.costValue;
    } else {
      // Sum BUY/SIP transactions as invested amount
      const invested = folio.transactions
        .filter(t => t.type === 'BUY' || t.type === 'SIP' || t.type === 'SWITCH_IN')
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      if (invested > 0) {
        folio.costValue = invested;
        parsed.summary.totalInvested += invested;
      }
    }
  }

  return parsed;
}

// Enrich folios with returns computed from our NAV DB + XIRR
async function enrichWithReturns(folios: CASFolio[]): Promise<void> {
  for (const folio of folios) {
    if (!folio.schemeCode || folio.closingBalance <= 0) continue;
    try {
      // Get latest NAV from our DB
      const navResult = await pool.query(
        `SELECT latest_nav FROM funds WHERE scheme_code = $1`,
        [folio.schemeCode]
      );
      const latestNav = navResult.rows[0]?.latest_nav ? parseFloat(navResult.rows[0].latest_nav) : folio.closingNav;
      if (!latestNav) continue;

      const currentValue = folio.closingBalance * latestNav;
      const invested = folio.costValue || folio.transactions
        .filter(t => ['BUY', 'SIP', 'SWITCH_IN'].includes(t.type))
        .reduce((s, t) => s + Math.abs(t.amount), 0);

      // Absolute return
      if (invested > 0) {
        (folio as any).absoluteReturn = Math.round((currentValue - invested) * 100) / 100;
        (folio as any).absoluteReturnPct = Math.round(((currentValue - invested) / invested) * 10000) / 100;
      }

      // XIRR from transactions
      if (folio.transactions.length >= 1) {
        const cashFlows = buildCashFlowsFromTransactions(
          folio.transactions.map(t => ({ date: t.date, amount: t.amount, type: t.type })),
          folio.closingBalance,
          latestNav
        );
        const xirr = calculateXIRR(cashFlows);
        if (xirr !== null) (folio as any).xirr = xirr;
      }

      // CAGR from earliest transaction
      const buyTxns = folio.transactions.filter(t => ['BUY', 'SIP', 'SWITCH_IN'].includes(t.type));
      if (buyTxns.length > 0 && invested > 0) {
        const earliest = new Date(buyTxns[0].date);
        const years = (Date.now() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (years > 0.08) { // At least ~1 month
          const cagr = calculateCAGR(invested, currentValue, years);
          if (cagr !== null) (folio as any).cagr = cagr;
        }
      }

      (folio as any).latestNav = latestNav;
      (folio as any).currentValue = Math.round(currentValue * 100) / 100;
    } catch { /* skip enrichment errors */ }
  }
}

async function matchSchemeCode(schemeName: string, isin?: string): Promise<string | null> {
  try {
    // Strategy 1: Exact ISIN match (most reliable)
    if (isin && isin.startsWith('INF')) {
      const isinResult = await pool.query(
        `SELECT scheme_code FROM funds WHERE isin = $1 OR isin2 = $1 LIMIT 1`,
        [isin]
      );
      if (isinResult.rows[0]?.scheme_code) return isinResult.rows[0].scheme_code;
    }

    // Strategy 2: Clean name + exact match on key words
    // Strip noise from CAS scheme names: "(Advisor: ...)", registrar tags, etc.
    const cleaned = schemeName
      .replace(/\(Advisor.*?\)/gi, '')
      .replace(/\(Erstwhile.*?\)/gi, '')
      .replace(/Registrar\s*:.*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Try exact name match first
    const exactResult = await pool.query(
      `SELECT scheme_code FROM funds WHERE LOWER(scheme_name) = $1 LIMIT 1`,
      [cleaned.toLowerCase()]
    );
    if (exactResult.rows[0]?.scheme_code) return exactResult.rows[0].scheme_code;

    // Strategy 3: Word-intersection match — all significant words must appear
    const stopWords = new Set(['fund', 'mutual', 'plan', 'option', 'the', 'of', 'and', '-', '–']);
    const words = cleaned.toLowerCase().split(/[\s\-]+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    if (words.length >= 2) {
      // Use first 5 meaningful words to build ILIKE conditions
      const matchWords = words.slice(0, 5);
      const conditions = matchWords.map((_, i) => `LOWER(scheme_name) LIKE $${i + 1}`);
      const params = matchWords.map(w => `%${w}%`);
      
      // Prefer Direct Plan + Growth as canonical
      const result = await pool.query(
        `SELECT scheme_code, scheme_name FROM funds 
         WHERE ${conditions.join(' AND ')}
         ORDER BY 
           CASE WHEN scheme_name ILIKE '%Direct%' THEN 0 ELSE 1 END,
           CASE WHEN scheme_name ILIKE '%Growth%' THEN 0 ELSE 1 END
         LIMIT 1`,
        params
      );
      if (result.rows[0]?.scheme_code) return result.rows[0].scheme_code;
    }

    // Strategy 4: Fallback — first 3 words loose match
    const first3 = cleaned.split(' ').slice(0, 3).join(' ').toLowerCase();
    if (first3.length > 8) {
      const fallback = await pool.query(
        `SELECT scheme_code FROM funds 
         WHERE LOWER(scheme_name) LIKE $1
         ORDER BY CASE WHEN scheme_name ILIKE '%Direct%' THEN 0 ELSE 1 END
         LIMIT 1`,
        [`%${first3}%`]
      );
      if (fallback.rows[0]?.scheme_code) return fallback.rows[0].scheme_code;
    }

    return null;
  } catch {
    return null;
  }
}

// Parse CAS using Python casparser library
async function parseCASWithPython(pdfBuffer: Buffer, password?: string): Promise<ParsedCAS | null> {
  return new Promise(async (resolve) => {
    try {
      // Write PDF to temp file
      const tempPath = join(tmpdir(), `cas_${Date.now()}.pdf`);
      await writeFile(tempPath, pdfBuffer);
      
      // Build command args
      const args = [join(process.cwd(), 'scripts', 'parse_cas.py'), tempPath];
      if (password) {
        args.push(password);
      }
      
      // Spawn Python process
      const pythonProcess = spawn('python3', args);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', async (code) => {
        // Clean up temp file
        try {
          await unlink(tempPath);
        } catch {
          // Silent — temp file cleanup is best-effort
        }
        
        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log(`[CAS] Python casparser succeeded: ${result.folios?.length || 0} folios`);
              resolve(result as ParsedCAS);
            } else {
              console.log(`[CAS] Python casparser returned error: ${result.error}`);
              resolve(null);
            }
          } catch (e) {
            console.log(`[CAS] Python casparser JSON parse failed: ${(e as Error).message}. stdout=${stdout.substring(0, 200)}`);
            resolve(null);
          }
        } else {
          console.log(`[CAS] Python casparser exited code=${code} stderr=${stderr.substring(0, 300)}`);
          resolve(null);
        }
      });
      
      pythonProcess.on('error', (err) => {
        console.log(`[CAS] Python spawn error: ${err.message}`);
        resolve(null);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        pythonProcess.kill();
        resolve(null);
      }, 30000);
      
    } catch (error) {
      resolve(null);
    }
  });
}

// ════════════════════════════════════════════════════════════════════
//  PII SANITIZATION — Mask all sensitive identifiers before response
// ════════════════════════════════════════════════════════════════════
function sanitizeResponsePII(data: ParsedCAS): ParsedCAS {
  return {
    ...data,
    investorName: maskName(data.investorName),
    email: maskEmail(data.email),
    pan: maskPAN(data.pan),
    folios: data.folios.map(folio => ({
      ...folio,
      folioNumber: maskFolio(folio.folioNumber),
      pan: maskPAN(folio.pan),
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('casFile') as File;
    const obfuscatedPassword = formData.get('password') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Deobfuscate password if provided
    const password = obfuscatedPassword ? deobfuscateFromTransport(obfuscatedPassword) : undefined;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Try Python casparser first (more accurate for CAMS/KFINTECH)
    let parsedData = await parseCASWithPython(buffer, password);
    
    if (parsedData && parsedData.folios && parsedData.folios.length > 0) {
      
      // Match scheme codes for each folio (pass ISIN if available from schemeCode field)
      for (const folio of parsedData.folios) {
        const existingCode = folio.schemeCode;
        const isin = existingCode && existingCode.startsWith('INF') ? existingCode : undefined;
        const schemeCode = await matchSchemeCode(folio.schemeName, isin);
        if (schemeCode) {
          folio.schemeCode = schemeCode;
        }
      }
      
      const matched = parsedData.folios.filter(f => f.schemeCode).length;

      // Enrich with returns (XIRR, CAGR, absolute return) from our NAV DB
      await enrichWithReturns(parsedData.folios);
      
      // Sanitize PII before sending to client (DPDP Act compliance)
      const sanitizedData = sanitizeResponsePII(parsedData);
      
      return NextResponse.json({
        success: true,
        data: sanitizedData,
        message: `Successfully parsed ${parsedData.folios.length} mutual fund holdings (${matched} matched)`,
        parser: 'casparser'
      });
    }
    
    // Fallback to JavaScript parser if Python fails
    console.log('[CAS] Python casparser did not produce results, falling back to JS parser');
    
    let textContent = '';
    
    try {
      // Parse PDF server-side using unpdf (supports password-protected PDFs)
      const pdf = await getDocumentProxy(new Uint8Array(buffer), { 
        password: password || undefined 
      });
      const result = await extractText(pdf, { mergePages: true });
      textContent = result.text;
    } catch (pdfError) {
      // Do not log pdfError — may contain raw PDF content or PAN
      const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error';
      
      if (errorMessage.includes('password') || errorMessage.includes('encrypted') || errorMessage.includes('Incorrect Password')) {
        return NextResponse.json({ 
          error: 'This PDF is password protected. Please enter the correct password (usually your PAN like ABCDE1234F or DOB like 01011990).',
          requiresPassword: true 
        }, { status: 400 });
      }
      
      return NextResponse.json({ 
        error: 'Could not parse PDF. Please ensure the file is a valid CAS statement.',
        details: errorMessage
      }, { status: 400 });
    }
    
    if (!textContent || textContent.trim().length < 100) {
      return NextResponse.json({ 
        error: 'Could not extract text from PDF. The file may be scanned or image-based. Please use a text-based CAS PDF.',
      }, { status: 400 });
    }

    
    // Parse the CAS text using JS fallback parser
    const jsParsedData = parseCASText(textContent);
    console.log(`[CAS] JS parser found ${jsParsedData.folios.length} folios. Names: ${jsParsedData.folios.slice(0, 3).map(f => f.schemeName?.substring(0, 40)).join('; ')}`);

    // Match scheme codes for each folio (pass ISIN if available)
    for (const folio of jsParsedData.folios) {
      const existingCode = folio.schemeCode;
      const isin = existingCode && existingCode.startsWith('INF') ? existingCode : undefined;
      const schemeCode = await matchSchemeCode(folio.schemeName, isin);
      if (schemeCode) {
        folio.schemeCode = schemeCode;
      }
    }

    const jsMatched = jsParsedData.folios.filter(f => f.schemeCode).length;
    console.log(`[CAS] JS parser matched ${jsMatched}/${jsParsedData.folios.length} folios to DB`);

    // Enrich with returns (XIRR, CAGR, absolute return) from our NAV DB
    await enrichWithReturns(jsParsedData.folios);

    // Wipe raw PDF text from memory — PAN was only used ephemerally for decryption
    textContent = '';

    // Sanitize PII before sending to client (DPDP Act compliance)
    const sanitizedJsData = sanitizeResponsePII(jsParsedData);

    return NextResponse.json({
      success: true,
      data: sanitizedJsData,
      message: `Successfully parsed ${jsParsedData.folios.length} mutual fund holdings (${jsMatched} matched)`,
      parser: 'javascript'
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to parse CAS statement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Filter: only keep mutual fund folios (skip stocks, bonds, insurance, debentures)
function isMutualFund(folio: CASFolio): boolean {
  const name = (folio.schemeName || '').toLowerCase();
  if (!name || name.length < 5) return false;
  const skipKeywords = ['equity share', 'debenture', 'bond', 'ncd', 'government securities',
    'insurance', 'lic ', 'sgb', 'sovereign gold', 'fixed deposit', 'national savings',
    'ppf', 'epf', 'real estate', 'reit', 'invit', 'gold bond'];
  for (const kw of skipKeywords) {
    if (name.includes(kw)) return false;
  }
  // Accept if it has a schemeCode OR has a valid MF-like name with positive balance
  if (folio.schemeCode) return true;
  // MF-positive signals: fund house names, plan types, growth/dividend keywords
  const mfSignals = ['fund', 'growth', 'direct', 'regular', 'dividend', 'idcw',
    'flexi', 'cap', 'equity', 'debt', 'hybrid', 'liquid', 'overnight',
    'gilt', 'index', 'nifty', 'sensex', 'balanced', 'advantage', 'savings',
    'ultra short', 'money market', 'arbitrage', 'value', 'contra',
    'focused', 'multi', 'large', 'mid', 'small', 'elss', 'tax'];
  const hasMfSignal = mfSignals.some(s => name.includes(s));
  return hasMfSignal && folio.closingBalance > 0;
}

// Detect SIP transactions from CAS data
function extractSIPInfo(folios: CASFolio[]): Array<{
  schemeName: string; schemeCode: string | undefined; sipAmount: number; frequency: string; lastDate: string;
}> {
  const sips: Array<{ schemeName: string; schemeCode: string | undefined; sipAmount: number; frequency: string; lastDate: string }> = [];
  for (const folio of folios) {
    const sipTxns = (folio.transactions || []).filter(t => 
      t.type === 'SIP' || t.description?.toLowerCase().includes('systematic') || t.description?.toLowerCase().includes('sip')
    );
    if (sipTxns.length >= 2) {
      // Find most common amount (the SIP installment)
      const amounts = sipTxns.map(t => Math.round(Math.abs(t.amount)));
      const freq: Record<number, number> = {};
      for (const a of amounts) freq[a] = (freq[a] || 0) + 1;
      const sipAmount = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
      const lastSip = sipTxns[sipTxns.length - 1];
      sips.push({
        schemeName: folio.schemeName,
        schemeCode: folio.schemeCode,
        sipAmount,
        frequency: 'Monthly',
        lastDate: lastSip.date
      });
    }
  }
  return sips;
}

// Save parsed holdings to database
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: 'Invalid JSON body', details: parseErr instanceof Error ? parseErr.message : 'parse error' }, { status: 400 });
    }

    const folios: CASFolio[] = Array.isArray(body.folios) ? body.folios : [];
    const investorInfo = body.investorInfo as { pan?: string; email?: string } | undefined;

    console.log('[CAS-PUT] Received', folios.length, 'folios. Body keys:', Object.keys(body).join(', '));
    if (folios.length > 0) {
      const sample = folios[0];
      console.log('[CAS-PUT] Sample folio keys:', Object.keys(sample).join(', '));
      console.log('[CAS-PUT] Sample folio:', JSON.stringify({
        schemeName: sample.schemeName?.substring(0, 50),
        schemeCode: sample.schemeCode,
        closingBalance: sample.closingBalance,
        hasTransactions: Array.isArray(sample.transactions) ? sample.transactions.length : 'none'
      }));
    }

    if (folios.length === 0) {
      return NextResponse.json({ error: 'No holdings to import', details: `body keys: ${Object.keys(body).join(', ')}` }, { status: 400 });
    }

    // Re-match scheme codes for folios that lost them in the round-trip
    let reMatchCount = 0;
    for (const folio of folios) {
      if (!folio.schemeCode && folio.schemeName) {
        const matched = await matchSchemeCode(folio.schemeName);
        if (matched) {
          folio.schemeCode = matched;
          reMatchCount++;
        }
      }
    }
    const withCodeBefore = folios.filter(f => !!f.schemeCode).length;
    console.log('[CAS-PUT] After re-match:', withCodeBefore, 'have schemeCode,', reMatchCount, 're-matched');

    // Filter only mutual funds
    const mfFolios = folios.filter(isMutualFund);
    const nonMfCount = folios.length - mfFolios.length;
    
    // Extract SIP info before filtering
    const sipInfo = extractSIPInfo(folios);

    if (mfFolios.length === 0) {
      const withCode = folios.filter(f => !!f.schemeCode).length;
      const sampleFolios = folios.slice(0, 3).map(f => ({
        name: f.schemeName?.substring(0, 50) || 'no-name',
        code: f.schemeCode || 'null',
        bal: f.closingBalance
      }));
      const debugMsg = `${folios.length} folios received, ${withCode} had schemeCode after re-match. Samples: ${JSON.stringify(sampleFolios)}`;
      console.log('[CAS-PUT] 0 MF folios passed filter.', debugMsg);
      return NextResponse.json({ 
        success: true, imported: 0, skipped: folios.length, sipCount: 0,
        message: debugMsg
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure portfolio_holdings table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS portfolio_holdings (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          scheme_code TEXT NOT NULL,
          units NUMERIC DEFAULT 0,
          purchase_nav NUMERIC DEFAULT 0,
          purchase_date TIMESTAMP DEFAULT NOW(),
          purchase_amount NUMERIC DEFAULT 0,
          notes TEXT,
          source TEXT DEFAULT 'manual',
          folio_number TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Ensure cas_sip_info table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS cas_sip_info (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          scheme_code TEXT,
          scheme_name TEXT NOT NULL,
          sip_amount NUMERIC DEFAULT 0,
          frequency TEXT DEFAULT 'Monthly',
          last_sip_date TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      let importedCount = 0;
      let errorCount = 0;
      let errorDetails: string | null = null;

      for (const folio of mfFolios) {
        try {
          // Last-chance scheme code match if still missing
          if (!folio.schemeCode && folio.schemeName) {
            const lastChance = await matchSchemeCode(folio.schemeName);
            if (lastChance) folio.schemeCode = lastChance;
          }

          // Calculate total invested and average NAV from transactions
          let totalInvested = 0;
          let earliestDate: Date | null = null;

          const txns = Array.isArray(folio.transactions) ? folio.transactions : [];
          for (const tx of txns) {
            if (tx.type === 'BUY' || tx.type === 'SIP' || tx.type === 'SWITCH_IN') {
              totalInvested += Math.abs(tx.amount);
              try {
                const txDate = new Date(tx.date);
                if (!isNaN(txDate.getTime()) && (!earliestDate || txDate < earliestDate)) {
                  earliestDate = txDate;
                }
              } catch { /* skip bad dates */ }
            }
          }

          // Use closingNav * closingBalance as invested if no transactions
          if (totalInvested === 0 && folio.costValue) {
            totalInvested = folio.costValue;
          }
          if (totalInvested === 0 && folio.closingNav && folio.closingBalance) {
            totalInvested = folio.closingBalance * folio.closingNav;
          }

          const avgNav = folio.closingNav || (folio.closingBalance > 0 && totalInvested > 0 ? totalInvested / folio.closingBalance : 0);

          // Use schemeCode if available, otherwise use a sanitized schemeName as identifier
          const holdingKey = folio.schemeCode || `UNMATCHED:${folio.schemeName.substring(0, 80).replace(/[^a-zA-Z0-9 ]/g, '')}`;

          // Check if holding already exists (by scheme_code or by scheme_name for unmatched)
          const existing = await client.query(
            `SELECT id FROM portfolio_holdings WHERE user_id = $1 AND scheme_code = $2`,
            [user.id, holdingKey]
          );

          // Encrypt PII before DB persistence (AES-256-GCM)
          const encryptedFolio = encryptPII(folio.folioNumber);

          if (existing.rows.length > 0) {
            await client.query(
              `UPDATE portfolio_holdings 
               SET units = $1, purchase_nav = $2, purchase_amount = $3, folio_number = $4, source = 'cas', updated_at = NOW(),
                   notes = $6
               WHERE id = $5`,
              [folio.closingBalance, avgNav, totalInvested, encryptedFolio, existing.rows[0].id,
               `CAS Import - ${folio.amc} - ${folio.schemeName.substring(0, 60)}`]
            );
          } else {
            await client.query(
              `INSERT INTO portfolio_holdings (user_id, scheme_code, units, purchase_nav, purchase_date, purchase_amount, notes, source, folio_number)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'cas', $8)`,
              [user.id, holdingKey, folio.closingBalance, avgNav, 
               earliestDate || new Date(), totalInvested,
               `CAS Import - ${folio.amc} - ${folio.schemeName.substring(0, 60)}`,
               encryptedFolio]
            );
          }

          importedCount++;
        } catch (folioError) {
          const folioErrMsg = folioError instanceof Error ? folioError.message : 'Unknown';
          console.error(`[CAS-PUT] Error importing scheme_code=${folio.schemeCode} name=${folio.schemeName?.substring(0,40)}:`, folioErrMsg);
          errorCount++;
          if (!errorDetails) errorDetails = folioErrMsg;
        }
      }

      // Save SIP info
      let sipSaved = 0;
      if (sipInfo.length > 0) {
        // Clear old SIP data for this user
        await client.query(`DELETE FROM cas_sip_info WHERE user_id = $1`, [user.id]);
        for (const sip of sipInfo) {
          try {
            await client.query(
              `INSERT INTO cas_sip_info (user_id, scheme_code, scheme_name, sip_amount, frequency, last_sip_date)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [user.id, sip.schemeCode || null, sip.schemeName, sip.sipAmount, sip.frequency, sip.lastDate]
            );
            sipSaved++;
          } catch { /* skip */ }
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        imported: importedCount,
        skipped: nonMfCount,
        errors: errorCount,
        sipCount: sipSaved,
        message: `Imported ${importedCount} mutual fund holdings. ${sipSaved} SIPs detected. ${nonMfCount} non-MF items skipped.${errorCount > 0 ? ` ${errorCount} errors: ${errorDetails}` : ''}`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown';
    const errStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' | ') : '';
    console.error('Save holdings error:', errMsg, errStack);
    return NextResponse.json({ 
      error: 'Failed to save holdings',
      details: errMsg,
      trace: errStack
    }, { status: 500 });
  }
}
