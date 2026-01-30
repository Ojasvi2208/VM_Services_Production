/**
 * Smart Incremental Fund Loader
 * Loads ONE fund at a time, caches permanently, only updates current NAV
 * Prevents memory crashes and server interruptions
 */

import { createReadStream, mkdirSync, statSync } from 'fs';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface FundRecord {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
  fundHouse?: string;
  category?: string;
  subCategory?: string;
  plan?: 'Direct' | 'Regular';
  riskLevel?: number;
  lastProcessed?: string;
  isActive?: boolean;
}

interface ProcessedFund extends FundRecord {
  id: string;
  searchTokens: string[];
  fundHouse: string;
  category: string;
  subCategory: string;
  plan: 'Direct' | 'Regular';
  riskLevel: number;
  lastProcessed: string;
  isActive: boolean;
}

interface LiveNAVData {
  schemeCode: number;
  nav: number;
  date: string;
  change: number;
  changePercent: number;
}

interface CachedFundDatabase {
  version: string;
  lastUpdated: string;
  totalFunds: number;
  processedCount: number;
  funds: Map<number, ProcessedFund>;
  navData: Map<number, LiveNAVData>;
  searchIndex: Map<string, Set<number>>;
  categories: Map<string, Set<number>>;
  fundHouses: Map<string, Set<number>>;
}

class IncrementalFundLoader {
  private cacheFile = join(process.cwd(), '.cache', 'fund-database.json');
  private navCacheFile = join(process.cwd(), '.cache', 'nav-cache.json');
  private database: CachedFundDatabase;
  private isLoading = false;
  private loadingProgress = 0;
  
  constructor() {
    this.ensureCacheDirectory();
    this.database = this.loadCachedDatabase();
  }
  
  private ensureCacheDirectory(): void {
    const cacheDir = join(process.cwd(), '.cache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
  }
  
  private loadCachedDatabase(): CachedFundDatabase {
    if (existsSync(this.cacheFile)) {
      try {
        console.log('📂 Loading cached fund database...');
        const data = JSON.parse(readFileSync(this.cacheFile, 'utf8'));
        
        // Convert plain objects back to Maps
        const database: CachedFundDatabase = {
          ...data,
          funds: new Map(data.funds || []),
          navData: new Map(data.navData || []),
          searchIndex: new Map((data.searchIndex || []).map(([key, values]: [string, number[]]) => [key, new Set(values)])),
          categories: new Map((data.categories || []).map(([key, values]: [string, number[]]) => [key, new Set(values)])),
          fundHouses: new Map((data.fundHouses || []).map(([key, values]: [string, number[]]) => [key, new Set(values)]))
        };
        
        console.log(`✅ Loaded ${database.processedCount}/${database.totalFunds} cached funds`);
        return database;
      } catch (error) {
        console.warn('⚠️ Cache corrupted, starting fresh:', error);
      }
    }
    
    // Initialize empty database
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalFunds: 0,
      processedCount: 0,
      funds: new Map(),
      navData: new Map(),
      searchIndex: new Map(),
      categories: new Map(),
      fundHouses: new Map()
    };
  }
  
  private saveDatabaseCache(): void {
    try {
      // Convert Maps to arrays for JSON serialization
      const serializable = {
        ...this.database,
        funds: Array.from(this.database.funds.entries()),
        navData: Array.from(this.database.navData.entries()),
        searchIndex: Array.from(this.database.searchIndex.entries()).map(([key, set]) => [key, Array.from(set)]),
        categories: Array.from(this.database.categories.entries()).map(([key, set]) => [key, Array.from(set)]),
        fundHouses: Array.from(this.database.fundHouses.entries()).map(([key, set]) => [key, Array.from(set)])
      };
      
      writeFileSync(this.cacheFile, JSON.stringify(serializable, null, 2));
      console.log(`💾 Saved database cache with ${this.database.processedCount} funds`);
    } catch (error) {
      console.error('❌ Failed to save cache:', error);
    }
  }
  
