import { NextRequest, NextResponse } from 'next/server';

// Multi-source financial news aggregator:
// 1. Direct RSS feeds (ET, Livemint, NDTV) — include real article images
// 2. Google News RSS — broad coverage, no images (Google encrypts redirect URLs)
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
  feedSource: 'google' | 'premium';
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
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Categorize by keywords ─────────────────────────────────────────────────
function categorizeArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/mutual fund|sip |nav |amfi|sebi.*fund|amc |nfo |new fund/)) return 'Mutual Funds';
  if (text.match(/rupee|dollar|forex|currency|exchange rate|usd.inr|eur.inr/)) return 'Forex';
  if (text.match(/gold|silver|crude oil|natural gas|copper|commodity|mcx |metal/)) return 'Commodities';
  if (text.match(/bitcoin|crypto|ethereum|blockchain|web3|defi|nft/)) return 'Crypto';
  if (text.match(/tax|gst|budget|fiscal|income tax|ltcg|stcg/)) return 'Tax';
  if (text.match(/ipo |listing|nfo |new fund offer/)) return 'NFO';
  if (text.match(/gdp|rbi|inflation|repo rate|monetary policy|economy/)) return 'Economy';
  if (text.match(/earnings|quarterly|results|revenue|profit|q[1-4]/)) return 'Stocks';
  if (text.match(/fii|fdi|foreign.*invest|institutional|fpis|dii/)) return 'FII/DII';
  if (text.match(/global|fed |china|us market|wall street|nasdaq|s&p|dow|europe|asia.*market/)) return 'Global';
  if (text.match(/cricket|ipl|sport|football|olympic|tennis|f1|formula/)) return 'Sports';
  return 'Markets';
}

// ─── Clean text — decode entities first, THEN strip HTML tags ────────────────
function cleanText(html: string, maxLen = 0): string {
  let text = html
    // 1. Decode HTML entities FIRST (so encoded tags become real tags)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#\d+;/g, '')
    // 2. THEN strip all HTML tags (including decoded <a href="...">, <b>, etc.)
    .replace(/<[^>]*>/g, '')
    // 3. Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
  return maxLen > 0 ? text.substring(0, maxLen) : text;
}

function cleanDescription(html: string): string {
  return cleanText(html, 300);
}

// ─── Extract image URL from RSS item block ──────────────────────────────────
function extractImageFromBlock(block: string): string | undefined {
  // media:content url (highest priority — usually high-res)
  const mediaContent = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaContent?.[1] && isValidImageUrl(mediaContent[1])) return mediaContent[1];

  // media:thumbnail
  const mediaThumb = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (mediaThumb?.[1] && isValidImageUrl(mediaThumb[1])) return mediaThumb[1];

  // enclosure (type=image)
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*/i);
  if (enclosure?.[1] && isValidImageUrl(enclosure[1])) return enclosure[1];

  // <img src="..."> in description
  const imgTag = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTag?.[1] && isValidImageUrl(imgTag[1])) return imgTag[1];

  return undefined;
}

// ─── Validate image URL (filter out tracking pixels and tiny icons) ─────────
function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  // Filter out tracking pixels
  if (url.includes('scorecardresearch.com')) return false;
  if (url.includes('pixel') || url.includes('beacon')) return false;
  if (url.includes('1x1') || url.includes('1.gif')) return false;
  // Must be http(s)
  if (!url.startsWith('http')) return false;
  return true;
}

// ─── Minimal XML parser (no external deps) ──────────────────────────────────
function parseRSSItems(xml: string): { title: string; link: string; pubDate: string; source: string; description: string; imageUrl?: string }[] {
  const items: { title: string; link: string; pubDate: string; source: string; description: string; imageUrl?: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      let val = (m?.[1] || m?.[2] || '').trim();
      // Strip any residual CDATA markers (nested or malformed)
      val = val.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
      return val.trim();
    };

    const title = getTag('title');
    const link = getTag('link');
    const pubDate = getTag('pubDate');
    const source = getTag('source');
    const description = getTag('description');
    const imageUrl = extractImageFromBlock(block);

    if (title && link) {
      items.push({ title, link, pubDate, source, description, imageUrl });
    }
  }
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 1: Direct RSS feeds — ET, Livemint, NDTV (include real images)
// ═══════════════════════════════════════════════════════════════════════════════

