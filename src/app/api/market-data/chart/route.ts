import { NextRequest, NextResponse } from 'next/server';

// Historical OHLCV + Technical Analysis for any index
// Fetches via CF relay → Yahoo Finance chart API
// Calculates DMAs, RSI, 52-week stats, and generates technical signals

const CF_RELAY_URL = process.env.CF_RELAY_URL || 'https://bse-nse-relay.vmfinancialservices.workers.dev';

// ─── Symbol map (same as parent route) ──────────────────────────────────────
const SYMBOL_MAP: Record<string, { yahoo: string; name: string; exchange: string }> = {
  'NIFTY':            { yahoo: '^NSEI',                 name: 'NIFTY 50',            exchange: 'NSE' },
  'BANKNIFTY':        { yahoo: '^NSEBANK',              name: 'BANK NIFTY',          exchange: 'NSE' },
  'NIFTYIT':          { yahoo: '^CNXIT',                name: 'NIFTY IT',            exchange: 'NSE' },
  'NIFTYNEXT50':      { yahoo: '^NSMIDCP',              name: 'NIFTY NEXT 50',       exchange: 'NSE' },
  'NIFTYMIDCAP150':   { yahoo: 'NIFTY_MIDCAP_150.NS',  name: 'NIFTY MIDCAP 150',    exchange: 'NSE' },
  'NIFTYSMALLCAP100': { yahoo: 'NIFTY_SMLCAP_100.NS',  name: 'NIFTY SMALLCAP 100',  exchange: 'NSE' },
  'NIFTYPHARMA':      { yahoo: '^CNXPHARMA',            name: 'NIFTY PHARMA',        exchange: 'NSE' },
  'NIFTYAUTO':        { yahoo: '^CNXAUTO',              name: 'NIFTY AUTO',          exchange: 'NSE' },
  'NIFTYFMCG':        { yahoo: '^CNXFMCG',              name: 'NIFTY FMCG',          exchange: 'NSE' },
  'NIFTYMETAL':       { yahoo: '^CNXMETAL',             name: 'NIFTY METAL',         exchange: 'NSE' },
  'NIFTYREALTY':      { yahoo: '^CNXREALTY',            name: 'NIFTY REALTY',        exchange: 'NSE' },
  'NIFTYENERGY':      { yahoo: '^CNXENERGY',            name: 'NIFTY ENERGY',        exchange: 'NSE' },
  'NIFTYINFRA':       { yahoo: '^CNXINFRA',             name: 'NIFTY INFRA',         exchange: 'NSE' },
  'NIFTYPSE':         { yahoo: '^CNXPSE',               name: 'NIFTY PSE',           exchange: 'NSE' },
  'NIFTYFINSERVICE':  { yahoo: 'NIFTY_FIN_SERVICE.NS',  name: 'NIFTY FIN SERVICE',   exchange: 'NSE' },
  'NIFTYPVTBANK':     { yahoo: 'NIFTY_PVT_BANK.NS',    name: 'NIFTY PVT BANK',      exchange: 'NSE' },
  'SENSEX':           { yahoo: '^BSESN',                name: 'SENSEX',              exchange: 'BSE' },
  'BSE500':           { yahoo: 'BSE-500.BO',            name: 'BSE 500',             exchange: 'BSE' },
  'BSEMIDCAP':        { yahoo: 'BSE-MIDCAP.BO',        name: 'BSE MIDCAP',          exchange: 'BSE' },
  'BSESMALLCAP':      { yahoo: 'BSE-SMLCAP.BO',        name: 'BSE SMALLCAP',        exchange: 'BSE' },
  'BSEFMCG':          { yahoo: 'BSE-FMCG.BO',          name: 'BSE FMCG',            exchange: 'BSE' },
  'BSEIT':            { yahoo: 'BSE-IT.BO',             name: 'BSE IT',              exchange: 'BSE' },
  'BSEHEALTHCARE':    { yahoo: 'BSE-HC.BO',             name: 'BSE HEALTHCARE',      exchange: 'BSE' },
  'BSEAUTO':          { yahoo: 'BSE-AUTO.BO',           name: 'BSE AUTO',            exchange: 'BSE' },
  'BSEMETAL':         { yahoo: 'BSE-METAL.BO',          name: 'BSE METAL',           exchange: 'BSE' },
  'BSEOILGAS':        { yahoo: 'BSE-OILGAS.BO',         name: 'BSE OIL & GAS',       exchange: 'BSE' },
  'BSEREALTY':        { yahoo: 'BSE-REALTY.BO',         name: 'BSE REALTY',          exchange: 'BSE' },
  'BSECG':            { yahoo: 'BSE-CG.BO',             name: 'BSE CAPITAL GOODS',   exchange: 'BSE' },
  'BSEPOWER':         { yahoo: 'BSE-POWER.BO',          name: 'BSE POWER',           exchange: 'BSE' },
};

