import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { extractText, getDocumentProxy } from 'unpdf';
import { deobfuscateFromTransport } from '@/lib/encryption';

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
  // Normalize text - handle various line endings and extra spaces
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fullText = normalizedText.replace(/\s+/g, ' ');
  
  const parsed: ParsedCAS = {
    investorName: '',
    email: '',
    pan: '',
    statementPeriod: { from: '', to: '' },
    folios: [],
    summary: {
      totalFolios: 0,
      totalSchemes: 0,
      totalInvested: 0,
      currentValue: 0
    }
  };

  // Extract investor name - look for pattern after NSDL ID
  const nameMatch = fullText.match(/NSDL ID:\s*\d+\s+([A-Z][A-Z\s]+?)(?:\s+H\s*NO|\s+FLAT|\s+HOUSE|\s+\d)/i);
  if (nameMatch) {
    parsed.investorName = nameMatch[1].trim();
  }

  // Extract PAN - look for full PAN or masked PAN
  const panPatterns = [
    /\[([A-Z]{5}[0-9]{4}[A-Z])\]/,  // [BUFPM1041P]
    /PAN\s*[:\-]?\s*([A-Z]{5}[0-9]{4}[A-Z])/i,
    /PAN\s*[:\-]?\s*([A-Z]{2}X{4,6}[0-9]?[A-Z0-9]?[A-Z])/i  // Masked PAN like BUXXXXXX1P
  ];
  for (const pattern of panPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      parsed.pan = match[1].toUpperCase();
      break;
    }
  }

  // Extract statement period
  const periodMatch = fullText.match(/(?:period\s+)?from\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+to\s+(\d{2}-[A-Za-z]{3}-\d{4})/i);
  if (periodMatch) {
    parsed.statementPeriod.from = periodMatch[1];
    parsed.statementPeriod.to = periodMatch[2];
  }

  // NSDL CAS ISIN-based parsing
  // Pattern 1: Mutual Funds in Demat - ISIN followed by scheme name, units, NAV, value
  // Format: INFxxxxx SCHEME NAME X,XXX.XXX XXX.XXXX XX,XXX.XX
  
  // Find all ISIN codes for mutual funds (start with INF)
  const isinPattern = /\b(INF[A-Z0-9]{9})\b/g;
  const isins = new Set<string>();
  let isinMatch;
  while ((isinMatch = isinPattern.exec(fullText)) !== null) {
    isins.add(isinMatch[1]);
  }

  console.log(`Found ${isins.size} unique mutual fund ISINs`);

  // For each ISIN, extract the scheme details
  for (const isin of isins) {
    // Pattern for Mutual Funds in Demat section:
    // ISIN SCHEME_NAME UNITS NAV VALUE
    // Example: INF179K01574 HDFC FOCUSED 30 FUND REGULAR PLAN GROWTH OPTION 7,346.606 217.2050 15,95,719.55
    
    // Build regex to find this ISIN and its data
    const isinEscaped = isin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Try to match ISIN followed by scheme name and numbers
    // The scheme name contains words, then we have units (decimal), NAV (decimal), value (decimal)
    const schemePattern = new RegExp(
      isinEscaped + 
      '\\s+([A-Z][A-Z0-9\\s\\-\\/&]+(?:FUND|GROWTH|PLAN|OPTION|SCHEME)[A-Z0-9\\s\\-\\/&]*)' +
      '(?:\\s+of\\s+which\\s+locked-in\\s+[\\d,\\.]+)?\\s*' +
      '([\\d,]+\\.\\d{2,4})\\s+' +  // Units
      '([\\d,]+\\.\\d{2,4})\\s+' +  // NAV
      '([\\d,]+\\.\\d{2})',          // Value
      'i'
    );
    
    const schemeMatch = fullText.match(schemePattern);
    
    if (schemeMatch) {
      const schemeName = schemeMatch[1].replace(/\s+/g, ' ').trim();
      const units = parseFloat(schemeMatch[2].replace(/,/g, ''));
      const nav = parseFloat(schemeMatch[3].replace(/,/g, ''));
      const value = parseFloat(schemeMatch[4].replace(/,/g, ''));
      
      // Only add if units > 0 (skip zero balance holdings)
      if (units > 0) {
        // Extract AMC from scheme name
        let amc = '';
        const amcPatterns = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Nippon', 'DSP', 'Motilal', 'Canara', 'Quant', 'NJ', 'Tata', 'UTI', 'Aditya Birla', 'Franklin', 'Mirae', 'PPFAS', 'Edelweiss', 'IDFC', 'L&T', 'Invesco', 'Sundaram', 'Baroda', 'Union', 'HSBC', 'Quantum', 'Mahindra', 'PGIM', 'Bandhan', 'WhiteOak', 'JM', 'LIC'];
        for (const amcName of amcPatterns) {
          if (schemeName.toUpperCase().includes(amcName.toUpperCase())) {
            amc = amcName;
            break;
          }
        }
        
        parsed.folios.push({
          folioNumber: isin, // Use ISIN as identifier for demat holdings
          amc: amc,
          schemeName: schemeName,
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
  }

  // Pattern 2: Mutual Fund Folios section
  // Format: ISIN UCC SCHEME_NAME FOLIO_NO UNITS AVG_COST TOTAL_COST CURRENT_NAV CURRENT_VALUE P/L RETURN%
  // Example: INF760K01167 NOT AVAILABLE Canara Robeco Emerging Equities - Regular Growth 1219192596 4.090 92.9609 380.21 248.3000 1,015.55 635.34 18.30
  
  const folioSectionMatch = fullText.match(/Mutual Fund Folios \(F\)([\s\S]*?)(?:Notes:|Page \d|$)/i);
  if (folioSectionMatch) {
    const folioSection = folioSectionMatch[1];
    
    // Find ISINs in folio section
    const folioIsinPattern = /\b(INF[A-Z0-9]{9})\s+(?:NOT AVAILABLE|[A-Z0-9]+)\s+([A-Za-z][A-Za-z0-9\s\-\/&]+(?:Growth|Fund|Plan))\s+(\d{8,12})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/gi;
    
    let folioMatch;
    while ((folioMatch = folioIsinPattern.exec(folioSection)) !== null) {
      const isin = folioMatch[1];
      const schemeName = folioMatch[2].replace(/\s+/g, ' ').trim();
      const folioNumber = folioMatch[3];
      const units = parseFloat(folioMatch[4].replace(/,/g, ''));
      const avgCost = parseFloat(folioMatch[5].replace(/,/g, ''));
      const totalCost = parseFloat(folioMatch[6].replace(/,/g, ''));
      const currentNav = parseFloat(folioMatch[7].replace(/,/g, ''));
      const currentValue = parseFloat(folioMatch[8].replace(/,/g, ''));
      
      if (units > 0) {
        // Check if this folio already exists
        const existingFolio = parsed.folios.find(f => f.folioNumber === folioNumber || f.schemeCode === isin);
        if (!existingFolio) {
          let amc = '';
          const amcPatterns = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Nippon', 'DSP', 'Motilal', 'Canara', 'Quant', 'NJ', 'Tata', 'UTI', 'Aditya Birla', 'Franklin', 'Mirae', 'PPFAS', 'Edelweiss', 'IDFC', 'L&T', 'Invesco', 'Sundaram', 'Baroda', 'Union', 'HSBC', 'Quantum', 'Mahindra', 'PGIM', 'Bandhan', 'WhiteOak', 'JM', 'LIC'];
          for (const amcName of amcPatterns) {
            if (schemeName.toUpperCase().includes(amcName.toUpperCase())) {
              amc = amcName;
              break;
            }
          }
          
          parsed.folios.push({
            folioNumber: folioNumber,
            amc: amc,
            schemeName: schemeName,
            schemeCode: isin,
            pan: parsed.pan,
            registrar: 'KFIN',
            closingBalance: units,
            closingNav: currentNav,
            closingValue: currentValue,
            costValue: totalCost,
            transactions: []
          });
        }
      }
    }
  }

  // If still no folios found, try a simpler pattern matching
  if (parsed.folios.length === 0) {
    console.log('ISIN-based parsing found no folios, trying simpler pattern...');
    
    // Look for any line with FUND/GROWTH and numbers
    const simplePattern = /([A-Z][A-Za-z0-9\s\-\/&]+(?:FUND|GROWTH|PLAN)[A-Za-z0-9\s\-\/&]*)\s+([\d,]+\.?\d{3})\s+([\d,]+\.?\d{4})\s+([\d,]+\.?\d{2})/gi;
    let simpleMatch;
    while ((simpleMatch = simplePattern.exec(fullText)) !== null) {
      const schemeName = simpleMatch[1].replace(/\s+/g, ' ').trim();
      const units = parseFloat(simpleMatch[2].replace(/,/g, ''));
      const nav = parseFloat(simpleMatch[3].replace(/,/g, ''));
      const value = parseFloat(simpleMatch[4].replace(/,/g, ''));
      
      if (units > 0 && !schemeName.toLowerCase().includes('sub total') && !schemeName.toLowerCase().includes('total')) {
        // Check for duplicates
        const exists = parsed.folios.some(f => f.schemeName === schemeName);
        if (!exists) {
          parsed.folios.push({
            folioNumber: 'DEMAT',
            amc: '',
            schemeName: schemeName,
            pan: parsed.pan,
            registrar: 'NSDL',
            closingBalance: units,
            closingNav: nav,
            closingValue: value,
            transactions: []
          });
        }
      }
    }
  }

  // Calculate summary
  parsed.summary.totalFolios = parsed.folios.length;
  parsed.summary.totalSchemes = parsed.folios.length;
  
  for (const folio of parsed.folios) {
    if (folio.closingValue) {
      parsed.summary.currentValue += folio.closingValue;
    } else if (folio.closingBalance && folio.closingNav) {
      const calculatedValue = folio.closingBalance * folio.closingNav;
      folio.closingValue = calculatedValue;
      parsed.summary.currentValue += calculatedValue;
    }
    
    if (folio.costValue) {
      parsed.summary.totalInvested += folio.costValue;
    }
  }

  console.log(`Parsed ${parsed.folios.length} mutual fund holdings`);
  
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

    // Convert file to buffer for server-side PDF parsing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let textContent = '';
    
    try {
      // Parse PDF server-side using unpdf (supports password-protected PDFs)
      // First get document proxy with password, then extract text
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
    
    // Parse the CAS text
    const parsedData = parseCASText(textContent);

    // Match scheme codes for each folio
    for (const folio of parsedData.folios) {
      const schemeCode = await matchSchemeCode(folio.schemeName);
      if (schemeCode) {
        folio.schemeCode = schemeCode;
      }
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      message: `Successfully parsed ${parsedData.folios.length} mutual fund holdings`,
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

    const { folios } = await request.json() as { folios: CASFolio[] };

    if (!folios || folios.length === 0) {
      return NextResponse.json({ error: 'No holdings to import' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

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
