import { FundRecord } from './dynamodb';

export interface FundSchema {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
}

/**
 * Professional fund categorization service
 * Uses intelligent pattern matching and rule-based classification
 */
export class FundCategorizationService {
  
  /**
   * Main categorization function
   */
  static categorizeFund(fund: FundSchema): {
    category: string;
    subCategory: string;
    fundHouse: string;
    planType: 'Regular' | 'Direct';
    optionType: 'Growth' | 'IDCW' | 'Dividend';
  } {
    const name = fund.schemeName.toLowerCase();
    
    return {
      category: this.determineCategory(name),
      subCategory: this.determineSubCategory(name),
      fundHouse: this.extractFundHouse(fund.schemeName),
      planType: this.determinePlanType(name),
      optionType: this.determineOptionType(name)
    };
  }

  /**
   * Determine main category (Equity, Debt, Hybrid, Other)
   */
  private static determineCategory(name: string): string {
    const equityKeywords = [
      'equity', 'bluechip', 'large cap', 'mid cap', 'small cap', 'flexi cap',
      'multi cap', 'sectoral', 'thematic', 'elss', 'tax saver', 'focused',
      'value', 'growth', 'dividend yield', 'momentum', 'quality'
    ];
    
    const debtKeywords = [
      'debt', 'bond', 'credit', 'gilt', 'treasury', 'government securities',
      'corporate bond', 'banking', 'psu', 'liquid', 'overnight', 'ultra short',
      'short term', 'medium term', 'long term', 'duration', 'accrual',
      'dynamic bond', 'credit risk'
    ];
    
    const hybridKeywords = [
      'hybrid', 'balanced', 'aggressive hybrid', 'conservative hybrid',
      'dynamic asset allocation', 'multi asset', 'arbitrage', 'equity savings',
      'monthly income plan', 'mip'
    ];

    if (this.containsKeywords(name, equityKeywords)) {
      return 'equity';
    } else if (this.containsKeywords(name, debtKeywords)) {
      return 'debt';
    } else if (this.containsKeywords(name, hybridKeywords)) {
      return 'hybrid';
    }
    
    return 'other';
  }

  /**
   * Determine sub-category based on detailed analysis
   */
  private static determineSubCategory(name: string): string {
    // Equity sub-categories
    if (name.includes('large cap') || name.includes('bluechip') || name.includes('top 100')) {
      return 'largeCap';
    }
    if (name.includes('mid cap') || name.includes('midcap')) {
      return 'midCap';
    }
    if (name.includes('small cap') || name.includes('smallcap')) {
      return 'smallCap';
    }
    if (name.includes('flexi cap') || name.includes('flexicap')) {
      return 'flexiCap';
    }
    if (name.includes('multi cap') || name.includes('multicap')) {
      return 'multiCap';
    }
    if (name.includes('elss') || name.includes('tax saver') || name.includes('80c')) {
      return 'elss';
    }
    if (name.includes('sectoral') || name.includes('sector') || 
        name.includes('banking') || name.includes('pharma') || 
        name.includes('it') || name.includes('auto') || name.includes('infra')) {
      return 'sectoral';
    }
    if (name.includes('thematic') || name.includes('consumption') || 
        name.includes('rural') || name.includes('digital') || name.includes('esg')) {
      return 'thematic';
    }

    // Debt sub-categories
    if (name.includes('liquid') || name.includes('overnight')) {
      return 'liquid';
    }
    if (name.includes('ultra short') || name.includes('ultrashort')) {
      return 'ultraShort';
    }
    if (name.includes('short term') || name.includes('short duration')) {
      return 'shortTerm';
    }
    if (name.includes('medium term') || name.includes('medium duration')) {
      return 'mediumTerm';
    }
    if (name.includes('long term') || name.includes('long duration')) {
      return 'longTerm';
    }
    if (name.includes('corporate bond') || name.includes('corporate')) {
      return 'corporate';
    }
    if (name.includes('gilt') || name.includes('government') || name.includes('gsec')) {
      return 'gilt';
    }
    if (name.includes('credit risk') || name.includes('credit opportunities')) {
      return 'creditRisk';
    }

    // Hybrid sub-categories
    if (name.includes('aggressive hybrid') || name.includes('aggressive')) {
      return 'aggressive';
    }
    if (name.includes('conservative hybrid') || name.includes('conservative')) {
      return 'conservative';
    }
    if (name.includes('balanced') || name.includes('dynamic asset')) {
      return 'balanced';
    }
    if (name.includes('arbitrage')) {
      return 'arbitrage';
    }
    if (name.includes('multi asset') || name.includes('multiasset')) {
      return 'multiAsset';
    }

    // Other categories
    if (name.includes('index') || name.includes('nifty') || name.includes('sensex')) {
      return 'index';
    }
    if (name.includes('etf')) {
      return 'etf';
    }
    if (name.includes('fund of fund') || name.includes('fof')) {
      return 'fof';
    }

    // Default sub-categories based on main category
    const category = this.determineCategory(name);
    if (category === 'equity') return 'flexiCap';
    if (category === 'debt') return 'mediumTerm';
    if (category === 'hybrid') return 'balanced';
    
    return 'other';
  }

