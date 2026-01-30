/**
 * Enhanced Fund Data Analysis and Search API
 * Provides comprehensive fund data analysis, categorization, and advanced search
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ComprehensiveSearchFilters } from '@/lib/enhanced-dynamodb-schemas';

interface FundSchemaRecord {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
}

interface CategoryAnalysis {
  totalFunds: number;
  fundsByAMC: Record<string, number>;
  fundsByType: Record<string, number>;
  fundsByCategory: Record<string, Record<string, number>>;
  fundsByRisk: Record<string, number>;
  fundsByPlan: Record<string, number>;
  fundsByOption: Record<string, number>;
  internalCategories: {
    styleStrategy: Record<string, number>;
    themeTags: Record<string, number>;
    equityMarketFocus: Record<string, number>;
    debtDurationBucket: Record<string, number>;
    debtCreditQuality: Record<string, number>;
  };
}

interface EnhancedFundData {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  classification: {
    fundType: "Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others";
    sebiCategory: string;
    sebiMainCategory: "Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others";
  };
  planOption: {
    plan: "Direct" | "Regular";
    option: "Growth" | "IDCW Payout" | "IDCW Reinvestment";
  };
  operational: {
    riskOMeter: "Low" | "Low to Moderate" | "Moderate" | "Moderately High" | "High" | "Very High";
    expenseRatio: number;
    minLumpsum: number;
    minSIP: number;
  };
  internalCategory?: {
    styleStrategy?: string[];
    themeTags?: string[];
    equityMarketFocus?: string;
    debtDurationBucket?: string;
    debtCreditQuality?: string;
  };
  searchScore?: number;
}

class FundDataAnalyzer {
  private funds: FundSchemaRecord[] = [];
  private enhancedFunds: EnhancedFundData[] = [];
  
  constructor() {
    this.loadFundsData();
    this.enhanceFundsData();
  }
  
  private loadFundsData(): void {
    try {
      const schemaPath = join(process.cwd(), 'public', 'Funds_Schema.json');
      const schemaData = readFileSync(schemaPath, 'utf-8');
      this.funds = JSON.parse(schemaData);
      console.log(`Loaded ${this.funds.length} funds from schema`);
    } catch (error) {
      console.error('Error loading funds data:', error);
      this.funds = [];
    }
  }
  
  private enhanceFundsData(): void {
    this.enhancedFunds = this.funds.map(fund => this.enrichFundData(fund));
    console.log(`Enhanced ${this.enhancedFunds.length} funds with categorization`);
  }
  
  private enrichFundData(fund: FundSchemaRecord): EnhancedFundData {
    const schemeName = fund.schemeName.toLowerCase();
    
    // Extract fund house
    const fundHouse = this.extractFundHouse(schemeName);
    
    // Determine plan (Direct/Regular)
    const plan = schemeName.includes('direct') ? 'Direct' : 'Regular';
    
    // Determine option (Growth/IDCW)
    let option: "Growth" | "IDCW Payout" | "IDCW Reinvestment" = "Growth";
    if (schemeName.includes('dividend') || schemeName.includes('idcw')) {
      option = schemeName.includes('reinvest') ? "IDCW Reinvestment" : "IDCW Payout";
    }
    
    // Classify fund type and category
    const classification = this.classifyFund(schemeName);
    
    // Generate internal categorization
    const internalCategory = this.generateInternalCategory(schemeName, classification);
    
    // Estimate operational parameters
    const operational = this.estimateOperationalParams(schemeName, classification);
    
    return {
      schemeCode: String(fund.schemeCode),
      schemeName: fund.schemeName,
      fundHouse,
      classification,
      planOption: { plan, option },
      operational,
      internalCategory
    };
  }
  
  private extractFundHouse(schemeName: string): string {
    const name = schemeName.toLowerCase();
    
    if (name.includes('sbi')) return 'SBI Mutual Fund';
    if (name.includes('hdfc')) return 'HDFC Mutual Fund';
    if (name.includes('icici')) return 'ICICI Prudential Mutual Fund';
    if (name.includes('axis')) return 'Axis Mutual Fund';
    if (name.includes('kotak')) return 'Kotak Mahindra Mutual Fund';
    if (name.includes('aditya birla') || name.includes('birla')) return 'Aditya Birla Sun Life Mutual Fund';
    if (name.includes('nippon')) return 'Nippon India Mutual Fund';
    if (name.includes('franklin')) return 'Franklin Templeton Mutual Fund';
    if (name.includes('dsp')) return 'DSP Mutual Fund';
    if (name.includes('l&t')) return 'L&T Mutual Fund';
    if (name.includes('mirae')) return 'Mirae Asset Mutual Fund';
    if (name.includes('uti')) return 'UTI Mutual Fund';
    if (name.includes('parag parikh') || name.includes('ppfas')) return 'PPFAS Mutual Fund';
    if (name.includes('motilal')) return 'Motilal Oswal Mutual Fund';
    if (name.includes('invesco')) return 'Invesco Mutual Fund';
    
    return 'Others';
  }
  
  private classifyFund(schemeName: string): {
    fundType: "Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others";
    sebiCategory: string;
    sebiMainCategory: "Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others";
  } {
    const name = schemeName.toLowerCase();
    
    // Equity classifications
    if (name.includes('large cap') || name.includes('bluechip') || name.includes('top ')) {
      return {
        fundType: "Equity",
        sebiCategory: "Large Cap",
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('mid cap') || name.includes('midcap')) {
      return {
        fundType: "Equity",
        sebiCategory: "Mid Cap", 
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('small cap') || name.includes('smallcap')) {
      return {
        fundType: "Equity",
        sebiCategory: "Small Cap",
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('flexi cap') || name.includes('flexicap')) {
      return {
        fundType: "Equity",
        sebiCategory: "Flexi Cap",
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('multi cap') || name.includes('multicap')) {
      return {
        fundType: "Equity",
        sebiCategory: "Multi Cap",
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('elss') || name.includes('tax')) {
      return {
        fundType: "Equity",
        sebiCategory: "ELSS",
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('focused') || name.includes('focus')) {
      return {
        fundType: "Equity",
        sebiCategory: "Focused",
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('value') || name.includes('contra')) {
      return {
        fundType: "Equity",
        sebiCategory: "Value/Contra",
        sebiMainCategory: "Equity"
      };
    }
    
    if (name.includes('dividend yield')) {
      return {
        fundType: "Equity",
        sebiCategory: "Dividend Yield",
        sebiMainCategory: "Equity"
      };
    }
    
    // Debt classifications
    if (name.includes('liquid')) {
      return {
        fundType: "Debt",
        sebiCategory: "Liquid",
        sebiMainCategory: "Debt"
      };
    }
    
    if (name.includes('ultra short') || name.includes('ultrashort')) {
      return {
        fundType: "Debt",
        sebiCategory: "Ultra Short",
        sebiMainCategory: "Debt"
      };
    }
    
    if (name.includes('short duration') || name.includes('short term')) {
      return {
        fundType: "Debt",
        sebiCategory: "Short Duration",
        sebiMainCategory: "Debt"
      };
    }
    
    if (name.includes('medium duration') || name.includes('medium term')) {
      return {
        fundType: "Debt",
        sebiCategory: "Medium Duration",
        sebiMainCategory: "Debt"
      };
    }
    
    if (name.includes('long duration') || name.includes('long term')) {
      return {
        fundType: "Debt",
        sebiCategory: "Long Duration",
        sebiMainCategory: "Debt"
      };
    }
    
    if (name.includes('gilt')) {
      return {
        fundType: "Debt",
        sebiCategory: "Gilt",
        sebiMainCategory: "Debt"
      };
    }
    
    if (name.includes('corporate bond') || name.includes('corporate')) {
      return {
        fundType: "Debt",
        sebiCategory: "Corporate Bond",
        sebiMainCategory: "Debt"
      };
    }
    
    // Hybrid classifications
    if (name.includes('conservative hybrid') || name.includes('balanced advantage')) {
      return {
        fundType: "Hybrid",
        sebiCategory: "Conservative Hybrid",
        sebiMainCategory: "Hybrid"
      };
    }
    
    if (name.includes('aggressive hybrid') || name.includes('balanced')) {
      return {
        fundType: "Hybrid",
        sebiCategory: "Balanced/Aggressive Hybrid",
        sebiMainCategory: "Hybrid"
      };
    }
    
    if (name.includes('arbitrage')) {
      return {
        fundType: "Hybrid",
        sebiCategory: "Arbitrage",
        sebiMainCategory: "Hybrid"
      };
    }
    
    // Solution Oriented
    if (name.includes('retirement') || name.includes('pension')) {
      return {
        fundType: "Solution Oriented",
        sebiCategory: "Retirement",
        sebiMainCategory: "Solution Oriented"
      };
    }
    
    if (name.includes('children') || name.includes('child')) {
      return {
        fundType: "Solution Oriented",
        sebiCategory: "Children's",
        sebiMainCategory: "Solution Oriented"
      };
    }
    
    // Others
    if (name.includes('index') || name.includes('nifty') || name.includes('sensex')) {
      return {
        fundType: "Others",
        sebiCategory: "Index Fund",
        sebiMainCategory: "Others"
      };
    }
    
    if (name.includes('etf')) {
      return {
        fundType: "Others",
        sebiCategory: "ETF",
        sebiMainCategory: "Others"
      };
    }
    
    if (name.includes('gold')) {
      return {
        fundType: "Others",
        sebiCategory: "Gold ETF",
        sebiMainCategory: "Others"
      };
    }
    
    // Default to Equity Multi Cap if equity-related terms found
    if (name.includes('equity') || name.includes('growth') || name.includes('opportunities')) {
      return {
        fundType: "Equity",
        sebiCategory: "Multi Cap",
        sebiMainCategory: "Equity"
      };
    }
    
    // Default to Debt if income/debt terms found
    if (name.includes('income') || name.includes('debt') || name.includes('bond')) {
      return {
        fundType: "Debt",
        sebiCategory: "Medium Duration",
        sebiMainCategory: "Debt"
      };
    }
    
    // Final default
    return {
      fundType: "Others",
      sebiCategory: "Index Fund",
      sebiMainCategory: "Others"
    };
  }
  
  private generateInternalCategory(schemeName: string, classification: EnhancedFundData['classification']) {
    const name = schemeName.toLowerCase();
    const internalCategory: Record<string, string[] | string> = {};
    
    // Style strategy
    const styleStrategy = [];
    if (name.includes('quality')) styleStrategy.push('Quality');
    if (name.includes('value')) styleStrategy.push('Value');
    if (name.includes('growth')) styleStrategy.push('Growth');
    if (name.includes('momentum')) styleStrategy.push('Momentum');
    if (name.includes('dividend')) styleStrategy.push('Dividend');
    if (name.includes('quant')) styleStrategy.push('Quant');
    
    if (styleStrategy.length > 0) internalCategory.styleStrategy = styleStrategy;
    
    // Theme tags
    const themeTags = [];
    if (name.includes('psu')) themeTags.push('PSU');
    if (name.includes('manufacturing')) themeTags.push('Manufacturing');
    if (name.includes('defence')) themeTags.push('Defence');
    if (name.includes('pharma')) themeTags.push('Pharma');
    if (name.includes('it') || name.includes('technology')) themeTags.push('IT');
    if (name.includes('bank') || name.includes('financial')) themeTags.push('BFSI');
    if (name.includes('infrastructure') || name.includes('infra')) themeTags.push('Infra');
    if (name.includes('consumption') || name.includes('consumer')) themeTags.push('Consumption');
    
    if (themeTags.length > 0) internalCategory.themeTags = themeTags;
    
    // Equity market focus
    if (classification.fundType === 'Equity') {
      if (classification.sebiCategory === 'Large Cap') internalCategory.equityMarketFocus = 'Large Only';
      else if (classification.sebiCategory === 'Mid Cap') internalCategory.equityMarketFocus = 'Mid Only';
      else if (classification.sebiCategory === 'Small Cap') internalCategory.equityMarketFocus = 'Small Only';
      else if (classification.sebiCategory === 'Multi Cap') internalCategory.equityMarketFocus = 'Multi';
      else if (classification.sebiCategory === 'Flexi Cap') internalCategory.equityMarketFocus = 'Flexi';
    }
    
    // Debt duration bucket
    if (classification.fundType === 'Debt') {
      if (classification.sebiCategory.includes('Ultra Short')) internalCategory.debtDurationBucket = '<=3M';
      else if (classification.sebiCategory.includes('Short')) internalCategory.debtDurationBucket = '3-6M';
      else if (classification.sebiCategory.includes('Medium')) internalCategory.debtDurationBucket = '1-3Y';
      else if (classification.sebiCategory.includes('Long')) internalCategory.debtDurationBucket = '>5Y';
    }
    
    return Object.keys(internalCategory).length > 0 ? internalCategory : undefined;
  }
  
  private estimateOperationalParams(schemeName: string, classification: EnhancedFundData['classification']) {
    const name = schemeName.toLowerCase();
    
    // Risk-o-meter based on category
    let riskOMeter: "Low" | "Low to Moderate" | "Moderate" | "Moderately High" | "High" | "Very High" = "Moderate";
    
    if (classification.fundType === 'Debt') {
      if (classification.sebiCategory.includes('Liquid') || classification.sebiCategory.includes('Ultra Short')) {
        riskOMeter = "Low";
      } else if (classification.sebiCategory.includes('Short') || classification.sebiCategory.includes('Medium')) {
        riskOMeter = "Low to Moderate";
      } else {
        riskOMeter = "Moderate";
      }
    } else if (classification.fundType === 'Equity') {
      if (classification.sebiCategory === 'Large Cap') {
        riskOMeter = "Moderately High";
      } else if (classification.sebiCategory === 'Mid Cap') {
        riskOMeter = "High";
      } else if (classification.sebiCategory === 'Small Cap') {
        riskOMeter = "Very High";
      } else {
        riskOMeter = "High";
      }
    } else if (classification.fundType === 'Hybrid') {
      riskOMeter = "Moderate";
    }
    
    // Estimate expense ratio
    const plan = name.includes('direct') ? 'Direct' : 'Regular';
    let expenseRatio = plan === 'Direct' ? 1.0 : 1.5;
    
    if (classification.fundType === 'Debt') expenseRatio *= 0.6;
    else if (classification.fundType === 'Equity') expenseRatio *= 1.2;
    
    // Estimate minimum amounts
    const minLumpsum = classification.fundType === 'Debt' ? 1000 : 5000;
    const minSIP = classification.fundType === 'Debt' ? 500 : 1000;
    
    return {
      riskOMeter,
      expenseRatio: Math.round(expenseRatio * 100) / 100,
      minLumpsum,
      minSIP
    };
  }
  
  public getCategoryAnalysis(): CategoryAnalysis {
    const analysis: CategoryAnalysis = {
      totalFunds: this.enhancedFunds.length,
      fundsByAMC: {},
      fundsByType: {},
      fundsByCategory: {},
      fundsByRisk: {},
      fundsByPlan: {},
      fundsByOption: {},
      internalCategories: {
        styleStrategy: {},
        themeTags: {},
        equityMarketFocus: {},
        debtDurationBucket: {},
        debtCreditQuality: {}
      }
    };
    
    this.enhancedFunds.forEach(fund => {
      // Count by AMC
      analysis.fundsByAMC[fund.fundHouse] = (analysis.fundsByAMC[fund.fundHouse] || 0) + 1;
      
      // Count by fund type
      analysis.fundsByType[fund.classification.fundType] = (analysis.fundsByType[fund.classification.fundType] || 0) + 1;
      
      // Count by category
      const mainCategory = fund.classification.sebiMainCategory;
      const subCategory = fund.classification.sebiCategory;
      
      if (!analysis.fundsByCategory[mainCategory]) {
        analysis.fundsByCategory[mainCategory] = {};
      }
      analysis.fundsByCategory[mainCategory][subCategory] = (analysis.fundsByCategory[mainCategory][subCategory] || 0) + 1;
      
      // Count by risk
      analysis.fundsByRisk[fund.operational.riskOMeter] = (analysis.fundsByRisk[fund.operational.riskOMeter] || 0) + 1;
      
      // Count by plan
      analysis.fundsByPlan[fund.planOption.plan] = (analysis.fundsByPlan[fund.planOption.plan] || 0) + 1;
      
      // Count by option
      analysis.fundsByOption[fund.planOption.option] = (analysis.fundsByOption[fund.planOption.option] || 0) + 1;
      
      // Count internal categories
      if (fund.internalCategory) {
        if (fund.internalCategory.styleStrategy) {
          fund.internalCategory.styleStrategy.forEach(strategy => {
            analysis.internalCategories.styleStrategy[strategy] = (analysis.internalCategories.styleStrategy[strategy] || 0) + 1;
          });
        }
        
        if (fund.internalCategory.themeTags) {
          fund.internalCategory.themeTags.forEach(tag => {
            analysis.internalCategories.themeTags[tag] = (analysis.internalCategories.themeTags[tag] || 0) + 1;
          });
        }
        
        if (fund.internalCategory.equityMarketFocus) {
          const focus = fund.internalCategory.equityMarketFocus;
          analysis.internalCategories.equityMarketFocus[focus] = (analysis.internalCategories.equityMarketFocus[focus] || 0) + 1;
        }
        
        if (fund.internalCategory.debtDurationBucket) {
          const bucket = fund.internalCategory.debtDurationBucket;
          analysis.internalCategories.debtDurationBucket[bucket] = (analysis.internalCategories.debtDurationBucket[bucket] || 0) + 1;
        }
      }
    });
    
    return analysis;
  }
  
  public searchFunds(filters: ComprehensiveSearchFilters): EnhancedFundData[] {
    let results = [...this.enhancedFunds];
    
    // Apply AMC filter
    if (filters.amc && filters.amc.length > 0) {
      results = results.filter(fund => filters.amc!.includes(fund.fundHouse));
    }
    
    // Apply fund type filter
    if (filters.fundType && filters.fundType.length > 0) {
      results = results.filter(fund => filters.fundType!.includes(fund.classification.fundType));
    }
    
    // Apply SEBI category filter
    if (filters.sebiCategory) {
      const categoryFilters = filters.sebiCategory;
      results = results.filter(fund => {
        const mainCategory = fund.classification.sebiMainCategory;
        const subCategory = fund.classification.sebiCategory;
        
        if (categoryFilters[mainCategory] && Array.isArray(categoryFilters[mainCategory])) {
          const allowedCategories = categoryFilters[mainCategory] as string[];
          return allowedCategories.includes(subCategory);
        }
        return false;
      });
    }
    
    // Apply plan filter
    if (filters.plan && filters.plan.length > 0) {
      results = results.filter(fund => filters.plan!.includes(fund.planOption.plan));
    }
    
    // Apply option filter
    if (filters.option && filters.option.length > 0) {
      results = results.filter(fund => filters.option!.includes(fund.planOption.option));
    }
    
    // Apply risk filter
    if (filters.fundMetrics?.riskOMeter && filters.fundMetrics.riskOMeter.length > 0) {
      results = results.filter(fund => filters.fundMetrics!.riskOMeter!.includes(fund.operational.riskOMeter));
    }
    
    // Apply expense ratio filter
    if (filters.fundMetrics?.expenseRatioRange) {
      const [min, max] = filters.fundMetrics.expenseRatioRange;
      results = results.filter(fund => 
        fund.operational.expenseRatio >= min && fund.operational.expenseRatio <= max
      );
    }
    
    // Apply text search
    if (filters.searchText) {
      const searchTerm = filters.searchText.toLowerCase();
      results = results.filter(fund => 
        fund.schemeName.toLowerCase().includes(searchTerm) ||
        fund.fundHouse.toLowerCase().includes(searchTerm) ||
        fund.classification.sebiCategory.toLowerCase().includes(searchTerm)
      );
      
      // Add search scoring
      results = results.map(fund => ({
        ...fund,
        searchScore: this.calculateSearchScore(fund, searchTerm)
      }));
      
      // Sort by search score
      results.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
    }
    
    // Apply sorting
    if (filters.sortBy && filters.sortOrder) {
      results.sort((a, b) => {
        let aValue: string | number, bValue: string | number;
        
        switch (filters.sortBy) {
          case 'expenseRatio':
            aValue = a.operational.expenseRatio;
            bValue = b.operational.expenseRatio;
            break;
          case 'fundHouse':
            aValue = a.fundHouse;
            bValue = b.fundHouse;
            break;
          case 'schemeName':
            aValue = a.schemeName;
            bValue = b.schemeName;
            break;
          default:
            return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return filters.sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          return filters.sortOrder === 'asc' 
            ? aValue - bValue
            : bValue - aValue;
        }
        return 0;
      });
    }
    
    // Apply pagination
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }
  
  private calculateSearchScore(fund: EnhancedFundData, searchTerm: string): number {
    let score = 0;
    
    // Exact name match gets highest score
    if (fund.schemeName.toLowerCase() === searchTerm) score += 100;
    
    // Name starts with search term
    if (fund.schemeName.toLowerCase().startsWith(searchTerm)) score += 50;
    
    // Name contains search term
    if (fund.schemeName.toLowerCase().includes(searchTerm)) score += 25;
    
    // Fund house matches
    if (fund.fundHouse.toLowerCase().includes(searchTerm)) score += 15;
    
    // Category matches
    if (fund.classification.sebiCategory.toLowerCase().includes(searchTerm)) score += 10;
    
    return score;
  }
}

// Global analyzer instance
let analyzer: FundDataAnalyzer | null = null;

function getAnalyzer(): FundDataAnalyzer {
  if (!analyzer) {
    analyzer = new FundDataAnalyzer();
  }
  return analyzer;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analysis';
    
    const fundAnalyzer = getAnalyzer();
    
    switch (action) {
      case 'analysis':
        return NextResponse.json({
          success: true,
          data: fundAnalyzer.getCategoryAnalysis(),
          timestamp: new Date().toISOString()
        });
        
      case 'search':
        const filters: ComprehensiveSearchFilters = {};
        
        // Parse search parameters
        if (searchParams.get('searchText')) {
          filters.searchText = searchParams.get('searchText')!;
        }
        
        if (searchParams.get('amc')) {
          filters.amc = searchParams.get('amc')!.split(',');
        }
        
        if (searchParams.get('fundType')) {
          filters.fundType = searchParams.get('fundType')!.split(',') as ("Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others")[];
        }
        
        if (searchParams.get('plan')) {
          filters.plan = searchParams.get('plan')!.split(',') as ("Direct" | "Regular")[];
        }
        
        if (searchParams.get('riskOMeter')) {
          filters.fundMetrics = {
            riskOMeter: searchParams.get('riskOMeter')!.split(',') as ("Low" | "Low to Moderate" | "Moderate" | "Moderately High" | "High" | "Very High")[]
          };
        }
        
        if (searchParams.get('limit')) {
          filters.limit = parseInt(searchParams.get('limit')!);
        }
        
        if (searchParams.get('sortBy')) {
          filters.sortBy = searchParams.get('sortBy')!;
          filters.sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
        }
        
        const results = fundAnalyzer.searchFunds(filters);
        
        return NextResponse.json({
          success: true,
          data: results,
          total: results.length,
          filters,
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: analysis, search'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Fund data analysis error:', error);
    return NextResponse.json({
      success: false,
      error: 'Fund data analysis failed',
      details: String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filters } = body;
    
    const fundAnalyzer = getAnalyzer();
    
    switch (action) {
      case 'advancedSearch':
        const results = fundAnalyzer.searchFunds(filters as ComprehensiveSearchFilters);
        
        return NextResponse.json({
          success: true,
          data: results,
          total: results.length,
          appliedFilters: filters,
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: advancedSearch'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Advanced search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Advanced search failed',
      details: String(error)
    }, { status: 500 });
  }
}