/**
 * compute-fund-metrics.ts — Data Sovereign Metrics Pipeline
 *
 * Replaces the 7-hour mfapi.in-based pipeline with DB-only computation.
 * All metrics are calculated using SQL functions against local nav_history.
 *
 * Computes: returns (1W–10Y + inception), CAGR (1Y–10Y + inception),
 *           volatility, sharpe, sortino, max drawdown, rolling returns (1Y/3Y)
 *
 * Run: npx tsx src/scripts/compute-fund-metrics.ts
 * Concurrency: 10 parallel workers × ~1.3s/fund ≈ 8 funds/sec ≈ 30min for 14,685 funds
 * (vs 7+ hours with mfapi.in — 14x improvement, zero external dependency)
 */

import { Pool } from 'pg';

const DB_URL = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL
  || 'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 12,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

const CONCURRENCY = 10;

interface FundRow {
  scheme_code: string;
  inception_date: string | null;
}

async function getFundsToProcess(): Promise<FundRow[]> {
  const result = await pool.query(`
    SELECT DISTINCT f.scheme_code, f.inception_date::text
    FROM funds f
    INNER JOIN nav_history nh ON nh.scheme_code = f.scheme_code
    LEFT JOIN fund_returns fr ON fr.scheme_code = f.scheme_code
    WHERE
      fr.scheme_code IS NULL
      OR fr.updated_at < NOW() - INTERVAL '7 days'
      OR fr.volatility_1y IS NULL
      OR fr.rolling_return_1y_avg IS NULL
    GROUP BY f.scheme_code, f.inception_date
    HAVING COUNT(nh.scheme_code) >= 10
    ORDER BY
      CASE
        WHEN fr.scheme_code IS NULL THEN 0
        WHEN fr.volatility_1y IS NULL THEN 1
        ELSE 2
      END,
      f.scheme_code
  `);
  return result.rows;
}

async function computeOneFund(code: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    // 1. Returns + CAGR
    const returnsResult = await client.query(
      'SELECT * FROM calc_all_returns($1)', [code]
    );
    if (returnsResult.rows.length === 0) return false;
    const r = returnsResult.rows[0];

    // 2. Risk metrics (1Y lookback)
    let volatility1y: number | null = null;
    let sharpe1y: number | null = null;
    let sortino1y: number | null = null;
    let maxDrawdown: number | null = null;

    if (r.fund_age_years >= 1 && r.latest_date) {
      const startDate = new Date(r.latest_date);
      startDate.setFullYear(startDate.getFullYear() - 1);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = new Date(r.latest_date).toISOString().split('T')[0];

      // Run all 4 risk queries in parallel on the same connection
      const [volRes, sharpeRes, sortinoRes, mddRes] = await Promise.all([
        client.query('SELECT calc_volatility($1, $2::date, $3::date) AS v', [code, startStr, endStr]),
        client.query('SELECT calc_sharpe($1, $2::date, $3::date, 6.5) AS v', [code, startStr, endStr]),
        client.query('SELECT calc_sortino($1, $2::date, $3::date, 6.5) AS v', [code, startStr, endStr]),
        client.query('SELECT calc_max_drawdown($1, $2::date, $3::date) AS v', [code, startStr, endStr]),
      ]);
      volatility1y = volRes.rows[0]?.v;
      sharpe1y = sharpeRes.rows[0]?.v;
      sortino1y = sortinoRes.rows[0]?.v;
      maxDrawdown = mddRes.rows[0]?.v;
    }

    // 3. Rolling returns
    let rolling1y: any = {};
    let rolling3y: any = {};

    const rollingPromises: Promise<void>[] = [];

    if (r.fund_age_years >= 2) {
      rollingPromises.push(
        client.query('SELECT * FROM calc_rolling_returns($1, 1, 36)', [code])
          .then(res => { if (res.rows.length > 0) rolling1y = res.rows[0]; })
      );
    }
    if (r.fund_age_years >= 4) {
      rollingPromises.push(
        client.query('SELECT * FROM calc_rolling_returns($1, 3, 60)', [code])
          .then(res => { if (res.rows.length > 0) rolling3y = res.rows[0]; })
      );
    }

    if (rollingPromises.length > 0) {
      await Promise.all(rollingPromises);
    }

    // 4. UPSERT
    await client.query(`
      INSERT INTO fund_returns (
        scheme_code,
        return_1w, return_1m, return_3m, return_6m,
        return_1y, return_2y, return_3y, return_5y, return_7y, return_10y,
        return_since_inception,
        cagr_1y, cagr_2y, cagr_3y, cagr_5y, cagr_7y, cagr_10y,
        cagr_since_inception,
        volatility_1y, max_drawdown, sharpe_ratio_1y, sortino_ratio_1y,
        rolling_return_1y_avg, rolling_return_1y_min, rolling_return_1y_max, rolling_return_1y_median,
        rolling_return_3y_avg, rolling_return_3y_min, rolling_return_3y_max, rolling_return_3y_median,
        updated_at
      ) VALUES (
        $1,  $2,  $3,  $4,  $5,
        $6,  $7,  $8,  $9,  $10, $11,
        $12,
        $13, $14, $15, $16, $17, $18,
        $19,
        $20, $21, $22, $23,
        $24, $25, $26, $27,
        $28, $29, $30, $31,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (scheme_code) DO UPDATE SET
        return_1w = EXCLUDED.return_1w,
        return_1m = EXCLUDED.return_1m,
        return_3m = EXCLUDED.return_3m,
        return_6m = EXCLUDED.return_6m,
        return_1y = EXCLUDED.return_1y,
        return_2y = EXCLUDED.return_2y,
        return_3y = EXCLUDED.return_3y,
        return_5y = EXCLUDED.return_5y,
        return_7y = EXCLUDED.return_7y,
        return_10y = EXCLUDED.return_10y,
        return_since_inception = EXCLUDED.return_since_inception,
        cagr_1y = EXCLUDED.cagr_1y,
        cagr_2y = EXCLUDED.cagr_2y,
        cagr_3y = EXCLUDED.cagr_3y,
        cagr_5y = EXCLUDED.cagr_5y,
        cagr_7y = EXCLUDED.cagr_7y,
        cagr_10y = EXCLUDED.cagr_10y,
        cagr_since_inception = EXCLUDED.cagr_since_inception,
        volatility_1y = EXCLUDED.volatility_1y,
        max_drawdown = EXCLUDED.max_drawdown,
        sharpe_ratio_1y = EXCLUDED.sharpe_ratio_1y,
        sortino_ratio_1y = EXCLUDED.sortino_ratio_1y,
        rolling_return_1y_avg = EXCLUDED.rolling_return_1y_avg,
        rolling_return_1y_min = EXCLUDED.rolling_return_1y_min,
        rolling_return_1y_max = EXCLUDED.rolling_return_1y_max,
        rolling_return_1y_median = EXCLUDED.rolling_return_1y_median,
        rolling_return_3y_avg = EXCLUDED.rolling_return_3y_avg,
        rolling_return_3y_min = EXCLUDED.rolling_return_3y_min,
        rolling_return_3y_max = EXCLUDED.rolling_return_3y_max,
        rolling_return_3y_median = EXCLUDED.rolling_return_3y_median,
        updated_at = CURRENT_TIMESTAMP
    `, [
      code,
      r.return_1w, r.return_1m, r.return_3m, r.return_6m,
      r.return_1y, r.return_2y, r.return_3y, r.return_5y, r.return_7y, r.return_10y,
      r.return_since_inception,
      r.cagr_1y, r.cagr_2y, r.cagr_3y, r.cagr_5y, r.cagr_7y, r.cagr_10y,
      r.cagr_since_inception,
      volatility1y, maxDrawdown, sharpe1y, sortino1y,
      rolling1y.avg_return || null, rolling1y.min_return || null,
      rolling1y.max_return || null, rolling1y.median_return || null,
      rolling3y.avg_return || null, rolling3y.min_return || null,
      rolling3y.max_return || null, rolling3y.median_return || null
    ]);

    return true;
  } finally {
    client.release();
  }
}

