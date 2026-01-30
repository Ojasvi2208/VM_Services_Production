/**
 * Advanced Fund Search API
 * Memory-efficient, high-performance search with multiple algorithms
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSearchEngine, type SearchFilters } from '@/lib/advanced-search-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'search';
    
    const searchEngine = getSearchEngine();
    
    switch (action) {
      case 'search': {
        const filters: SearchFilters = {};
        
        // Parse search parameters
        if (searchParams.get('q')) {
          filters.searchText = searchParams.get('q')!;
        }
        
        if (searchParams.get('fundHouse')) {
          filters.fundHouse = searchParams.get('fundHouse')!.split(',');
        }
        
        if (searchParams.get('category')) {
          filters.category = searchParams.get('category')!.split(',');
        }
        
        if (searchParams.get('plan')) {
          filters.plan = searchParams.get('plan')!.split(',') as ('Direct' | 'Regular')[];
        }
        
        if (searchParams.get('riskLevel')) {
          filters.riskLevel = searchParams.get('riskLevel')!.split(',');
        }
        
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        filters.limit = Math.min(limit, 100); // Max 100 results per page
        filters.offset = Math.max(offset, 0);
        
        console.log('🔍 Performing search with filters:', filters);
        
        const results = await searchEngine.search(filters);
        
        return NextResponse.json({
          success: true,
          data: results.funds,
          meta: {
            total: results.total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: results.hasMore,
            searchTime: results.searchTime,
            fromCache: results.fromCache
          },
          timestamp: new Date().toISOString()
        });
      }
      
      case 'suggestions': {
        const query = searchParams.get('q') || '';
        const limit = parseInt(searchParams.get('limit') || '10');
        
        if (query.length < 2) {
          return NextResponse.json({
            success: true,
            data: [],
            message: 'Query too short for suggestions'
          });
        }
        
        const suggestions = await searchEngine.getSuggestions(query, limit);
        
        return NextResponse.json({
          success: true,
          data: suggestions,
          query,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'analytics': {
        console.log('📊 Getting analytics...');
        
        const analytics = await searchEngine.getAnalytics();
        
        return NextResponse.json({
          success: true,
          data: analytics,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'health': {
        // Health check endpoint
        return NextResponse.json({
          success: true,
          status: 'healthy',
          engine: 'AdvancedFundSearchEngine',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: search, suggestions, analytics, health'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Advanced search API error:', error);
    
    // Provide detailed error information in development
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? {
          message: String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      : { message: 'Internal server error' };
    
    return NextResponse.json({
      success: false,
      error: 'Search service temporarily unavailable',
      details: errorDetails
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filters } = body;
    
    const searchEngine = getSearchEngine();
    
    switch (action) {
      case 'advancedSearch': {
        console.log('🔍 Performing advanced search with POST filters:', filters);
        
        const results = await searchEngine.search(filters as SearchFilters);
        
        return NextResponse.json({
          success: true,
          data: results.funds,
          meta: {
            total: results.total,
            limit: filters.limit || 20,
            offset: filters.offset || 0,
            hasMore: results.hasMore,
            searchTime: results.searchTime,
            fromCache: results.fromCache
          },
          appliedFilters: filters,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'bulkAnalytics': {
        const { schemeCodes } = body;
        
        if (!Array.isArray(schemeCodes)) {
          return NextResponse.json({
            error: 'schemeCodes must be an array'
          }, { status: 400 });
        }
        
        // For now, return basic info - can be extended with real analytics
        return NextResponse.json({
          success: true,
          data: {
            analyzed: schemeCodes.length,
            message: 'Bulk analytics feature coming soon'
          },
          timestamp: new Date().toISOString()
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: advancedSearch, bulkAnalytics'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Advanced search POST API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Advanced search failed',
      details: String(error)
    }, { status: 500 });
  }
}