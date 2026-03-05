/**
 * Daily NAV Update Service (PostgreSQL)
 * Optimized for incremental updates - fetches AMFI NAVAll.txt and upserts into PostgreSQL.
 * Used by the Vercel cron at /api/cron/daily-update.
 */

import pool from './postgres-db';

const AMFI_NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

function convertAmfiDate(dateStr: string): string | null {
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
  date: string;
  category: string;
}

function parseAmfiFile(rawText: string): Map<string, NavEntry> {
  const navMap = new Map<string, NavEntry>();
  const lines = rawText.split('\n');
  let currentCategory = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!trimmed.includes(';')) {
      const catMatch = trimmed.match(/\((.+)\)/);
      if (catMatch) currentCategory = catMatch[1].trim();
      continue;
    }

    const parts = trimmed.split(';');
    if (parts.length < 5) continue;

    const schemeCode = parts[0].trim();
    const schemeName = parts[3]?.trim() || '';
    const navStr = parts[4].trim();
    const dateStr = parts[5]?.trim();

    if (!schemeCode || !/^\d+$/.test(schemeCode)) continue;
    const nav = parseFloat(navStr);
    if (isNaN(nav) || nav <= 0) continue;
    if (!dateStr) continue;
    const pgDate = convertAmfiDate(dateStr);
    if (!pgDate) continue;

    navMap.set(schemeCode, { schemeCode, schemeName, nav, date: pgDate, category: currentCategory });
  }

  return navMap;
}

/**
 * Daily NAV update - fetches AMFI data and updates PostgreSQL
 */
export async function dailyNavUpdate(): Promise<{
  success: boolean;
  recordsProcessed: number;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    console.log('Starting daily NAV update (PostgreSQL)...');

    // Step 1: Fetch AMFI NAVAll.txt
    const response = await fetch(AMFI_NAV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) throw new Error(`AMFI fetch failed: ${response.status}`);
    const rawText = await response.text();

    // Step 2: Parse
    const navMap = parseAmfiFile(rawText);
    console.log(`Parsed ${navMap.size} schemes from AMFI`);

    if (navMap.size === 0) throw new Error('No NAV records parsed from AMFI');

    // Step 3: Get existing scheme codes
    const dbResult = await pool.query('SELECT scheme_code FROM funds');
    const dbCodeSet = new Set(dbResult.rows.map((r: { scheme_code: string }) => r.scheme_code));

    // Step 4: Insert new funds
    const newFunds: NavEntry[] = [];
    for (const [code, entry] of navMap) {
      if (!dbCodeSet.has(code) && entry.schemeName) newFunds.push(entry);
    }

    if (newFunds.length > 0) {
      const BATCH = 2000;
      for (let i = 0; i < newFunds.length; i += BATCH) {
        const batch = newFunds.slice(i, i + BATCH);
        try {
          await pool.query(`
            INSERT INTO funds (scheme_code, scheme_name, latest_nav, latest_nav_date, category, plan_type, option_type, is_active, created_at, updated_at)
            SELECT unnest($1::text[]), unnest($2::text[]), unnest($3::numeric[]), unnest($4::date[]),
                   unnest($5::text[]), unnest($6::text[]), unnest($7::text[]), true, NOW(), NOW()
            ON CONFLICT (scheme_code) DO NOTHING
          `, [
            batch.map(f => f.schemeCode),
            batch.map(f => f.schemeName),
            batch.map(f => f.nav),
            batch.map(f => f.date),
            batch.map(f => f.category),
            batch.map(f => /direct/i.test(f.schemeName) ? 'Direct' : /regular/i.test(f.schemeName) ? 'Regular' : ''),
            batch.map(f => /growth/i.test(f.schemeName) ? 'Growth' : /idcw|dividend/i.test(f.schemeName) ? 'IDCW' : ''),
          ]);
        } catch (e: any) {
          console.error(`Insert batch error: ${e.message}`);
        }
      }
      console.log(`Inserted ${newFunds.length} new funds`);
    }

    // Step 5: Bulk update existing funds' latest NAV
    const allCodes = [...dbCodeSet, ...newFunds.map(f => f.schemeCode)];
    const matched: NavEntry[] = [];
    for (const code of allCodes) {
      const entry = navMap.get(code);
      if (entry) matched.push(entry);
    }

    const BATCH_SIZE = 2000;
    let updated = 0;

    for (let i = 0; i < matched.length; i += BATCH_SIZE) {
      const batch = matched.slice(i, i + BATCH_SIZE);
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
        `, [
          batch.map(f => f.schemeCode),
          batch.map(f => f.nav),
          batch.map(f => f.date),
        ]);
        updated += batch.length;
      } catch (e: any) {
        console.error(`Update batch error: ${e.message}`);
      }
    }

    // Step 6: Insert into nav_history
    let historyInserted = 0;
    const HIST_BATCH = 5000;

    for (let i = 0; i < matched.length; i += HIST_BATCH) {
      const batch = matched.slice(i, i + HIST_BATCH);
      try {
        const res = await pool.query(`
          INSERT INTO nav_history (scheme_code, nav_date, nav_value, source)
          SELECT unnest($1::text[]), unnest($2::date[]), unnest($3::numeric[]), 'A'
          ON CONFLICT (scheme_code, nav_date) DO UPDATE SET
            nav_value = EXCLUDED.nav_value,
            source = EXCLUDED.source
        `, [
          batch.map(f => f.schemeCode),
          batch.map(f => f.date),
          batch.map(f => f.nav),
        ]);
        historyInserted += res.rowCount || 0;
      } catch (e: any) {
        if (e.message?.includes('does not exist')) break;
        console.error(`nav_history batch error: ${e.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Daily NAV update complete: ${updated} funds updated, ${historyInserted} nav_history rows, ${(duration / 1000).toFixed(1)}s`);

    return { success: true, recordsProcessed: updated, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('Daily NAV update failed:', error);
    return { success: false, recordsProcessed: 0, duration, error: error.message };
  }
}
