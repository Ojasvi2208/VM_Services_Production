/**
 * Migration script to add CAS-related columns to users table
 * Run with: npx tsx src/scripts/add-user-cas-columns.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function addUserCASColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('🔧 Adding CAS columns to users table...');

    // Add PAN column
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pan VARCHAR(20)
    `);
    console.log('✅ Added pan column');

    // Add CAS email column (separate from login email)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cas_email VARCHAR(255)
    `);
    console.log('✅ Added cas_email column');

    // Add CAS phone column
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cas_phone VARCHAR(20)
    `);
    console.log('✅ Added cas_phone column');

    // Add updated_at column if not exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('✅ Added updated_at column');

    console.log('\n✅ All CAS columns added successfully!');
    console.log('\nUsers table now has:');
    console.log('  - pan: Stores PAN number from CAS');
    console.log('  - cas_email: Stores email from CAS (may differ from login email)');
    console.log('  - cas_phone: Stores phone from CAS');

  } catch (error) {
    console.error('❌ Error adding columns:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addUserCASColumns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
