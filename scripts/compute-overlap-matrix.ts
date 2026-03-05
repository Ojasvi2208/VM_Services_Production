/**
 * Compute precomputed overlap matrix from fund_top_holdings.
 *
 * Pipeline:
 * 1. Normalize holdings into dim_stocks + fact_holdings (Bifurcated Storage Pillar 1)
 * 2. Compute pairwise overlap for all fund pairs with holdings data
 * 3. Store in fund_overlap_pairs for O(1) lookup
 *
 * Usage: RAILWAY_DATABASE_URL=... npx tsx scripts/compute-overlap-matrix.ts
 */

import { Pool } from 'pg';

const DB_URL = process.env.RAILWAY_DATABASE_URL;
if (!DB_URL) {
  console.error('RAILWAY_DATABASE_URL required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function main() {
  const client = await pool.connect();

  try {
    // Step 1: Get latest as_of_date from fund_top_holdings
    const dateResult = await client.query(
      `SELECT MAX(as_of_date) as latest FROM fund_top_holdings`
    );
    const asOfDate = dateResult.rows[0]?.latest;
    if (!asOfDate) {
      console.log('No holdings data found. Run ingest-fund-holdings.ts first.');
      return;
    }
    console.log(`Processing holdings as of ${asOfDate}`);

    // Step 2: Populate dim_stocks (upsert unique ISINs)
    const stocksInserted = await client.query(`
      INSERT INTO dim_stocks (isin, name, sector)
      SELECT DISTINCT ON (holding_isin)
        holding_isin, holding_name, sector
      FROM fund_top_holdings
      WHERE as_of_date = $1 AND holding_isin IS NOT NULL
      ORDER BY holding_isin, weight_pct DESC
      ON CONFLICT (isin) DO UPDATE SET
        name = EXCLUDED.name,
        sector = EXCLUDED.sector
    `, [asOfDate]);
    console.log(`dim_stocks: ${stocksInserted.rowCount} stocks upserted`);

    // Step 3: Populate fact_holdings (normalized)
    await client.query(`DELETE FROM fact_holdings WHERE as_of_date = $1`, [asOfDate]);
    const factsInserted = await client.query(`
      INSERT INTO fact_holdings (scheme_code, isin, weight_pct, rank, as_of_date)
      SELECT scheme_code, holding_isin, weight_pct, rank, as_of_date
      FROM fund_top_holdings
      WHERE as_of_date = $1 AND holding_isin IS NOT NULL
      ON CONFLICT (scheme_code, isin, as_of_date) DO UPDATE SET
        weight_pct = EXCLUDED.weight_pct,
        rank = EXCLUDED.rank
    `, [asOfDate]);
    console.log(`fact_holdings: ${factsInserted.rowCount} rows inserted`);

    // Step 4: Compute pairwise overlap matrix
    // For each pair of funds that share at least one ISIN:
    // overlap = SUM(MIN(weight_a, weight_b)) / 100
    console.log('Computing pairwise overlap...');

    await client.query(`DELETE FROM fund_overlap_pairs WHERE as_of_date = $1`, [asOfDate]);

    const overlapResult = await client.query(`
      INSERT INTO fund_overlap_pairs (fund_a, fund_b, overlap_pct, shared_holdings, as_of_date)
      SELECT
        LEAST(a.scheme_code, b.scheme_code) as fund_a,
        GREATEST(a.scheme_code, b.scheme_code) as fund_b,
        LEAST(ROUND(SUM(LEAST(a.weight_pct, b.weight_pct)) / 100.0, 4), 1.0000) as overlap_pct,
        COUNT(*) as shared_holdings,
        $1 as as_of_date
      FROM fact_holdings a
      JOIN fact_holdings b ON a.isin = b.isin
        AND a.as_of_date = b.as_of_date
        AND a.scheme_code < b.scheme_code
      WHERE a.as_of_date = $1
      GROUP BY LEAST(a.scheme_code, b.scheme_code), GREATEST(a.scheme_code, b.scheme_code)
      HAVING SUM(LEAST(a.weight_pct, b.weight_pct)) > 0
      ON CONFLICT (fund_a, fund_b, as_of_date) DO UPDATE SET
        overlap_pct = EXCLUDED.overlap_pct,
        shared_holdings = EXCLUDED.shared_holdings,
        computed_at = NOW()
    `, [asOfDate]);
    console.log(`fund_overlap_pairs: ${overlapResult.rowCount} pairs computed`);

    // Step 5: Stats
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_pairs,
        COUNT(*) FILTER (WHERE overlap_pct > 0.15) as high_overlap,
        COUNT(*) FILTER (WHERE overlap_pct > 0.20) as very_high_overlap,
        ROUND(AVG(overlap_pct)::numeric, 4) as avg_overlap,
        MAX(overlap_pct) as max_overlap
      FROM fund_overlap_pairs
      WHERE as_of_date = $1
    `, [asOfDate]);

    const s = stats.rows[0];
    console.log(`\nOverlap Matrix Stats:`);
    console.log(`  Total pairs: ${s.total_pairs}`);
    console.log(`  High overlap (>15%): ${s.high_overlap}`);
    console.log(`  Very high overlap (>20%): ${s.very_high_overlap}`);
    console.log(`  Average overlap: ${(s.avg_overlap * 100).toFixed(2)}%`);
    console.log(`  Max overlap: ${(s.max_overlap * 100).toFixed(2)}%`);

    // Top 10 most overlapping pairs
    const topPairs = await client.query(`
      SELECT fop.fund_a, fop.fund_b, fop.overlap_pct, fop.shared_holdings,
             fa.scheme_name as name_a, fb.scheme_name as name_b
      FROM fund_overlap_pairs fop
      JOIN funds fa ON fa.scheme_code = fop.fund_a
      JOIN funds fb ON fb.scheme_code = fop.fund_b
      WHERE fop.as_of_date = $1
      ORDER BY fop.overlap_pct DESC
      LIMIT 10
    `, [asOfDate]);

    if (topPairs.rows.length > 0) {
      console.log(`\nTop 10 Most Overlapping Pairs:`);
      for (const p of topPairs.rows) {
        const nameA = p.name_a?.substring(0, 35) || p.fund_a;
        const nameB = p.name_b?.substring(0, 35) || p.fund_b;
        console.log(`  ${(p.overlap_pct * 100).toFixed(1)}% | ${p.shared_holdings} shared | ${nameA} <-> ${nameB}`);
      }
    }

  } finally {
    client.release();
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  pool.end();
  process.exit(1);
});
