/**
 * GET /api/funds/[schemeCode]/percentile
 *
 * Story: DATA-008 Peer-group percentile computation
 * Backs: Flutter FundDetail → "where does this fund rank in its SEBI category"
 *
 * Returns the latest percentile rank per metric for the given scheme.
 * Data is populated nightly by scripts/scheme_pipeline/compute/percentile.py
 * into the scheme_percentile table (migration 021).
 *
 * Response shape:
 * {
 *   schemeCode: string,
 *   asOfDate: string,              // YYYY-MM-DD; most recent as_of_date present
 *   peerCategory: string | null,   // e.g. "Large Cap", "ELSS"
 *   metrics: Array<{
 *     metric: string,              // return_1y | return_3y | return_5y | sharpe_1y | alpha_3y
 *     pctRank: number,             // 0.00 – 100.00 (higher = better)
 *     peerCount: number,
 *   }>
 * }
 *
 * Errors: 404 if no percentile rows exist yet for this scheme (bootstrap case).
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

interface PercentileRow {
  metric: string;
  pct_rank: string;       // DECIMAL → string from pg by default
  peer_count: number;
  peer_category: string | null;
  as_of_date: Date;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { schemeCode: string } }
) {
  if (process.env.FEATURE_SCHEME_PERCENTILE !== 'true') {
    return NextResponse.json(
      { error: 'Feature disabled' },
      { status: 503 }
    );
  }

  const { schemeCode } = params;

  if (!schemeCode || !/^\d+$/.test(schemeCode)) {
    return NextResponse.json(
      { error: 'Invalid schemeCode' },
      { status: 400 }
    );
  }

  try {
    // Latest as_of_date for this scheme, then all metrics on that date.
    const sql = `
      WITH latest AS (
        SELECT MAX(as_of_date) AS as_of_date
        FROM scheme_percentile
        WHERE scheme_code = $1
      )
      SELECT
        sp.metric,
        sp.pct_rank,
        sp.peer_count,
        sp.peer_category,
        sp.as_of_date
      FROM scheme_percentile sp
      JOIN latest l ON sp.as_of_date = l.as_of_date
      WHERE sp.scheme_code = $1
      ORDER BY sp.metric ASC;
    `;

    const result = await pool.query<PercentileRow>(sql, [schemeCode]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No percentile data available for this scheme yet' },
        { status: 404 }
      );
    }

    const asOfDate = result.rows[0].as_of_date;
    const peerCategory = result.rows[0].peer_category;

    return NextResponse.json({
      schemeCode,
      asOfDate: new Date(asOfDate).toISOString().slice(0, 10),
      peerCategory,
      metrics: result.rows.map((r) => ({
        metric: r.metric,
        pctRank: Number(r.pct_rank),
        peerCount: r.peer_count,
      })),
    });
  } catch (err) {
    console.error('[percentile] query failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch percentile data' },
      { status: 500 }
    );
  }
}
