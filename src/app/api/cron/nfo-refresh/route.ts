/**
 * NFO Intelligence Cron
 * GET /api/cron/nfo-refresh
 *
 * Called daily at ~5:05 AM IST via GitHub Actions (after NAV update).
 * 1. Fetches NAVAll.txt — detects funds with NAV near ₹10 (recently launched)
 * 2. Fetches AMFI Scheme CSV — enriches with Launch Date, Min Investment, Category
 * 3. Cross-references to build enriched NFO list
 * 4. Populates nfo-cache module singleton + /tmp file backup
 * 5. Checks for NFOs closing tomorrow → sends FCM push
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { sendPushNotificationBatch, isFirebaseConfigured } from '@/lib/firebase-admin';
import { setNFOCache, type NFOCacheItem, type NFOCacheData } from '@/lib/nfo-cache';

const AMFI_NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const AMFI_CSV_URL = 'https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0';

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

// Convert "24-Feb-1995" → "1995-02-24"
function convertAmfiDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;
  const [day, monthStr, year] = parts;
  const month = MONTH_MAP[monthStr];
  if (!month || !year || !day) return null;
  return `${year}-${month}-${day.padStart(2, '0')}`;
}

function categorizeScheme(name: string): { category: string; subCategory: string; riskLevel: string } {
  const n = name.toLowerCase();
  if (n.includes('overnight')) return { category: 'Debt', subCategory: 'Overnight', riskLevel: 'Low' };
  if (n.includes('liquid')) return { category: 'Debt', subCategory: 'Liquid', riskLevel: 'Low' };
  if (n.includes('money market')) return { category: 'Debt', subCategory: 'Money Market', riskLevel: 'Low' };
  if (n.includes('gilt') || n.includes('bond') || n.includes('duration') || n.includes('income') || n.includes('floating') || n.includes('credit risk') || n.includes('banking')) return { category: 'Debt', subCategory: 'Debt', riskLevel: 'Moderate' };
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('dynamic asset') || n.includes('arbitrage') || n.includes('equity savings') || n.includes('multi asset')) return { category: 'Hybrid', subCategory: 'Hybrid', riskLevel: 'Moderately High' };
  if (n.includes('small cap') || n.includes('micro cap')) return { category: 'Equity', subCategory: 'Small Cap', riskLevel: 'Very High' };
  if (n.includes('mid cap')) return { category: 'Equity', subCategory: 'Mid Cap', riskLevel: 'Very High' };
  if (n.includes('large cap') || n.includes('large & mid')) return { category: 'Equity', subCategory: 'Large Cap', riskLevel: 'High' };
  if (n.includes('flexi cap') || n.includes('multi cap')) return { category: 'Equity', subCategory: 'Flexi Cap', riskLevel: 'Very High' };
  if (n.includes('index') || n.includes('etf') || n.includes('nifty') || n.includes('sensex')) return { category: 'Equity', subCategory: 'Index/ETF', riskLevel: 'High' };
  if (n.includes('sectoral') || n.includes('thematic') || n.includes('dividend yield') || n.includes('value') || n.includes('contra') || n.includes('focused') || n.includes('elss')) return { category: 'Equity', subCategory: 'Thematic', riskLevel: 'Very High' };
  return { category: 'Equity', subCategory: 'Equity', riskLevel: 'High' };
}

function cleanSchemeName(name: string): string {
  return name
    .replace(/\s*-\s*Direct\s*(Plan)?\s*/i, ' ')
    .replace(/\s*-\s*Growth\s*(Option)?\s*/i, '')
    .replace(/\s*Direct\s*-?\s*Growth\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Parse AMFI Scheme CSV ──
interface SchemeCSVEntry {
  code: string;
  amc: string;
  schemeName: string;
  schemeType: string;
  schemeCategory: string;
  minInvestment: number;
  launchDate: string;        // YYYY-MM-DD
  closureDate: string | null;
}

async function fetchSchemeCSV(): Promise<Map<string, SchemeCSVEntry>> {
  const map = new Map<string, SchemeCSVEntry>();
  try {
    const resp = await fetch(AMFI_CSV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VMFinancial/1.0)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return map;

    const text = await resp.text();
    const lines = text.split('\n');
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // AMFI CSV uses semicolons as delimiter
      const parts = line.split(';');
      if (parts.length < 9) continue;

      const code = parts[1]?.trim();
      const navName = parts[5]?.trim() || '';
      const launchDateStr = parts[7]?.trim() || '';

      if (!code || !launchDateStr) continue;

      // Only Direct + Growth (same dedup as NAV parser)
      if (!navName.includes('Direct')) continue;
      const navNameLower = navName.toLowerCase();
      if (!navNameLower.includes('growth')) continue;
      if (navNameLower.includes('idcw') || navNameLower.includes('dividend')) continue;

      const launchDate = convertAmfiDate(launchDateStr);
      if (!launchDate) continue;

      // Only schemes launched in last 90 days
      if (new Date(launchDate) < ninetyDaysAgo) continue;

      const closureDateStr = parts[8]?.trim() || '';
      const closureDate = closureDateStr ? convertAmfiDate(closureDateStr) : null;

      // Parse min investment (could be "5000" or "Rs. 5000" or "Rs. 1000/ and any amount")
      const minStr = parts[6]?.trim() || '500';
      const minMatch = minStr.match(/(\d+)/);
      const minInvestment = minMatch ? parseInt(minMatch[1]) : 500;

      map.set(code, {
        code,
        amc: parts[0]?.trim() || '',
        schemeName: parts[2]?.trim() || '',
        schemeType: parts[3]?.trim() || '',
        schemeCategory: parts[4]?.trim() || '',
        minInvestment,
        launchDate,
        closureDate,
      });
    }
  } catch (e) {
    console.error('NFO cron: Scheme CSV fetch failed:', e);
  }
  return map;
}