interface DirectFeedConfig {
  url: string;
  sourceName: string;
  defaultCategory: string;
}

const DIRECT_FEEDS: DirectFeedConfig[] = [
  // Premium Indian publishers
  { url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', sourceName: 'Economic Times', defaultCategory: 'Markets' },
  { url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms', sourceName: 'Economic Times', defaultCategory: 'Stocks' },
  { url: 'https://economictimes.indiatimes.com/mf/rssfeeds/2352498.cms', sourceName: 'Economic Times', defaultCategory: 'Mutual Funds' },
  { url: 'https://economictimes.indiatimes.com/wealth/rssfeeds/837555174.cms', sourceName: 'Economic Times', defaultCategory: 'Economy' },
  { url: 'https://www.livemint.com/rss/markets', sourceName: 'Livemint', defaultCategory: 'Markets' },
  { url: 'https://www.livemint.com/rss/money', sourceName: 'Livemint', defaultCategory: 'Mutual Funds' },
  { url: 'https://www.livemint.com/rss/industry', sourceName: 'Livemint', defaultCategory: 'Stocks' },
  { url: 'https://feeds.feedburner.com/ndtvprofit-latest', sourceName: 'NDTV Profit', defaultCategory: 'Markets' },
  // Premium global publishers
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', sourceName: 'CNBC', defaultCategory: 'Global' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', sourceName: 'New York Times', defaultCategory: 'Global' },
];

async function fetchDirectFeed(config: DirectFeedConfig): Promise<NewsArticle[]> {
  try {
    const response = await fetchWithTimeout(config.url, 10000);
    if (!response.ok) return [];

    const xml = await response.text();
    const items = parseRSSItems(xml);

    return items.map((item, index) => {
      const title = cleanText(item.title);
      const category = categorizeArticle(title, item.description);
      return {
        id: `df-${config.sourceName.replace(/\s/g, '')}-${index}-${Date.now()}`,
        title,
        description: cleanDescription(item.description),
        url: item.link,
        source: item.source || config.sourceName,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        category: category === 'Markets' ? config.defaultCategory : category,
        imageUrl: item.imageUrl,
        feedSource: 'premium' as const,
      };
    });
  } catch (error: any) {
    console.error(`Direct feed error (${config.sourceName}):`, error?.name === 'AbortError' ? 'timeout' : error?.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 2: Google News RSS — broad coverage (no images — URLs are encrypted)
// ═══════════════════════════════════════════════════════════════════════════════

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
      const rawTitle = cleanText(item.title);
      const titleParts = rawTitle.split(' - ');
      const sourceName = item.source || (titleParts.length > 1 ? titleParts.pop()! : 'News');
      const cleanTitle = item.source ? rawTitle : titleParts.join(' - ');

      return {
        id: `gn-${index}-${Date.now()}`,
        title: cleanTitle,
        description: cleanDescription(item.description),
        url: item.link,
        source: sourceName,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        category: categorizeArticle(cleanTitle, item.description),
        imageUrl: item.imageUrl, // Will be undefined for Google News
        feedSource: 'google' as const,
      };
    });
  } catch (error: any) {
    console.error('Google News RSS fetch error:', error?.name === 'AbortError' ? 'timeout' : error?.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fetch og:image for articles that have real URLs (non-Google News)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchOgImage(articleUrl: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!response.ok) return undefined;

    // Stream-read only <head> (first ~50KB)
    const reader = response.body?.getReader();
    if (!reader) return undefined;

    let html = '';
    const decoder = new TextDecoder();
    try {
      while (html.length < 50000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break;
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    // og:image (both attribute orders)
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1] && isValidImageUrl(ogMatch[1])) return ogMatch[1];

    // Fallback: twitter:image
    const twMatch = html.match(/<meta[^>]+(?:name|property)=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']twitter:image["']/i);
    if (twMatch?.[1] && isValidImageUrl(twMatch[1])) return twMatch[1];

    return undefined;
  } catch {
    return undefined;
  }
}

