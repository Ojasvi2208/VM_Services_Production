import { Pool } from 'pg';

const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function createAdvancedMetricsSchema() {
  console.log('🚀 Creating advanced metrics schema...\n');

  try {
    // Create fund_advanced_metrics table
    console.log('📊 Creating fund_advanced_metrics table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fund_advanced_metrics (
        scheme_code VARCHAR(50) PRIMARY KEY,
        
        -- Risk Metrics
        standard_deviation_1y NUMERIC(10,4),
        standard_deviation_3y NUMERIC(10,4),
        standard_deviation_5y NUMERIC(10,4),
        beta_1y NUMERIC(10,4),
        beta_3y NUMERIC(10,4),
        beta_5y NUMERIC(10,4),
        
        -- Risk-Adjusted Returns
        sharpe_ratio_1y NUMERIC(10,4),
        sharpe_ratio_3y NUMERIC(10,4),
        sharpe_ratio_5y NUMERIC(10,4),
        sortino_ratio_1y NUMERIC(10,4),
        sortino_ratio_3y NUMERIC(10,4),
        sortino_ratio_5y NUMERIC(10,4),
        treynor_ratio_1y NUMERIC(10,4),
        treynor_ratio_3y NUMERIC(10,4),
        treynor_ratio_5y NUMERIC(10,4),
        
        -- Alpha
        alpha_1y NUMERIC(10,4),
        alpha_3y NUMERIC(10,4),
        alpha_5y NUMERIC(10,4),
        
        -- Downside Risk
        downside_deviation_1y NUMERIC(10,4),
        downside_deviation_3y NUMERIC(10,4),
        downside_deviation_5y NUMERIC(10,4),
        
        -- Maximum Drawdown
        max_drawdown_1y NUMERIC(10,4),
        max_drawdown_3y NUMERIC(10,4),
        max_drawdown_5y NUMERIC(10,4),
        
        -- Correlation with benchmark
        correlation_1y NUMERIC(10,4),
        correlation_3y NUMERIC(10,4),
        correlation_5y NUMERIC(10,4),
        
        -- R-Squared
        r_squared_1y NUMERIC(10,4),
        r_squared_3y NUMERIC(10,4),
        r_squared_5y NUMERIC(10,4),
        
        -- Information Ratio
        information_ratio_1y NUMERIC(10,4),
        information_ratio_3y NUMERIC(10,4),
        information_ratio_5y NUMERIC(10,4),
        
        -- Tracking Error
        tracking_error_1y NUMERIC(10,4),
        tracking_error_3y NUMERIC(10,4),
        tracking_error_5y NUMERIC(10,4),
        
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scheme_code) REFERENCES funds(scheme_code)
      )
    `);
    console.log('✅ fund_advanced_metrics table created\n');

    // Create rolling_returns table
    console.log('📊 Creating rolling_returns table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rolling_returns (
        id SERIAL PRIMARY KEY,
        scheme_code VARCHAR(50) NOT NULL,
        period VARCHAR(20) NOT NULL, -- '1y', '3y', '5y'
        end_date DATE NOT NULL,
        rolling_return NUMERIC(10,4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(scheme_code, period, end_date),
        FOREIGN KEY (scheme_code) REFERENCES funds(scheme_code)
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rolling_returns_scheme 
      ON rolling_returns(scheme_code)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rolling_returns_period 
      ON rolling_returns(period)
    `);
    console.log('✅ rolling_returns table created\n');

    // Create benchmark_data table for Nifty 50 / Sensex
    console.log('📊 Creating benchmark_data table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS benchmark_data (
        id SERIAL PRIMARY KEY,
        benchmark_name VARCHAR(50) NOT NULL, -- 'NIFTY50', 'SENSEX', 'NIFTY_MIDCAP', etc.
        date DATE NOT NULL,
        value NUMERIC(12,4) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(benchmark_name, date)
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_benchmark_data_name_date 
      ON benchmark_data(benchmark_name, date DESC)
    `);
    console.log('✅ benchmark_data table created\n');

    console.log('✨ Advanced metrics schema created successfully!');

  } catch (error) {
    console.error('❌ Error creating schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createAdvancedMetricsSchema().catch(console.error);
