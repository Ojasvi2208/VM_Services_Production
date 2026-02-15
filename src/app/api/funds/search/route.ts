/**
 * Fast Fund Search API
 * Searches through 37,000+ funds in PostgreSQL
 * Optimized for speed with indexed queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchFunds, getDatabaseStats } from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const amc = searchParams.get('amc') || '';
    const category = searchParams.get('category') || '';
    const planType = searchParams.get('planType') || '';
    const dedup = searchParams.get('dedup') !== 'false'; // default true
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    console.log('🔍 Search request:', { query, amc, category, planType, page, pageSize });

    // If no filters, return empty (don't load all funds)
    if (!query && !amc && !category) {
      const stats = await getDatabaseStats();
      return NextResponse.json({
        success: true,
        funds: [],
        total: stats.totalFunds,
        page: 1,
        pageSize,
        totalPages: 0,
        message: 'Apply filters to search funds'
      });
    }

    // Use pool for paginated search
    const pool = (await import('@/lib/postgres-db')).default;
    const client = await pool.connect();

    try {
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramCount = 1;

      // Default dedup: Direct+Growth only (one entry per fund family)
      if (dedup && !planType) {
        whereClause += ` AND f.scheme_name ILIKE $${paramCount} AND f.scheme_name ILIKE $${paramCount + 1}`;
        params.push('%Direct%', '%Growth%');
        paramCount += 2;
      }

      if (query) {
        // Split query into words for loose matching — each word must appear in scheme_name
        const words = query.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length > 1) {
          // All words must appear (in any order)
          const wordConditions = words.map((_, idx) => {
            params.push(`%${words[idx]}%`);
            const p = paramCount + idx;
            return `f.scheme_name ILIKE $${p}`;
          });
          whereClause += ` AND (${wordConditions.join(' AND ')})`;
          paramCount += words.length;
        } else {
          whereClause += ` AND (f.scheme_name ILIKE $${paramCount} OR f.scheme_code LIKE $${paramCount})`;
          params.push(`%${query}%`);
          paramCount++;
        }
      }

      if (amc) {
        whereClause += ` AND (f.scheme_name ILIKE $${paramCount} OR f.amc_code ILIKE $${paramCount})`;
        params.push(`%${amc}%`);
        paramCount++;
      }

      if (category) {
        whereClause += ` AND (f.scheme_name ILIKE $${paramCount} OR f.scheme_type ILIKE $${paramCount})`;
        params.push(`%${category}%`);
        paramCount++;
      }

      // Plan type filter (embedded in scheme name)
      if (planType === 'Direct') {
        whereClause += ` AND f.scheme_name ILIKE $${paramCount}`;
        params.push('%Direct%');
        paramCount++;
      } else if (planType === 'Regular') {
        whereClause += ` AND f.scheme_name ILIKE $${paramCount} AND f.scheme_name NOT ILIKE $${paramCount + 1}`;
        params.push('%Regular%', '%Direct%');
        paramCount += 2;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM funds f LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code ${whereClause}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / pageSize);

      // Get paginated results
      const offset = (page - 1) * pageSize;
      const paginatedParams = [...params, pageSize, offset];
      
      const result = await client.query(
        `SELECT 
          f.scheme_code as "schemeCode",
          f.scheme_name as "schemeName",
          f.latest_nav as nav,
          f.latest_nav_date as date,
          f.amc_code as "amcCode",
          f.scheme_type as "schemeType",
          r.return_1y as "return1y",
          r.cagr_3y as "cagr3y",
          r.cagr_5y as "cagr5y"
        FROM funds f
        LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
        ${whereClause}
        ORDER BY r.cagr_3y DESC NULLS LAST
        LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        paginatedParams
      );

      console.log(`✅ Found ${totalCount} total funds, returning page ${page} of ${totalPages}`);

      return NextResponse.json({
        success: true,
        funds: result.rows.map(fund => ({
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          latestNav: fund.nav ? parseFloat(fund.nav) : null,
          latestNavDate: fund.date,
          amcCode: fund.amcCode,
          schemeType: fund.schemeType,
          return1y: fund.return1y ? parseFloat(fund.return1y) : null,
          cagr3y: fund.cagr3y ? parseFloat(fund.cagr3y) : null,
          cagr5y: fund.cagr5y ? parseFloat(fund.cagr5y) : null
        })),
        total: totalCount,
        page,
        pageSize,
        totalPages,
        query: query || amc || category
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('❌ Search error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      funds: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query = '', amc = '', category = '', subCategory = '', planType = '', limit = 100, dedup = true } = body;

    console.log('🔍 Advanced search:', { query, amc, category, subCategory, planType, limit });

    // If no filters, return stats only
    if (!query && !amc && !category && !subCategory && !planType) {
      const stats = await getDatabaseStats();
      return NextResponse.json({
        success: true,
        funds: [],
        total: stats.totalFunds,
        message: 'Apply filters to search funds'
      });
    }

    // Use custom search with separate filters
    const pool = (await import('@/lib/postgres-db')).default;
    const client = await pool.connect();

    try {
      let sqlQuery = `
        SELECT 
          f.scheme_code as "schemeCode",
          f.scheme_name as "schemeName",
          f.latest_nav as nav,
          f.latest_nav_date as date,
          f.amc_code as "amcCode",
          f.scheme_type as "schemeType",
          r.return_1y as "return1y",
          r.cagr_3y as "cagr3y",
          r.cagr_5y as "cagr5y"
        FROM funds f
        LEFT JOIN fund_returns r ON f.scheme_code = r.scheme_code
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramCount = 1;

      // Filter by AMC
      if (amc) {
        sqlQuery += ` AND f.amc_code ILIKE $${paramCount}`;
        params.push(`%${amc}%`);
        paramCount++;
      }

      // Filter by category (in scheme name or type)
      if (category) {
        sqlQuery += ` AND (f.scheme_name ILIKE $${paramCount} OR f.scheme_type ILIKE $${paramCount})`;
        params.push(`%${category}%`);
        paramCount++;
      }

      // Filter by sub-category with exact matching for specific terms
      if (subCategory) {
        // For specific sub-categories like "Mid Cap", use precise matching
        // to avoid matching "Large & Mid Cap" when searching for "Mid Cap"
        if (subCategory === 'Mid Cap') {
          sqlQuery += ` AND ((f.scheme_name ILIKE $${paramCount} OR f.scheme_name ILIKE $${paramCount + 1}) OR (f.scheme_type ILIKE $${paramCount} OR f.scheme_type ILIKE $${paramCount + 1}))`;
          sqlQuery += ` AND f.scheme_name NOT ILIKE $${paramCount + 2} AND f.scheme_name NOT ILIKE $${paramCount + 3}`;
          params.push('%Mid Cap%', '%Midcap%', '%Large%Mid%', '%Large%Midcap%');
          paramCount += 4;
        } else if (subCategory === 'Large Cap') {
          sqlQuery += ` AND ((f.scheme_name ILIKE $${paramCount} OR f.scheme_name ILIKE $${paramCount + 1}) OR (f.scheme_type ILIKE $${paramCount} OR f.scheme_type ILIKE $${paramCount + 1}))`;
          sqlQuery += ` AND f.scheme_name NOT ILIKE $${paramCount + 2} AND f.scheme_name NOT ILIKE $${paramCount + 3}`;
          params.push('%Large Cap%', '%Largecap%', '%Large%Mid%', '%Large%Midcap%');
          paramCount += 4;
        } else if (subCategory === 'Small Cap') {
          sqlQuery += ` AND ((f.scheme_name ILIKE $${paramCount} OR f.scheme_name ILIKE $${paramCount + 1}) OR (f.scheme_type ILIKE $${paramCount} OR f.scheme_type ILIKE $${paramCount + 1}))`;
          params.push('%Small Cap%', '%Smallcap%');
          paramCount += 2;
        } else {
          sqlQuery += ` AND (f.scheme_name ILIKE $${paramCount} OR f.scheme_type ILIKE $${paramCount})`;
          params.push(`%${subCategory}%`);
          paramCount++;
        }
      }

      // Filter by search query (word-split for loose matching)
      if (query) {
        const words = query.trim().split(/\s+/).filter((w: string) => w.length > 0);
        if (words.length > 1) {
          const wordConditions = words.map((_: string, idx: number) => {
            params.push(`%${words[idx]}%`);
            const p = paramCount + idx;
            return `f.scheme_name ILIKE $${p}`;
          });
          sqlQuery += ` AND (${wordConditions.join(' AND ')})`;
          paramCount += words.length;
        } else {
          sqlQuery += ` AND (f.scheme_name ILIKE $${paramCount} OR f.scheme_code LIKE $${paramCount})`;
          params.push(`%${query}%`);
          paramCount++;
        }
      }

      // Filter by plan type (embedded in scheme name since plan_type column is null)
      if (planType) {
        if (planType === 'Direct') {
          sqlQuery += ` AND f.scheme_name ILIKE $${paramCount}`;
          params.push('%Direct%');
          paramCount++;
        } else if (planType === 'Regular') {
          sqlQuery += ` AND f.scheme_name ILIKE $${paramCount} AND f.scheme_name NOT ILIKE $${paramCount + 1}`;
          params.push('%Regular%', '%Direct%');
          paramCount += 2;
        }
      } else if (dedup) {
        // Default dedup: show only Direct Plan + Growth (one row per fund family)
        sqlQuery += ` AND f.scheme_name ILIKE $${paramCount} AND f.scheme_name ILIKE $${paramCount + 1}`;
        params.push('%Direct%', '%Growth%');
        paramCount += 2;
      }

      sqlQuery += ` ORDER BY r.cagr_3y DESC NULLS LAST LIMIT $${paramCount}`;
      params.push(limit);

      console.log('SQL Query:', sqlQuery);
      console.log('Params:', params);

      const result = await client.query(sqlQuery, params);
      const funds = result.rows;

      console.log(`✅ Found ${funds.length} funds`);

      return NextResponse.json({
        success: true,
        funds: funds.map(fund => ({
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          latestNav: parseFloat(fund.nav),
          latestNavDate: fund.date,
          amcCode: fund.amcCode,
          schemeType: fund.schemeType,
          return1y: fund.return1y ? parseFloat(fund.return1y) : null,
          cagr3y: fund.cagr3y ? parseFloat(fund.cagr3y) : null,
          cagr5y: fund.cagr5y ? parseFloat(fund.cagr5y) : null
        })),
        total: funds.length,
        filters: { amc, category, subCategory, query, planType }
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('❌ Search error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      funds: []
    }, { status: 500 });
  }
}
