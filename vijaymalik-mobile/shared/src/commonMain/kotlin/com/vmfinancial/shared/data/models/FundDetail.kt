package com.vmfinancial.shared.data.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ── API wrapper (matches backend JSON shape) ──
@Serializable
data class FundDetailApiResponse(
    val success: Boolean = false,
    val data: FundDetailData? = null,
    val error: String? = null
)

@Serializable
data class FundDetailData(
    val fund: FundInfo? = null,
    val returns: FundReturns? = null,
    val navHistory: List<NavPoint> = emptyList(),
    val managers: List<String> = emptyList(),
    val expenseHistory: List<String> = emptyList(),
    val variants: List<FundVariant> = emptyList()
)

@Serializable
data class FundVariant(
    val schemeCode: String,
    val schemeName: String = "",
    val latestNav: Double? = null,
    val latestNavDate: String? = null,
    val cagr3y: Double? = null,
    val cagr5y: Double? = null,
    val return1y: Double? = null
) {
    val isDirect: Boolean get() = schemeName.contains("Direct", ignoreCase = true)
    val isGrowth: Boolean get() = schemeName.contains("Growth", ignoreCase = true) && !schemeName.contains("IDCW", ignoreCase = true) && !schemeName.contains("Dividend", ignoreCase = true)
    val planType: String get() = if (isDirect) "Direct" else "Regular"
    val optionType: String get() = if (isGrowth) "Growth" else "IDCW"
}

@Serializable
data class FundInfo(
    val schemeCode: String = "",
    val schemeName: String = "",
    val amcCode: String = "",
    val fundHouse: String? = null,
    val schemeType: String? = null,
    val planType: String? = null,
    val optionType: String? = null,
    val category: String? = null,
    val subCategory: String? = null,
    val latestNav: Double? = null,
    val latestNavDate: String? = null,
    val inceptionDate: String? = null,
    val fundSize: Double? = null,
    val expenseRatio: Double? = null,
    val exitLoad: String? = null,
    val minInvestment: Int? = null,
    val minSip: Int? = null,
    val isActive: Boolean = true
)

@Serializable
data class FundReturns(
    val return1w: Double? = null,
    val return1m: Double? = null,
    val return3m: Double? = null,
    val return6m: Double? = null,
    val return1y: Double? = null,
    val return2y: Double? = null,
    val return3y: Double? = null,
    val return5y: Double? = null,
    val return7y: Double? = null,
    val return10y: Double? = null,
    val cagr1y: Double? = null,
    val cagr2y: Double? = null,
    val cagr3y: Double? = null,
    val cagr5y: Double? = null,
    val cagr7y: Double? = null,
    val cagr10y: Double? = null,
    val volatility1y: Double? = null,
    val maxDrawdown: Double? = null,
    val sharpeRatio1y: Double? = null,
    val sortinoRatio1y: Double? = null,
    val rollingReturn1yAvg: Double? = null,
    val rollingReturn1yMin: Double? = null,
    val rollingReturn1yMax: Double? = null,
    val rollingReturn1yMedian: Double? = null,
    val rollingReturn3yAvg: Double? = null,
    val rollingReturn3yMin: Double? = null,
    val rollingReturn3yMax: Double? = null,
    val rollingReturn3yMedian: Double? = null,
    val returnSinceInception: Double? = null,
    val updatedAt: String? = null
)

