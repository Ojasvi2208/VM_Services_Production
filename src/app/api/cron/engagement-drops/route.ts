/**
 * Engagement & Content Drops Cron
 *
 * Multiplex cron that handles all scheduled content notifications:
 *   1. MORNING (08:30 AM IST): "Quote of the Day" — randomized financial wisdom
 *   2. MONTHLY (1st of month, 09:00 AM IST): "Monthly Champions" — top performing fund
 *   3. HOLIDAYS (Indian calendar): "Market closed for [Holiday]" — review prompt
 *
 * Schedule: 0 3 * * * (UTC 03:00 = IST 08:30 AM, runs daily, self-selects action)
 * Types: morning_quote (ENGAGEMENT), monthly_champions (MARKETING), holiday_reminder (MARKETING)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { dispatchBroadcast } from '@/lib/notification-governor';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}` || request.headers.get('x-vercel-cron') === '1';
}

function getISTDate(): { day: number; date: number; month: number; year: number; dateStr: string } {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return {
    day: ist.getDay(),
    date: ist.getDate(),
    month: ist.getMonth() + 1, // 1-12
    year: ist.getFullYear(),
    dateStr: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  };
}

// ─── Financial Wisdom Quotes ────────────────────────────────────────────────

const QUOTES = [
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "In investing, what is comfortable is rarely profitable.", author: "Robert Arnott" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Compound interest is the eighth wonder of the world.", author: "Albert Einstein" },
  { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The four most dangerous words in investing are: 'This time it's different.'", author: "Sir John Templeton" },
  { text: "Wide diversification is only required when investors do not understand what they are doing.", author: "Warren Buffett" },
  { text: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett" },
  { text: "The goal of a successful investor is to make best use of the money they have.", author: "Peter Lynch" },
  { text: "Price is what you pay. Value is what you get.", author: "Warren Buffett" },
  { text: "It's not how much money you make, but how much you keep.", author: "Robert Kiyosaki" },
  { text: "The individual investor should act consistently as an investor and not as a speculator.", author: "Ben Graham" },
  { text: "Investing should be more like watching paint dry or watching grass grow.", author: "Paul Samuelson" },
  { text: "The biggest risk of all is not taking one.", author: "Mellody Hobson" },
  { text: "Time in the market beats timing the market.", author: "Ken Fisher" },
  { text: "Markets can remain irrational longer than you can remain solvent.", author: "John Maynard Keynes" },
  { text: "Never invest in a business you cannot understand.", author: "Warren Buffett" },
  { text: "SIPs don't care about your emotions. That's why they work.", author: "Indian Market Wisdom" },
  { text: "The best investment you can make is in yourself.", author: "Warren Buffett" },
  { text: "Money is a terrible master but an excellent servant.", author: "P.T. Barnum" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { text: "Financial freedom is available to those who learn about it and work for it.", author: "Robert Kiyosaki" },
  { text: "Beware of little expenses; a small leak will sink a great ship.", author: "Benjamin Franklin" },
  { text: "Mutual funds give the small investor access to an investing powerhouse.", author: "John Bogle" },
  { text: "Never depend on a single income. Make investments to create a second source.", author: "Warren Buffett" },
  { text: "The secret to investing is to figure out the value of something and then pay a lot less.", author: "Joel Greenblatt" },
  { text: "Patience is not the ability to wait, but the ability to keep a good attitude while waiting.", author: "Joyce Meyer" },
  { text: "Buy when everyone else is selling and hold until everyone else is buying.", author: "J. Paul Getty" },
  { text: "A rupee saved is a rupee earned. A rupee invested is a rupee multiplied.", author: "Indian Market Wisdom" },
];

// ─── Indian National Holidays (2026) ────────────────────────────────────────

const INDIAN_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-26': 'Republic Day',
  '2026-03-10': 'Maha Shivaratri',
  '2026-03-17': 'Holi',
  '2026-03-31': 'Id-Ul-Fitr (Eid)',
  '2026-04-02': 'Ram Navami',
  '2026-04-06': 'Mahavir Jayanti',
  '2026-04-14': 'Dr. Ambedkar Jayanti',
  '2026-04-17': 'Good Friday',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-25': 'Buddha Purnima',
  '2026-06-07': 'Eid-Ul-Adha (Bakrid)',
  '2026-07-07': 'Muharram',
  '2026-08-15': 'Independence Day',
  '2026-08-17': 'Parsi New Year',
  '2026-09-05': 'Milad-Un-Nabi',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-09': 'Diwali',
  '2026-11-10': 'Diwali (Balipratipada)',
  '2026-11-30': 'Guru Nanak Jayanti',
  '2026-12-25': 'Christmas',
};

async function hasFiredToday(type: string): Promise<boolean> {
  const { dateStr } = getISTDate();
  const result = await pool.query(
    `SELECT 1 FROM notification_ledger WHERE type = $1 AND sent_at::date = $2::date LIMIT 1`,
    [type, dateStr]
  );
  return result.rows.length > 0;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date, month, dateStr } = getISTDate();
  const results: Record<string, any> = {};

  try {
    // ─── 1. Morning Quote (daily) ──────────────────────────────────────────

    if (!await hasFiredToday('morning_quote')) {
      const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      const quoteResult = await dispatchBroadcast({
        type: 'morning_quote',
        title: 'Thought for Today',
        body: `"${quote.text}" — ${quote.author}`,
        deepLink: 'home',
      });
      results.morningQuote = { sent: true, quote: quote.text, author: quote.author, broadcast: quoteResult };
    } else {
      results.morningQuote = { sent: false, reason: 'already_fired_today' };
    }

    // ─── 2. Monthly Champions (1st of each month) ──────────────────────────

    if (date === 1 && !await hasFiredToday('monthly_champions')) {
      // Find top performing equity fund in the last 30 days
      const topFund = await pool.query(`
        SELECT f.scheme_name, r.return_1m
        FROM fund_returns r
        JOIN funds f ON r.scheme_code = f.scheme_code
        WHERE f.category ILIKE '%Equity%'
          AND f.scheme_name ILIKE '%Direct%'
          AND f.scheme_name ILIKE '%Growth%'
          AND r.return_1m IS NOT NULL
        ORDER BY r.return_1m DESC
        LIMIT 1
      `);

      if (topFund.rows.length > 0) {
        const fund = topFund.rows[0];
        const returnPct = parseFloat(fund.return_1m).toFixed(2);
        // Trim scheme name for notification
        const shortName = fund.scheme_name
          .replace(/\s*-\s*Direct\s*(Plan\s*)?/i, '')
          .replace(/\s*-\s*Growth\s*/i, '')
          .replace(/\s*Fund\s*$/i, '')
          .trim();

        const champResult = await dispatchBroadcast({
          type: 'monthly_champions',
          title: 'Monthly Champions',
          body: `${shortName} was the #1 performing Equity fund this month (+${returnPct}%). See the top 5 performers.`,
          deepLink: 'funds',
        });
        results.monthlyChampions = { sent: true, fund: shortName, return1m: returnPct, broadcast: champResult };
      } else {
        results.monthlyChampions = { sent: false, reason: 'no_fund_data' };
      }
    } else {
      results.monthlyChampions = { sent: false, reason: date !== 1 ? 'not_first_of_month' : 'already_fired_today' };
    }

    // ─── 3. Holiday Reminder ───────────────────────────────────────────────

    const holidayName = INDIAN_HOLIDAYS_2026[dateStr];
    if (holidayName && !await hasFiredToday('holiday_reminder')) {
      const holidayResult = await dispatchBroadcast({
        type: 'holiday_reminder',
        title: `Market Closed: ${holidayName}`,
        body: `The stock market is closed today for ${holidayName}. A perfect day to review your long-term goals and SIPs.`,
        deepLink: 'goals',
      });
      results.holidayReminder = { sent: true, holiday: holidayName, broadcast: holidayResult };
    } else {
      results.holidayReminder = { sent: false, reason: holidayName ? 'already_fired_today' : 'not_a_holiday' };
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('engagement-drops cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
