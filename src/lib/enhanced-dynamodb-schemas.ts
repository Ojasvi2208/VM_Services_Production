/**
 * Enhanced DynamoDB Schema Design for Comprehensive Mutual Fund System
 * Updated with Advanced Categorization and Filtering Capabilities
 * 
 * SCOPE: 37,141+ mutual fund schemes with comprehensive categorization
 * ENHANCED FEATURES: Advanced filtering, performance metrics, portfolio analytics
 * 
 * TABLES:
 * 1. VMFS_Funds - Master fund information with enhanced categorization
 * 2. VMFS_NAVHistory - Daily NAV records with enhanced tracking
 * 3. VMFS_FundMetrics - Comprehensive performance and portfolio analytics
 * 4. VMFS_FundCategories - Enhanced hierarchical categorization
 * 5. VMFS_Benchmarks - Benchmark data for comparative analysis
 */

export interface EnhancedFundMaster {
  // Primary Key
  schemeCode: string; // PK: "120503" (AMFI Code)
  
  // === BASIC FUND INFORMATION ===
  schemeName: string;
  fundHouse: string; // AMC Name
  
  // === SCHEME IDENTIFIERS ===
  identifiers: {
    amfiCode: string; // Primary scheme code
    rtaCode?: string; // RTA specific code
    isinGrowth?: string; // ISIN for growth option
    isinIDCW?: string; // ISIN for IDCW option
  };
  
  // === FUND CLASSIFICATION ===
  classification: {
    // Primary categorization
    fundType: "Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others";
    
    // SEBI Category (detailed)
    sebiCategory: string; // e.g., "Large Cap", "Ultra Short", "Conservative Hybrid"
    sebiMainCategory: "Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others";
    
    // Internal categorization for advanced filtering
    internalCategory: {
      // Style and strategy tags
      styleStrategy?: ("Quality" | "Value" | "Growth" | "Momentum" | "Low Vol" | "Dividend" | "Quant")[];
      
      // Theme tags for thematic funds
      themeTags?: ("PSU" | "Manufacturing" | "Defence" | "EV" | "Renewables" | "Pharma" | "IT" | "BFSI" | "Infra" | "Consumption" | "MNC" | "Exporters")[];
      
      // Equity market focus
      equityMarketFocus?: "Large Only" | "Mid Only" | "Small Only" | "Multi" | "Flexi";
      
      // Debt specific categorization
      debtDurationBucket?: "<=3M" | "3-6M" | "6-12M" | "1-3Y" | "3-5Y" | ">5Y";
      debtCreditQuality?: "GSec/AAA" | "AAA-Heavy" | "AA Mix" | "Credit-Oriented";
      
      // Arbitrage intensity
      arbitrageIntensity?: "Pure" | "Mixed";
    };
  };
  
  // === PLAN AND OPTIONS ===
  planOption: {
    plan: "Direct" | "Regular";
    option: "Growth" | "IDCW Payout" | "IDCW Reinvestment";
  };
  
  // === FUND HOUSE ATTRIBUTES ===
  fundHouseAttributes: {
    amcAUMInCr: number; // Total AUM of AMC
    amcLaunchYear: number; // Year AMC was established
  };
  
  // === OPERATIONAL DETAILS ===
  operational: {
    fundManagers: string[]; // Array of fund manager names
    managerTenureYears?: number; // Current manager tenure
    inceptionDate: string; // Fund launch date
    
    // Investment parameters
    minLumpsum: number; // Minimum lump sum investment
    minSIP: number; // Minimum SIP amount
    
    // Fees and charges
    expenseRatio: number; // Annual expense ratio %
    exitLoad: boolean; // Whether exit load applicable
    exitLoadDetails?: string; // Exit load structure details
    
    // Lock-in and liquidity
    lockIn: boolean; // Whether lock-in period exists
    lockInPeriod?: number; // Lock-in period in years (for ELSS)
    
    // Risk assessment
    riskOMeter: "Low" | "Low to Moderate" | "Moderate" | "Moderately High" | "High" | "Very High";
    
    // Tax classification
    taxFlags: ("Equity" | "Non-Equity" | "ELSS")[];
    
    // Liquidity flags
    liquidityFlags?: ("Side-pocket history" | "Unit suspension history")[];
  };
  
