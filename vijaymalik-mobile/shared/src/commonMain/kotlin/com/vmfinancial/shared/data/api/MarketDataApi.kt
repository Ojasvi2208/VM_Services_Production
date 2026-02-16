package com.vmfinancial.shared.data.api

import com.vmfinancial.shared.data.models.MarketIndex
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*

/**
 * Market Data API Client
 * Fetches real-time market indices from various sources
 */
class MarketDataApi {
    
    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
            })
        }
    }
    
    private val json = Json { ignoreUnknownKeys = true }
    
    /**
     * Fetch Indian market indices (SENSEX, NIFTY)
     * Source: Yahoo Finance (FREE)
     */
    suspend fun getIndianIndices(): List<MarketIndex> {
        val indices = mutableListOf<MarketIndex>()
        
        // SENSEX
        try {
            val sensex = fetchYahooIndex("^BSESN", "SENSEX", "BSE Sensex", "IN", "🇮🇳")
            sensex?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching SENSEX: ${e.message}")
        }
        
        // NIFTY 50
        try {
            val nifty = fetchYahooIndex("^NSEI", "NIFTY50", "Nifty 50", "IN", "🇮🇳")
            nifty?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching NIFTY: ${e.message}")
        }
        
        // NIFTY Bank
        try {
            val niftyBank = fetchYahooIndex("^NSEBANK", "NIFTYBANK", "Nifty Bank", "IN", "🇮🇳")
            niftyBank?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching NIFTY Bank: ${e.message}")
        }
        
        return indices
    }
    
    /**
     * Fetch US market indices (S&P 500, NASDAQ, Dow Jones)
     * Source: Yahoo Finance (FREE)
     */
    suspend fun getUSIndices(): List<MarketIndex> {
        val indices = mutableListOf<MarketIndex>()
        
        // S&P 500
        try {
            val spx = fetchYahooIndex("^GSPC", "SPX", "S&P 500", "US", "🇺🇸")
            spx?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching S&P 500: ${e.message}")
        }
        
        // NASDAQ
        try {
            val nasdaq = fetchYahooIndex("^IXIC", "IXIC", "NASDAQ", "US", "🇺🇸")
            nasdaq?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching NASDAQ: ${e.message}")
        }
        
        // Dow Jones
        try {
            val dji = fetchYahooIndex("^DJI", "DJI", "Dow Jones", "US", "🇺🇸")
            dji?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching Dow Jones: ${e.message}")
        }
        
        return indices
    }
    
    /**
     * Fetch European market indices (FTSE, DAX, CAC)
     * Source: Yahoo Finance (FREE)
     */
    suspend fun getEuropeanIndices(): List<MarketIndex> {
        val indices = mutableListOf<MarketIndex>()
        
        // FTSE 100
        try {
            val ftse = fetchYahooIndex("^FTSE", "FTSE", "FTSE 100", "UK", "🇬🇧")
            ftse?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching FTSE: ${e.message}")
        }
        
        // DAX
        try {
            val dax = fetchYahooIndex("^GDAXI", "DAX", "DAX", "DE", "🇩🇪")
            dax?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching DAX: ${e.message}")
        }
        
        // CAC 40
        try {
            val cac = fetchYahooIndex("^FCHI", "CAC", "CAC 40", "FR", "🇫🇷")
            cac?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching CAC: ${e.message}")
        }
        
        return indices
    }
    
    /**
     * Fetch Asian market indices (Hang Seng, Nikkei)
     * Source: Yahoo Finance (FREE)
     */
    suspend fun getAsianIndices(): List<MarketIndex> {
        val indices = mutableListOf<MarketIndex>()
        
        // Hang Seng
        try {
            val hsi = fetchYahooIndex("^HSI", "HSI", "Hang Seng", "HK", "🇭🇰")
            hsi?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching Hang Seng: ${e.message}")
        }
        
        // Nikkei 225
        try {
            val nikkei = fetchYahooIndex("^N225", "N225", "Nikkei 225", "JP", "🇯🇵")
            nikkei?.let { indices.add(it) }
        } catch (e: Exception) {
            println("Error fetching Nikkei: ${e.message}")
        }
        
        return indices
    }
    
    /**
     * Fetch all market indices
     */
    suspend fun getAllIndices(): List<MarketIndex> {
        val allIndices = mutableListOf<MarketIndex>()
        allIndices.addAll(getIndianIndices())
        allIndices.addAll(getUSIndices())
        allIndices.addAll(getEuropeanIndices())
        allIndices.addAll(getAsianIndices())
        return allIndices
    }
    
    /**
     * Fetch index data from Yahoo Finance
     * This is a FREE unofficial API
     */
    private suspend fun fetchYahooIndex(
        yahooSymbol: String,
        symbol: String,
        name: String,
        country: String,
        flag: String
    ): MarketIndex? {
        return try {
            val response: String = client.get("${ApiConfig.YAHOO_FINANCE_URL}/$yahooSymbol") {
                parameter("interval", "1d")
                parameter("range", "1d")
            }.body()
            
            val jsonResponse = json.parseToJsonElement(response).jsonObject
            val chart = jsonResponse["chart"]?.jsonObject
            val result = chart?.get("result")?.jsonArray?.firstOrNull()?.jsonObject
            val meta = result?.get("meta")?.jsonObject
            
            val regularMarketPrice = meta?.get("regularMarketPrice")?.jsonPrimitive?.doubleOrNull ?: 0.0
            val previousClose = meta?.get("previousClose")?.jsonPrimitive?.doubleOrNull ?: regularMarketPrice
            val change = regularMarketPrice - previousClose
            val changePercent = if (previousClose != 0.0) (change / previousClose) * 100 else 0.0
            
            MarketIndex(
                symbol = symbol,
                name = name,
                country = country,
                countryFlag = flag,
                value = regularMarketPrice,
                change = change,
                changePercent = changePercent,
                previousClose = previousClose,
                lastUpdated = kotlinx.datetime.Clock.System.now().toString(),
                isMarketOpen = meta?.get("marketState")?.jsonPrimitive?.content == "REGULAR"
            )
        } catch (e: Exception) {
            println("Yahoo Finance API error for $symbol: ${e.message}")
            null
        }
    }
    
    fun close() {
        client.close()
    }
}
