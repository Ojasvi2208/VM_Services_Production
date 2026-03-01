/**
 * Aladdin Holdings Fetcher
 *
 * Populates fund_top_holdings table with top-10 holdings per fund.
 * Data source: Groww public API (JSON, no auth required).
 *
 * Run:  npx tsx scripts/fetch-fund-holdings.ts
 * Frequency: Monthly (AMFI portfolio disclosures are monthly)
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL || '';
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
});

// ── Groww API helpers ──

const GROWW_SEARCH_URL = 'https://groww.in/v1/api/data/mf/web/v1/scheme/search';
const GROWW_OVERVIEW_URL = 'https://groww.in/v1/api/data/mf/web/v4/scheme/overview';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface GrowwHolding {
  companyName: string;
  isin?: string;
  sector?: string;
  corpusPercentage: number;
}

interface GrowwSchemeOverview {
  holdings?: GrowwHolding[];
  portfolioDate?: string;
}

/**
 * Search Groww for a fund by name, return the Groww search_id
 */
async function searchGrowwFund(schemeName: string): Promise<string | null> {
  try {
    // Clean name for better search results
    const query = schemeName
      .replace(/- Direct Plan/i, '')
      .replace(/Direct Plan/i, '')
      .replace(/- Growth/i, '')
      .replace(/Growth/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 5) // Use first 5 words for search
      .join(' ');

    const url = `${GROWW_SEARCH_URL}?q=${encodeURIComponent(query)}&category=&page=0&size=5`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) return null;

    const data = await response.json();
    const schemes = data.content || data.schemes || [];

    if (schemes.length === 0) return null;

    // Find best match — prefer Direct + Growth
    const directGrowth = schemes.find((s: Record<string, string>) =>
      s.schemeName?.toLowerCase().includes('direct') &&
      s.schemeName?.toLowerCase().includes('growth')
    );

    const match = directGrowth || schemes[0];
    return match.search_id || match.searchId || match.schemeCode || null;
  } catch (error) {
    console.error(`  Search failed for "${schemeName}":`, error);
    return null;
  }
}

/**
 * Fetch top holdings from Groww scheme overview
 */
async function fetchGrowwHoldings(searchId: string): Promise<{ holdings: GrowwHolding[]; asOfDate: string } | null> {
  try {
    const url = `${GROWW_OVERVIEW_URL}/${searchId}`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) return null;

    const data: GrowwSchemeOverview = await response.json();
    const holdings = data.holdings || [];

    if (holdings.length === 0) return null;

    // Take top 10 by weight
    const top10 = holdings
      .sort((a, b) => (b.corpusPercentage || 0) - (a.corpusPercentage || 0))
      .slice(0, 10);

    const asOfDate = data.portfolioDate || new Date().toISOString().substring(0, 10);

    return { holdings: top10, asOfDate };
  } catch (error) {
    console.error(`  Holdings fetch failed for ${searchId}:`, error);
    return null;
  }
}

// ── Main pipeline ──

async function main() {
  console.log('=== Aladdin Holdings Fetcher ===\n');

  const client = await pool.connect();
  try {
    // Get target funds: top-ranked Direct Growth funds with AUM > 100 Cr
    const fundsResult = await client.query(`
      SELECT DISTINCT f.scheme_code, f.scheme_name, f.fund_size, f.sub_category
      FROM funds f
      LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
        AND fr.calculated_date = (SELECT MAX(calculated_date) FROM fund_returns)
      WHERE f.plan_type = 'Direct'
        AND f.option_type = 'Growth'
        AND f.is_active = true
        AND COALESCE(f.fund_size, 0) > 100
        AND COALESCE(fr.cagr_3y, fr.return_3y) IS NOT NULL
        AND f.scheme_name NOT ILIKE '%index%'
        AND f.scheme_name NOT ILIKE '%etf%'
        AND f.scheme_name NOT ILIKE '%fund of funds%'
      ORDER BY f.fund_size DESC NULLS LAST
      LIMIT 300
    `);

    const funds = fundsResult.rows;
    console.log(`Found ${funds.length} target funds\n`);

    let fetched = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < funds.length; i++) {
      const fund = funds[i];
      const progress = `[${i + 1}/${funds.length}]`;

      // Check if we already have recent holdings for this fund
      const existing = await client.query(
        `SELECT 1 FROM fund_top_holdings
         WHERE scheme_code = $1 AND as_of_date > NOW() - INTERVAL '45 days'
         LIMIT 1`,
        [fund.scheme_code]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      console.log(`${progress} ${fund.scheme_name.substring(0, 60)}...`);

      // Step 1: Search Groww for this fund
      const searchId = await searchGrowwFund(fund.scheme_name);
      if (!searchId) {
        console.log(`  ✗ No Groww match found`);
        failed++;
        await sleep(500);
        continue;
      }

      // Step 2: Fetch holdings
      await sleep(300); // Rate limit
      const result = await fetchGrowwHoldings(searchId);
      if (!result || result.holdings.length === 0) {
        console.log(`  ✗ No holdings data`);
        failed++;
        await sleep(500);
        continue;
      }

      // Step 3: Insert into DB
      const asOfDate = result.asOfDate.substring(0, 10); // YYYY-MM-DD
      let inserted = 0;

      for (let rank = 0; rank < result.holdings.length; rank++) {
        const h = result.holdings[rank];
        try {
          await client.query(
            `INSERT INTO fund_top_holdings
              (scheme_code, holding_name, holding_isin, weight_pct, sector, rank, as_of_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (scheme_code, holding_name, as_of_date)
            DO UPDATE SET weight_pct = $4, sector = $5, rank = $6, fetched_at = NOW()`,
            [
              fund.scheme_code,
              h.companyName || 'Unknown',
              h.isin || null,
              h.corpusPercentage || 0,
              h.sector || null,
              rank + 1,
              asOfDate,
            ]
          );
          inserted++;
        } catch (err) {
          console.error(`  DB insert error for ${h.companyName}:`, err);
        }
      }

      console.log(`  ✓ ${inserted} holdings (as of ${asOfDate})`);
      fetched++;

      // Rate limit: 1 request per second to be respectful
      await sleep(700);
    }

    console.log(`\n=== Done ===`);
    console.log(`Fetched: ${fetched} | Skipped (recent): ${skipped} | Failed: ${failed}`);

    // Summary stats
    const statsResult = await client.query(
      `SELECT COUNT(DISTINCT scheme_code) as funds, COUNT(*) as holdings
       FROM fund_top_holdings`
    );
    const stats = statsResult.rows[0];
    console.log(`Total in DB: ${stats.funds} funds, ${stats.holdings} holdings`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
