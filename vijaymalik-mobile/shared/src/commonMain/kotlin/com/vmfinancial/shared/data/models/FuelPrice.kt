package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

@Serializable
data class FuelTaxBreakdown(
    val basePrice: Double,
    val exciseDuty: Double,
    val dealerCommission: Double,
    val vatPercent: Double,
    val vatAmount: Double,
    val additionalCess: Double,
    val retailPrice: Double
)

@Serializable
data class FuelSummaryItem(
    val retailPrice: Double,
    val totalTax: Double,
    val totalTaxPercent: Double,
    val centralTaxPercent: Double,
    val stateTaxPercent: Double
)

@Serializable
data class FuelSummary(
    val petrol: FuelSummaryItem,
    val diesel: FuelSummaryItem
)

@Serializable
data class FuelPriceResponse(
    val success: Boolean,
    val state: String? = null,
    val city: String? = null,
    val petrol: FuelTaxBreakdown? = null,
    val diesel: FuelTaxBreakdown? = null,
    val petrolChange: Double? = null,
    val dieselChange: Double? = null,
    val summary: FuelSummary? = null,
    val lastUpdated: String? = null,
    val source: String? = null,
    val error: String? = null
)

@Serializable
data class FuelStateItem(
    val state: String,
    val petrolPrice: Double,
    val petrolChange: Double,
    val dieselPrice: Double,
    val dieselChange: Double,
    val petrolVatPercent: Double? = null,
    val dieselVatPercent: Double? = null
)

@Serializable
data class FuelAllStatesResponse(
    val success: Boolean,
    val states: List<FuelStateItem>? = null,
    val lastUpdated: String? = null,
    val source: String? = null,
    val error: String? = null
)
