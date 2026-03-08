/**
 * GET /api/screener/compare?a=120465&b=120503
 * Deep Comparison — Venn Diagram data for two funds.
 * Returns: shared holdings, unique-to-A, unique-to-B, active share %.
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export const dynamic = 'force-dynamic';

interface HoldingInfo {
  isin: string;
  stockName: string;
  weightA: number | null;
  weightB: number | null;
  sector: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fundA = searchParams.get('a');
  const fundB = searchParams.get('b');

  if (!fundA || !fundB) {
    return NextResponse.json({ success: false, error: 'Provide ?a=schemeCode&b=schemeCode' }, { status: 400 });
  }

  try {
    // Get holdings for both funds
    const [resA, resB] = await Promise.all([
      pool.query(`
        SELECT holding_isin AS isin, holding_name AS name, weight_pct AS weight, sector
        FROM fund_top_holdings
        WHERE scheme_code = $1
          AND as_of_date = (SELECT MAX(as_of_date) FROM fund_top_holdings WHERE scheme_code = $1)
        ORDER BY weight_pct DESC
      `, [fundA]),
      pool.query(`
        SELECT holding_isin AS isin, holding_name AS name, weight_pct AS weight, sector
        FROM fund_top_holdings
        WHERE scheme_code = $1
          AND as_of_date = (SELECT MAX(as_of_date) FROM fund_top_holdings WHERE scheme_code = $1)
        ORDER BY weight_pct DESC
      `, [fundB]),
    ]);

    const holdingsA = resA.rows;
    const holdingsB = resB.rows;

    const mapA = new Map(holdingsA.map((h: any) => [h.isin, h]));
    const mapB = new Map(holdingsB.map((h: any) => [h.isin, h]));

    const shared: HoldingInfo[] = [];
    const uniqueA: HoldingInfo[] = [];
    const uniqueB: HoldingInfo[] = [];

    // Find shared and unique-to-A
    for (const h of holdingsA) {
      if (mapB.has(h.isin)) {
        const hB = mapB.get(h.isin);
        shared.push({
          isin: h.isin,
          stockName: h.name,
          weightA: parseFloat(h.weight),
          weightB: parseFloat(hB.weight),
          sector: h.sector,
        });
      } else {
        uniqueA.push({
          isin: h.isin,
          stockName: h.name,
          weightA: parseFloat(h.weight),
          weightB: null,
          sector: h.sector,
        });
      }
    }

    // Find unique-to-B
    for (const h of holdingsB) {
      if (!mapA.has(h.isin)) {
        uniqueB.push({
          isin: h.isin,
          stockName: h.name,
          weightA: null,
          weightB: parseFloat(h.weight),
          sector: h.sector,
        });
      }
    }

    // Active Share: sum of |weightA - weightB| / 2 for all stocks
    // Higher = more different. 0% = identical. 100% = no overlap.
    let diffSum = 0;
    const allIsins = new Set([...mapA.keys(), ...mapB.keys()]);
    for (const isin of allIsins) {
      const wA = mapA.has(isin) ? parseFloat(mapA.get(isin).weight) : 0;
      const wB = mapB.has(isin) ? parseFloat(mapB.get(isin).weight) : 0;
      diffSum += Math.abs(wA - wB);
    }
    const activeShare = Math.round((diffSum / 2) * 100) / 100;

    // Get fund names
    const namesRes = await pool.query(
      `SELECT scheme_code, scheme_name FROM funds WHERE scheme_code IN ($1, $2)`,
      [fundA, fundB]
    );
    const nameMap = Object.fromEntries(namesRes.rows.map((r: any) => [r.scheme_code, r.scheme_name]));

    return NextResponse.json({
      success: true,
      fundA: { schemeCode: fundA, name: nameMap[fundA] || fundA, holdingCount: holdingsA.length },
      fundB: { schemeCode: fundB, name: nameMap[fundB] || fundB, holdingCount: holdingsB.length },
      shared: shared.sort((a, b) => ((b.weightA || 0) + (b.weightB || 0)) - ((a.weightA || 0) + (a.weightB || 0))),
      uniqueA: uniqueA.sort((a, b) => (b.weightA || 0) - (a.weightA || 0)),
      uniqueB: uniqueB.sort((a, b) => (b.weightB || 0) - (a.weightB || 0)),
      activeShare,
      overlapCount: shared.length,
      totalUniqueStocks: allIsins.size,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