// ─── Range → Yahoo Finance params mapping ───────────────────────────────────
const RANGE_CONFIG: Record<string, { range: string; interval: string }> = {
  '1D':  { range: '1d',  interval: '5m'  },
  '1W':  { range: '5d',  interval: '15m' },
  '1M':  { range: '1mo', interval: '1d'  },
  '3M':  { range: '3mo', interval: '1d'  },
  '6M':  { range: '6mo', interval: '1d'  },
  '1Y':  { range: '1y',  interval: '1d'  },
};

// ─── Cache: keyed by "symbol:range", 15 min TTL ────────────────────────────
const chartCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

// ─── Technical helpers ──────────────────────────────────────────────────────

function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / period;
      result.push(Number(avg.toFixed(2)));
    }
  }
  return result;
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(Number(sma.toFixed(2)));
    } else {
      const prev = result[i - 1]!;
      const ema = (closes[i] - prev) * multiplier + prev;
      result.push(Number(ema.toFixed(2)));
    }
  }
  return result;
}

function calcRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period; i++) result.push(null);

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(Number((100 - 100 / (1 + rs)).toFixed(2)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push(Number(rsi.toFixed(2)));
  }
  return result;
}

function calcMACD(closes: number[]): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine.push(Number((ema12[i]! - ema26[i]!).toFixed(2)));
    } else {
      macdLine.push(null);
    }
  }

  // Signal line = 9-period EMA of MACD
  const validMacd = macdLine.filter(v => v !== null) as number[];
  const signalEma = calcEMA(validMacd, 9);

  // Map signal back
  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let validIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      const sig = signalEma[validIdx] ?? null;
      signal.push(sig);
      histogram.push(sig !== null ? Number((macdLine[i]! - sig).toFixed(2)) : null);
      validIdx++;
    } else {
      signal.push(null);
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal, histogram };
}

interface TechnicalSignal {
  indicator: string;
  signal: 'Bullish' | 'Bearish' | 'Neutral';
  detail: string;
}

