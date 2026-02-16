package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

// ── CAS (Consolidated Account Statement) Models ──

@Serializable
data class CASTransaction(
    val date: String = "",
    val description: String = "",
    val amount: Double = 0.0,
    val units: Double = 0.0,
    val nav: Double = 0.0,
    val balance: Double = 0.0,
    val type: String = "BUY"
)

@Serializable
data class CASFolio(
    val folioNumber: String = "",
    val amc: String = "",
    val schemeName: String = "",
    val schemeCode: String? = null,
    val pan: String = "",
    val registrar: String = "",
    val closingBalance: Double = 0.0,
    val closingNav: Double? = null,
    val closingValue: Double? = null,
    val costValue: Double? = null,
    val transactions: List<CASTransaction> = emptyList(),
    // Enriched returns from NAV DB
    val latestNav: Double? = null,
    val currentValue: Double? = null,
    val absoluteReturn: Double? = null,
    val absoluteReturnPct: Double? = null,
    val xirr: Double? = null,
    val cagr: Double? = null
)

@Serializable
data class CASStatementPeriod(
    val from: String = "",
    val to: String = ""
)

@Serializable
data class CASSummary(
    val totalFolios: Int = 0,
    val totalSchemes: Int = 0,
    val totalInvested: Double = 0.0,
    val currentValue: Double = 0.0
)

@Serializable
data class ParsedCAS(
    val investorName: String = "",
    val email: String = "",
    val pan: String = "",
    val statementPeriod: CASStatementPeriod = CASStatementPeriod(),
    val folios: List<CASFolio> = emptyList(),
    val summary: CASSummary = CASSummary()
)

@Serializable
data class CASParseResponse(
    val success: Boolean = false,
    val data: ParsedCAS? = null,
    val message: String? = null,
    val parser: String? = null,
    val error: String? = null,
    val requiresPassword: Boolean = false
)

@Serializable
data class CASImportResponse(
    val success: Boolean = false,
    val imported: Int = 0,
    val skipped: Int = 0,
    val errors: Int = 0,
    val sipCount: Int = 0,
    val message: String? = null,
    val error: String? = null
)