// ── Parse AMFI NAV data ──
interface NAVDetectedFund {
  schemeCode: string;
  schemeName: string;
  amcName: string;
  nav: number;
  navDate: string;  // YYYY-MM-DD
}

async function fetchNAVDetectedFunds(): Promise<NAVDetectedFund[]> {
  const funds: NAVDetectedFund[] = [];
  try {
    const resp = await fetch(AMFI_NAV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VMFinancial/1.0)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return funds;

    const text = await resp.text();
    const lines = text.split('\n');
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let currentAMC = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!trimmed.includes(';') && (trimmed.endsWith('Mutual Fund') || trimmed.endsWith('Mutual Fund '))) {
        currentAMC = trimmed.trim();
        continue;
      }

      const parts = trimmed.split(';');
      if (parts.length < 6) continue;

      const schemeCode = parts[0]?.trim();
      const schemeName = parts[3]?.trim() || '';
      const navStr = parts[4]?.trim() || '0';
      const navDateStr = parts[5]?.trim() || '';

      if (!schemeName || !navDateStr || !schemeCode) continue;

      const nav = parseFloat(navStr);
      if (isNaN(nav) || nav < 9.0 || nav > 11.5) continue;

      if (!schemeName.includes('Direct')) continue;
      const nameLower = schemeName.toLowerCase();
      if (!nameLower.includes('growth')) continue;
      if (nameLower.includes('idcw') || nameLower.includes('dividend')) continue;

      const navDate = new Date(navDateStr);
      if (isNaN(navDate.getTime())) continue;
      if (navDate < ninetyDaysAgo) continue;

      funds.push({
        schemeCode,
        schemeName,
        amcName: currentAMC || 'Mutual Fund',
        nav,
        navDate: navDate.toISOString().split('T')[0],
      });
    }
  } catch (e) {
    console.error('NFO cron: NAV fetch failed:', e);
  }
  return funds;
}

