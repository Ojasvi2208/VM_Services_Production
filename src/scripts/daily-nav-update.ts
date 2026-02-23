import { Pool } from 'pg';
import https from 'https';

const RAILWAY_DB_URL = process.env.RAILWAY_DATABASE_URL;
if (!RAILWAY_DB_URL) {
  console.error('RAILWAY_DATABASE_URL environment variable is required');
  process.exit(1);
}

// AMFI NAVAll.txt — single file with ALL mutual fund NAVs (~17k schemes)
// Format: SchemeCode;ISIN1;ISIN2;SchemeName;NAV;Date (semicolon-delimited)
const AMFI_NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

// Month abbreviation → number mapping for AMFI date format (e.g., "18-Feb-2026")
const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

function convertAmfiDateToPostgres(dateStr: string): string | null {
  // Input: "18-Feb-2026" → Output: "2026-02-18"
  const match = dateStr.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTH_MAP[match[2]];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1]}`;
}

interface NavEntry {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string; // Postgres format YYYY-MM-DD
  category: string;
}

function fetchAmfiNavFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(AMFI_NAV_URL, {
      headers: { 'Accept': 'text/plain' },
      timeout: 60000 // 60s timeout for the full file
    }, (response) => {
      // Handle redirect (302)
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, {
            headers: { 'Accept': 'text/plain' },
            timeout: 60000
          }, (res2) => {
            let data = '';
            res2.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            res2.on('end', () => resolve(data));
            res2.on('error', reject);
          }).on('error', reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`AMFI responded with status ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      response.on('end', () => resolve(data));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('AMFI request timed out after 60s'));
    });
  });
}

function parseAmfiFile(rawText: string): Map<string, NavEntry> {
  const navMap = new Map<string, NavEntry>();
  const lines = rawText.split('\n');
  let currentCategory = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Category header lines (e.g., "Open Ended Schemes(Debt Scheme - Banking and PSU Fund)")
    if (!trimmed.includes(';')) {
      const catMatch = trimmed.match(/\((.+)\)/);
      if (catMatch) {
        currentCategory = catMatch[1].trim();
      }
      continue;
    }

    const parts = trimmed.split(';');
    // Valid data lines have exactly 6 fields
    if (parts.length < 5) continue;

    const schemeCode = parts[0].trim();
    const schemeName = parts[3]?.trim() || '';
    const navStr = parts[4].trim();
    const dateStr = parts[5]?.trim();

    // Skip header line and lines with non-numeric scheme codes
    if (!schemeCode || !/^\d+$/.test(schemeCode)) continue;

    // Skip if NAV is not a valid number (e.g., "N.A.", "-")
    const nav = parseFloat(navStr);
    if (isNaN(nav) || nav <= 0) continue;

    // Convert date to Postgres format
    if (!dateStr) continue;
    const pgDate = convertAmfiDateToPostgres(dateStr);
    if (!pgDate) continue;

    navMap.set(schemeCode, { schemeCode, schemeName, nav, date: pgDate, category: currentCategory });
  }

  return navMap;
}

