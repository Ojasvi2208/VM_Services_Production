/**
 * Fast Fund Search API
 * Searches through 14,083+ funds in PostgreSQL
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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    console.log('🔍 Search request:', { query, amc, category, page, pageSize });

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
      let whereClause = '';
      const params: any[] = [];
      let paramCount = 1;

      if (query) {
        whereClause = `WHERE (scheme_name ILIKE $${paramCount} OR scheme_code LIKE $${paramCount})`;
        params.push(`%${query}%`);
        paramCount++;
      }

      if (amc) {
        whereClause += whereClause ? ` AND scheme_name ILIKE $${paramCount}` : `WHERE scheme_name ILIKE $${paramCount}`;
        params.push(`%${amc}%`);
        paramCount++;
      }

      if (category) {
        whereClause += whereClause ? ` AND (scheme_name ILIKE $${paramCount} OR scheme_type ILIKE $${paramCount})` : `WHERE (scheme_name ILIKE $${paramCount} OR scheme_type ILIKE $${paramCount})`;
        params.push(`%${category}%`);
        paramCount++;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM funds ${whereClause}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / pageSize);

      // Get paginated results
      const offset = (page - 1) * pageSize;
      const paginatedParams = [...params, pageSize, offset];
      
      const result = await client.query(
        `SELECT 
          scheme_code as "schemeCode",
          scheme_name as "schemeName",
          latest_nav as nav,
          latest_nav_date as date,
          amc_code as "amcCode",
          scheme_type as "schemeType"
        FROM funds
        ${whereClause}
        ORDER BY scheme_name
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
          schemeType: fund.schemeType
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
    const { query = '', amc = '', category = '', subCategory = '', planType = '', limit = 100 } = body;

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
          scheme_code as "schemeCode",
          scheme_name as "schemeName",
          latest_nav as nav,
          latest_nav_date as date,
          amc_code as "amcCode",
          scheme_type as "schemeType"
        FROM funds
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramCount = 1;

      // Filter by AMC
      if (amc) {
        sqlQuery += ` AND amc_code ILIKE $${paramCount}`;
        params.push(`%${amc}%`);
        paramCount++;
      }

      // Filter by category (in scheme name or type)
      if (category) {
        sqlQuery += ` AND (scheme_name ILIKE $${paramCount} OR scheme_type ILIKE $${paramCount})`;
        params.push(`%${category}%`);
        paramCount++;
      }

      // Filter by sub-category with exact matching for specific terms
      if (subCategory) {
        // For specific sub-categories like "Mid Cap", use precise matching
        // to avoid matching "Large & Mid Cap" when searching for "Mid Cap"
        if (subCategory === 'Mid Cap') {
          // Match "Mid Cap" or "Midcap" but exclude "Large & Mid Cap" or "Large Midcap"
          sqlQuery += ` AND ((scheme_name ILIKE $${paramCount} OR scheme_name ILIKE $${paramCount + 1}) OR (scheme_type ILIKE $${paramCount} OR scheme_type ILIKE $${paramCount + 1}))`;
          sqlQuery += ` AND scheme_name NOT ILIKE $${paramCount + 2} AND scheme_name NOT ILIKE $${paramCount + 3}`;
          params.push('%Mid Cap%', '%Midcap%', '%Large%Mid%', '%Large%Midcap%');
          paramCount += 4;
        } else if (subCategory === 'Large Cap') {
          // Match "Large Cap" or "Largecap" but exclude "Large & Mid Cap"
          sqlQuery += ` AND ((scheme_name ILIKE $${paramCount} OR scheme_name ILIKE $${paramCount + 1}) OR (scheme_type ILIKE $${paramCount} OR scheme_type ILIKE $${paramCount + 1}))`;
          sqlQuery += ` AND scheme_name NOT ILIKE $${paramCount + 2} AND scheme_name NOT ILIKE $${paramCount + 3}`;
          params.push('%Large Cap%', '%Largecap%', '%Large%Mid%', '%Large%Midcap%');
          paramCount += 4;
        } else if (subCategory === 'Small Cap') {
          // Match "Small Cap" or "Smallcap"
          sqlQuery += ` AND ((scheme_name ILIKE $${paramCount} OR scheme_name ILIKE $${paramCount + 1}) OR (scheme_type ILIKE $${paramCount} OR scheme_type ILIKE $${paramCount + 1}))`;
          params.push('%Small Cap%', '%Smallcap%');
          paramCount += 2;
        } else {
          // For other categories, use regular ILIKE
          sqlQuery += ` AND (scheme_name ILIKE $${paramCount} OR scheme_type ILIKE $${paramCount})`;
          params.push(`%${subCategory}%`);
          paramCount++;
        }
      }

      // Filter by search query
      if (query) {
        sqlQuery += ` AND (scheme_name ILIKE $${paramCount} OR scheme_code LIKE $${paramCount})`;
        params.push(`%${query}%`);
        paramCount++;
      }

      // Filter by plan type
      if (planType) {
        sqlQuery += ` AND plan_type = $${paramCount}`;
        params.push(planType);
        paramCount++;
      }

      sqlQuery += ` ORDER BY scheme_name LIMIT $${paramCount}`;
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
          schemeType: fund.schemeType
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
