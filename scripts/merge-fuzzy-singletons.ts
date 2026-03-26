/**
 * Merge Fuzzy Singletons — Second pass using trigram similarity
 *
 * Catches: spacing differences, typos, case mismatches, minor wording variations
 * that prevent exact canonical_fund_key() matches.
 *
 * Strategy:
 *   1. For each singleton (variant_count=1), find the best matching multi-variant master_fund
 *      using pg_trgm similarity on the canonical key
 *   2. Only merge if similarity > 0.85 (very high threshold to avoid false positives)
 *   3. Re-link funds and delete merged master_funds
 *
 * Run: npx tsx scripts/merge-fuzzy-singletons.ts
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
    console.log("=== Fuzzy Singleton Merge ===\n");

    // Ensure pg_trgm extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // Ensure canonical_fund_key function exists
    const fnCheck = await client.query(`
      SELECT 1 FROM pg_proc WHERE proname = 'canonical_fund_key' LIMIT 1
    `);
    if (fnCheck.rows.length === 0) {
      console.log("ERROR: canonical_fund_key function not found. Run merge-master-funds-batch.ts first.");
      return;
    }

    // Stats before
    const before = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM master_funds) AS total_masters,
        (SELECT COUNT(*) FROM master_funds WHERE variant_count = 1) AS singletons,
        (SELECT COUNT(*) FROM master_funds WHERE variant_count > 1) AS multi_variant
    `);
    console.log("BEFORE:", before.rows[0]);

    // ── PASS 1: Merge singletons into multi-variant families via fuzzy match ──
    console.log("\nPass 1: Fuzzy matching singletons → multi-variant families (similarity > 0.85)...");

    // Build mapping: for each singleton, find best multi-variant match
    const fuzzyMap = await client.query(`
      WITH singletons AS (
        SELECT id, strategy_name, canonical_fund_key(strategy_name) AS ckey
        FROM master_funds
        WHERE variant_count = 1
          AND LENGTH(canonical_fund_key(strategy_name)) >= 5
      ),
      multis AS (
        SELECT id, strategy_name, canonical_fund_key(strategy_name) AS ckey
        FROM master_funds
        WHERE variant_count > 1
          AND LENGTH(canonical_fund_key(strategy_name)) >= 5
      ),
      best_match AS (
        SELECT DISTINCT ON (s.id)
          s.id AS singleton_id,
          s.strategy_name AS singleton_name,
          s.ckey AS singleton_key,
          m.id AS target_id,
          m.strategy_name AS target_name,
          m.ckey AS target_key,
          similarity(s.ckey, m.ckey) AS sim
        FROM singletons s
        CROSS JOIN LATERAL (
          SELECT m2.id, m2.strategy_name, m2.ckey
          FROM multis m2
          WHERE m2.ckey % s.ckey  -- trigram index filter
          ORDER BY similarity(s.ckey, m2.ckey) DESC
          LIMIT 1
        ) m
        WHERE similarity(s.ckey, m.ckey) > 0.85
        ORDER BY s.id, similarity(s.ckey, m.ckey) DESC
      )
      SELECT * FROM best_match
      ORDER BY sim DESC
    `);

    console.log(`  Found ${fuzzyMap.rows.length} fuzzy matches`);

    // Show samples
    console.log("\n  Top 20 fuzzy matches:");
    for (const row of fuzzyMap.rows.slice(0, 20)) {
      console.log(`    [${(row.sim * 100).toFixed(0)}%] "${row.singleton_name}" → "${row.target_name}" (id ${row.target_id})`);
    }

    if (fuzzyMap.rows.length > 0) {
      await client.query("BEGIN");

      // Re-link funds from singletons to their targets
      for (const row of fuzzyMap.rows) {
        await client.query(
          `UPDATE funds SET master_fund_id = $1 WHERE master_fund_id = $2`,
          [row.target_id, row.singleton_id]
        );
      }

      const singletonIds = fuzzyMap.rows.map(r => r.singleton_id);

      // Delete merged singletons
      await client.query(
        `DELETE FROM master_funds WHERE id = ANY($1)`,
        [singletonIds]
      );
      console.log(`\n  Merged ${singletonIds.length} singletons into existing families`);

      await client.query("COMMIT");
    }

    // ── PASS 2: Merge remaining singletons among themselves ──
    console.log("\nPass 2: Merging singletons with each other (similarity > 0.85)...");

    const selfMerge = await client.query(`
      WITH singletons AS (
        SELECT id, strategy_name, canonical_fund_key(strategy_name) AS ckey
        FROM master_funds
        WHERE variant_count = 1
          AND LENGTH(canonical_fund_key(strategy_name)) >= 5
      ),
      pairs AS (
        SELECT
          s1.id AS id1, s1.strategy_name AS name1, s1.ckey AS key1,
          s2.id AS id2, s2.strategy_name AS name2, s2.ckey AS key2,
          similarity(s1.ckey, s2.ckey) AS sim
        FROM singletons s1
        JOIN singletons s2 ON s1.id < s2.id AND s1.ckey % s2.ckey
        WHERE similarity(s1.ckey, s2.ckey) > 0.85
      )
      SELECT * FROM pairs ORDER BY sim DESC
    `);

    console.log(`  Found ${selfMerge.rows.length} singleton pairs`);

    if (selfMerge.rows.length > 0) {
      // Show samples
      console.log("\n  Top 20 pairs:");
      for (const row of selfMerge.rows.slice(0, 20)) {
        console.log(`    [${(row.sim * 100).toFixed(0)}%] "${row.name1}" ↔ "${row.name2}"`);
      }

      // Build union-find to group transitive matches
      const parent: Record<number, number> = {};
      function find(x: number): number {
        if (!(x in parent)) parent[x] = x;
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
      }
      function union(a: number, b: number) {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); // keep lower ID
      }

      for (const row of selfMerge.rows) {
        union(row.id1, row.id2);
      }

      // Group by root
      const groups: Record<number, number[]> = {};
      const allIds = new Set<number>();
      for (const row of selfMerge.rows) {
        allIds.add(row.id1);
        allIds.add(row.id2);
      }
      for (const id of allIds) {
        const root = find(id);
        if (!groups[root]) groups[root] = [];
        if (!groups[root].includes(id)) groups[root].push(id);
      }

      // For each group, keep the root, merge the rest
      await client.query("BEGIN");
      let mergedCount = 0;

      for (const [rootStr, members] of Object.entries(groups)) {
        const root = parseInt(rootStr);
        const toMerge = members.filter(id => id !== root);
        if (toMerge.length === 0) continue;

        // Re-link funds
        await client.query(
          `UPDATE funds SET master_fund_id = $1 WHERE master_fund_id = ANY($2)`,
          [root, toMerge]
        );

        // Delete merged
        await client.query(
          `DELETE FROM master_funds WHERE id = ANY($1)`,
          [toMerge]
        );
        mergedCount += toMerge.length;
      }

      await client.query("COMMIT");
      console.log(`\n  Merged ${mergedCount} singletons into ${Object.keys(groups).length} groups`);
    }

    // ── STEP 3: Update variant counts ──
    console.log("\nStep 3: Updating variant counts...");
    await client.query(`
      UPDATE master_funds mf SET
        variant_count = COALESCE((SELECT COUNT(*) FROM funds f WHERE f.master_fund_id = mf.id), 0),
        updated_at = NOW()
    `);

    // Remove empties
    const emptyDel = await client.query(`DELETE FROM master_funds WHERE variant_count = 0`);
    if ((emptyDel.rowCount || 0) > 0) console.log(`  Removed ${emptyDel.rowCount} empty master_funds`);

    // ── FINAL STATS ──
    const after = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM master_funds) AS total_masters,
        (SELECT COUNT(*) FROM master_funds WHERE variant_count = 1) AS singletons,
        (SELECT COUNT(*) FROM master_funds WHERE variant_count > 1) AS multi_variant,
        (SELECT COUNT(*) FROM funds WHERE master_fund_id IS NULL) AS unlinked
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
          WHEN variant_count >= 9 THEN '9+'
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

    // Remaining singletons — categorize them
    const singleCats = await client.query(`
      SELECT
        CASE
          WHEN f.scheme_name ILIKE '%ETF%' THEN 'ETF'
          WHEN f.scheme_name ILIKE '%Fixed Term%' OR f.scheme_name ILIKE '%FMP%' OR f.scheme_name ILIKE '%Interval%' THEN 'FMP/Fixed Term'
          WHEN f.scheme_name ILIKE '%Segregated%' THEN 'Segregated Portfolio'
          WHEN f.scheme_name ILIKE '%Series%' THEN 'Series Fund'
          WHEN f.scheme_name ILIKE '%Target Maturity%' OR f.scheme_name ILIKE '%Maturity Date%' THEN 'Target Maturity'
          WHEN f.scheme_name ILIKE '%Index Fund%' OR f.scheme_name ILIKE '%Nifty%' OR f.scheme_name ILIKE '%Sensex%' THEN 'Index Fund'
          ELSE 'Other'
        END AS category,
        COUNT(*) AS cnt
      FROM master_funds mf
      JOIN funds f ON f.master_fund_id = mf.id
      WHERE mf.variant_count = 1
      GROUP BY category
      ORDER BY cnt DESC
    `);
    console.log("\nSingleton breakdown by type:");
    for (const row of singleCats.rows) {
      console.log(`  ${row.category}: ${row.cnt}`);
    }

    // Refresh MV
    console.log("\nRefreshing mv_unified_search...");
    await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search`);
    console.log("Done!");

    console.log("\n=== FUZZY MERGE COMPLETE ===");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
