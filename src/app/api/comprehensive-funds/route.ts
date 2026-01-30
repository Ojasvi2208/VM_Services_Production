import { NextResponse } from 'next/server';
import { ComprehensiveFundService } from '@/lib/comprehensive-fund-service';
import { FUND_CATEGORIES } from '@/lib/fund-categories';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const category = url.searchParams.get('category');
    const subCategory = url.searchParams.get('subCategory');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const searchTerm = url.searchParams.get('search');

    const fundService = new ComprehensiveFundService();

    switch (action) {
      case 'categories':
        // Return available categories and subcategories
        return NextResponse.json({
          success: true,
          categories: FUND_CATEGORIES,
          summary: await fundService.getCategorySummary()
        });

      case 'random':
        // Get random funds for homepage display
        const randomFunds = await fundService.getRandomFunds(limit);
        return NextResponse.json({
          success: true,
          funds: randomFunds,
          total: randomFunds.length,
          source: 'random_selection'
        });

      case 'search':
        if (!searchTerm) {
          return NextResponse.json({ 
            success: false, 
            error: 'Search term required' 
          }, { status: 400 });
        }
        
        const searchResults = await fundService.searchFunds(searchTerm, limit);
        return NextResponse.json({
          success: true,
          funds: searchResults,
          total: searchResults.length,
          searchTerm,
          source: 'search'
        });

      case 'category':
        if (!category) {
          return NextResponse.json({ 
            success: false, 
            error: 'Category required' 
          }, { status: 400 });
        }

        const categoryResults = await fundService.getFundsByCategory(
          category, 
          subCategory || undefined, 
          limit, 
          offset, 
          searchTerm || undefined
        );

        return NextResponse.json({
          success: true,
          ...categoryResults,
          category,
          subCategory,
          source: 'category_filter'
        });

      case 'initialize':
        // Initialize the database with all funds from schema
        await fundService.initializeFundsDatabase();
        return NextResponse.json({
          success: true,
          message: 'Database initialization started'
        });

      default:
        // Default: Get random funds for general display
        const defaultFunds = await fundService.getRandomFunds(8);
        return NextResponse.json({
          success: true,
          funds: defaultFunds,
          total: defaultFunds.length,
          source: 'default_selection',
          lastUpdated: new Date().toISOString(),
          note: 'Comprehensive fund data with real-time NAV integration'
        });
    }

  } catch (error) {
    console.error('Comprehensive fund API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Service temporarily unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, schemeCode, schemeCodes } = body;

    const fundService = new ComprehensiveFundService();

    switch (action) {
      case 'updateNAV':
        if (!schemeCode) {
          return NextResponse.json({ 
            success: false, 
            error: 'Scheme code required' 
          }, { status: 400 });
        }

        const navData = await fundService.getFundNAV(schemeCode);
        return NextResponse.json({
          success: true,
          schemeCode,
          navData,
          lastUpdated: new Date().toISOString()
        });

      case 'batchUpdateNAVs':
        if (!schemeCodes || !Array.isArray(schemeCodes)) {
          return NextResponse.json({ 
            success: false, 
            error: 'Scheme codes array required' 
          }, { status: 400 });
        }

        await fundService.batchUpdateNAVs(schemeCodes);
        return NextResponse.json({
          success: true,
          message: `Batch NAV update initiated for ${schemeCodes.length} funds`,
          schemeCodes
        });

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid action' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Comprehensive fund POST API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Service temporarily unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}