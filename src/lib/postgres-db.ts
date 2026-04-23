/**
 * PostgreSQL Database Service — Singleton Pool
 *
 * Serverless-safe: Uses a global singleton with lazy initialization
 * to prevent "Too many clients" errors when Next.js Edge/Serverless
 * functions spin up multiple module instances.
 *
 * The pool is attached to `globalThis` so it survives hot-reloads
 * in development and is shared across all API routes in production.
 */

import { Pool } from 'pg';

// Extend globalThis to hold our singleton pool reference
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/vijaymalik_funds',
      max: 3,                     // Serverless: each Vercel instance gets own pool. 3 × N instances stays under Railway 100-conn limit.
      idleTimeoutMillis: 10000,   // Release idle connections faster in serverless
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true,      // Let the process exit cleanly in serverless
    });

    // Log pool errors instead of crashing the process
    globalThis.__pgPool.on('error', (err) => {
      console.error('Unexpected PG pool error:', err.message);
    });
  }
  return globalThis.__pgPool;
}

const pool = getPool();

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
    
    // Add PAN/email/phone columns to users table for CAS data storage
    // Using ALTER TABLE with IF NOT EXISTS pattern for safety
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pan VARCHAR(20)`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cas_email VARCHAR(255)`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cas_phone VARCHAR(20)`);
      console.log('✅ User CAS columns added/verified');
    } catch (e) {
      // Columns may already exist or table structure differs - that's okay
      console.log('ℹ️ User CAS columns check completed');
    }
    
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
  const result = await pool.query(`
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
}

/**
 * Get NAV history for a scheme from local nav_history table (Data Sovereign)
 */
export async function getNavHistory(
  schemeCode: string,
  startDate?: string,
  endDate?: string
): Promise<NAVRecord[]> {
  let query = `
    SELECT nh.nav_date::text AS date, nh.nav_value AS nav,
           f.scheme_name, f.amc_code, f.scheme_type
    FROM nav_history nh
    JOIN funds f ON f.scheme_code = nh.scheme_code
    WHERE nh.scheme_code = $1`;
  const params: any[] = [schemeCode];

  if (startDate) {
    params.push(startDate);
    query += ` AND nh.nav_date >= $${params.length}::date`;
  }
  if (endDate) {
    params.push(endDate);
    query += ` AND nh.nav_date <= $${params.length}::date`;
  }

  query += ` ORDER BY nh.nav_date DESC LIMIT 2000`;

  try {
    const result = await pool.query(query, params);
    return result.rows.map((row: any) => ({
      schemeCode,
      schemeName: row.scheme_name || '',
      nav: parseFloat(row.nav),
      date: row.date,
      amcCode: row.amc_code || '',
      schemeType: row.scheme_type || '',
    }));
  } catch (error) {
    console.error('Error fetching NAV history:', error);
    return [];
  }
}

/**
 * Search funds by name or code
 */
export async function searchFunds(query: string, limit: number = 50): Promise<NAVRecord[]> {
  const result = await pool.query(`
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
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalFunds: number;
  totalRecords: number;
  latestDate: string | null;
}> {
  const [fundsResult, returnsResult, dateResult] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM funds'),
    pool.query('SELECT COUNT(*) FROM fund_returns'),
    pool.query('SELECT MAX(latest_nav_date) as latest_date FROM funds'),
  ]);

  return {
    totalFunds: parseInt(fundsResult.rows[0].count),
    totalRecords: parseInt(returnsResult.rows[0].count),
    latestDate: dateResult.rows[0].latest_date,
  };
}

export default pool;
