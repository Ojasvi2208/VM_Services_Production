import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/postgres-db';
import { extractText, getDocumentProxy } from 'unpdf';

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
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
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

  let currentFolio: CASFolio | null = null;
  let inTransactionSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // Extract investor name
    if (line.includes('Name:') || line.match(/^[A-Z\s]+$/)) {
      const nameMatch = line.match(/Name:\s*(.+)/i);
      if (nameMatch) {
        parsed.investorName = nameMatch[1].trim();
      }
    }

    // Extract PAN
    const panMatch = line.match(/PAN:\s*([A-Z]{5}[0-9]{4}[A-Z])/i) || line.match(/([A-Z]{5}[0-9]{4}[A-Z])/);
    if (panMatch && !parsed.pan) {
      parsed.pan = panMatch[1];
    }

    // Extract email
    const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && !parsed.email) {
      parsed.email = emailMatch[1];
    }

    // Extract statement period
    const periodMatch = line.match(/(\d{2}-[A-Za-z]{3}-\d{4})\s*to\s*(\d{2}-[A-Za-z]{3}-\d{4})/i);
    if (periodMatch) {
      parsed.statementPeriod.from = periodMatch[1];
      parsed.statementPeriod.to = periodMatch[2];
    }

    // Detect folio start - look for AMC names or Folio No
    const folioMatch = line.match(/Folio\s*No[.:]\s*(\d+[\d\/]*)/i);
    if (folioMatch) {
      if (currentFolio) {
        parsed.folios.push(currentFolio);
      }
      currentFolio = {
        folioNumber: folioMatch[1],
        amc: '',
        schemeName: '',
        pan: parsed.pan,
        registrar: '',
        closingBalance: 0,
        transactions: []
      };
      inTransactionSection = false;
    }

    // Detect AMC name
    const amcPatterns = [
      /^(HDFC|ICICI|SBI|Axis|Kotak|Nippon|Aditya Birla|UTI|DSP|Tata|Franklin|Mirae|PPFAS|Motilal|Edelweiss|IDFC|L&T|Invesco|Sundaram|Canara|Baroda|Union|HSBC|Principal|Quantum|Mahindra|PGIM|ITI|Navi|Groww|Zerodha)/i
    ];
    
    for (const pattern of amcPatterns) {
      const amcMatch = line.match(pattern);
      if (amcMatch && currentFolio && !currentFolio.amc) {
        currentFolio.amc = line;
        break;
      }
    }

    // Detect scheme name (usually follows AMC or contains "Fund", "Scheme", "Plan")
    if (currentFolio && !currentFolio.schemeName && 
        (line.includes('Fund') || line.includes('Scheme') || line.includes('Plan') || line.includes('Growth') || line.includes('Dividend'))) {
      if (!line.includes('Folio') && !line.includes('NAV') && line.length > 10) {
        currentFolio.schemeName = line.replace(/\s+/g, ' ').trim();
      }
    }

    // Detect registrar
    if (line.includes('CAMS') || line.includes('KARVY') || line.includes('KFINTECH') || line.includes('FRANKLIN')) {
      if (currentFolio) {
        currentFolio.registrar = line.includes('CAMS') ? 'CAMS' : 
                                 line.includes('KFINTECH') ? 'KFINTECH' : 
                                 line.includes('KARVY') ? 'KARVY' : 'OTHER';
      }
    }

    // Parse transactions - look for date patterns with amounts
    const transactionMatch = line.match(/(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
    if (transactionMatch && currentFolio) {
      const [, date, description, amount, units, nav, balance] = transactionMatch;
      
      let type: CASTransaction['type'] = 'BUY';
      const descLower = description.toLowerCase();
      if (descLower.includes('redemption') || descLower.includes('redeem')) type = 'REDEMPTION';
      else if (descLower.includes('sip') || descLower.includes('systematic')) type = 'SIP';
      else if (descLower.includes('switch') && descLower.includes('in')) type = 'SWITCH_IN';
      else if (descLower.includes('switch') && descLower.includes('out')) type = 'SWITCH_OUT';
      else if (descLower.includes('dividend')) type = 'DIVIDEND';
      else if (descLower.includes('swp')) type = 'SWP';
      else if (parseFloat(units.replace(/,/g, '')) < 0) type = 'SELL';

      currentFolio.transactions.push({
        date,
        description: description.trim(),
        amount: parseFloat(amount.replace(/,/g, '')),
        units: parseFloat(units.replace(/,/g, '')),
        nav: parseFloat(nav.replace(/,/g, '')),
        balance: parseFloat(balance.replace(/,/g, '')),
        type
      });
    }

    // Extract closing balance
    const closingMatch = line.match(/Closing\s*(?:Unit)?\s*Balance[:\s]*([\d,]+\.?\d*)/i);
    if (closingMatch && currentFolio) {
      currentFolio.closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''));
    }

    // Extract closing NAV and value
    const navMatch = line.match(/NAV[:\s]*([\d,]+\.?\d*)/i);
    if (navMatch && currentFolio) {
      currentFolio.closingNav = parseFloat(navMatch[1].replace(/,/g, ''));
    }

    const valueMatch = line.match(/(?:Market\s*)?Value[:\s]*(?:Rs\.?|INR)?\s*([\d,]+\.?\d*)/i);
    if (valueMatch && currentFolio) {
      currentFolio.closingValue = parseFloat(valueMatch[1].replace(/,/g, ''));
    }
  }

  // Add last folio
  if (currentFolio) {
    parsed.folios.push(currentFolio);
  }

  // Calculate summary
  parsed.summary.totalFolios = parsed.folios.length;
  parsed.summary.totalSchemes = parsed.folios.length;
  
  for (const folio of parsed.folios) {
    if (folio.closingValue) {
      parsed.summary.currentValue += folio.closingValue;
    }
    for (const tx of folio.transactions) {
      if (tx.type === 'BUY' || tx.type === 'SIP') {
        parsed.summary.totalInvested += Math.abs(tx.amount);
      } else if (tx.type === 'SELL' || tx.type === 'REDEMPTION') {
        parsed.summary.totalInvested -= Math.abs(tx.amount);
      }
    }
  }

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
    const password = formData.get('password') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

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
        textPreview: textContent.substring(0, 500)
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
