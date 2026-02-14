import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { extractText, getDocumentProxy } from 'unpdf';
import { deobfuscateFromTransport } from '@/lib/encryption';
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

  console.log('[CAS-JS] Starting multi-strategy parse, lines:', lines.length);

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
      console.log(`[CAS-JS] Added: ${currentFolio.schemeName} — ${currentFolio.closingBalance} units @ ₹${currentFolio.closingNav} = ₹${currentFolio.closingValue}`);
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
    console.log('[CAS-JS] Line-by-line found 0 folios, trying ISIN-based NSDL strategy');
    const flatText = fullText.replace(/\s+/g, ' ');
    const isinRegex = /\b(INF[A-Z0-9]{9})\b/g;
    const foundIsins = new Set<string>();
    let match;
    while ((match = isinRegex.exec(flatText)) !== null) {
      foundIsins.add(match[1]);
    }
    console.log(`[CAS-JS] Found ${foundIsins.size} ISINs`);

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

  console.log(`[CAS-JS] Parsed ${parsed.folios.length} holdings, ₹${parsed.summary.currentValue.toFixed(0)} value`);
  return parsed;
}

async function matchSchemeCode(schemeName: string): Promise<string | null> {
  try {
    // Try to find matching scheme in database
    const result = await pool.query(
      `SELECT scheme_code FROM funds 
       WHERE LOWER(scheme_name) LIKE $1 
       OR LOWER(scheme_name) LIKE $2
       LIMIT 1`,
      [`%${schemeName.toLowerCase().substring(0, 30)}%`, `%${schemeName.split(' ').slice(0, 3).join(' ').toLowerCase()}%`]
    );
    
    return result.rows[0]?.scheme_code || null;
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
        } catch (e) {
          console.error('Failed to delete temp file:', e);
        }
        
        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              resolve(result as ParsedCAS);
            } else {
              console.log('Python parser returned error:', result.error);
              resolve(null);
            }
          } catch (e) {
            console.error('Failed to parse Python output:', e);
            resolve(null);
          }
        } else {
          console.error('Python parser failed:', stderr);
          resolve(null);
        }
      });
      
      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        resolve(null);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        pythonProcess.kill();
        resolve(null);
      }, 30000);
      
    } catch (error) {
      console.error('Python parser error:', error);
      resolve(null);
    }
  });
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
    console.log('Attempting to parse CAS with Python casparser...');
    let parsedData = await parseCASWithPython(buffer, password);
    
    if (parsedData && parsedData.folios && parsedData.folios.length > 0) {
      console.log(`Python casparser found ${parsedData.folios.length} folios`);
      
      // Match scheme codes for each folio
      for (const folio of parsedData.folios) {
        if (!folio.schemeCode) {
          const schemeCode = await matchSchemeCode(folio.schemeName);
          if (schemeCode) {
            folio.schemeCode = schemeCode;
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        data: parsedData,
        message: `Successfully parsed ${parsedData.folios.length} mutual fund holdings using casparser`,
        parser: 'casparser'
      });
    }
    
    // Fallback to JavaScript parser if Python fails
    console.log('Python casparser failed or not available, falling back to JS parser...');
    
    let textContent = '';
    
    try {
      // Parse PDF server-side using unpdf (supports password-protected PDFs)
      const pdf = await getDocumentProxy(new Uint8Array(buffer), { 
        password: password || undefined 
      });
      const result = await extractText(pdf, { mergePages: true });
      textContent = result.text;
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
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

    // Log first 2000 chars of extracted text for debugging
    console.log('Extracted PDF text (first 2000 chars):', textContent.substring(0, 2000));
    
    // Parse the CAS text using JS fallback parser
    const jsParsedData = parseCASText(textContent);

    // Match scheme codes for each folio
    for (const folio of jsParsedData.folios) {
      const schemeCode = await matchSchemeCode(folio.schemeName);
      if (schemeCode) {
        folio.schemeCode = schemeCode;
      }
    }

    return NextResponse.json({
      success: true,
      data: jsParsedData,
      message: `Successfully parsed ${jsParsedData.folios.length} mutual fund holdings`,
      parser: 'javascript',
      debug: {
        textLength: textContent.length,
        textPreview: textContent.substring(0, 2000),
        lines: textContent.split('\n').slice(0, 50)
      }
    });

  } catch (error) {
    console.error('CAS import error:', error);
    return NextResponse.json({ 
      error: 'Failed to parse CAS statement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Save parsed holdings to database
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { folios, investorInfo } = await request.json() as { 
      folios: CASFolio[]; 
      investorInfo?: { pan?: string; email?: string; phone?: string } 
    };

    if (!folios || folios.length === 0) {
      return NextResponse.json({ error: 'No holdings to import' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Store PAN/email/phone in user record (silently, without notifying user)
      // This is optional - if columns don't exist, we skip this step
      if (investorInfo) {
        try {
          const updates: string[] = [];
          const values: any[] = [];
          let paramCount = 1;
          
          if (investorInfo.pan && investorInfo.pan.length >= 10) {
            updates.push(`pan = $${paramCount}`);
            values.push(investorInfo.pan);
            paramCount++;
          }
          if (investorInfo.email && investorInfo.email.includes('@')) {
            updates.push(`cas_email = $${paramCount}`);
            values.push(investorInfo.email);
            paramCount++;
          }
          if (investorInfo.phone && investorInfo.phone.length >= 10) {
            updates.push(`cas_phone = $${paramCount}`);
            values.push(investorInfo.phone);
            paramCount++;
          }
          
          if (updates.length > 0) {
            values.push(user.id);
            await client.query(
              `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount}`,
              values
            );
            console.log(`Updated user ${user.id} with CAS info`);
          }
        } catch (userUpdateError) {
          // Silently ignore if columns don't exist - this is optional functionality
          console.log('Could not update user with CAS info (columns may not exist):', userUpdateError);
        }
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const folio of folios) {
        if (!folio.schemeCode) {
          skippedCount++;
          continue;
        }

        // Calculate total invested and average NAV from transactions
        let totalUnits = 0;
        let totalInvested = 0;
        let earliestDate = new Date();

        for (const tx of folio.transactions) {
          if (tx.type === 'BUY' || tx.type === 'SIP') {
            totalUnits += tx.units;
            totalInvested += Math.abs(tx.amount);
            const txDate = new Date(tx.date);
            if (txDate < earliestDate) earliestDate = txDate;
          }
        }

        const avgNav = totalUnits > 0 ? totalInvested / totalUnits : 0;

        // Check if holding already exists
        const existing = await client.query(
          `SELECT id FROM portfolio_holdings 
           WHERE user_id = $1 AND scheme_code = $2`,
          [user.id, folio.schemeCode]
        );

        if (existing.rows.length > 0) {
          // Update existing holding
          await client.query(
            `UPDATE portfolio_holdings 
             SET units = $1, purchase_nav = $2, purchase_amount = $3, updated_at = NOW()
             WHERE id = $4`,
            [folio.closingBalance, avgNav, totalInvested, existing.rows[0].id]
          );
        } else {
          // Insert new holding
          await client.query(
            `INSERT INTO portfolio_holdings (user_id, scheme_code, units, purchase_nav, purchase_date, purchase_amount, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [user.id, folio.schemeCode, folio.closingBalance, avgNav, earliestDate, totalInvested, `Imported from CAS - Folio: ${folio.folioNumber}`]
          );
        }

        // Insert transactions
        for (const tx of folio.transactions) {
          await client.query(
            `INSERT INTO portfolio_transactions (user_id, scheme_code, transaction_type, units, nav, amount, transaction_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT DO NOTHING`,
            [user.id, folio.schemeCode, tx.type, tx.units, tx.nav, tx.amount, new Date(tx.date), tx.description]
          );
        }

        importedCount++;
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        message: `Successfully imported ${importedCount} holdings. ${skippedCount} skipped (scheme not found in database).`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Save holdings error:', error);
    return NextResponse.json({ 
      error: 'Failed to save holdings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