  // === BENCHMARK INFORMATION ===
  benchmark: {
    primaryBenchmark: string; // e.g., "Nifty 50 TRI"
    secondaryBenchmark?: string;
    customBenchmarkId?: string; // For composite benchmarks
  };
  
  // === SEARCH OPTIMIZATION ===
  searchOptimization: {
    searchTerms: string[]; // For BST-like search
    tags: string[]; // All searchable tags
    popularityScore: number; // Search frequency weight
  };
  
  // === STATUS AND METADATA ===
  status: {
    isActive: boolean;
    lastUpdated: string; // ISO timestamp
    dataQuality: "Verified" | "Pending" | "Incomplete";
  };
  
  // === GSI KEYS FOR EFFICIENT QUERYING ===
  gsi1pk: string; // fundHouse
  gsi1sk: string; // fundType#sebiCategory
  gsi2pk: string; // fundType
  gsi2sk: string; // expenseRatio#{expenseRatio}
  gsi3pk: string; // riskOMeter
  gsi3sk: string; // amcAUMInCr#{amcAUMInCr}
}

export interface EnhancedNAVRecord {
  // Primary Key
  pk: string; // "NAV#{schemeCode}"
  sk: string; // "DATE#{YYYY-MM-DD}"
  
  // NAV Data
  schemeCode: string;
  date: string; // "2024-10-02"
  nav: number; // 65.43
  
  // Change Calculations
  previousNav?: number;
  absoluteChange?: number; // +1.12
  percentageChange?: number; // +1.74
  
  // Volume and activity metrics
  volume?: number; // Trading volume if available
  
  // Data source and quality
  source: "MFAPI" | "AMFI" | "RTA" | "MANUAL";
  dataQuality: "Verified" | "Estimated" | "Provisional";
  timestamp: string; // ISO timestamp
  
  // GSI for latest NAV queries
  gsi1pk: string; // "LATEST#{schemeCode}"
  gsi1sk: string; // timestamp for latest record
}

export interface EnhancedFundMetrics {
  // Primary Key
  pk: string; // "METRICS#{schemeCode}"
  sk: string; // "CURRENT" or "HISTORICAL#{YYYY-MM}"
  
  schemeCode: string;
  calculationDate: string;
  
  // === CURRENT NAV INFORMATION ===
  currentMetrics: {
    latestNAV: number;
    latestNAVDate: string;
    previousNAV?: number;
    dailyChange: number;
    dailyChangePercent: number;
    aumInCr: number; // Current AUM in crores
  };
  
  // === ROLLING RETURNS (CAGR %) ===
  performance: {
    cagr: {
      "1Y"?: number;
      "3Y"?: number;
      "5Y"?: number;
      "10Y"?: number;
      "SI"?: number; // Since Inception
    };
    
    // Rolling returns for various periods
    rollingReturns: {
      "1Y"?: number;
      "3Y"?: number;
      "5Y"?: number;
    };
    
    // Performance vs benchmark
    benchmarkOutperformance: {
      "1Y"?: number; // Fund return - Benchmark return
      "3Y"?: number;
      "5Y"?: number;
    };
    
    // Category ranking
    categoryQuartile: {
      "1Y"?: 1 | 2 | 3 | 4;
      "3Y"?: 1 | 2 | 3 | 4;
      "5Y"?: 1 | 2 | 3 | 4;
    };
  };
  
  // === RISK METRICS ===
  riskMetrics: {
    maxDrawdown: number; // Maximum drawdown %
    maxDrawdownDate?: string;
    volatility: number; // Annualized volatility %
    sharpeRatio?: number; // Risk-adjusted returns
    sortinoRatio?: number; // Downside risk-adjusted returns
    informationRatio?: number; // Active return vs tracking error
    upsideCapture?: number; // % of benchmark upside captured
    downsideCapture?: number; // % of benchmark downside captured
    beta?: number; // Systematic risk vs benchmark
    alpha?: number; // Excess return vs benchmark
  };
  
