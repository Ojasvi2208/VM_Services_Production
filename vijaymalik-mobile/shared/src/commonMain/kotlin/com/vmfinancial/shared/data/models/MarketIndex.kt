package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

/**
 * Market Index data model
 * Represents stock market indices like SENSEX, NIFTY, S&P 500, etc.
 */
@Serializable
data class MarketIndex(
    val symbol: String,           // e.g., "SENSEX", "NIFTY50", "SPX"
    val name: String,             // e.g., "BSE Sensex", "Nifty 50", "S&P 500"
    val country: String,          // e.g., "IN", "US", "UK", "EU"
    val countryFlag: String,      // e.g., "🇮🇳", "🇺🇸", "🇬🇧", "🇪🇺"
    val value: Double,            // Current value
    val change: Double,           // Change in points
    val changePercent: Double,    // Change in percentage
    val previousClose: Double,    // Previous day close
    val lastUpdated: String,      // ISO timestamp
    val isMarketOpen: Boolean = false
) {
    val isPositive: Boolean get() = change >= 0
    
    val formattedValue: String get() {
        val rounded = (value * 100).toLong() / 100.0
        return rounded.toString()
    }
    
    val formattedChange: String get() {
        val rounded = (kotlin.math.abs(change) * 100).toLong() / 100.0
        return if (isPositive) "+$rounded" else "-$rounded"
    }
    
    val formattedChangePercent: String get() {
        val rounded = (kotlin.math.abs(changePercent) * 100).toLong() / 100.0
        return if (isPositive) "+$rounded%" else "-$rounded%"
    }
}

/**
 * Predefined market indices we track
 */
object MarketIndices {
    // Indian Markets
    val SENSEX = "SENSEX"
    val NIFTY50 = "NIFTY50"
    val NIFTYBANK = "NIFTYBANK"
    val NIFTYIT = "NIFTYIT"
    
    // US Markets
    val SPX = "SPX"      // S&P 500
    val DJI = "DJI"      // Dow Jones
    val IXIC = "IXIC"    // NASDAQ
    
    // UK Markets
    val FTSE = "FTSE"    // FTSE 100
    
    // European Markets
    val DAX = "DAX"      // Germany DAX
    val CAC = "CAC"      // France CAC 40
    
    // Asian Markets
    val HSI = "HSI"      // Hang Seng
    val N225 = "N225"    // Nikkei 225
}
