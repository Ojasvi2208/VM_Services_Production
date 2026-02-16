package com.vmfinancial.shared.data.api

import com.vmfinancial.shared.data.models.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*
import kotlinx.serialization.encodeToString

// Backend API Client - calls vmfinancialservices.com/api endpoints (same as iOS app)
class BackendApi {
    
    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                coerceInputValues = true
            })
        }
    }
    
    private val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true }
    private val baseUrl = ApiConfig.BASE_URL

    // ── Market Data (matches iOS: /api/market-data?symbols=...) ──
    suspend fun getMarketData(symbols: List<String>): MarketDataResponse {
        val response: String = client.get("$baseUrl/market-data") {
            parameter("symbols", symbols.joinToString(","))
        }.body()
        return json.decodeFromString(response)
    }

    // ── Aggregated News (matches iOS: /api/news/aggregated) ──
    suspend fun getAggregatedNews(category: String = "all", limit: Int = 30): AggregatedNewsResponse {
        val response: String = client.get("$baseUrl/news/aggregated") {
            parameter("category", category)
            parameter("limit", limit)
        }.body()
        return json.decodeFromString(response)
    }

    // ── Top Funds (matches iOS: /api/mutual-fund-data) ──
    suspend fun getTopFunds(): MutualFundDataResponse {
        val response: String = client.get("$baseUrl/mutual-fund-data").body()
        return json.decodeFromString(response)
    }

    // ── Gift Nifty (matches iOS: /api/market-data/gift-nifty) ──
    suspend fun getGiftNifty(): GiftNiftyResponse {
        val response: String = client.get("$baseUrl/market-data/gift-nifty").body()
        return json.decodeFromString(response)
    }

    // ── Fuel Prices ──
    suspend fun getFuelPrices(state: String, city: String? = null, petrolPrice: Double? = null, dieselPrice: Double? = null): FuelPriceResponse {
        val response: String = client.get("$baseUrl/fuel-prices") {
            parameter("state", state)
            city?.let { parameter("city", it) }
            petrolPrice?.let { if (it > 0) parameter("petrolPrice", it.toString()) }
            dieselPrice?.let { if (it > 0) parameter("dieselPrice", it.toString()) }
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun getAllFuelPrices(): FuelAllStatesResponse {
        val response: String = client.get("$baseUrl/fuel-prices") {
            parameter("all", "true")
        }.body()
        return json.decodeFromString(response)
    }

    // ── Commodities (matches iOS: /api/commodities) ──
    suspend fun getCommodities(): CommoditiesResponse {
        val response: String = client.get("$baseUrl/commodities").body()
        return json.decodeFromString(response)
    }

    // ── Currency Rates (matches iOS: /api/currency-rates) ──
    suspend fun getCurrencyRates(): CurrencyRatesResponse {
        val response: String = client.get("$baseUrl/currency-rates").body()
        return json.decodeFromString(response)
    }

    // ── Corporate Actions (matches iOS: /api/corporate-actions) ──
    suspend fun getCorporateActions(): CorporateActionsResponse {
        val response: String = client.get("$baseUrl/corporate-actions") {
            parameter("type", "all")
            parameter("upcoming", "true")
        }.body()
        return json.decodeFromString(response)
    }

    // ── NFOs (matches iOS: /api/nfo) ──
    suspend fun getNFOs(): NFOResponseData {
        val response: String = client.get("$baseUrl/nfo").body()
        return json.decodeFromString(response)
    }

    // ── Chart Data (for Index Detail) ──
    suspend fun getChartData(symbol: String, range: String): ChartDataResponse {
        val response: String = client.get("$baseUrl/market-data/chart") {
            parameter("symbol", symbol)
            parameter("range", range)
        }.body()
        return json.decodeFromString(response)
    }

    // ── Fund Details ──
    suspend fun getFundDetails(schemeCode: String): FundDetailResponse {
        val response: String = client.get("$baseUrl/funds/$schemeCode").body()
        val apiResponse: FundDetailApiResponse = json.decodeFromString(response)
        return FundDetailResponse.fromApi(apiResponse)
    }

    // ── Fund Search ──
    suspend fun searchFunds(query: String): FundSearchResponse {
        val response: String = client.get("$baseUrl/funds/search") {
            parameter("q", query)
            parameter("pageSize", "50")
        }.body()
        return json.decodeFromString(response)
    }

    // ── Fund Search by Category (POST advanced search) ──
    suspend fun searchFundsByCategory(
        category: String = "",
        subCategory: String = "",
        planType: String = "",
        query: String = "",
        limit: Int = 50
    ): FundSearchResponse {
        val bodyMap = mutableMapOf<String, Any>("limit" to limit)
        if (category.isNotBlank()) bodyMap["category"] = category
        if (subCategory.isNotBlank()) bodyMap["subCategory"] = subCategory
        if (planType.isNotBlank()) bodyMap["planType"] = planType
        if (query.isNotBlank()) bodyMap["query"] = query

        val bodyJson = buildString {
            append("{")
            append(bodyMap.entries.joinToString(",") { (k, v) ->
                when (v) {
                    is Int -> "\"$k\":$v"
                    else -> "\"$k\":\"$v\""
                }
            })
            append("}")
        }

        val response: String = client.post("$baseUrl/funds/search") {
            header("Content-Type", "application/json")
            setBody(bodyJson)
        }.body()
        return json.decodeFromString(response)
    }

    // ══════════════════════════════════════════════════
    // Authenticated endpoints (require Bearer token)
    // ══════════════════════════════════════════════════

    // ── Watchlist ──
    suspend fun getWatchlist(token: String): WatchlistResponse {
        val response: String = client.get("$baseUrl/portfolio/watchlist") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun addToWatchlist(token: String, schemeCode: String): SimpleResponse {
        val response: String = client.post("$baseUrl/portfolio/watchlist") {
            header("Authorization", "Bearer $token")
            header("Content-Type", "application/json")
            setBody("""{"schemeCode":"$schemeCode"}""")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun removeFromWatchlist(token: String, schemeCode: String): SimpleResponse {
        val response: String = client.delete("$baseUrl/portfolio/watchlist") {
            header("Authorization", "Bearer $token")
            parameter("schemeCode", schemeCode)
        }.body()
        return json.decodeFromString(response)
    }

    // ── Portfolio Holdings ──
    suspend fun getHoldings(token: String): HoldingsResponse {
        val response: String = client.get("$baseUrl/portfolio/holdings") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun addHolding(
        token: String,
        schemeCode: String,
        units: Double,
        purchaseNav: Double,
        purchaseDate: String,
        notes: String? = null
    ): AddHoldingResponse {
        val notesJson = if (notes != null) ""","notes":"$notes"""" else ""
        val response: String = client.post("$baseUrl/portfolio/holdings") {
            header("Authorization", "Bearer $token")
            header("Content-Type", "application/json")
            setBody("""{"schemeCode":"$schemeCode","units":$units,"purchaseNav":$purchaseNav,"purchaseDate":"$purchaseDate"$notesJson}""")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun deleteHolding(token: String, holdingId: String): AddHoldingResponse {
        val response: String = client.delete("$baseUrl/portfolio/holdings?id=$holdingId") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    // ── Portfolio Summary ──
    suspend fun getPortfolioSummary(token: String): PortfolioSummaryResponse {
        val response: String = client.get("$baseUrl/portfolio/summary") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    // ── SIP Info (from CAS import) ──
    suspend fun getSIPs(token: String): SIPResponse {
        val response: String = client.get("$baseUrl/portfolio/sips") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    // ── Goal Planning ──
    suspend fun getGoals(token: String): GoalsResponse {
        val response: String = client.get("$baseUrl/goals") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun getGoalDetail(token: String, goalId: String): GoalDetailResponse {
        val response: String = client.get("$baseUrl/goals/$goalId") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun createGoal(
        token: String,
        name: String,
        targetAmount: Double,
        targetDate: String,
        criticality: String = "important",
        monthlySip: Double = 0.0,
        icon: String = "target",
        color: String = "#6366F1",
        inflationRate: Double = 6.0,
        expectedReturn: Double = 12.0,
        notes: String? = null,
        linkedFunds: List<GoalFundLink> = emptyList()
    ): CreateGoalResponse {
        val fundsJson = linkedFunds.joinToString(",") { """{"schemeCode":"${it.schemeCode}","allocationPct":${it.allocationPct}}""" }
        val notesJson = if (notes != null) ""","notes":"$notes"""" else ""
        val response: String = client.post("$baseUrl/goals") {
            header("Authorization", "Bearer $token")
            header("Content-Type", "application/json")
            setBody("""{"name":"$name","targetAmount":$targetAmount,"targetDate":"$targetDate","criticality":"$criticality","monthlySip":$monthlySip,"icon":"$icon","color":"$color","inflationRate":$inflationRate,"expectedReturn":$expectedReturn,"linkedFunds":[$fundsJson]$notesJson}""")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun updateGoal(
        token: String,
        goalId: String,
        name: String? = null,
        targetAmount: Double? = null,
        targetDate: String? = null,
        criticality: String? = null,
        monthlySip: Double? = null,
        icon: String? = null,
        color: String? = null,
        notes: String? = null
    ): SimpleResponse {
        val fields = mutableListOf<String>()
        name?.let { fields.add(""""name":"$it"""") }
        targetAmount?.let { fields.add(""""targetAmount":$it""") }
        targetDate?.let { fields.add(""""targetDate":"$it"""") }
        criticality?.let { fields.add(""""criticality":"$it"""") }
        monthlySip?.let { fields.add(""""monthlySip":$it""") }
        icon?.let { fields.add(""""icon":"$it"""") }
        color?.let { fields.add(""""color":"$it"""") }
        notes?.let { fields.add(""""notes":"$it"""") }
        val response: String = client.put("$baseUrl/goals/$goalId") {
            header("Authorization", "Bearer $token")
            header("Content-Type", "application/json")
            setBody("{${fields.joinToString(",")}}")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun deleteGoal(token: String, goalId: String): SimpleResponse {
        val response: String = client.delete("$baseUrl/goals/$goalId") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun contributeToGoal(token: String, goalId: String, amount: Double, date: String? = null, source: String = "manual"): ContributeResponse {
        val dateJson = if (date != null) ""","date":"$date"""" else ""
        val response: String = client.post("$baseUrl/goals/$goalId/contribute") {
            header("Authorization", "Bearer $token")
            header("Content-Type", "application/json")
            setBody("""{"amount":$amount,"source":"$source"$dateJson}""")
        }.body()
        return json.decodeFromString(response)
    }

    // ── Autonomous Evaluations ──
    suspend fun getGoalEvaluations(token: String): EvaluationsResponse {
        val response: String = client.get("$baseUrl/goals/evaluations") {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    // ── CAS Upload & Import ──
    suspend fun uploadCAS(token: String, pdfBytes: ByteArray, password: String? = null): CASParseResponse {
        val response: String = client.submitFormWithBinaryData(
            url = "$baseUrl/portfolio/import-cas",
            formData = formData {
                append("casFile", pdfBytes, Headers.build {
                    append(HttpHeaders.ContentType, "application/pdf")
                    append(HttpHeaders.ContentDisposition, "filename=\"cas.pdf\"")
                })
                if (!password.isNullOrBlank()) {
                    append("password", password)
                }
            }
        ) {
            header("Authorization", "Bearer $token")
        }.body()
        return json.decodeFromString(response)
    }

    suspend fun importCASHoldings(token: String, folios: List<CASFolio>, pan: String? = null, email: String? = null): CASImportResponse {
        val investorJson = buildString {
            append("""{"folios":""")
            append(json.encodeToString(folios))
            if (pan != null || email != null) {
                append(""","investorInfo":{""")
                val parts = mutableListOf<String>()
                if (pan != null) parts.add(""""pan":"$pan"""")
                if (email != null) parts.add(""""email":"$email"""")
                append(parts.joinToString(","))
                append("}")
            }
            append("}")
        }
        val response: String = client.put("$baseUrl/portfolio/import-cas") {
            header("Authorization", "Bearer $token")
            header("Content-Type", "application/json")
            setBody(investorJson)
        }.body()
        return json.decodeFromString(response)
    }

    fun close() {
        client.close()
    }
}

