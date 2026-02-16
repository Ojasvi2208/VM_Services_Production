package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

@Serializable
data class CurrencyRate(
    val pair: String,        // e.g., "USD/INR"
    val rate: Double,
    val change: Double,
    val changePercent: Double,
    val flag: String = "",   // e.g., "🇺🇸"
    val name: String = ""    // e.g., "US Dollar"
) {
    val isPositive: Boolean get() = change >= 0
    
    val formattedRate: String get() = String.format("%.4f", rate)
    
    val formattedChange: String get() {
        val sign = if (isPositive) "+" else ""
        return "$sign${String.format("%.4f", change)}"
    }
    
    val formattedChangePercent: String get() {
        val sign = if (isPositive) "+" else ""
        return "$sign${String.format("%.2f", changePercent)}%"
    }
}

@Serializable
data class CurrencyRatesResponse(
    val success: Boolean,
    val rates: List<CurrencyRate>? = null,
    val lastUpdated: String? = null,
    val error: String? = null
)
