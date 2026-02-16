package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

@Serializable
data class CandleData(
    val timestamp: Long,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Long? = null
)

@Serializable
data class DMAValues(
    val dma50: Double? = null,
    val dma100: Double? = null,
    val dma200: Double? = null
)

@Serializable
data class MACDValues(
    val macd: Double? = null,
    val signal: Double? = null,
    val histogram: Double? = null
)

@Serializable
data class DMAOverlayPoint(
    val timestamp: Long,
    val dma50: Double? = null,
    val dma200: Double? = null
)

@Serializable
data class TechnicalsData(
    val dma: DMAValues = DMAValues(),
    val rsi: Double? = null,
    val macd: MACDValues = MACDValues(),
    val dmaOverlay: List<DMAOverlayPoint> = emptyList()
)

@Serializable
data class TechnicalSignal(
    val indicator: String,
    val signal: String,
    val value: String,
    val description: String
)

@Serializable
data class OutlookData(
    val overall: String = "Neutral",
    val strength: Double = 50.0,
    val summary: String = ""
)

@Serializable
data class ChartDataResponse(
    val success: Boolean = false,
    val symbol: String = "",
    val name: String = "",
    val range: String = "",
    val interval: String = "",
    val currentPrice: Double = 0.0,
    val previousClose: Double? = null,
    val dayChange: Double? = null,
    val dayChangePercent: Double? = null,
    val isMarketOpen: Boolean = false,
    val candles: List<CandleData> = emptyList(),
    val technicals: TechnicalsData = TechnicalsData(),
    val fiftyTwoWeekHigh: Double = 0.0,
    val fiftyTwoWeekLow: Double = 0.0,
    val fiftyTwoWeekRangePosition: Double? = null,
    val outlook: OutlookData = OutlookData(),
    val signals: List<TechnicalSignal> = emptyList(),
    val error: String? = null
)
