package com.vmfinancial.shared.data.api

import com.vmfinancial.shared.data.models.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*

/**
 * Mutual Fund API Client
 * Fetches NAV data from AMFI (FREE)
 * 
 * Note: Detailed fund analytics (ratings, overlap, etc.) require PAID APIs
 * Currently using dummy data for those features
 */
class MutualFundApi {
    
    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
            })
        }
    }
    
    /**
     * Fetch all NAVs from AMFI
     * Source: AMFI India (FREE)
     * Updated daily by 11 PM IST
     */
    suspend fun fetchAllNAVs(): List<MutualFund> {
        return try {
            val response: String = client.get(ApiConfig.AMFI_NAV_URL).body()
            parseAMFIData(response)
        } catch (e: Exception) {
            println("Error fetching AMFI NAVs: ${e.message}")
            emptyList()
        }
    }
    
    /**
     * Parse AMFI NAV text file format
     * Format: Scheme Code;ISIN Div Payout/Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
     */
    private fun parseAMFIData(data: String): List<MutualFund> {
        val funds = mutableListOf<MutualFund>()
        var currentFundHouse = ""
        
        data.lines().forEach { line ->
            when {
                line.isBlank() -> { /* skip */ }
                !line.contains(";") -> {
                    // This is a fund house name
                    currentFundHouse = line.trim()
                }
                else -> {
                    // This is a scheme line
                    val parts = line.split(";")
                    if (parts.size >= 5) {
                        try {
                            val schemeCode = parts[0].trim()
                            val schemeName = parts[3].trim()
                            val navString = parts[4].trim()
                            val navDate = if (parts.size > 5) parts[5].trim() else ""
                            
                            val nav = navString.toDoubleOrNull() ?: 0.0
                            if (nav > 0 && schemeCode.isNotBlank()) {
                                funds.add(
                                    MutualFund(
                                        schemeCode = schemeCode,
                                        schemeName = schemeName,
                                        fundHouse = currentFundHouse,
                                        category = detectCategory(schemeName),
                                        subCategory = detectSubCategory(schemeName),
                                        nav = nav,
                                        navDate = navDate
                                    )
                                )
                            }
                        } catch (e: Exception) {
                            // Skip malformed lines
                        }
                    }
                }
            }
        }
        
        return funds
    }
    
    /**
     * Detect fund category from scheme name
     */
    private fun detectCategory(schemeName: String): FundCategory {
        val name = schemeName.lowercase()
        return when {
            name.contains("equity") || name.contains("large cap") || 
            name.contains("mid cap") || name.contains("small cap") ||
            name.contains("flexi cap") || name.contains("multi cap") ||
            name.contains("elss") || name.contains("index") -> FundCategory.EQUITY
            
            name.contains("debt") || name.contains("liquid") ||
            name.contains("overnight") || name.contains("money market") ||
            name.contains("gilt") || name.contains("corporate bond") -> FundCategory.DEBT
            
            name.contains("hybrid") || name.contains("balanced") ||
            name.contains("aggressive") || name.contains("conservative") ||
            name.contains("arbitrage") -> FundCategory.HYBRID
            
            name.contains("retirement") || name.contains("children") -> FundCategory.SOLUTION_ORIENTED
            
            else -> FundCategory.OTHER
        }
    }
    
    /**
     * Detect sub-category from scheme name
     */
    private fun detectSubCategory(schemeName: String): String {
        val name = schemeName.lowercase()
        return when {
            name.contains("large cap") -> "Large Cap"
            name.contains("mid cap") -> "Mid Cap"
            name.contains("small cap") -> "Small Cap"
            name.contains("flexi cap") -> "Flexi Cap"
            name.contains("multi cap") -> "Multi Cap"
            name.contains("elss") -> "ELSS"
            name.contains("index") -> "Index Fund"
            name.contains("liquid") -> "Liquid"
            name.contains("overnight") -> "Overnight"
            name.contains("gilt") -> "Gilt"
            name.contains("balanced advantage") -> "Balanced Advantage"
            name.contains("aggressive hybrid") -> "Aggressive Hybrid"
            name.contains("arbitrage") -> "Arbitrage"
            else -> "Other"
        }
    }
    
    /**
     * Get top performing equity funds
     * NOTE: Returns data uses DUMMY values as real returns require PAID API
     */
    suspend fun getTopEquityFunds(limit: Int = 10): List<MutualFund> {
        val allFunds = fetchAllNAVs()
        val equityFunds = allFunds.filter { it.category == FundCategory.EQUITY }
        
        // Add dummy returns data (PAID API needed for real returns)
        return equityFunds
            .filter { it.schemeName.contains("Direct") && it.schemeName.contains("Growth") }
            .take(limit)
            .map { fund ->
                if (DataSourceFlags.USE_DUMMY_FUND_DETAILS) {
                    fund.copy(
                        returns = MutualFundReturns(
                            return1Y = (15..45).random().toDouble(),
                            return3Y = (12..25).random().toDouble(),
                            return5Y = (10..20).random().toDouble()
                        ),
                        aum = (1000..50000).random().toDouble(),
                        expenseRatio = (0.1..1.5).random()
                    )
                } else {
                    fund
                }
            }
    }
    
    /**
     * Get top performing debt funds
     * NOTE: Returns data uses DUMMY values as real returns require PAID API
     */
    suspend fun getTopDebtFunds(limit: Int = 10): List<MutualFund> {
        val allFunds = fetchAllNAVs()
        val debtFunds = allFunds.filter { it.category == FundCategory.DEBT }
        
        return debtFunds
            .filter { it.schemeName.contains("Direct") && it.schemeName.contains("Growth") }
            .take(limit)
            .map { fund ->
                if (DataSourceFlags.USE_DUMMY_FUND_DETAILS) {
                    fund.copy(
                        returns = MutualFundReturns(
                            return1Y = (5..10).random().toDouble(),
                            return3Y = (6..9).random().toDouble(),
                            return5Y = (6..8).random().toDouble()
                        ),
                        aum = (500..20000).random().toDouble(),
                        expenseRatio = (0.1..0.5).random(),
                        riskLevel = RiskLevel.LOW
                    )
                } else {
                    fund
                }
            }
    }
    
    /**
     * Get top performing hybrid funds
     * NOTE: Returns data uses DUMMY values as real returns require PAID API
     */
    suspend fun getTopHybridFunds(limit: Int = 10): List<MutualFund> {
        val allFunds = fetchAllNAVs()
        val hybridFunds = allFunds.filter { it.category == FundCategory.HYBRID }
        
        return hybridFunds
            .filter { it.schemeName.contains("Direct") && it.schemeName.contains("Growth") }
            .take(limit)
            .map { fund ->
                if (DataSourceFlags.USE_DUMMY_FUND_DETAILS) {
                    fund.copy(
                        returns = MutualFundReturns(
                            return1Y = (10..25).random().toDouble(),
                            return3Y = (10..18).random().toDouble(),
                            return5Y = (9..15).random().toDouble()
                        ),
                        aum = (1000..30000).random().toDouble(),
                        expenseRatio = (0.2..1.0).random(),
                        riskLevel = RiskLevel.MODERATE
                    )
                } else {
                    fund
                }
            }
    }
    
    /**
     * Search funds by name
     */
    suspend fun searchFunds(query: String): List<MutualFund> {
        val allFunds = fetchAllNAVs()
        val searchQuery = query.lowercase()
        
        return allFunds.filter { 
            it.schemeName.lowercase().contains(searchQuery) ||
            it.fundHouse.lowercase().contains(searchQuery)
        }.take(50)
    }
    
    fun close() {
        client.close()
    }
}

/**
 * Extension to generate random double in range
 */
private fun ClosedFloatingPointRange<Double>.random(): Double {
    return start + (kotlin.random.Random.nextDouble() * (endInclusive - start))
}
