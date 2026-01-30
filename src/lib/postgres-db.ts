/**
 * PostgreSQL Database Service
 * Works locally and on Zoho hosting with same code
 * Just change DATABASE_URL environment variable
 */

import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/vijaymalik_funds',
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export interface NAVRecord {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
  timestamp?: number;
  amcCode?: string;
  schemeType?: string;
}

/**
 * Initialize database tables
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('📊 Initializing PostgreSQL database...');
    
    // Create nav_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS nav_history (
        id SERIAL PRIMARY KEY,
        scheme_code VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        nav DECIMAL(12, 4) NOT NULL,
        scheme_name TEXT,
        amc_code VARCHAR(100),
        scheme_type VARCHAR(200),
        timestamp BIGINT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(scheme_code, date)
      )
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scheme_code ON nav_history(scheme_code)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_date ON nav_history(date)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scheme_date ON nav_history(scheme_code, date)
    `);
    
    // Create funds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS funds (
        scheme_code VARCHAR(20) PRIMARY KEY,
        scheme_name TEXT,
        latest_nav DECIMAL(12, 4),
        latest_nav_date DATE,
        amc_code VARCHAR(100),
        scheme_type VARCHAR(200),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Save NAV records to database
 */
export async function saveNavRecords(records: NAVRecord[]): Promise<{ saved: number; errors: number }> {
  const client = await pool.connect();
  let saved = 0;
  let errors = 0;
  
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      try {
        // Insert into nav_history
        await client.query(`
          INSERT INTO nav_history (scheme_code, date, nav, scheme_name, amc_code, scheme_type, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (scheme_code, date) DO UPDATE
          SET nav = EXCLUDED.nav,
              scheme_name = EXCLUDED.scheme_name,
              updated_at = CURRENT_TIMESTAMP
        `, [
          record.schemeCode,
          record.date,
          record.nav,
          record.schemeName,
          record.amcCode,
          record.schemeType,
          record.timestamp || Date.now(),
        ]);
        
        // Update funds table
        await client.query(`
          INSERT INTO funds (scheme_code, scheme_name, latest_nav, latest_nav_date, amc_code, scheme_type)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (scheme_code) DO UPDATE
          SET latest_nav = EXCLUDED.latest_nav,
              latest_nav_date = EXCLUDED.latest_nav_date,
              scheme_name = EXCLUDED.scheme_name,
              last_updated = CURRENT_TIMESTAMP
        `, [
          record.schemeCode,
          record.schemeName,
          record.nav,
          record.date,
          record.amcCode,
          record.schemeType,
        ]);
        
        saved++;
        
        if (saved % 1000 === 0) {
          console.log(`   Saved ${saved}/${records.length} records...`);
        }
      } catch (error) {
        errors++;
        console.error(`Error saving record ${record.schemeCode}:`, error);
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ Saved ${saved} records, ${errors} errors`);
    
    return { saved, errors };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get latest NAV for a scheme
 */
export async function getLatestNav(schemeCode: string): Promise<NAVRecord | null> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT scheme_code as "schemeCode", scheme_name as "schemeName", 
             latest_nav as nav, latest_nav_date as date,
             amc_code as "amcCode", scheme_type as "schemeType"
      FROM funds
      WHERE scheme_code = $1
    `, [schemeCode]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      schemeCode: row.schemeCode,
      schemeName: row.schemeName,
      nav: parseFloat(row.nav),
      date: row.date,
      amcCode: row.amcCode,
      schemeType: row.schemeType,
    };
  } finally {
    client.release();
  }
}

/**
 * Get NAV history for a scheme
 */
export async function getNavHistory(
  schemeCode: string,
  startDate?: string,
  endDate?: string
): Promise<NAVRecord[]> {
  const client = await pool.connect();
  
  try {
    let query = `
      SELECT scheme_code as "schemeCode", scheme_name as "schemeName",
             nav, date, amc_code as "amcCode", scheme_type as "schemeType"
      FROM nav_history
      WHERE scheme_code = $1
    `;
    
    const params: any[] = [schemeCode];
    
    if (startDate && endDate) {
      query += ` AND date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND date >= $2`;
      params.push(startDate);
    } else if (endDate) {
      query += ` AND date <= $2`;
      params.push(endDate);
    }
    
    query += ` ORDER BY date DESC`;
    
    const result = await client.query(query, params);
    
    return result.rows.map(row => ({
      schemeCode: row.schemeCode,
      schemeName: row.schemeName,
      nav: parseFloat(row.nav),
      date: row.date,
      amcCode: row.amcCode,
      schemeType: row.schemeType,
    }));
  } finally {
    client.release();
  }
}

/**
 * Search funds by name or code
 */
export async function searchFunds(query: string, limit: number = 50): Promise<NAVRecord[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT scheme_code as "schemeCode", scheme_name as "schemeName",
             latest_nav as nav, latest_nav_date as date,
             amc_code as "amcCode", scheme_type as "schemeType"
      FROM funds
      WHERE scheme_name ILIKE $1 OR scheme_code LIKE $2
      ORDER BY scheme_name
      LIMIT $3
    `, [`%${query}%`, `%${query}%`, limit]);
    
    return result.rows.map(row => ({
      schemeCode: row.schemeCode,
      schemeName: row.schemeName,
      nav: parseFloat(row.nav),
      date: row.date,
      amcCode: row.amcCode,
      schemeType: row.schemeType,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalFunds: number;
  totalRecords: number;
  latestDate: string | null;
}> {
  const client = await pool.connect();
  
  try {
    const fundsResult = await client.query('SELECT COUNT(*) FROM funds');
    const recordsResult = await client.query('SELECT COUNT(*) FROM nav_history');
    const dateResult = await client.query('SELECT MAX(date) as latest_date FROM nav_history');
    
    return {
      totalFunds: parseInt(fundsResult.rows[0].count),
      totalRecords: parseInt(recordsResult.rows[0].count),
      latestDate: dateResult.rows[0].latest_date,
    };
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export default pool;
