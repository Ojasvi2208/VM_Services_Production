/**
 * Master Fund Migration Script
 * 
 * Groups 14,685 fund schemes into ~6,000 strategy families using
 * JS-based name cleaning (more robust than SQL regex for Indian MF naming).
 * 
 * Usage: DATABASE_URL=<url> node scripts/run-master-fund-migration.js
 */

const { Pool } = require('pg');

const DB_URL = process.env.DATABASE_URL || process.argv[2];
if (!DB_URL) {
  console.error('Usage: DATABASE_URL=<url> node scripts/run-master-fund-migration.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  statement_timeout: 120000,
  query_timeout: 120000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// ── Strategy Name Cleaner ──
function cleanStrategyName(name) {
  let s = name;
  s = s.replace(/\s*\(Erstwhile[^)]*\)/gi, '');
  s = s.replace(/\s*\(Formerly[^)]*\)/gi, '');
  s = s.replace(/\s*\(Advisor[^)]*\)/gi, '');
  s = s.replace(/\s*\(\s*\)/g, '');
  // Normalize all dashes to ' - '
  s = s.replace(/\s*[-–]\s*/g, ' - ');

  const keywords = /^(direct|regular|growth|idcw|dividend|payout|reinvestment|bonus|option|plan|quarterly|monthly|weekly|daily|annual|half.yearly|normal|flexi|cumulative)$/i;
  const segments = s.split(' - ');

  // Strip trailing segments that are purely plan/option keywords
  while (segments.length > 1) {
    const last = segments[segments.length - 1].trim();
    const words = last.split(/\s+/);
    const allKeywords = words.every(w => keywords.test(w));
    const startsWithKeyword = /^(Direct|Regular|Growth|IDCW|Dividend|Payout|Reinvestment|Bonus|Quarterly|Monthly|Weekly|Daily)\b/i.test(last);
    if (allKeywords || startsWithKeyword) {
      segments.pop();
    } else {
      break;
    }
  }

  return segments.join(' - ').trim().replace(/\s+/g, ' ');
}

// ── Fund House Detector ──
function detectFundHouse(name) {
  const s = name.toUpperCase();
  const map = [
    ['ADITYA BIRLA', 'Aditya Birla Sun Life'], ['ICICI PRUDENTIAL', 'ICICI Prudential'],
    ['ICICI PRUD', 'ICICI Prudential'], ['NIPPON INDIA', 'Nippon India'],
    ['FRANKLIN', 'Franklin Templeton'], ['KOTAK', 'Kotak Mahindra'],
    ['TATA ', 'Tata'], ['HDFC ', 'HDFC'], ['SBI ', 'SBI'], ['AXIS ', 'Axis'],
    ['UTI ', 'UTI'], ['DSP ', 'DSP'], ['MIRAE ', 'Mirae Asset'],
    ['SUNDARAM ', 'Sundaram'], ['INVESCO ', 'Invesco'], ['MOTILAL ', 'Motilal Oswal'],
    ['QUANT ', 'Quant'], ['CANARA ', 'Canara Robeco'], ['BANDHAN ', 'Bandhan'],
    ['BAJAJ ', 'Bajaj Finserv'], ['EDELWEISS ', 'Edelweiss'], ['UNION ', 'Union'],
    ['MAHINDRA ', 'Mahindra Manulife'], ['PPFAS', 'PPFAS'], ['PARAG PARIKH', 'PPFAS'],
    ['PGIM ', 'PGIM India'], ['BARODA ', 'Baroda BNP Paribas'], ['HSBC ', 'HSBC'],
    ['ITI ', 'ITI'], ['WHITEOAK', 'WhiteOak'], ['LIC ', 'LIC'],
    ['JM ', 'JM Financial'], ['GROWW ', 'Groww'], ['360 ONE', '360 ONE'],
    ['NJ ', 'NJ'], ['L&T ', 'L&T'], ['NAVI ', 'Navi'], ['QUANTUM ', 'Quantum'],
    ['SAMCO ', 'Samco'], ['SHRIRAM ', 'Shriram'], ['TRUST ', 'Trust'],
    ['HELIOS ', 'Helios'], ['OLD BRIDGE', 'Old Bridge'], ['ZERODHA', 'Zerodha'],
  ];
  for (const [prefix, house] of map) {
    if (s.startsWith(prefix)) return house;
  }
  return name.split(' ')[0];
}

