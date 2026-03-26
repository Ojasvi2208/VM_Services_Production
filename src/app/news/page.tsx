'use client';

import { useState, useEffect, useCallback } from 'react';
import NavBar      from '@/components/home/NavBar';
import SiteFooter  from '@/components/home/SiteFooter';
import ComplianceDisclaimer from '@/components/ComplianceDisclaimer';

// ── Types ─────────────────────────────────────────────────────
interface NewsItem {
  title:        string;
  link:         string;
  pubDate?:     string;
  source?:      string;
  category?:    string;
  description?: string;
  imageUrl?:    string;
}

interface MarketIndex {
  symbol:        string;
  name:          string;
  price?:        number;
  change?:       number;
  changePercent?: number;
  pChange?:      number;
}

// ── Constants ─────────────────────────────────────────────────
const ARTICLES_PER_PAGE = 4;
const TOTAL_PAGES       = 5;
const TOTAL_ARTICLES    = 1 + ARTICLES_PER_PAGE * TOTAL_PAGES; // 21

const CATEGORIES = ['All Insights', 'Market Pulse', 'Mutual Funds', 'Economy', 'Corporate', 'Global Macro'];

// Gradient palettes for image placeholders (keyed by category/source)
const PLACEHOLDER_GRADIENTS = [
  'from-[#0d2a1e] to-[#091a10]',
  'from-[#1a1a2e] to-[#0d0d1a]',
  'from-[#2a1a0d] to-[#1a0d09]',
  'from-[#1a0d2a] to-[#0d091a]',
  'from-[#0d1a2a] to-[#091018]',
  'from-[#2a1a1a] to-[#1a0d0d]',
];

function placeholderGradient(index: number): string {
  return PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
}

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const d    = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sourceInitials(item: NewsItem): string {
  const src = item.source || item.category || '';
  return src.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'NS';
}