  /**
   * Extract fund house name
   */
  private static extractFundHouse(schemeName: string): string {
    const fundHousePatterns = [
      { pattern: /^SBI\s/, name: 'SBI Mutual Fund' },
      { pattern: /^HDFC\s/, name: 'HDFC Mutual Fund' },
      { pattern: /^ICICI\s/, name: 'ICICI Prudential MF' },
      { pattern: /^Axis\s/, name: 'Axis Mutual Fund' },
      { pattern: /^Kotak\s/, name: 'Kotak Mahindra MF' },
      { pattern: /^Aditya Birla\s/, name: 'Aditya Birla Sun Life MF' },
      { pattern: /^Nippon\s/, name: 'Nippon India MF' },
      { pattern: /^UTI\s/, name: 'UTI Mutual Fund' },
      { pattern: /^DSP\s/, name: 'DSP Mutual Fund' },
      { pattern: /^Franklin\s/, name: 'Franklin Templeton MF' },
      { pattern: /^Invesco\s/, name: 'Invesco Mutual Fund' },
      { pattern: /^Mirae\s/, name: 'Mirae Asset MF' },
      { pattern: /^Parag Parikh\s/, name: 'PPFAS Mutual Fund' },
      { pattern: /^IDFC\s/, name: 'IDFC Mutual Fund' },
      { pattern: /^L&T\s/, name: 'L&T Mutual Fund' },
      { pattern: /^Tata\s/, name: 'Tata Mutual Fund' },
      { pattern: /^Canara Robeco\s/, name: 'Canara Robeco MF' },
      { pattern: /^Mahindra\s/, name: 'Mahindra Manulife MF' },
      { pattern: /^Sundaram\s/, name: 'Sundaram Mutual Fund' },
      { pattern: /^Edelweiss\s/, name: 'Edelweiss MF' }
    ];

    for (const { pattern, name } of fundHousePatterns) {
      if (pattern.test(schemeName)) {
        return name;
      }
    }

    // Extract first word as fallback
    const firstWord = schemeName.split(' ')[0];
    return `${firstWord} MF`;
  }

  /**
   * Determine plan type (Direct/Regular)
   */
  private static determinePlanType(name: string): 'Regular' | 'Direct' {
    if (name.includes('direct')) {
      return 'Direct';
    }
    return 'Regular';
  }

  /**
   * Determine option type (Growth/IDCW/Dividend)
   */
  private static determineOptionType(name: string): 'Growth' | 'IDCW' | 'Dividend' {
    if (name.includes('growth')) {
      return 'Growth';
    }
    if (name.includes('idcw')) {
      return 'IDCW';
    }
    if (name.includes('dividend')) {
      return 'Dividend';
    }
    return 'Growth'; // Default
  }

  /**
   * Helper function to check if name contains any of the keywords
   */
  private static containsKeywords(name: string, keywords: string[]): boolean {
    return keywords.some(keyword => name.includes(keyword));
  }

  /**
   * Process entire fund schema and return categorized funds
   */
  static async processFundSchema(schemaPath: string): Promise<FundRecord[]> {
    try {
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(schemaPath, 'utf-8');
      const funds: FundSchema[] = JSON.parse(fileContent);
      
      console.log(`Processing ${funds.length} funds...`);
      
      const categorizedFunds: FundRecord[] = [];
      
      for (let i = 0; i < funds.length; i++) {
        const fund = funds[i];
        
        if (!fund.schemeCode || !fund.schemeName) {
          continue;
        }

        const categorization = this.categorizeFund(fund);
        
        const fundRecord: FundRecord = {
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          category: categorization.category,
          subCategory: categorization.subCategory,
          fundHouse: categorization.fundHouse,
          planType: categorization.planType,
          optionType: categorization.optionType,
          isinGrowth: fund.isinGrowth || undefined,
          isinDivReinvestment: fund.isinDivReinvestment || undefined,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        categorizedFunds.push(fundRecord);

        // Log progress every 10000 records
        if ((i + 1) % 10000 === 0) {
          console.log(`Processed ${i + 1}/${funds.length} funds`);
        }
      }

      console.log(`Successfully categorized ${categorizedFunds.length} funds`);
      return categorizedFunds;
      
    } catch (error) {
      console.error('Error processing fund schema:', error);
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  static getCategoryStats(funds: FundRecord[]): Record<string, Record<string, number>> {
    const stats: Record<string, Record<string, number>> = {};
    
    funds.forEach(fund => {
      if (!stats[fund.category]) {
        stats[fund.category] = {};
      }
      
      if (!stats[fund.category][fund.subCategory]) {
        stats[fund.category][fund.subCategory] = 0;
      }
      
      stats[fund.category][fund.subCategory]++;
    });
    
    return stats;
  }
}