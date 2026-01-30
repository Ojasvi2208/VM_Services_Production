import { DynamoDBService, NAVRecord, NAVCacheRecord } from './dynamodb';
import { MFAPIService } from './mfapi';

/**
 * Professional NAV Update Service
 * Handles intelligent NAV updates with caching and optimization
 */
export class NAVUpdateService {
  private static readonly MAX_CONCURRENT_UPDATES = 5;
  private static readonly UPDATE_BATCH_SIZE = 50;
  private static readonly CACHE_TTL_HOURS = 24;

  /**
   * Update NAV for a single scheme
   */
  static async updateSchemeNAV(schemeCode: number): Promise<{
    success: boolean;
    updated: boolean;
    data?: NAVCacheRecord;
    error?: string;
  }> {
    try {
      // Check if update is needed
      const existingCache = await DynamoDBService.getNAVCache(schemeCode);
      
      if (existingCache && !MFAPIService.shouldUpdateNAV(existingCache.latestDate)) {
        return {
          success: true,
          updated: false,
          data: existingCache
        };
      }

      // Fetch latest NAV from MF API
      const latestData = await MFAPIService.getLatestNAV(schemeCode);
      
      if (!latestData) {
        return {
          success: false,
          updated: false,
          error: 'Failed to fetch NAV data from MF API'
        };
      }

      // Calculate changes
      const previousNAV = existingCache?.latestNAV || latestData.nav;
      const changeData = MFAPIService.calculateChange(latestData.nav, previousNAV);

      // Create NAV record
      const navRecord: NAVRecord = {
        schemeCode,
        date: latestData.date,
        nav: latestData.nav,
        change: changeData.change,
        changePercent: changeData.changePercent,
        timestamp: new Date().toISOString(),
        source: 'mfapi'
      };

      // Update database
      const updateSuccess = await DynamoDBService.updateNAV(navRecord);
      
      if (!updateSuccess) {
        return {
          success: false,
          updated: false,
          error: 'Failed to update database'
        };
      }

      // Get updated cache
      const updatedCache = await DynamoDBService.getNAVCache(schemeCode);

      return {
        success: true,
        updated: true,
        data: updatedCache || undefined
      };

    } catch (error) {
      console.error(`Error updating NAV for scheme ${schemeCode}:`, error);
      return {
        success: false,
        updated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update NAVs for multiple schemes with intelligent batching
   */
  static async updateMultipleNAVs(schemeCodes: number[]): Promise<{
    totalSchemes: number;
    successCount: number;
    updateCount: number;
    errors: Array<{ schemeCode: number; error: string }>;
  }> {
    const results = {
      totalSchemes: schemeCodes.length,
      successCount: 0,
      updateCount: 0,
      errors: [] as Array<{ schemeCode: number; error: string }>
    };

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < schemeCodes.length; i += this.UPDATE_BATCH_SIZE) {
      const batch = schemeCodes.slice(i, i + this.UPDATE_BATCH_SIZE);
      
      // Process batch with concurrency control
      const batchPromises = batch.map(schemeCode =>
        this.updateWithRetry(schemeCode)
      );

      // Process in smaller concurrent groups
      for (let j = 0; j < batchPromises.length; j += this.MAX_CONCURRENT_UPDATES) {
        const concurrentGroup = batchPromises.slice(j, j + this.MAX_CONCURRENT_UPDATES);
        const groupResults = await Promise.allSettled(concurrentGroup);

        groupResults.forEach((result, index) => {
          const schemeCode = batch[j + index];
          
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              results.successCount++;
              if (result.value.updated) {
                results.updateCount++;
              }
            } else {
              results.errors.push({
                schemeCode,
                error: result.value.error || 'Unknown error'
              });
            }
          } else {
            results.errors.push({
              schemeCode,
              error: result.reason?.message || 'Promise rejected'
            });
          }
        });

        // Add delay between concurrent groups
        if (j + this.MAX_CONCURRENT_UPDATES < batchPromises.length) {
          await this.delay(200);
        }
      }

      // Add delay between batches
      if (i + this.UPDATE_BATCH_SIZE < schemeCodes.length) {
        await this.delay(1000);
        console.log(`Completed batch ${Math.floor(i / this.UPDATE_BATCH_SIZE) + 1}, progress: ${Math.min(i + this.UPDATE_BATCH_SIZE, schemeCodes.length)}/${schemeCodes.length}`);
      }
    }

    return results;
  }