function generateSignals(
  closes: number[],
  dma50: (number | null)[],
  dma100: (number | null)[],
  dma200: (number | null)[],
  rsi: (number | null)[],
  macd: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] },
): TechnicalSignal[] {
  const signals: TechnicalSignal[] = [];
  const lastClose = closes[closes.length - 1];
  const last50 = dma50[dma50.length - 1];
  const last100 = dma100[dma100.length - 1];
  const last200 = dma200[dma200.length - 1];
  const lastRSI = rsi[rsi.length - 1];
  const lastMACD = macd.macd[macd.macd.length - 1];
  const lastSignal = macd.signal[macd.signal.length - 1];
  const lastHist = macd.histogram[macd.histogram.length - 1];
  const prevHist = macd.histogram[macd.histogram.length - 2];

  // Price vs 50 DMA
  if (last50 !== null) {
    const pctFrom50 = ((lastClose - last50) / last50) * 100;
    if (lastClose > last50) {
      signals.push({ indicator: '50 DMA', signal: 'Bullish', detail: `Trading ${pctFrom50.toFixed(1)}% above 50 DMA (${last50.toLocaleString()})` });
    } else {
      signals.push({ indicator: '50 DMA', signal: 'Bearish', detail: `Trading ${Math.abs(pctFrom50).toFixed(1)}% below 50 DMA (${last50.toLocaleString()})` });
    }
  }

  // Price vs 200 DMA
  if (last200 !== null) {
    const pctFrom200 = ((lastClose - last200) / last200) * 100;
    if (lastClose > last200) {
      signals.push({ indicator: '200 DMA', signal: 'Bullish', detail: `Trading ${pctFrom200.toFixed(1)}% above 200 DMA (${last200.toLocaleString()}) — long-term uptrend` });
    } else {
      signals.push({ indicator: '200 DMA', signal: 'Bearish', detail: `Trading ${Math.abs(pctFrom200).toFixed(1)}% below 200 DMA (${last200.toLocaleString()}) — long-term downtrend` });
    }
  }

  // Golden Cross / Death Cross (50 vs 200)
  if (last50 !== null && last200 !== null) {
    const prev50 = dma50[dma50.length - 5]; // check 5 days ago
    const prev200 = dma200[dma200.length - 5];
    if (prev50 !== null && prev200 !== null) {
      if (last50 > last200 && prev50 <= prev200) {
        signals.push({ indicator: 'Golden Cross', signal: 'Bullish', detail: '50 DMA crossed above 200 DMA — strong bullish signal' });
      } else if (last50 < last200 && prev50 >= prev200) {
        signals.push({ indicator: 'Death Cross', signal: 'Bearish', detail: '50 DMA crossed below 200 DMA — strong bearish signal' });
      } else if (last50 > last200) {
        signals.push({ indicator: 'DMA Alignment', signal: 'Bullish', detail: '50 DMA above 200 DMA — bullish alignment' });
      } else {
        signals.push({ indicator: 'DMA Alignment', signal: 'Bearish', detail: '50 DMA below 200 DMA — bearish alignment' });
      }
    }
  }

  // RSI
  if (lastRSI !== null) {
    if (lastRSI > 70) {
      signals.push({ indicator: 'RSI (14)', signal: 'Bearish', detail: `RSI at ${lastRSI} — overbought territory (>70), may see pullback` });
    } else if (lastRSI < 30) {
      signals.push({ indicator: 'RSI (14)', signal: 'Bullish', detail: `RSI at ${lastRSI} — oversold territory (<30), may see bounce` });
    } else if (lastRSI > 55) {
      signals.push({ indicator: 'RSI (14)', signal: 'Bullish', detail: `RSI at ${lastRSI} — moderate bullish momentum` });
    } else if (lastRSI < 45) {
      signals.push({ indicator: 'RSI (14)', signal: 'Bearish', detail: `RSI at ${lastRSI} — moderate bearish momentum` });
    } else {
      signals.push({ indicator: 'RSI (14)', signal: 'Neutral', detail: `RSI at ${lastRSI} — neutral zone` });
    }
  }

  // MACD
  if (lastMACD !== null && lastSignal !== null) {
    if (lastMACD > lastSignal && (prevHist !== null && lastHist !== null && lastHist > prevHist)) {
      signals.push({ indicator: 'MACD', signal: 'Bullish', detail: 'MACD above signal line with increasing momentum' });
    } else if (lastMACD > lastSignal) {
      signals.push({ indicator: 'MACD', signal: 'Bullish', detail: 'MACD above signal line' });
    } else if (lastMACD < lastSignal && (prevHist !== null && lastHist !== null && lastHist < prevHist)) {
      signals.push({ indicator: 'MACD', signal: 'Bearish', detail: 'MACD below signal line with increasing selling pressure' });
    } else {
      signals.push({ indicator: 'MACD', signal: 'Bearish', detail: 'MACD below signal line' });
    }
  }

  // Trend strength: count of last 5 closes above/below 50 DMA
  const recent5 = closes.slice(-5);
  const recent50 = dma50.slice(-5);
  let above = 0;
  for (let i = 0; i < 5; i++) {
    if (recent50[i] !== null && recent5[i] > recent50[i]!) above++;
  }
  if (above >= 4) {
    signals.push({ indicator: 'Trend', signal: 'Bullish', detail: `Price consistently above 50 DMA (${above}/5 days) — strong uptrend` });
  } else if (above <= 1) {
    signals.push({ indicator: 'Trend', signal: 'Bearish', detail: `Price consistently below 50 DMA (${5 - above}/5 days) — strong downtrend` });
  } else {
    signals.push({ indicator: 'Trend', signal: 'Neutral', detail: 'Price oscillating around 50 DMA — sideways/consolidation' });
  }

  return signals;
}

