/**
 * Merge Duplicate Master Funds — Heavy Scrutiny Edition
 *
 * Problem: Many master_funds map to the same strategy but got separate rows due to:
 *   1. Case sensitivity (ALL CAPS vs Mixed Case)
 *   2. IDCW frequency variants (Daily/Monthly/Quarterly) not fully stripped
 *   3. Residual suffixes like "Payout", "Reinvestment", "Option", "Plan"
 *
 * Solution:
 *   - Normalize all strategy_names to a canonical lowercase form
 *   - Group master_funds by canonical name
 *   - Keep the one with the most variants (or lowest ID as tiebreaker)
 *   - Re-link all funds from duplicate master_funds to the canonical one
 *   - Delete the empty duplicates
 *   - Update variant_count
 *   - Refresh materialized view
 *
 * Run: npx tsx scripts/merge-duplicate-master-funds.ts
 */

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
});

/**
 * Ultra-aggressive name normalizer — strips everything that distinguishes
 * variants, leaving only the core strategy identity.
 * Case-insensitive, handles all known edge cases.
 */
function canonicalize(name: string): string {
  let s = name;

  // 1. Remove parentheticals: (Erstwhile...), (Formerly...), (Advisor...), (Segregated...)
  s = s.replace(/\s*\([^)]*\)/gi, "");

  // 2. Remove plan type: Direct, Regular (with optional "Plan" suffix)
  s = s.replace(/\s*-?\s*(Direct|Regular)\s*(Plan)?\s*/gi, " ");

  // 3. Remove ALL option/dividend types including frequency prefixes
  //    Handles: Daily IDCW, Monthly Dividend, Quarterly IDCW Payout, Annual IDCW Reinvestment, etc.
  s = s.replace(
    /\s*-?\s*(Annual|Half[\s-]*Yearly|Monthly|Quarterly|Weekly|Daily|Fortnightly)?\s*-?\s*(IDCW|Dividend)\s*(Option|Plan|Payout|Reinvestment|Reinvest)?\s*/gi,
    " "
  );

  // 4. Remove Growth, Bonus
  s = s.replace(/\s*-?\s*Growth\s*(Option|Plan)?\s*/gi, " ");
  s = s.replace(/\s*-?\s*Bonus\s*(Option)?\s*/gi, " ");

  // 5. Remove "Plan A", "Plan B", "Plan C" etc.
  s = s.replace(/\s*-?\s*Plan\s+[A-Z]\b/gi, " ");

  // 6. Remove "Institutional"
  s = s.replace(/\s*-?\s*Institutional\s*/gi, " ");

  // 7. Remove trailing "Option", "Plan", "Fund" suffixes that are orphaned after stripping
  s = s.replace(/\s*-?\s*Option\s*$/gi, "");
  s = s.replace(/\s*-?\s*Plan\s*$/gi, "");

  // 8. Remove "Payout", "Reinvestment" that might be standalone
  s = s.replace(/\s*-?\s*(Payout|Reinvestment|Reinvest)\s*/gi, " ");

  // 9. Clean up whitespace and dashes
  s = s.replace(/\s{2,}/g, " ").trim();
  s = s.replace(/\s*-\s*$/, "").trim();
  s = s.replace(/^\s*-\s*/, "").trim();
  s = s.replace(/\s*-\s*-\s*/g, " - ");

  // 10. Lowercase for case-insensitive grouping
  s = s.toLowerCase().trim();

  return s;
}

