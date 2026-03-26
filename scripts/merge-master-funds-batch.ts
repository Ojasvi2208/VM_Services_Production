/**
 * Merge Duplicate Master Funds — BATCH SQL (no per-row round trips)
 *
 * Problem: Growth/IDCW/Fortnightly/Half-Yearly variants of the same fund
 * got separate master_fund rows. This merges them using pure SQL.
 *
 * Strategy:
 *   1. Create a SQL function that normalizes strategy_name to a canonical key
 *   2. Build a mapping table: for each canonical key, pick the best master_fund_id
 *   3. Re-link all funds to the canonical master_fund_id
 *   4. Delete orphaned master_funds
 *   5. Update counts, refresh materialized view
 *
 * Run: npx tsx scripts/merge-master-funds-batch.ts
 */

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
});

async function main() {
  const client = await pool.connect();

  try {
    console.log("=== Merge Duplicate Master Funds (Batch SQL) ===\n");

    // Stats before
    const before = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM funds) AS total_funds,
        (SELECT COUNT(master_fund_id) FROM funds) AS linked,
        (SELECT COUNT(*) FROM master_funds) AS total_masters,
        (SELECT COUNT(*) FROM master_funds WHERE variant_count = 1) AS singletons
    `);
    console.log("BEFORE:", before.rows[0]);

    // ── STEP 1: Create aggressive canonical normalizer ──
    console.log("\nStep 1: Creating canonical normalizer function...");
    await client.query(`
      CREATE OR REPLACE FUNCTION canonical_fund_key(name TEXT) RETURNS TEXT AS $$
      DECLARE
        r TEXT;
      BEGIN
        r := name;

        -- Remove ALL parentheticals (Erstwhile, Formerly, Segregated, Advisor, etc.)
        r := REGEXP_REPLACE(r, '\\s*\\([^)]*\\)', '', 'gi');

        -- Remove plan type: Direct, Regular (with optional Plan suffix)
        r := REGEXP_REPLACE(r, '\\s*-?\\s*(Direct|Regular)\\s*(Plan)?\\s*', ' ', 'gi');

        -- Remove ALL dividend/IDCW types with frequency prefixes
        -- Handles: Daily IDCW, Monthly Dividend, Quarterly IDCW Payout, Annual IDCW Reinvestment, Fortnightly, etc.
        r := REGEXP_REPLACE(r, '\\s*-?\\s*(Annual|Half[\\s-]*Yearly|Monthly|Quarterly|Weekly|Daily|Fortnightly)?\\s*-?\\s*(IDCW|Dividend)\\s*(Option|Plan|Payout|Reinvestment|Reinvest)?\\s*', ' ', 'gi');

        -- Remove Growth, Bonus
        r := REGEXP_REPLACE(r, '\\s*-?\\s*Growth\\s*(Option|Plan)?\\s*', ' ', 'gi');
        r := REGEXP_REPLACE(r, '\\s*-?\\s*Bonus\\s*(Option)?\\s*', ' ', 'gi');

        -- Remove "Plan A", "Plan B", "Plan C"
        r := REGEXP_REPLACE(r, '\\s*-?\\s*Plan\\s+[A-Z]\\b', ' ', 'gi');

        -- Remove Institutional
        r := REGEXP_REPLACE(r, '\\s*-?\\s*Institutional\\s*', ' ', 'gi');

        -- Remove standalone Payout / Reinvestment
        r := REGEXP_REPLACE(r, '\\s*-?\\s*(Payout|Reinvestment|Reinvest)\\s*', ' ', 'gi');

        -- Remove trailing Option / Plan
        r := REGEXP_REPLACE(r, '\\s*-?\\s*Option\\s*$', '', 'gi');
        r := REGEXP_REPLACE(r, '\\s*-?\\s*Plan\\s*$', '', 'gi');

        -- Clean up whitespace and dashes
        r := REGEXP_REPLACE(r, '\\s{2,}', ' ', 'g');
        r := REGEXP_REPLACE(r, '\\s*-\\s*$', '', 'g');
        r := REGEXP_REPLACE(r, '^\\s*-\\s*', '', 'g');
        r := REGEXP_REPLACE(r, '\\s*-\\s*-\\s*', ' - ', 'g');

        -- Lowercase for case-insensitive matching
        r := LOWER(TRIM(r));

        RETURN r;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    console.log("Done.");

    // ── STEP 2: Verify — count duplicate groups ──
    console.log("\nStep 2: Counting duplicate groups...");
    const dupeStats = await client.query(`
      WITH keyed AS (
        SELECT id, strategy_name, variant_count,
               canonical_fund_key(strategy_name) AS ckey
        FROM master_funds
      ),
      grouped AS (
        SELECT ckey, COUNT(*) AS cnt, SUM(variant_count) AS total_variants
        FROM keyed
        WHERE LENGTH(ckey) >= 3
        GROUP BY ckey
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*) AS duplicate_groups,
        SUM(cnt) AS total_master_funds_in_groups,
        SUM(cnt) - COUNT(*) AS master_funds_to_delete,
        SUM(total_variants) AS fund_rows_affected
      FROM grouped
    `);
    console.log("Duplicate groups:", dupeStats.rows[0]);

    // Show sample
    const samples = await client.query(`
      WITH keyed AS (
        SELECT id, strategy_name, variant_count,
               canonical_fund_key(strategy_name) AS ckey
        FROM master_funds
      )
      SELECT ckey, ARRAY_AGG(id ORDER BY variant_count DESC, id ASC) AS ids,
             ARRAY_AGG(strategy_name ORDER BY variant_count DESC, id ASC) AS names,
             ARRAY_AGG(variant_count ORDER BY variant_count DESC, id ASC) AS vcounts
      FROM keyed
      WHERE LENGTH(ckey) >= 3
      GROUP BY ckey
      HAVING COUNT(*) > 1
      ORDER BY SUM(variant_count) DESC
      LIMIT 10
    `);
    console.log("\nSample merges:");
    for (const s of samples.rows) {
      console.log(`  "${s.ckey}": ${s.ids.length} master_funds → KEEP id=${s.ids[0]}`);
      for (let i = 0; i < s.ids.length; i++) {
        console.log(`    ${i === 0 ? 'KEEP' : 'MERGE'} id=${s.ids[i]} (${s.vcounts[i]} variants) "${s.names[i]}"`);
      }
    }

    // ── STEP 3: Build canonical mapping and merge — ALL IN SQL ──
    console.log("\nStep 3: Executing batch merge...");
    await client.query("BEGIN");

    // 3a. Create temp table with the canonical mapping
    await client.query(`
      CREATE TEMP TABLE merge_map AS
      WITH keyed AS (
        SELECT id, strategy_name, variant_count, fund_house, category, sub_category,
               canonical_fund_key(strategy_name) AS ckey
        FROM master_funds
      ),
      -- For each canonical key, pick the "best" master_fund (most variants, lowest ID as tiebreak)
      ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY ckey ORDER BY variant_count DESC, id ASC) AS rn
        FROM keyed
        WHERE LENGTH(ckey) >= 3
      )
      SELECT
        r.id AS old_id,
        r.ckey,
        -- The winner for this canonical key
        (SELECT id FROM ranked r2 WHERE r2.ckey = r.ckey AND r2.rn = 1) AS new_id,
        r.rn
      FROM ranked r
    `);

    // Count what we're about to do
    const mapStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE rn > 1) AS to_merge,
        COUNT(DISTINCT ckey) FILTER (WHERE rn > 1) AS groups_with_dupes
      FROM merge_map
    `);
    console.log(`  Will merge ${mapStats.rows[0].to_merge} master_funds from ${mapStats.rows[0].groups_with_dupes} groups`);

    // 3b. Re-link all funds from duplicate master_funds to the canonical one
    const relinkResult = await client.query(`
      UPDATE funds f
      SET master_fund_id = mm.new_id
      FROM merge_map mm
      WHERE f.master_fund_id = mm.old_id
        AND mm.rn > 1
    `);
    console.log(`  Re-linked ${relinkResult.rowCount} funds to canonical master_funds`);

    // 3c. Delete the duplicate master_funds (not the winners)
    const deleteResult = await client.query(`
      DELETE FROM master_funds
      WHERE id IN (SELECT old_id FROM merge_map WHERE rn > 1)
    `);
    console.log(`  Deleted ${deleteResult.rowCount} duplicate master_funds`);

    // Drop temp table
    await client.query(`DROP TABLE merge_map`);

    // ── STEP 4: Fix any orphaned fund references ──
    console.log("\nStep 4: Fixing orphaned references...");
    const orphanFix = await client.query(`
      UPDATE funds f SET master_fund_id = NULL
      WHERE master_fund_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM master_funds mf WHERE mf.id = f.master_fund_id)
    `);
    console.log(`  Cleared ${orphanFix.rowCount} orphaned references`);

    // ── STEP 5: Re-link any unlinked funds ──
    if ((orphanFix.rowCount || 0) > 0) {
      console.log("\nStep 5: Re-linking unlinked funds...");

      // Try exact case-insensitive match first
      const relink1 = await client.query(`
        UPDATE funds f
        SET master_fund_id = mf.id
        FROM master_funds mf
        WHERE f.master_fund_id IS NULL
          AND canonical_fund_key(f.scheme_name) = canonical_fund_key(mf.strategy_name)
      `);
      console.log(`  Re-linked ${relink1.rowCount} via canonical key match`);

      // Check if any still unlinked
      const remaining = await client.query(`SELECT COUNT(*) AS cnt FROM funds WHERE master_fund_id IS NULL`);
      console.log(`  Still unlinked: ${remaining.rows[0].cnt}`);

      if (parseInt(remaining.rows[0].cnt) > 0) {
        // Create new master_funds for any that have no match
        const createResult = await client.query(`
          WITH new_families AS (
            SELECT
              canonical_fund_key(scheme_name) AS ckey,
              COUNT(*) AS cnt
            FROM funds
            WHERE master_fund_id IS NULL
              AND scheme_name IS NOT NULL
              AND LENGTH(scheme_name) > 5
            GROUP BY canonical_fund_key(scheme_name)
            HAVING LENGTH(canonical_fund_key(scheme_name)) >= 3
          )
          INSERT INTO master_funds (strategy_name, fund_house, variant_count)
          SELECT
            nf.ckey,
            SPLIT_PART(nf.ckey, ' ', 1),
            nf.cnt
          FROM new_families nf
          WHERE NOT EXISTS (
            SELECT 1 FROM master_funds mf
            WHERE canonical_fund_key(mf.strategy_name) = nf.ckey
          )
          RETURNING id
        `);
        console.log(`  Created ${createResult.rowCount} new master_funds for remaining`);

        // Link them
        const relink2 = await client.query(`
          UPDATE funds f
          SET master_fund_id = mf.id
          FROM master_funds mf
          WHERE f.master_fund_id IS NULL
            AND canonical_fund_key(f.scheme_name) = canonical_fund_key(mf.strategy_name)
        `);
        console.log(`  Linked ${relink2.rowCount} to new master_funds`);
      }
    } else {
      console.log("\nStep 5: No orphans — skipping");
    }

    // ── STEP 6: Update variant_count ──
    console.log("\nStep 6: Updating variant counts...");
    await client.query(`
      UPDATE master_funds mf SET
        variant_count = COALESCE((SELECT COUNT(*) FROM funds f WHERE f.master_fund_id = mf.id), 0),
        updated_at = NOW()
    `);

    // ── STEP 7: Fill missing categories ──
    console.log("Step 7: Filling missing categories...");
    await client.query(`
      UPDATE master_funds mf SET
        category = sub.cat,
        sub_category = sub.subcat
      FROM (
        SELECT DISTINCT ON (f.master_fund_id)
          f.master_fund_id,
          COALESCE(f.category, f.scheme_type) AS cat,
          f.sub_category AS subcat
        FROM funds f
        WHERE f.master_fund_id IS NOT NULL
          AND (f.category IS NOT NULL OR f.scheme_type IS NOT NULL)
        ORDER BY f.master_fund_id,
          CASE WHEN f.plan_type = 'Direct' AND f.option_type = 'Growth' THEN 0 ELSE 1 END
      ) sub
      WHERE mf.id = sub.master_fund_id
        AND (mf.category IS NULL OR mf.sub_category IS NULL)
    `);

    // ── STEP 8: Remove empty master_funds ──
    console.log("Step 8: Removing empty master_funds...");
    const emptyDel = await client.query(`DELETE FROM master_funds WHERE variant_count = 0`);
    console.log(`  Removed ${emptyDel.rowCount} empty master_funds`);

    await client.query("COMMIT");
    console.log("\nTransaction committed.");

    // ── FINAL STATS ──
    const after = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM funds) AS total_funds,
        (SELECT COUNT(master_fund_id) FROM funds) AS linked,
        (SELECT COUNT(*) - COUNT(master_fund_id) FROM funds) AS unlinked,
        (SELECT COUNT(*) FROM master_funds) AS total_masters,
        (SELECT COUNT(*) FROM master_funds WHERE variant_count = 1) AS singletons
    `);
    console.log("\nAFTER:", after.rows[0]);
    console.log(`  Reduction: ${before.rows[0].total_masters} → ${after.rows[0].total_masters} master_funds`);

    // Distribution
    const dist = await client.query(`
      SELECT
        CASE
          WHEN variant_count = 1 THEN '1 (singleton)'
          WHEN variant_count = 2 THEN '2'
          WHEN variant_count BETWEEN 3 AND 4 THEN '3-4 (typical)'
          WHEN variant_count BETWEEN 5 AND 8 THEN '5-8'
          WHEN variant_count BETWEEN 9 AND 16 THEN '9-16'
          WHEN variant_count >= 17 THEN '17+'
        END AS bucket,
        COUNT(*) AS families,
        SUM(variant_count) AS fund_rows
      FROM master_funds
      GROUP BY bucket
      ORDER BY MIN(variant_count)
    `);
    console.log("\nVariant distribution:");
    for (const row of dist.rows) {
      console.log(`  ${row.bucket}: ${row.families} families (${row.fund_rows} funds)`);
    }

    // Remaining singletons sample
    const singleSample = await client.query(`
      SELECT mf.strategy_name,
             (SELECT scheme_name FROM funds WHERE master_fund_id = mf.id LIMIT 1) AS sample
      FROM master_funds mf
      WHERE variant_count = 1
      ORDER BY strategy_name
      LIMIT 15
    `);
    if (singleSample.rows.length > 0) {
      const totalSingles = after.rows[0].singletons;
      console.log(`\nSingleton samples (${totalSingles} total):`);
      for (const s of singleSample.rows) {
        console.log(`  "${s.strategy_name}" → ${s.sample}`);
      }
    }

    // ── STEP 9: Refresh materialized view ──
    console.log("\nStep 9: Refreshing mv_unified_search...");
    await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search`);
    console.log("Done!");

    console.log("\n=== MERGE COMPLETE ===");

  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