  /**
   * Update with retry logic
   */
  private static async updateWithRetry(schemeCode: number, maxRetries: number = 3): Promise<{
    success: boolean;
    updated: boolean;
    error?: string;
  }> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.updateSchemeNAV(schemeCode);
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error;
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await this.delay(1000 * Math.pow(2, attempt - 1));
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt < maxRetries) {
          await this.delay(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    return {
      success: false,
      updated: false,
      error: lastError || 'All retry attempts failed'
    };
  }

  /**
   * Get schemes that need updates
   */
  static async getSchemesNeedingUpdate(): Promise<number[]> {
    try {
      // This would typically query the database for schemes with stale data
      // For now, we'll return a subset of active schemes
      
      // Get a sample of popular schemes that need regular updates
      const popularSchemes = [
        120503, // SBI Bluechip Fund
        120716, // HDFC Top 100 Fund
        112090, // HDFC Mid-Cap Opportunities
        120224, // SBI Small Cap Fund
        135772, // Parag Parikh Flexi Cap Fund
        100127, // Axis Long Term Equity Fund
        118825, // ICICI Pru Bluechip Fund
        100027, // UTI Nifty Fund
        119551, // Kotak Standard Multicap Fund
        118989  // Nippon India Large Cap Fund
      ];

      // In production, you would query the cache table to find stale entries
      const needsUpdate: number[] = [];
      
      for (const schemeCode of popularSchemes) {
        const cache = await DynamoDBService.getNAVCache(schemeCode);
        
        if (!cache || MFAPIService.shouldUpdateNAV(cache.latestDate)) {
          needsUpdate.push(schemeCode);
        }
      }

      return needsUpdate;
      
    } catch (error) {
      console.error('Error getting schemes needing update:', error);
      return [];
    }
  }

  /**
   * Scheduled update job
   */
  static async runScheduledUpdate(): Promise<{
    success: boolean;
    stats: {
      totalChecked: number;
      needingUpdate: number;
      successfulUpdates: number;
      errors: number;
    };
    errors?: Array<{ schemeCode: number; error: string }>;
  }> {
    try {
      console.log('Starting scheduled NAV update...');
      
      const schemesToUpdate = await this.getSchemesNeedingUpdate();
      
      if (schemesToUpdate.length === 0) {
        console.log('No schemes need updating');
        return {
          success: true,
          stats: {
            totalChecked: 0,
            needingUpdate: 0,
            successfulUpdates: 0,
            errors: 0
          }
        };
      }

      console.log(`Found ${schemesToUpdate.length} schemes needing update`);
      
      const results = await this.updateMultipleNAVs(schemesToUpdate);
      
      console.log('Scheduled update completed:', {
        total: results.totalSchemes,
        successful: results.successCount,
        updated: results.updateCount,
        errors: results.errors.length
      });

      return {
        success: true,
        stats: {
          totalChecked: results.totalSchemes,
          needingUpdate: results.totalSchemes,
          successfulUpdates: results.updateCount,
          errors: results.errors.length
        },
        errors: results.errors.length > 0 ? results.errors : undefined
      };

    } catch (error) {
      console.error('Error in scheduled update:', error);
      return {
        success: false,
        stats: {
          totalChecked: 0,
          needingUpdate: 0,
          successfulUpdates: 0,
          errors: 1
        }
      };
    }
  }

  /**
   * Get NAV with auto-update if stale
   */
  static async getNAVWithAutoUpdate(schemeCode: number): Promise<{
    nav: NAVCacheRecord | null;
    wasUpdated: boolean;
  }> {
    try {
      // Get current cache
      let cache = await DynamoDBService.getNAVCache(schemeCode);
      
      // Check if update is needed
      if (!cache || MFAPIService.shouldUpdateNAV(cache.latestDate)) {
        console.log(`Auto-updating NAV for scheme ${schemeCode}`);
        
        const updateResult = await this.updateSchemeNAV(schemeCode);
        
        if (updateResult.success && updateResult.data) {
          cache = updateResult.data;
          return {
            nav: cache,
            wasUpdated: true
          };
        }
      }

      return {
        nav: cache,
        wasUpdated: false
      };

    } catch (error) {
      console.error(`Error in auto-update for scheme ${schemeCode}:`, error);
      
      // Return existing cache even if update failed
      const cache = await DynamoDBService.getNAVCache(schemeCode);
      return {
        nav: cache,
        wasUpdated: false
      };
    }
  }

  /**
   * Health check for NAV update service
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      mfApiStatus: string;
      databaseConnectivity: boolean;
      cacheStatus: string;
    };
    timestamp: string;
  }> {
    try {
      // Check MF API health
      const mfApiHealth = await MFAPIService.healthCheck();
      
      // Test database connectivity
      let dbConnectivity = false;
      try {
        await DynamoDBService.getNAVCache(120503); // Test with a known scheme
        dbConnectivity = true;
      } catch (error) {
        console.error('Database connectivity check failed:', error);
      }

      // Check cache status
      const cacheStatus = mfApiHealth.status === 'healthy' && dbConnectivity ? 'operational' : 'degraded';

      const overallStatus = 
        mfApiHealth.status === 'healthy' && dbConnectivity ? 'healthy' :
        mfApiHealth.status === 'degraded' || dbConnectivity ? 'degraded' : 'unhealthy';

      return {
        status: overallStatus,
        details: {
          mfApiStatus: mfApiHealth.status,
          databaseConnectivity: dbConnectivity,
          cacheStatus
        },
        timestamp: new Date().toISOString()
      };

    } catch {
      return {
        status: 'unhealthy',
        details: {
          mfApiStatus: 'unknown',
          databaseConnectivity: false,
          cacheStatus: 'failed'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Utility function for delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}