  // === PORTFOLIO COMPOSITION ===
  portfolioMetrics: {
    // Equity allocation breakdown (for equity/hybrid funds)
    equitySplit?: {
      largeCap: number; // % allocation to large cap
      midCap: number; // % allocation to mid cap
      smallCap: number; // % allocation to small cap
    };
    
    // Debt portfolio metrics (for debt/hybrid funds)
    debtMetrics?: {
      avgMaturityYears: number; // Average maturity
      modifiedDurationYears: number; // Interest rate sensitivity
      ytmPercent: number; // Yield to maturity
      creditQualityTags: ("GSec" | "AAA" | "AA" | "A and below")[];
    };
    
    // Portfolio overlap with popular indices/funds
    overlapPercent?: number; // % overlap with benchmark/popular funds
  };
  
  // === CALCULATION METADATA ===
  metadata: {
    lastCalculated: string;
    dataPoints: number; // Number of NAV records used
    calculationMethod: string; // Method used for calculations
    dataQuality: "High" | "Medium" | "Low";
  };
  
  // === GSI KEYS FOR PERFORMANCE QUERIES ===
  gsi1pk: string; // "CATEGORY#{fundType}#{sebiCategory}"
  gsi1sk: string; // "RETURN1Y#{returns1Year}"
  gsi2pk: string; // "RISK#{riskOMeter}"
  gsi2sk: string; // "SHARPE#{sharpeRatio}"
  gsi3pk: string; // "AUM#{aumRange}"
  gsi3sk: string; // "EXPENSE#{expenseRatio}"
}

export interface EnhancedBenchmarkData {
  // Primary Key
  pk: string; // "BENCHMARK#{benchmarkId}"
  sk: string; // "DATE#{YYYY-MM-DD}"
  
  benchmarkId: string;
  benchmarkName: string;
  date: string;
  value: number;
  
  // Change calculations
  absoluteChange?: number;
  percentageChange?: number;
  
  // Metadata
  source: string;
  timestamp: string;
  
  // GSI for latest benchmark data
  gsi1pk: string; // "LATEST#{benchmarkId}"
  gsi1sk: string; // timestamp
}

// === ADVANCED SEARCH FILTERS (Enhanced) ===
export interface ComprehensiveSearchFilters {
  // === AMC AND FUND TYPE FILTERS ===
  amc?: string[]; // Fund house names
  fundType?: ("Equity" | "Debt" | "Hybrid" | "Solution Oriented" | "Others")[];
  
  // === SEBI CATEGORY FILTERS ===
  sebiCategory?: {
    Equity?: ("Large Cap" | "Mid Cap" | "Small Cap" | "Large & Mid Cap" | "Multi Cap" | "Flexi Cap" | "Focused" | "Value/Contra" | "Dividend Yield" | "Sector/Thematic" | "ELSS")[];
    Debt?: ("Overnight" | "Liquid" | "Ultra Short" | "Low Duration" | "Money Market" | "Short Duration" | "Medium Duration" | "Medium to Long Duration" | "Long Duration" | "Dynamic Bond" | "Corporate Bond" | "Credit Risk" | "Banking & PSU" | "Gilt" | "Gilt 10Y" | "Floater")[];
    Hybrid?: ("Conservative Hybrid" | "Balanced/Aggressive Hybrid" | "Balanced Advantage/Dynamic Asset Allocation" | "Multi-Asset" | "Arbitrage" | "Equity Savings")[];
    "Solution Oriented"?: ("Retirement" | "Children's")[];
    Others?: ("Index Fund" | "ETF" | "FoF Domestic" | "FoF Overseas" | "Gold ETF" | "Commodity")[];
  };
  
