import type { Metadata } from 'next';
import pool from '@/lib/postgres-db';
import FundDetailClient from './FundDetailClient';

type FundMeta = {
  schemeName?: string;
  planType?: string | null;
  optionType?: string | null;
  fundHouse?: string | null;
  category?: string | null;
  subCategory?: string | null;
  latestNav?: number | null;
};

async function fetchFundMeta(schemeCode: string): Promise<FundMeta | null> {
  try {
    const { rows } = await pool.query(
      `SELECT scheme_name, plan_type, option_type, fund_house, category, sub_category, latest_nav
         FROM funds WHERE scheme_code = $1 LIMIT 1`,
      [schemeCode],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      schemeName: r.scheme_name,
      planType: r.plan_type,
      optionType: r.option_type,
      fundHouse: r.fund_house,
      category: r.category,
      subCategory: r.sub_category,
      latestNav: r.latest_nav != null ? Number(r.latest_nav) : null,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ schemeCode: string }> },
): Promise<Metadata> {
  const { schemeCode } = await params;
  const meta = await fetchFundMeta(schemeCode);

  if (!meta) {
    return {
      title: 'Mutual Fund Details',
      description:
        'Detailed mutual fund analysis, NAV history, rolling returns, and risk metrics at Vijay Malik Financial Services (AMFI ARN-317605).',
    };
  }

  const name = meta.schemeName || 'Mutual Fund';
  const plan = meta.planType ? `${meta.planType} Plan` : '';
  const option = meta.optionType ? `${meta.optionType}` : '';
  const cat = meta.subCategory || meta.category || 'Mutual Fund';
  const house = meta.fundHouse ? ` by ${meta.fundHouse}` : '';
  const navBlurb = meta.latestNav != null ? `Latest NAV ₹${meta.latestNav.toFixed(4)}. ` : '';

  const title = `${name} — NAV, Returns, Risk Analysis`;
  const description =
    `${navBlurb}Research ${name} (${cat}${house}${plan ? ', ' + plan : ''}${option ? ', ' + option : ''}). ` +
    `View rolling 3Y/5Y returns, alpha, beta, Sharpe, drawdown, and portfolio holdings. AMFI ARN-317605.`;

  return {
    title,
    description: description.slice(0, 300),
    alternates: {
      canonical: `https://www.vmfinancialservices.com/funds/${schemeCode}`,
    },
    openGraph: {
      title,
      description: description.slice(0, 300),
      url: `https://www.vmfinancialservices.com/funds/${schemeCode}`,
      type: 'article',
    },
  };
}

export const revalidate = 86400;

export default function FundDetailRoute() {
  return <FundDetailClient />;
}
