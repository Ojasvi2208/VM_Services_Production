/**
 * GET /api/health/data
 *
 * Story: BE-007 Health check + data freshness endpoint
 *
 * Returns per-source ingestion health derived from the ingestion_run
 * table (migration 024). Any source whose latest run is older than its
 * SLA, or whose latest run failed, flips overall.status to 'degraded'.
 *
 * Response shape:
 * {
 *   status: 'healthy' | 'degraded',
 *   generatedAt: string,           // ISO
 *   sources: Array<{
 *     source: string,              // e.g. 'amfi_nav'
 *     jobName: string,
 *     lastRunAt: string | null,
 *     lastStatus: 'success' | 'failed' | 'partial' | 'running' | 'unknown',
 *     lastRowCount: number,
 *     hoursSinceSuccess: number | null,
 *     slaHours: number,
 *     withinSla: boolean,
 *   }>
 * }
 *
 * Intended consumers:
 *   - Internal ops dashboard (/admin)
 *   - Uptime monitors (Better Stack / UptimeRobot)
 *   - Mobile app pre-flight check (optional)
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

// Per-source SLA in hours. Kept here (not in DB) because it's product policy,
// not data. A miss means 'degraded' not 'down' — we still serve cached data.
const SLA_HOURS: Record<string, number> = {
  amfi_nav: 26,            // daily — +2h buffer past 21:30 IST run
  amfi_dividends: 24 * 35, // monthly + buffer
  nse_tri: 26,             // daily
  compute: 26,             // nightly compute chain (rolling_returns, ratios, percentile, total_return)
};

const DEFAULT_SLA_HOURS = 48;

interface LatestRow {
  source: string;
  job_name: string;
  status: string;
  row_count: number;
  started_at: Date;
  ended_at: Date | null;
  last_success_at: Date | null;
}

export async function GET() {
  if (process.env.FEATURE_DATA_HEALTH !== 'true') {
    return NextResponse.json(
      { error: 'Feature disabled' },
      { status: 503 }
    );
  }

  try {
    // For each (source, job_name) pair, find the latest run overall and the
    // latest *successful* run. Combining both in one query avoids N+1.
    const sql = `
      WITH ranked AS (
        SELECT
          source,
          job_name,
          status,
          row_count,
          started_at,
          ended_at,
          ROW_NUMBER() OVER (
            PARTITION BY source, job_name
            ORDER BY started_at DESC
          ) AS rn_all,
          ROW_NUMBER() OVER (
            PARTITION BY source, job_name
            ORDER BY CASE WHEN status = 'success' THEN started_at END DESC NULLS LAST
          ) AS rn_ok
        FROM ingestion_run
      ),
      latest_all AS (
        SELECT source, job_name, status, row_count, started_at, ended_at
        FROM ranked WHERE rn_all = 1
      ),
      latest_ok AS (
        SELECT source, job_name, started_at AS last_success_at
        FROM ranked WHERE rn_ok = 1 AND status = 'success'
      )
      SELECT
        la.source,
        la.job_name,
        la.status,
        la.row_count,
        la.started_at,
        la.ended_at,
        lo.last_success_at
      FROM latest_all la
      LEFT JOIN latest_ok lo USING (source, job_name)
      ORDER BY la.source, la.job_name;
    `;

    const result = await pool.query<LatestRow>(sql);
    const now = Date.now();

    const sources = result.rows.map((r) => {
      const slaHours = SLA_HOURS[r.source] ?? DEFAULT_SLA_HOURS;
      const hoursSinceSuccess = r.last_success_at
        ? (now - new Date(r.last_success_at).getTime()) / (1000 * 60 * 60)
        : null;
      const withinSla = hoursSinceSuccess !== null && hoursSinceSuccess <= slaHours;

      return {
        source: r.source,
        jobName: r.job_name,
        lastRunAt: r.started_at ? new Date(r.started_at).toISOString() : null,
        lastStatus: (r.status ?? 'unknown') as
          | 'success'
          | 'failed'
          | 'partial'
          | 'running'
          | 'unknown',
        lastRowCount: Number(r.row_count ?? 0),
        hoursSinceSuccess:
          hoursSinceSuccess === null ? null : Number(hoursSinceSuccess.toFixed(2)),
        slaHours,
        withinSla,
      };
    });

    // 'degraded' if ANY source is out of SLA or last run didn't succeed.
    const degraded =
      sources.length === 0 ||
      sources.some((s) => !s.withinSla || s.lastStatus === 'failed');

    const body = {
      status: degraded ? 'degraded' : 'healthy',
      generatedAt: new Date().toISOString(),
      sources,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        // Let CDNs cache briefly but revalidate — freshness is the point.
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('[health/data] query failed:', err);
    return NextResponse.json(
      { status: 'degraded', error: 'health query failed' },
      { status: 500 }
    );
  }
}