  // === INTERNAL CATEGORIZATION FILTERS ===
  internalCategory?: {
    styleStrategy?: ("Quality" | "Value" | "Growth" | "Momentum" | "Low Vol" | "Dividend" | "Quant")[];
    themeTags?: ("PSU" | "Manufacturing" | "Defence" | "EV" | "Renewables" | "Pharma" | "IT" | "BFSI" | "Infra" | "Consumption" | "MNC" | "Exporters")[];
    equityMarketFocus?: ("Large Only" | "Mid Only" | "Small Only" | "Multi" | "Flexi")[];
    debtDurationBucket?: ("<=3M" | "3-6M" | "6-12M" | "1-3Y" | "3-5Y" | ">5Y")[];
    debtCreditQuality?: ("GSec/AAA" | "AAA-Heavy" | "AA Mix" | "Credit-Oriented")[];
    arbitrageIntensity?: ("Pure" | "Mixed")[];
  };
  
  // === PLAN AND OPTION FILTERS ===
  plan?: ("Direct" | "Regular")[];
  option?: ("Growth" | "IDCW Payout" | "IDCW Reinvestment")[];
  
  // === BENCHMARK FILTERS ===
  benchmark?: string[];
  
  // === SCHEME IDENTIFIER FILTERS ===
  schemeIdentifiers?: {
    amfiCode?: string;
    rtaCode?: string;
    isinGrowth?: string;
    isinIDCW?: string;
  };
  
  // === FUND HOUSE ATTRIBUTES ===
  fundHouseAttributes?: {
    amcAUMRangeInCr?: [number, number]; // [min, max] AUM range
    amcLaunchYearRange?: [number, number]; // [min, max] year range
  };
  
  // === FUND METRICS FILTERS ===
  fundMetrics?: {
    aumInCrRange?: [number, number];
    expenseRatioRange?: [number, number];
    exitLoad?: ("Yes" | "No")[];
    exitLoadDetails?: string;
    minLumpsumRange?: [number, number];
    minSIPRange?: [number, number];
    lockIn?: ("Yes" | "No")[];
    riskOMeter?: ("Low" | "Low to Moderate" | "Moderate" | "Moderately High" | "High" | "Very High")[];
    
    // Performance filters
    performance?: {
      cagr?: {
        "1Y_range"?: [number, number];
        "3Y_range"?: [number, number];
        "5Y_range"?: [number, number];
        "10Y_range"?: [number, number];
      };
      rollingReturns?: {
        "1Y_range"?: [number, number];
        "3Y_range"?: [number, number];
        "5Y_range"?: [number, number];
      };
      maxDrawdownRange?: [number, number];
      volatilityRange?: [number, number];
      sharpeRange?: [number, number];
      sortinoRange?: [number, number];
      informationRatioRange?: [number, number];
      upsideCaptureRange?: [number, number];
      downsideCaptureRange?: [number, number];
      benchmarkOutperformance?: {
        "1Y_range"?: [number, number];
        "3Y_range"?: [number, number];
        "5Y_range"?: [number, number];
      };
      categoryQuartile?: {
        "1Y"?: (1 | 2 | 3 | 4)[];
        "3Y"?: (1 | 2 | 3 | 4)[];
        "5Y"?: (1 | 2 | 3 | 4)[];
      };
    };
    
    // Portfolio composition filters
    portfolioEquitySplitPct?: {
      largeCapRange?: [number, number];
      midCapRange?: [number, number];
      smallCapRange?: [number, number];
    };
    
    portfolioDebt?: {
      avgMaturityYearsRange?: [number, number];
      modifiedDurationYearsRange?: [number, number];
      ytmPctRange?: [number, number];
      creditQualityTags?: ("GSec" | "AAA" | "AA" | "A and below")[];
    };
    
    overlapPctRange?: [number, number];
  };
  
  // === OPERATIONAL FILTERS ===
  operational?: {
    fundManagers?: string[];
    managerTenureYearsRange?: [number, number];
    inceptionDateFrom?: string;
    inceptionDateTo?: string;
    taxFlags?: ("Equity" | "Non-Equity" | "ELSS")[];
    liquidityFlags?: ("Side-pocket history" | "Unit suspension history")[];
  };
  
  // === TIME WINDOW FOR ANALYSIS ===
  timeWindow?: ("1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y" | "SI")[];
  
