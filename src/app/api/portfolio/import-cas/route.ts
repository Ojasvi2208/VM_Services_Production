/**
 * CAS Import API — Gold-Standard Architecture
 *
 * KEY DESIGN: Server-side parse + stage + confirm. ZERO data round-trip through the app.
 *
 * POST /api/portfolio/import-cas
 *   1. Receive PDF upload
 *   2. Parse via Python casparser (primary) or JS fallback
 *   3. Match every scheme to our funds DB (ISIN → AMFI code → name match)
 *   4. Stage all holdings in `cas_import_staging` table with a unique importId
 *   5. Return { importId, preview[] } — lightweight summary for the app to display
 *   6. App NEVER receives raw folio data — only preview summaries
 *
 * PUT /api/portfolio/import-cas
 *   1. Receive { importId } — literally 1 field, no folio data
 *   2. Promote staged rows → portfolio_holdings (upsert by user_id + scheme_code)
 *   3. Return { success, imported, skipped }
 *
 * This eliminates:
 *   - Serialization loss (kotlinx.serialization dropping null fields)
 *   - Data corruption in round-trip
 *   - schemeCode mismatch between parse and save
 *   - The entire class of bugs we've been fighting
 */

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
import { randomUUID } from 'crypto';

// ════════════════════════════════════════════════════════════════════
//  Types
// ════════════════════════════════════════════════════════════════════

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

