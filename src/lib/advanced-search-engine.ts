/**
 * Advanced Search Engine with Memory-Efficient Processing
 * Handles large datasets without memory overflow using streaming and indexing
 */

import { createReadStream } from 'fs';
import { join } from 'path';

interface FundRecord {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
}

interface ProcessedFund {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  subCategory: string;
  plan: "Direct" | "Regular";
  option: "Growth" | "IDCW Payout" | "IDCW Reinvestment";
  riskLevel: string;
  searchTokens: string[];
  searchScore?: number;
}

interface SearchFilters {
  searchText?: string;
  fundHouse?: string[];
  category?: string[];
  plan?: string[];
  riskLevel?: string[];
  limit?: number;
  offset?: number;
}

interface SearchResult {
  funds: ProcessedFund[];
  total: number;
  hasMore: boolean;
  searchTime: number;
  fromCache: boolean;
}

class AdvancedFundSearchEngine {
  private indexedFunds: Map<string, ProcessedFund> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map(); // token -> scheme codes
  private categoryIndex: Map<string, Set<string>> = new Map();
  private fundHouseIndex: Map<string, Set<string>> = new Map();
  private isIndexed = false;
  private indexingPromise: Promise<void> | null = null;
  
  // Memory-efficient streaming JSON parser
  private async streamProcessFunds(): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = join(process.cwd(), 'public', 'Funds_Schema.json');
      let buffer = '';
      let inArray = false;
      let braceCount = 0;
      let fundCount = 0;
      
      console.log('🚀 Starting memory-efficient fund indexing...');
      
