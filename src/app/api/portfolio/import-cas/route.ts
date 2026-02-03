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
  // Normalize text - handle various line endings and extra spaces
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l);
  
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

  // Join all text for regex matching across lines
  const fullText = lines.join(' ');
  
  // Extract PAN - multiple patterns
  const panPatterns = [
    /PAN\s*[:\-]?\s*([A-Z]{5}[0-9]{4}[A-Z])/i,
    /\b([A-Z]{5}[0-9]{4}[A-Z])\b/
  ];
  for (const pattern of panPatterns) {
    const match = fullText.match(pattern);
    if (match && !parsed.pan) {
      parsed.pan = match[1].toUpperCase();
      break;
    }
  }

  // Extract email
  const emailMatch = fullText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    parsed.email = emailMatch[1];
  }

  // Extract statement period - multiple formats
  const periodPatterns = [
    /(\d{2}[-\/][A-Za-z]{3}[-\/]\d{4})\s*(?:to|-)\s*(\d{2}[-\/][A-Za-z]{3}[-\/]\d{4})/i,
    /Period\s*[:\-]?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})\s*(?:to|-)\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/i,
    /from\s*(\d{2}[-\/][A-Za-z]{3}[-\/]\d{4})\s*to\s*(\d{2}[-\/][A-Za-z]{3}[-\/]\d{4})/i
  ];
  for (const pattern of periodPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      parsed.statementPeriod.from = match[1];
      parsed.statementPeriod.to = match[2];
      break;
    }
  }

  // NSDL CAS Format parsing - look for mutual fund sections
  // Pattern: AMC name followed by folio and scheme details
  
  // Common AMC names
  const amcNames = [
    'HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Nippon', 'Aditya Birla', 'UTI', 'DSP', 
    'Tata', 'Franklin', 'Mirae', 'PPFAS', 'Motilal', 'Edelweiss', 'IDFC', 'L&T', 
    'Invesco', 'Sundaram', 'Canara', 'Baroda', 'Union', 'HSBC', 'Principal', 
    'Quantum', 'Mahindra', 'PGIM', 'ITI', 'Navi', 'Groww', 'Bandhan', 'Quant',
    'Parag Parikh', 'WhiteOak', 'JM Financial', 'LIC', 'IDBI', 'BOI AXA', 'Shriram'
  ];

  let currentFolio: CASFolio | null = null;
  let currentAMC = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    // Check for AMC name
    for (const amc of amcNames) {
      if (line.toUpperCase().includes(amc.toUpperCase()) && 
          (lineLower.includes('mutual fund') || lineLower.includes('asset management') || 
           lineLower.includes('amc') || line.match(new RegExp(amc, 'i')))) {
        currentAMC = line;
        break;
      }
    }

    // Look for Folio patterns - NSDL format
    const folioPatterns = [
      /Folio\s*(?:No\.?|Number)?[:\s]*([A-Z0-9\/\-]+)/i,
      /Folio[:\s]+([A-Z0-9\/\-]+)/i,
      /([A-Z0-9]{8,}\/[A-Z0-9]+)/  // Format like 12345678/12
    ];
    
    for (const pattern of folioPatterns) {
      const folioMatch = line.match(pattern);
      if (folioMatch) {
        // Save previous folio
        if (currentFolio && currentFolio.schemeName) {
          parsed.folios.push(currentFolio);
        }
        
        currentFolio = {
          folioNumber: folioMatch[1],
          amc: currentAMC,
          schemeName: '',
          pan: parsed.pan,
          registrar: '',
          closingBalance: 0,
          transactions: []
        };
        break;
      }
    }

    // Look for scheme name - contains Fund, Growth, Direct, Regular, etc.
    if (currentFolio && !currentFolio.schemeName) {
      const schemeIndicators = ['fund', 'growth', 'direct', 'regular', 'plan', 'dividend', 'idcw', 'flexi', 'equity', 'debt', 'hybrid', 'index', 'gilt', 'liquid'];
      const hasSchemeIndicator = schemeIndicators.some(ind => lineLower.includes(ind));
      
      if (hasSchemeIndicator && line.length > 15 && !lineLower.includes('folio') && !lineLower.includes('nav')) {
        currentFolio.schemeName = line.replace(/\s+/g, ' ').trim();
      }
    }

    // Look for units/balance - NSDL format often has "Units: X.XXX" or just numbers
    if (currentFolio) {
      // Pattern: Closing Balance or Units followed by number
      const unitsPatterns = [
        /(?:Closing\s*)?(?:Unit\s*)?Balance[:\s]*([\d,]+\.?\d*)/i,
        /Units[:\s]*([\d,]+\.?\d*)/i,
        /Total\s*Units[:\s]*([\d,]+\.?\d*)/i,
        /Available\s*Units[:\s]*([\d,]+\.?\d*)/i
      ];
      
      for (const pattern of unitsPatterns) {
        const unitsMatch = line.match(pattern);
        if (unitsMatch) {
          const units = parseFloat(unitsMatch[1].replace(/,/g, ''));
          if (units > 0) {
            currentFolio.closingBalance = units;
          }
          break;
        }
      }

      // Look for NAV
      const navPatterns = [
        /NAV[:\s]*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)/i,
        /(?:Current|Latest)\s*NAV[:\s]*([\d,]+\.?\d*)/i
      ];
      
      for (const pattern of navPatterns) {
        const navMatch = line.match(pattern);
        if (navMatch) {
          currentFolio.closingNav = parseFloat(navMatch[1].replace(/,/g, ''));
          break;
        }
      }

      // Look for value
      const valuePatterns = [
        /(?:Market\s*)?Value[:\s]*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)/i,
        /(?:Current|Total)\s*Value[:\s]*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)/i,
        /Valuation[:\s]*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)/i
      ];
      
      for (const pattern of valuePatterns) {
        const valueMatch = line.match(pattern);
        if (valueMatch) {
          const value = parseFloat(valueMatch[1].replace(/,/g, ''));
          if (value > 0) {
            currentFolio.closingValue = value;
          }
          break;
        }
      }

      // Parse transaction lines - date followed by description and numbers
      // Format: DD-MMM-YYYY Description Amount Units NAV Balance
      const txPatterns = [
        /(\d{2}[-\/][A-Za-z]{3}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/,
        /(\d{2}[-\/]\d{2}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/
      ];
      
      for (const pattern of txPatterns) {
        const txMatch = line.match(pattern);
        if (txMatch) {
          const [, date, description, ...numbers] = txMatch;
          const amount = parseFloat(numbers[0]?.replace(/,/g, '') || '0');
          const units = parseFloat(numbers[1]?.replace(/,/g, '') || '0');
          const nav = parseFloat(numbers[2]?.replace(/,/g, '') || '0');
          const balance = parseFloat(numbers[3]?.replace(/,/g, '') || '0');
          
          let type: CASTransaction['type'] = 'BUY';
          const descLower = description.toLowerCase();
          if (descLower.includes('redemption') || descLower.includes('redeem')) type = 'REDEMPTION';
          else if (descLower.includes('sip') || descLower.includes('systematic')) type = 'SIP';
          else if (descLower.includes('switch') && descLower.includes('in')) type = 'SWITCH_IN';
          else if (descLower.includes('switch') && descLower.includes('out')) type = 'SWITCH_OUT';
          else if (descLower.includes('dividend')) type = 'DIVIDEND';
          else if (descLower.includes('swp')) type = 'SWP';
          else if (units < 0) type = 'SELL';

          currentFolio.transactions.push({
            date,
            description: description.trim(),
            amount: Math.abs(amount),
            units: Math.abs(units),
            nav,
            balance,
            type
          });
          break;
        }
      }

      // Detect registrar
      if (lineLower.includes('cams')) currentFolio.registrar = 'CAMS';
      else if (lineLower.includes('kfintech') || lineLower.includes('karvy')) currentFolio.registrar = 'KFINTECH';
    }

    i++;
  }

  // Add last folio
  if (currentFolio && (currentFolio.schemeName || currentFolio.closingBalance > 0)) {
    parsed.folios.push(currentFolio);
  }

  // If no folios found with the above method, try alternative parsing
  // Look for patterns like "Scheme Name" followed by units/value on subsequent lines
  if (parsed.folios.length === 0) {
    console.log('Primary parsing found no folios, trying alternative method...');
    
    // Try to find any scheme-like entries
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const lineLower = line.toLowerCase();
      
      // Look for lines that look like scheme names
      if ((lineLower.includes('fund') || lineLower.includes('growth') || lineLower.includes('direct')) &&
          line.length > 20 && !lineLower.includes('folio') && !lineLower.includes('statement')) {
        
        // Look ahead for units/value
        let units = 0;
        let nav = 0;
        let value = 0;
        
        for (let k = j + 1; k < Math.min(j + 10, lines.length); k++) {
          const nextLine = lines[k];
          
          const unitsMatch = nextLine.match(/([\d,]+\.\d{3,})/);
          if (unitsMatch && units === 0) {
            units = parseFloat(unitsMatch[1].replace(/,/g, ''));
          }
          
          const navMatch = nextLine.match(/NAV[:\s]*([\d,]+\.?\d*)/i);
          if (navMatch) {
            nav = parseFloat(navMatch[1].replace(/,/g, ''));
          }
          
          const valueMatch = nextLine.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i);
          if (valueMatch && value === 0) {
            value = parseFloat(valueMatch[1].replace(/,/g, ''));
          }
        }
        
        if (units > 0 || value > 0) {
          parsed.folios.push({
            folioNumber: 'Unknown',
            amc: '',
            schemeName: line.replace(/\s+/g, ' ').trim(),
            pan: parsed.pan,
            registrar: '',
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