// Preview item sent to the app (lightweight, no sensitive data)
interface PreviewItem {
  schemeName: string;
  amc: string;
  closingBalance: number;
  closingValue: number;
  matched: boolean;
  schemeCode: string | null;
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

// ════════════════════════════════════════════════════════════════════
//  Ensure staging + holdings tables exist (idempotent, cached)
// ════════════════════════════════════════════════════════════════════
let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cas_import_staging (
        id SERIAL PRIMARY KEY,
        import_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        scheme_name TEXT NOT NULL,
        scheme_code TEXT,
        amc TEXT,
        folio_number TEXT,
        registrar TEXT,
        closing_balance NUMERIC DEFAULT 0,
        closing_nav NUMERIC DEFAULT 0,
        closing_value NUMERIC DEFAULT 0,
        cost_value NUMERIC DEFAULT 0,
        total_invested NUMERIC DEFAULT 0,
        earliest_date TIMESTAMP,
        avg_nav NUMERIC DEFAULT 0,
        is_mf BOOLEAN DEFAULT TRUE,
        transactions_json JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
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
    // Index for fast import confirmation
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staging_import_id ON cas_import_staging(import_id)
    `);
    tablesEnsured = true;
  } finally {
    client.release();
  }
}

// ════════════════════════════════════════════════════════════════════
//  Filter: only keep mutual fund folios
// ════════════════════════════════════════════════════════════════════
function isMutualFund(folio: CASFolio): boolean {
  const name = (folio.schemeName || '').toLowerCase();
  if (!name || name.length < 5) return false;
  const skipKeywords = ['equity share', 'debenture', 'bond', 'ncd', 'government securities',
    'insurance', 'lic ', 'sgb', 'sovereign gold', 'fixed deposit', 'national savings',
    'ppf', 'epf', 'real estate', 'reit', 'invit', 'gold bond'];
  for (const kw of skipKeywords) {
    if (name.includes(kw)) return false;
  }
  if (folio.schemeCode) return true;
  const mfSignals = ['fund', 'growth', 'direct', 'regular', 'dividend', 'idcw',
    'flexi', 'cap', 'equity', 'debt', 'hybrid', 'liquid', 'overnight',
    'gilt', 'index', 'nifty', 'sensex', 'balanced', 'advantage', 'savings',
    'ultra short', 'money market', 'arbitrage', 'value', 'contra',
    'focused', 'multi', 'large', 'mid', 'small', 'elss', 'tax'];
  return mfSignals.some(s => name.includes(s)) && folio.closingBalance > 0;
}

// ════════════════════════════════════════════════════════════════════
//  POST — Parse PDF, match codes, stage in DB, return importId + preview
//  The app NEVER receives raw folio data. Only a preview summary.
// ════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureTables();

    const formData = await request.formData();
    const file = formData.get('casFile') as File;
    const obfuscatedPassword = formData.get('password') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const password = obfuscatedPassword ? deobfuscateFromTransport(obfuscatedPassword) : undefined;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Step 1: Parse PDF (Python casparser primary, JS fallback) ──
    let parsedData: ParsedCAS | null = null;
    let parser = 'unknown';

    // Try Python casparser first
    parsedData = await parseCASWithPython(buffer, password);
    if (parsedData && parsedData.folios && parsedData.folios.length > 0) {
      parser = 'casparser';
      console.log(`[CAS] Python casparser: ${parsedData.folios.length} folios`);
    } else {
      // Fallback to JS parser
      console.log('[CAS] Python casparser unavailable, falling back to JS parser');
      let textContent = '';
      try {
        const pdf = await getDocumentProxy(new Uint8Array(buffer), { password: password || undefined });
        const result = await extractText(pdf, { mergePages: true });
        textContent = result.text;
      } catch (pdfError) {
        const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error';
        if (errorMessage.includes('password') || errorMessage.includes('encrypted') || errorMessage.includes('Incorrect Password')) {
          return NextResponse.json({
            error: 'This PDF is password protected. Please enter the correct password (usually your PAN like ABCDE1234F or DOB like 01011990).',
            requiresPassword: true
          }, { status: 400 });
        }
        return NextResponse.json({ error: 'Could not parse PDF.', details: errorMessage }, { status: 400 });
      }
      if (!textContent || textContent.trim().length < 100) {
        return NextResponse.json({ error: 'Could not extract text from PDF. The file may be scanned or image-based.' }, { status: 400 });
      }
      parsedData = parseCASText(textContent);
      parser = 'javascript';
      console.log(`[CAS] JS parser: ${parsedData.folios.length} folios`);
    }

    if (!parsedData || parsedData.folios.length === 0) {
      return NextResponse.json({ error: 'No holdings found in the CAS statement.' }, { status: 400 });
    }

    // ── Step 2: Match every scheme to our funds DB ──
    for (const folio of parsedData.folios) {
      const existingCode = folio.schemeCode;
      const isin = existingCode && existingCode.startsWith('INF') ? existingCode : undefined;
      // Try AMFI code match first (from casparser), then ISIN, then name
      const amfiCode = existingCode && /^\d{5,6}$/.test(existingCode) ? existingCode : undefined;
      if (amfiCode) {
        // Verify it exists in our DB
        const verify = await pool.query(`SELECT scheme_code FROM funds WHERE scheme_code = $1 LIMIT 1`, [amfiCode]);
        if (verify.rows.length > 0) {
          folio.schemeCode = amfiCode;
          continue;
        }
      }
      const matched = await matchSchemeCode(folio.schemeName, isin);
      if (matched) folio.schemeCode = matched;
    }

    const matchedCount = parsedData.folios.filter(f => !!f.schemeCode).length;
    console.log(`[CAS] Matched ${matchedCount}/${parsedData.folios.length} folios to DB`);

    // ── Step 3: Filter MF folios and compute financials ──
    const mfFolios = parsedData.folios.filter(isMutualFund);
    const nonMfCount = parsedData.folios.length - mfFolios.length;

    // ── Step 4: Stage all MF holdings in DB with a unique importId ──
    const importId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear any previous pending imports for this user (only keep latest)
      await client.query(`DELETE FROM cas_import_staging WHERE user_id = $1`, [user.id]);

      for (const folio of mfFolios) {
        // Compute financials from transactions
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
            } catch { /* skip */ }
          }
        }
        if (totalInvested === 0 && folio.costValue) totalInvested = folio.costValue;
        if (totalInvested === 0 && folio.closingNav && folio.closingBalance) {
          totalInvested = folio.closingBalance * folio.closingNav;
        }
        const avgNav = folio.closingNav || (folio.closingBalance > 0 && totalInvested > 0 ? totalInvested / folio.closingBalance : 0);
        const closingValue = folio.closingValue || (folio.closingBalance * (folio.closingNav || 0));

        await client.query(
          `INSERT INTO cas_import_staging
            (import_id, user_id, scheme_name, scheme_code, amc, folio_number, registrar,
             closing_balance, closing_nav, closing_value, cost_value, total_invested,
             earliest_date, avg_nav, is_mf, transactions_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [importId, user.id, folio.schemeName, folio.schemeCode || null,
           folio.amc, folio.folioNumber, folio.registrar || '',
           folio.closingBalance, folio.closingNav || 0, closingValue,
           folio.costValue || 0, totalInvested,
           earliestDate, avgNav, true,
           JSON.stringify(txns)]
        );
      }