// ── Cross-reference and build enriched NFO list ──
function buildEnrichedNFOs(
  navFunds: NAVDetectedFund[],
  csvMap: Map<string, SchemeCSVEntry>
): NFOCacheItem[] {
  const seen = new Set<string>();
  const nfos: NFOCacheItem[] = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1. NAV-detected funds enriched with CSV metadata
  for (const fund of navFunds) {
    if (seen.has(fund.schemeCode)) continue;
    seen.add(fund.schemeCode);

    const csv = csvMap.get(fund.schemeCode);
    const { category, subCategory, riskLevel } = csv
      ? categorizeFromCSV(csv.schemeCategory)
      : categorizeScheme(fund.schemeName);

    const launchDate = csv?.launchDate || fund.navDate;
    const closeDate = csv?.closureDate || fund.navDate;
    const daysLeft = closeDate > todayStr
      ? Math.ceil((new Date(closeDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      : undefined;

    nfos.push({
      id: fund.schemeCode,
      schemeName: cleanSchemeName(fund.schemeName),
      amcName: csv?.amc || fund.amcName,
      category,
      subCategory,
      fundType: csv?.schemeType?.includes('Close') ? 'Close-ended' : 'Open-ended',
      openDate: csv?.launchDate || new Date(new Date(fund.navDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      closeDate,
      minInvestment: csv?.minInvestment || 500,
      riskLevel,
      investmentObjective: `Recently launched ${category.toLowerCase()} fund — ${subCategory}`,
      status: 'open',
      isNew: true,
      isTrending: false,
      nav: fund.nav,
      launchDate,
      daysLeft,
      schemeType: csv?.schemeType,
      schemeCategory: csv?.schemeCategory,
    });
  }

  // 2. CSV-only schemes (no NAV yet → potentially still in subscription window)
  for (const [code, csv] of csvMap) {
    if (seen.has(code)) continue;
    seen.add(code);

    const { category, subCategory, riskLevel } = categorizeFromCSV(csv.schemeCategory);
    const closeDate = csv.closureDate || csv.launchDate;
    const daysLeft = closeDate > todayStr
      ? Math.ceil((new Date(closeDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      : undefined;

    // Scheme in CSV but no NAV → likely still collecting subscriptions
    const isUpcoming = csv.launchDate > todayStr;

    nfos.push({
      id: code,
      schemeName: cleanSchemeName(csv.schemeName),
      amcName: csv.amc,
      category,
      subCategory,
      fundType: csv.schemeType?.includes('Close') ? 'Close-ended' : 'Open-ended',
      openDate: csv.launchDate,
      closeDate,
      minInvestment: csv.minInvestment,
      riskLevel,
      investmentObjective: `${isUpcoming ? 'Upcoming' : 'Recently launched'} ${category.toLowerCase()} fund — ${subCategory}`,
      status: isUpcoming ? 'upcoming' : 'open',
      isNew: true,
      isTrending: false,
      launchDate: csv.launchDate,
      daysLeft,
      schemeType: csv.schemeType,
      schemeCategory: csv.schemeCategory,
    });
  }

  // Sort by launch date desc (most recent first)
  nfos.sort((a, b) => (b.launchDate || b.openDate).localeCompare(a.launchDate || a.openDate));
  return nfos.slice(0, 30);
}

function categorizeFromCSV(schemeCategory: string): { category: string; subCategory: string; riskLevel: string } {
  if (!schemeCategory) return { category: 'Equity', subCategory: 'Equity', riskLevel: 'High' };
  const c = schemeCategory.toLowerCase();
  if (c.includes('debt') || c.includes('gilt') || c.includes('bond') || c.includes('liquid') || c.includes('money market') || c.includes('overnight') || c.includes('credit') || c.includes('floating') || c.includes('banking')) {
    const sub = c.includes('overnight') ? 'Overnight' : c.includes('liquid') ? 'Liquid' : 'Debt';
    const risk = (c.includes('overnight') || c.includes('liquid') || c.includes('money market')) ? 'Low' : 'Moderate';
    return { category: 'Debt', subCategory: sub, riskLevel: risk };
  }
  if (c.includes('hybrid') || c.includes('balanced') || c.includes('multi asset') || c.includes('arbitrage') || c.includes('equity savings')) {
    return { category: 'Hybrid', subCategory: 'Hybrid', riskLevel: 'Moderately High' };
  }
  if (c.includes('small cap') || c.includes('micro cap')) return { category: 'Equity', subCategory: 'Small Cap', riskLevel: 'Very High' };
  if (c.includes('mid cap')) return { category: 'Equity', subCategory: 'Mid Cap', riskLevel: 'Very High' };
  if (c.includes('large cap') || c.includes('large & mid')) return { category: 'Equity', subCategory: 'Large Cap', riskLevel: 'High' };
  if (c.includes('flexi cap') || c.includes('multi cap')) return { category: 'Equity', subCategory: 'Flexi Cap', riskLevel: 'Very High' };
  if (c.includes('index') || c.includes('etf')) return { category: 'Equity', subCategory: 'Index/ETF', riskLevel: 'High' };
  if (c.includes('sectoral') || c.includes('thematic') || c.includes('elss') || c.includes('value') || c.includes('contra') || c.includes('focused') || c.includes('dividend yield')) return { category: 'Equity', subCategory: 'Thematic', riskLevel: 'Very High' };
  return { category: 'Equity', subCategory: 'Equity', riskLevel: 'High' };
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch AMFI data in parallel
    const [navFunds, csvMap] = await Promise.all([
      fetchNAVDetectedFunds(),
      fetchSchemeCSV(),
    ]);

    const csvAvailable = csvMap.size > 0;
    const source = csvAvailable ? 'amfi-csv+nav' : 'amfi-nav-only';

    // 2. Build enriched NFO list
    const nfos = buildEnrichedNFOs(navFunds, csvMap);

    // 3. Update cache
    const cacheData: NFOCacheData = {
      nfos,
      fetchedAt: new Date().toISOString(),
      source,
    };
    setNFOCache(cacheData);

    // Persist to /tmp for cold-start recovery
    try {
      const fs = await import('fs');
      fs.writeFileSync('/tmp/nfo-cache.json', JSON.stringify(cacheData));
    } catch { /* non-critical */ }

    // 4. Check for NFOs closing tomorrow → send push notifications
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const closingTomorrow = nfos.filter(n => n.closeDate === tomorrowStr || n.launchDate === tomorrowStr);

    let notificationsSent = 0;
    let notificationsFailed = 0;
    const alertDetails: string[] = [];

    if (closingTomorrow.length > 0 && isFirebaseConfigured()) {
      // Check if already notified today
      const alreadySent = await pool.query(
        `SELECT 1 FROM notification_logs WHERE type = 'nfo_close_reminder' AND created_at > CURRENT_DATE LIMIT 1`
      );

      if (alreadySent.rows.length === 0) {
        // Get ALL device tokens (NFOs are broadcast, not location-targeted)
        const tokenResult = await pool.query('SELECT device_token FROM device_tokens');
        const tokens = tokenResult.rows.map(r => r.device_token);

        if (tokens.length > 0) {
          for (const nfo of closingTomorrow) {
            const title = `NFO closing tomorrow: ${nfo.schemeName}`;
            const body = `Last day to invest in ${nfo.amcName} ${nfo.category} fund. Min: Rs ${nfo.minInvestment}`;

            const result = await sendPushNotificationBatch(tokens, title, body, {
              type: 'nfo_close',
              screen: 'see_all/nfos',
            });

            // Clean up invalid tokens
            if (result.invalidTokens.length > 0) {
              for (const token of result.invalidTokens) {
                await pool.query('DELETE FROM device_tokens WHERE device_token = $1', [token]);
              }
            }

            notificationsSent += result.success;
            notificationsFailed += result.failure;
            alertDetails.push(`${nfo.schemeName}: ${result.success}/${tokens.length} sent`);
          }

          // Log notification
          await pool.query(`
            INSERT INTO notification_logs (type, title, body, tokens_count, success_count, failure_count, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `, [
            'nfo_close_reminder',
            `NFO Close Reminder: ${closingTomorrow.length} fund(s)`,
            closingTomorrow.map(n => n.schemeName).join(', '),
            notificationsSent + notificationsFailed,
            notificationsSent,
            notificationsFailed,
          ]);
        }
      } else {
        alertDetails.push('Already notified today — skipping');
      }
    }

    return NextResponse.json({
      success: true,
      nfosFound: nfos.length,
      navDetected: navFunds.length,
      csvEnriched: csvMap.size,
      source,
      closingTomorrow: closingTomorrow.length,
      notificationsSent,
      notificationsFailed,
      details: alertDetails,
      cacheUpdated: true,
    });

  } catch (error) {
    console.error('NFO refresh cron error:', error);
    return NextResponse.json({ success: false, error: 'NFO refresh failed' }, { status: 500 });
  }
}