async function processWithConcurrency(
  codes: string[],
  concurrency: number,
  onProgress: (updated: number, errors: number, total: number) => void
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  let idx = 0;

  async function worker() {
    while (idx < codes.length) {
      const myIdx = idx++;
      const code = codes[myIdx];
      try {
        const ok = await computeOneFund(code);
        if (ok) updated++; else errors++;
      } catch (err: any) {
        errors++;
        if (!err.message?.includes('timeout')) {
          console.error(`  Error ${code}: ${err.message}`);
        }
      }

      // Progress every 100 funds
      if ((updated + errors) % 100 === 0) {
        onProgress(updated, errors, codes.length);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, codes.length) }, () => worker());
  await Promise.all(workers);

  return { updated, errors };
}

async function refreshMaterializedViews() {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search');
    console.log('  mv_unified_search refreshed');
  } catch (err: any) {
    console.log(`  mv_unified_search: ${err.message}`);
  }

  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_funds');
    console.log('  mv_top_funds refreshed');
  } catch (err: any) {
    console.log(`  mv_top_funds: ${err.message}`);
  }
}

async function main() {
  const startTime = Date.now();
  console.log('COMPUTE FUND METRICS — Data Sovereign Pipeline');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Concurrency: ${CONCURRENCY} workers`);
  console.log('');

  // Step 1: Discover stale funds
  console.log('Step 1: Discovering stale funds...');
  const funds = await getFundsToProcess();
  console.log(`  Found ${funds.length} funds needing metric updates`);

  if (funds.length === 0) {
    console.log('  All funds are up to date. Nothing to do.');
    await pool.end();
    return;
  }

  // Step 2: Compute metrics with concurrent workers
  console.log(`Step 2: Computing metrics...`);
  const codes = funds.map(f => f.scheme_code);

  const { updated, errors } = await processWithConcurrency(
    codes,
    CONCURRENCY,
    (u, e, total) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const done = u + e;
      const pct = ((done / total) * 100).toFixed(1);
      const rate = (done / (parseFloat(elapsed) || 1)).toFixed(1);
      console.log(`  ${done}/${total} (${pct}%) | ${u} updated | ${rate} funds/s | ${elapsed}s`);
    }
  );

  // Step 3: Refresh materialized views
  console.log('Step 3: Refreshing materialized views...');
  await refreshMaterializedViews();

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('='.repeat(60));
  console.log('METRICS PIPELINE COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total time: ${totalTime}s`);
  console.log(`  Updated: ${updated} funds`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Rate: ${(codes.length / (parseFloat(totalTime) || 1)).toFixed(1)} funds/s`);
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  await pool.end();

  if (errors > 0 && updated === 0) {
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, closing...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, closing...');
  await pool.end();
  process.exit(0);
});

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await pool.end();
  process.exit(1);
});
