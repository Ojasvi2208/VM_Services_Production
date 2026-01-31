import { Pool } from 'pg';

// Railway production database connection
const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDatabase() {
  console.log('🚀 Initializing Railway database schema...\n');

  try {
    // Create funds table
    console.log('📊 Creating funds table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS funds (
        scheme_code VARCHAR(50) PRIMARY KEY,
        scheme_name TEXT NOT NULL,
        amc_code VARCHAR(50),
        category VARCHAR(100),
        sub_category VARCHAR(100),
        scheme_type VARCHAR(50),
        nav NUMERIC(10,4),
        nav_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Funds table created\n');

    // Create nav_history table
    console.log('📊 Creating nav_history table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nav_history (
        id SERIAL PRIMARY KEY,
        scheme_code VARCHAR(50) NOT NULL,
        nav_date DATE NOT NULL,
        nav_value NUMERIC(10,4) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(scheme_code, nav_date)
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nav_history_scheme_code 
      ON nav_history(scheme_code)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nav_history_nav_date 
      ON nav_history(nav_date DESC)
    `);
    console.log('✅ NAV history table created\n');

    // Create fund_returns table
    console.log('📊 Creating fund_returns table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fund_returns (
        scheme_code VARCHAR(50) PRIMARY KEY,
        return_1w NUMERIC(10,4),
        return_1m NUMERIC(10,4),
        return_3m NUMERIC(10,4),
        return_6m NUMERIC(10,4),
        return_1y NUMERIC(10,4),
        return_3y NUMERIC(10,4),
        return_5y NUMERIC(10,4),
        cagr_1y NUMERIC(10,4),
        cagr_3y NUMERIC(10,4),
        cagr_5y NUMERIC(10,4),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Fund returns table created\n');

    console.log('✨ Database schema initialized successfully!');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run initialization
initializeDatabase().catch(console.error);