  // Process funds incrementally - ONE AT A TIME
  async processIncrementally(batchSize = 10): Promise<{
    progress: number;
    processed: number;
    total: number;
    isComplete: boolean;
    currentBatch: ProcessedFund[];
  }> {
    if (this.isLoading) {
      return {
        progress: this.loadingProgress,
        processed: this.database.processedCount,
        total: this.database.totalFunds,
        isComplete: false,
        currentBatch: []
      };
    }
    
    this.isLoading = true;
    console.log('🔄 Starting incremental fund processing...');
    
    try {
      const filePath = join(process.cwd(), 'public', 'Funds_Schema.json');
      
      if (!existsSync(filePath)) {
        throw new Error('Funds_Schema.json not found');
      }
      
      const currentBatch: ProcessedFund[] = [];
      let processed = 0;
      
      // Stream processing - read file in small chunks
      await this.streamProcessFunds(filePath, (fund: FundRecord) => {
        if (processed >= batchSize) {
          return false; // Stop processing for this batch
        }
        
        // Skip if already processed
        if (this.database.funds.has(fund.schemeCode)) {
          return true; // Continue to next fund
        }
        
        const processedFund = this.processSingleFund(fund);
        if (processedFund) {
          this.indexFund(processedFund);
          currentBatch.push(processedFund);
          processed++;
          this.database.processedCount++;
          
          console.log(`📊 Processed fund ${processed}/${batchSize}: ${processedFund.schemeName.substring(0, 50)}...`);
        }
        
        return true; // Continue processing
      });
      
      // Update progress
      this.loadingProgress = (this.database.processedCount / this.database.totalFunds) * 100;
      const isComplete = this.database.processedCount >= this.database.totalFunds;
      
      // Save progress every batch
      if (currentBatch.length > 0) {
        this.saveDatabaseCache();
      }
      
      this.isLoading = false;
      
      return {
        progress: this.loadingProgress,
        processed: this.database.processedCount,
        total: this.database.totalFunds,
        isComplete,
        currentBatch
      };
      
    } catch (error) {
      this.isLoading = false;
      console.error('❌ Incremental processing error:', error);
      throw error;
    }
  }
  