function getOverallOutlook(signals: TechnicalSignal[]): { outlook: string; strength: number; summary: string } {
  let bullish = 0, bearish = 0;
  for (const s of signals) {
    if (s.signal === 'Bullish') bullish++;
    else if (s.signal === 'Bearish') bearish++;
  }
  const total = signals.length;
  const strength = total > 0 ? Math.round(Math.abs(bullish - bearish) / total * 100) : 0;

  let outlook: string;
  let summary: string;
  if (bullish > bearish + 1) {
    outlook = 'Bullish';
    summary = `${bullish} of ${total} indicators are bullish. The index shows positive momentum with favorable technical setup.`;
  } else if (bearish > bullish + 1) {
    outlook = 'Bearish';
    summary = `${bearish} of ${total} indicators are bearish. The index is under selling pressure with weak technical setup.`;
  } else if (bullish > bearish) {
    outlook = 'Mildly Bullish';
    summary = `${bullish} of ${total} indicators lean bullish. Cautiously optimistic outlook, watch key support levels.`;
  } else if (bearish > bullish) {
    outlook = 'Mildly Bearish';
    summary = `${bearish} of ${total} indicators lean bearish. Exercise caution, watch for reversal signals.`;
  } else {
    outlook = 'Neutral';
    summary = `Indicators are evenly split. The index is in a consolidation phase, wait for a clear breakout direction.`;
  }

  return { outlook, strength, summary };
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'NIFTY';
    const range = searchParams.get('range')?.toUpperCase() || '1Y';

    const mapping = SYMBOL_MAP[symbol];
    if (!mapping) {
      return NextResponse.json({ success: false, error: `Unknown symbol: ${symbol}` }, { status: 400 });
    }

    const rangeConfig = RANGE_CONFIG[range] || RANGE_CONFIG['1Y'];
    const cacheKey = `${symbol}:${range}`;

    // Serve from cache
    const cached = chartCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, source: 'cache' });
    }

    // Fetch chart data for requested range
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapping.yahoo)}?range=${rangeConfig.range}&interval=${rangeConfig.interval}`;
    const proxyUrl = `${CF_RELAY_URL}/?url=${encodeURIComponent(chartUrl)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch chart data' }, { status: 502 });
    }

    const rawData = await response.json();
    const result = rawData?.chart?.result?.[0];
    if (!result || !result.timestamp) {
      return NextResponse.json({ success: false, error: 'No chart data available' }, { status: 404 });
    }

    const meta = result.meta;
    const timestamps = result.timestamp as number[];
    const quote = result.indicators.quote[0];

    // Build OHLCV candles (filter out null entries)
    const candles: { timestamp: number; date: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.close[i] == null || quote.open[i] == null) continue;
      candles.push({
        timestamp: timestamps[i],
        date: new Date(timestamps[i] * 1000).toISOString(),
        open: Number(quote.open[i].toFixed(2)),
        high: Number(quote.high[i].toFixed(2)),
        low: Number(quote.low[i].toFixed(2)),
        close: Number(quote.close[i].toFixed(2)),
        volume: quote.volume[i] || 0,
      });
    }

    // For technical indicators, we need daily data.
    // If range is not daily interval, also fetch 1Y daily for DMAs
    let dailyCloses: number[];
    let dailyCandles = candles;

    if (rangeConfig.interval !== '1d') {
      // Fetch 1Y daily separately for technical calculations
      const dailyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapping.yahoo)}?range=1y&interval=1d`;
      const dailyProxy = `${CF_RELAY_URL}/?url=${encodeURIComponent(dailyUrl)}`;
      try {
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 15000);
        const dailyRes = await fetch(dailyProxy, { signal: ctrl2.signal, cache: 'no-store' });
        clearTimeout(t2);
        const dailyRaw = await dailyRes.json();
        const dailyResult = dailyRaw?.chart?.result?.[0];
        if (dailyResult?.timestamp) {
          const dq = dailyResult.indicators.quote[0];
          dailyCandles = [];
          for (let i = 0; i < dailyResult.timestamp.length; i++) {
            if (dq.close[i] != null) {
              dailyCandles.push({
                timestamp: dailyResult.timestamp[i],
                date: new Date(dailyResult.timestamp[i] * 1000).toISOString(),
                open: Number((dq.open[i] || 0).toFixed(2)),
                high: Number((dq.high[i] || 0).toFixed(2)),
                low: Number((dq.low[i] || 0).toFixed(2)),
                close: Number(dq.close[i].toFixed(2)),
                volume: dq.volume[i] || 0,
              });
            }
          }
        }
      } catch {
        // Fall back to using chart data for technicals
      }
    }

    dailyCloses = dailyCandles.map(c => c.close);

    // ─── Calculate technical indicators ──────────────────────────────────
    const dma50 = calcSMA(dailyCloses, 50);
    const dma100 = calcSMA(dailyCloses, 100);
    const dma200 = calcSMA(dailyCloses, 200);
    const rsi = calcRSI(dailyCloses, 14);
    const macd = calcMACD(dailyCloses);

    // 52-week stats from meta + calculated from data
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || Math.max(...dailyCandles.map(c => c.high));
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || Math.min(...dailyCandles.map(c => c.low));
    const currentPrice = meta.regularMarketPrice || dailyCloses[dailyCloses.length - 1];
    // Use meta.previousClose if available; otherwise derive from second-to-last daily candle
    const previousClose = meta.previousClose
      || (dailyCandles.length >= 2 ? dailyCandles[dailyCandles.length - 2].close : meta.chartPreviousClose)
      || 0;
    const dayChange = currentPrice - previousClose;
    const dayChangePercent = previousClose ? (dayChange / previousClose) * 100 : 0;

    // Where in 52-week range
    const rangePosition = fiftyTwoWeekHigh !== fiftyTwoWeekLow
      ? ((currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100
      : 50;

    // Generate technical signals
    const signals = generateSignals(dailyCloses, dma50, dma100, dma200, rsi, macd);
    const outlook = getOverallOutlook(signals);

    // Latest DMA values
    const latestDMA = {
      dma50: dma50[dma50.length - 1],
      dma100: dma100[dma100.length - 1],
      dma200: dma200[dma200.length - 1],
    };

    const latestRSI = rsi[rsi.length - 1];
    const latestMACD = {
      macd: macd.macd[macd.macd.length - 1],
      signal: macd.signal[macd.signal.length - 1],
      histogram: macd.histogram[macd.histogram.length - 1],
    };

    // Build DMA overlay arrays (only for daily candles, last N points matching chart)
    const dmaOverlay = rangeConfig.interval === '1d' ? {
      dma50: dma50.slice(-candles.length),
      dma100: dma100.slice(-candles.length),
      dma200: dma200.slice(-candles.length),
    } : null;

    const responseData = {
      success: true,
      symbol,
      name: mapping.name,
      exchange: mapping.exchange,
      currentPrice: Number(currentPrice.toFixed(2)),
      previousClose: Number(previousClose.toFixed(2)),
      dayChange: Number(dayChange.toFixed(2)),
      dayChangePercent: Number(dayChangePercent.toFixed(2)),
      fiftyTwoWeekHigh: Number(fiftyTwoWeekHigh.toFixed(2)),
      fiftyTwoWeekLow: Number(fiftyTwoWeekLow.toFixed(2)),
      fiftyTwoWeekRangePosition: Number(rangePosition.toFixed(1)),
      isMarketOpen: meta.marketState === 'REGULAR',
      range,
      interval: rangeConfig.interval,
      candles,
      technicals: {
        dma: latestDMA,
        rsi: latestRSI,
        macd: latestMACD,
        dmaOverlay,
      },
      signals,
      outlook,
      timestamp: new Date().toISOString(),
    };

    // Cache the response
    chartCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    // Cleanup old cache entries
    if (chartCache.size > 100) {
      const now = Date.now();
      for (const [key, val] of chartCache.entries()) {
        if (now - val.timestamp > CACHE_TTL * 2) chartCache.delete(key);
      }
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Chart API error:', error?.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
