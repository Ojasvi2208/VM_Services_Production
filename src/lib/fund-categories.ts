// Comprehensive fund categorization system
export interface FundCategory {
  name: string;
  subCategories: string[];
  keywords: string[];
}

export const FUND_CATEGORIES: Record<string, FundCategory> = {
  equity: {
    name: "Equity Funds",
    subCategories: [
      "Large Cap Fund",
      "Large & Mid Cap Fund", 
      "Mid Cap Fund",
      "Small Cap Fund",
      "Multi Cap Fund",
      "Flexi Cap Fund",
      "ELSS",
      "Sectoral/Thematic Funds",
      "Value Fund",
      "Contra Fund",
      "Dividend Yield Fund",
      "Focused Fund"
    ],
    keywords: ["equity", "large cap", "mid cap", "small cap", "multi cap", "flexi cap", "elss", "sectoral", "thematic", "value", "contra", "dividend yield", "focused"]
  },
  debt: {
    name: "Debt Funds",
    subCategories: [
      "Overnight Fund",
      "Liquid Fund", 
      "Ultra Short Duration Fund",
      "Low Duration Fund",
      "Money Market Fund",
      "Short Duration Fund",
      "Medium Duration Fund",
      "Medium to Long Duration Fund",
      "Long Duration Fund",
      "Dynamic Bond Fund",
      "Corporate Bond Fund",
      "Credit Risk Fund",
      "Banking & PSU Fund",
      "Gilt Fund",
      "Gilt Fund with 10-year constant duration",
      "Floater Fund"
    ],
    keywords: ["debt", "bond", "overnight", "liquid", "duration", "money market", "corporate", "credit", "banking", "psu", "gilt", "floater"]
  },
  hybrid: {
    name: "Hybrid Funds", 
    subCategories: [
      "Conservative Hybrid Fund",
      "Balanced Hybrid Fund",
      "Aggressive Hybrid Fund", 
      "Dynamic Asset Allocation",
      "Balanced Advantage Fund",
      "Multi-Asset Allocation Fund",
      "Arbitrage Fund",
      "Equity Savings Fund"
    ],
    keywords: ["hybrid", "conservative", "balanced", "aggressive", "dynamic", "asset allocation", "multi-asset", "arbitrage", "equity savings"]
  },
  solution: {
    name: "Solution-Oriented Funds",
    subCategories: [
      "Retirement Fund",
      "Children's Fund"
    ],
    keywords: ["retirement", "children", "solution oriented"]
  },
  other: {
    name: "Other Categories",
    subCategories: [
      "Index Fund",
      "ETF",
      "Fund of Funds - Domestic",
      "Fund of Funds - International"
    ],
    keywords: ["index", "etf", "fund of funds", "fof", "international", "nifty", "sensex"]
  }
};

export function categorizeFund(schemeName: string): { category: string; subCategory: string } {
  const name = schemeName.toLowerCase();
  
  // Check each category and subcategory
  for (const [categoryKey, categoryData] of Object.entries(FUND_CATEGORIES)) {
    for (const subCategory of categoryData.subCategories) {
      const subCatLower = subCategory.toLowerCase();
      
      // Direct name matching
      if (name.includes(subCatLower.replace(/\s+/g, '\\s+'))) {
        return { category: categoryKey, subCategory };
      }
      
      // Keyword matching
      for (const keyword of categoryData.keywords) {
        if (name.includes(keyword)) {
          // More specific matching for subcategories
          if (subCatLower.includes(keyword) || keyword === "elss" && name.includes("tax")) {
            return { category: categoryKey, subCategory };
          }
        }
      }
    }
  }
  
  // Fallback categorization with enhanced logic
  if (name.includes("equity") || name.includes("stock") || name.includes("growth")) {
    if (name.includes("large") && name.includes("mid")) return { category: "equity", subCategory: "Large & Mid Cap Fund" };
    if (name.includes("large")) return { category: "equity", subCategory: "Large Cap Fund" };
    if (name.includes("mid")) return { category: "equity", subCategory: "Mid Cap Fund" };
    if (name.includes("small")) return { category: "equity", subCategory: "Small Cap Fund" };
    if (name.includes("multi")) return { category: "equity", subCategory: "Multi Cap Fund" };
    if (name.includes("flexi")) return { category: "equity", subCategory: "Flexi Cap Fund" };
    if (name.includes("tax") || name.includes("elss")) return { category: "equity", subCategory: "ELSS" };
    return { category: "equity", subCategory: "Multi Cap Fund" };
  }
  
  if (name.includes("debt") || name.includes("bond") || name.includes("income")) {
    if (name.includes("liquid")) return { category: "debt", subCategory: "Liquid Fund" };
    if (name.includes("short")) return { category: "debt", subCategory: "Short Duration Fund" };
    if (name.includes("medium")) return { category: "debt", subCategory: "Medium Duration Fund" };
    if (name.includes("long")) return { category: "debt", subCategory: "Long Duration Fund" };
    if (name.includes("corporate")) return { category: "debt", subCategory: "Corporate Bond Fund" };
    if (name.includes("gilt")) return { category: "debt", subCategory: "Gilt Fund" };
    return { category: "debt", subCategory: "Medium Duration Fund" };
  }
  
  if (name.includes("hybrid") || name.includes("balanced")) {
    if (name.includes("conservative")) return { category: "hybrid", subCategory: "Conservative Hybrid Fund" };
    if (name.includes("aggressive")) return { category: "hybrid", subCategory: "Aggressive Hybrid Fund" };
    if (name.includes("dynamic")) return { category: "hybrid", subCategory: "Dynamic Asset Allocation" };
    return { category: "hybrid", subCategory: "Balanced Hybrid Fund" };
  }
  
  if (name.includes("index") || name.includes("nifty") || name.includes("sensex")) {
    return { category: "other", subCategory: "Index Fund" };
  }
  
  if (name.includes("etf")) {
    return { category: "other", subCategory: "ETF" };
  }
  
  // Default fallback
  return { category: "other", subCategory: "Index Fund" };
}