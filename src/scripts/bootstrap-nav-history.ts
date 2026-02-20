/**
 * Bootstrap NAV History — 10-Year AMFI-Direct Backfill (v2: Smart Resume)
 *
 * Downloads historical NAV from AMFI's DownloadNAVHistoryReport_Po endpoint
 * in 3-month sliding windows with checkpoint-based resume and adaptive throttling.
 *
 * SMART FEATURES:
 * 1. Checkpoint file (.bootstrap-checkpoint.json) — skips already-completed chunks on restart
 * 2. Rate-limit detection — detects HTML response (rate limited) vs CSV (real data)
 * 3. Adaptive backoff — on rate limit: 2min → 5min → 10min → 20min (exponential)
 * 4. DB-side dedup — ON CONFLICT DO NOTHING means even re-processed chunks are safe
 * 5. TCP keepalive — prevents Railway proxy from dropping idle connections during downloads
 *
 * Usage: RAILWAY_DATABASE_URL="..." npx tsx src/scripts/bootstrap-nav-history.ts
 *        RAILWAY_DATABASE_URL="..." nohup npx tsx src/scripts/bootstrap-nav-history.ts &
 *
 * History endpoint format (8 fields, semicolon-delimited):
 *   SchemeCode;SchemeName;ISINDivPayout;ISINDivReinvestment;NAV;RepurchasePrice;SalePrice;Date
 */

import { Pool } from 'pg';
import https from 'https';
import http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const DB_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL ||
  'postgresql://localhost/vijaymalik_funds';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('railway') || DB_URL.includes('rlwy') ? { rejectUnauthorized: false } : undefined,
  max: 3,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Pool connection error (non-fatal):', err.message);
});

// ── Configuration ──────────────────────────────────────────────────
const AMFI_HISTORY_BASE = 'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx';
const CHECKPOINT_FILE = path.join(__dirname, '../../.bootstrap-checkpoint.json');

// Throttle: base 30s between requests (respectful to AMFI)
const BASE_THROTTLE_MS = 30000;
// Backoff sequence on rate limit: 2min, 5min, 10min, 20min
const BACKOFF_SEQUENCE_MS = [120000, 300000, 600000, 1200000];
const MAX_RETRIES_PER_CHUNK = 4;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

// ── Checkpoint Management ──────────────────────────────────────────
interface Checkpoint {
  completedChunks: number[];  // Indices of completed chunks
  totalInserted: number;
  lastUpdated: string;
}

function loadCheckpoint(): Checkpoint {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      return data;
    }
  } catch {
    // Corrupted checkpoint — start fresh
  }
  return { completedChunks: [], totalInserted: 0, lastUpdated: new Date().toISOString() };
}

