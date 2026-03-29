import { MetadataRoute } from 'next';

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

  // ── Top fund detail pages (fetch top 500 from DB) ──────────
  let fundPages: MetadataRoute.Sitemap = [];
  try {
    const pool = (await import('@/lib/postgres-db')).default;
    const result = await pool.query(
      `SELECT scheme_code FROM funds
       WHERE is_active = true AND plan_type = 'Direct'
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

  return [...staticPages, ...learnPages, ...indexPages, ...fundPages];
}