      await client.query('COMMIT');
    } catch (stageErr) {
      await client.query('ROLLBACK');
      throw stageErr;
    } finally {
      client.release();
    }

    console.log(`[CAS] Staged ${mfFolios.length} MF holdings under importId=${importId}`);

    // ── Step 5: Build preview for the app (lightweight, no sensitive data) ──
    const preview: PreviewItem[] = mfFolios.map(f => ({
      schemeName: f.schemeName,
      amc: f.amc,
      closingBalance: f.closingBalance,
      closingValue: f.closingValue || (f.closingBalance * (f.closingNav || 0)),
      matched: !!f.schemeCode,
      schemeCode: f.schemeCode || null,
    }));

    const totalValue = preview.reduce((s, p) => s + p.closingValue, 0);

    return NextResponse.json({
      success: true,
      importId,
      parser,
      data: {
        investorName: maskName(parsedData.investorName),
        email: maskEmail(parsedData.email),
        pan: maskPAN(parsedData.pan),
        folios: preview,
        summary: {
          totalFolios: new Set(mfFolios.map(f => f.folioNumber)).size,
          totalSchemes: mfFolios.length,
          totalInvested: parsedData.summary.totalInvested,
          currentValue: totalValue,
        }
      },
      message: `Parsed ${mfFolios.length} mutual fund holdings (${matchedCount} matched). ${nonMfCount} non-MF items skipped.`,
    });

  } catch (error) {
    console.error('[CAS-POST] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: 'Failed to parse CAS statement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════════════
//  PUT — Confirm import: promote staged rows → portfolio_holdings
//  Request body: { importId } — that's it. ZERO folio data.
// ════════════════════════════════════════════════════════════════════
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureTables();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const importId = body.importId as string;
    if (!importId) {
      return NextResponse.json({ error: 'Missing importId' }, { status: 400 });
    }

    // Fetch staged holdings for this user + importId
    const staged = await pool.query(
      `SELECT * FROM cas_import_staging WHERE import_id = $1 AND user_id = $2 AND is_mf = TRUE ORDER BY id`,
      [importId, user.id]
    );

    if (staged.rows.length === 0) {
      return NextResponse.json({ error: 'No staged import found. Please re-upload your CAS statement.' }, { status: 404 });
    }

    console.log(`[CAS-PUT] Confirming import ${importId}: ${staged.rows.length} staged holdings`);

    const client = await pool.connect();
    let importedCount = 0;
    let errorCount = 0;

    try {
      await client.query('BEGIN');

      // Log first staged row for diagnostics
      if (staged.rows.length > 0) {
        const r = staged.rows[0];
        console.log(`[CAS-PUT] Sample staged row keys: ${Object.keys(r).join(', ')}`);
        console.log(`[CAS-PUT] Sample: scheme_code=${r.scheme_code}, scheme_name=${String(r.scheme_name).substring(0,40)}, closing_balance=${r.closing_balance}, avg_nav=${r.avg_nav}, total_invested=${r.total_invested}, earliest_date=${r.earliest_date}, folio_number=${r.folio_number?.substring(0,10)}`);
      }

      // Check portfolio_holdings columns
      const colCheck = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'portfolio_holdings' ORDER BY ordinal_position`
      );
      console.log(`[CAS-PUT] portfolio_holdings columns: ${colCheck.rows.map((r: any) => r.column_name).join(', ')}`);

      for (let i = 0; i < staged.rows.length; i++) {
        const row = staged.rows[i];
        const sp = `sp_row_${i}`;
        try {
          await client.query(`SAVEPOINT ${sp}`);

          const schemeCode = row.scheme_code;
          const holdingKey = schemeCode || `UNMATCHED:${(row.scheme_name || '').substring(0, 80).replace(/[^a-zA-Z0-9 ]/g, '')}`;
          const encryptedFolio = encryptPII(row.folio_number || '');
          const purchaseDate = row.earliest_date ? new Date(row.earliest_date) : new Date();
          const units = parseFloat(row.closing_balance) || 0;
          const avgNav = parseFloat(row.avg_nav) || 0;
          const totalInvested = parseFloat(row.total_invested) || 0;
          const notes = `CAS Import - ${row.amc || ''} - ${(row.scheme_name || '').substring(0, 60)}`;

          // Upsert: update if exists, insert if not
          const existing = await client.query(
            `SELECT id FROM portfolio_holdings WHERE user_id = $1 AND scheme_code = $2`,
            [user.id, holdingKey]
          );

          if (existing.rows.length > 0) {
            await client.query(
              `UPDATE portfolio_holdings
               SET units = $1, purchase_nav = $2, purchase_amount = $3, folio_number = $4,
                   source = 'cas', updated_at = NOW(), notes = $6
               WHERE id = $5`,
              [units, avgNav, totalInvested, encryptedFolio,
               existing.rows[0].id, notes]
            );
          } else {
            await client.query(
              `INSERT INTO portfolio_holdings
                (user_id, scheme_code, units, purchase_nav, purchase_date, purchase_amount, notes, source, folio_number)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'cas', $8)`,
              [user.id, holdingKey, units, avgNav,
               purchaseDate, totalInvested, notes, encryptedFolio]
            );
          }

          await client.query(`RELEASE SAVEPOINT ${sp}`);
          importedCount++;
        } catch (rowErr) {
          // Rollback just this row — transaction stays alive for remaining rows
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          const errMsg = rowErr instanceof Error ? rowErr.message : String(rowErr);
          console.error(`[CAS-PUT] Row ${i} FAILED (${row.scheme_name?.substring(0, 40)}): ${errMsg}`);
          if (i === 0) {
            // Log full error for first failure to diagnose
            console.error(`[CAS-PUT] Row 0 full error:`, rowErr);
          }
          errorCount++;
        }
      }

      // Extract and save SIP info from staged transactions
      let sipSaved = 0;
      try {
        await client.query(`SAVEPOINT sp_sip`);
        await client.query(`DELETE FROM cas_sip_info WHERE user_id = $1`, [user.id]);
        for (const row of staged.rows) {
          try {
            const txns = row.transactions_json || [];
            const sipTxns = txns.filter((t: any) =>
              t.type === 'SIP' || (t.description || '').toLowerCase().includes('systematic') || (t.description || '').toLowerCase().includes('sip')
            );
            if (sipTxns.length >= 2) {
              const amounts = sipTxns.map((t: any) => Math.round(Math.abs(t.amount || 0)));
              const freq: Record<number, number> = {};
              for (const a of amounts) freq[a] = (freq[a] || 0) + 1;
              const sipAmount = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
              const lastSip = sipTxns[sipTxns.length - 1];
              await client.query(
                `INSERT INTO cas_sip_info (user_id, scheme_code, scheme_name, sip_amount, frequency, last_sip_date)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [user.id, row.scheme_code || null, row.scheme_name, sipAmount, 'Monthly', lastSip.date || '']
              );
              sipSaved++;
            }
          } catch { /* skip individual SIP errors */ }
        }
        await client.query(`RELEASE SAVEPOINT sp_sip`);
      } catch {
        await client.query(`ROLLBACK TO SAVEPOINT sp_sip`);
        console.log('[CAS-PUT] SIP extraction failed, skipping');
      }

      // Clean up staging data after successful commit
      await client.query(`DELETE FROM cas_import_staging WHERE import_id = $1`, [importId]);

      await client.query('COMMIT');

      console.log(`[CAS-PUT] Import complete: ${importedCount} imported, ${errorCount} errors, ${sipSaved} SIPs`);

      return NextResponse.json({
        success: true,
        imported: importedCount,
        skipped: errorCount,
        sipCount: sipSaved,
        message: `Imported ${importedCount} mutual fund holdings. ${sipSaved} SIPs detected.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown';
    console.error('[CAS-PUT] Error:', errMsg);
    return NextResponse.json({
      error: 'Failed to save holdings',
      details: errMsg
    }, { status: 500 });
  }
}
