/**
 * Enhanced DynamoDB Schema Design for Comprehensive Mutual Fund System
 * 
 * SCOPE: 37,141 mutual fund schemes from Funds_Schema.json
 * DATA SOURCES: 
 * - MF API (https://api.mfapi.in/mf/scheme_code/latest)
 * - MF API Historical (https://api.mfapi.in/mf/scheme_code)
 * - AMFI NAV Data
 * 
 * TABLES:
 * 1. Funds - Master fund information
 * 2. NAVHistory - Daily NAV records
 * 3. FundMetrics - Calculated returns and analytics
 * 4. FundCategories - Enhanced categorization for search
 */

export interface FundMaster {
  // Primary Key
  schemeCode: string; // PK: "120503"
  
  // Basic Information
  schemeName: string;
  fundHouse: string;
  schemeType: string;
  schemeCategory: string;
  
  // ISIN Codes
  isinGrowth?: string;
  isinDivReinvestment?: string;
  
  // Fund Details (from MF API)
  launchDate?: string; // "01-Jan-2013"
  expenseRatio?: number; // 0.52
  fundManager?: string;
  aum?: string; // "₹32,450 Cr"
  
  // Enhanced Categorization
  primaryCategory: string; // "Equity", "Debt", "Hybrid"
  subCategory: string; // "Large Cap", "Mid Cap", "Small Cap"
  investmentObjective?: string;
  riskLevel: "Low" | "Medium" | "High" | "Very High";
  
  // Search Optimization
  searchTerms: string[]; // For BST-like search
  tags: string[]; // ["Large Cap", "Equity", "SBI", "Bluechip"]
  
  // Status
  isActive: boolean;
  lastUpdated: string; // ISO timestamp
  
  // GSI Keys for efficient querying
  gsi1pk: string; // fundHouse
  gsi1sk: string; // primaryCategory#subCategory
  gsi2pk: string; // primaryCategory
  gsi2sk: string; // schemeCode
}

export interface NAVRecord {
  // Primary Key
  pk: string; // "NAV#{schemeCode}"
  sk: string; // "DATE#{YYYY-MM-DD}"
  
  // NAV Data
  schemeCode: string;
  date: string; // "30-Sep-2024"
  nav: number; // 65.43
  
  // Change Calculations
  previousNav?: number;
  absoluteChange?: number; // +1.12
  percentageChange?: number; // +1.74
  
  // Metadata
  source: "MFAPI" | "AMFI" | "MANUAL";
  timestamp: string; // ISO timestamp
  
  // GSI for latest NAV queries
  gsi1pk: string; // "LATEST#{schemeCode}"
  gsi1sk: string; // "DATE#{YYYY-MM-DD}"
}

export interface FundMetrics {
  // Primary Key
  pk: string; // "METRICS#{schemeCode}"
  sk: string; // "CURRENT"
  
  schemeCode: string;
  
  // Latest NAV Information
  latestNAV: number;
  latestNAVDate: string;
  previousNAV?: number;
  dailyChange: number;
  dailyChangePercent: number;
  
  // Rolling Returns (annualized %)
  returns1Week?: number;
  returns1Month?: number;
  returns3Month?: number;
  returns6Month?: number;
  returns1Year?: number;
  returns2Year?: number;
  returns3Year?: number;
  returns5Year?: number;
  returns7Year?: number;
  returns10Year?: number;
  returnsSinceInception?: number;
  
  // Risk Metrics
  volatility1Year?: number; // Standard deviation
  volatility3Year?: number;
  volatility5Year?: number;
  maxDrawdown?: number; // Maximum drawdown %
  maxDrawdownDate?: string;
  
  // Performance Metrics
  sharpeRatio1Year?: number;
  sharpeRatio3Year?: number;
  beta?: number; // Against benchmark
  alpha?: number;
  
  // Ranking Data
  categoryRank?: number;
  totalFundsInCategory?: number;
  percentileRank?: number;
  
  // Calculation Metadata
  lastCalculated: string;
  dataPoints: number; // Number of NAV records used
  
  // GSI for performance queries
  gsi1pk: string; // "CATEGORY#{primaryCategory}#{subCategory}"
  gsi1sk: string; // "RETURN1Y#{returns1Year}"
  gsi2pk: string; // "PERFORMANCE"
  gsi2sk: string; // "SHARPE1Y#{sharpeRatio1Year}"
}

export interface FundCategory {
  // Primary Key
  pk: string; // "CATEGORY#{primaryCategory}"
  sk: string; // "SUBCAT#{subCategory}"
  
  // Category Information
  primaryCategory: string;
  subCategory: string;
  description: string;
  
  // Search Tree Structure (BST-like)
  parentCategory?: string;
  childCategories: string[];
  level: number; // Tree depth
  
  // Fund Statistics
  totalFunds: number;
  activeFunds: number;
  averageReturns1Year?: number;
  averageReturns3Year?: number;
  averageReturns5Year?: number;
  
