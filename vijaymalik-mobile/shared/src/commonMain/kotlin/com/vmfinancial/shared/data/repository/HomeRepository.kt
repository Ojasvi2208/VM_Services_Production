package com.vmfinancial.shared.data.repository

import com.vmfinancial.shared.data.api.MarketDataApi
import com.vmfinancial.shared.data.api.MutualFundApi
import com.vmfinancial.shared.data.models.*

/**
 * Home Repository
 * Aggregates data for the home screen daily briefing
 */
class HomeRepository {
    
    private val marketApi = MarketDataApi()
    private val fundApi = MutualFundApi()
    
    /**
     * Get daily briefing data for home screen
     */
    suspend fun getDailyBriefing(): DailyBriefing {
        val indianIndices = marketApi.getIndianIndices()
        val usIndices = marketApi.getUSIndices()
        val europeanIndices = marketApi.getEuropeanIndices()
        
        return DailyBriefing(
            indianMarkets = indianIndices,
            usMarkets = usIndices,
            europeanMarkets = europeanIndices,
            topEquityFunds = fundApi.getTopEquityFunds(5),
            topDebtFunds = fundApi.getTopDebtFunds(5),
            topHybridFunds = fundApi.getTopHybridFunds(5),
            headlines = getDummyHeadlines(), // TODO: Integrate RSS feeds
            nfos = getDummyNFOs() // TODO: Integrate real NFO data
        )
    }
    
    /**
     * Get market indices by region
     */
    suspend fun getMarketsByRegion(region: String): List<MarketIndex> {
        return when (region.uppercase()) {
            "IN", "INDIA" -> marketApi.getIndianIndices()
            "US", "USA" -> marketApi.getUSIndices()
            "UK", "GB" -> marketApi.getEuropeanIndices().filter { it.country == "UK" }
            "EU", "EUROPE" -> marketApi.getEuropeanIndices()
            "ASIA" -> marketApi.getAsianIndices()
            else -> marketApi.getAllIndices()
        }
    }
    
    /**
     * Dummy headlines until RSS integration
     * TODO: Replace with real RSS feed parsing
     */
    private fun getDummyHeadlines(): List<Headline> {
        return listOf(
            Headline(
                id = "1",
                title = "RBI keeps repo rate unchanged at 6.5%",
                source = "Economic Times",
                publishedAt = "2 hours ago",
                category = NewsCategory.ECONOMY,
                isBreaking = true
            ),
            Headline(
                id = "2",
                title = "TCS Q4 results beat street estimates",
                source = "Mint",
                publishedAt = "4 hours ago",
                category = NewsCategory.CORPORATE
            ),
            Headline(
                id = "3",
                title = "FIIs turn net buyers after 5 sessions",
                source = "Moneycontrol",
                publishedAt = "5 hours ago",
                category = NewsCategory.MARKETS
            ),
            Headline(
                id = "4",
                title = "New SEBI rules for mutual fund expense ratio",
                source = "Economic Times",
                publishedAt = "6 hours ago",
                category = NewsCategory.MUTUAL_FUNDS
            )
        )
    }
    
    /**
     * Dummy NFOs until real integration
     * TODO: Replace with real NFO data from AMFI/AMC websites
     */
    private fun getDummyNFOs(): List<NFO> {
        return listOf(
            NFO(
                schemeCode = "NFO001",
                schemeName = "HDFC Manufacturing Fund",
                fundHouse = "HDFC Mutual Fund",
                category = FundCategory.EQUITY,
                openDate = "2026-02-10",
                closeDate = "2026-02-24",
                minInvestment = 5000,
                nfoType = "Open-ended",
                riskLevel = RiskLevel.HIGH,
                description = "Invests in manufacturing sector companies"
            ),
            NFO(
                schemeCode = "NFO002",
                schemeName = "ICICI Prudential Technology Fund",
                fundHouse = "ICICI Prudential",
                category = FundCategory.EQUITY,
                openDate = "2026-02-01",
                closeDate = "2026-02-15",
                minInvestment = 1000,
                nfoType = "Open-ended",
                riskLevel = RiskLevel.VERY_HIGH,
                description = "Focused on technology sector"
            ),
            NFO(
                schemeCode = "NFO003",
                schemeName = "SBI Green Energy Fund",
                fundHouse = "SBI Mutual Fund",
                category = FundCategory.EQUITY,
                openDate = "2026-02-05",
                closeDate = "2026-02-19",
                minInvestment = 500,
                nfoType = "Open-ended",
                riskLevel = RiskLevel.HIGH,
                description = "Invests in renewable energy companies"
            )
        )
    }
    
    fun close() {
        marketApi.close()
        fundApi.close()
    }
}

/**
 * Daily Briefing data class
 * Contains all data needed for the home screen
 */
data class DailyBriefing(
    val indianMarkets: List<MarketIndex>,
    val usMarkets: List<MarketIndex>,
    val europeanMarkets: List<MarketIndex>,
    val topEquityFunds: List<MutualFund>,
    val topDebtFunds: List<MutualFund>,
    val topHybridFunds: List<MutualFund>,
    val headlines: List<Headline>,
    val nfos: List<NFO>
)