      const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 }); // 64KB chunks
      
      stream.on('data', (chunk: string | Buffer | Buffer) => {
        buffer += chunk.toString();
        
        // Process complete JSON objects
        while (buffer.length > 0) {
          if (!inArray && buffer.includes('[')) {
            buffer = buffer.substring(buffer.indexOf('[') + 1);
            inArray = true;
            continue;
          }
          
          if (inArray) {
            const openBrace = buffer.indexOf('{');
            if (openBrace === -1) break;
            
            const start = openBrace;
            braceCount = 0;
            let end = start;
            
            // Find complete JSON object
            for (let i = start; i < buffer.length; i++) {
              if (buffer[i] === '{') braceCount++;
              else if (buffer[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  end = i + 1;
                  break;
                }
              }
            }
            
            if (braceCount === 0) {
              const jsonStr = buffer.substring(start, end);
              buffer = buffer.substring(end);
              
              try {
                const fund: FundRecord = JSON.parse(jsonStr);
                this.indexFund(fund);
                fundCount++;
                
                // Log progress every 5000 funds
                if (fundCount % 5000 === 0) {
                  console.log(`📊 Indexed ${fundCount} funds...`);
                }
              } catch (error) {
                console.warn('⚠️ Skipping invalid fund record:', error);
              }
            } else {
              break; // Wait for more data
            }
          }
        }
      });
      
      stream.on('end', () => {
        console.log(`✅ Indexing complete! Processed ${fundCount} funds`);
        console.log(`📈 Search index size: ${this.searchIndex.size} tokens`);
        console.log(`🏢 Fund houses: ${this.fundHouseIndex.size}`);
        console.log(`📂 Categories: ${this.categoryIndex.size}`);
        this.isIndexed = true;
        resolve();
      });
      
      stream.on('error', reject);
    });
  }
  
  private indexFund(fund: FundRecord): void {
    const processed = this.processFund(fund);
    this.indexedFunds.set(processed.schemeCode, processed);
    
    // Index search tokens
    processed.searchTokens.forEach(token => {
      if (!this.searchIndex.has(token)) {
        this.searchIndex.set(token, new Set());
      }
      this.searchIndex.get(token)!.add(processed.schemeCode);
    });
    
    // Index by category
    const category = processed.category;
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, new Set());
    }
    this.categoryIndex.get(category)!.add(processed.schemeCode);
    
    // Index by fund house
    const fundHouse = processed.fundHouse;
    if (!this.fundHouseIndex.has(fundHouse)) {
      this.fundHouseIndex.set(fundHouse, new Set());
    }
    this.fundHouseIndex.get(fundHouse)!.add(processed.schemeCode);
  }
  
  private processFund(fund: FundRecord): ProcessedFund {
    const name = fund.schemeName.toLowerCase();
    
    // Extract fund house with advanced pattern matching
    const fundHouse = this.extractFundHouse(name);
    
    // Advanced category classification
    const { category, subCategory } = this.classifyFund(name);
    
    // Plan and option detection
    const plan = name.includes('direct') ? 'Direct' : 'Regular';
    let option: "Growth" | "IDCW Payout" | "IDCW Reinvestment" = "Growth";
    if (name.includes('dividend') || name.includes('idcw')) {
      option = name.includes('reinvest') ? "IDCW Reinvestment" : "IDCW Payout";
    }
    
    // Risk level estimation
    const riskLevel = this.estimateRiskLevel(category);
    
    // Generate comprehensive search tokens
    const searchTokens = this.generateSearchTokens(fund.schemeName, fundHouse, category, subCategory);
    
    return {
      schemeCode: String(fund.schemeCode),
      schemeName: fund.schemeName,
      fundHouse,
      category,
      subCategory,
      plan,
      option,
      riskLevel,
      searchTokens
    };
  }
  
  private extractFundHouse(name: string): string {
    const patterns = [
      { pattern: /\b(sbi|state bank)\b/, house: 'SBI Mutual Fund' },
      { pattern: /\bhdfc\b/, house: 'HDFC Mutual Fund' },
      { pattern: /\bicici\b/, house: 'ICICI Prudential Mutual Fund' },
      { pattern: /\baxis\b/, house: 'Axis Mutual Fund' },
      { pattern: /\bkotak\b/, house: 'Kotak Mahindra Mutual Fund' },
      { pattern: /\b(aditya birla|birla sun life|absl)\b/, house: 'Aditya Birla Sun Life Mutual Fund' },
      { pattern: /\b(nippon|reliance)\b/, house: 'Nippon India Mutual Fund' },
      { pattern: /\bfranklin\b/, house: 'Franklin Templeton Mutual Fund' },
      { pattern: /\bdsp\b/, house: 'DSP Mutual Fund' },
      { pattern: /\bl&t\b/, house: 'L&T Mutual Fund' },
      { pattern: /\bmirae\b/, house: 'Mirae Asset Mutual Fund' },
      { pattern: /\buti\b/, house: 'UTI Mutual Fund' },
      { pattern: /\b(parag parikh|ppfas)\b/, house: 'PPFAS Mutual Fund' },
      { pattern: /\bmotilal\b/, house: 'Motilal Oswal Mutual Fund' },
      { pattern: /\binvesco\b/, house: 'Invesco Mutual Fund' },
      { pattern: /\btata\b/, house: 'Tata Mutual Fund' },
      { pattern: /\bmahindra\b/, house: 'Mahindra Mutual Fund' },
      { pattern: /\bcanara\b/, house: 'Canara Robeco Mutual Fund' },
      { pattern: /\bquant\b/, house: 'Quant Mutual Fund' },
      { pattern: /\bsundaram\b/, house: 'Sundaram Mutual Fund' }
    ];
    
    for (const { pattern, house } of patterns) {
      if (pattern.test(name)) return house;
    }
    
    return 'Others';
  }
  
  private classifyFund(name: string): { category: string; subCategory: string } {
    const equityPatterns = [
      { pattern: /\b(large cap|bluechip|top 100|large & mid cap)\b/, category: 'Equity', subCategory: 'Large Cap' },
      { pattern: /\b(mid cap|midcap)\b/, category: 'Equity', subCategory: 'Mid Cap' },
      { pattern: /\b(small cap|smallcap)\b/, category: 'Equity', subCategory: 'Small Cap' },
      { pattern: /\b(flexi cap|flexicap)\b/, category: 'Equity', subCategory: 'Flexi Cap' },
      { pattern: /\b(multi cap|multicap)\b/, category: 'Equity', subCategory: 'Multi Cap' },
      { pattern: /\b(elss|tax|80c)\b/, category: 'Equity', subCategory: 'ELSS' },
      { pattern: /\b(focused|focus)\b/, category: 'Equity', subCategory: 'Focused' },
      { pattern: /\b(value|contra)\b/, category: 'Equity', subCategory: 'Value/Contra' },
      { pattern: /\bdividend yield\b/, category: 'Equity', subCategory: 'Dividend Yield' },
      { pattern: /\b(sectoral|thematic|pharma|it|bank|infra|psu|defence|manufacturing)\b/, category: 'Equity', subCategory: 'Sectoral/Thematic' }
    ];
    
    const debtPatterns = [
      { pattern: /\bliquid\b/, category: 'Debt', subCategory: 'Liquid' },
      { pattern: /\b(ultra short|ultrashort)\b/, category: 'Debt', subCategory: 'Ultra Short' },
      { pattern: /\b(short duration|short term)\b/, category: 'Debt', subCategory: 'Short Duration' },
      { pattern: /\b(medium duration|medium term)\b/, category: 'Debt', subCategory: 'Medium Duration' },
      { pattern: /\b(long duration|long term|gilt)\b/, category: 'Debt', subCategory: 'Long Duration' },
      { pattern: /\b(corporate bond|credit)\b/, category: 'Debt', subCategory: 'Corporate Bond' },
      { pattern: /\b(dynamic bond|duration)\b/, category: 'Debt', subCategory: 'Dynamic Bond' }
    ];
    
    const hybridPatterns = [
      { pattern: /\b(conservative hybrid|monthly income)\b/, category: 'Hybrid', subCategory: 'Conservative Hybrid' },
      { pattern: /\b(aggressive hybrid|balanced advantage|balanced)\b/, category: 'Hybrid', subCategory: 'Balanced/Aggressive Hybrid' },
      { pattern: /\barbitrage\b/, category: 'Hybrid', subCategory: 'Arbitrage' }
    ];
    
    // Check equity patterns
    for (const { pattern, category, subCategory } of equityPatterns) {
      if (pattern.test(name)) return { category, subCategory };
    }
    
    // Check debt patterns
    for (const { pattern, category, subCategory } of debtPatterns) {
      if (pattern.test(name)) return { category, subCategory };
    }
    
    // Check hybrid patterns
    for (const { pattern, category, subCategory } of hybridPatterns) {
      if (pattern.test(name)) return { category, subCategory };
    }
    
    // Index funds and ETFs
    if (/\b(index|nifty|sensex|etf)\b/.test(name)) {
      return { category: 'Others', subCategory: 'Index Fund/ETF' };
    }
    
    // Default classification
    if (/\b(equity|growth|opportunities)\b/.test(name)) {
      return { category: 'Equity', subCategory: 'Multi Cap' };
    }
    
    if (/\b(income|debt|bond)\b/.test(name)) {
      return { category: 'Debt', subCategory: 'Medium Duration' };
    }
    
    return { category: 'Others', subCategory: 'Miscellaneous' };
  }
  
  private estimateRiskLevel(category: string): string {
    const riskMapping = {
      'Equity': 'High',
      'Debt': 'Low to Moderate',
      'Hybrid': 'Moderate',
      'Others': 'Varies'
    };
    
    return riskMapping[category as keyof typeof riskMapping] || 'Moderate';
  }
  
  private generateSearchTokens(schemeName: string, fundHouse: string, category: string, subCategory: string): string[] {
    const tokens = new Set<string>();
    
    // Scheme name tokens
    const nameTokens = schemeName.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
    
    nameTokens.forEach(token => tokens.add(token));
    
    // Fund house tokens
    fundHouse.toLowerCase().split(/\s+/).forEach(token => {
      if (token.length > 1) tokens.add(token);
    });
    
    // Category tokens
    category.toLowerCase().split(/\s+/).forEach(token => tokens.add(token));
    subCategory.toLowerCase().split(/\s+/).forEach(token => tokens.add(token));
    
    // Generate partial matches (for prefix search)
    const mainTokens = Array.from(tokens);
    mainTokens.forEach(token => {
      if (token.length >= 3) {
        for (let i = 3; i <= Math.min(token.length, 6); i++) {
          tokens.add(token.substring(0, i));
        }
      }
    });
    
    return Array.from(tokens);
  }
  
  // Advanced search with multiple algorithms
  async search(filters: SearchFilters): Promise<SearchResult> {
    const startTime = Date.now();
    
    // Ensure indexing is complete
    await this.ensureIndexed();
    
    let candidateSchemes = new Set<string>();
    let searchText = '';
    
    if (filters.searchText) {
      searchText = filters.searchText.toLowerCase().trim();
      candidateSchemes = this.performTextSearch(searchText);
    } else {
      // If no search text, start with all funds
      candidateSchemes = new Set(this.indexedFunds.keys());
    }
    
    // Apply filters
    candidateSchemes = this.applyFilters(candidateSchemes, filters);
    
    // Convert to fund objects and calculate scores
    let results = Array.from(candidateSchemes)
      .map(schemeCode => this.indexedFunds.get(schemeCode)!)
      .filter(fund => fund !== undefined);
    
    // Calculate search scores if text search was performed
    if (searchText) {
      results = results.map(fund => ({
        ...fund,
        searchScore: this.calculateSearchScore(fund, searchText)
      }));
      
      // Sort by search score
      results.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
    } else {
      // Sort alphabetically by name
      results.sort((a, b) => a.schemeName.localeCompare(b.schemeName));
    }
    
    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    
    const searchTime = Date.now() - startTime;
    
    return {
      funds: paginatedResults,
      total,
      hasMore: offset + limit < total,
      searchTime,
      fromCache: this.isIndexed
    };
  }
  
  private performTextSearch(searchText: string): Set<string> {
    const searchTokens = searchText.split(/\s+/).filter(token => token.length > 0);
    const matchingSchemeCodes = new Set<string>();
    
    // For each search token, find matching funds
    searchTokens.forEach(token => {
      // Exact matches
      if (this.searchIndex.has(token)) {
        this.searchIndex.get(token)!.forEach(code => matchingSchemeCodes.add(code));
      }
      
      // Prefix matches
      this.searchIndex.forEach((codes, indexToken) => {
        if (indexToken.startsWith(token) || token.startsWith(indexToken)) {
          codes.forEach(code => matchingSchemeCodes.add(code));
        }
      });
      
      // Fuzzy matches (Levenshtein distance <= 1 for tokens >= 4 chars)
      if (token.length >= 4) {
        this.searchIndex.forEach((codes, indexToken) => {
          if (this.levenshteinDistance(token, indexToken) <= 1) {
            codes.forEach(code => matchingSchemeCodes.add(code));
          }
        });
      }
    });
    
    return matchingSchemeCodes;
  }
  
  private applyFilters(candidateSchemes: Set<string>, filters: SearchFilters): Set<string> {
    let filteredSchemes = candidateSchemes;
    
    // Fund house filter
    if (filters.fundHouse && filters.fundHouse.length > 0) {
      const fundHouseSchemes = new Set<string>();
      filters.fundHouse.forEach(house => {
        if (this.fundHouseIndex.has(house)) {
          this.fundHouseIndex.get(house)!.forEach(code => {
            if (filteredSchemes.has(code)) {
              fundHouseSchemes.add(code);
            }
          });
        }
      });
      filteredSchemes = fundHouseSchemes;
    }
    
    // Category filter
    if (filters.category && filters.category.length > 0) {
      const categorySchemes = new Set<string>();
      filters.category.forEach(cat => {
        if (this.categoryIndex.has(cat)) {
          this.categoryIndex.get(cat)!.forEach(code => {
            if (filteredSchemes.has(code)) {
              categorySchemes.add(code);
            }
          });
        }
      });
      filteredSchemes = categorySchemes;
    }
    
    // Plan filter (requires checking individual funds)
    if (filters.plan && filters.plan.length > 0) {
      filteredSchemes = new Set(Array.from(filteredSchemes).filter(code => {
        const fund = this.indexedFunds.get(code);
        return fund && filters.plan!.includes(fund.plan);
      }));
    }
    
    // Risk level filter
    if (filters.riskLevel && filters.riskLevel.length > 0) {
      filteredSchemes = new Set(Array.from(filteredSchemes).filter(code => {
        const fund = this.indexedFunds.get(code);
        return fund && filters.riskLevel!.includes(fund.riskLevel);
      }));
    }
    
    return filteredSchemes;
  }
  
  private calculateSearchScore(fund: ProcessedFund, searchText: string): number {
    const searchTokens = searchText.split(/\s+/);
    let score = 0;
    
    searchTokens.forEach(token => {
      const lowerSchemeName = fund.schemeName.toLowerCase();
      const lowerFundHouse = fund.fundHouse.toLowerCase();
      
      // Exact matches get highest score
      if (lowerSchemeName === token) score += 100;
      else if (lowerSchemeName.startsWith(token)) score += 50;
      else if (lowerSchemeName.includes(token)) score += 25;
      
      // Fund house matches
      if (lowerFundHouse.includes(token)) score += 15;
      
      // Category matches
      if (fund.category.toLowerCase().includes(token)) score += 10;
      if (fund.subCategory.toLowerCase().includes(token)) score += 10;
    });
    
    return score;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;
    
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  private async ensureIndexed(): Promise<void> {
    if (this.isIndexed) return;
    
    if (this.indexingPromise) {
      return this.indexingPromise;
    }
    
    this.indexingPromise = this.streamProcessFunds();
    return this.indexingPromise;
  }
  
  // Get search suggestions
  async getSuggestions(query: string, limit = 10): Promise<string[]> {
    await this.ensureIndexed();
    
    const queryLower = query.toLowerCase();
    const suggestions = new Set<string>();
    
    // Get suggestions from search index tokens
    this.searchIndex.forEach((codes, token) => {
      if (token.startsWith(queryLower) && suggestions.size < limit * 2) {
        suggestions.add(token);
      }
    });
    
    // Get fund house suggestions
    this.fundHouseIndex.forEach((codes, fundHouse) => {
      if (fundHouse.toLowerCase().includes(queryLower) && suggestions.size < limit * 2) {
        suggestions.add(fundHouse);
      }
    });
    
    return Array.from(suggestions).slice(0, limit);
  }
  
  // Get analytics
  async getAnalytics(): Promise<{
    totalFunds: number;
    categories: Record<string, number>;
    fundHouses: Record<string, number>;
    topFundHouses: Array<{ name: string; count: number }>;
  }> {
    await this.ensureIndexed();
    
    const categories: Record<string, number> = {};
    const fundHouses: Record<string, number> = {};
    
    // Count by category
    this.categoryIndex.forEach((codes, category) => {
      categories[category] = codes.size;
    });
    
    // Count by fund house
    this.fundHouseIndex.forEach((codes, fundHouse) => {
      fundHouses[fundHouse] = codes.size;
    });
    
    // Top fund houses
    const topFundHouses = Object.entries(fundHouses)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalFunds: this.indexedFunds.size,
      categories,
      fundHouses,
      topFundHouses
    };
  }
}

// Singleton instance
let searchEngine: AdvancedFundSearchEngine | null = null;

export function getSearchEngine(): AdvancedFundSearchEngine {
  if (!searchEngine) {
    searchEngine = new AdvancedFundSearchEngine();
  }
  return searchEngine;
}

export type { SearchFilters, SearchResult, ProcessedFund };