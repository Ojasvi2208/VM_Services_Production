package com.vmfinancial.android.services

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL

// Response from our backend /api/fuel-prices?state=X&city=Y
// Backend serves from scraped cache (goodreturns.in) — zero external API calls per request.
@Serializable
data class BackendFuelResponse(
    @SerialName("success") val success: Boolean = false,
    @SerialName("state") val state: String = "",
    @SerialName("city") val city: String = "",
    @SerialName("petrolPrice") val petrolPrice: Double = 0.0,
    @SerialName("dieselPrice") val dieselPrice: Double = 0.0,
    @SerialName("petrolChange") val petrolChange: Double = 0.0,
    @SerialName("dieselChange") val dieselChange: Double = 0.0,
    @SerialName("cngPrice") val cngPrice: Double? = null,
    @SerialName("lpgPrice") val lpgPrice: Double? = null,
    @SerialName("source") val source: String = "",
    @SerialName("lastUpdated") val lastUpdated: String = ""
)

data class AllFuelPrices(
    val cityName: String,
    val stateName: String,
    val applicableOn: String,
    val petrolPrice: Double?,
    val petrolChange: Double?,
    val petrolUnit: String?,
    val dieselPrice: Double?,
    val dieselChange: Double?,
    val dieselUnit: String?,
    val cngPrice: Double?,
    val cngChange: Double?,
    val cngUnit: String?,
    val lpgPrice: Double?,
    val lpgChange: Double?,
    val lpgUnit: String?,
    val fetchedAt: Long = System.currentTimeMillis()
)

sealed class FuelPriceResult {
    data class Success(val prices: AllFuelPrices) : FuelPriceResult()
    data class Error(val message: String, val cached: AllFuelPrices? = null) : FuelPriceResult()
}

