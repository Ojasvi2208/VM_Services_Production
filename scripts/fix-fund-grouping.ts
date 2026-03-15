/**
 * Fix Fund Grouping — Re-link all 2,700+ unlinked funds to master_funds
 *
 * Problems solved:
 * 1. "Plan B", "Plan A" suffixes not stripped
 * 2. "Bonus Option" not stripped
 * 3. ETFs without plan/option type
 * 4. FMPs and serial funds with parenthetical details
 * 5. "Annual IDCW", "Half Yearly IDCW", "Monthly IDCW" variations
 * 6. Missing plan_type / option_type columns
 *
 * Run: npx tsx scripts/fix-fund-grouping.ts
 */

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    "postgresql://postgres:zZGzhpULOgKqXvnnutWEjCengioSheMD@turntable.proxy.rlwy.net:19665/railway",
});

// ── Canonical name cleaner — matches the SQL regex but handles more edge cases ──
function cleanStrategyName(schemeName: string): string {
  let name = schemeName;

  // Remove "Erstwhile", "Formerly", "Advisor" parentheticals
  name = name.replace(/\s*\(Erstwhile[^)]*\)/gi, "");
  name = name.replace(/\s*\(Formerly[^)]*\)/gi, "");
  name = name.replace(/\s*\(Advisor[^)]*\)/gi, "");

  // Remove plan type: Direct Plan, Regular Plan, - Direct, - Regular
  // Also handle "Plan A", "Plan B", "Plan C" which are sub-variants
  name = name.replace(/\s*-?\s*(Direct|Regular)\s*(Plan)?\s*/gi, " ");

  // Remove option types: Growth, IDCW, Dividend + variants
  // Handle "Annual IDCW", "Half Yearly IDCW", "Monthly IDCW", "Quarterly IDCW"
  name = name.replace(
    /\s*-?\s*(Annual|Half\s*Yearly|Monthly|Quarterly|Weekly|Daily)?\s*(IDCW|Dividend)\s*(Option|Plan|Payout|Reinvestment)?\s*/gi,
    " "
  );
  name = name.replace(/\s*-?\s*Growth\s*(Option|Plan)?\s*/gi, " ");
  name = name.replace(/\s*-?\s*Bonus\s*(Option)?\s*/gi, " ");

  // Remove "Plan A", "Plan B", "Plan C" suffixes
  name = name.replace(/\s*-?\s*Plan\s+[A-Z]\b/gi, " ");

  // Remove trailing "- Option", "- Plan"
  name = name.replace(/\s*-?\s*Option\s*$/gi, "");
  name = name.replace(/\s*-?\s*Plan\s*$/gi, "");

  // Remove "Institutional" tag
  name = name.replace(/\s*-?\s*Institutional\s*/gi, " ");

  // Collapse multiple spaces and trim
  name = name.replace(/\s{2,}/g, " ").trim();

  // Remove trailing dashes
  name = name.replace(/\s*-\s*$/, "").trim();
  // Remove leading dashes
  name = name.replace(/^\s*-\s*/, "").trim();
  // Remove double dashes
  name = name.replace(/\s*-\s*-\s*/g, " - ");

  return name;
}

// ── Detect plan type from scheme name ──
function detectPlanType(name: string): string {
  if (/\bDirect\b/i.test(name)) return "Direct";
  if (/\bRegular\b/i.test(name)) return "Regular";
  return "Unknown";
}

// ── Detect option type from scheme name ──
function detectOptionType(name: string): string {
  if (/\bGrowth\b/i.test(name)) return "Growth";
  if (/\bIDCW\b/i.test(name) || /\bDividend\b/i.test(name)) return "IDCW";
  if (/\bBonus\b/i.test(name)) return "Bonus";
  return "Unknown";
}

