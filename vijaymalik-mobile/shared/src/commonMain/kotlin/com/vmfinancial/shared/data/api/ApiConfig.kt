package com.vmfinancial.shared.data.api

/**
 * API Configuration and Data Sources
 * 
 * DOCUMENTATION OF DATA SOURCES:
 * 
 * FREE APIs (Currently Used):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. AMFI India - Mutual Fund NAVs
 *    URL: https://www.amfiindia.com/spages/NAVAll.txt
 *    Data: All MF NAVs, updated daily by 11 PM IST
 *    Cost: FREE
 *    
 * 2. NSE India - Indian Market Indices
 *    URL: https://www.nseindia.com/api/allIndices
 *    Data: NIFTY 50, NIFTY Bank, Sectoral indices
 *    Cost: FREE (but requires proper headers)
 *    Note: May need scraping approach due to anti-bot measures
 *    
 * 3. BSE India - SENSEX and BSE Indices
 *    URL: https://api.bseindia.com/BseIndiaAPI/api/GetSensexData/w
 *    Data: SENSEX, BSE indices
 *    Cost: FREE
 *    
 * 4. Yahoo Finance (Unofficial)
 *    URL: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
 *    Data: Global indices (S&P 500, NASDAQ, FTSE, DAX, etc.)
 *    Cost: FREE (unofficial, may have rate limits)
 *    Symbols: ^GSPC (S&P), ^IXIC (NASDAQ), ^FTSE, ^GDAXI (DAX)
 *    
 * 5. News RSS Feeds
 *    - Economic Times: https://economictimes.indiatimes.com/rssfeedstopstories.cms
 *    - Mint: https://www.livemint.com/rss/markets
 *    - Moneycontrol: https://www.moneycontrol.com/rss/MCtopnews.xml
 *    Cost: FREE
 *    
 * PAID APIs (For Future - Using Dummy Data Now):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Value Research API
 *    Data: Detailed fund analysis, ratings, portfolio overlap
 *    Cost: PAID (contact for pricing)
 *    Status: Using dummy data for ratings
 *    
 * 2. Morningstar API
 *    Data: Fund ratings, detailed analytics
 *    Cost: PAID (enterprise pricing)
 *    Status: Using dummy data
 *    
 * 3. Real-time Market Data (NSE/BSE official)
 *    Data: Live tick-by-tick data
 *    Cost: PAID (₹50,000+ per month)
 *    Status: Using EOD data instead (FREE)
 *    
 * 4. Bloomberg/Reuters
 *    Data: Premium financial news, real-time data
 *    Cost: PAID (very expensive)
 *    Status: Using free RSS feeds
 */
object ApiConfig {
    // Backend API (our Next.js server)
    const val BASE_URL = "https://www.vmfinancialservices.com/api"
    
    // AMFI NAV API (FREE)
    const val AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt"
    
    // Yahoo Finance for global indices (FREE - unofficial)
    const val YAHOO_FINANCE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
    
    // News RSS Feeds (FREE)
    object NewsFeeds {
        const val ET_MARKETS = "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"
        const val ET_MF = "https://economictimes.indiatimes.com/mf/rssfeeds/4741501.cms"
        const val MINT_MARKETS = "https://www.livemint.com/rss/markets"
        const val MC_TOP = "https://www.moneycontrol.com/rss/MCtopnews.xml"
    }
    
    // Timeouts
    const val CONNECT_TIMEOUT_MS = 30_000L
    const val READ_TIMEOUT_MS = 30_000L
    
    // Cache durations
    const val MARKET_CACHE_MINUTES = 5
    const val NAV_CACHE_MINUTES = 60
    const val NEWS_CACHE_MINUTES = 15
}

/**
 * Dummy data flag - set to false when real APIs are integrated
 */
object DataSourceFlags {
    const val USE_DUMMY_MARKET_DATA = false  // Using Yahoo Finance
    const val USE_DUMMY_NAV_DATA = false     // Using AMFI
    const val USE_DUMMY_NEWS = false         // Using RSS feeds
    const val USE_DUMMY_FUND_RATINGS = true  // PAID - using dummy
    const val USE_DUMMY_FUND_DETAILS = true  // PAID - using dummy for detailed analytics
}
