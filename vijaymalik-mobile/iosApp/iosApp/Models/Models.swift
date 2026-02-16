import Foundation

// MARK: - Market Index
struct MarketIndex: Identifiable {
    let id: String
    let symbol: String
    let name: String
    let country: String
    let countryFlag: String
    let value: Double
    let change: Double
    let changePercent: Double
    let previousClose: Double
    let lastUpdated: String
    let isMarketOpen: Bool
    
    var isPositive: Bool { change >= 0 }
    
    var formattedValue: String {
        String(format: "%,.2f", value)
    }
    
    var formattedChange: String {
        let sign = isPositive ? "+" : ""
        return "\(sign)\(String(format: "%,.2f", change))"
    }
    
    var formattedChangePercent: String {
        let sign = isPositive ? "+" : ""
        return "\(sign)\(String(format: "%.2f", changePercent))%"
    }
}

// MARK: - Mutual Fund
struct MutualFund: Identifiable {
    let id: String
    let schemeCode: String
    let schemeName: String
    let fundHouse: String
    let category: FundCategory
    let subCategory: String
    let nav: Double
    let navDate: String
    var aum: Double?
    var expenseRatio: Double?
    var riskLevel: RiskLevel
    var returns: FundReturns?
    var minInvestment: Int = 100
    var minSIP: Int = 100
    var fundManager: String?
    var launchDate: String?
    var benchmark: String?
    
    var formattedNav: String {
        "₹\(String(format: "%.4f", nav))"
    }
    
    var formattedAum: String {
        guard let aum = aum else { return "N/A" }
        return "₹\(String(format: "%,.0f", aum)) Cr"
    }
}

// MARK: - Fund Returns
struct FundReturns {
    var return1M: Double?
    var return3M: Double?
    var return6M: Double?
    var return1Y: Double?
    var return3Y: Double?
    var return5Y: Double?
    var returnSinceInception: Double?
    
    func formatReturn(_ value: Double?) -> String {
        guard let value = value else { return "N/A" }
        let sign = value >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", value))%"
    }
}

// MARK: - Fund Category
enum FundCategory: String {
    case equity = "Equity"
    case debt = "Debt"
    case hybrid = "Hybrid"
    case solutionOriented = "Solution Oriented"
    case other = "Other"
}

// MARK: - Risk Level
enum RiskLevel: String {
    case low = "Low"
    case moderatelyLow = "Moderately Low"
    case moderate = "Moderate"
    case moderatelyHigh = "Moderately High"
    case high = "High"
    case veryHigh = "Very High"
}

// MARK: - NFO (New Fund Offer)
struct NFO: Identifiable {
    let id: String
    let schemeCode: String
    let schemeName: String
    let fundHouse: String
    let category: FundCategory
    let openDate: String
    let closeDate: String
    let minInvestment: Int
    let nfoType: String
    let riskLevel: RiskLevel
    var description: String?
    var isOpen: Bool = true
}

// MARK: - News
struct NewsArticle: Identifiable {
    let id: String
    let title: String
    var summary: String?
    var content: String?
    let source: String
    let sourceUrl: String
    var imageUrl: String?
    let category: NewsCategory
    let publishedAt: String
    var readTimeMinutes: Int = 2
}

enum NewsCategory: String {
    case markets = "Markets"
    case mutualFunds = "Mutual Funds"
    case stocks = "Stocks"
    case economy = "Economy"
    case corporate = "Corporate"
    case global = "Global"
    case personalFinance = "Personal Finance"
    case ipo = "IPO"
    case nfo = "NFO"
}

// MARK: - Headline
struct Headline: Identifiable {
    let id: String
    let title: String
    let source: String
    let publishedAt: String
    let category: NewsCategory
    var isBreaking: Bool = false
}
