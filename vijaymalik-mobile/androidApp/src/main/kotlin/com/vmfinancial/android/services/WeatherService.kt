package com.vmfinancial.android.services

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.URL
import java.util.Locale
import kotlin.coroutines.resume

// ── Weather Data ──
data class WeatherData(
    val temperature: Double,
    val weatherCode: Int,
    val humidity: Int,
    val windSpeed: Double,
    val isDay: Boolean,
    val cityName: String?,
    val stateName: String? = null,
    val fetchedAt: Long = System.currentTimeMillis()
) {
    val conditionText: String get() = conditionForCode(weatherCode)
    val iconRes: String get() = iconForCode(weatherCode, isDay)

    companion object {
        fun conditionForCode(code: Int): String = when (code) {
            0 -> "Clear"
            1 -> "Mostly Clear"
            2 -> "Partly Cloudy"
            3 -> "Overcast"
            45, 48 -> "Foggy"
            51, 53, 55 -> "Drizzle"
            56, 57 -> "Freezing Drizzle"
            61, 63, 65 -> "Rain"
            66, 67 -> "Freezing Rain"
            71, 73, 75 -> "Snow"
            77 -> "Snow Grains"
            80, 81, 82 -> "Showers"
            85, 86 -> "Snow Showers"
            95 -> "Thunderstorm"
            96, 99 -> "Hail Storm"
            else -> "Clear"
        }

        fun iconForCode(code: Int, isDay: Boolean): String = when (code) {
            0 -> if (isDay) "☀️" else "🌙"
            1 -> if (isDay) "🌤️" else "🌙"
            2 -> if (isDay) "⛅" else "☁️"
            3 -> "☁️"
            45, 48 -> "🌫️"
            51, 53, 55 -> "🌦️"
            56, 57 -> "🌨️"
            61, 63, 65 -> "🌧️"
            66, 67 -> "🌨️"
            71, 73, 75, 77 -> "❄️"
            80, 81, 82 -> "🌧️"
            85, 86 -> "🌨️"
            95, 96, 99 -> "⛈️"
            else -> if (isDay) "☀️" else "🌙"
        }
    }
}

@Serializable
private data class OpenMeteoResponse(
    val current: CurrentWeather
) {
    @Serializable
    data class CurrentWeather(
        val temperature_2m: Double,
        val weather_code: Int,
        val relative_humidity_2m: Int,
        val wind_speed_10m: Double,
        val is_day: Int
    )
}

class WeatherService(private val context: Context) {

    private val _weather = MutableStateFlow<WeatherData?>(null)
    val weather: StateFlow<WeatherData?> = _weather.asStateFlow()

    private val _detectedState = MutableStateFlow<String?>(null)
    val detectedState: StateFlow<String?> = _detectedState.asStateFlow()

    private val _detectedCity = MutableStateFlow<String?>(null)
    val detectedCity: StateFlow<String?> = _detectedCity.asStateFlow()

    private val _detectedDistrict = MutableStateFlow<String?>(null)
    val detectedDistrict: StateFlow<String?> = _detectedDistrict.asStateFlow()

    private val _fullAddress = MutableStateFlow<String?>(null)
    val fullAddress: StateFlow<String?> = _fullAddress.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val json = Json { ignoreUnknownKeys = true }
    private val cacheIntervalMs = 300_000L // 5 min — weather+location refresh on every app open

    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
    }

    fun clearCache() {
        _weather.value = null
        _detectedState.value = null
        _detectedCity.value = null
        _detectedDistrict.value = null
        _fullAddress.value = null
    }

    suspend fun fetchWeatherIfNeeded() {
        val cached = _weather.value
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt < cacheIntervalMs) return

        if (hasLocationPermission()) {
            fetchWithLocation()
        } else {
            _detectedState.value = "Delhi"
            fetchWeather(28.6139, 77.209, "New Delhi", "Delhi")
        }
    }

    suspend fun fetchWithLocation() {
        if (_isLoading.value) return
        _isLoading.value = true

        try {
            val fusedClient = LocationServices.getFusedLocationProviderClient(context)

            // Try getCurrentLocation with HIGH_ACCURACY first
            var location = suspendCancellableCoroutine { cont ->
                try {
                    fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token)
                        .addOnSuccessListener { loc -> cont.resume(loc) }
                        .addOnFailureListener { cont.resume(null) }
                } catch (e: SecurityException) { cont.resume(null) }
            }

            // Fallback: getLastLocation (cached GPS fix — more reliable on real devices)
            if (location == null) {
                location = suspendCancellableCoroutine { cont ->
                    try {
                        fusedClient.lastLocation
                            .addOnSuccessListener { loc -> cont.resume(loc) }
                            .addOnFailureListener { cont.resume(null) }
                    } catch (e: SecurityException) { cont.resume(null) }
                }
            }

            if (location != null) {
                println("WeatherService: Got location ${location.latitude}, ${location.longitude}")
                data class GeoResult(val city: String?, val state: String?, val district: String?, val fullAddr: String?)
                val geo = withContext(Dispatchers.IO) {
                    try {
                        @Suppress("DEPRECATION")
                        val addresses = Geocoder(context, Locale.getDefault())
                            .getFromLocation(location.latitude, location.longitude, 1)
                        val addr = addresses?.firstOrNull()
                        // Collect all address lines for city matching
                        val allLines = buildString {
                            if (addr != null) {
                                for (i in 0..addr.maxAddressLineIndex) {
                                    if (isNotEmpty()) append(" ")
                                    append(addr.getAddressLine(i))
                                }
                            }
                        }.takeIf { it.isNotEmpty() }
                        println("WeatherService: Geocoded city=${addr?.locality}, district=${addr?.subAdminArea}, state=${addr?.adminArea}, full=$allLines")
                        GeoResult(addr?.locality, addr?.adminArea, addr?.subAdminArea, allLines)
                    } catch (e: Exception) {
                        println("WeatherService: Geocoder error: ${e.message}")
                        GeoResult(null, null, null, null)
                    }
                }
                val resolvedState = geo.state ?: "Delhi"
                _detectedState.value = resolvedState
                _detectedCity.value = geo.city
                _detectedDistrict.value = geo.district
                _fullAddress.value = geo.fullAddr
                fetchWeather(location.latitude, location.longitude, geo.city, resolvedState)
            } else {
                println("WeatherService: No location available, defaulting to Delhi")
                _detectedState.value = "Delhi"
                fetchWeather(28.6139, 77.209, "New Delhi", "Delhi")
            }
        } catch (e: Exception) {
            println("WeatherService: Location error: ${e.message}")
            _detectedState.value = "Delhi"
            fetchWeather(28.6139, 77.209, "New Delhi", "Delhi")
        } finally {
            _isLoading.value = false
        }
    }

    private suspend fun fetchWeather(lat: Double, lon: Double, cityName: String?, stateName: String? = null) {
        withContext(Dispatchers.IO) {
            try {
                val url = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon" +
                        "&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,is_day&timezone=auto"
                val responseText = URL(url).readText()
                val response = json.decodeFromString<OpenMeteoResponse>(responseText)
                val c = response.current

                _weather.value = WeatherData(
                    temperature = c.temperature_2m,
                    weatherCode = c.weather_code,
                    humidity = c.relative_humidity_2m,
                    windSpeed = c.wind_speed_10m,
                    isDay = c.is_day == 1,
                    cityName = cityName,
                    stateName = stateName
                )
            } catch (e: Exception) {
                println("Weather fetch error: ${e.message}")
            }
        }
    }
}
