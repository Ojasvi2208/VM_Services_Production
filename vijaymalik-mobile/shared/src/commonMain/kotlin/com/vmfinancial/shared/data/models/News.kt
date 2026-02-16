package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

/**
 * News article data model
 * Represents financial news items
 */
@Serializable
data class NewsArticle(
    val id: String,
    val title: String,
    val summary: String? = null,
    val content: String? = null,
    val source: String,              // ET, Mint, Moneycontrol, etc.
    val sourceUrl: String,
    val imageUrl: String? = null,
    val category: NewsCategory,
    val publishedAt: String,         // ISO timestamp
    val readTimeMinutes: Int = 2
) {
    val formattedTime: String get() {
        // Will be implemented with proper date formatting
        return publishedAt
    }
}

@Serializable
enum class NewsCategory {
    MARKETS,
    MUTUAL_FUNDS,
    STOCKS,
    ECONOMY,
    CORPORATE,
    GLOBAL,
    PERSONAL_FINANCE,
    IPO,
    NFO
}

/**
 * Market headline for quick display
 */
@Serializable
data class Headline(
    val id: String,
    val title: String,
    val source: String,
    val publishedAt: String,
    val category: NewsCategory,
    val isBreaking: Boolean = false,
    val url: String? = null
)