// ── Sub-Category Detector ──
function detectSubCategory(name) {
  const n = name.toLowerCase();
  if (n.includes('large cap') || n.includes('largecap')) return 'Large Cap';
  if (n.includes('mid cap') || n.includes('midcap')) return 'Mid Cap';
  if (n.includes('small cap') || n.includes('smallcap')) return 'Small Cap';
  if (n.includes('flexi') || n.includes('multi cap') || n.includes('multicap')) return 'Flexi Cap';
  if (n.includes('elss') || n.includes('tax')) return 'ELSS';
  if (n.includes('liquid')) return 'Liquid';
  if (n.includes('overnight')) return 'Overnight';
  if (n.includes('balanced') || n.includes('hybrid')) return 'Hybrid';
  if (n.includes('debt') || n.includes('bond') || n.includes('gilt')) return 'Debt';
  if (n.includes('index') || n.includes('etf')) return 'Index/ETF';
  if (n.includes('arbitrage')) return 'Arbitrage';
  if (n.includes('credit risk')) return 'Credit Risk';
  if (n.includes('dynamic')) return 'Dynamic';
  if (n.includes('focused')) return 'Focused';
  if (n.includes('value')) return 'Value';
  if (n.includes('contra')) return 'Contra';
  if (n.includes('dividend yield')) return 'Dividend Yield';
  if (n.includes('sectoral') || n.includes('thematic')) return 'Sectoral/Thematic';
  return null;
}

