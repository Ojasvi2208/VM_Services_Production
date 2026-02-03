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

  // NSDL CAS parsing - hardcoded scheme data based on known ISIN patterns
  // The PDF text extraction may not preserve exact formatting, so we use multiple strategies
  
  const amcPatterns = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Nippon', 'DSP', 'Motilal', 'Canara', 'Quant', 'NJ', 'Tata', 'UTI', 'Aditya Birla', 'Franklin', 'Mirae', 'PPFAS', 'Edelweiss', 'IDFC', 'L&T', 'Invesco', 'Sundaram', 'Baroda', 'Union', 'HSBC', 'Quantum', 'Mahindra', 'PGIM', 'Bandhan', 'WhiteOak', 'JM', 'LIC'];
  
  // Known ISIN to scheme name mapping (common mutual funds)
  const isinSchemeMap: Record<string, string> = {
    'INF740K01318': 'DSP Equity & Bond Fund - Growth',
    'INF179K01574': 'HDFC Focused 30 Fund Regular Plan Growth Option',
    'INF109K01IF1': 'ICICI Prudential Nifty Next 50 Index Fund - Growth',
    'INF247L01411': 'Motilal Oswal Focused Midcap 30 Fund - Regular Growth',
    'INF247L01908': 'Motilal Oswal Nifty Midcap 150 Index Fund - Regular Plan Growth',
    'INF204K01HY3': 'Nippon India Small Cap Fund Growth Plan - Growth Option',
    'INF0J8L01099': 'NJ ELSS Tax Saver Scheme - Regular Plan Growth',
    'INF966L01AA0': 'Quant Small Cap Fund - Regular Plan Growth',
    'INF966L01135': 'Quant Tax Plan - Growth',
    'INF200KB1092': 'SBI Energy Opportunities Fund - Regular Plan Growth',
    'INF200K01107': 'SBI Equity Hybrid Fund Regular Plan Growth',
    'INF760K01167': 'Canara Robeco Emerging Equities - Regular Growth',
    'INF760K01795': 'Canara Robeco Savings Fund - Regular Growth'
  };
  
  console.log('Starting NSDL CAS parsing...');
  console.log('Full text length:', fullText.length);
  
  // Strategy 1: Find ISINs and extract data from surrounding text
  const isinRegex = /\b(INF[A-Z0-9]{9})\b/g;
  const foundIsins = new Set<string>();
  let match;
  while ((match = isinRegex.exec(fullText)) !== null) {
    foundIsins.add(match[1]);
  }
  
  console.log(`Found ${foundIsins.size} unique ISINs:`, Array.from(foundIsins));
  
  // For each ISIN, try to extract the data
  for (const isin of foundIsins) {
    // Skip if already processed
    if (parsed.folios.some(f => f.schemeCode === isin)) continue;
    
    // Find all occurrences of this ISIN and get surrounding context
    const isinIndex = fullText.indexOf(isin);
    if (isinIndex === -1) continue;
    
    // Get text after ISIN (up to 500 chars or next ISIN)
    const afterIsin = fullText.substring(isinIndex + isin.length, isinIndex + 500);
    
    // Skip if this appears to be in transactions section (has dates)
    if (afterIsin.match(/^\s*\d{2}-[A-Za-z]{3}-\d{4}/)) continue;
    
    // Try to extract: SCHEME_NAME followed by UNITS NAV VALUE
    // Pattern: text followed by three decimal numbers
    // Units: X,XXX.XXX (3+ decimal places)
    // NAV: XXX.XXXX (4 decimal places)  
    // Value: X,XX,XXX.XX (2 decimal places, Indian format with commas)
    
    let schemeName = isinSchemeMap[isin] || '';
    let units = 0;
    let nav = 0;
    let value = 0;
    
    // Try multiple patterns to extract the numbers
    // Pattern 1: Look for scheme name then numbers
    const pattern1 = /^\s*([A-Z][A-Z0-9\s\-\/&]+?)\s+(?:of which locked-in\s+[\d,\.]+\s+)?(\d[\d,]*\.\d{3,})\s+(\d[\d,]*\.\d{4})\s+(\d[\d,]*\.\d{2})/i;
    const match1 = afterIsin.match(pattern1);
    
    if (match1) {
      if (!schemeName) schemeName = match1[1].trim();
      units = parseFloat(match1[2].replace(/,/g, ''));
      nav = parseFloat(match1[3].replace(/,/g, ''));
      value = parseFloat(match1[4].replace(/,/g, ''));
    } else {
      // Pattern 2: Numbers might be on separate lines or with different spacing
      // Look for three numbers in sequence
      const numbersPattern = /(\d[\d,]*\.\d{3,})\s+(\d[\d,]*\.\d{2,})\s+(\d[\d,]*\.\d{2})/;
      const numbersMatch = afterIsin.match(numbersPattern);
      
      if (numbersMatch) {
        units = parseFloat(numbersMatch[1].replace(/,/g, ''));
        nav = parseFloat(numbersMatch[2].replace(/,/g, ''));
        value = parseFloat(numbersMatch[3].replace(/,/g, ''));
        
        // Extract scheme name from text before numbers
        const beforeNumbers = afterIsin.substring(0, afterIsin.indexOf(numbersMatch[0]));
        if (!schemeName && beforeNumbers.trim()) {
          schemeName = beforeNumbers.replace(/\s+/g, ' ').trim();
        }
      }
    }
    
    // Clean up scheme name
    schemeName = schemeName
      .replace(/\s+of\s+which\s+locked-in.*$/i, '')
      .replace(/\s*\d[\d,]*\.\d+\s*$/g, '')
      .replace(/Sub Total.*$/i, '')
      .replace(/^\s*ISIN\s*/i, '')
      .trim();
    
    // If still no scheme name, use the ISIN mapping or generate from ISIN
    if (!schemeName || schemeName.length < 5) {
      schemeName = isinSchemeMap[isin] || `Fund ${isin}`;
    }
    
    // Only add if we have valid units (> 0)
    if (units > 0) {
      // Determine AMC
      let amc = '';
      for (const amcName of amcPatterns) {
        if (schemeName.toUpperCase().includes(amcName.toUpperCase())) {
          amc = amcName;
          break;
        }
      }
      
      parsed.folios.push({
        folioNumber: isin,
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
      
      console.log(`Added holding: ${schemeName} - ${units} units @ ${nav} = ${value}`);
    }
  }
  
  // Strategy 2: Parse Mutual Fund Folios section separately
  // Format: ISIN UCC SCHEME_NAME FOLIO_NO UNITS AVG_COST TOTAL_COST CURRENT_NAV CURRENT_VALUE P/L RETURN%
  const folioSectionMatch = fullText.match(/Mutual Fund Folios \(F\)([\s\S]*?)(?:Notes:|Page \d|Life Insurance|e-Insurance|NSDL NATIONAL|$)/i);
  if (folioSectionMatch) {
    console.log('Found Mutual Fund Folios section');
    const folioSection = folioSectionMatch[1];
    
    // Look for each ISIN in this section
    for (const isin of foundIsins) {
      if (parsed.folios.some(f => f.schemeCode === isin)) continue;
      
      const isinIdx = folioSection.indexOf(isin);
      if (isinIdx === -1) continue;
      
      const afterIsin = folioSection.substring(isinIdx + isin.length, isinIdx + 400);
      
      // Pattern for folio section: UCC SCHEME_NAME FOLIO_NO UNITS AVG_COST TOTAL_COST NAV VALUE
      const folioPattern = /^\s*(?:NOT AVAILABLE|[A-Z0-9]+)\s+([A-Za-z][A-Za-z0-9\s\-\/&]+?)\s+(\d{8,12})\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d*)/i;
      const folioMatch = afterIsin.match(folioPattern);
      
      if (folioMatch) {
        const schemeName = folioMatch[1].trim() || isinSchemeMap[isin] || `Fund ${isin}`;
        const folioNumber = folioMatch[2];
        const units = parseFloat(folioMatch[3].replace(/,/g, ''));
        const avgCost = parseFloat(folioMatch[4].replace(/,/g, ''));
        const totalCost = parseFloat(folioMatch[5].replace(/,/g, ''));
        const currentNav = parseFloat(folioMatch[6].replace(/,/g, ''));
        const currentValue = parseFloat(folioMatch[7].replace(/,/g, ''));
        
        if (units > 0) {
          let amc = '';
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
          
          console.log(`Added folio holding: ${schemeName} - ${units} units @ ${currentNav} = ${currentValue}`);
        }
      }
    }
  }
  
  console.log(`Total holdings parsed: ${parsed.folios.length}`)

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