async function main() {
  const client = await pool.connect();

  try {
    console.log("=== Merge Duplicate Master Funds (Heavy Scrutiny) ===\n");

    // ── STEP 0: Stats before ──
    const before = await client.query(`
      SELECT COUNT(*) AS total_funds,
             COUNT(master_fund_id) AS linked,
             COUNT(*) - COUNT(master_fund_id) AS unlinked
      FROM funds
    `);
    const masterBefore = await client.query(`SELECT COUNT(*) AS total FROM master_funds`);
    console.log("BEFORE:");
    console.log(`  Funds: ${before.rows[0].total_funds} (${before.rows[0].linked} linked, ${before.rows[0].unlinked} unlinked)`);
    console.log(`  Master funds: ${masterBefore.rows[0].total}`);

    // ── STEP 1: Fetch all master_funds ──
    console.log("\nStep 1: Loading all master_funds...");
    const allMasters = await client.query(`
      SELECT id, strategy_name, fund_house, category, sub_category, variant_count
      FROM master_funds
      ORDER BY variant_count DESC, id ASC
    `);
    console.log(`  Loaded ${allMasters.rows.length} master_funds`);

    // ── STEP 2: Group by canonical name ──
    console.log("\nStep 2: Grouping by canonical name...");
    const groups: Record<string, typeof allMasters.rows> = {};

    for (const mf of allMasters.rows) {
      const canonical = canonicalize(mf.strategy_name);
      if (!canonical || canonical.length < 3) continue;
      if (!groups[canonical]) groups[canonical] = [];
      groups[canonical].push(mf);
    }

    // Find groups with duplicates (more than 1 master_fund per canonical name)
    const dupeGroups = Object.entries(groups).filter(([, members]) => members.length > 1);
    console.log(`  Unique canonical names: ${Object.keys(groups).length}`);
    console.log(`  Groups with duplicates: ${dupeGroups.length}`);
    console.log(`  Master funds to merge away: ${dupeGroups.reduce((sum, [, m]) => sum + m.length - 1, 0)}`);

    if (dupeGroups.length === 0) {
      console.log("\nNo duplicates found. Exiting.");
      return;
    }

    // ── STEP 3: Show sample merges ──
    console.log("\nStep 3: Sample merges (first 15):");
    for (const [canonical, members] of dupeGroups.slice(0, 15)) {
      const keeper = members[0]; // highest variant_count (sorted DESC above)
      const dupes = members.slice(1);
      console.log(`  "${canonical}"`);
      console.log(`    KEEP: id=${keeper.id} "${keeper.strategy_name}" (${keeper.variant_count} variants)`);
      for (const d of dupes) {
        console.log(`    MERGE: id=${d.id} "${d.strategy_name}" (${d.variant_count} variants)`);
      }
    }

    // ── STEP 4: Execute merges in a transaction ──
    console.log("\nStep 4: Merging in transaction...");
    await client.query("BEGIN");

    let totalRelinked = 0;
    let totalMerged = 0;

    for (const [, members] of dupeGroups) {
      // Keep the one with most variants; tiebreak by lowest ID
      const sorted = members.sort((a, b) => {
        if (b.variant_count !== a.variant_count) return b.variant_count - a.variant_count;
        return a.id - b.id;
      });
      const keeper = sorted[0];
      const dupeIds = sorted.slice(1).map((m) => m.id);

      if (dupeIds.length === 0) continue;

      // Re-link all funds from duplicates to the keeper
      const relink = await client.query(
        `UPDATE funds SET master_fund_id = $1 WHERE master_fund_id = ANY($2)`,
        [keeper.id, dupeIds]
      );
      totalRelinked += relink.rowCount || 0;

      // Update keeper's metadata: pick best available category/sub_category/fund_house
      if (!keeper.category || !keeper.sub_category || !keeper.fund_house) {
        const best = sorted.find(
          (m) => m.category && m.sub_category && m.fund_house
        );
        if (best && best.id !== keeper.id) {
          await client.query(
            `UPDATE master_funds SET
              category = COALESCE(category, $2),
              sub_category = COALESCE(sub_category, $3),
              fund_house = COALESCE(fund_house, $4)
            WHERE id = $1`,
            [keeper.id, best.category, best.sub_category, best.fund_house]
          );
        }
      }

      // Delete the duplicate master_funds
      await client.query(
        `DELETE FROM master_funds WHERE id = ANY($1)`,
        [dupeIds]
      );
      totalMerged += dupeIds.length;
    }

    console.log(`  Re-linked ${totalRelinked} funds to canonical master_funds`);
    console.log(`  Deleted ${totalMerged} duplicate master_funds`);

    // ── STEP 5: Also re-link any funds still pointing to non-existent master_funds ──
    console.log("\nStep 5: Checking for orphaned fund references...");
    const orphanFix = await client.query(`
      UPDATE funds f SET master_fund_id = NULL
      WHERE master_fund_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM master_funds mf WHERE mf.id = f.master_fund_id)
    `);
    console.log(`  Cleared ${orphanFix.rowCount} orphaned references`);

    // ── STEP 6: Re-link any newly unlinked funds using clean_strategy_name ──
    if ((orphanFix.rowCount || 0) > 0) {
      console.log("\nStep 6: Re-linking newly unlinked funds...");

      // First update the SQL function to be case-insensitive
      await client.query(`
        CREATE OR REPLACE FUNCTION clean_strategy_name_lower(scheme_name TEXT) RETURNS TEXT AS $$
        DECLARE
          result TEXT;
        BEGIN
          result := scheme_name;
          result := REGEXP_REPLACE(result, '\\s*\\([^)]*\\)', '', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*(Direct|Regular)\\s*(Plan)?\\s*', ' ', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*(Annual|Half\\s*Yearly|Monthly|Quarterly|Weekly|Daily|Fortnightly)?\\s*-?\\s*(IDCW|Dividend)\\s*(Option|Plan|Payout|Reinvestment|Reinvest)?\\s*', ' ', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*Growth\\s*(Option|Plan)?\\s*', ' ', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*Bonus\\s*(Option)?\\s*', ' ', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*Plan\\s+[A-Z]\\b', ' ', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*Option\\s*$', '', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*Plan\\s*$', '', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*Institutional\\s*', ' ', 'gi');
          result := REGEXP_REPLACE(result, '\\s*-?\\s*(Payout|Reinvestment|Reinvest)\\s*', ' ', 'gi');
          result := REGEXP_REPLACE(result, '\\s{2,}', ' ', 'g');
          result := REGEXP_REPLACE(result, '\\s*-\\s*$', '', 'g');
          result := REGEXP_REPLACE(result, '^\\s*-\\s*', '', 'g');
          result := REGEXP_REPLACE(result, '\\s*-\\s*-\\s*', ' - ', 'g');
          result := LOWER(TRIM(result));
          RETURN result;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
      `);

      // Link unlinked funds to existing master_funds by case-insensitive match
      const relinkResult = await client.query(`
        UPDATE funds f
        SET master_fund_id = mf.id
        FROM master_funds mf
        WHERE f.master_fund_id IS NULL
          AND LOWER(mf.strategy_name) = clean_strategy_name_lower(f.scheme_name)
      `);
      console.log(`  Re-linked ${relinkResult.rowCount} funds via case-insensitive match`);

      // For any still unlinked, try matching via the lowercase canonical
      const stillUnlinked = await client.query(`
        SELECT COUNT(*) AS cnt FROM funds WHERE master_fund_id IS NULL
      `);
      console.log(`  Still unlinked: ${stillUnlinked.rows[0].cnt}`);

      if (parseInt(stillUnlinked.rows[0].cnt) > 0) {
        // Create master_funds for any remaining unlinked
        console.log("  Creating master_funds for remaining unlinked...");
        const createResult = await client.query(`
          WITH new_families AS (
            SELECT
              clean_strategy_name_lower(scheme_name) AS clean_name,
              COUNT(*) AS cnt
            FROM funds
            WHERE master_fund_id IS NULL
              AND scheme_name IS NOT NULL
              AND LENGTH(scheme_name) > 5
            GROUP BY clean_strategy_name_lower(scheme_name)
            HAVING LENGTH(clean_strategy_name_lower(scheme_name)) >= 3
          )
          INSERT INTO master_funds (strategy_name, fund_house, category, sub_category, variant_count)
          SELECT
            nf.clean_name,
            SPLIT_PART(nf.clean_name, ' ', 1),
            NULL, NULL, nf.cnt
          FROM new_families nf
          WHERE NOT EXISTS (
            SELECT 1 FROM master_funds mf WHERE LOWER(mf.strategy_name) = nf.clean_name
          )
          RETURNING id
        `);
        console.log(`  Created ${createResult.rowCount} new master_funds`);

        // Link those
        const linkNew = await client.query(`
          UPDATE funds f
          SET master_fund_id = mf.id
          FROM master_funds mf
          WHERE f.master_fund_id IS NULL
            AND LOWER(mf.strategy_name) = clean_strategy_name_lower(f.scheme_name)
        `);
        console.log(`  Linked ${linkNew.rowCount} funds to new master_funds`);
      }
    } else {
      console.log("\nStep 6: No orphaned references — skipping re-link");
    }

    // ── STEP 7: Update variant_count on all master_funds ──
    console.log("\nStep 7: Updating variant counts...");
    await client.query(`
      UPDATE master_funds mf SET
        variant_count = COALESCE((SELECT COUNT(*) FROM funds f WHERE f.master_fund_id = mf.id), 0),
        updated_at = NOW()
    `);

    // ── STEP 8: Fill in missing category/sub_category ──
    console.log("Step 8: Filling missing categories...");
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

    // ── STEP 9: Clean up empty master_funds ──
    console.log("Step 9: Removing empty master_funds...");
    const cleanup = await client.query(`
      DELETE FROM master_funds WHERE variant_count = 0
    `);
    console.log(`  Removed ${cleanup.rowCount} empty master_funds`);

    await client.query("COMMIT");
    console.log("\nTransaction committed.");

    // ── STEP 10: Final stats ──
    const after = await client.query(`
      SELECT COUNT(*) AS total_funds,
             COUNT(master_fund_id) AS linked,
             COUNT(*) - COUNT(master_fund_id) AS unlinked
      FROM funds
    `);
    const masterAfter = await client.query(`SELECT COUNT(*) AS total FROM master_funds`);
    const dist = await client.query(`
      SELECT
        CASE
          WHEN variant_count = 1 THEN '1 (orphan)'
          WHEN variant_count = 2 THEN '2'
          WHEN variant_count BETWEEN 3 AND 4 THEN '3-4'
          WHEN variant_count BETWEEN 5 AND 8 THEN '5-8'
          WHEN variant_count >= 9 THEN '9+'
        END AS bucket,
        COUNT(*) AS master_funds,
        SUM(variant_count) AS total_fund_rows
      FROM master_funds
      GROUP BY bucket
      ORDER BY MIN(variant_count)
    `);

    console.log("\nAFTER:");
    console.log(`  Funds: ${after.rows[0].total_funds} (${after.rows[0].linked} linked, ${after.rows[0].unlinked} unlinked)`);
    console.log(`  Master funds: ${masterAfter.rows[0].total} (was ${masterBefore.rows[0].total})`);
    console.log(`  Reduction: ${masterBefore.rows[0].total - masterAfter.rows[0].total} master_funds merged/removed`);
    console.log("\n  Variant distribution:");
    for (const row of dist.rows) {
      console.log(`    ${row.bucket}: ${row.master_funds} families (${row.total_fund_rows} funds)`);
    }

    // Show remaining singletons sample
    const singletons = await client.query(`
      SELECT mf.id, mf.strategy_name, mf.variant_count,
             (SELECT scheme_name FROM funds WHERE master_fund_id = mf.id LIMIT 1) AS sample_scheme
      FROM master_funds mf
      WHERE mf.variant_count = 1
      ORDER BY mf.strategy_name
      LIMIT 20
    `);
    if (singletons.rows.length > 0) {
      console.log("\n  Sample singletons (variant_count=1):");
      for (const s of singletons.rows) {
        console.log(`    id=${s.id} "${s.strategy_name}" → ${s.sample_scheme}`);
      }
    }

    // Show any remaining unlinked
    const remaining = await client.query(`
      SELECT scheme_name FROM funds WHERE master_fund_id IS NULL LIMIT 10
    `);
    if (remaining.rows.length > 0) {
      const totalUnlinked = await client.query(`SELECT COUNT(*) AS cnt FROM funds WHERE master_fund_id IS NULL`);
      console.log(`\n  Remaining unlinked (${totalUnlinked.rows[0].cnt} total):`);
      for (const r of remaining.rows) {
        console.log(`    ${r.scheme_name}`);
      }
    } else {
      console.log("\n  ✓ All funds are linked!");
    }

    // ── STEP 11: Refresh materialized view ──
    console.log("\nStep 11: Refreshing mv_unified_search...");
    await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search`);
    console.log("  Done!");

    console.log("\n=== MERGE COMPLETE ===");

  } catch (e) {
    await client.query("ROLLBACK");
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
