package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

/**
 * Mutual Fund data model
 * Represents mutual fund scheme details
 */
@Serializable
data class MutualFund(
    val schemeCode: String,           // AMFI scheme code
    val schemeName: String,           // Full scheme name
    val fundHouse: String,            // AMC name
    val category: FundCategory,       // Equity, Debt, Hybrid, etc.
    val subCategory: String,          // Large Cap, Mid Cap, etc.
    val nav: Double,                  // Current NAV
    val navDate: String,              // NAV date
    val aum: Double? = null,          // Assets Under Management in Cr
    val expenseRatio: Double? = null, // Expense ratio percentage
    val riskLevel: RiskLevel = RiskLevel.MODERATE,
    val returns: MutualFundReturns? = null,
    val minInvestment: Int = 100,     // Minimum investment amount
    val minSIP: Int = 100,            // Minimum SIP amount
    val fundManager: String? = null,
    val launchDate: String? = null,
    val benchmark: String? = null
) {
    val formattedNav: String get() = "₹${nav.toString().take(10)}"
    val formattedAum: String get() = aum?.let { "₹${it.toLong()} Cr" } ?: "N/A"
}

@Serializable
data class MutualFundReturns(
    val return1M: Double? = null,
    val return3M: Double? = null,
    val return6M: Double? = null,
    val return1Y: Double? = null,
    val return3Y: Double? = null,
    val return5Y: Double? = null,
    val returnSinceInception: Double? = null
) {
    fun formatReturn(value: Double?): String {
        return value?.let {
            val rounded = (it * 100).toLong() / 100.0
            if (it >= 0) "+${rounded}%"
            else "${rounded}%"
        } ?: "N/A"
    }
}

@Serializable
enum class FundCategory {
    EQUITY,
    DEBT,
    HYBRID,
    SOLUTION_ORIENTED,
    OTHER
}

@Serializable
enum class RiskLevel {
    LOW,
    MODERATELY_LOW,
    MODERATE,
    MODERATELY_HIGH,
    HIGH,
    VERY_HIGH
}

/**
 * NFO (New Fund Offer) data model
 */
@Serializable
data class NFO(
    val schemeCode: String,
    val schemeName: String,
    val fundHouse: String,
    val category: FundCategory,
    val openDate: String,
    val closeDate: String,
    val minInvestment: Int,
    val nfoType: String,              // Open-ended, Close-ended
    val riskLevel: RiskLevel,
    val description: String? = null,
    val isOpen: Boolean = true
)
