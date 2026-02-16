package com.vmfinancial.android.data.repository

import android.content.Context
import com.vmfinancial.android.data.db.HomeCacheDatabase
import com.vmfinancial.android.data.db.HomeCacheEntity
import com.vmfinancial.android.services.AllFuelPrices
import com.vmfinancial.android.services.WeatherData
import com.vmfinancial.android.ui.screens.home.HomeUiState
import com.vmfinancial.shared.data.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Stale-While-Revalidate cache repository for Home Screen.
 *
 * Strategy:
 * 1. On app launch → loadCached() returns last-known-good data in <50ms
 * 2. ViewModel renders stale data immediately
 * 3. Background refresh fires all API calls in parallel
 * 4. On success → saveFresh() persists + updates UI
 * 5. Versioned writes prevent stale overwrites (race condition guard)
 */
class HomeCacheRepository(context: Context) {

    private val dao = HomeCacheDatabase.getInstance(context).homeCacheDao()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    companion object {
        private const val KEY_MARKETS = "markets"
        private const val KEY_HEADLINES = "headlines"
        private const val KEY_FUEL = "fuel"
        private const val KEY_GIFT_NIFTY = "gift_nifty"
        private const val KEY_CORPORATE = "corporate"
        private const val KEY_CURRENCY = "currency"
        private const val KEY_COMMODITIES = "commodities"
        private const val KEY_NFOS = "nfos"
        private const val KEY_TOP_FUNDS = "top_funds"
        private const val KEY_WEATHER = "weather"

        // Data older than 24h is considered expired (still shown but flagged)
        const val STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000L
        // Data older than 15min triggers background refresh
        const val REFRESH_THRESHOLD_MS = 15 * 60 * 1000L
    }

    // ── Serializable wrappers (Room stores JSON strings) ──

    @Serializable
    data class CachedMarkets(val indices: List<MarketIndex>, val isMarketOpen: Boolean)

    @Serializable
    data class CachedHeadlines(val headlines: List<Headline>)

    @Serializable
    data class CachedFuel(
        val cityName: String, val stateName: String, val applicableOn: String?,
        val petrolPrice: Double?, val petrolChange: Double?, val petrolUnit: String?,
        val dieselPrice: Double?, val dieselChange: Double?, val dieselUnit: String?,
        val cngPrice: Double?, val cngChange: Double?, val cngUnit: String?,
        val lpgPrice: Double?, val lpgChange: Double?, val lpgUnit: String?
    )

    @Serializable
    data class CachedCorporate(val actions: List<CorporateActionItem>)

    @Serializable
    data class CachedCurrency(val rates: List<CurrencyRate>)

    @Serializable
    data class CachedCommodities(val commodities: List<CommodityItem>)

    @Serializable
    data class CachedNFOs(val nfos: List<NFOLiveItem>)

    @Serializable
    data class CachedTopFunds(val funds: List<TopFundItem>)

    @Serializable
    data class CachedWeather(
        val temperature: Double, val weatherCode: Int, val humidity: Int,
        val windSpeed: Double, val isDay: Boolean, val cityName: String?, val stateName: String?
    )

    @Serializable
    data class CachedGiftNifty(
        val price: Double, val change: Double, val changePercent: Double,
        val previousClose: Double, val marketStatus: String
    )

    // ── Load cached state (called on app launch — must be fast) ──

