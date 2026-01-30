import { NextRequest, NextResponse } from 'next/server';
import { getIncrementalLoader } from '@/lib/incremental-loader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const batchSize = parseInt(searchParams.get('batchSize') || '10');
    
    const loader = getIncrementalLoader();
    
    switch (action) {
      case 'stats':
        // Get current statistics without processing
        const stats = loader.getStatistics();
        return NextResponse.json({
          success: true,
          data: stats,
          message: `Database contains ${stats.processedFunds}/${stats.totalFunds} funds (${stats.progress.toFixed(1)}% complete)`
        });
      
      case 'process':
        // Process next batch incrementally
        console.log(`🔄 Processing next batch of ${batchSize} funds...`);
        const result = await loader.processIncrementally(batchSize);
        
        return NextResponse.json({
          success: true,
          data: result,
          message: result.isComplete 
            ? '✅ All funds processed successfully!'
            : `📊 Processed ${result.processed}/${result.total} funds (${result.progress.toFixed(1)}% complete)`
        });
      
      case 'search':
        // Quick search in processed funds
        const query = searchParams.get('q') || '';
        const limit = parseInt(searchParams.get('limit') || '20');
        
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'Query parameter "q" is required for search'
          }, { status: 400 });
        }
        
        const searchResults = loader.search(query, limit);
        
        return NextResponse.json({
          success: true,
          data: {
            query,
            results: searchResults,
            count: searchResults.length
          },
          message: `Found ${searchResults.length} funds matching "${query}"`
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: stats, process, or search'
        }, { status: 400 });
    }
    
  } catch (error: unknown) {
    console.error('❌ Incremental API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, schemeCode, nav, date, batchSize = 10 } = body;
    
    const loader = getIncrementalLoader();
    
    switch (action) {
      case 'updateNAV':
        // Update current NAV for a specific fund
        if (!schemeCode || nav === undefined || !date) {
          return NextResponse.json({
            success: false,
            error: 'schemeCode, nav, and date are required for NAV update'
          }, { status: 400 });
        }
        
        await loader.updateCurrentNAV(schemeCode, nav, date);
        
        return NextResponse.json({
          success: true,
          message: `NAV updated for scheme ${schemeCode}`,
          data: { schemeCode, nav, date }
        });
      
      case 'bulkProcess':
        // Process funds with custom batch size
        console.log(`🔄 Bulk processing with batch size: ${batchSize}`);
        const result = await loader.processIncrementally(batchSize);
        
        return NextResponse.json({
          success: true,
          data: result,
          message: result.isComplete 
            ? '✅ All funds processed successfully!'
            : `📊 Processed ${result.processed}/${result.total} funds (${result.progress.toFixed(1)}% complete)`
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: updateNAV or bulkProcess'
        }, { status: 400 });
    }
    
  } catch (error: unknown) {
    console.error('❌ Incremental API POST error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}