// ─── Core fetch: parallel from all sources, dedup, sort, enrich ─────────────
async function fetchAllNews(): Promise<NewsArticle[]> {
  // Run all feeds in parallel — direct feeds + Google News
  const [directResults, googleResults] = await Promise.all([
    // Direct RSS feeds (ET, Livemint, NDTV) — these have images
    Promise.all(DIRECT_FEEDS.map(feed => fetchDirectFeed(feed))),
    // Google News — broad coverage, no images
    Promise.all([
      fetchGoogleNewsRSS('India stock market Nifty Sensex'),
      fetchGoogleNewsRSS('India mutual fund SIP SEBI AMFI'),
      fetchGoogleNewsRSS('India economy RBI investment finance'),
      fetchGoogleNewsRSS('India rupee dollar forex currency exchange rate'),
      fetchGoogleNewsRSS('India gold silver crude oil commodity MCX metals'),
      fetchGoogleNewsRSS('India quarterly results earnings financial results company'),
      fetchGoogleNewsRSS('bitcoin crypto ethereum blockchain India'),
      fetchGoogleNewsRSS('FII FDI foreign investment India institutional investors'),
      fetchGoogleNewsRSS('global markets US Federal Reserve Europe Asia economy'),
      fetchGoogleNewsRSS('India business industry corporate news'),
    ]),
  ]);

  const directArticles = directResults.flat();
  const googleArticles = googleResults.flat();

  const directWithImages = directArticles.filter(a => a.imageUrl).length;
  console.log(`News: ${directArticles.length} direct articles (${directWithImages} with images), ${googleArticles.length} from Google News`);

  // Merge: direct feeds first (they have images), then Google News
  let allArticles: NewsArticle[] = [...directArticles, ...googleArticles];

  // Filter out blocked sources (no images, low quality)
  const BLOCKED_SOURCES = ['meyka'];
  allArticles = allArticles.filter(article =>
    !BLOCKED_SOURCES.some(blocked => article.source.toLowerCase().includes(blocked))
  );

  // Deduplicate by title prefix (50 chars)
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

  // ── Enrich: scrape og:image for direct-feed articles missing images ──
  // Only for non-Google-News articles (Google News URLs are opaque redirects)
  const ENRICH_LIMIT = 20;
  let enriched = 0;
  const enrichPromises = allArticles.slice(0, 80).map(async (article, i) => {
    if (article.imageUrl) return; // Already has image
    if (article.url.includes('news.google.com')) return; // Skip Google News
    if (enriched >= ENRICH_LIMIT) return; // Limit concurrent fetches
    enriched++;
    const ogImage = await fetchOgImage(article.url);
    if (ogImage) allArticles[i] = { ...article, imageUrl: ogImage };
  });
  await Promise.allSettled(enrichPromises);

  const totalWithImages = allArticles.filter(a => a.imageUrl).length;
  console.log(`News: total ${allArticles.length} articles, ${totalWithImages} with images`);

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
      console.log(`News: cached ${articles.length} articles`);
      return articles;
    })
    .catch(error => {
      console.error('News fetch failed:', error);
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
  const limit = parseInt(searchParams.get('limit') || '50');
  const feed = searchParams.get('feed') || 'all'; // 'home' | 'premium' | 'all'

  try {
    const allArticles = await getArticles();

    let filtered = allArticles;

    // Feed source filter: home = Google News only, premium = publisher feeds only
    if (feed === 'home') {
      filtered = filtered.filter(a => a.feedSource === 'google');
    } else if (feed === 'premium') {
      filtered = filtered.filter(a => a.feedSource === 'premium');
    }

    if (category !== 'all') {
      filtered = filtered.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }

    const isCached = newsCache ? (Date.now() - newsCache.timestamp < CACHE_TTL) : false;

    return NextResponse.json({
      success: true,
      articles: filtered.slice(0, limit),
      total: filtered.length,
      source: isCached ? 'cache' : 'live',
      categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Commodities', 'Crypto', 'Global', 'FII/DII', 'Tax', 'NFO', 'Sports'],
      timestamp: newsCache ? new Date(newsCache.timestamp).toISOString() : new Date().toISOString(),
    });

  } catch (error) {
    console.error('News aggregation error:', error);

    return NextResponse.json({
      success: true,
      articles: newsCache?.articles?.slice(0, limit) || [],
      total: newsCache?.articles?.length || 0,
      source: newsCache ? 'stale-cache' : 'unavailable',
      categories: ['Markets', 'Mutual Funds', 'Stocks', 'Economy', 'Forex', 'Commodities', 'Crypto', 'Global', 'FII/DII', 'Tax', 'NFO', 'Sports'],
      timestamp: new Date().toISOString(),
    });
  }
}
