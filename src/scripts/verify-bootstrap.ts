/**
 * Verify bootstrap data correctness.
 * Usage: RAILWAY_DATABASE_URL="..." npx tsx src/scripts/verify-bootstrap.ts
 */
import { Pool } from 'pg';

const DB_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL ||
  'postgresql://localhost/vijaymalik_funds';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('railway') || DB_URL.includes('rlwy') ? { rejectUnauthorized: false } : undefined,
  max: 1,
});

async function verify() {
  console.log('=== DATA CORRECTNESS VERIFICATION ===');
  console.log('');

  // 1. Spot-check a well-known fund: HDFC Flexi Cap Direct-Growth
  console.log('1. Spot-check: HDFC Flexi Cap Direct-Growth (118989)');
  const hdfc = await pool.query(
    `SELECT nav_date, nav_value FROM nav_history WHERE scheme_code = '118989' ORDER BY nav_date DESC LIMIT 5`
  );
  for (const r of hdfc.rows) {
    console.log(`   ${r.nav_date.toISOString().slice(0, 10)}: ${r.nav_value}`);
  }

  // 2. Check date continuity (largest gaps for a single fund)
  console.log('');
  console.log('2. Date continuity (scheme 118989, gaps > 5 days):');
  const gaps = await pool.query(`
    WITH ordered AS (
      SELECT nav_date, LAG(nav_date) OVER (ORDER BY nav_date) AS prev_date
      FROM nav_history WHERE scheme_code = '118989'
    )
    SELECT nav_date, prev_date, (nav_date - prev_date) AS gap_days
    FROM ordered
    WHERE (nav_date - prev_date) > 5
    ORDER BY gap_days DESC LIMIT 5
  `);
  if (gaps.rows.length === 0) {
    console.log('   No gaps > 5 days. Data is continuous.');
  } else {
    for (const r of gaps.rows) {
      console.log(`   ${r.prev_date.toISOString().slice(0, 10)} → ${r.nav_date.toISOString().slice(0, 10)} (${r.gap_days} days)`);
    }
  }

  // 3. Row distribution by year
  console.log('');
  console.log('3. Row distribution by year:');
  const dist = await pool.query(`
    SELECT EXTRACT(YEAR FROM nav_date)::int AS year, COUNT(*) AS rows, COUNT(DISTINCT scheme_code) AS schemes
    FROM nav_history GROUP BY year ORDER BY year
  `);
  for (const r of dist.rows) {
    console.log(`   ${r.year}: ${parseInt(r.rows).toLocaleString()} rows, ${parseInt(r.schemes).toLocaleString()} schemes`);
  }

  // 4. Test metric functions
  console.log('');
  console.log('4. Metric functions:');
  try {
    const vol = await pool.query(`SELECT calc_volatility('118989', '2025-01-01', '2025-12-31') AS vol`);
    console.log(`   calc_volatility(118989, 2025): ${vol.rows[0].vol}%`);
  } catch (e: any) {
    console.log(`   calc_volatility error: ${e.message}`);
  }

  try {
    const dd = await pool.query(`SELECT calc_max_drawdown('118989', '2024-01-01', '2024-12-31') AS dd`);
    console.log(`   calc_max_drawdown(118989, 2024): ${dd.rows[0].dd}%`);
  } catch (e: any) {
    console.log(`   calc_max_drawdown error: ${e.message}`);
  }

  try {
    const sortino = await pool.query(`SELECT calc_sortino('118989', '2024-01-01', '2024-12-31') AS sortino`);
    console.log(`   calc_sortino(118989, 2024): ${sortino.rows[0].sortino}`);
  } catch (e: any) {
    console.log(`   calc_sortino error: ${e.message}`);
  }

  // 5. NAV precision check
  console.log('');
  console.log('5. NAV precision (all should be <= 4 decimals):');
  const precision = await pool.query(`
    SELECT scheme_code, nav_date, nav_value
    FROM nav_history
    WHERE nav_value != ROUND(nav_value, 4)
    LIMIT 3
  `);
  console.log(`   NAVs with >4 decimal precision: ${precision.rows.length} (expected: 0)`);

  // 6. Weekend check
  console.log('');
  console.log('6. Weekend NAV check:');
  const weekends = await pool.query(`
    SELECT COUNT(*) AS cnt FROM nav_history
    WHERE EXTRACT(DOW FROM nav_date) IN (0, 6)
  `);
  const wkCnt = parseInt(weekends.rows[0].cnt);
  console.log(`   NAVs on weekends: ${wkCnt} ${wkCnt === 0 ? '(correct)' : '(note: some liquid/debt funds have weekend NAVs)'}`);

  // 7. Source distribution
  console.log('');
  console.log('7. Source distribution:');
  const sources = await pool.query(`SELECT source, COUNT(*) AS cnt FROM nav_history GROUP BY source ORDER BY source`);
  for (const r of sources.rows) {
    console.log(`   ${r.source}: ${parseInt(r.cnt).toLocaleString()}`);
  }

  // 8. Cross-check latest NAV against funds table
  console.log('');
  console.log('8. Cross-check: nav_history latest vs funds.latest_nav (5 random):');
  const cross = await pool.query(`
    SELECT f.scheme_code, f.scheme_name, f.latest_nav, f.latest_nav_date,
           nh.nav_value AS history_nav, nh.nav_date AS history_date
    FROM funds f
    JOIN LATERAL (
      SELECT nav_value, nav_date FROM nav_history
      WHERE scheme_code = f.scheme_code ORDER BY nav_date DESC LIMIT 1
    ) nh ON true
    WHERE f.latest_nav IS NOT NULL
    ORDER BY RANDOM() LIMIT 5
  `);
  for (const r of cross.rows) {
    const match = Math.abs(parseFloat(r.latest_nav) - parseFloat(r.history_nav)) < 0.01;
    console.log(`   ${r.scheme_code}: funds=${r.latest_nav} (${r.latest_nav_date?.toISOString().slice(0,10)}) | history=${r.history_nav} (${r.history_date.toISOString().slice(0,10)}) ${match ? 'MATCH' : 'DIFF'}`);
  }

  console.log('');
  console.log('=== VERIFICATION COMPLETE ===');
  await pool.end();
}

verify().catch(async (err) => {
  console.error('Verification failed:', err);
  await pool.end();
  process.exit(1);
});
