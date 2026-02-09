import { NextRequest, NextResponse } from 'next/server';

// Live financial news aggregation — NO fake/curated fallback
// GNews free tier: 100 req/day → 2 queries per refresh, 4hr cache = ~12 queries/day max

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  imageUrl?: string;
  isBreaking?: boolean;
}

// Cache for 4 hours (conserves GNews quota: 100 req/day free tier)
let newsCache: { articles: NewsArticle[]; timestamp: number } | null = null;
const CACHE_TTL = 4 * 60 * 60 * 1000;

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '8876ed46171022e2b1d2a1bb2099fe67';

// Helper: fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Categorize articles by keywords in title/description
function categorizeArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/mutual fund|sip |nav |amfi|sebi.*fund|amc |nfo |new fund/)) return 'Mutual Funds';
  if (text.match(/rupee|dollar|forex|currency|exchange rate|usd.inr|eur.inr/)) return 'Forex';
  if (text.match(/tax|gst|budget|fiscal|income tax|ltcg|stcg/)) return 'Tax';
  if (text.match(/ipo |listing|nfo |new fund offer/)) return 'NFO';
  if (text.match(/gdp|rbi|inflation|repo rate|monetary policy|economy/)) return 'Economy';
  if (text.match(/earnings|quarterly|results|revenue|profit|q[1-4]|revenue/)) return 'Stocks';
  if (text.match(/global|fed |china|us market|wall street|nasdaq|s&p|dow/)) return 'Global';
  return 'Markets';
}

async function fetchGNews(query: string, maxArticles = 10): Promise<NewsArticle[]> {
  if (!GNEWS_API_KEY) return [];

  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=in&max=${maxArticles}&sortby=publishedAt&apikey=${GNEWS_API_KEY}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('GNews error:', response.status, await response.text().catch(() => ''));
      return [];
    }

    const data = await response.json();
    return (data.articles || []).map((article: any, index: number) => ({
      id: `gnews-${index}-${Date.now()}`,
      title: article.title || '',
      description: article.description || '',
      url: article.url || '',
      source: article.source?.name || 'News',
      publishedAt: article.publishedAt || new Date().toISOString(),
      category: categorizeArticle(article.title || '', article.description || ''),
      imageUrl: article.image || undefined,
    }));
  } catch (error: any) {
    console.error('GNews fetch error:', error?.name === 'AbortError' ? 'timeout' : error?.message);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'all';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // Check cache
    if (newsCache && Date.now() - newsCache.timestamp < CACHE_TTL) {
      let articles = newsCache.articles;

      if (category !== 'all') {
        articles = articles.filter(a => a.category.toLowerCase() === category.toLowerCase());
      }

      return NextResponse.json({
        success: true,
        articles: articles.slice(0, limit),
        total: articles.length,
        source: 'cache',
        categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Tax', 'NFO', 'Global'],
        timestamp: new Date(newsCache.timestamp).toISOString(),
      });
    }

    // 2 focused queries to conserve GNews quota (100 req/day)
    const [marketNews, financeNews] = await Promise.all([
      fetchGNews('India stock market Nifty Sensex BSE NSE', 10),
      fetchGNews('India mutual fund RBI SEBI economy investment', 10),
    ]);

    let allArticles: NewsArticle[] = [...marketNews, ...financeNews];

    // Remove duplicates by title similarity
    const seen = new Set<string>();
    allArticles = allArticles.filter(article => {
      const key = article.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date (newest first)
    allArticles.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Update cache
    newsCache = { articles: allArticles, timestamp: Date.now() };

    console.log(`News: fetched ${allArticles.length} articles from GNews`);

    // Filter by category if specified
    let filtered = allArticles;
    if (category !== 'all') {
      filtered = filtered.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      articles: filtered.slice(0, limit),
      total: filtered.length,
      source: 'live',
      categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Tax', 'NFO', 'Global'],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('News aggregation error:', error);

    // If we have stale cache, return it rather than nothing
    if (newsCache) {
      let articles = newsCache.articles;
      if (category !== 'all') {
        articles = articles.filter(a => a.category.toLowerCase() === category.toLowerCase());
      }
      return NextResponse.json({
        success: true,
        articles: articles.slice(0, limit),
        total: articles.length,
        source: 'stale-cache',
        categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Tax', 'NFO', 'Global'],
        timestamp: new Date(newsCache.timestamp).toISOString(),
      });
    }

    // Truly no data available
    return NextResponse.json({
      success: true,
      articles: [],
      total: 0,
      source: 'unavailable',
      categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Tax', 'NFO', 'Global'],
      timestamp: new Date().toISOString(),
    });
  }
}
