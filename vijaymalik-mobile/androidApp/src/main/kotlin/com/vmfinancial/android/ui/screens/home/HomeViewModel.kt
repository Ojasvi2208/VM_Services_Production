package com.vmfinancial.android.ui.screens.home

import android.app.Application
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.vmfinancial.android.R
import com.vmfinancial.android.data.repository.HomeCacheRepository
import com.vmfinancial.android.services.AllFuelPrices
import com.vmfinancial.android.services.FuelPriceResult
import com.vmfinancial.android.services.FuelPriceService
import com.vmfinancial.android.services.VMFirebaseMessagingService
import com.vmfinancial.android.services.WeatherData
import com.vmfinancial.android.services.WeatherService
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicLong

data class HomeUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,      // True = stale data shown, background fetch running
    val isMarketOpen: Boolean = false,
    val indianMarkets: List<MarketIndex> = emptyList(),
    val usMarkets: List<MarketIndex> = emptyList(),
    val headlines: List<Headline> = emptyList(),
    val corporateActions: List<CorporateActionItem> = emptyList(),
    val currencyRates: List<CurrencyRate> = emptyList(),
    val commodities: List<CommodityItem> = emptyList(),
    val fuelPrices: AllFuelPrices? = null,
    val nfos: List<NFOLiveItem> = emptyList(),
    val topFunds: List<TopFundItem> = emptyList(),
    val giftNifty: GiftNiftyData? = null,
    val weather: WeatherData? = null,
    val error: String? = null
)