// ── Flat model used by the UI layer ──
@Serializable
data class FundDetailResponse(
    val success: Boolean = false,
    val schemeCode: String = "",
    val schemeName: String = "",
    val fundHouse: String = "",
    val category: String = "",
    val subCategory: String = "",
    val planType: String = "",
    val nav: Double? = null,
    val navDate: String? = null,
    val inceptionDate: String? = null,
    val expenseRatio: Double? = null,
    val aum: Double? = null,
    val rating: Int = 0,
    val riskLevel: String = "",
    // Period returns
    val return1W: Double? = null,
    val return1M: Double? = null,
    val return3M: Double? = null,
    val return6M: Double? = null,
    val return1Y: Double? = null,
    val return2Y: Double? = null,
    val return3Y: Double? = null,
    val return5Y: Double? = null,
    val return7Y: Double? = null,
    val return10Y: Double? = null,
    val returnSI: Double? = null,
    // CAGR
    val cagr1Y: Double? = null,
    val cagr2Y: Double? = null,
    val cagr3Y: Double? = null,
    val cagr5Y: Double? = null,
    val cagr7Y: Double? = null,
    val cagr10Y: Double? = null,
    // Risk metrics
    val volatility: Double? = null,
    val maxDrawdown: Double? = null,
    val sharpeRatio: Double? = null,
    val sortinoRatio: Double? = null,
    val rollingReturn1YAvg: Double? = null,
    val rollingReturn1YMin: Double? = null,
    val rollingReturn1YMax: Double? = null,
    val rollingReturn1YMedian: Double? = null,
    val rollingReturn3YAvg: Double? = null,
    val rollingReturn3YMin: Double? = null,
    val rollingReturn3YMax: Double? = null,
    val rollingReturn3YMedian: Double? = null,
    // Fund info
    val benchmark: String? = null,
    val fundManager: String? = null,
    val minInvestment: Int = 500,
    val minSIP: Int = 500,
    val exitLoad: String? = null,
    val navHistory: List<NavPoint> = emptyList(),
    val variants: List<FundVariant> = emptyList(),
    val error: String? = null
) {
    companion object {
        fun fromApi(api: FundDetailApiResponse): FundDetailResponse {
            val fund = api.data?.fund
            val ret = api.data?.returns
            return FundDetailResponse(
                success = api.success,
                schemeCode = fund?.schemeCode ?: "",
                schemeName = fund?.schemeName ?: "",
                fundHouse = fund?.fundHouse ?: fund?.amcCode ?: "",
                category = fund?.category ?: "",
                subCategory = fund?.subCategory ?: "",
                planType = fund?.planType ?: "",
                nav = fund?.latestNav,
                navDate = fund?.latestNavDate,
                inceptionDate = fund?.inceptionDate,
                expenseRatio = fund?.expenseRatio,
                aum = fund?.fundSize,
                exitLoad = fund?.exitLoad,
                minInvestment = fund?.minInvestment ?: 500,
                minSIP = fund?.minSip ?: 500,
                return1W = ret?.return1w,
                return1M = ret?.return1m,
                return3M = ret?.return3m,
                return6M = ret?.return6m,
                return1Y = ret?.return1y,
                return2Y = ret?.return2y,
                return3Y = ret?.return3y,
                return5Y = ret?.return5y,
                return7Y = ret?.return7y,
                return10Y = ret?.return10y,
                returnSI = ret?.returnSinceInception,
                cagr1Y = ret?.cagr1y,
                cagr2Y = ret?.cagr2y,
                cagr3Y = ret?.cagr3y,
                cagr5Y = ret?.cagr5y,
                cagr7Y = ret?.cagr7y,
                cagr10Y = ret?.cagr10y,
                volatility = ret?.volatility1y,
                maxDrawdown = ret?.maxDrawdown,
                sharpeRatio = ret?.sharpeRatio1y,
                sortinoRatio = ret?.sortinoRatio1y,
                rollingReturn1YAvg = ret?.rollingReturn1yAvg,
                rollingReturn1YMin = ret?.rollingReturn1yMin,
                rollingReturn1YMax = ret?.rollingReturn1yMax,
                rollingReturn1YMedian = ret?.rollingReturn1yMedian,
                rollingReturn3YAvg = ret?.rollingReturn3yAvg,
                rollingReturn3YMin = ret?.rollingReturn3yMin,
                rollingReturn3YMax = ret?.rollingReturn3yMax,
                rollingReturn3YMedian = ret?.rollingReturn3yMedian,
                navHistory = api.data?.navHistory ?: emptyList(),
                variants = api.data?.variants ?: emptyList(),
                error = api.error
            )
        }
    }
}

@Serializable
data class NavPoint(
    val date: String,
    val nav: Double
)

@Serializable
data class FundSearchItem(
    val schemeCode: String,
    val schemeName: String = "",
    val latestNav: Double? = null,
    val latestNavDate: String? = null,
    val amcCode: String? = null,
    val schemeType: String? = null,
    val return1y: Double? = null,
    val cagr3y: Double? = null,
    val cagr5y: Double? = null
) {
    val name: String get() = schemeName
        .replace("- Direct Plan", "").replace("Direct Plan", "")
        .replace("- Regular Plan", "").replace("Regular Plan", "")
        .replace("- Growth Option", "").replace("- Growth", "")
        .replace("- IDCW Option", "").replace("- IDCW", "")
        .replace("- Payout Option", "").replace("- Reinvestment Option", "")
        .replace("  ", " ").trim().removeSuffix("-").trim()
    val nav: Double? get() = latestNav
    val category: String get() = schemeType ?: ""
    val fundHouse: String get() {
        val s = schemeName.uppercase()
        return when {
            s.startsWith("ADITYA BIRLA") -> "Aditya Birla SL"
            s.startsWith("ICICI PRUDENTIAL") || s.startsWith("ICICI PRUD") -> "ICICI Prudential"
            s.startsWith("NIPPON INDIA") -> "Nippon India"
            s.startsWith("FRANKLIN TEMPLETON") || s.startsWith("FRANKLIN INDIA") -> "Franklin Templeton"
            s.startsWith("KOTAK MAHINDRA") || s.startsWith("KOTAK ") -> "Kotak"
            s.startsWith("TATA ") -> "Tata"
            s.startsWith("HDFC ") -> "HDFC"
            s.startsWith("SBI ") -> "SBI"
            s.startsWith("AXIS ") -> "Axis"
            s.startsWith("UTI") -> "UTI"
            s.startsWith("DSP ") -> "DSP"
            s.startsWith("MIRAE ") -> "Mirae Asset"
            s.startsWith("SUNDARAM ") -> "Sundaram"
            s.startsWith("INVESCO ") -> "Invesco"
            s.startsWith("MOTILAL ") -> "Motilal Oswal"
            s.startsWith("QUANT ") -> "Quant"
            s.startsWith("CANARA ") -> "Canara Robeco"
            s.startsWith("BANDHAN ") -> "Bandhan"
            s.startsWith("BAJAJ ") -> "Bajaj Finserv"
            s.startsWith("EDELWEISS ") -> "Edelweiss"
            s.startsWith("UNION ") -> "Union"
            s.startsWith("MAHINDRA ") -> "Mahindra Manulife"
            s.startsWith("ITI ") -> "ITI"
            s.startsWith("PGIM ") -> "PGIM India"
            s.startsWith("BARODA ") -> "Baroda BNP"
            s.startsWith("HSBC ") -> "HSBC"
            s.startsWith("PPFAS") || s.startsWith("PARAG PARIKH") -> "PPFAS"
            else -> schemeName.split(" ").first()
        }
    }
}

@Serializable
data class FundSearchResponse(
    val success: Boolean = false,
    val funds: List<FundSearchItem> = emptyList(),
    val total: Int = 0,
    val error: String? = null
)