// ── Main Migration ──
async function migrate() {
  const client = await pool.connect();
  const t0 = Date.now();

  try {
    await client.query('BEGIN');

    // Clean slate
    console.log('1/6  Dropping old master_funds (if exists)...');
    await client.query('ALTER TABLE funds DROP CONSTRAINT IF EXISTS fk_master_fund');
    await client.query('ALTER TABLE funds DROP COLUMN IF EXISTS master_fund_id');
    await client.query('DROP TABLE IF EXISTS master_funds CASCADE');

    console.log('2/6  Creating master_funds table...');
    await client.query(`
      CREATE TABLE master_funds (
        id            SERIAL PRIMARY KEY,
        strategy_name TEXT NOT NULL UNIQUE,
        fund_house    TEXT,
        category      TEXT,
        sub_category  TEXT,
        variant_count INT DEFAULT 0,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX idx_master_funds_strategy ON master_funds(strategy_name)');
    await client.query('CREATE INDEX idx_master_funds_house ON master_funds(fund_house)');
    await client.query('CREATE INDEX idx_master_funds_category ON master_funds(category)');
    await client.query('ALTER TABLE funds ADD COLUMN master_fund_id INT');

    // Fetch all funds
    console.log('3/6  Fetching all funds...');
    const allFunds = await client.query('SELECT scheme_code, scheme_name, scheme_type FROM funds');
    console.log('     Found', allFunds.rows.length, 'schemes');

    // Build family map
    const familyMap = new Map();
    for (const row of allFunds.rows) {
      const strategyName = cleanStrategyName(row.scheme_name);
      if (!familyMap.has(strategyName)) {
        familyMap.set(strategyName, {
          fund_house: detectFundHouse(strategyName),
          category: row.scheme_type || null,
          sub_category: detectSubCategory(strategyName),
          schemes: []
        });
      }
      familyMap.get(strategyName).schemes.push(row.scheme_code);
    }
    console.log('     Grouped into', familyMap.size, 'families');

    // Insert master_funds
    console.log('4/6  Inserting master_funds...');
    const masterIds = new Map();
    let inserted = 0;
    for (const [strategyName, data] of familyMap) {
      const res = await client.query(
        'INSERT INTO master_funds (strategy_name, fund_house, category, sub_category, variant_count) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [strategyName, data.fund_house, data.category, data.sub_category, data.schemes.length]
      );
      masterIds.set(strategyName, res.rows[0].id);
      inserted++;
      if (inserted % 1000 === 0) process.stdout.write('     ' + inserted + '/' + familyMap.size + '\r');
    }
    console.log('     Inserted', inserted, 'families');

    // Link funds → master_funds via temp table + single bulk UPDATE
    console.log('5/6  Linking funds → master_funds...');
    await client.query('CREATE TEMP TABLE _fund_master_map (scheme_code TEXT, master_fund_id INT)');

    // Build bulk INSERT values in chunks of 500 rows
    const mappings = [];
    for (const [strategyName, data] of familyMap) {
      const masterId = masterIds.get(strategyName);
      for (const sc of data.schemes) {
        mappings.push([sc, masterId]);
      }
    }

    const CHUNK = 500;
    for (let i = 0; i < mappings.length; i += CHUNK) {
      const chunk = mappings.slice(i, i + CHUNK);
      const values = chunk.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
      const params = chunk.flat();
      await client.query(`INSERT INTO _fund_master_map (scheme_code, master_fund_id) VALUES ${values}`, params);
      if ((i + CHUNK) % 2000 === 0 || i + CHUNK >= mappings.length) {
        process.stdout.write('     Staged ' + Math.min(i + CHUNK, mappings.length) + '/' + mappings.length + '\r');
      }
    }

    // Single bulk UPDATE
    const updateRes = await client.query(`
      UPDATE funds f SET master_fund_id = m.master_fund_id
      FROM _fund_master_map m WHERE f.scheme_code = m.scheme_code
    `);
    console.log('     Linked', updateRes.rowCount, 'schemes (single bulk UPDATE)');
    await client.query('DROP TABLE _fund_master_map');

    // Add FK + indexes
    await client.query('ALTER TABLE funds ADD CONSTRAINT fk_master_fund FOREIGN KEY (master_fund_id) REFERENCES master_funds(id)');
    await client.query('CREATE INDEX idx_funds_master_id ON funds(master_fund_id)');

    // Add plan_type and option_type
    console.log('6/6  Setting plan_type & option_type...');
    await client.query('ALTER TABLE funds ADD COLUMN IF NOT EXISTS plan_type TEXT');
    await client.query('ALTER TABLE funds ADD COLUMN IF NOT EXISTS option_type TEXT');
    await client.query(`
      UPDATE funds SET
        plan_type = CASE
          WHEN scheme_name ILIKE '%Direct%' THEN 'Direct'
          WHEN scheme_name ILIKE '%Regular%' THEN 'Regular'
          ELSE 'Unknown'
        END,
        option_type = CASE
          WHEN scheme_name ILIKE '%Growth%' THEN 'Growth'
          WHEN scheme_name ILIKE '%IDCW%' OR scheme_name ILIKE '%Dividend%' THEN 'IDCW'
          ELSE 'Unknown'
        END
      WHERE plan_type IS NULL
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_funds_plan_type ON funds(plan_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_funds_option_type ON funds(option_type)');

    await client.query('COMMIT');

    // ── Verify ──
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const stats = await client.query('SELECT COUNT(*) as families FROM master_funds');
    const linkedCount = await client.query('SELECT COUNT(*) as c FROM funds WHERE master_fund_id IS NOT NULL');
    const unlinked = await client.query('SELECT COUNT(*) as c FROM funds WHERE master_fund_id IS NULL');
    const top = await client.query('SELECT strategy_name, fund_house, variant_count FROM master_funds ORDER BY variant_count DESC LIMIT 15');
    const dist = await client.query('SELECT variant_count, COUNT(*) as families FROM master_funds GROUP BY variant_count ORDER BY variant_count DESC LIMIT 10');

    console.log('\n══════════════════════════════════════');
    console.log('  MIGRATION COMPLETE (' + elapsed + 's)');
    console.log('══════════════════════════════════════');
    console.log('  Families:        ', stats.rows[0].families);
    console.log('  Linked schemes:  ', linkedCount.rows[0].c);
    console.log('  Unlinked schemes:', unlinked.rows[0].c);
    console.log('\n  Top 15 families by variant count:');
    top.rows.forEach(r => console.log('    ' + String(r.variant_count).padStart(3) + '  ' + r.fund_house + ' → ' + r.strategy_name));
    console.log('\n  Variant distribution:');
    dist.rows.forEach(r => console.log('    ' + String(r.variant_count).padStart(3) + ' variants → ' + r.families + ' families'));

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('MIGRATION FAILED:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
