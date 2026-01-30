import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService, NAVRecord } from '@/lib/dynamodb';
import { NAVUpdateService } from '@/lib/nav-update';

/**
 * Professional Mutual Fund API
 * GET /api/funds-data - Get fund data with real-time NAV updates
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schemeCode = searchParams.get('schemeCode');
    const category = searchParams.get('category');
    const subCategory = searchParams.get('subCategory');
    const limit = parseInt(searchParams.get('limit') || '20');
    const autoUpdate = searchParams.get('autoUpdate') === 'true';

    // Health check endpoint
    if (searchParams.get('health') === 'true') {
      const health = await NAVUpdateService.healthCheck();
      return NextResponse.json({
        success: true,
        health,
        timestamp: new Date().toISOString()
      });
    }

    // Single scheme lookup
    if (schemeCode) {
      const schemeCodeNum = parseInt(schemeCode);
      
      if (isNaN(schemeCodeNum)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid scheme code'
        }, { status: 400 });
      }

      // Get fund details
      const fund = await DynamoDBService.getFund(schemeCodeNum);
      if (!fund) {
        return NextResponse.json({
          success: false,
          error: 'Fund not found'
        }, { status: 404 });
      }

      // Get NAV data with auto-update if requested
      let navData = null;
      let wasUpdated = false;

      if (autoUpdate) {
        const navResult = await NAVUpdateService.getNAVWithAutoUpdate(schemeCodeNum);
        navData = navResult.nav;
        wasUpdated = navResult.wasUpdated;
      } else {
        navData = await DynamoDBService.getNAVCache(schemeCodeNum);
      }

      // Get historical data if requested
      let historicalData: NAVRecord[] = [];
      if (searchParams.get('includeHistory') === 'true') {
        historicalData = await DynamoDBService.getNAVHistory(schemeCodeNum, 30);
      }

      return NextResponse.json({
        success: true,
        data: {
          fund,
          nav: navData,
          history: historicalData,
          wasUpdated,
          autoUpdate
        },
        timestamp: new Date().toISOString()
      });
    }

    // Category-based fund listing
    if (category) {
      const funds = await DynamoDBService.getFundsByCategory(category, subCategory || undefined);
      
      // Limit results
      const limitedFunds = funds.slice(0, limit);
      
      // Get NAV data for each fund if requested
      const fundsWithNAV = [];
      
      if (searchParams.get('includeNAV') === 'true') {
        for (const fund of limitedFunds) {
          let navData = null;
          
          if (autoUpdate) {
            const navResult = await NAVUpdateService.getNAVWithAutoUpdate(fund.schemeCode);
            navData = navResult.nav;
          } else {
            navData = await DynamoDBService.getNAVCache(fund.schemeCode);
          }
          
          fundsWithNAV.push({
            ...fund,
            nav: navData
          });
        }
      } else {
        fundsWithNAV.push(...limitedFunds);
      }

      return NextResponse.json({
        success: true,
        data: {
          funds: fundsWithNAV,
          total: funds.length,
          category,
          subCategory,
          limit
        },
        timestamp: new Date().toISOString()
      });
    }

    // Default: Return popular funds with NAV
    const popularSchemeCodes = [120503, 120716, 112090, 120224, 135772, 100127];
    const popularFunds = [];
    
    for (const code of popularSchemeCodes) {
      const fund = await DynamoDBService.getFund(code);
      if (fund) {
        let navData = null;
        
        if (autoUpdate) {
          const navResult = await NAVUpdateService.getNAVWithAutoUpdate(code);
          navData = navResult.nav;
        } else {
          navData = await DynamoDBService.getNAVCache(code);
        }
        
        popularFunds.push({
          ...fund,
          nav: navData
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        funds: popularFunds,
        type: 'popular',
        autoUpdate
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/funds-data - Trigger manual NAV updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, schemeCodes } = body;

    if (action === 'updateNAV') {
      if (!schemeCodes || !Array.isArray(schemeCodes)) {
        return NextResponse.json({
          success: false,
          error: 'schemeCodes array is required'
        }, { status: 400 });
      }

      const results = await NAVUpdateService.updateMultipleNAVs(schemeCodes);
      
      return NextResponse.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'scheduledUpdate') {
      const results = await NAVUpdateService.runScheduledUpdate();
      
      return NextResponse.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('POST API Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}