    suspend fun loadCached(): HomeUiState? = withContext(Dispatchers.IO) {
        try {
            val markets = loadMarkets()
            val headlines = loadHeadlines()
            val fuel = loadFuel()

            // If we have nothing cached, return null (first launch → shimmer)
            if (markets == null && headlines == null && fuel == null) return@withContext null

            HomeUiState(
                isLoading = false,
                isMarketOpen = markets?.isMarketOpen ?: false,
                indianMarkets = markets?.indices ?: emptyList(),
                headlines = headlines?.headlines ?: emptyList(),
                corporateActions = loadCorporate()?.actions ?: emptyList(),
                currencyRates = loadCurrency()?.rates ?: emptyList(),
                commodities = loadCommodities()?.commodities ?: emptyList(),
                fuelPrices = fuel?.let {
                    AllFuelPrices(
                        cityName = it.cityName, stateName = it.stateName, applicableOn = it.applicableOn ?: "",
                        petrolPrice = it.petrolPrice, petrolChange = it.petrolChange, petrolUnit = it.petrolUnit,
                        dieselPrice = it.dieselPrice, dieselChange = it.dieselChange, dieselUnit = it.dieselUnit,
                        cngPrice = it.cngPrice, cngChange = it.cngChange, cngUnit = it.cngUnit,
                        lpgPrice = it.lpgPrice, lpgChange = it.lpgChange, lpgUnit = it.lpgUnit
                    )
                },
                nfos = loadNFOs()?.nfos ?: emptyList(),
                topFunds = loadTopFunds()?.funds ?: emptyList(),
                giftNifty = loadGiftNifty()?.let {
                    GiftNiftyData(
                        price = it.price, change = it.change, changePercent = it.changePercent,
                        previousClose = it.previousClose, marketStatus = it.marketStatus
                    )
                },
                weather = loadWeather()?.let {
                    WeatherData(
                        temperature = it.temperature, weatherCode = it.weatherCode,
                        humidity = it.humidity, windSpeed = it.windSpeed,
                        isDay = it.isDay, cityName = it.cityName, stateName = it.stateName
                    )
                }
            )
        } catch (e: Exception) {
            println("HomeCacheRepository: loadCached error: ${e.message}")
            null
        }
    }

    // ── Save fresh data (called after successful API fetch) ──

    suspend fun saveFresh(state: HomeUiState) = withContext(Dispatchers.IO) {
        try {
            if (state.indianMarkets.isNotEmpty()) {
                saveMarkets(CachedMarkets(state.indianMarkets, state.isMarketOpen))
            }
            if (state.headlines.isNotEmpty()) {
                saveHeadlines(CachedHeadlines(state.headlines))
            }
            state.fuelPrices?.let { f ->
                saveFuel(CachedFuel(
                    cityName = f.cityName, stateName = f.stateName, applicableOn = f.applicableOn,
                    petrolPrice = f.petrolPrice, petrolChange = f.petrolChange, petrolUnit = f.petrolUnit,
                    dieselPrice = f.dieselPrice, dieselChange = f.dieselChange, dieselUnit = f.dieselUnit,
                    cngPrice = f.cngPrice, cngChange = f.cngChange, cngUnit = f.cngUnit,
                    lpgPrice = f.lpgPrice, lpgChange = f.lpgChange, lpgUnit = f.lpgUnit
                ))
            }
            state.giftNifty?.let { g ->
                saveGiftNifty(CachedGiftNifty(
                    price = g.price, change = g.change, changePercent = g.changePercent,
                    previousClose = g.previousClose, marketStatus = g.marketStatus
                ))
            }
            if (state.corporateActions.isNotEmpty()) saveCorporate(CachedCorporate(state.corporateActions))
            if (state.currencyRates.isNotEmpty()) saveCurrency(CachedCurrency(state.currencyRates))
            if (state.commodities.isNotEmpty()) saveCommodities(CachedCommodities(state.commodities))
            if (state.nfos.isNotEmpty()) saveNFOs(CachedNFOs(state.nfos))
            if (state.topFunds.isNotEmpty()) saveTopFunds(CachedTopFunds(state.topFunds))
            state.weather?.let { w ->
                saveWeather(CachedWeather(
                    temperature = w.temperature, weatherCode = w.weatherCode,
                    humidity = w.humidity, windSpeed = w.windSpeed,
                    isDay = w.isDay, cityName = w.cityName, stateName = w.stateName
                ))
            }
        } catch (e: Exception) {
            println("HomeCacheRepository: saveFresh error: ${e.message}")
        }
    }

    /** Returns true if cached data is older than REFRESH_THRESHOLD_MS */
    suspend fun needsRefresh(): Boolean = withContext(Dispatchers.IO) {
        val ts = dao.getTimestamp(KEY_MARKETS) ?: return@withContext true
        (System.currentTimeMillis() - ts) > REFRESH_THRESHOLD_MS
    }

