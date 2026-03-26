/**
 * Diagnostic script — READ ONLY — for investigating fund grouping issues.
 * Run: node scripts/diagnose-fund-grouping.mjs
 */

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString:
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
});

async function main() {
  const client = await pool.connect();
  try {
    // ───────────────────────────────────────────────────────
    // 1. Count total, linked, unlinked funds
    // ───────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════");
    console.log("  1. FUND COUNTS");
    console.log("═══════════════════════════════════════════════════════");
    const counts = await client.query(`
      SELECT
        COUNT(*)                            AS total_funds,
        COUNT(master_fund_id)               AS linked_funds,
        COUNT(*) - COUNT(master_fund_id)    AS unlinked_funds
      FROM funds
    `);
    console.log(counts.rows[0]);

    // ───────────────────────────────────────────────────────
    // 2. Count total master_funds
    // ───────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  2. MASTER_FUNDS COUNT");
    console.log("═══════════════════════════════════════════════════════");
    const mfCount = await client.query(`
      SELECT
        COUNT(*)                              AS total_master_funds,
        COUNT(*) FILTER (WHERE variant_count > 0) AS active_master_funds,
        COUNT(*) FILTER (WHERE variant_count = 0) AS empty_master_funds
      FROM master_funds
    `);
    console.log(mfCount.rows[0]);

    // ───────────────────────────────────────────────────────
    // 3. 20 examples of same-strategy funds with DIFFERENT master_fund_ids
    // ───────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  3. MISMATCHED GROUPINGS (same strategy, different master_fund_id)");
    console.log("═══════════════════════════════════════════════════════");

    // First, build a stripped name in SQL and find groups with >1 distinct master_fund_id
    const mismatches = await client.query(`
      WITH stripped AS (
        SELECT
          scheme_code,
          scheme_name,
          master_fund_id,
          plan_type,
          option_type,
          -- Strip variant keywords to get a "core strategy" name
          TRIM(REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(scheme_name,
                      '\\s*-?\\s*(Direct|Regular)\\s*(Plan)?', ' ', 'gi'),
                    '\\s*-?\\s*(Annual|Half\\s*Yearly|Monthly|Quarterly|Weekly|Daily)?\\s*(IDCW|Dividend)\\s*(Option|Plan|Payout|Reinvestment)?', ' ', 'gi'),
                  '\\s*-?\\s*Growth\\s*(Option|Plan)?', ' ', 'gi'),
                '\\s*-?\\s*Bonus\\s*(Option)?', ' ', 'gi'),
              '\\s*-?\\s*Option\\s*$', '', 'gi'),
            '\\s{2,}', ' ', 'g')
          ) AS stripped_name
        FROM funds
        WHERE master_fund_id IS NOT NULL
          AND scheme_name IS NOT NULL
      ),
      conflicts AS (
        SELECT stripped_name
        FROM stripped
        GROUP BY stripped_name
        HAVING COUNT(DISTINCT master_fund_id) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 10
      )
      SELECT s.scheme_name, s.master_fund_id, s.plan_type, s.option_type, s.stripped_name
      FROM stripped s
      JOIN conflicts c ON s.stripped_name = c.stripped_name
      ORDER BY s.stripped_name, s.master_fund_id, s.plan_type, s.option_type
      LIMIT 40
    `);

    if (mismatches.rows.length === 0) {
      console.log("No mismatches found using simple stripping. Trying with clean_strategy_name()...");

      // Fallback: use the DB function if it exists
      const mismatches2 = await client.query(`
        WITH cleaned AS (
          SELECT
            scheme_code,
            scheme_name,
            master_fund_id,
            plan_type,
            option_type,
            clean_strategy_name(scheme_name) AS clean_name
          FROM funds
          WHERE master_fund_id IS NOT NULL
            AND scheme_name IS NOT NULL
        ),
        conflicts AS (
          SELECT clean_name
          FROM cleaned
          GROUP BY clean_name
          HAVING COUNT(DISTINCT master_fund_id) > 1
          ORDER BY COUNT(*) DESC
          LIMIT 10
        )
        SELECT c2.scheme_name, c2.master_fund_id, c2.plan_type, c2.option_type, c2.clean_name
        FROM cleaned c2
        JOIN conflicts c ON c2.clean_name = c.clean_name
        ORDER BY c2.clean_name, c2.master_fund_id, c2.plan_type, c2.option_type
        LIMIT 40
      `);
      printRows(mismatches2.rows);
    } else {
      printRows(mismatches.rows);
    }

    // ───────────────────────────────────────────────────────
    // 4. Test clean_strategy_name() on Growth/IDCW pairs
    // ───────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  4. clean_strategy_name() ON GROWTH vs IDCW VARIANTS");
    console.log("═══════════════════════════════════════════════════════");

    const testNames = [
      "HDFC Large Cap Fund - Direct Plan - Growth Option",
      "HDFC Large Cap Fund - Direct Plan - IDCW",
      "HDFC Large Cap Fund - Regular Plan - Growth Option",
      "HDFC Large Cap Fund - Regular Plan - Dividend Option",
      "ICICI Prudential Bluechip Fund - Direct Plan - Growth",
      "ICICI Prudential Bluechip Fund - Direct Plan - IDCW Payout",
      "ICICI Prudential Bluechip Fund - Regular Plan - Growth",
      "SBI Blue Chip Fund - Direct Plan - Growth",
      "SBI Blue Chip Fund - Direct Plan - IDCW",
      "SBI Blue Chip Fund - Regular Plan - Growth",
    ];

    // Check if function exists first
    try {
      const cleanResults = await client.query(`
        SELECT unnest($1::text[]) AS original,
               clean_strategy_name(unnest($1::text[])) AS cleaned
      `, [testNames]);
      cleanResults.rows.forEach(r => {
        console.log(`  "${r.original}"`);
        console.log(`    => "${r.cleaned}"`);
        console.log();
      });
    } catch (e) {
      console.log("  clean_strategy_name() function not found in DB. Testing with real scheme names instead...");
      // Pull real pairs from the DB
      const realPairs = await client.query(`
        SELECT scheme_name, master_fund_id, plan_type, option_type
        FROM funds
        WHERE scheme_name ILIKE '%HDFC Large Cap%'
           OR scheme_name ILIKE '%ICICI Prudential Bluechip%'
           OR scheme_name ILIKE '%SBI Blue Chip%'
        ORDER BY scheme_name
        LIMIT 20
      `);
      printRows(realPairs.rows);
    }

    // Also test with actual scheme_names from DB
    console.log("  --- Actual DB examples ---");
    try {
      const actualPairs = await client.query(`
        SELECT
          f1.scheme_name AS growth_name,
          f2.scheme_name AS idcw_name,
          clean_strategy_name(f1.scheme_name) AS growth_cleaned,
          clean_strategy_name(f2.scheme_name) AS idcw_cleaned,
          f1.master_fund_id AS growth_mfid,
          f2.master_fund_id AS idcw_mfid,
          CASE WHEN f1.master_fund_id = f2.master_fund_id THEN 'SAME' ELSE 'DIFFERENT' END AS grouping_status,
          CASE WHEN clean_strategy_name(f1.scheme_name) = clean_strategy_name(f2.scheme_name) THEN 'MATCH' ELSE 'MISMATCH' END AS name_match
        FROM funds f1
        JOIN funds f2
          ON f1.plan_type = f2.plan_type
          AND f1.option_type = 'Growth'
          AND f2.option_type IN ('IDCW', 'Dividend')
          AND f1.scheme_name ILIKE '%Large Cap%'
          AND f2.scheme_name ILIKE '%Large Cap%'
          AND f1.amc_code = f2.amc_code
        LIMIT 10
      `);
      actualPairs.rows.forEach(r => {
        console.log(`  Growth:  "${r.growth_name}" => "${r.growth_cleaned}" [mfid=${r.growth_mfid}]`);
        console.log(`  IDCW:    "${r.idcw_name}" => "${r.idcw_cleaned}" [mfid=${r.idcw_mfid}]`);
        console.log(`  Status:  grouping=${r.grouping_status}  name_match=${r.name_match}`);
        console.log();
      });
    } catch (e) {
      console.log("  (clean_strategy_name not available, skipping actual DB pair test)");
    }

    // ───────────────────────────────────────────────────────
    // 5. Count master_funds with variant_count = 1 (orphans)
    // ───────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  5. ORPHAN MASTER_FUNDS (variant_count = 1)");
    console.log("═══════════════════════════════════════════════════════");
    const orphans = await client.query(`
      SELECT COUNT(*) AS orphan_count
      FROM master_funds
      WHERE variant_count = 1
    `);
    console.log(`  Orphan master_funds (variant_count=1): ${orphans.rows[0].orphan_count}`);

    // Show some examples
    const orphanExamples = await client.query(`
      SELECT mf.id, mf.strategy_name, mf.variant_count, f.scheme_name, f.plan_type, f.option_type
      FROM master_funds mf
      JOIN funds f ON f.master_fund_id = mf.id
      WHERE mf.variant_count = 1
      ORDER BY mf.strategy_name
      LIMIT 15
    `);
    console.log("\n  Sample orphans:");
    orphanExamples.rows.forEach(r => {
      console.log(`    mfid=${r.id} | strategy="${r.strategy_name}" | scheme="${r.scheme_name}" | ${r.plan_type}/${r.option_type}`);
    });

    // ───────────────────────────────────────────────────────
    // 6. Variant count distribution
    // ───────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  6. VARIANT COUNT DISTRIBUTION");
    console.log("═══════════════════════════════════════════════════════");
    const dist = await client.query(`
      SELECT
        CASE
          WHEN variant_count = 0 THEN '0 (empty)'
          WHEN variant_count = 1 THEN '1 (orphan)'
          WHEN variant_count = 2 THEN '2'
          WHEN variant_count BETWEEN 3 AND 4 THEN '3-4'
          WHEN variant_count BETWEEN 5 AND 8 THEN '5-8'
          WHEN variant_count >= 9 THEN '9+'
        END AS bucket,
        COUNT(*) AS master_fund_count,
        SUM(variant_count) AS total_funds_in_bucket
      FROM master_funds
      GROUP BY
        CASE
          WHEN variant_count = 0 THEN '0 (empty)'
          WHEN variant_count = 1 THEN '1 (orphan)'
          WHEN variant_count = 2 THEN '2'
          WHEN variant_count BETWEEN 3 AND 4 THEN '3-4'
          WHEN variant_count BETWEEN 5 AND 8 THEN '5-8'
          WHEN variant_count >= 9 THEN '9+'
        END
      ORDER BY MIN(variant_count)
    `);
    console.log("  Bucket          | Master Funds | Total Fund Rows");
    console.log("  ────────────────┼──────────────┼────────────────");
    dist.rows.forEach(r => {
      console.log(`  ${r.bucket.padEnd(16)}| ${String(r.master_fund_count).padStart(12)} | ${String(r.total_funds_in_bucket).padStart(15)}`);
    });

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  DIAGNOSTICS COMPLETE");
    console.log("═══════════════════════════════════════════════════════");

  } finally {
    client.release();
    await pool.end();
  }
}

function printRows(rows) {
  if (rows.length === 0) {
    console.log("  (no results)");
    return;
  }
  rows.forEach(r => {
    const parts = Object.entries(r).map(([k, v]) => `${k}=${v}`).join(" | ");
    console.log(`  ${parts}`);
  });
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
