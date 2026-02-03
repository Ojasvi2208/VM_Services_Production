import { NextRequest, NextResponse } from 'next/server';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  imageUrl?: string;
}

interface GNewsArticle {
  title: string;
  description: string;
  url: string;
  source: { name: string };
  publishedAt: string;
  image?: string;
}

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '';

async function fetchGNews(query: string, category: string): Promise<NewsArticle[]> {
  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=in&max=5&apikey=${GNEWS_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 1800 } }); // Cache for 30 mins
    
    if (!response.ok) {
      console.error('GNews API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    return (data.articles || []).map((article: GNewsArticle) => ({
      title: article.title,
      description: article.description || '',
      url: article.url,
      source: article.source?.name || 'Unknown',
      publishedAt: article.publishedAt,
      category,
      imageUrl: article.image
    }));
  } catch (error) {
    console.error('Error fetching GNews:', error);
    return [];
  }
}

// Fallback static news when API is not available
function getFallbackNews(): NewsArticle[] {
  const now = new Date().toISOString();
  return [
    {
      title: "Markets Update: Sensex and Nifty Show Strong Performance",
      description: "Indian stock markets continue their upward trend with positive FII inflows and strong corporate earnings.",
      url: "https://www.moneycontrol.com/news/business/markets/",
      source: "Moneycontrol",
      publishedAt: now,
      category: "markets"
    },
    {
      title: "RBI Monetary Policy: Key Takeaways for Investors",
      description: "Reserve Bank of India announces policy decisions affecting interest rates and market liquidity.",
      url: "https://economictimes.indiatimes.com/markets",
      source: "Economic Times",
      publishedAt: now,
      category: "economy"
    },
    {
      title: "Mutual Fund Inflows Hit Record High",
      description: "SIP investments continue to grow as retail investors show confidence in equity mutual funds.",
      url: "https://www.livemint.com/mutual-fund",
      source: "LiveMint",
      publishedAt: now,
      category: "mutual_funds"
    },
    {
      title: "Global Markets: US Fed Decision Impact on Emerging Markets",
      description: "Federal Reserve's stance on interest rates affects capital flows to emerging economies including India.",
      url: "https://www.reuters.com/markets/",
      source: "Reuters",
      publishedAt: now,
      category: "global"
    },
    {
      title: "Cryptocurrency Market: Bitcoin and Ethereum Price Analysis",
      description: "Digital assets show volatility amid regulatory developments and institutional adoption trends.",
      url: "https://www.coindesk.com/",
      source: "CoinDesk",
      publishedAt: now,
      category: "crypto"
    },
    {
      title: "New Fund Offers: Latest NFO Launches This Month",
      description: "Asset management companies launch new mutual fund schemes targeting different investment objectives.",
      url: "https://www.amfiindia.com/",
      source: "AMFI",
      publishedAt: now,
      category: "nfo"
    }
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  
  try {
    let allNews: NewsArticle[] = [];
    
    if (GNEWS_API_KEY) {
      // Fetch news from different categories
      const queries: { [key: string]: string } = {
        markets: 'Indian stock market BSE NSE',
        mutual_funds: 'mutual funds India investment',
        crypto: 'cryptocurrency bitcoin ethereum',
        global: 'global markets economy geopolitics',
        nfo: 'NFO new fund offer mutual fund launch India',
        business: 'India business finance'
      };
      
      if (category === 'all') {
        const promises = Object.entries(queries).map(([cat, query]) => 
          fetchGNews(query, cat)
        );
        const results = await Promise.all(promises);
        allNews = results.flat();
      } else if (queries[category]) {
        allNews = await fetchGNews(queries[category], category);
      }
      
      // Sort by date
      allNews.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      
      // Limit to 20 articles
      allNews = allNews.slice(0, 20);
    }
    
    // Use fallback if no API key or no results
    if (allNews.length === 0) {
      allNews = getFallbackNews();
      if (category !== 'all') {
        allNews = allNews.filter(n => n.category === category);
      }
    }
    
    return NextResponse.json({
      success: true,
      articles: allNews,
      source: GNEWS_API_KEY ? 'live' : 'fallback',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({
      success: true,
      articles: getFallbackNews(),
      source: 'fallback',
      timestamp: new Date().toISOString()
    });
  }
}
