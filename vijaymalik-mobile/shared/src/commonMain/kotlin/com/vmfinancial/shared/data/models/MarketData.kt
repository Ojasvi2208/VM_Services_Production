package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

// ── Market Data (from /api/market-data) ──
@Serializable
data class MarketDataItem(
    val symbol: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val change: Double = 0.0,
    val changePercent: Double = 0.0,
    val lastUpdated: String = "",
    val isMarketOpen: Boolean = false,
    val exchange: String? = null
)

@Serializable
data class MarketDataResponse(
    val success: Boolean = false,
    val data: List<MarketDataItem> = emptyList(),
    val isMarketOpen: Boolean = false,
    val error: String? = null
)

// ── Gift Nifty (from /api/market-data/gift-nifty) ──
@Serializable
data class GiftNiftyData(
    val symbol: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val change: Double = 0.0,
    val changePercent: Double = 0.0,
    val marketStatus: String = "",
    val lastUpdated: String = "",
    val previousClose: Double = 0.0,
    val impliedOpen: Double = 0.0
)

@Serializable
data class GiftNiftyResponse(
    val success: Boolean = false,
    val data: GiftNiftyData? = null,
    val error: String? = null
)

// ── Aggregated News (from /api/news/aggregated) ──
@Serializable
data class AggregatedNewsArticle(
    val title: String = "",
    val source: String = "",
    val url: String = "",
    val publishedAt: String = "",
    val category: String = "",
    val description: String? = null
)

@Serializable
data class AggregatedNewsResponse(
    val success: Boolean = false,
    val articles: List<AggregatedNewsArticle> = emptyList(),
    val error: String? = null
)

// ── Corporate Actions (from /api/corporate-actions) ──
@Serializable
data class CorporateActionItem(
    val id: String = "",
    val symbol: String = "",
    val companyName: String = "",
    val actionType: String = "",
    val description: String = "",
    val exDate: String = "",
    val announcementDate: String = "",
    val details: String = "",
    val impact: String = ""
)

@Serializable
data class CorporateActionsResponse(
    val success: Boolean = false,
    val actions: List<CorporateActionItem> = emptyList(),
    val error: String? = null
)

// ── Top Funds (from /api/mutual-fund-data) ──
@Serializable
data class TopFundItem(
    val schemeCode: String? = null,
    val fundName: String = "",
    val fundHouse: String = "",
    val category: String = "",
    val nav: String = "",
    val change: String = "",
    val changePercent: String = "",
    val rank: Int = 0,
    val rating: Int = 0,
    val aum: String = "",
    val isPositive: Boolean = true
)

@Serializable
data class MutualFundDataResponse(
    val success: Boolean = false,
    val funds: List<TopFundItem> = emptyList(),
    val error: String? = null
)

// ── NFOs (from /api/nfo) ──
@Serializable
data class NFOLiveItem(
    val id: String = "",
    val schemeName: String = "",
    val amcName: String = "",
    val fundType: String = "",
    val openDate: String = "",
    val closeDate: String = "",
    val minInvestment: Int = 500
)

@Serializable
data class NFOResponseData(
    val success: Boolean = false,
    val open: List<NFOLiveItem> = emptyList(),
    val closed: List<NFOLiveItem> = emptyList(),
    val error: String? = null
)

// ── Watchlist (from /api/portfolio/watchlist) ──

@Serializable
data class WatchlistItem(
    val id: String = "",
    val schemeCode: String = "",
    val schemeName: String = "",
    val currentNav: Double = 0.0,
    val return1y: Double = 0.0,
    val addedAt: String = "",
    val notes: String? = null
)

@Serializable
data class WatchlistResponse(
    val success: Boolean = false,
    val watchlist: List<WatchlistItem> = emptyList(),
    val error: String? = null
)

@Serializable
data class SimpleResponse(
    val success: Boolean = false,
    val message: String? = null,
    val error: String? = null
)

// ── Portfolio Holdings (from /api/portfolio/holdings) ──

@Serializable
data class HoldingItem(
    val id: String = "",
    val schemeCode: String = "",
    val schemeName: String = "",
    val units: Double = 0.0,
    val purchaseNav: Double = 0.0,
    val currentNav: Double = 0.0,
    val purchaseAmount: Double = 0.0,
    val currentValue: Double = 0.0,
    val returns: Double = 0.0,
    val returnsPercentage: Double = 0.0,
    val purchaseDate: String = "",
    val notes: String? = null
)

@Serializable
data class HoldingsResponse(
    val success: Boolean = false,
    val holdings: List<HoldingItem> = emptyList(),
    val error: String? = null
)

@Serializable
data class AddHoldingResponse(
    val success: Boolean = false,
    val message: String? = null,
    val holdingId: String? = null,
    val error: String? = null
)

// ── SIP Info (from /api/portfolio/sips) ──

@Serializable
data class SIPItem(
    val id: String = "",
    val schemeCode: String? = null,
    val schemeName: String = "",
    val sipAmount: Double = 0.0,
    val frequency: String = "Monthly",
    val lastSipDate: String? = null,
    val currentNav: Double? = null
)

@Serializable
data class SIPResponse(
    val success: Boolean = false,
    val sips: List<SIPItem> = emptyList(),
    val error: String? = null
)

// ── Portfolio Summary (from /api/portfolio/summary) ──

@Serializable
data class PortfolioSummary(
    val totalInvested: Double = 0.0,
    val currentValue: Double = 0.0,
    val totalReturns: Double = 0.0,
    val returnsPercentage: Double = 0.0,
    val holdingsCount: Int = 0
)

@Serializable
data class PortfolioSummaryResponse(
    val success: Boolean = false,
    val summary: PortfolioSummary? = null,
    val error: String? = null
)