async function runDailyUpdate() {
  const startTime = Date.now();
  console.log('DAILY NAV UPDATE - AMFI BULK DOWNLOAD');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  // Step 1: Fetch the full AMFI NAVAll.txt file (single HTTP request, ~1MB in memory)
  console.log('Step 1: Fetching AMFI NAVAll.txt...');
  let rawText: string;
  try {
    rawText = await fetchAmfiNavFile();
  } catch (error: any) {
    console.error(`Failed to fetch AMFI file: ${error.message}`);
    await pool.end();
    process.exit(1);
  }
  const fetchTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Fetched ${(rawText.length / 1024).toFixed(0)} KB in ${fetchTime}s`);

  // Step 2: Parse the file in memory
  console.log('Step 2: Parsing NAV data...');
  const navMap = parseAmfiFile(rawText);
  console.log(`  Parsed ${navMap.size} schemes with valid NAV data`);
  // Release the raw text from memory
  rawText = '';

  // Step 3: Get all scheme_codes from our DB
  console.log('Step 3: Fetching scheme codes from database...');
  const dbResult = await pool.query('SELECT scheme_code FROM funds');
  const dbSchemeCodes = dbResult.rows.map((r: { scheme_code: string }) => r.scheme_code);
  console.log(`  Found ${dbSchemeCodes.length} funds in database`);

  // Step 3.5: Insert new funds from AMFI that aren't in our database
  console.log('Step 3.5: Checking for new funds in AMFI...');
  const dbCodeSet = new Set(dbSchemeCodes);
  const newFunds: NavEntry[] = [];
  for (const [code, entry] of navMap) {
    if (!dbCodeSet.has(code) && entry.schemeName) {
      newFunds.push(entry);
    }
  }

  if (newFunds.length > 0) {
    console.log(`  Found ${newFunds.length} new funds in AMFI, inserting...`);
    const INSERT_BATCH = 2000;

    for (let i = 0; i < newFunds.length; i += INSERT_BATCH) {
      const batch = newFunds.slice(i, i + INSERT_BATCH);
      const codes = batch.map(f => f.schemeCode);
      const names = batch.map(f => f.schemeName);
      const navs = batch.map(f => f.nav);
      const dates = batch.map(f => f.date);
      const categories = batch.map(f => f.category);
      const planTypes = batch.map(f => {
        if (/direct/i.test(f.schemeName)) return 'Direct';
        if (/regular/i.test(f.schemeName)) return 'Regular';
        return '';
      });
      const optionTypes = batch.map(f => {
        if (/growth/i.test(f.schemeName)) return 'Growth';
        if (/idcw|dividend/i.test(f.schemeName)) return 'IDCW';
        return '';
      });

      try {
        await pool.query(`
          INSERT INTO funds (scheme_code, scheme_name, latest_nav, latest_nav_date, category, plan_type, option_type, is_active, created_at, updated_at)
          SELECT unnest($1::text[]), unnest($2::text[]), unnest($3::numeric[]), unnest($4::date[]),
                 unnest($5::text[]), unnest($6::text[]), unnest($7::text[]), true, NOW(), NOW()
          ON CONFLICT (scheme_code) DO NOTHING
        `, [codes, names, navs, dates, categories, planTypes, optionTypes]);
      } catch (insertErr: any) {
        console.error(`  Insert batch error: ${insertErr.message}`);
      }
    }

    console.log(`  Inserted ${newFunds.length} new funds`);
  } else {
    console.log('  No new funds to insert');
  }

  // Step 4: Match and batch update
  console.log('Step 4: Updating NAVs in database...');
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Re-fetch DB codes to include newly inserted funds
  const dbResult2 = await pool.query('SELECT scheme_code FROM funds');
  const allDbCodes = dbResult2.rows.map((r: { scheme_code: string }) => r.scheme_code);

  const matchedFunds: NavEntry[] = [];

  for (const schemeCode of allDbCodes) {
    const navEntry = navMap.get(schemeCode);
    if (navEntry) {
      matchedFunds.push(navEntry);
    } else {
      skipped++;
    }
  }

  console.log(`  Matched ${matchedFunds.length} funds, ${skipped} not in AMFI file (closed/merged funds)`);

  // Bulk UPDATE using unnest — sends all data in a single query per batch (1 roundtrip vs 500)
  const BATCH_SIZE = 2000;

  for (let i = 0; i < matchedFunds.length; i += BATCH_SIZE) {
    const batch = matchedFunds.slice(i, i + BATCH_SIZE);
    const codes: string[] = [];
    const navs: number[] = [];
    const dates: string[] = [];

    for (const entry of batch) {
      codes.push(entry.schemeCode);
      navs.push(entry.nav);
      dates.push(entry.date);
    }

    try {
      await pool.query(`
        UPDATE funds AS f SET
          latest_nav = v.nav,
          latest_nav_date = v.nav_date::date,
          updated_at = CURRENT_TIMESTAMP
        FROM (
          SELECT unnest($1::text[]) AS scheme_code,
                 unnest($2::numeric[]) AS nav,
                 unnest($3::text[]) AS nav_date
        ) AS v
        WHERE f.scheme_code = v.scheme_code
      `, [codes, navs, dates]);

      updated += batch.length;
    } catch (batchError: any) {
      console.error(`  Batch error at index ${i}: ${batchError.message}`);
      errors += batch.length;
    }

    const processed = Math.min(i + BATCH_SIZE, matchedFunds.length);
    const percent = ((processed / matchedFunds.length) * 100).toFixed(1);
    console.log(`  ${processed}/${matchedFunds.length} (${percent}%) updated`);
  }

  // Step 5: Insert into nav_history (AMFI-direct time-series engine)
  console.log('Step 5: Populating nav_history...');
  const HISTORY_BATCH = 5000;
  let historyInserted = 0;

  for (let i = 0; i < matchedFunds.length; i += HISTORY_BATCH) {
    const batch = matchedFunds.slice(i, i + HISTORY_BATCH);
    const hCodes = batch.map(f => f.schemeCode);
    const hDates = batch.map(f => f.date);
    const hNavs = batch.map(f => f.nav);

    try {
      const res = await pool.query(`
        INSERT INTO nav_history (scheme_code, nav_date, nav_value, source)
        SELECT unnest($1::text[]), unnest($2::date[]), unnest($3::numeric[]), 'A'
        ON CONFLICT (scheme_code, nav_date) DO UPDATE SET
          nav_value = EXCLUDED.nav_value,
          source = EXCLUDED.source
      `, [hCodes, hDates, hNavs]);
      historyInserted += res.rowCount || 0;
    } catch (hErr: any) {
      // Non-fatal: nav_history_v2 might not exist yet (pre-migration)
      if (hErr.message?.includes('does not exist')) {
        console.log('  nav_history table not found (run migration 004 first). Skipping.');
        break;
      }
      console.error(`  nav_history batch error: ${hErr.message}`);
    }
  }
  console.log(`  Inserted/updated ${historyInserted} rows in nav_history`);

  // Step 6: Refresh materialized views
  console.log('Step 6: Refreshing materialized views...');
  try {
    await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search`);
    console.log('  mv_unified_search refreshed');
  } catch (mvErr: any) {
    console.log(`  mv_unified_search refresh skipped: ${mvErr.message}`);
  }
  try {
    await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_funds`);
    console.log('  mv_top_funds refreshed');
  } catch (mvErr: any) {
    console.log(`  mv_top_funds refresh skipped: ${mvErr.message}`);
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  // Find the most common NAV date (should be yesterday's date for most funds)
  const dateCounts = new Map<string, number>();
  for (const f of matchedFunds) {
    dateCounts.set(f.date, (dateCounts.get(f.date) || 0) + 1);
  }
  let navDate = 'N/A';
  let maxCount = 0;
  for (const [date, count] of dateCounts) {
    if (count > maxCount) { navDate = date; maxCount = count; }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('DAILY NAV UPDATE COMPLETE');
  console.log('='.repeat(60));
  console.log(`  NAV Date: ${navDate}`);
  console.log(`  Total time: ${totalTime}s`);
  console.log(`  Updated: ${updated} funds`);
  console.log(`  nav_history: ${historyInserted} rows`);
  console.log(`  Skipped: ${skipped} (not in AMFI file)`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Finished at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  await pool.end();

  if (errors > 0 && updated === 0) {
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, closing database connection...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, closing database connection...');
  await pool.end();
  process.exit(0);
});

runDailyUpdate().catch(async (error) => {
  console.error('Fatal error:', error);
  await pool.end();
  process.exit(1);
});
