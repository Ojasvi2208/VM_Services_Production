import type { Metadata } from 'next';
import IndexDetailClient from './IndexDetailClient';

const INDEX_NAMES: Record<string, string> = {
  NIFTY: 'Nifty 50',
  SENSEX: 'BSE Sensex',
  BANKNIFTY: 'Nifty Bank',
  NIFTYIT: 'Nifty IT',
  NIFTYAUTO: 'Nifty Auto',
  NIFTYPHARMA: 'Nifty Pharma',
  NIFTYFMCG: 'Nifty FMCG',
  NIFTYMETAL: 'Nifty Metal',
  NIFTYREALTY: 'Nifty Realty',
  NIFTYMIDCAP100: 'Nifty Midcap 100',
  NIFTYSMLCAP100: 'Nifty Smallcap 100',
  NIFTYNEXT50: 'Nifty Next 50',
  NIFTY100: 'Nifty 100',
  NIFTY200: 'Nifty 200',
  NIFTY500: 'Nifty 500',
  BANKEX: 'BSE Bankex',
  BSE500: 'BSE 500',
  BSEMIDCAP: 'BSE Midcap',
  BSESMLCAP: 'BSE Smallcap',
  INDIAVIX: 'India VIX',
};

function displayName(symbol: string): string {
  const key = symbol.toUpperCase();
  return INDEX_NAMES[key] || symbol;
}

export async function generateMetadata(
  { params }: { params: Promise<{ symbol: string }> },
): Promise<Metadata> {
  const { symbol } = await params;
  const name = displayName(symbol);
  const title = `${name} Live Chart, Levels & Technical Analysis`;
  const description =
    `Live ${name} index price, daily change, 52-week high/low, RSI, MACD, DMA support-resistance levels, ` +
    `FII/DII activity, and market breadth. Updated during NSE market hours. AMFI ARN-317605.`;

  return {
    title,
    description: description.slice(0, 300),
    alternates: {
      canonical: `https://www.vmfinancialservices.com/markets/${symbol}`,
    },
    openGraph: {
      title,
      description: description.slice(0, 300),
      url: `https://www.vmfinancialservices.com/markets/${symbol}`,
      type: 'article',
    },
  };
}

export const revalidate = 600;

export default function IndexDetailRoute() {
  return <IndexDetailClient />;
}