  private async streamProcessFunds(filePath: string, processor: (fund: FundRecord) => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let totalCount = 0;
      let skipCount = this.database.processedCount;
      
      const stream = createReadStream(filePath, { 
        encoding: 'utf8', 
        highWaterMark: 8192 // 8KB chunks - very small to prevent memory issues
      });
      
      stream.on('data', (chunk: Buffer | string) => {
        buffer += chunk.toString();
        
        // Process complete JSON objects one by one
        while (true) {
          const result = this.extractNextFund(buffer);
          if (!result.fund) break;
          
          buffer = result.remaining;
          totalCount++;
          
          // Update total if not set
          if (this.database.totalFunds === 0 && totalCount > 100) {
            // Estimate total based on current position
            const streamPosition = stream.bytesRead || 0;
            const fileSize = statSync(filePath).size;
            this.database.totalFunds = Math.round((totalCount * fileSize) / streamPosition);
            console.log(`📈 Estimated total funds: ${this.database.totalFunds}`);
          }
          
          // Skip already processed funds
          if (skipCount > 0) {
            skipCount--;
            continue;
          }
          
          // Process this fund
          const shouldContinue = processor(result.fund);
          if (!shouldContinue) {
            break;
          }
        }
      });
      
      stream.on('end', () => {
        if (this.database.totalFunds === 0) {
          this.database.totalFunds = totalCount;
        }
        console.log(`✅ Stream processing complete. Total found: ${totalCount}`);
        resolve();
      });
      
      stream.on('error', reject);
    });
  }
  
  private extractNextFund(buffer: string): { fund: FundRecord | null; remaining: string } {
    // Find next complete JSON object
    let braceCount = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        if (braceCount === 0) start = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && start !== -1) {
          // Found complete object
          const jsonStr = buffer.substring(start, i + 1);
          const remaining = buffer.substring(i + 1);
          
          try {
            const fund = JSON.parse(jsonStr) as FundRecord;
            if (fund.schemeCode && fund.schemeName) {
              return { fund, remaining };
            }
          } catch {
            // Skip invalid JSON
          }
          
          start = -1;
        }
      }
    }
    
    return { fund: null, remaining: buffer };
  }
  
  private processSingleFund(fund: FundRecord): ProcessedFund | null {
    try {
      const name = fund.schemeName.toLowerCase();
      
      const processed: ProcessedFund = {
        ...fund,
        id: `fund_${fund.schemeCode}`,
        fundHouse: this.extractFundHouse(name),
        category: this.extractCategory(name).category,
        subCategory: this.extractCategory(name).subCategory,
        plan: name.includes('direct') ? 'Direct' : 'Regular',
        riskLevel: this.calculateRiskLevel(name),
        searchTokens: this.generateSearchTokens(fund.schemeName),
        lastProcessed: new Date().toISOString(),
        isActive: true
      };
      
      return processed;
    } catch (error) {
      console.warn(`⚠️ Failed to process fund ${fund.schemeCode}:`, error);
      return null;
    }
  }
  
  private indexFund(fund: ProcessedFund): void {
    // Add to main database
    this.database.funds.set(fund.schemeCode, fund);
    
    // Build search index
    fund.searchTokens.forEach(token => {
      if (!this.database.searchIndex.has(token)) {
        this.database.searchIndex.set(token, new Set());
      }
      this.database.searchIndex.get(token)!.add(fund.schemeCode);
    });
    
    // Build category index
    if (!this.database.categories.has(fund.category)) {
      this.database.categories.set(fund.category, new Set());
    }
    this.database.categories.get(fund.category)!.add(fund.schemeCode);
    
    // Build fund house index
    if (!this.database.fundHouses.has(fund.fundHouse)) {
      this.database.fundHouses.set(fund.fundHouse, new Set());
    }
    this.database.fundHouses.get(fund.fundHouse)!.add(fund.schemeCode);
  }
  
  private extractFundHouse(name: string): string {
    const patterns = [
      { pattern: /\b(sbi|state bank)\b/, house: 'SBI Mutual Fund' },
      { pattern: /\bhdfc\b/, house: 'HDFC Mutual Fund' },
      { pattern: /\bicici\b/, house: 'ICICI Prudential Mutual Fund' },
      { pattern: /\baxis\b/, house: 'Axis Mutual Fund' },
      { pattern: /\bkotak\b/, house: 'Kotak Mahindra Mutual Fund' },
    ];
    
    for (const { pattern, house } of patterns) {
      if (pattern.test(name)) return house;
    }
    
    return 'Others';
  }
  
  private extractCategory(name: string): { category: string; subCategory: string } {
    if (name.includes('equity') || name.includes('cap')) {
      return { category: 'Equity', subCategory: 'Multi Cap' };
    }
    if (name.includes('debt') || name.includes('income')) {
      return { category: 'Debt', subCategory: 'Medium Duration' };
    }
    if (name.includes('hybrid') || name.includes('balanced')) {
      return { category: 'Hybrid', subCategory: 'Balanced' };
    }
    return { category: 'Others', subCategory: 'Miscellaneous' };
  }
  
  private calculateRiskLevel(name: string): number {
    if (name.includes('liquid')) return 1;
    if (name.includes('debt')) return 2;
    if (name.includes('hybrid')) return 3;
    if (name.includes('equity')) return 4;
    if (name.includes('small cap')) return 5;
    return 3;
  }
  
  private generateSearchTokens(schemeName: string): string[] {
    const tokens = schemeName.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
    
    return [...new Set(tokens)];
  }
  
  // Update only current NAV data - no historical reprocessing needed
  async updateCurrentNAV(schemeCode: number, nav: number, date: string): Promise<void> {
    const currentNav = this.database.navData.get(schemeCode);
    const change = currentNav ? nav - currentNav.nav : 0;
    const changePercent = currentNav ? (change / currentNav.nav) * 100 : 0;
    
    this.database.navData.set(schemeCode, {
      schemeCode,
      nav,
      date,
      change,
      changePercent
    });
    
    // Save NAV cache separately (lightweight)
    this.saveNAVCache();
  }
  
  private saveNAVCache(): void {
    try {
      const navData = Array.from(this.database.navData.entries());
      writeFileSync(this.navCacheFile, JSON.stringify(navData));
    } catch (error) {
      console.warn('⚠️ Failed to save NAV cache:', error);
    }
  }
  
  // Quick search without reprocessing
  search(query: string, limit = 20): ProcessedFund[] {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const matchingCodes = new Set<number>();
    
    queryTokens.forEach(token => {
      this.database.searchIndex.forEach((codes, indexToken) => {
        if (indexToken.includes(token) || token.includes(indexToken)) {
          codes.forEach(code => matchingCodes.add(code));
        }
      });
    });
    
    const results: ProcessedFund[] = [];
    matchingCodes.forEach(code => {
      const fund = this.database.funds.get(code);
      if (fund && results.length < limit) {
        results.push(fund);
      }
    });
    
    return results;
  }
  
  // Get statistics without reprocessing
  getStatistics(): {
    totalFunds: number;
    processedFunds: number;
    progress: number;
    categories: Record<string, number>;
    fundHouses: Record<string, number>;
    lastUpdated: string;
  } {
    const categories: Record<string, number> = {};
    this.database.categories.forEach((codes, category) => {
      categories[category] = codes.size;
    });
    
    const fundHouses: Record<string, number> = {};
    this.database.fundHouses.forEach((codes, house) => {
      fundHouses[house] = codes.size;
    });
    
    return {
      totalFunds: this.database.totalFunds,
      processedFunds: this.database.processedCount,
      progress: (this.database.processedCount / Math.max(this.database.totalFunds, 1)) * 100,
      categories,
      fundHouses,
      lastUpdated: this.database.lastUpdated
    };
  }
}

// Singleton instance
let loader: IncrementalFundLoader | null = null;

export function getIncrementalLoader(): IncrementalFundLoader {
  if (!loader) {
    loader = new IncrementalFundLoader();
  }
  return loader;
}

export type { ProcessedFund, LiveNAVData };