/**
 * Run migration 004_time_series_engine.sql against Railway PostgreSQL.
 * Usage: npx tsx src/scripts/run-migration-004.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DB_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL ||
  'postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 15000
});

async function run() {
  console.log('Running migration 004_time_series_engine.sql...');
  console.log(`Database: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);

  const sqlPath = path.join(__dirname, '../../migrations/004_time_series_engine.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration 004 completed successfully.');

    // Verify: check nav_history schema
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'nav_history' ORDER BY ordinal_position`
    );
    console.log('\nnav_history columns:');
    for (const row of cols.rows) {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    }

    // Check if legacy table exists
    const legacy = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'nav_history_legacy'`
    );
    if (legacy.rows.length > 0) {
      console.log('\nnav_history_legacy preserved for rollback safety.');
    }

    // Verify metric functions
    const fns = await client.query(
      `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'calc_%'`
    );
    console.log(`\nMetric functions created: ${fns.rows.map((r: any) => r.routine_name).join(', ')}`);

  } finally {
    client.release();
  }

  await pool.end();
}

run().catch(async (err) => {
  console.error('Migration failed:', err.message);
  await pool.end();
  process.exit(1);
});
