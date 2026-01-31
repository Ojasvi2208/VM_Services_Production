import { Pool } from 'pg';
import axios from 'axios';

// You'll update this with the new Railway DATABASE_URL
const DATABASE_URL = process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Check database space usage and stop if > 90% full
async function checkDatabaseSpace(): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT 
        pg_database_size(current_database()) as used_bytes,
        pg_size_pretty(pg_database_size(current_database())) as used_size
    `);
    
    const usedBytes = parseInt(result.rows[0].used_bytes);
    const usedSize = result.rows[0].used_size;
    
    // Railway free tier: ~512MB, Hobby: ~8GB
    // Assuming 512MB limit for safety
    const limitBytes = 512 * 1024 * 1024; // 512MB
    const usagePercent = (usedBytes / limitBytes) * 100;
    
    console.log(`   💾 Database: ${usedSize} (${usagePercent.toFixed(1)}% of limit)`);
    
    if (usagePercent >= 90) {
      console.error('\n⚠️  DATABASE SPACE CRITICAL: 90% full - STOPPING IMMEDIATELY');
      console.error('   Please upgrade Railway plan or optimize data storage\n');
      return false;
    }
    
    if (usagePercent >= 75) {
      console.warn(`   ⚠️  Warning: Database is ${usagePercent.toFixed(1)}% full`);
    }
    
    return true;
  } catch (error) {
    console.warn('   ⚠️  Could not check database space:', error);
    return true; // Continue if check fails
  }
}

async function setupFreshDatabase() {
  console.log('🚀 Setting up fresh database...\n');

  try {
    // Check initial space
    const hasSpace = await checkDatabaseSpace();
    if (!hasSpace) {
      console.error('❌ Insufficient database space. Aborting.');
      process.exit(1);
    }
    
    // Step 1: Create tables
    console.log('\n📊 Step 1: Creating database schema...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS funds (
        scheme_code VARCHAR(20) PRIMARY KEY,
        scheme_name TEXT NOT NULL,
        amc_code VARCHAR(50),
        scheme_type VARCHAR(100),
        category VARCHAR(100),
        sub_category VARCHAR(100),
        plan_type VARCHAR(50),
        option_type VARCHAR(50),
        latest_nav NUMERIC(12,4),
        latest_nav_date DATE,
        previous_day_nav NUMERIC(12,4),
        day_change_percent NUMERIC(10,4),
        inception_date DATE,
        fund_size NUMERIC(15,2),
        expense_ratio NUMERIC(5,2),
        exit_load TEXT,
        min_investment NUMERIC(12,2),
        min_sip NUMERIC(12,2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fund_returns (
        scheme_code VARCHAR(20) PRIMARY KEY REFERENCES funds(scheme_code),
        return_1w NUMERIC(10,4),
        return_1m NUMERIC(10,4),
        return_3m NUMERIC(10,4),
        return_6m NUMERIC(10,4),
        return_1y NUMERIC(10,4),
        return_2y NUMERIC(10,4),
        return_3y NUMERIC(10,4),
        return_5y NUMERIC(10,4),
        return_10y NUMERIC(10,4),
        cagr_1y NUMERIC(10,4),
        cagr_2y NUMERIC(10,4),
        cagr_3y NUMERIC(10,4),
        cagr_5y NUMERIC(10,4),
        cagr_10y NUMERIC(10,4),
        xirr_1y NUMERIC(10,4),
        xirr_3y NUMERIC(10,4),
        xirr_5y NUMERIC(10,4),
        volatility_1y NUMERIC(10,4),
        rolling_return_1y_avg NUMERIC(10,4),
        sharpe_ratio_1y NUMERIC(10,4),
        sortino_ratio_1y NUMERIC(10,4),
        max_drawdown NUMERIC(10,4),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Schema created\n');

    // Step 2: Fetch and populate mutual funds from AMFI
    console.log('📥 Step 2: Fetching mutual funds from AMFI...');
    
    const response = await axios.get('https://www.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const lines = response.data.split('\n');
    const funds: any[] = [];
    let currentAMC = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!trimmed.includes(';')) {
        currentAMC = trimmed;
        continue;
      }

      const parts = line.split(';');
      if (parts.length < 6) continue;

      const schemeCode = parts[0].trim();
      if (!schemeCode || !schemeCode.match(/^\d+$/)) continue;

      const schemeName = parts[3].trim();
      const navValue = parts[4].trim();
      const dateStr = parts[5].trim();

      if (!navValue || navValue === 'N.A.' || navValue === '-') continue;

      funds.push({
        scheme_code: schemeCode,
        scheme_name: schemeName,
        amc_code: currentAMC,
        latest_nav: parseFloat(navValue),
        latest_nav_date: dateStr
      });
    }

    console.log(`✅ Found ${funds.length} mutual funds\n`);

    // Step 3: Insert funds in batches
    console.log('\n💾 Step 3: Inserting funds into database...');
    
    const batchSize = 1000;
    for (let i = 0; i < funds.length; i += batchSize) {
      // Check space before each batch
      const hasSpace = await checkDatabaseSpace();
      if (!hasSpace) {
        console.error(`\n❌ Database 90% full - stopped at ${i}/${funds.length} funds`);
        break;
      }
      
      const batch = funds.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders: string[] = [];

      batch.forEach((fund, idx) => {
        const baseIdx = idx * 6;
        placeholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6})`);
        values.push(
          fund.scheme_code,
          fund.scheme_name,
          fund.amc_code,
          fund.latest_nav,
          fund.latest_nav_date,
          true // is_active
        );
      });

      await pool.query(`
        INSERT INTO funds (scheme_code, scheme_name, amc_code, latest_nav, latest_nav_date, is_active)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (scheme_code) DO UPDATE SET
          scheme_name = EXCLUDED.scheme_name,
          amc_code = EXCLUDED.amc_code,
          latest_nav = EXCLUDED.latest_nav,
          latest_nav_date = EXCLUDED.latest_nav_date,
          updated_at = CURRENT_TIMESTAMP
      `, values);

      console.log(`   ✅ Inserted ${Math.min(i + batchSize, funds.length)}/${funds.length} funds`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ FRESH DATABASE SETUP COMPLETE\n');
    console.log(`   📊 Total Funds: ${funds.length}`);
    console.log(`   ✅ Schema: Created`);
    console.log(`   ✅ Funds: Populated with latest NAV`);
    console.log('\n   Next: Run calculate-metrics-lightweight.ts to compute all metrics');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupFreshDatabase().catch(console.error);