class FuelPriceService(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private const val BACKEND_URL = "https://www.vmfinancialservices.com/api/fuel-prices"

        // In-memory dedup: skip re-fetch within same session if same state+city and < 5 min
        private const val SESSION_DEDUP_MS = 5 * 60 * 1000L

        // Geocoder city names → backend-recognized city names
        private val CITY_ALIAS_MAP = mapOf(
            // Punjab side of tricity → mohali (Punjab prices)
            "sahibzada ajit singh nagar" to "mohali",
            "s.a.s. nagar" to "mohali", "sas nagar" to "mohali",
            "mohali" to "mohali", "zirakpur" to "mohali",
            "kharar" to "mohali", "derabassi" to "mohali",
            "dera bassi" to "mohali", "nayagaon" to "mohali",
            "mullanpur" to "mohali",
            // Haryana side → panchkula (Haryana prices)
            "panchkula" to "panchkula",
            // NCR
            "gurugram" to "gurgaon", "greater noida" to "noida",
            "ghaziabad" to "noida", "faridabad" to "faridabad",
            // Mumbai metro
            "thane" to "mumbai", "navi mumbai" to "mumbai",
            // Others
            "secunderabad" to "hyderabad", "howrah" to "kolkata",
            "pimpri-chinchwad" to "pune", "pimpri" to "pune",
            "salt lake" to "kolkata", "new town" to "kolkata",
            "whitefield" to "bangalore", "electronic city" to "bangalore",
            "yelahanka" to "bangalore"
        )

        // Cities that are in a different state/UT than what geocoder returns
        // e.g. geocoder says state=Punjab for Chandigarh, but it's actually a UT
        private val STATE_OVERRIDE_MAP = mapOf(
            "chandigarh" to "Chandigarh"  // Chandigarh is a UT, not Punjab/Haryana
        )

        // State → capital city for fallback when geocoded city has no data
        private val STATE_CAPITAL_MAP = mapOf(
            "punjab" to "chandigarh", "haryana" to "chandigarh",
            "maharashtra" to "mumbai", "karnataka" to "bangalore",
            "tamil nadu" to "chennai", "telangana" to "hyderabad",
            "andhra pradesh" to "hyderabad", "west bengal" to "kolkata",
            "uttar pradesh" to "lucknow", "rajasthan" to "jaipur",
            "gujarat" to "ahmedabad", "madhya pradesh" to "bhopal",
            "kerala" to "thiruvananthapuram", "bihar" to "patna",
            "odisha" to "bhubaneswar", "jharkhand" to "ranchi",
            "assam" to "guwahati", "chhattisgarh" to "raipur",
            "goa" to "panaji", "uttarakhand" to "dehradun",
            "himachal pradesh" to "shimla", "chandigarh" to "chandigarh",
            "delhi" to "new delhi"
        )
    }

    // In-memory only — cleared when app process dies (cold start = fresh fetch)
    @Volatile private var memoryCache: AllFuelPrices? = null

    // ── Public API ──

    /** Main entry: always fetches fresh on app open.
     *  Fallback chain: resolved city → state capital → Delhi */
    suspend fun fetchFuelPrices(stateName: String, cityName: String?, districtName: String? = null, @Suppress("UNUSED_PARAMETER") fullAddress: String? = null): FuelPriceResult {
        return withContext(Dispatchers.IO) {
            try {
                val resolvedCity = resolveCity(cityName, districtName, null)
                // Override state for UTs like Chandigarh
                val effectiveState = STATE_OVERRIDE_MAP[resolvedCity] ?: stateName

                // Dedup: if same state+city fetched < 5 min ago in this session, reuse
                val cached = memoryCache
                if (cached != null
                    && cached.stateName.equals(effectiveState, ignoreCase = true)
                    && (System.currentTimeMillis() - cached.fetchedAt) < SESSION_DEDUP_MS
                ) {
                    println("FuelPriceService: Session dedup (${(System.currentTimeMillis() - cached.fetchedAt) / 1000}s old) — ${cached.cityName}, ${cached.stateName}")
                    return@withContext FuelPriceResult.Success(cached)
                }

                // Fallback chain: city → state capital → Delhi
                val prices = fetchFromBackend(effectiveState, resolvedCity)
                    ?: run {
                        val capital = STATE_CAPITAL_MAP[effectiveState.lowercase()]
                        if (capital != null && capital != resolvedCity) {
                            println("FuelPriceService: Fallback to state capital '$capital'")
                            fetchFromBackend(effectiveState, capital)
                        } else null
                    }
                    ?: run {
                        println("FuelPriceService: Fallback to Delhi")
                        fetchFromBackend("Delhi", "new delhi")
                    }

                if (prices != null) {
                    memoryCache = prices
                    return@withContext FuelPriceResult.Success(prices)
                }

                if (cached != null) {
                    println("FuelPriceService: All fallbacks failed, using last known data")
                    FuelPriceResult.Success(cached)
                } else {
                    FuelPriceResult.Error("Could not load fuel prices")
                }
            } catch (e: Exception) {
                println("FuelPriceService: Error: ${e.message}")
                FuelPriceResult.Error(e.message ?: "Unknown error", memoryCache)
            }
        }
    }

    // ── City resolution (local only, no API calls) ──

    /** Resolve geocoder output to a clean city name for our backend. */
    private fun resolveCity(cityName: String?, districtName: String?, @Suppress("UNUSED_PARAMETER") fullAddress: String?): String {
        val candidates = listOfNotNull(cityName, districtName).map { it.lowercase().trim() }
        for (candidate in candidates) {
            CITY_ALIAS_MAP[candidate]?.let { return it }
        }
        return cityName?.lowercase()?.trim() ?: districtName?.lowercase()?.trim() ?: ""
    }

    // ── Backend fetch (single source of truth — all from scraped cache) ──

    /** Fetch prices from our backend. Backend handles:
     *  - City slug resolution (mohali → sas-nagar)
     *  - Fallback to nearest city in same state
     *  - Fallback to state-level price
     *  - CNG + LPG prices
     *  - Tax breakdown
     *  No external API calls — all served from scraped goodreturns.in cache. */
    private fun fetchFromBackend(stateName: String, cityName: String): AllFuelPrices? {
        return try {
            val url = "$BACKEND_URL?state=${java.net.URLEncoder.encode(stateName, "UTF-8")}&city=${java.net.URLEncoder.encode(cityName, "UTF-8")}"
            println("FuelPriceService: Fetching $url")

            val connection = URL(url).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode != 200) {
                println("FuelPriceService: Backend HTTP ${connection.responseCode}")
                connection.disconnect()
                return null
            }

            val body = connection.inputStream.bufferedReader().readText()
            connection.disconnect()

            val parsed = json.decodeFromString<BackendFuelResponse>(body)
            if (!parsed.success || parsed.petrolPrice <= 0) {
                println("FuelPriceService: Backend returned no data for $stateName/$cityName")
                return null
            }

            val result = AllFuelPrices(
                cityName = parsed.city.ifEmpty { cityName.replaceFirstChar { it.uppercase() } },
                stateName = parsed.state,
                applicableOn = parsed.lastUpdated,
                petrolPrice = parsed.petrolPrice,
                petrolChange = parsed.petrolChange,
                petrolUnit = "litre",
                dieselPrice = parsed.dieselPrice,
                dieselChange = parsed.dieselChange,
                dieselUnit = "litre",
                cngPrice = parsed.cngPrice?.takeIf { it > 0 },
                cngChange = null,
                cngUnit = if (parsed.cngPrice != null && parsed.cngPrice > 0) "kg" else null,
                lpgPrice = parsed.lpgPrice?.takeIf { it > 0 },
                lpgChange = null,
                lpgUnit = if (parsed.lpgPrice != null && parsed.lpgPrice > 0) "14.2kg" else null
            )
            println("FuelPriceService: ✅ P₹${result.petrolPrice} D₹${result.dieselPrice} CNG₹${result.cngPrice} LPG₹${result.lpgPrice} in ${result.cityName}, ${result.stateName} [${parsed.source}]")
            result
        } catch (e: Exception) {
            println("FuelPriceService: Backend error: ${e.message}")
            null
        }
    }
}