  // Search Optimization
  searchKeywords: string[];
  popularityScore: number; // Based on search frequency
  
  lastUpdated: string;
  
  // GSI for category browsing
  gsi1pk: string; // "BROWSE"
  gsi1sk: string; // "LEVEL#{level}#{primaryCategory}"
}

// DynamoDB Table Configurations
export const TABLE_CONFIGS = {
  FUNDS: {
    tableName: 'VMFS_Funds',
    partitionKey: 'schemeCode',
    globalSecondaryIndexes: [
      {
        indexName: 'FundHouse-Category-Index',
        partitionKey: 'gsi1pk', // fundHouse
        sortKey: 'gsi1sk', // primaryCategory#subCategory
      },
      {
        indexName: 'Category-SchemeCode-Index',
        partitionKey: 'gsi2pk', // primaryCategory
        sortKey: 'gsi2sk', // schemeCode
      }
    ]
  },
  NAV_HISTORY: {
    tableName: 'VMFS_NAVHistory',
    partitionKey: 'pk', // NAV#{schemeCode}
    sortKey: 'sk', // DATE#{YYYY-MM-DD}
    globalSecondaryIndexes: [
      {
        indexName: 'Latest-NAV-Index',
        partitionKey: 'gsi1pk', // LATEST#{schemeCode}
        sortKey: 'gsi1sk', // DATE#{YYYY-MM-DD}
      }
    ]
  },
  FUND_METRICS: {
    tableName: 'VMFS_FundMetrics',
    partitionKey: 'pk', // METRICS#{schemeCode}
    sortKey: 'sk', // CURRENT
    globalSecondaryIndexes: [
      {
        indexName: 'Category-Performance-Index',
        partitionKey: 'gsi1pk', // CATEGORY#{primaryCategory}#{subCategory}
        sortKey: 'gsi1sk', // RETURN1Y#{returns1Year}
      },
      {
        indexName: 'Performance-Ranking-Index',
        partitionKey: 'gsi2pk', // PERFORMANCE
        sortKey: 'gsi2sk', // SHARPE1Y#{sharpeRatio1Year}
      }
    ]
  },
  FUND_CATEGORIES: {
    tableName: 'VMFS_FundCategories',
    partitionKey: 'pk', // CATEGORY#{primaryCategory}
    sortKey: 'sk', // SUBCAT#{subCategory}
    globalSecondaryIndexes: [
      {
        indexName: 'Browse-Categories-Index',
        partitionKey: 'gsi1pk', // BROWSE
        sortKey: 'gsi1sk', // LEVEL#{level}#{primaryCategory}
      }
    ]
  }
} as const;

// Search Filter Interface for Advanced Search
export interface AdvancedSearchFilters {
  // Basic Filters
  fundHouse?: string[];
  primaryCategory?: string[];
  subCategory?: string[];
  riskLevel?: string[];
  
  // Performance Filters
  returns1Year?: { min?: number; max?: number };
  returns3Year?: { min?: number; max?: number };
  returns5Year?: { min?: number; max?: number };
  
  // Risk Filters
  maxDrawdown?: { min?: number; max?: number };
  volatility?: { min?: number; max?: number };
  
  // Size Filters
  aum?: { min?: number; max?: number };
  expenseRatio?: { min?: number; max?: number };
  
  // Text Search
  searchText?: string; // For fund name/keyword search
  
  // Advanced Filters
  launchDateAfter?: string;
  launchDateBefore?: string;
  isActive?: boolean;
  
  // Sorting
  sortBy?: 'returns1Year' | 'returns3Year' | 'returns5Year' | 'sharpeRatio' | 'aum' | 'expenseRatio';
  sortOrder?: 'asc' | 'desc';
  
  // Pagination
  limit?: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

// BST-like Search Tree Node for Fund Name Search
export interface SearchTreeNode {
  value: string;
  schemeCode: string;
  left?: SearchTreeNode;
  right?: SearchTreeNode;
  frequency: number; // Search frequency for optimization
}

export const IMPLEMENTATION_NOTES = {
  dataVolume: "37,141 mutual fund schemes",
  estimatedNAVRecords: "~50M records (37k funds × 10 years × 365 days)",
  apiSources: [
    "https://api.mfapi.in/mf/scheme_code/latest",
    "https://api.mfapi.in/mf/scheme_code",
    "https://www.amfiindia.com/spages/NAVAll.txt"
  ],
  performanceTargets: {
    searchLatency: "<100ms",
    dataFreshness: "Daily NAV updates",
    analyticsRefresh: "Weekly metrics calculation"
  },
  scalingConsiderations: [
    "Use DynamoDB on-demand billing for variable workloads",
    "Implement batch processing for historical data",
    "Use ElastiCache for frequently accessed data",
    "Consider DynamoDB Streams for real-time updates"
  ]
};