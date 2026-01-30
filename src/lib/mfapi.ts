// MF API Service - Professional implementation for real-time NAV data

interface NAVData {
  nav: string;
  date: string;
}

interface APIResponse {
  data: NAVData[];
  meta?: {
    scheme_name: string;
  };
}

export class MFAPIService {
  private static readonly BASE_URL = 'https://api.mfapi.in/mf';
  private static readonly TIMEOUT = 10000; // 10 seconds
  private static readonly RETRY_ATTEMPTS = 3;
  
  // Rate limiting
  private static requestQueue: Array<() => Promise<void>> = [];
  private static isProcessingQueue = false;
  private static readonly RATE_LIMIT_DELAY = 100; // 100ms between requests

  // Cache for scheme validation
  private static validSchemes = new Set<string>();

  /**
   * Fetch latest NAV for a specific scheme
   */
  static async getLatestNAV(schemeCode: number): Promise<{
    nav: number;
    date: string;
    schemeName: string;
  } | null> {
    try {
      const data = await this.makeRequest(`/${schemeCode}/latest`);
      
      if (data && data.data && data.data.length > 0) {
        const latest = data.data[0];
        return {
          nav: parseFloat(latest.nav),
          date: latest.date,
          schemeName: data.meta?.scheme_name || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching latest NAV for ${schemeCode}:`, error);
      return null;
    }
  }

  /**
   * Get NAV for a specific scheme (instance method for comprehensive fund service)
   */
  async getNAV(schemeCode: string): Promise<{
    nav: number;
    date: string;
  } | null> {
    try {
      const numericCode = parseInt(schemeCode);
      const data = await MFAPIService.getLatestNAV(numericCode);
      
      if (data) {
        return {
          nav: data.nav,
          date: data.date
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting NAV for ${schemeCode}:`, error);
      return null;
    }
  }

  /**
   * Fetch historical NAV data for a specific scheme
   */
  static async getHistoricalNAV(schemeCode: number, limit: number = 30): Promise<Array<{
    nav: number;
    date: string;
  }>> {
    try {
      const data = await this.makeRequest(`/${schemeCode}`);
      
      if (data && data.data && Array.isArray(data.data)) {
        return data.data
          .slice(0, limit)
          .map((item: NAVData) => ({
            nav: parseFloat(item.nav),
            date: item.date
          }))
          .filter((item: {nav: number; date: string}) => !isNaN(item.nav));
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching historical NAV for ${schemeCode}:`, error);
      return [];
    }
  }

  /**
   * Validate if a scheme code exists
   */
  static async validateScheme(schemeCode: number): Promise<boolean> {
    const cacheKey = schemeCode.toString();
    
    // Check cache first
    if (this.validSchemes.has(cacheKey)) {
      return true;
    }

    try {
      const data = await this.makeRequest(`/${schemeCode}/latest`);
      const isValid = data && data.data && data.data.length > 0;
      
      if (isValid) {
        this.validSchemes.add(cacheKey);
      }
      
      return isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch multiple scheme NAVs in batch (with rate limiting)
   */
  static async getBatchNAVs(schemeCodes: number[]): Promise<Map<number, {
    nav: number;
    date: string;
    schemeName: string;
  }>> {
    const results = new Map();
    
    // Process in smaller chunks to avoid overwhelming the API
    const chunkSize = 10;
    for (let i = 0; i < schemeCodes.length; i += chunkSize) {
      const chunk = schemeCodes.slice(i, i + chunkSize);
      
      const promises = chunk.map(schemeCode => 
        this.addToQueue(() => this.getLatestNAV(schemeCode))
          .then(data => ({ schemeCode, data }))
          .catch(error => {
            console.error(`Error in batch for ${schemeCode}:`, error);
            return { schemeCode, data: null };
          })
      );

      const chunkResults = await Promise.all(promises);
      
      chunkResults.forEach(({ schemeCode, data }) => {
        if (data) {
          results.set(schemeCode, data);
        }
      });

      // Add delay between chunks
      if (i + chunkSize < schemeCodes.length) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * Calculate NAV changes
   */
  static calculateChange(current: number, previous: number): {
    change: number;
    changePercent: number;
  } {
    if (!previous || previous === 0) {
      return { change: 0, changePercent: 0 };
    }

    const change = current - previous;
    const changePercent = (change / previous) * 100;

    return {
      change: parseFloat(change.toFixed(4)),
      changePercent: parseFloat(changePercent.toFixed(2))
    };
  }

  /**
   * Check if NAV data needs update (based on date)
   */
  static shouldUpdateNAV(lastUpdateDate: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    const lastUpdate = new Date(lastUpdateDate).toISOString().split('T')[0];
    
    return today !== lastUpdate;
  }

  /**
   * Get current market date (considering market holidays)
   */
  static getCurrentMarketDate(): string {
    const now = new Date();
    const day = now.getDay();
    
    // If weekend, get Friday's date
    if (day === 0) { // Sunday
      now.setDate(now.getDate() - 2);
    } else if (day === 6) { // Saturday
      now.setDate(now.getDate() - 1);
    }
    
    return now.toISOString().split('T')[0];
  }

  /**
   * Private methods
   */
  private static async makeRequest(endpoint: string): Promise<any> {
    return this.addToQueue(() => this.executeRequest(endpoint));
  }

  private static async executeRequest(endpoint: string): Promise<any> {
    const url = `${this.BASE_URL}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VijayMalik-FinancialServices/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Attempt ${attempt} failed for ${url}:`, lastError.message);
        
        if (attempt < this.RETRY_ATTEMPTS) {
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private static async addToQueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        await this.delay(this.RATE_LIMIT_DELAY);
      }
    }

    this.isProcessingQueue = false;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for MF API
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    timestamp: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Test with a known scheme code
      await this.makeRequest('/120503/latest');
      const latency = Date.now() - startTime;
      
      return {
        status: latency < 2000 ? 'healthy' : 'degraded',
        latency,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }
}