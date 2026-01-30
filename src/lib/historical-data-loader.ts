/**
 * Historical Data Loader using MF API
 * Fetches all historical data for funds using api.mfapi.in
 * Phase 1: Load all historical data once (one-by-one)
 * Phase 2: Only fetch latest data for updates
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface FundScheme {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
  fundHouse?: string;
  category?: string;
  subCategory?: string;
  plan?: string;
}

interface HistoricalNAV {
  date: string;
  nav: string;
}

interface MFAPIHistoricalResponse {
  meta: {
    scheme_code: string;
    scheme_name: string;
    scheme_category: string;
    scheme_type: string;
    fund_house: string;
  };
  data: HistoricalNAV[];
  status: string;
}

interface MFAPILatestResponse {
  meta: {
    scheme_code: string;
    scheme_name: string;
    scheme_category: string;
    scheme_type: string;
    fund_house: string;
  };
  data: HistoricalNAV[];
  status: string;
}

interface ProcessedFundData {
  schemeCode: number;
  schemeName: string;
  fundHouse: string;
  category: string;
  subCategory: string;
  plan: string;
  
  // Historical NAV data
  navHistory: HistoricalNAV[];
  
  // Calculated metrics
  currentNAV: number;
  previousNAV: number;
  dailyChange: number;
  dailyChangePercent: number;
  
  // Returns calculations
  returns1D: number;
  returns1W: number;
  returns1M: number;
  returns3M: number;
  returns6M: number;
  returns1Y: number;
  returns3Y: number;
  returns5Y: number;
  
  // Risk metrics
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  
  // Meta
  lastUpdated: string;
  totalRecords: number;
  isActive: boolean;
}

interface LoaderProgress {
  currentScheme: number;
  totalSchemes: number;
  processedSchemes: number;
  failedSchemes: number;
  currentSchemeName: string;
  phase: 'HISTORICAL' | 'LATEST' | 'COMPLETE';
  startTime: string;
  estimatedCompletion?: string;
  errors: { schemeCode: number; error: string }[];
}

class HistoricalDataLoader {
  private cacheDir = join(process.cwd(), '.cache');
  private progressFile = join(this.cacheDir, 'loader-progress.json');
  private dataDir = join(this.cacheDir, 'historical-data');
  private errorLogFile = join(this.cacheDir, 'error-log.json');
  
  private schemes: FundScheme[] = [];
  private progress: LoaderProgress;
  private isLoading = false;
  
  // Rate limiting - be more conservative with API
  private requestDelay = 2000; // 2 seconds between requests
  private maxRetries = 5; // Increased retries
  private maxConcurrentRequests = 1; // Only one request at a time
  
  constructor() {
    this.ensureDirectories();
    this.loadSchemes();
    this.progress = this.loadProgress();
  }
  
  private ensureDirectories(): void {
    [this.cacheDir, this.dataDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  private loadSchemes(): void {
    try {
      const schemaPath = join(process.cwd(), 'public', 'Funds_Schema.json');
      if (existsSync(schemaPath)) {
        console.log('📊 Loading schemes with streaming parser...');
        this.schemes = this.parseJsonStreamingly(schemaPath);
        console.log(`✅ Loaded ${this.schemes.length} schemes from local file`);
      } else {
        console.log('📥 No local schema found, will fetch from API');
        this.schemes = [];
      }
    } catch (error) {
      console.error('❌ Error loading schemes:', error);
      this.schemes = [];
    }
  }
  
  private parseJsonStreamingly(filePath: string): FundScheme[] {
    try {
      const fileContent = readFileSync(filePath, 'utf8');
      const fileSize = fileContent.length;
      console.log(`📁 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      // For large files, use streaming approach
      if (fileSize > 10 * 1024 * 1024) { // > 10MB
        console.log('🔄 Using streaming parser for large file...');
        return this.streamParseJson(fileContent);
      }
      
      // For smaller files, use regular JSON.parse
      console.log('⚡ Using standard JSON parser...');
      const parsed = JSON.parse(fileContent);
      return Array.isArray(parsed) ? parsed : [parsed];
      
    } catch (error) {
      console.error('❌ JSON parsing failed:', error);
      return [];
    }
  }
  
  private streamParseJson(content: string): FundScheme[] {
    const schemes: FundScheme[] = [];
    let buffer = '';
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let objectStart = -1;
    
    console.log('🔄 Starting streaming JSON parse...');
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      buffer += char;
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        if (braceCount === 0) {
          objectStart = buffer.length - 1;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && objectStart !== -1) {
          try {
            // Extract and parse the complete object
            const objectStr = buffer.substring(objectStart);
            const fundObject = JSON.parse(objectStr);
            
            if (fundObject.schemeCode && fundObject.schemeName) {
              schemes.push({
                schemeCode: fundObject.schemeCode,
                schemeName: fundObject.schemeName,
                isinGrowth: fundObject.isinGrowth,
                isinDivReinvestment: fundObject.isinDivReinvestment,
                fundHouse: this.extractFundHouse(fundObject.schemeName),
                category: this.extractCategory(fundObject.schemeName),
                subCategory: this.extractSubCategory(fundObject.schemeName),
                plan: fundObject.schemeName.toLowerCase().includes('direct') ? 'Direct' : 'Regular'
              });
            }
            
            // Progress feedback
            if (schemes.length % 1000 === 0) {
              console.log(`📊 Parsed ${schemes.length} schemes so far...`);
            }
            
          } catch {
            // Skip invalid objects
            console.warn(`⚠️ Skipped invalid object at position ${i}`);
          }
          
          // Reset for next object
          buffer = '';
          objectStart = -1;
        }
      }
    }
    
    console.log(`✅ Streaming parse complete: ${schemes.length} schemes`);
    return schemes;
  }
  
  private loadProgress(): LoaderProgress {
    if (existsSync(this.progressFile)) {
      try {
        return JSON.parse(readFileSync(this.progressFile, 'utf8'));
      } catch {
        console.warn('⚠️ Progress file corrupted, starting fresh');
      }
    }
    
    return {
      currentScheme: 0,
      totalSchemes: this.schemes.length,
      processedSchemes: 0,
      failedSchemes: 0,
      currentSchemeName: '',
      phase: 'HISTORICAL',
      startTime: new Date().toISOString(),
      errors: []
    };
  }
  
  private saveProgress(): void {
    try {
      writeFileSync(this.progressFile, JSON.stringify(this.progress, null, 2));
    } catch (error) {
      console.error('❌ Failed to save progress:', error);
    }
  }
  
  // Fetch all scheme codes from MF API if needed
  async fetchAllSchemes(): Promise<FundScheme[]> {
    try {
      console.log('🌐 Fetching all schemes from MF API...');
      const response = await fetch('https://api.mfapi.in/mf');
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const schemes = await response.json();
      console.log(`✅ Fetched ${schemes.length} schemes from API`);
      
      // Save to local file for future use
      const schemaPath = join(process.cwd(), 'public', 'MF_API_Schemes.json');
      writeFileSync(schemaPath, JSON.stringify(schemes, null, 2));
      
      return schemes.map((scheme: { schemeCode: string; schemeName: string }) => ({
        schemeCode: parseInt(scheme.schemeCode),
        schemeName: scheme.schemeName,
        fundHouse: this.extractFundHouse(scheme.schemeName),
        category: this.extractCategory(scheme.schemeName),
        subCategory: this.extractSubCategory(scheme.schemeName),
        plan: scheme.schemeName.toLowerCase().includes('direct') ? 'Direct' : 'Regular'
      }));
      
    } catch (error) {
      console.error('❌ Failed to fetch schemes from API:', error);
      throw error;
    }
  }
  
  // Fetch historical data for a single scheme
  async fetchHistoricalData(schemeCode: number, retryCount = 0): Promise<MFAPIHistoricalResponse | null> {
    try {
      console.log(`📈 Fetching historical data for scheme ${schemeCode}...`);
      
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
        headers: {
          'User-Agent': 'VijayMalik-Financial-Platform/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️ Scheme ${schemeCode} not found (404)`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: MFAPIHistoricalResponse = await response.json();
      
      if (data.status !== 'SUCCESS') {
        throw new Error(`API Status: ${data.status}`);
      }
      
      console.log(`✅ Fetched ${data.data.length} historical records for ${data.meta.scheme_name}`);
      return data;
      
    } catch (error) {
      console.error(`❌ Error fetching scheme ${schemeCode}:`, error);
      
      if (retryCount < this.maxRetries) {
        console.log(`🔄 Retrying ${schemeCode} (${retryCount + 1}/${this.maxRetries})...`);
        await this.delay(this.requestDelay * 2); // Longer delay for retries
        return this.fetchHistoricalData(schemeCode, retryCount + 1);
      }
      
      return null;
    }
  }
  
  // Fetch only latest NAV for a single scheme
  async fetchLatestData(schemeCode: number): Promise<MFAPILatestResponse | null> {
    try {
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: MFAPILatestResponse = await response.json();
      return data.status === 'SUCCESS' ? data : null;
      
    } catch (error) {
      console.error(`❌ Error fetching latest for scheme ${schemeCode}:`, error);
      return null;
    }
  }
  
  // Calculate all financial metrics
  private calculateMetrics(navHistory: HistoricalNAV[]): Partial<ProcessedFundData> {
    if (navHistory.length < 2) {
      return {
        currentNAV: parseFloat(navHistory[0]?.nav || '0'),
        previousNAV: 0,
        dailyChange: 0,
        dailyChangePercent: 0,
        returns1D: 0, returns1W: 0, returns1M: 0, returns3M: 0,
        returns6M: 0, returns1Y: 0, returns3Y: 0, returns5Y: 0,
        volatility: 0, sharpeRatio: 0, maxDrawdown: 0
      };
    }
    
    // Sort by date (newest first)
    const sortedHistory = [...navHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    const currentNAV = parseFloat(sortedHistory[0].nav);
    const previousNAV = parseFloat(sortedHistory[1]?.nav || sortedHistory[0].nav);
    
    const dailyChange = currentNAV - previousNAV;
    const dailyChangePercent = (dailyChange / previousNAV) * 100;
    
    // Calculate returns for different periods
    const returns = this.calculateReturns(sortedHistory);
    const riskMetrics = this.calculateRiskMetrics(sortedHistory);
    
    return {
      currentNAV,
      previousNAV,
      dailyChange,
      dailyChangePercent,
      ...returns,
      ...riskMetrics
    };
  }
  
  private calculateReturns(sortedHistory: HistoricalNAV[]): {
    returns1D: number; returns1W: number; returns1M: number; returns3M: number;
    returns6M: number; returns1Y: number; returns3Y: number; returns5Y: number;
  } {
    const currentNAV = parseFloat(sortedHistory[0].nav);
    const now = new Date();
    
    const findNAVByDate = (daysBack: number): number => {
      const targetDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const closestNav = sortedHistory.find(nav => 
        new Date(nav.date) <= targetDate
      );
      return parseFloat(closestNav?.nav || sortedHistory[sortedHistory.length - 1].nav);
    };
    
    const calculateReturn = (oldNAV: number): number => {
      return oldNAV > 0 ? ((currentNAV - oldNAV) / oldNAV) * 100 : 0;
    };
    
    return {
      returns1D: calculateReturn(parseFloat(sortedHistory[1]?.nav || currentNAV.toString())),
      returns1W: calculateReturn(findNAVByDate(7)),
      returns1M: calculateReturn(findNAVByDate(30)),
      returns3M: calculateReturn(findNAVByDate(90)),
      returns6M: calculateReturn(findNAVByDate(180)),
      returns1Y: calculateReturn(findNAVByDate(365)),
      returns3Y: calculateReturn(findNAVByDate(365 * 3)),
      returns5Y: calculateReturn(findNAVByDate(365 * 5))
    };
  }
  
  private calculateRiskMetrics(sortedHistory: HistoricalNAV[]): {
    volatility: number; sharpeRatio: number; maxDrawdown: number;
  } {
    if (sortedHistory.length < 30) {
      return { volatility: 0, sharpeRatio: 0, maxDrawdown: 0 };
    }
    
    // Calculate daily returns
    const dailyReturns: number[] = [];
    for (let i = 0; i < sortedHistory.length - 1; i++) {
      const currentNAV = parseFloat(sortedHistory[i].nav);
      const previousNAV = parseFloat(sortedHistory[i + 1].nav);
      const dailyReturn = (currentNAV - previousNAV) / previousNAV;
      dailyReturns.push(dailyReturn);
    }
    
    // Volatility (annualized standard deviation)
    const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance * 252) * 100; // Annualized
    
    // Sharpe Ratio (assuming risk-free rate of 6%)
    const riskFreeRate = 0.06;
    const annualizedReturn = avgReturn * 252;
    const sharpeRatio = volatility > 0 ? (annualizedReturn - riskFreeRate) / (volatility / 100) : 0;
    
    // Max Drawdown
    let maxDrawdown = 0;
    let peak = parseFloat(sortedHistory[sortedHistory.length - 1].nav);
    
    for (let i = sortedHistory.length - 1; i >= 0; i--) {
      const currentNAV = parseFloat(sortedHistory[i].nav);
      if (currentNAV > peak) {
        peak = currentNAV;
      } else {
        const drawdown = (peak - currentNAV) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return {
      volatility,
      sharpeRatio,
      maxDrawdown: maxDrawdown * 100
    };
  }
  
  // Process single scheme completely
  async processSingleScheme(scheme: FundScheme): Promise<ProcessedFundData | null> {
    try {
      console.log(`\n🔄 Processing ${scheme.schemeName} (${scheme.schemeCode})`);
      
      // Check if already processed
      const cacheFile = join(this.dataDir, `${scheme.schemeCode}.json`);
      if (existsSync(cacheFile)) {
        console.log(`📋 Loading cached data for ${scheme.schemeCode}`);
        return JSON.parse(readFileSync(cacheFile, 'utf8'));
      }
      
      // Fetch historical data
      const historicalData = await this.fetchHistoricalData(scheme.schemeCode);
      if (!historicalData || !historicalData.data.length) {
        throw new Error('No historical data available');
      }
      
      // Calculate metrics
      const metrics = this.calculateMetrics(historicalData.data);
      
      // Create processed fund data
      const processedData: ProcessedFundData = {
        schemeCode: scheme.schemeCode,
        schemeName: historicalData.meta.scheme_name,
        fundHouse: historicalData.meta.fund_house,
        category: historicalData.meta.scheme_category,
        subCategory: historicalData.meta.scheme_type,
        plan: scheme.plan || (scheme.schemeName.toLowerCase().includes('direct') ? 'Direct' : 'Regular'),
        
        navHistory: historicalData.data,
        
        currentNAV: metrics.currentNAV || 0,
        previousNAV: metrics.previousNAV || 0,
        dailyChange: metrics.dailyChange || 0,
        dailyChangePercent: metrics.dailyChangePercent || 0,
        
        returns1D: metrics.returns1D || 0,
        returns1W: metrics.returns1W || 0,
        returns1M: metrics.returns1M || 0,
        returns3M: metrics.returns3M || 0,
        returns6M: metrics.returns6M || 0,
        returns1Y: metrics.returns1Y || 0,
        returns3Y: metrics.returns3Y || 0,
        returns5Y: metrics.returns5Y || 0,
        
        volatility: metrics.volatility || 0,
        sharpeRatio: metrics.sharpeRatio || 0,
        maxDrawdown: metrics.maxDrawdown || 0,
        
        lastUpdated: new Date().toISOString(),
        totalRecords: historicalData.data.length,
        isActive: true
      };
      
      // Cache the processed data
      writeFileSync(cacheFile, JSON.stringify(processedData, null, 2));
      console.log(`💾 Cached processed data for ${scheme.schemeCode}`);
      
      return processedData;
      
    } catch (error) {
      console.error(`❌ Failed to process scheme ${scheme.schemeCode}:`, error);
      this.progress.errors.push({
        schemeCode: scheme.schemeCode,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
  
  // Main loading function - loads all historical data
  async loadAllHistoricalData(batchSize = 10): Promise<LoaderProgress> {
    if (this.isLoading) {
      return this.progress;
    }
    
    this.isLoading = true;
    console.log('🚀 Starting historical data loading process...');
    
    try {
      // Ensure we have schemes
      if (this.schemes.length === 0) {
        console.log('📥 Fetching schemes from API...');
        this.schemes = await this.fetchAllSchemes();
        this.progress.totalSchemes = this.schemes.length;
      }
      
      // Process schemes in batches
      const startIndex = this.progress.currentScheme;
      const endIndex = Math.min(startIndex + batchSize, this.schemes.length);
      
      console.log(`📊 Processing schemes ${startIndex + 1} to ${endIndex} of ${this.schemes.length}`);
      
      for (let i = startIndex; i < endIndex; i++) {
        const scheme = this.schemes[i];
        this.progress.currentScheme = i;
        this.progress.currentSchemeName = scheme.schemeName;
        
        console.log(`\n[${i + 1}/${this.schemes.length}] Processing: ${scheme.schemeName}`);
        
        const result = await this.processSingleScheme(scheme);
        if (result) {
          this.progress.processedSchemes++;
          console.log(`✅ Successfully processed ${scheme.schemeCode}`);
        } else {
          this.progress.failedSchemes++;
          console.log(`❌ Failed to process ${scheme.schemeCode}`);
        }
        
        // Save progress
        this.saveProgress();
        
        // Rate limiting
        if (i < endIndex - 1) {
          console.log(`⏳ Waiting ${this.requestDelay}ms before next request...`);
          await this.delay(this.requestDelay);
        }
      }
      
      // Update progress
      this.progress.currentScheme = endIndex;
      
      if (endIndex >= this.schemes.length) {
        this.progress.phase = 'COMPLETE';
        console.log('🎉 Historical data loading complete!');
      }
      
      this.saveProgress();
      return this.progress;
      
    } catch (error) {
      console.error('❌ Historical loading error:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }
  
  // Update only latest NAV data
  async updateLatestData(schemeCodes: number[]): Promise<{ updated: number; failed: number }> {
    console.log(`🔄 Updating latest data for ${schemeCodes.length} schemes...`);
    
    let updated = 0;
    let failed = 0;
    
    for (const schemeCode of schemeCodes) {
      try {
        const latestData = await this.fetchLatestData(schemeCode);
        if (latestData && latestData.data.length > 0) {
          // Update cached file with latest NAV
          const cacheFile = join(this.dataDir, `${schemeCode}.json`);
          if (existsSync(cacheFile)) {
            const cachedData: ProcessedFundData = JSON.parse(readFileSync(cacheFile, 'utf8'));
            
            // Update with latest NAV
            const latestNAV = latestData.data[0];
            cachedData.navHistory.unshift(latestNAV);
            
            // Recalculate metrics
            const newMetrics = this.calculateMetrics(cachedData.navHistory);
            Object.assign(cachedData, newMetrics);
            cachedData.lastUpdated = new Date().toISOString();
            
            // Save updated data
            writeFileSync(cacheFile, JSON.stringify(cachedData, null, 2));
            updated++;
          }
        } else {
          failed++;
        }
        
        await this.delay(100); // Quick delay for latest updates
        
      } catch (error) {
        console.error(`Failed to update ${schemeCode}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Updated ${updated} schemes, ${failed} failed`);
    return { updated, failed };
  }
  
  // Get loader statistics
  getStats(): LoaderProgress & {
    successRate: number;
    estimatedTimeRemaining: string;
    processingSpeed: number;
  } {
    const successRate = this.progress.processedSchemes / Math.max(this.progress.currentScheme, 1) * 100;
    const startTime = new Date(this.progress.startTime).getTime();
    const elapsed = Date.now() - startTime;
    const remaining = this.progress.totalSchemes - this.progress.currentScheme;
    const speed = this.progress.currentScheme / (elapsed / 1000 / 60); // schemes per minute
    const estimatedMinutes = remaining / Math.max(speed, 0.1);
    
    return {
      ...this.progress,
      successRate,
      estimatedTimeRemaining: `${Math.round(estimatedMinutes)} minutes`,
      processingSpeed: speed
    };
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private extractFundHouse(schemeName: string): string {
    const name = schemeName.toLowerCase();
    if (name.includes('sbi')) return 'SBI Mutual Fund';
    if (name.includes('hdfc')) return 'HDFC Mutual Fund';
    if (name.includes('icici')) return 'ICICI Prudential Mutual Fund';
    if (name.includes('axis')) return 'Axis Mutual Fund';
    if (name.includes('kotak')) return 'Kotak Mahindra Mutual Fund';
    if (name.includes('reliance') || name.includes('nippon')) return 'Nippon India Mutual Fund';
    if (name.includes('aditya birla') || name.includes('birla')) return 'Aditya Birla Sun Life Mutual Fund';
    return 'Others';
  }
  
  private extractCategory(schemeName: string): string {
    const name = schemeName.toLowerCase();
    if (name.includes('equity') || name.includes('large cap') || name.includes('mid cap') || name.includes('small cap')) return 'Equity';
    if (name.includes('debt') || name.includes('income') || name.includes('bond')) return 'Debt';
    if (name.includes('hybrid') || name.includes('balanced')) return 'Hybrid';
    if (name.includes('liquid') || name.includes('money market')) return 'Liquid';
    return 'Others';
  }
  
  private extractSubCategory(schemeName: string): string {
    const name = schemeName.toLowerCase();
    if (name.includes('large cap')) return 'Large Cap';
    if (name.includes('mid cap')) return 'Mid Cap';
    if (name.includes('small cap')) return 'Small Cap';
    if (name.includes('multi cap') || name.includes('multicap')) return 'Multi Cap';
    if (name.includes('flexi cap') || name.includes('flexicap')) return 'Flexi Cap';
    if (name.includes('elss')) return 'ELSS';
    if (name.includes('liquid')) return 'Liquid';
    return 'Others';
  }
}

// Singleton instance
let historicalLoader: HistoricalDataLoader | null = null;

export function getHistoricalLoader(): HistoricalDataLoader {
  if (!historicalLoader) {
    historicalLoader = new HistoricalDataLoader();
  }
  return historicalLoader;
}

export type { ProcessedFundData, LoaderProgress };