// ── Extract fund house ──
function extractFundHouse(name: string): string {
  const u = name.toUpperCase();
  const map: [RegExp, string][] = [
    [/^ADITYA BIRLA/i, "Aditya Birla Sun Life"],
    [/^ICICI PRUD/i, "ICICI Prudential"],
    [/^NIPPON INDIA/i, "Nippon India"],
    [/^FRANKLIN/i, "Franklin Templeton"],
    [/^KOTAK/i, "Kotak Mahindra"],
    [/^TATA\s/i, "Tata"],
    [/^HDFC\s/i, "HDFC"],
    [/^SBI\s/i, "SBI"],
    [/^AXIS\s/i, "Axis"],
    [/^UTI\s/i, "UTI"],
    [/^DSP\s/i, "DSP"],
    [/^MIRAE\s/i, "Mirae Asset"],
    [/^SUNDARAM\s/i, "Sundaram"],
    [/^INVESCO\s/i, "Invesco"],
    [/^MOTILAL\s/i, "Motilal Oswal"],
    [/^QUANT\s/i, "Quant"],
    [/^CANARA\s/i, "Canara Robeco"],
    [/^BANDHAN\s/i, "Bandhan"],
    [/^BAJAJ\s/i, "Bajaj Finserv"],
    [/^EDELWEISS\s/i, "Edelweiss"],
    [/^UNION\s/i, "Union"],
    [/^MAHINDRA\s/i, "Mahindra Manulife"],
    [/^PPFAS/i, "PPFAS"],
    [/^PARAG PARIKH/i, "PPFAS"],
    [/^PGIM\s/i, "PGIM India"],
    [/^BARODA\s/i, "Baroda BNP Paribas"],
    [/^HSBC\s/i, "HSBC"],
    [/^ITI\s/i, "ITI"],
    [/^WHITEOAK/i, "WhiteOak"],
    [/^LIC\s/i, "LIC"],
    [/^JM\s/i, "JM Financial"],
    [/^GROWW\s/i, "Groww"],
    [/^360 ONE/i, "360 ONE"],
    [/^NJ\s/i, "NJ"],
    [/^ANGEL ONE/i, "Angel One"],
    [/^BANK OF INDIA/i, "Bank of India"],
    [/^BOI\s/i, "Bank of India"],
    [/^SAMCO\s/i, "Samco"],
    [/^SHRIRAM\s/i, "Shriram"],
    [/^TRUSTMF/i, "Trust"],
    [/^NAVI\s/i, "Navi"],
    [/^ZERODHA/i, "Zerodha"],
    [/^OLD BRIDGE/i, "Old Bridge"],
    [/^QUANTUM/i, "Quantum"],
    [/^HELIOS/i, "Helios"],
    [/^WOC/i, "WhiteOak"],
  ];
  for (const [re, house] of map) {
    if (re.test(name)) return house;
  }
  return name.split(" ")[0];
}

