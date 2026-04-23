import { MetadataRoute } from 'next';
import { getAllSlugs as getBlogSlugs } from './blog/[slug]/blog-posts';

const BASE_URL = 'https://www.vmfinancialservices.com';

// All 33 index symbols from market-data route
const INDEX_SYMBOLS = [
  'NIFTY', 'SENSEX', 'BANKNIFTY', 'NIFTYIT', 'NIFTYNEXT50',
  'NIFTYMIDCAP150', 'NIFTYSMALLCAP100', 'NIFTYPHARMA', 'NIFTYAUTO',
  'NIFTYFMCG', 'NIFTYMETAL', 'NIFTYREALTY', 'NIFTYENERGY', 'NIFTYINFRA',
  'NIFTYPSE', 'NIFTYFINSERVICE', 'NIFTYPVTBANK',
  'BSE500', 'BSEMIDCAP', 'BSESMALLCAP',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // ── Static pages ───────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,                  lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/author/ojasvi-malik`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/markets`,           lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${BASE_URL}/funds/search`,      lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/news`,              lastModified: now, changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${BASE_URL}/calculators/sip`,   lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/premium`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/about`,             lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/careers`,           lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`,           lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/products`,          lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/partners`,          lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/disclosures`,       lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/verify-arn`,        lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/compare`,           lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE_URL}/screener`,          lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE_URL}/blog`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE_URL}/learn`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/calculators`,        lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/calculators/swp`,    lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/calculators/stp`,    lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
  ];

  // ── Learn article pages ────────────────────────────────────
  const LEARN_SLUGS = [
    'best-elss-tax-saving-funds',
    'swp-calculator-guide',
    'direct-vs-regular-mutual-funds',
    'ltcg-tax-on-mutual-funds',
    'what-is-stp-in-mutual-funds',
    'best-mutual-funds-to-invest',
    'sip-calculator-guide',
    'best-large-cap-funds',
    'best-mid-cap-funds',
    'best-small-cap-funds',
    'why-start-investing-early',
    'best-index-funds-india',
    'mutual-fund-vs-fixed-deposit',
    'best-sip-plans-5000-per-month',
    'how-elections-impact-indian-markets',
    // Batch 2 — high-volume trending (April 2026)
    'new-tax-regime-vs-old-tax-regime',
    'how-to-invest-in-mutual-funds-beginners',
    'nps-vs-ppf-which-is-better',
    'gold-etf-vs-sovereign-gold-bond',
    'best-flexi-cap-funds-india',
    'step-up-sip-calculator-benefits',
    'best-debt-mutual-funds-india',
    'what-is-expense-ratio-mutual-fund',
    'best-hybrid-mutual-funds-india',
    'how-to-read-mutual-fund-factsheet',
    'nifty-50-vs-nifty-next-50-vs-nifty-500',
    // Batch 3 — top-ranked Indian search queries (April 2026)
    'how-to-buy-mutual-funds-online',
    'mutual-fund-vs-stock-market',
    'how-much-to-invest-for-1-crore',
  ];
  const learnPages: MetadataRoute.Sitemap = LEARN_SLUGS.map(slug => ({
    url: `${BASE_URL}/learn/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }));

  // ── Index detail pages ─────────────────────────────────────
  const indexPages: MetadataRoute.Sitemap = INDEX_SYMBOLS.map(symbol => ({
    url: `${BASE_URL}/markets/${symbol}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  // ── Blog pages ─────────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = getBlogSlugs().map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // ── Top fund detail pages (fetch top 500 from DB) ──────────
  // 2026-04 — exclude matured FMPs + stale NAV funds. Matured closed-ended
  // schemes in the sitemap = indexed thin pages = AdSense killer (they render
  // "NAV has not updated in 2+ years" which reads as dead content).
  let fundPages: MetadataRoute.Sitemap = [];
  try {
    const pool = (await import('@/lib/postgres-db')).default;
    const result = await pool.query(
      `SELECT scheme_code FROM funds
       WHERE is_active = true
         AND plan_type = 'Direct'
         AND scheme_name !~* '(FMP|Fixed Maturity|\\y[0-9]{3,4}D\\y)'
         AND latest_nav_date >= CURRENT_DATE - INTERVAL '6 months'
       ORDER BY latest_nav_date DESC NULLS LAST
       LIMIT 500`
    );
    fundPages = result.rows.map((row: any) => ({
      url: `${BASE_URL}/funds/${row.scheme_code}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));
  } catch {
    // DB unavailable during build — skip dynamic fund pages
  }

  return [...staticPages, ...learnPages, ...blogPages, ...indexPages, ...fundPages];
}
