package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

@Serializable
data class CommodityItem(
    val symbol: String,
    val name: String,
    val price: Double,
    val change: Double,
    val changePercent: Double,
    val currency: String = "INR",
    val unit: String = ""
) {
    val isPositive: Boolean get() = change >= 0
    
    val formattedPrice: String get() {
        return if (currency == "INR") "₹${String.format("%.2f", price)}"
        else "$${String.format("%.2f", price)}"
    }
    
    val formattedChange: String get() {
        val sign = if (isPositive) "+" else ""
        return "$sign${String.format("%.2f", change)}"
    }
    
    val formattedChangePercent: String get() {
        val sign = if (isPositive) "+" else ""
        return "$sign${String.format("%.2f", changePercent)}%"
    }
}

@Serializable
data class CommoditiesResponse(
    val success: Boolean,
    val commodities: List<CommodityItem>? = null,
    val lastUpdated: String? = null,
    val error: String? = null
)