class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val api = BackendApi()
    private val weatherService = WeatherService(application)
    private val fuelPriceService = FuelPriceService(application)
    private val cacheRepo = HomeCacheRepository(application)
    private var lastKnownLocation: String? = null
    private var loadingJob: Job? = null

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    // Race condition guard: monotonically increasing fetch version
    private val fetchVersion = AtomicLong(0L)

    // Cache: don't re-fetch if data is less than 15 minutes old
    private var lastFetchTime: Long = 0L
    private val CACHE_DURATION_MS = 15 * 60 * 1000L  // 15 minutes

    // Same symbols iOS uses
    private val indianSymbols = listOf(
        "NIFTY", "BANKNIFTY", "NIFTYIT", "NIFTYNEXT50",
        "NIFTYMIDCAP150", "NIFTYSMALLCAP100", "NIFTYPHARMA", "NIFTYAUTO",
        "NIFTYFMCG", "NIFTYMETAL", "NIFTYREALTY", "NIFTYENERGY",
        "NIFTYINFRA", "NIFTYPSE", "NIFTYFINSERVICE", "NIFTYPVTBANK",
        "SENSEX", "BSE500", "BSEMIDCAP", "BSESMALLCAP", "BSEFMCG",
        "BSEIT", "BSEHEALTHCARE", "BSEAUTO", "BSEMETAL", "BSEOILGAS",
        "BSEREALTY", "BSECG", "BSEPOWER"
    )

    /**
     * Stale-While-Revalidate entry point.
     * 1. Load cached data from Room → render instantly (<50ms)
     * 2. If cache is fresh (<15min), stop
     * 3. Otherwise, show cached data + "Updating..." indicator + background fetch
     * 4. Versioned writes prevent stale overwrites on navigation/late returns
     */
    fun loadDailyBriefing(forceRefresh: Boolean = false) {
        // If in-memory state is fresh, skip
        val now = System.currentTimeMillis()
        val hasCachedData = _uiState.value.indianMarkets.isNotEmpty()
        if (!forceRefresh && hasCachedData && (now - lastFetchTime) < CACHE_DURATION_MS) {
            return
        }

        loadingJob?.cancel()
        loadingJob = viewModelScope.launch {
            // ── Phase 1: Instant render from disk cache ──
            if (!hasCachedData) {
                val cached = cacheRepo.loadCached()
                if (cached != null) {
                    // Render stale data immediately — user sees content in <100ms
                    _uiState.value = cached.copy(isLoading = false, isRefreshing = true)
                    println("HomeViewModel: Rendered cached data, starting background refresh")
                } else {
                    // First launch — no cache → show shimmer
                    _uiState.value = _uiState.value.copy(isLoading = true, error = null)
                    println("HomeViewModel: First launch, showing shimmer")
                }
            } else {
                // In-memory data exists but stale → show refreshing indicator
                _uiState.value = _uiState.value.copy(isRefreshing = true)
            }

            // ── Phase 2: Parallel network fetch ──
            val thisVersion = fetchVersion.incrementAndGet()

            // Fetch weather + detect location first (needed for fuel prices)
            weatherService.fetchWeatherIfNeeded()

            // Collect weather updates in background
            launch {
                weatherService.weather.collect { w ->
                    if (fetchVersion.get() == thisVersion) {
                        _uiState.value = _uiState.value.copy(weather = w)
                    }
                }
            }

            // Use GPS-detected state + city/district/address for fuel prices
            val detectedState = weatherService.detectedState.value ?: "Delhi"
            val detectedCity = weatherService.detectedCity.value
            val detectedDistrict = weatherService.detectedDistrict.value
            val fullAddress = weatherService.fullAddress.value
            println("HomeViewModel: Fuel API using state='$detectedState', city='$detectedCity', district='$detectedDistrict'")

            // Each API call independent — one failure must NOT affect others (matching iOS)
            val marketDeferred = async { runCatching { api.getMarketData(indianSymbols) }.getOrNull() }
            val newsDeferred = async { runCatching { api.getAggregatedNews("all", 30) }.getOrNull() }
            val nfoDeferred = async { runCatching { api.getNFOs() }.getOrNull() }
            val fundsDeferred = async { runCatching { api.getTopFunds() }.getOrNull() }
            val giftNiftyDeferred = async { runCatching { api.getGiftNifty() }.getOrNull() }
            val corporateDeferred = async { runCatching { api.getCorporateActions() }.getOrNull() }
            val currencyDeferred = async { runCatching { api.getCurrencyRates() }.getOrNull() }
            val commoditiesDeferred = async { runCatching { api.getCommodities() }.getOrNull() }
            val fuelDeferred = async { runCatching { fuelPriceService.fetchFuelPrices(detectedState, detectedCity, detectedDistrict, fullAddress) }.getOrNull() as? FuelPriceResult }

            val marketResp = marketDeferred.await()
            val newsResp = newsDeferred.await()
            val nfoResp = nfoDeferred.await()
            val fundsResp = fundsDeferred.await()
            val giftNiftyResp = giftNiftyDeferred.await()
            val corporateResp = corporateDeferred.await()
            val currencyResp = currencyDeferred.await()
            val commoditiesResp = commoditiesDeferred.await()
            val fuelResult = fuelDeferred.await()

            // ── Race condition guard: only apply if this is still the latest fetch ──
            if (fetchVersion.get() != thisVersion) {
                println("HomeViewModel: Discarding stale fetch v$thisVersion (current: ${fetchVersion.get()})")
                return@launch
            }

            // Handle fuel price result
            var fuelPrices: AllFuelPrices? = null
            when (fuelResult) {
                is FuelPriceResult.Success -> fuelPrices = fuelResult.prices
                is FuelPriceResult.Error -> fuelPrices = fuelResult.cached
                null -> { }
            }

            // Convert MarketDataItems to MarketIndex (matching iOS mapping)
            val allIndices = marketResp?.data?.map { item ->
                MarketIndex(
                    symbol = item.symbol,
                    name = item.name,
                    country = "IN",
                    countryFlag = "",
                    value = item.price,
                    change = item.change,
                    changePercent = item.changePercent,
                    previousClose = item.price - item.change,
                    lastUpdated = item.lastUpdated,
                    isMarketOpen = item.isMarketOpen
                )
            } ?: emptyList()

            // Convert news articles to Headlines (matching iOS mapping)
            val headlines = newsResp?.articles?.take(6)?.mapIndexed { index, article ->
                Headline(
                    id = "$index",
                    title = article.title,
                    source = article.source,
                    publishedAt = formatTimeAgo(article.publishedAt),
                    category = mapNewsCategory(article.category),
                    isBreaking = index == 0,
                    url = article.url
                )
            } ?: emptyList()

            val fuelLocation = fuelPrices?.let { "${it.cityName}, ${it.stateName}" } ?: detectedState

            // Trigger fuel price notification if location changed
            if (lastKnownLocation != null && lastKnownLocation != fuelLocation && fuelPrices != null) {
                sendFuelPriceNotification(fuelPrices)
            }
            lastKnownLocation = fuelLocation

            val newState = _uiState.value.copy(
                isLoading = false,
                isRefreshing = false,
                isMarketOpen = marketResp?.isMarketOpen ?: false,
                indianMarkets = allIndices.ifEmpty { _uiState.value.indianMarkets },
                headlines = headlines.ifEmpty { _uiState.value.headlines },
                corporateActions = corporateResp?.actions?.take(5) ?: _uiState.value.corporateActions,
                currencyRates = currencyResp?.rates ?: _uiState.value.currencyRates,
                commodities = commoditiesResp?.commodities ?: _uiState.value.commodities,
                fuelPrices = fuelPrices ?: _uiState.value.fuelPrices,
                nfos = nfoResp?.open ?: _uiState.value.nfos,
                topFunds = fundsResp?.funds ?: _uiState.value.topFunds,
                giftNifty = giftNiftyResp?.data ?: _uiState.value.giftNifty
            )
            _uiState.value = newState
            lastFetchTime = System.currentTimeMillis()

            // ── Phase 3: Persist to disk cache for next cold start ──
            cacheRepo.saveFresh(newState)
        }
    }

    private fun sendFuelPriceNotification(fuel: AllFuelPrices) {
        val app = getApplication<Application>()
        val location = "${fuel.cityName}, ${fuel.stateName}"
        val petrolStr = fuel.petrolPrice?.let { String.format("₹%.2f", it) } ?: "N/A"
        val dieselStr = fuel.dieselPrice?.let { String.format("₹%.2f", it) } ?: "N/A"
        val cngStr = fuel.cngPrice?.let { String.format("₹%.2f", it) } ?: ""
        val lpgStr = fuel.lpgPrice?.let { String.format("₹%.0f", it) } ?: ""

        val bigText = buildString {
            append("Petrol: $petrolStr/${fuel.petrolUnit ?: "litre"}\n")
            append("Diesel: $dieselStr/${fuel.dieselUnit ?: "litre"}")
            if (cngStr.isNotEmpty()) append("\nCNG: $cngStr/${fuel.cngUnit ?: "kg"}")
            if (lpgStr.isNotEmpty()) append("\nLPG: $lpgStr/${fuel.lpgUnit ?: "14.2kg"}")
            append("\n\nPrices for $location based on your current location.")
        }

        val notification = NotificationCompat.Builder(app, VMFirebaseMessagingService.CHANNEL_GENERAL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("⛽ Fuel Prices in $location")
            .setContentText("Petrol: $petrolStr | Diesel: $dieselStr")
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
            .setAutoCancel(true)
            .setColor(0xFF14B8A6.toInt())
            .build()

        val manager = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(9001, notification)
    }

    // Matches iOS HomeViewModel.formatTimeAgo
    private fun formatTimeAgo(dateString: String): String {
        return try {
            val formats = listOf(
                java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US),
                java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US),
                java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US)
            )
            formats.forEach { it.timeZone = java.util.TimeZone.getTimeZone("UTC") }

            val date = formats.firstNotNullOfOrNull { fmt ->
                try { fmt.parse(dateString) } catch (e: Exception) { null }
            } ?: return if (dateString.length >= 10) dateString.substring(0, 10) else dateString

            val diff = (System.currentTimeMillis() - date.time) / 1000
            when {
                diff < 60 -> "Just now"
                diff < 3600 -> "${diff / 60} min ago"
                diff < 86400 -> "${diff / 3600}h ago"
                diff < 604800 -> "${diff / 86400}d ago"
                else -> {
                    val fmt = java.text.SimpleDateFormat("dd MMM", java.util.Locale.US)
                    fmt.format(date)
                }
            }
        } catch (e: Exception) { dateString }
    }

    // Matches iOS HomeViewModel.mapNewsCategory
    private fun mapNewsCategory(category: String): NewsCategory {
        return when (category.lowercase()) {
            "markets" -> NewsCategory.MARKETS
            "mutual_funds" -> NewsCategory.MUTUAL_FUNDS
            "economy" -> NewsCategory.ECONOMY
            "corporate", "business" -> NewsCategory.CORPORATE
            "global" -> NewsCategory.GLOBAL
            "nfo" -> NewsCategory.NFO
            else -> NewsCategory.MARKETS
        }
    }

    @Suppress("unused")
    fun refreshFuelPrices() {
        loadDailyBriefing()
    }

    @Suppress("unused")
    fun dismissCityPicker() {
        // No-op: city picker removed. Backend always returns data via fallback chain.
    }

    fun onLocationPermissionGranted() {
        // Cancel any in-flight load that may have used Delhi fallback
        loadingJob?.cancel()
        weatherService.clearCache()
        lastFetchTime = 0L  // Force re-fetch with new location
        loadDailyBriefing(forceRefresh = true)
    }

    override fun onCleared() {
        super.onCleared()
        api.close()
    }
}
