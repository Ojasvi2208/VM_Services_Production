/**
 * Fuel Price Change Alert Cron
 * GET /api/cron/fuel-alert
 *
 * Called daily at 7:00 AM IST via GitHub Actions.
 * 1. Fetches fresh prices from RapidAPI (bypasses cache)
 * 2. Checks retailPriceChange for each state
 * 3. Sends targeted FCM push to devices in states with price changes
 * 4. Updates the fuel cache for immediate user requests
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';
import { sendPushNotificationBatch, isFirebaseConfigured } from '@/lib/firebase-admin';
import { setScrapedFuelCache, type ScrapedFuelData, type ScrapedStatePrice } from '@/lib/fuel-cache';

const RAPIDAPI_HOST = 'daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/v1/fuel-prices/today/india`;

interface StateChange {
  stateName: string;
  petrolPrice: number;
  dieselPrice: number;
  petrolChange: number;
  dieselChange: number;
  cngPrice?: number;
}

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

async function fetchFreshPrices(): Promise<{ states: Record<string, ScrapedStatePrice & { petrolChangeNum: number; dieselChangeNum: number }>; raw: ScrapedFuelData } | null> {
  const apiKey = process.env.RAPIDAPI_FUEL_KEY || 'a9309157camshfb4a238482cf839p11f04bjsnfa603976250f';
  try {
    const resp = await fetch(`${RAPIDAPI_BASE}/states`, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();

    const states: Record<string, ScrapedStatePrice & { petrolChangeNum: number; dieselChangeNum: number }> = {};
    const cacheStates: Record<string, ScrapedStatePrice> = {};

    for (const sp of data.statePrices || []) {
      const stateName = sp.stateName as string;
      const petrolChange = Number(sp.fuel?.petrol?.retailPriceChange) || 0;
      const dieselChange = Number(sp.fuel?.diesel?.retailPriceChange) || 0;

      states[stateName] = {
        petrol: sp.fuel?.petrol?.retailPrice || 0,
        diesel: sp.fuel?.diesel?.retailPrice || 0,
        petrolChange: String(petrolChange),
        dieselChange: String(dieselChange),
        cng: sp.fuel?.cng?.retailPrice || undefined,
        petrolChangeNum: petrolChange,
        dieselChangeNum: dieselChange,
      };

      cacheStates[stateName] = {
        petrol: sp.fuel?.petrol?.retailPrice || 0,
        diesel: sp.fuel?.diesel?.retailPrice || 0,
        petrolChange: String(petrolChange),
        dieselChange: String(dieselChange),
        cng: sp.fuel?.cng?.retailPrice || undefined,
      };
    }

    const cacheData: ScrapedFuelData = {
      states: cacheStates,
      cities: {},
      fetchedAt: new Date().toISOString(),
      source: 'RapidAPI',
    };

    return { states, raw: cacheData };
  } catch (e) {
    console.error('Fuel alert: RapidAPI fetch failed:', e);
    return null;
  }
}

function formatChange(change: number): string {
  if (change > 0) return `+${change.toFixed(2)}`;
  if (change < 0) return change.toFixed(2);
  return '0.00';
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch fresh prices from RapidAPI
    const result = await fetchFreshPrices();
    if (!result) {
      return NextResponse.json({ success: false, error: 'Failed to fetch fuel prices from RapidAPI' }, { status: 502 });
    }

    // 2. Update cache immediately (so user requests are fast)
    setScrapedFuelCache(result.raw);
    try {
      const fs = await import('fs');
      fs.writeFileSync('/tmp/fuel-scraped-cache.json', JSON.stringify(result.raw));
    } catch { /* non-critical */ }

    // 3. Find states with price changes
    const changedStates: StateChange[] = [];
    for (const [stateName, data] of Object.entries(result.states)) {
      if (data.petrolChangeNum !== 0 || data.dieselChangeNum !== 0) {
        changedStates.push({
          stateName,
          petrolPrice: data.petrol,
          dieselPrice: data.diesel,
          petrolChange: data.petrolChangeNum,
          dieselChange: data.dieselChangeNum,
          cngPrice: data.cng,
        });
      }
    }

    const totalStates = Object.keys(result.states).length;

    if (changedStates.length === 0) {
      // No price changes — no notifications needed
      return NextResponse.json({
        success: true,
        message: 'No fuel price changes today',
        totalStates,
        changedStates: 0,
        notificationsSent: 0,
        cacheUpdated: true,
      });
    }

    // 4. Send targeted notifications to devices in changed states
    if (!isFirebaseConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Price changes detected but Firebase not configured',
        totalStates,
        changedStates: changedStates.length,
        changes: changedStates.map(s => `${s.stateName}: P${formatChange(s.petrolChange)} D${formatChange(s.dieselChange)}`),
        notificationsSent: 0,
        cacheUpdated: true,
      });
    }

    let totalSent = 0;
    let totalFailed = 0;
    const alertDetails: string[] = [];

    for (const change of changedStates) {
      // Find devices in this state (case-insensitive match)
      const tokenResult = await pool.query(
        'SELECT device_token FROM device_tokens WHERE LOWER(last_known_state) = LOWER($1)',
        [change.stateName]
      );
      const tokens = tokenResult.rows.map(r => r.device_token);

      if (tokens.length === 0) {
        alertDetails.push(`${change.stateName}: 0 devices (skipped)`);
        continue;
      }

      // Build notification
      const title = `Fuel prices updated in ${change.stateName}`;
      let body = `Petrol: Rs ${change.petrolPrice.toFixed(2)} (${formatChange(change.petrolChange)})`;
      body += ` | Diesel: Rs ${change.dieselPrice.toFixed(2)} (${formatChange(change.dieselChange)})`;

      const batchResult = await sendPushNotificationBatch(tokens, title, body, {
        type: 'fuel_alert',
        screen: 'fuel_prices',
        state: change.stateName,
      });

      // Clean up invalid tokens
      if (batchResult.invalidTokens.length > 0) {
        for (const token of batchResult.invalidTokens) {
          await pool.query('DELETE FROM device_tokens WHERE device_token = $1', [token]);
        }
      }

      totalSent += batchResult.success;
      totalFailed += batchResult.failure;
      alertDetails.push(`${change.stateName}: ${batchResult.success}/${tokens.length} sent`);
    }

    // Also send a general notification to devices with no state set (so they're not left out)
    const noStateResult = await pool.query(
      'SELECT device_token FROM device_tokens WHERE last_known_state IS NULL'
    );
    const noStateTokens = noStateResult.rows.map(r => r.device_token);
    if (noStateTokens.length > 0) {
      const title = 'Fuel prices updated today';
      const body = `${changedStates.length} state(s) with price changes. Check your local fuel prices.`;
      const batchResult = await sendPushNotificationBatch(noStateTokens, title, body, {
        type: 'fuel_alert',
        screen: 'fuel_prices',
      });
      if (batchResult.invalidTokens.length > 0) {
        for (const token of batchResult.invalidTokens) {
          await pool.query('DELETE FROM device_tokens WHERE device_token = $1', [token]);
        }
      }
      totalSent += batchResult.success;
      totalFailed += batchResult.failure;
      alertDetails.push(`No-state devices: ${batchResult.success}/${noStateTokens.length} sent`);
    }

    // 5. Log notification
    await pool.query(`
      INSERT INTO notification_logs (type, title, body, tokens_count, success_count, failure_count, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, ['fuel_alert', 'Fuel Price Change Alert', `${changedStates.length} states changed`, totalSent + totalFailed, totalSent, totalFailed]);

    return NextResponse.json({
      success: true,
      totalStates,
      changedStates: changedStates.length,
      changes: changedStates.map(s => ({
        state: s.stateName,
        petrol: `${s.petrolPrice} (${formatChange(s.petrolChange)})`,
        diesel: `${s.dieselPrice} (${formatChange(s.dieselChange)})`,
      })),
      notificationsSent: totalSent,
      notificationsFailed: totalFailed,
      details: alertDetails,
      cacheUpdated: true,
    });

  } catch (error) {
    console.error('Fuel alert cron error:', error);
    return NextResponse.json({ success: false, error: 'Fuel alert cron failed' }, { status: 500 });
  }
}
