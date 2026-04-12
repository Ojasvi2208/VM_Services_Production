/**
 * GET /api/funds/{schemeCode}/rolling-returns
 * Computes 1Y and 3Y rolling return distributions from nav_history.
 * Returns percentile buckets for distribution chart on fund detail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cachedJson, CACHE_TTL } from '@/lib/api-cache-headers';
import pool from '@/lib/postgres-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schemeCode: string }> }
) {
  try {
    const { schemeCode } = await params;

    // Fetch daily NAV history (need at least 3Y = ~750 trading days)
    const navResult = await pool.query(
      `SELECT nav_date, nav_value FROM nav_history
       WHERE scheme_code = $1 AND nav_value > 0
       ORDER BY nav_date ASC`,
      [schemeCode]
    );

    const rows = navResult.rows;
    if (rows.length < 252) {
      return NextResponse.json({
        success: true,
        rolling1y: [],
        rolling3y: [],
        message: 'Insufficient history for rolling returns (need 1Y+)',
      });
    }

    // Compute rolling 1Y returns (252 trading days)
    const rolling1y: number[] = [];
    for (let i = 252; i < rows.length; i++) {
      const endNav = parseFloat(rows[i].nav_value);
      const startNav = parseFloat(rows[i - 252].nav_value);
      if (startNav > 0) {
        const ret = ((endNav / startNav) - 1) * 100;
        rolling1y.push(Math.round(ret * 100) / 100);
      }
    }

    // Compute rolling 3Y returns (756 trading days) as CAGR
    const rolling3y: number[] = [];
    if (rows.length >= 756) {
      for (let i = 756; i < rows.length; i++) {
        const endNav = parseFloat(rows[i].nav_value);
        const startNav = parseFloat(rows[i - 756].nav_value);
        if (startNav > 0) {
          const cagr = (Math.pow(endNav / startNav, 1 / 3) - 1) * 100;
          rolling3y.push(Math.round(cagr * 100) / 100);
        }
      }
    }

    // Build distribution buckets (histogram)
    const bucket = (arr: number[], step = 2) => {
      if (arr.length === 0) return [];
      const min = Math.floor(Math.min(...arr) / step) * step;
      const max = Math.ceil(Math.max(...arr) / step) * step;
      const buckets: { range: string; count: number; pct: number }[] = [];
      for (let lo = min; lo < max; lo += step) {
        const hi = lo + step;
        const count = arr.filter(v => v >= lo && v < hi).length;
        buckets.push({
          range: `${lo}% to ${hi}%`,
          count,
          pct: Math.round((count / arr.length) * 10000) / 100,
        });
      }
      return buckets;
    };

    // Stats
    const stats = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted[Math.floor(sorted.length / 2)],
        mean: Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100,
        p10: sorted[Math.floor(sorted.length * 0.1)],
        p25: sorted[Math.floor(sorted.length * 0.25)],
        p75: sorted[Math.floor(sorted.length * 0.75)],
        p90: sorted[Math.floor(sorted.length * 0.9)],
        observations: arr.length,
      };
    };

    return cachedJson({
      success: true,
      rolling1y: {
        distribution: bucket(rolling1y),
        stats: stats(rolling1y),
      },
      rolling3y: {
        distribution: bucket(rolling3y),
        stats: stats(rolling3y),
      },
    }, CACHE_TTL.FUND_DETAIL);

  } catch (error: any) {
    console.error('Rolling returns error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