    /** Returns true if cached data is older than STALE_THRESHOLD_MS */
    suspend fun isStale(): Boolean = withContext(Dispatchers.IO) {
        val ts = dao.getTimestamp(KEY_MARKETS) ?: return@withContext true
        (System.currentTimeMillis() - ts) > STALE_THRESHOLD_MS
    }

    // ── Private serialization helpers ──

    private suspend fun loadMarkets(): CachedMarkets? =
        dao.get(KEY_MARKETS)?.let { runCatching { json.decodeFromString<CachedMarkets>(it.json) }.getOrNull() }

    private suspend fun saveMarkets(data: CachedMarkets) =
        dao.put(HomeCacheEntity(KEY_MARKETS, json.encodeToString(data)))

    private suspend fun loadHeadlines(): CachedHeadlines? =
        dao.get(KEY_HEADLINES)?.let { runCatching { json.decodeFromString<CachedHeadlines>(it.json) }.getOrNull() }

    private suspend fun saveHeadlines(data: CachedHeadlines) =
        dao.put(HomeCacheEntity(KEY_HEADLINES, json.encodeToString(data)))

    private suspend fun loadFuel(): CachedFuel? =
        dao.get(KEY_FUEL)?.let { runCatching { json.decodeFromString<CachedFuel>(it.json) }.getOrNull() }

    private suspend fun saveFuel(data: CachedFuel) =
        dao.put(HomeCacheEntity(KEY_FUEL, json.encodeToString(data)))

    private suspend fun loadGiftNifty(): CachedGiftNifty? =
        dao.get(KEY_GIFT_NIFTY)?.let { runCatching { json.decodeFromString<CachedGiftNifty>(it.json) }.getOrNull() }

    private suspend fun saveGiftNifty(data: CachedGiftNifty) =
        dao.put(HomeCacheEntity(KEY_GIFT_NIFTY, json.encodeToString(data)))

    private suspend fun loadCorporate(): CachedCorporate? =
        dao.get(KEY_CORPORATE)?.let { runCatching { json.decodeFromString<CachedCorporate>(it.json) }.getOrNull() }

    private suspend fun saveCorporate(data: CachedCorporate) =
        dao.put(HomeCacheEntity(KEY_CORPORATE, json.encodeToString(data)))

    private suspend fun loadCurrency(): CachedCurrency? =
        dao.get(KEY_CURRENCY)?.let { runCatching { json.decodeFromString<CachedCurrency>(it.json) }.getOrNull() }

    private suspend fun saveCurrency(data: CachedCurrency) =
        dao.put(HomeCacheEntity(KEY_CURRENCY, json.encodeToString(data)))

    private suspend fun loadCommodities(): CachedCommodities? =
        dao.get(KEY_COMMODITIES)?.let { runCatching { json.decodeFromString<CachedCommodities>(it.json) }.getOrNull() }

    private suspend fun saveCommodities(data: CachedCommodities) =
        dao.put(HomeCacheEntity(KEY_COMMODITIES, json.encodeToString(data)))

    private suspend fun loadNFOs(): CachedNFOs? =
        dao.get(KEY_NFOS)?.let { runCatching { json.decodeFromString<CachedNFOs>(it.json) }.getOrNull() }

    private suspend fun saveNFOs(data: CachedNFOs) =
        dao.put(HomeCacheEntity(KEY_NFOS, json.encodeToString(data)))

    private suspend fun loadTopFunds(): CachedTopFunds? =
        dao.get(KEY_TOP_FUNDS)?.let { runCatching { json.decodeFromString<CachedTopFunds>(it.json) }.getOrNull() }

    private suspend fun saveTopFunds(data: CachedTopFunds) =
        dao.put(HomeCacheEntity(KEY_TOP_FUNDS, json.encodeToString(data)))

    private suspend fun loadWeather(): CachedWeather? =
        dao.get(KEY_WEATHER)?.let { runCatching { json.decodeFromString<CachedWeather>(it.json) }.getOrNull() }

    private suspend fun saveWeather(data: CachedWeather) =
        dao.put(HomeCacheEntity(KEY_WEATHER, json.encodeToString(data)))
}
