/**
 * Fix Fund Grouping — Batch SQL approach (no per-row round trips)
 * Run: npx tsx scripts/fix-fund-grouping-batch.ts
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
    console.log("=== Fund Grouping Fix (Batch) ===\n");

    // Stats before
    const before = await client.query(`
      SELECT COUNT(*) AS total,
             COUNT(master_fund_id) AS linked,
             COUNT(*) - COUNT(master_fund_id) AS unlinked
      FROM funds
    `);
    console.log("BEFORE:", before.rows[0]);

    // Step 1: Fix null plan_type and option_type
    console.log("\nStep 1: Fixing plan_type and option_type...");
    await client.query(`
      UPDATE funds SET
        plan_type = CASE
          WHEN scheme_name ILIKE '%Direct%' THEN 'Direct'
          WHEN scheme_name ILIKE '%Regular%' THEN 'Regular'
          ELSE 'Unknown'
        END
      WHERE plan_type IS NULL OR plan_type = ''
    `);
    await client.query(`
      UPDATE funds SET
        option_type = CASE
          WHEN scheme_name ILIKE '%Growth%' THEN 'Growth'
          WHEN scheme_name ILIKE '%IDCW%' OR scheme_name ILIKE '%Dividend%' THEN 'IDCW'
          WHEN scheme_name ILIKE '%Bonus%' THEN 'Bonus'
          ELSE 'Unknown'
        END
      WHERE option_type IS NULL OR option_type = ''
    `);
    console.log("Done.");

    // Step 2: Create improved cleaning function in SQL
    console.log("\nStep 2: Creating improved name cleaning function...");
    await client.query(`
      CREATE OR REPLACE FUNCTION clean_strategy_name(scheme_name TEXT) RETURNS TEXT AS $$
      DECLARE
        result TEXT;
      BEGIN
        result := scheme_name;

        -- Remove parentheticals
        result := REGEXP_REPLACE(result, '\\s*\\(Erstwhile[^)]*\\)', '', 'gi');
        result := REGEXP_REPLACE(result, '\\s*\\(Formerly[^)]*\\)', '', 'gi');
        result := REGEXP_REPLACE(result, '\\s*\\(Advisor[^)]*\\)', '', 'gi');

        -- Remove plan type
        result := REGEXP_REPLACE(result, '\\s*-?\\s*(Direct|Regular)\\s*(Plan)?\\s*', ' ', 'gi');

        -- Remove option types with frequency prefixes
        result := REGEXP_REPLACE(result, '\\s*-?\\s*(Annual|Half\\s*Yearly|Monthly|Quarterly|Weekly|Daily)?\\s*(IDCW|Dividend)\\s*(Option|Plan|Payout|Reinvestment)?\\s*', ' ', 'gi');
        result := REGEXP_REPLACE(result, '\\s*-?\\s*Growth\\s*(Option|Plan)?\\s*', ' ', 'gi');
        result := REGEXP_REPLACE(result, '\\s*-?\\s*Bonus\\s*(Option)?\\s*', ' ', 'gi');

        -- Remove "Plan A", "Plan B", etc.
        result := REGEXP_REPLACE(result, '\\s*-?\\s*Plan\\s+[A-Z]\\b', ' ', 'gi');

        -- Remove trailing plan/option
        result := REGEXP_REPLACE(result, '\\s*-?\\s*Option\\s*$', '', 'gi');
        result := REGEXP_REPLACE(result, '\\s*-?\\s*Plan\\s*$', '', 'gi');

        -- Remove Institutional
        result := REGEXP_REPLACE(result, '\\s*-?\\s*Institutional\\s*', ' ', 'gi');

        -- Clean up whitespace and dashes
        result := REGEXP_REPLACE(result, '\\s{2,}', ' ', 'g');
        result := REGEXP_REPLACE(result, '\\s*-\\s*$', '', 'g');
        result := REGEXP_REPLACE(result, '^\\s*-\\s*', '', 'g');
        result := REGEXP_REPLACE(result, '\\s*-\\s*-\\s*', ' - ', 'g');
        result := TRIM(result);

        RETURN result;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    console.log("Done.");

    // Step 3: Insert new master_funds for any clean names not yet covered
    console.log("\nStep 3: Inserting new master_fund families...");
    const insertResult = await client.query(`
      WITH new_families AS (
        SELECT
          clean_strategy_name(scheme_name) AS clean_name,
          COUNT(*) AS cnt
        FROM funds
        WHERE master_fund_id IS NULL
          AND scheme_name IS NOT NULL
          AND LENGTH(scheme_name) > 5
        GROUP BY clean_strategy_name(scheme_name)
        HAVING LENGTH(clean_strategy_name(scheme_name)) >= 3
      )
      INSERT INTO master_funds (strategy_name, fund_house, category, sub_category, variant_count)
      SELECT
        nf.clean_name,
        CASE
          WHEN nf.clean_name ILIKE 'Aditya Birla%'     THEN 'Aditya Birla Sun Life'
          WHEN nf.clean_name ILIKE 'ICICI Prud%'        THEN 'ICICI Prudential'
          WHEN nf.clean_name ILIKE 'Nippon India%'      THEN 'Nippon India'
          WHEN nf.clean_name ILIKE 'Franklin%'          THEN 'Franklin Templeton'
          WHEN nf.clean_name ILIKE 'Kotak%'             THEN 'Kotak Mahindra'
          WHEN nf.clean_name ILIKE 'Tata %'             THEN 'Tata'
          WHEN nf.clean_name ILIKE 'HDFC %'             THEN 'HDFC'
          WHEN nf.clean_name ILIKE 'SBI %'              THEN 'SBI'
          WHEN nf.clean_name ILIKE 'Axis %'             THEN 'Axis'
          WHEN nf.clean_name ILIKE 'UTI %'              THEN 'UTI'
          WHEN nf.clean_name ILIKE 'DSP %'              THEN 'DSP'
          WHEN nf.clean_name ILIKE 'Mirae %'            THEN 'Mirae Asset'
          WHEN nf.clean_name ILIKE 'Sundaram %'         THEN 'Sundaram'
          WHEN nf.clean_name ILIKE 'Invesco %'          THEN 'Invesco'
          WHEN nf.clean_name ILIKE 'Motilal %'          THEN 'Motilal Oswal'
          WHEN nf.clean_name ILIKE 'Quant %'            THEN 'Quant'
          WHEN nf.clean_name ILIKE 'Canara %'           THEN 'Canara Robeco'
          WHEN nf.clean_name ILIKE 'Bandhan %'          THEN 'Bandhan'
          WHEN nf.clean_name ILIKE 'Bajaj %'            THEN 'Bajaj Finserv'
          WHEN nf.clean_name ILIKE 'Edelweiss %'        THEN 'Edelweiss'
          WHEN nf.clean_name ILIKE 'Union %'            THEN 'Union'
          WHEN nf.clean_name ILIKE 'Mahindra %'         THEN 'Mahindra Manulife'
          WHEN nf.clean_name ILIKE 'PPFAS%'             THEN 'PPFAS'
          WHEN nf.clean_name ILIKE 'Parag Parikh%'      THEN 'PPFAS'
          WHEN nf.clean_name ILIKE 'PGIM %'             THEN 'PGIM India'
          WHEN nf.clean_name ILIKE 'Baroda %'           THEN 'Baroda BNP Paribas'
          WHEN nf.clean_name ILIKE 'HSBC %'             THEN 'HSBC'
          WHEN nf.clean_name ILIKE 'Angel One%'         THEN 'Angel One'
          WHEN nf.clean_name ILIKE 'LIC %'              THEN 'LIC'
          WHEN nf.clean_name ILIKE 'JM %'               THEN 'JM Financial'
          WHEN nf.clean_name ILIKE 'Groww %'            THEN 'Groww'
          WHEN nf.clean_name ILIKE 'Navi %'             THEN 'Navi'
          WHEN nf.clean_name ILIKE 'Samco %'            THEN 'Samco'
          WHEN nf.clean_name ILIKE 'Shriram %'          THEN 'Shriram'
          WHEN nf.clean_name ILIKE 'WhiteOak%'          THEN 'WhiteOak'
          WHEN nf.clean_name ILIKE '360 ONE%'           THEN '360 ONE'
          WHEN nf.clean_name ILIKE 'NJ %'               THEN 'NJ'
          WHEN nf.clean_name ILIKE 'Old Bridge%'        THEN 'Old Bridge'
          WHEN nf.clean_name ILIKE 'Quantum%'           THEN 'Quantum'
          WHEN nf.clean_name ILIKE 'Helios%'            THEN 'Helios'
          WHEN nf.clean_name ILIKE 'Bank of India%'     THEN 'Bank of India'
          WHEN nf.clean_name ILIKE 'ITI %'              THEN 'ITI'
          ELSE SPLIT_PART(nf.clean_name, ' ', 1)
        END,
        NULL,
        NULL,
        nf.cnt
      FROM new_families nf
      WHERE NOT EXISTS (
        SELECT 1 FROM master_funds mf WHERE mf.strategy_name = nf.clean_name
      )
      RETURNING id
    `);
    console.log(`Created ${insertResult.rowCount} new master_fund families.`);

    // Step 4: Link all unlinked funds to their master_fund via clean name
    console.log("\nStep 4: Linking unlinked funds to master_funds...");
    const linkResult = await client.query(`
      UPDATE funds f
      SET master_fund_id = mf.id
      FROM master_funds mf
      WHERE f.master_fund_id IS NULL
        AND mf.strategy_name = clean_strategy_name(f.scheme_name)
    `);
    console.log(`Linked ${linkResult.rowCount} funds.`);

    // Step 5: Also re-link any previously linked funds that had bad master_fund_id
    // (their clean name might have changed with the improved function)
    console.log("\nStep 5: Checking if any already-linked funds need re-linking...");
    const relinkResult = await client.query(`
      UPDATE funds f
      SET master_fund_id = mf.id
      FROM master_funds mf
      WHERE f.master_fund_id IS NOT NULL
        AND mf.strategy_name = clean_strategy_name(f.scheme_name)
        AND f.master_fund_id != mf.id
    `);
    console.log(`Re-linked ${relinkResult.rowCount} funds to correct families.`);

    // Step 6: Update variant_count on all master_funds
    console.log("\nStep 6: Updating variant counts...");
    await client.query(`
      UPDATE master_funds mf SET
        variant_count = COALESCE((SELECT COUNT(*) FROM funds f WHERE f.master_fund_id = mf.id), 0),
        updated_at = NOW()
    `);
    console.log("Done.");

    // Step 7: Fill in category/sub_category on master_funds that are missing them
    console.log("\nStep 7: Filling missing categories on master_funds...");
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
    console.log("Done.");

    // Final stats
    const after = await client.query(`
      SELECT COUNT(*) AS total,
             COUNT(master_fund_id) AS linked,
             COUNT(*) - COUNT(master_fund_id) AS unlinked
      FROM funds
    `);
    console.log("\nAFTER:", after.rows[0]);

    const families = await client.query(`
      SELECT COUNT(*) AS active_families FROM master_funds WHERE variant_count > 0
    `);
    console.log("Active families:", families.rows[0]);

    // Show remaining unlinked
    const remaining = await client.query(`
      SELECT scheme_name, plan_type, option_type
      FROM funds WHERE master_fund_id IS NULL
      ORDER BY scheme_name
      LIMIT 15
    `);
    if (remaining.rows.length > 0) {
      console.log(`\nRemaining unlinked (${(await client.query('SELECT COUNT(*) FROM funds WHERE master_fund_id IS NULL')).rows[0].count} total):`);
      remaining.rows.forEach(r => console.log(`  ${r.scheme_name} | ${r.plan_type} | ${r.option_type}`));
    } else {
      console.log("\nAll funds are linked!");
    }

    // Step 8: Refresh materialized view
    console.log("\nStep 8: Refreshing mv_unified_search...");
    await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search`);
    console.log("mv_unified_search refreshed successfully!");

    console.log("\n=== DONE ===");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
