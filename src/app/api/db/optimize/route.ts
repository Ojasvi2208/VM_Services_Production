import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

/**
 * One-time DB optimization endpoint.
 * Creates B-Tree indexes + materialized view for O(k) top fund retrieval.
 * Run once, then delete or protect this endpoint.
 *
 * GET /api/db/optimize?secret=vmfs2024
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== 'vmfs2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  const log: string[] = [];

  try {
    // ── 1. Ensure fund_returns columns exist ──
    const columnsToAdd = [
      ['return_7y', 'DECIMAL(10,4)'],
      ['cagr_7y', 'DECIMAL(10,4)'],
      ['inception_date', 'DATE'],
      ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ];
    for (const [col, type] of columnsToAdd) {
      try {
        await client.query(`ALTER TABLE fund_returns ADD COLUMN IF NOT EXISTS ${col} ${type}`);
        log.push(`✅ Column fund_returns.${col} ensured`);
      } catch (e: any) {
        log.push(`ℹ️ Column ${col}: ${e.message}`);
      }
    }

    // Ensure funds.inception_date exists
    try {
      await client.query(`ALTER TABLE funds ADD COLUMN IF NOT EXISTS inception_date DATE`);
      await client.query(`ALTER TABLE funds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      log.push('✅ funds.inception_date + updated_at ensured');
    } catch (e: any) {
      log.push(`ℹ️ funds columns: ${e.message}`);
    }

    // ── 2. B-Tree Indexes ──
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_fund_returns_scheme ON fund_returns(scheme_code)',
      'CREATE INDEX IF NOT EXISTS idx_fund_returns_updated ON fund_returns(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_fund_returns_1y_rank ON fund_returns(return_1y DESC NULLS LAST) WHERE return_1y IS NOT NULL AND return_1y > 0 AND return_1y < 100',
      'CREATE INDEX IF NOT EXISTS idx_fund_returns_sharpe_rank ON fund_returns(sharpe_ratio_1y DESC NULLS LAST) WHERE sharpe_ratio_1y IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_funds_updated ON funds(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_funds_nav_date ON funds(latest_nav_date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_funds_scheme_code ON funds(scheme_code)',
    ];

    // ── 2b. GIN trigram index for fast ILIKE search ──
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      log.push('✅ pg_trgm extension enabled');
    } catch (e: any) {
      log.push(`ℹ️ pg_trgm: ${e.message}`);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_funds_name_trgm ON funds USING GIN (scheme_name gin_trgm_ops)');
      log.push('✅ GIN trigram index on scheme_name created');
    } catch (e: any) {
      log.push(`ℹ️ GIN trgm index: ${e.message}`);
    }

    for (const sql of indexes) {
      try {
        await client.query(sql);
        const name = sql.match(/IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
        log.push(`✅ Index ${name} created/verified`);
      } catch (e: any) {
        log.push(`❌ Index error: ${e.message}`);
      }
    }

    // ── 3. Drop old materialized view if exists ──
    try {
      await client.query('DROP MATERIALIZED VIEW IF EXISTS mv_top_funds');
      log.push('✅ Old mv_top_funds dropped');
    } catch (e: any) {
      log.push(`ℹ️ Drop MV: ${e.message}`);
    }

    // ── 4. Create materialized view ──
    await client.query(`
      CREATE MATERIALIZED VIEW mv_top_funds AS
      WITH ranked_funds AS (
        SELECT
          f.scheme_code,
          f.scheme_name,
          f.latest_nav,
          f.latest_nav_date,
          f.amc_code,
          fr.return_1y,
          fr.return_3y,
          fr.return_5y,
          fr.sharpe_ratio_1y,
          fr.volatility_1y,
          fr.sortino_ratio_1y,
          fr.rolling_return_1y_avg,
          fr.cagr_3y,
          fr.cagr_5y,
          fr.updated_at AS metrics_updated_at,
          CASE WHEN MAX(fr.return_1y) OVER () - MIN(fr.return_1y) OVER () > 0
            THEN (fr.return_1y - MIN(fr.return_1y) OVER ()) / (MAX(fr.return_1y) OVER () - MIN(fr.return_1y) OVER ())
            ELSE 0.5
          END AS norm_return,
          CASE WHEN MAX(fr.sharpe_ratio_1y) OVER () - MIN(fr.sharpe_ratio_1y) OVER () > 0
            THEN (fr.sharpe_ratio_1y - MIN(fr.sharpe_ratio_1y) OVER ()) / (MAX(fr.sharpe_ratio_1y) OVER () - MIN(fr.sharpe_ratio_1y) OVER ())
            ELSE 0.5
          END AS norm_sharpe
        FROM funds f
        INNER JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
        WHERE f.scheme_name LIKE '%Direct%'
          AND f.scheme_name LIKE '%Growth%'
          AND f.latest_nav IS NOT NULL AND f.latest_nav > 5
          AND fr.return_1y IS NOT NULL AND fr.return_1y > 0 AND fr.return_1y < 100
          AND f.scheme_name NOT ILIKE '%segregated%'
          AND f.scheme_name NOT ILIKE '%wind up%'
          AND f.scheme_name NOT ILIKE '%ETF%'
          AND f.scheme_name NOT ILIKE '%Fund of Fund%'
          AND f.scheme_name NOT ILIKE '%FOF%'
          AND f.scheme_name NOT ILIKE '%Gold%'
          AND f.scheme_name NOT ILIKE '%Silver%'
          AND f.scheme_name NOT ILIKE '%Index%'
          AND f.scheme_name NOT ILIKE '%Nifty%'
          AND f.scheme_name NOT ILIKE '%Sensex%'
          AND f.scheme_name NOT ILIKE '%International%'
          AND f.scheme_name NOT ILIKE '%Global%'
          AND f.scheme_name NOT ILIKE '%Overseas%'
          AND f.scheme_name NOT ILIKE '%Series%'
          AND f.scheme_name NOT ILIKE '%close ended%'
          AND f.scheme_name NOT ILIKE '%FMP%'
          AND f.scheme_name NOT ILIKE '%fixed maturity%'
          AND f.scheme_name NOT ILIKE '%Taiwan%'
          AND f.scheme_name NOT ILIKE '%Brazil%'
          AND f.scheme_name NOT ILIKE '%China%'
          AND f.scheme_name NOT ILIKE '%Japan%'
          AND f.scheme_name NOT ILIKE '%Asia%'
          AND f.scheme_name NOT ILIKE '%Europe%'
          AND f.scheme_name NOT ILIKE '%US %'
          AND f.scheme_name NOT ILIKE '%Emerging Markets%'
          AND f.scheme_name NOT ILIKE '%Offshore%'
          AND f.scheme_name NOT ILIKE '%Principal%'
          AND f.scheme_name NOT ILIKE '%HSBC%'
          AND f.scheme_name NOT ILIKE '%World%'
      )
      SELECT
        scheme_code,
        scheme_name,
        latest_nav,
        latest_nav_date,
        amc_code,
        return_1y,
        return_3y,
        return_5y,
        sharpe_ratio_1y,
        volatility_1y,
        sortino_ratio_1y,
        rolling_return_1y_avg,
        cagr_3y,
        cagr_5y,
        metrics_updated_at,
        ROUND((0.6 * COALESCE(norm_return, 0) + 0.4 * COALESCE(norm_sharpe, 0))::numeric, 4) AS quality_score,
        ROW_NUMBER() OVER (ORDER BY (0.6 * COALESCE(norm_return, 0) + 0.4 * COALESCE(norm_sharpe, 0)) DESC) AS quality_rank
      FROM ranked_funds
      ORDER BY quality_score DESC
      LIMIT 50
    `);
    log.push('✅ Materialized view mv_top_funds created');

    // ── 5. MV indexes ──
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_funds_scheme ON mv_top_funds(scheme_code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_mv_top_funds_rank ON mv_top_funds(quality_rank)');
    log.push('✅ MV indexes created');

    // ── 6. Quick stats ──
    const statsResult = await client.query('SELECT COUNT(*) as cnt FROM mv_top_funds');
    const fundsCount = await client.query('SELECT COUNT(*) as cnt FROM funds');
    const returnsCount = await client.query('SELECT COUNT(*) as cnt FROM fund_returns');

    log.push(`📊 mv_top_funds: ${statsResult.rows[0].cnt} ranked funds`);
    log.push(`📊 Total funds: ${fundsCount.rows[0].cnt}`);
    log.push(`📊 Total fund_returns: ${returnsCount.rows[0].cnt}`);

    return NextResponse.json({
      success: true,
      log,
      summary: {
        mvFunds: parseInt(statsResult.rows[0].cnt),
        totalFunds: parseInt(fundsCount.rows[0].cnt),
        totalReturns: parseInt(returnsCount.rows[0].cnt),
      }
    });

  } catch (error: any) {
    log.push(`❌ Fatal: ${error.message}`);
    return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