  // === SEARCH AND SORTING ===
  searchText?: string; // For fund name/keyword search
  sortBy?: string; // Dynamic sorting field
  sortOrder?: "asc" | "desc";
  
  // === PAGINATION ===
  limit?: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

// === ENHANCED TABLE CONFIGURATIONS ===
export const ENHANCED_TABLE_CONFIGS = {
  FUNDS: {
    tableName: 'VMFS_Funds_Enhanced',
    partitionKey: 'schemeCode',
    globalSecondaryIndexes: [
      {
        indexName: 'FundHouse-Category-Index',
        partitionKey: 'gsi1pk', // fundHouse
        sortKey: 'gsi1sk', // fundType#sebiCategory
      },
      {
        indexName: 'FundType-ExpenseRatio-Index',
        partitionKey: 'gsi2pk', // fundType
        sortKey: 'gsi2sk', // expenseRatio#{expenseRatio}
      },
      {
        indexName: 'Risk-AUM-Index',
        partitionKey: 'gsi3pk', // riskOMeter
        sortKey: 'gsi3sk', // amcAUMInCr#{amcAUMInCr}
      }
    ]
  },
  NAV_HISTORY: {
    tableName: 'VMFS_NAVHistory_Enhanced',
    partitionKey: 'pk', // NAV#{schemeCode}
    sortKey: 'sk', // DATE#{YYYY-MM-DD}
    globalSecondaryIndexes: [
      {
        indexName: 'Latest-NAV-Index',
        partitionKey: 'gsi1pk', // LATEST#{schemeCode}
        sortKey: 'gsi1sk', // timestamp
      }
    ]
  },
  FUND_METRICS: {
    tableName: 'VMFS_FundMetrics_Enhanced',
    partitionKey: 'pk', // METRICS#{schemeCode}
    sortKey: 'sk', // CURRENT or HISTORICAL#{YYYY-MM}
    globalSecondaryIndexes: [
      {
        indexName: 'Category-Performance-Index',
        partitionKey: 'gsi1pk', // CATEGORY#{fundType}#{sebiCategory}
        sortKey: 'gsi1sk', // RETURN1Y#{returns1Year}
      },
      {
        indexName: 'Risk-Sharpe-Index',
        partitionKey: 'gsi2pk', // RISK#{riskOMeter}
        sortKey: 'gsi2sk', // SHARPE#{sharpeRatio}
      },
      {
        indexName: 'AUM-Expense-Index',
        partitionKey: 'gsi3pk', // AUM#{aumRange}
        sortKey: 'gsi3sk', // EXPENSE#{expenseRatio}
      }
    ]
  },
  BENCHMARKS: {
    tableName: 'VMFS_Benchmarks',
    partitionKey: 'pk', // BENCHMARK#{benchmarkId}
    sortKey: 'sk', // DATE#{YYYY-MM-DD}
    globalSecondaryIndexes: [
      {
        indexName: 'Latest-Benchmark-Index',
        partitionKey: 'gsi1pk', // LATEST#{benchmarkId}
        sortKey: 'gsi1sk', // timestamp
      }
    ]
  }
} as const;

// === IMPLEMENTATION CONSTANTS ===
export const ENHANCED_IMPLEMENTATION_NOTES = {
  dataVolume: "37,141+ mutual fund schemes with comprehensive categorization",
  estimatedRecords: {
    funds: "37,141",
    navHistory: "~50M records",
    metrics: "~37,141 current + historical snapshots",
    benchmarks: "~500 benchmark series"
  },
  performanceTargets: {
    advancedSearchLatency: "<200ms",
    filterCombinationSupport: "Unlimited combinations",
    realTimeUpdates: "Daily NAV, Weekly metrics",
    concurrentUsers: "1000+"
  },
  enhancedFeatures: [
    "Comprehensive SEBI categorization",
    "Internal style and theme tagging",
    "Portfolio composition analysis",
    "Benchmark comparison framework",
    "Advanced risk metrics",
    "Multi-dimensional filtering",
    "Performance quartile ranking",
    "Real-time portfolio overlap analysis"
  ]
};