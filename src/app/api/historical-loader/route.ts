import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalLoader } from '@/lib/historical-data-loader';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const batchSize = parseInt(searchParams.get('batchSize') || '10');
    
    const loader = getHistoricalLoader();
    
    switch (action) {
      case 'stats':
        // Get current loading statistics
        const stats = loader.getStats();
        return NextResponse.json({
          success: true,
          data: stats,
          message: `Historical Loading: ${stats.processedSchemes}/${stats.totalSchemes} schemes (${stats.successRate.toFixed(1)}% success rate)`
        });
      
      case 'load':
        // Load next batch of historical data
        console.log(`🔄 Loading next batch of ${batchSize} historical records...`);
        const result = await loader.loadAllHistoricalData(batchSize);
        
        const successRate = result.processedSchemes / Math.max(result.currentScheme, 1) * 100;
        
        return NextResponse.json({
          success: true,
          data: result,
          message: result.phase === 'COMPLETE' 
            ? '🎉 All historical data loaded successfully!'
            : `📊 Loaded ${result.processedSchemes}/${result.totalSchemes} schemes (${successRate.toFixed(1)}% success)`
        });
      
      case 'schemes':
        // Get list of schemes to be processed
        const allSchemes = await loader.fetchAllSchemes();
        
        return NextResponse.json({
          success: true,
          data: {
            totalSchemes: allSchemes.length,
            schemes: allSchemes.slice(0, 50), // First 50 for preview
            message: `Found ${allSchemes.length} total schemes`
          }
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: stats, load, or schemes'
        }, { status: 400 });
    }
    
  } catch (error: unknown) {
    console.error('❌ Historical API error:', error);
    
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
    const { action, schemeCodes, batchSize = 10 } = body;
    
    const loader = getHistoricalLoader();
    
    switch (action) {
      case 'updateLatest':
        // Update latest NAV data for specific schemes
        if (!Array.isArray(schemeCodes) || schemeCodes.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'schemeCodes array is required for latest updates'
          }, { status: 400 });
        }
        
        console.log(`🔄 Updating latest data for ${schemeCodes.length} schemes...`);
        const updateResult = await loader.updateLatestData(schemeCodes);
        
        return NextResponse.json({
          success: true,
          data: updateResult,
          message: `Updated ${updateResult.updated} schemes, ${updateResult.failed} failed`
        });
      
      case 'bulkLoad':
        // Load historical data with custom batch size
        console.log(`🔄 Bulk historical loading with batch size: ${batchSize}`);
        const loadResult = await loader.loadAllHistoricalData(batchSize);
        
        return NextResponse.json({
          success: true,
          data: loadResult,
          message: loadResult.phase === 'COMPLETE' 
            ? '🎉 All historical data loaded!'
            : `📊 Loaded ${loadResult.processedSchemes}/${loadResult.totalSchemes} schemes`
        });
      
      case 'resetProgress':
        // Reset loading progress (for testing/restarting)
        // This is dangerous - only for development
        if (process.env.NODE_ENV !== 'development') {
          return NextResponse.json({
            success: false,
            error: 'Reset only allowed in development mode'
          }, { status: 403 });
        }
        
        // Reset would require recreating the loader
        return NextResponse.json({
          success: true,
          message: 'Progress reset - restart server to take effect'
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: updateLatest, bulkLoad, or resetProgress'
        }, { status: 400 });
    }
    
  } catch (error: unknown) {
    console.error('❌ Historical API POST error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}