function saveCheckpoint(cp: Checkpoint): void {
  cp.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ── Helpers ────────────────────────────────────────────────────────
function convertDate(dateStr: string): string | null {
  const match = dateStr.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTH_MAP[match[2]];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1]}`;
}

function formatAmfiDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface NavRow {
  schemeCode: string;
  navDate: string;
  navValue: number;
}

// ── Rate-Limit Detection ──────────────────────────────────────────
function isRateLimited(rawText: string): boolean {
  // AMFI returns HTML page when rate-limited, CSV data when allowed
  const trimmed = rawText.trim();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML');
}

// ── HTTP Fetch ────────────────────────────────────────────────────
function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const handler = (response: http.IncomingMessage) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          https.get(redirect, { timeout: 120000 }, handler).on('error', reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      let data = '';
      response.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      response.on('end', () => resolve(data));
      response.on('error', reject);
    };

    const req = https.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 120000
    }, handler);
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

// ── Parser ────────────────────────────────────────────────────────
function parseAmfiHistory(rawText: string): NavRow[] {
  const rows: NavRow[] = [];
  const lines = rawText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(';')) continue;

    const parts = trimmed.split(';');
    if (parts.length < 8) continue;

    const schemeCode = parts[0].trim();
    if (!schemeCode || !/^\d+$/.test(schemeCode)) continue;

    const navStr = parts[4].trim();
    const nav = parseFloat(navStr);
    if (isNaN(nav) || nav <= 0) continue;

    const dateStr = parts[7]?.trim();
    if (!dateStr) continue;
    const pgDate = convertDate(dateStr);
    if (!pgDate) continue;

    rows.push({ schemeCode, navDate: pgDate, navValue: nav });
  }

  return rows;
}

// ── DB Insert ─────────────────────────────────────────────────────
async function insertBatch(rows: NavRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const codes: string[] = [];
  const dates: string[] = [];
  const navs: number[] = [];

  for (const row of rows) {
    codes.push(row.schemeCode);
    dates.push(row.navDate);
    navs.push(row.navValue);
  }

  const result = await pool.query(`
    INSERT INTO nav_history (scheme_code, nav_date, nav_value, source)
    SELECT unnest($1::text[]), unnest($2::date[]), unnest($3::numeric[]), 'B'
    ON CONFLICT (scheme_code, nav_date) DO NOTHING
  `, [codes, dates, navs]);

  return result.rowCount || 0;
}

// ── Chunk Generation ──────────────────────────────────────────────
interface Chunk {
  index: number;
  label: string;
  url: string;
}

function generateChunks(): Chunk[] {
  const chunks: Chunk[] = [];
  const now = new Date();
  const start = new Date(now.getFullYear() - 10, now.getMonth(), 1);

  let cursor = new Date(start);
  let index = 0;

  while (cursor < now) {
    const fromDate = new Date(cursor);
    cursor.setMonth(cursor.getMonth() + 3);
    const toDate = cursor > now ? new Date(now) : new Date(cursor);
    toDate.setDate(toDate.getDate() - 1);

    const frmdt = formatAmfiDate(fromDate);
    const todt = formatAmfiDate(toDate);
    const label = `${fromDate.toISOString().slice(0, 7)} → ${toDate.toISOString().slice(0, 7)}`;
    const url = `${AMFI_HISTORY_BASE}?frmdt=${frmdt}&todt=${todt}`;
    chunks.push({ index, label, url });

    cursor = new Date(toDate);
    cursor.setDate(cursor.getDate() + 1);
    index++;
  }

  return chunks;
}

// ── Main ──────────────────────────────────────────────────────────
async function run() {
  const startTime = Date.now();
  console.log('BOOTSTRAP NAV HISTORY — 10-YEAR AMFI-DIRECT BACKFILL (v2: Smart Resume)');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Database: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  // Verify nav_history table exists
  try {
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'nav_history' AND column_name = 'source'`
    );
    if (check.rows.length === 0) {
      console.error('ERROR: nav_history table does not have "source" column.');
      console.error('Run migration 004_time_series_engine.sql first.');
      await pool.end();
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`ERROR: Cannot connect to database: ${err.message}`);
    await pool.end();
    process.exit(1);
  }

  const chunks = generateChunks();
  const checkpoint = loadCheckpoint();
  const pendingChunks = chunks.filter(c => !checkpoint.completedChunks.includes(c.index));

  console.log(`Total chunks: ${chunks.length}`);
  console.log(`Already completed: ${checkpoint.completedChunks.length} (from checkpoint)`);
  console.log(`Remaining: ${pendingChunks.length}`);
  console.log(`Base throttle: ${BASE_THROTTLE_MS / 1000}s between requests`);
  console.log(`Checkpoint file: ${CHECKPOINT_FILE}`);
  console.log('');

  if (pendingChunks.length === 0) {
    console.log('All chunks already completed! Nothing to do.');
    await pool.end();
    return;
  }

  let sessionInserted = 0;
  let failedChunks = 0;

  const BATCH_SIZE = 10000;

  for (let pi = 0; pi < pendingChunks.length; pi++) {
    const chunk = pendingChunks[pi];
    const chunkStart = Date.now();
    console.log(`[${checkpoint.completedChunks.length + 1}/${chunks.length}] Chunk #${chunk.index}: ${chunk.label}`);

    // Fetch with retry + adaptive backoff on rate limit
    let rawText: string | null = null;
    let retries = 0;

    while (retries <= MAX_RETRIES_PER_CHUNK) {
      try {
        rawText = await fetchUrl(chunk.url);
      } catch (err: any) {
        console.error(`  FETCH ERROR: ${err.message}`);
        rawText = null;
      }

      if (rawText && isRateLimited(rawText)) {
        const backoff = BACKOFF_SEQUENCE_MS[Math.min(retries, BACKOFF_SEQUENCE_MS.length - 1)];
        console.log(`  RATE LIMITED by AMFI. Backing off ${(backoff / 60000).toFixed(1)} min (attempt ${retries + 1}/${MAX_RETRIES_PER_CHUNK + 1})...`);
        rawText = null;
        retries++;
        await sleep(backoff);
        continue;
      }

      if (rawText) break; // Success — got real CSV data

      // Network error — shorter backoff
      retries++;
      if (retries <= MAX_RETRIES_PER_CHUNK) {
        console.log(`  Retrying in 60s (attempt ${retries}/${MAX_RETRIES_PER_CHUNK + 1})...`);
        await sleep(60000);
      }
    }

    if (!rawText) {
      console.error(`  SKIPPING chunk #${chunk.index} after ${retries} retries. Will retry on next run.`);
      failedChunks++;
      continue;
    }

    const sizeKB = (rawText.length / 1024).toFixed(0);
    const rows = parseAmfiHistory(rawText);
    console.log(`  Downloaded ${sizeKB} KB → ${rows.length.toLocaleString()} NAV rows`);

    rawText = '';

    // Insert in batches
    let chunkInserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const inserted = await insertBatch(batch);
      chunkInserted += inserted;

      const pct = ((Math.min(i + BATCH_SIZE, rows.length) / rows.length) * 100).toFixed(0);
      process.stdout.write(`  Inserting... ${pct}%  (${chunkInserted.toLocaleString()} new rows)\r`);
    }

    sessionInserted += chunkInserted;
    checkpoint.totalInserted += chunkInserted;
    checkpoint.completedChunks.push(chunk.index);
    saveCheckpoint(checkpoint);

    const chunkTime = ((Date.now() - chunkStart) / 1000).toFixed(1);
    console.log(`  Done: ${chunkInserted.toLocaleString()} new rows in ${chunkTime}s (session total: ${sessionInserted.toLocaleString()})`);
    console.log(`  Checkpoint saved. ${chunks.length - checkpoint.completedChunks.length} chunks remaining.`);

    // Throttle between requests
    if (pi < pendingChunks.length - 1) {
      const jitter = Math.random() * 10000; // 0-10s random jitter
      const delay = BASE_THROTTLE_MS + jitter;
      console.log(`  Throttling ${(delay / 1000).toFixed(0)}s...`);
      await sleep(delay);
    }
    console.log('');
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const countResult = await pool.query('SELECT COUNT(*) FROM nav_history');
  const totalRows = parseInt(countResult.rows[0].count);
  const rangeResult = await pool.query('SELECT MIN(nav_date) AS min_date, MAX(nav_date) AS max_date FROM nav_history');
  const minDate = rangeResult.rows[0]?.min_date;
  const maxDate = rangeResult.rows[0]?.max_date;
  const schemeResult = await pool.query('SELECT COUNT(DISTINCT scheme_code) FROM nav_history');
  const schemeCount = parseInt(schemeResult.rows[0].count);

  console.log('='.repeat(60));
  console.log('BOOTSTRAP SESSION COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total time:         ${totalTime}s`);
  console.log(`  Chunks completed:   ${checkpoint.completedChunks.length}/${chunks.length}`);
  console.log(`  Failed this session: ${failedChunks}`);
  console.log(`  New rows (session): ${sessionInserted.toLocaleString()}`);
  console.log(`  Total in DB:        ${totalRows.toLocaleString()}`);
  console.log(`  Distinct schemes:   ${schemeCount.toLocaleString()}`);
  console.log(`  Date range:         ${minDate} → ${maxDate}`);
  console.log(`  Estimated size:     ~${(totalRows * 30 / 1024 / 1024).toFixed(0)} MB`);

  if (checkpoint.completedChunks.length < chunks.length) {
    console.log('');
    console.log(`  ⚠ ${chunks.length - checkpoint.completedChunks.length} chunks remaining. Re-run this script to continue.`);
  } else {
    console.log('');
    console.log('  ✓ All chunks completed! Bootstrap is done.');
    // Clean up checkpoint file
    try { fs.unlinkSync(CHECKPOINT_FILE); } catch {}
  }

  console.log('='.repeat(60));
  await pool.end();
}

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, closing gracefully (checkpoint preserved)...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, closing gracefully (checkpoint preserved)...');
  await pool.end();
  process.exit(0);
});

run().catch(async (err) => {
  console.error('Fatal error:', err);
  await pool.end();
  process.exit(1);
});