async function main() {
  const client = await pool.connect();

  try {
    console.log("=== Fund Grouping Fix Script ===\n");

    // Step 1: Get stats
    const before = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(master_fund_id) AS linked,
        COUNT(*) - COUNT(master_fund_id) AS unlinked
      FROM funds
    `);
    console.log("BEFORE:", before.rows[0]);

    // Step 2: Fix plan_type and option_type for ALL funds with NULL or empty values
    const planFixResult = await client.query(`
      UPDATE funds SET
        plan_type = CASE
          WHEN scheme_name ILIKE '%Direct%' THEN 'Direct'
          WHEN scheme_name ILIKE '%Regular%' THEN 'Regular'
          ELSE 'Unknown'
        END
      WHERE plan_type IS NULL OR plan_type = ''
    `);
    console.log(`\nFixed plan_type for ${planFixResult.rowCount} funds`);

    const optionFixResult = await client.query(`
      UPDATE funds SET
        option_type = CASE
          WHEN scheme_name ILIKE '%Growth%' THEN 'Growth'
          WHEN scheme_name ILIKE '%IDCW%' OR scheme_name ILIKE '%Dividend%' THEN 'IDCW'
          WHEN scheme_name ILIKE '%Bonus%' THEN 'Bonus'
          ELSE 'Unknown'
        END
      WHERE option_type IS NULL OR option_type = ''
    `);
    console.log(`Fixed option_type for ${optionFixResult.rowCount} funds`);

    // Step 3: Get ALL funds that are unlinked
    const unlinked = await client.query(`
      SELECT scheme_code, scheme_name, plan_type, option_type,
             scheme_type, category, sub_category
      FROM funds
      WHERE master_fund_id IS NULL
    `);
    console.log(`\nProcessing ${unlinked.rows.length} unlinked funds...`);

    // Step 4: For each unlinked fund, compute clean name and find/create master
    let linked = 0;
    let newMasters = 0;

    // Group by clean name first to batch
    const cleanGroups: Record<string, typeof unlinked.rows> = {};
    for (const fund of unlinked.rows) {
      const cleanName = cleanStrategyName(fund.scheme_name);
      if (!cleanGroups[cleanName]) cleanGroups[cleanName] = [];
      cleanGroups[cleanName].push(fund);
    }

    console.log(`Found ${Object.keys(cleanGroups).length} unique strategy names from unlinked funds\n`);

    for (const [cleanName, funds] of Object.entries(cleanGroups)) {
      if (!cleanName || cleanName.length < 3) continue;

      // Try to find existing master_fund
      const existing = await client.query(
        `SELECT id FROM master_funds WHERE strategy_name = $1`,
        [cleanName]
      );

      let masterId: number;

      if (existing.rows.length > 0) {
        masterId = existing.rows[0].id;
      } else {
        // Create new master_fund
        const fundHouse = extractFundHouse(cleanName);
        const sampleFund = funds[0];
        const result = await client.query(
          `INSERT INTO master_funds (strategy_name, fund_house, category, sub_category, variant_count)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (strategy_name) DO UPDATE SET
             variant_count = master_funds.variant_count + EXCLUDED.variant_count,
             updated_at = NOW()
           RETURNING id`,
          [cleanName, fundHouse, sampleFund.scheme_type || sampleFund.category, sampleFund.sub_category, funds.length]
        );
        masterId = result.rows[0].id;
        newMasters++;
      }

      // Link all funds in this group
      const codes = funds.map((f) => f.scheme_code);
      await client.query(
        `UPDATE funds SET master_fund_id = $1 WHERE scheme_code = ANY($2)`,
        [masterId, codes]
      );
      linked += codes.length;
    }

    console.log(`Linked ${linked} funds to master_funds`);
    console.log(`Created ${newMasters} new master_fund families`);

    // Step 5: Also try to link any remaining unlinked by matching existing masters
    // Some funds may clean to a name that already exists in master_funds but didn't match above
    const stillUnlinked = await client.query(`
      SELECT scheme_code, scheme_name FROM funds WHERE master_fund_id IS NULL
    `);

    if (stillUnlinked.rows.length > 0) {
      console.log(`\nStill ${stillUnlinked.rows.length} unlinked — attempting fuzzy match...`);
      let fuzzyLinked = 0;

      for (const fund of stillUnlinked.rows) {
        const cleanName = cleanStrategyName(fund.scheme_name);
        if (!cleanName || cleanName.length < 3) continue;

        // Try similarity match
        const fuzzy = await client.query(
          `SELECT id, strategy_name FROM master_funds
           WHERE similarity(strategy_name, $1) > 0.7
           ORDER BY similarity(strategy_name, $1) DESC
           LIMIT 1`,
          [cleanName]
        );

        if (fuzzy.rows.length > 0) {
          await client.query(
            `UPDATE funds SET master_fund_id = $1 WHERE scheme_code = $2`,
            [fuzzy.rows[0].id, fund.scheme_code]
          );
          fuzzyLinked++;
        }
      }
      console.log(`Fuzzy-linked ${fuzzyLinked} additional funds`);
    }

    // Step 6: Update variant_count on all master_funds
    await client.query(`
      UPDATE master_funds mf SET
        variant_count = (SELECT COUNT(*) FROM funds f WHERE f.master_fund_id = mf.id),
        updated_at = NOW()
    `);
    console.log("\nUpdated variant_count on all master_funds");

    // Step 7: Final stats
    const after = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(master_fund_id) AS linked,
        COUNT(*) - COUNT(master_fund_id) AS unlinked
      FROM funds
    `);
    console.log("\nAFTER:", after.rows[0]);

    const familyStats = await client.query(`
      SELECT COUNT(*) AS families FROM master_funds WHERE variant_count > 0
    `);
    console.log("Active families:", familyStats.rows[0]);

    // Show remaining unlinked sample
    const remaining = await client.query(`
      SELECT scheme_name, plan_type, option_type
      FROM funds WHERE master_fund_id IS NULL
      LIMIT 10
    `);
    if (remaining.rows.length > 0) {
      console.log("\nRemaining unlinked samples:");
      remaining.rows.forEach((r) =>
        console.log(`  ${r.scheme_name} | ${r.plan_type} | ${r.option_type}`)
      );
    }

    // Step 8: Refresh materialized view
    console.log("\nRefreshing mv_unified_search...");
    await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_search`);
    console.log("Done! mv_unified_search refreshed.");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
