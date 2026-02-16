package com.vmfinancial.android.services

import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.FundDetailResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Singleton prefetch cache for fund detail data.
 *
 * Strategy:
 *  - When user scrolls near a fund in the search list, call prefetch(schemeCode)
 *  - Low-priority coroutine fetches detail in the background
 *  - FundDetailScreen checks cache first → instant load if hit
 *  - Cache evicts after 15 minutes or 20 entries (LRU)
 *
 * Memory: Only stores FundDetailResponse (lightweight — no NAV chart data in cache).
 * Retrieval: O(1) ConcurrentHashMap lookup.
 */
object FundDetailCache {

    private const val MAX_ENTRIES = 20
    private const val CACHE_TTL_MS = 15 * 60 * 1000L // 15 minutes

    private data class CacheEntry(
        val data: FundDetailResponse,
        val timestamp: Long = System.currentTimeMillis()
    ) {
        fun isStale(): Boolean = System.currentTimeMillis() - timestamp > CACHE_TTL_MS
    }

    private val cache = ConcurrentHashMap<String, CacheEntry>()
    private val prefetchInFlight = ConcurrentHashMap<String, Boolean>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val api = BackendApi()

    /**
     * Get cached fund detail if available and fresh. O(1).
     */
    fun get(schemeCode: String): FundDetailResponse? {
        val entry = cache[schemeCode] ?: return null
        if (entry.isStale()) {
            cache.remove(schemeCode)
            return null
        }
        return entry.data
    }

    /**
     * Get cached fund detail even if stale (for Stale-While-Revalidate pattern).
     * Returns (data, ageMs) or null if not cached at all.
     */
    fun getAny(schemeCode: String): Pair<FundDetailResponse, Long>? {
        val entry = cache[schemeCode] ?: return null
        val ageMs = System.currentTimeMillis() - entry.timestamp
        return entry.data to ageMs
    }

    /**
     * Store a fund detail response in cache.
     */
    fun put(schemeCode: String, data: FundDetailResponse) {
        evictIfNeeded()
        cache[schemeCode] = CacheEntry(data)
    }

    /**
     * Low-priority prefetch. Called when a fund item becomes visible on screen.
     * Skips if already cached or already in-flight.
     */
    fun prefetch(schemeCode: String) {
        // Skip if already cached and fresh
        if (get(schemeCode) != null) return
        // Skip if already fetching
        if (prefetchInFlight.putIfAbsent(schemeCode, true) != null) return

        scope.launch {
            try {
                val detail = api.getFundDetails(schemeCode)
                put(schemeCode, detail)
            } catch (e: Exception) {
                // Prefetch failure is silent — not critical
            } finally {
                prefetchInFlight.remove(schemeCode)
            }
        }
    }

    /**
     * Evict oldest entries if cache exceeds MAX_ENTRIES.
     */
    private fun evictIfNeeded() {
        if (cache.size >= MAX_ENTRIES) {
            // Remove oldest entry
            val oldest = cache.entries.minByOrNull { it.value.timestamp }
            oldest?.let { cache.remove(it.key) }
        }
        // Also evict any stale entries
        cache.entries.removeAll { it.value.isStale() }
    }

    fun clear() {
        cache.clear()
        prefetchInFlight.clear()
    }
}
