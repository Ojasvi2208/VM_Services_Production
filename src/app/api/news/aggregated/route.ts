import { NextRequest, NextResponse } from 'next/server';

// Live financial news via Google News RSS — completely free, no API key, no rate limits
// Cache: 1 hour. Concurrent requests share one in-flight fetch (no thundering herd).

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

// ─── Cache (1 hour) ─────────────────────────────────────────────────────────
let newsCache: { articles: NewsArticle[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── In-flight lock (prevents duplicate fetches from concurrent requests) ───
let inflightPromise: Promise<NewsArticle[]> | null = null;

// ─── Fetch with timeout ─────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Categorize by keywords ─────────────────────────────────────────────────
function categorizeArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/mutual fund|sip |nav |amfi|sebi.*fund|amc |nfo |new fund/)) return 'Mutual Funds';
  if (text.match(/rupee|dollar|forex|currency|exchange rate|usd.inr|eur.inr/)) return 'Forex';
  if (text.match(/tax|gst|budget|fiscal|income tax|ltcg|stcg/)) return 'Tax';
  if (text.match(/ipo |listing|nfo |new fund offer/)) return 'NFO';
  if (text.match(/gdp|rbi|inflation|repo rate|monetary policy|economy/)) return 'Economy';
  if (text.match(/earnings|quarterly|results|revenue|profit|q[1-4]/)) return 'Stocks';
  if (text.match(/global|fed |china|us market|wall street|nasdaq|s&p|dow/)) return 'Global';
  return 'Markets';
}

// ─── Minimal XML parser (no external deps) ──────────────────────────────────
function parseRSSItems(xml: string): { title: string; link: string; pubDate: string; source: string; description: string }[] {
  const items: { title: string; link: string; pubDate: string; source: string; description: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return (m?.[1] || m?.[2] || '').trim();
    };

    const title = getTag('title');
    const link = getTag('link');
    const pubDate = getTag('pubDate');
    const source = getTag('source');
    const description = getTag('description');

    if (title && link) {
      items.push({ title, link, pubDate, source, description });
    }
  }
  return items;
}

// ─── Fetch one Google News RSS feed ─────────────────────────────────────────
async function fetchGoogleNewsRSS(query: string): Promise<NewsArticle[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('Google News RSS error:', response.status);
      return [];
    }

    const xml = await response.text();
    const items = parseRSSItems(xml);

    return items.map((item, index) => {
      // Clean title: Google News appends " - Source" at the end
      const titleParts = item.title.split(' - ');
      const sourceName = item.source || (titleParts.length > 1 ? titleParts.pop()! : 'News');
      const cleanTitle = item.source ? item.title : titleParts.join(' - ');

      return {
        id: `gn-${index}-${Date.now()}`,
        title: cleanTitle,
        description: item.description.replace(/<[^>]*>/g, '').substring(0, 200),
        url: item.link,
        source: sourceName,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        category: categorizeArticle(cleanTitle, item.description),
      };
    });
  } catch (error: any) {
    console.error('Google News RSS fetch error:', error?.name === 'AbortError' ? 'timeout' : error?.message);
    return [];
  }
}

// ─── Core fetch: runs 3 parallel queries, deduplicates, sorts ───────────────
async function fetchAllNews(): Promise<NewsArticle[]> {
  const [marketNews, mfNews, economyNews] = await Promise.all([
    fetchGoogleNewsRSS('India stock market Nifty Sensex'),
    fetchGoogleNewsRSS('India mutual fund SIP SEBI AMFI'),
    fetchGoogleNewsRSS('India economy RBI investment finance'),
  ]);

  let allArticles: NewsArticle[] = [...marketNews, ...mfNews, ...economyNews];

  // Deduplicate by title prefix
  const seen = new Set<string>();
  allArticles = allArticles.filter(article => {
    const key = article.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort newest first
  allArticles.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return allArticles;
}

// ─── Guarded fetch: prevents thundering herd ────────────────────────────────
async function getArticles(): Promise<NewsArticle[]> {
  // Serve from cache if fresh
  if (newsCache && Date.now() - newsCache.timestamp < CACHE_TTL) {
    return newsCache.articles;
  }

  // If a fetch is already in-flight, piggyback on it
  if (inflightPromise) {
    return inflightPromise;
  }

  // Start a new fetch
  inflightPromise = fetchAllNews()
    .then(articles => {
      newsCache = { articles, timestamp: Date.now() };
      console.log(`News: cached ${articles.length} articles from Google News RSS`);
      return articles;
    })
    .catch(error => {
      console.error('News fetch failed:', error);
      // Return stale cache if available
      return newsCache?.articles || [];
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

// ─── API handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'all';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    const allArticles = await getArticles();

    let filtered = allArticles;
    if (category !== 'all') {
      filtered = filtered.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }

    const isCached = newsCache ? (Date.now() - newsCache.timestamp < CACHE_TTL) : false;

    return NextResponse.json({
      success: true,
      articles: filtered.slice(0, limit),
      total: filtered.length,
      source: isCached ? 'cache' : 'live',
      categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Tax', 'NFO', 'Global'],
      timestamp: newsCache ? new Date(newsCache.timestamp).toISOString() : new Date().toISOString(),
    });

  } catch (error) {
    console.error('News aggregation error:', error);

    return NextResponse.json({
      success: true,
      articles: newsCache?.articles?.slice(0, limit) || [],
      total: newsCache?.articles?.length || 0,
      source: newsCache ? 'stale-cache' : 'unavailable',
      categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Tax', 'NFO', 'Global'],
      timestamp: new Date().toISOString(),
    });
  }
}
