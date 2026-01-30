/**
 * Production-Ready Google-Like Search API
 * Handles 37K+ funds without crashes using advanced algorithms
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSearchEngine, type SearchQuery } from '@/lib/google-search-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'search';
    
    console.log(`🔍 Google Search API - Action: ${action}`);
    
    const searchEngine = getGoogleSearchEngine();
    
    switch (action) {
      case 'search': {
        const query: SearchQuery = {};
        
        // Parse search text
        if (searchParams.get('q')) {
          query.text = searchParams.get('q')!;
        }
        
        // Parse filters
        if (searchParams.get('fundHouse')) {
          query.filters = {
            ...query.filters,
            fundHouse: searchParams.get('fundHouse')!.split(',')
          };
        }
        
        if (searchParams.get('category')) {
          query.filters = {
            ...query.filters,
            category: searchParams.get('category')!.split(',')
          };
        }
        
        if (searchParams.get('plan')) {
          query.filters = {
            ...query.filters,
            plan: searchParams.get('plan')!.split(',') as ('Direct' | 'Regular')[]
          };
        }
        
        if (searchParams.get('riskLevel')) {
          const riskLevels = searchParams.get('riskLevel')!.split(',').map(Number);
          query.filters = {
            ...query.filters,
            riskLevel: riskLevels
          };
        }
        
        // Parse pagination
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        query.limit = Math.min(limit, 100);
        query.offset = Math.max(offset, 0);
        
        // Parse sorting
        if (searchParams.get('sortBy')) {
          query.sortBy = searchParams.get('sortBy')! as 'relevance' | 'aum' | 'expenseRatio' | 'nav' | 'alphabetical';
          query.sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';
        }
        
        console.log('🎯 Executing search with query:', JSON.stringify(query, null, 2));
        
        const results = await searchEngine.search(query);
        
        return NextResponse.json({
          success: true,
          data: results.results.map(result => ({
            fund: {
              schemeCode: result.document.schemeCode,
              schemeName: result.document.schemeName,
              fundHouse: result.document.fundHouse,
              category: result.document.category,
              subCategory: result.document.subCategory,
              plan: result.document.plan,
              option: result.document.option,
              riskLevel: result.document.riskLevel,
              aum: result.document.aum,
              expenseRatio: result.document.expenseRatio,
              nav: result.document.nav
            },
            relevanceScore: result.score,
            matchedTerms: result.matchedTerms,
            explanation: result.explanation
          })),
          meta: {
            total: results.total,
            searchTime: results.searchTime,
            hasMore: results.hasMore,
            limit: query.limit,
            offset: query.offset
          },
          suggestions: results.suggestions,
          facets: results.facets,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'autocomplete': {
        const query = searchParams.get('q') || '';
        
        if (query.length < 2) {
          return NextResponse.json({
            success: true,
            data: [],
            message: 'Query too short for autocomplete'
          });
        }
        
        const searchResults = await searchEngine.search({ 
          text: query, 
          limit: 5 
        });
        
        const suggestions = searchResults.suggestions.slice(0, 10);
        
        return NextResponse.json({
          success: true,
          data: suggestions,
          query,
          searchTime: searchResults.searchTime,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'health': {
        const health = searchEngine.getHealth();
        
        return NextResponse.json({
          success: true,
          data: health,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'analytics': {
        await searchEngine.initialize();
        
        // Get sample of funds for analytics
        const sampleSearch = await searchEngine.search({ 
          text: '', 
          limit: 1000 
        });
        
        const analytics = {
          totalFunds: sampleSearch.total,
          searchEngineHealth: searchEngine.getHealth(),
          topCategories: Object.entries(sampleSearch.facets.categories)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
          topFundHouses: Object.entries(sampleSearch.facets.fundHouses)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
          riskDistribution: sampleSearch.facets.riskLevels
        };
        
        return NextResponse.json({
          success: true,
          data: analytics,
          timestamp: new Date().toISOString()
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported: search, autocomplete, health, analytics'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Google Search API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Search service unavailable',
      details: process.env.NODE_ENV === 'development' ? String(error) : 'Internal error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query } = body;
    
    console.log(`🔍 Google Search API POST - Action: ${action}`);
    
    const searchEngine = getGoogleSearchEngine();
    
    switch (action) {
      case 'advancedSearch': {
        const results = await searchEngine.search(query as SearchQuery);
        
        return NextResponse.json({
          success: true,
          data: results.results,
          meta: {
            total: results.total,
            searchTime: results.searchTime,
            hasMore: results.hasMore
          },
          suggestions: results.suggestions,
          facets: results.facets,
          appliedQuery: query,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'bulkSearch': {
        const { queries } = body;
        
        if (!Array.isArray(queries)) {
          return NextResponse.json({
            error: 'queries must be an array'
          }, { status: 400 });
        }
        
        const results = await Promise.all(
          queries.map(async (q: SearchQuery) => {
            const result = await searchEngine.search(q);
            return {
              query: q,
              results: result.results.slice(0, 5), // Limit for bulk
              total: result.total
            };
          })
        );
        
        return NextResponse.json({
          success: true,
          data: results,
          timestamp: new Date().toISOString()
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported: advancedSearch, bulkSearch'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Google Search API POST error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Advanced search failed',
      details: String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}