// ── Image with guaranteed fallback ────────────────────────────
function ArticleImage({
  imageUrl, title, index, className = '',
}: {
  imageUrl?: string; title: string; index: number; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const grad = placeholderGradient(index);

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={title}
        className={`w-full h-full object-cover ${className}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  // Placeholder: gradient + title initials
  return (
    <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center relative ${className}`}>
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(68,245,147,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(68,245,147,0.15)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <span className="relative text-3xl font-display font-black text-[#44f593]/30 select-none">
        {title.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

// ── Hero article (always visible, index 0) ───────────────────
function HeroCard({ item, index }: { item: NewsItem; index: number }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl bg-[#161d1a] hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-500">
      <div className="aspect-[21/8] overflow-hidden relative">
        <ArticleImage imageUrl={item.imageUrl} title={item.title} index={index} className="group-hover:scale-105 transition-transform duration-700" />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#161d1a] via-[#161d1a]/40 to-transparent" />
        {/* Source badge */}
        <div className="absolute top-5 left-5">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#44f593] bg-[#001f10]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[#44f593]/30">
            {item.source ?? 'Market Report'}
          </span>
        </div>
        {/* Time badge */}
        <div className="absolute top-5 right-5">
          <span className="text-xs font-mono text-[#859586] bg-[#060d0a]/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
            {timeAgo(item.pubDate)}
          </span>
        </div>
      </div>

      <div className="p-7 md:p-9">
        <a href={item.link} target="_blank" rel="noopener noreferrer" className="block">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 group-hover:text-[#44f593] transition-colors leading-tight text-[#dce5df] line-clamp-3">
            {item.title}
          </h2>
        </a>
        {item.description && (
          <p className="text-[#c0c9c2] text-base leading-relaxed line-clamp-2 mb-5">
            {item.description}
          </p>
        )}
        <div className="flex items-center justify-between pt-5 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center text-[#44f593] text-xs font-bold font-mono">
              {sourceInitials(item)}
            </div>
            <span className="text-xs font-semibold text-[#859586]">{item.source ?? 'AlphaSense'}</span>
          </div>
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            className="text-[#44f593] flex items-center gap-2 font-bold text-xs hover:gap-3 transition-all group/link">
            Read Full Story
            <svg className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}

// ── Regular article card ──────────────────────────────────────
function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer"
      className="group block bg-[#161d1a] rounded-2xl overflow-hidden hover:bg-[#19211e] transition-colors">
      <div className="aspect-video overflow-hidden relative">
        <ArticleImage imageUrl={item.imageUrl} title={item.title} index={index} className="group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#44f593] bg-[#44f593]/10 px-2.5 py-1 rounded-full">
            {item.source ?? item.category ?? 'News'}
          </span>
          <span className="text-[11px] font-mono text-[#859586]">{timeAgo(item.pubDate)}</span>
        </div>
        <h4 className="text-sm font-display font-bold mb-2 leading-snug group-hover:text-[#44f593] transition-colors text-[#dce5df] line-clamp-3">
          {item.title}
        </h4>
        {item.description && (
          <p className="text-xs text-[#859586] line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>
    </a>
  );
}

// ── Market Pulse Widget ───────────────────────────────────────
function MarketPulseWidget() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/market-data')
      .then(r => r.json())
      .then(data => { setIndices((data?.indices ?? data?.data ?? []).slice(0, 5)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fallback: MarketIndex[] = [
    { symbol: 'NIFTY50',   name: 'Nifty 50',        price: 24200, pChange: 0.82 },
    { symbol: 'SENSEX',    name: 'BSE Sensex',       price: 79800, pChange: 0.74 },
    { symbol: 'BANKNIFTY', name: 'Bank Nifty',       price: 51200, pChange: -0.24 },
    { symbol: 'NIFTYMID',  name: 'Nifty Midcap 100', price: 55100, pChange: 1.12 },
    { symbol: 'GOLDBEES',  name: 'Gold / oz',        price: 63200, pChange: 0.18 },
  ];
  const display = indices.length > 0 ? indices : fallback;

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-bold text-[#dce5df]">Market Pulse</h3>
        <span className="flex items-center gap-1 text-[11px] font-mono text-[#44f593]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#44f593] animate-pulse" />
          LIVE
        </span>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-[#19211e] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {display.map((idx, i) => {
            const cp  = idx.pChange ?? idx.changePercent ?? 0;
            const pos = cp >= 0;
            return (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#161d1a]/50">
                <div>
                  <p className="text-[11px] font-mono text-[#859586] uppercase tracking-wide">{idx.symbol}</p>
                  <p className="text-xs font-semibold text-[#dce5df]">{idx.name}</p>
                </div>
                <div className="text-right">
                  {idx.price && <p className="text-xs font-mono font-bold text-[#dce5df]">{idx.price.toLocaleString('en-IN')}</p>}
                  <p className={`text-[11px] font-mono ${pos ? 'text-[#44f593]' : 'text-[#ffb4ab]'}`}>
                    {pos ? '+' : ''}{cp.toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Newsletter CTA ────────────────────────────────────────────
function NewsletterCTA() {
  const [email,      setEmail]      = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async () => {
    if (!email.includes('@')) return;
    try {
      await fetch('/api/notifications/preferences', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, type: 'newsletter' }),
      });
    } catch { /* best-effort */ }
    setSubscribed(true);
  };

  return (
    <section className="metallic-emerald rounded-2xl p-6 text-[#001f10] relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
      <div className="relative z-10">
        <h3 className="text-lg font-display font-black uppercase leading-none mb-1">Digital Pulse</h3>
        <p className="text-[#001f10]/75 text-xs mb-4 leading-relaxed">
          Institutional-grade signals daily. No noise, just alpha.
        </p>
        {subscribed ? (
          <div className="bg-[#001f10]/80 text-[#44f593] font-bold text-xs py-3 rounded-xl text-center">
            You&apos;re subscribed. Alpha incoming.
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-white/30 border border-[#001f10]/20 rounded-xl placeholder:text-[#001f10]/60 text-xs py-2.5 px-3 text-[#001f10] font-semibold focus:outline-none"
            />
            <button type="button" onClick={handleSubscribe}
              className="w-full bg-[#001f10] text-[#44f593] font-black uppercase text-xs tracking-widest py-3 rounded-xl hover:bg-[#001f10]/90 transition-all">
              Subscribe
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function NewsPage() {
  const [activeCategory, setActiveCategory] = useState('All Insights');
  const [news,    setNews]    = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1); // 1–5

  const fetchNews = useCallback(() => {
    setLoading(true);
    const category = activeCategory === 'All Insights' ? '' : activeCategory;
    const url      = `/api/news/aggregated${category ? `?category=${encodeURIComponent(category)}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const raw: any[] = data?.articles ?? data?.items ?? data ?? [];
        const items: NewsItem[] = Array.isArray(raw)
          ? raw.slice(0, TOTAL_ARTICLES).map(a => ({
              title:       a.title       ?? '',
              link:        a.link        ?? a.url ?? '',
              pubDate:     a.pubDate     ?? a.publishedAt,
              source:      a.source,
              category:    a.category,
              description: a.description,
              imageUrl:    a.imageUrl,
            }))
          : [];
        setNews(items);
        setPage(1);
      })
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  // Slice the 21 articles
  const heroArticle   = news[0];
  const pagedArticles = news.slice(1); // up to 20 articles across 5 pages
  const pageArticles  = pagedArticles.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE);
  const totalPages    = Math.max(1, Math.ceil(pagedArticles.length / ARTICLES_PER_PAGE));
  const clampedPages  = Math.min(totalPages, TOTAL_PAGES);

  // Sidebar trending: last 5 articles not currently on page
  const trendingItems = news.slice(Math.max(0, news.length - 6)).slice(0, 5);

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* ── Page Header ─────────────────────────────────────── */}
        <header className="mb-10">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-6">
            AlphaSense Insights
          </h1>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={[
                  'px-4 py-2 rounded-full text-sm font-semibold transition-all',
                  activeCategory === cat
                    ? 'bg-[#44f593]/15 text-[#44f593] border border-[#44f593]/25'
                    : 'bg-[#161d1a] text-[#859586] hover:bg-[#19211e] hover:text-[#dce5df] border border-transparent',
                ].join(' ')}>
                {cat}
              </button>
            ))}
          </div>
        </header>

        {/* ── 2-column layout ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Main — 8 cols */}
          <div className="lg:col-span-8 space-y-8">

            {/* Loading state */}
            {loading && (
              <>
                <div className="aspect-[21/8] rounded-3xl bg-[#161d1a] animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-[#161d1a] h-72 animate-pulse" />
                  ))}
                </div>
              </>
            )}

            {/* Hero article (fixed, always page 1) */}
            {!loading && heroArticle && (
              <HeroCard item={heroArticle} index={0} />
            )}

            {/* Page articles grid */}
            {!loading && pageArticles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {pageArticles.map((item, i) => (
                  <NewsCard
                    key={`${page}-${i}`}
                    item={item}
                    index={(page - 1) * ARTICLES_PER_PAGE + i + 1}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && news.length === 0 && (
              <div className="glass-card rounded-2xl p-12 text-center text-[#859586]">
                No articles available at the moment. Try a different category.
              </div>
            )}

            {/* Pagination */}
            {!loading && clampedPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                {/* Prev */}
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#3c4a3e] text-[#859586] hover:border-[#44f593]/40 hover:text-[#44f593] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label="Previous page"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Page dots */}
                {Array.from({ length: clampedPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-10 h-10 rounded-xl text-sm font-mono font-bold transition-all ${
                      n === page
                        ? 'bg-[#44f593]/15 border border-[#44f593]/40 text-[#44f593]'
                        : 'border border-[#3c4a3e] text-[#859586] hover:border-[#44f593]/30 hover:text-[#dce5df]'
                    }`}
                    aria-label={`Go to page ${n}`}
                    aria-current={n === page ? 'page' : undefined}
                  >
                    {n}
                  </button>
                ))}

                {/* Next */}
                <button
                  onClick={() => setPage(p => Math.min(clampedPages, p + 1))}
                  disabled={page === clampedPages}
                  className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#3c4a3e] text-[#859586] hover:border-[#44f593]/40 hover:text-[#44f593] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label="Next page"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Article count indicator */}
            {!loading && news.length > 0 && (
              <p className="text-center text-[11px] font-mono text-[#3c4a3e] uppercase tracking-widest">
                Showing {(page - 1) * ARTICLES_PER_PAGE + 1}–{Math.min(1 + page * ARTICLES_PER_PAGE, news.length)} of {news.length} articles · Newest first
              </p>
            )}
          </div>

          {/* Sidebar — 4 cols */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="sticky top-24 space-y-6">
              <MarketPulseWidget />

              {/* Trending */}
              {trendingItems.length > 0 && (
                <section className="glass-card rounded-2xl p-5">
                  <h3 className="text-sm font-display font-bold mb-4 flex items-center gap-2 text-[#dce5df]">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Trending
                  </h3>
                  <div className="space-y-4">
                    {trendingItems.map((item, i) => (
                      <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                        className="flex gap-3 group cursor-pointer">
                        <span className="text-xl font-display font-black text-[#3c4a3e] group-hover:text-[#44f593] transition-colors tabular-nums shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold group-hover:text-[#44f593] transition-colors text-[#dce5df] line-clamp-2 mb-1">
                            {item.title}
                          </h5>
                          <p className="text-[11px] font-mono text-[#859586] uppercase tracking-wide">
                            {item.source ?? 'NEWS'} · {timeAgo(item.pubDate)}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              <NewsletterCTA />
            </div>
          </aside>

        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <ComplianceDisclaimer variant="news" className="mt-8" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
