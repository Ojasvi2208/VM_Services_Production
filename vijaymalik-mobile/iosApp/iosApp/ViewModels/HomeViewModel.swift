import Foundation
import Combine

class HomeViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var indianMarkets: [MarketIndex] = []
    @Published var usMarkets: [MarketIndex] = []
    @Published var europeanMarkets: [MarketIndex] = []
    @Published var headlines: [Headline] = []
    @Published var nfos: [NFO] = []
    @Published var topEquityFunds: [MutualFund] = []
    @Published var topDebtFunds: [MutualFund] = []
    @Published var topHybridFunds: [MutualFund] = []
    @Published var error: String?
    
    private var cancellables = Set<AnyCancellable>()
    
    func loadDailyBriefing() {
        isLoading = true
        error = nil
        
        // Simulate API call - In production, this would call the shared KMP module
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.loadMockData()
            self?.isLoading = false
        }
    }
    
    private func loadMockData() {
        // Mock Indian Markets
        indianMarkets = [
            MarketIndex(
                id: "1",
                symbol: "SENSEX",
                name: "BSE Sensex",
                country: "IN",
                countryFlag: "🇮🇳",
                value: 72456.32,
                change: 856.45,
                changePercent: 1.2,
                previousClose: 71599.87,
                lastUpdated: "2026-02-05T15:30:00",
                isMarketOpen: false
            ),
            MarketIndex(
                id: "2",
                symbol: "NIFTY50",
                name: "Nifty 50",
                country: "IN",
                countryFlag: "🇮🇳",
                value: 21890.45,
                change: 195.30,
                changePercent: 0.9,
                previousClose: 21695.15,
                lastUpdated: "2026-02-05T15:30:00",
                isMarketOpen: false
            )
        ]
        
        // Mock US Markets
        usMarkets = [
            MarketIndex(
                id: "3",
                symbol: "S&P 500",
                name: "S&P 500",
                country: "US",
                countryFlag: "🇺🇸",
                value: 5234.18,
                change: -15.67,
                changePercent: -0.3,
                previousClose: 5249.85,
                lastUpdated: "2026-02-05T16:00:00",
                isMarketOpen: false
            ),
            MarketIndex(
                id: "4",
                symbol: "NASDAQ",
                name: "NASDAQ",
                country: "US",
                countryFlag: "🇺🇸",
                value: 18456.78,
                change: -92.34,
                changePercent: -0.5,
                previousClose: 18549.12,
                lastUpdated: "2026-02-05T16:00:00",
                isMarketOpen: false
            )
        ]
        
        // Mock Headlines
        headlines = [
            Headline(
                id: "1",
                title: "RBI keeps repo rate unchanged at 6.5%",
                source: "Economic Times",
                publishedAt: "2 hours ago",
                category: .economy,
                isBreaking: true
            ),
            Headline(
                id: "2",
                title: "TCS Q4 results beat street estimates",
                source: "Mint",
                publishedAt: "4 hours ago",
                category: .corporate,
                isBreaking: false
            ),
            Headline(
                id: "3",
                title: "FIIs turn net buyers after 5 sessions",
                source: "Moneycontrol",
                publishedAt: "5 hours ago",
                category: .markets,
                isBreaking: false
            ),
            Headline(
                id: "4",
                title: "New SEBI rules for mutual fund expense ratio",
                source: "Economic Times",
                publishedAt: "6 hours ago",
                category: .mutualFunds,
                isBreaking: false
            )
        ]
        
        // Mock NFOs
        nfos = [
            NFO(
                id: "1",
                schemeCode: "NFO001",
                schemeName: "HDFC Manufacturing Fund",
                fundHouse: "HDFC Mutual Fund",
                category: .equity,
                openDate: "2026-02-10",
                closeDate: "2026-02-24",
                minInvestment: 5000,
                nfoType: "Open-ended",
                riskLevel: .high,
                description: "Invests in manufacturing sector",
                isOpen: true
            ),
            NFO(
                id: "2",
                schemeCode: "NFO002",
                schemeName: "ICICI Prudential Technology Fund",
                fundHouse: "ICICI Prudential",
                category: .equity,
                openDate: "2026-02-01",
                closeDate: "2026-02-15",
                minInvestment: 1000,
                nfoType: "Open-ended",
                riskLevel: .veryHigh,
                description: "Technology sector focus",
                isOpen: true
            ),
            NFO(
                id: "3",
                schemeCode: "NFO003",
                schemeName: "SBI Green Energy Fund",
                fundHouse: "SBI Mutual Fund",
                category: .equity,
                openDate: "2026-02-05",
                closeDate: "2026-02-19",
                minInvestment: 500,
                nfoType: "Open-ended",
                riskLevel: .high,
                description: "Renewable energy companies",
                isOpen: true
            )
        ]
        
        // Mock Top Funds
        topEquityFunds = [
            MutualFund(
                id: "1",
                schemeCode: "EQ001",
                schemeName: "Quant Small Cap Fund Direct Growth",
                fundHouse: "Quant Mutual Fund",
                category: .equity,
                subCategory: "Small Cap",
                nav: 234.56,
                navDate: "2026-02-05",
                aum: 12345,
                expenseRatio: 0.62,
                riskLevel: .veryHigh,
                returns: FundReturns(return1M: 5.2, return3M: 12.5, return6M: 18.3, return1Y: 45.2, return3Y: 28.4, return5Y: 22.1)
            ),
            MutualFund(
                id: "2",
                schemeCode: "EQ002",
                schemeName: "Nippon India Small Cap Fund Direct Growth",
                fundHouse: "Nippon India",
                category: .equity,
                subCategory: "Small Cap",
                nav: 156.78,
                navDate: "2026-02-05",
                aum: 34567,
                expenseRatio: 0.75,
                riskLevel: .veryHigh,
                returns: FundReturns(return1M: 4.8, return3M: 11.2, return6M: 16.5, return1Y: 42.8, return3Y: 26.5, return5Y: 20.3)
            ),
            MutualFund(
                id: "3",
                schemeCode: "EQ003",
                schemeName: "HDFC Mid-Cap Opportunities Fund Direct Growth",
                fundHouse: "HDFC Mutual Fund",
                category: .equity,
                subCategory: "Mid Cap",
                nav: 189.34,
                navDate: "2026-02-05",
                aum: 45678,
                expenseRatio: 0.82,
                riskLevel: .high,
                returns: FundReturns(return1M: 3.5, return3M: 9.8, return6M: 14.2, return1Y: 38.5, return3Y: 22.4, return5Y: 18.2)
            )
        ]
        
        topDebtFunds = [
            MutualFund(
                id: "4",
                schemeCode: "DT001",
                schemeName: "HDFC Corporate Bond Fund Direct Growth",
                fundHouse: "HDFC Mutual Fund",
                category: .debt,
                subCategory: "Corporate Bond",
                nav: 28.45,
                navDate: "2026-02-05",
                aum: 23456,
                expenseRatio: 0.35,
                riskLevel: .low,
                returns: FundReturns(return1M: 0.6, return3M: 1.8, return6M: 3.5, return1Y: 7.8, return3Y: 7.2, return5Y: 7.5)
            ),
            MutualFund(
                id: "5",
                schemeCode: "DT002",
                schemeName: "ICICI Prudential All Seasons Bond Fund Direct Growth",
                fundHouse: "ICICI Prudential",
                category: .debt,
                subCategory: "Dynamic Bond",
                nav: 34.67,
                navDate: "2026-02-05",
                aum: 12345,
                expenseRatio: 0.42,
                riskLevel: .moderatelyLow,
                returns: FundReturns(return1M: 0.5, return3M: 1.6, return6M: 3.2, return1Y: 7.2, return3Y: 6.8, return5Y: 7.1)
            )
        ]
        
        topHybridFunds = [
            MutualFund(
                id: "6",
                schemeCode: "HY001",
                schemeName: "ICICI Prudential Balanced Advantage Fund Direct Growth",
                fundHouse: "ICICI Prudential",
                category: .hybrid,
                subCategory: "Balanced Advantage",
                nav: 67.89,
                navDate: "2026-02-05",
                aum: 56789,
                expenseRatio: 0.95,
                riskLevel: .moderate,
                returns: FundReturns(return1M: 2.1, return3M: 6.5, return6M: 10.2, return1Y: 18.5, return3Y: 14.2, return5Y: 12.8)
            ),
            MutualFund(
                id: "7",
                schemeCode: "HY002",
                schemeName: "HDFC Balanced Advantage Fund Direct Growth",
                fundHouse: "HDFC Mutual Fund",
                category: .hybrid,
                subCategory: "Balanced Advantage",
                nav: 45.23,
                navDate: "2026-02-05",
                aum: 67890,
                expenseRatio: 0.88,
                riskLevel: .moderate,
                returns: FundReturns(return1M: 1.8, return3M: 5.8, return6M: 9.5, return1Y: 16.2, return3Y: 13.5, return5Y: 11.9)
            )
        ]
    }
}
