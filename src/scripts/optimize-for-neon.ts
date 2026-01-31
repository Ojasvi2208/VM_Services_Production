import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function optimizeDatabase() {
  console.log('🔧 Starting database optimization for Neon (0.5GB free tier)...\n');

  try {
    // Get current database stats
    console.log('📊 Current database stats:');
    const statsQuery = `
      SELECT 
        pg_size_pretty(pg_total_relation_size('funds')) as funds_size,
        pg_size_pretty(pg_total_relation_size('nav_history')) as nav_size,
        pg_size_pretty(pg_total_relation_size('fund_returns')) as returns_size,
        (SELECT COUNT(*) FROM funds) as fund_count,
        (SELECT COUNT(*) FROM nav_history) as nav_count,
        (SELECT COUNT(*) FROM fund_returns) as returns_count,
        (SELECT MIN(nav_date) FROM nav_history) as oldest_date,
        (SELECT MAX(nav_date) FROM nav_history) as newest_date
    `;
    const stats = await pool.query(statsQuery);
    console.log(stats.rows[0]);
    console.log('');

    // Calculate cutoff date (keep 2 years of data)
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
    console.log(`🗓️  Keeping NAV data from: ${cutoffDate.toISOString().split('T')[0]} onwards\n`);

    // Count records to be deleted
    const countQuery = `
      SELECT COUNT(*) as delete_count 
      FROM nav_history 
      WHERE nav_date < $1
    `;
    const countResult = await pool.query(countQuery, [cutoffDate]);
    console.log(`🗑️  Records to delete: ${countResult.rows[0].delete_count}\n`);

    // Confirm deletion
    console.log('⚠️  This will permanently delete old NAV records.');
    console.log('💾 Make sure you have a backup if needed!\n');

    // Delete old NAV records
    console.log('🔄 Deleting NAV records older than 2 years...');
    const deleteQuery = `
      DELETE FROM nav_history 
      WHERE nav_date < $1
    `;
    const deleteResult = await pool.query(deleteQuery, [cutoffDate]);
    console.log(`✅ Deleted ${deleteResult.rowCount} records\n`);

    // Vacuum to reclaim space
    console.log('🧹 Running VACUUM FULL to reclaim disk space...');
    await pool.query('VACUUM FULL nav_history');
    console.log('✅ VACUUM completed\n');

    // Get new stats
    console.log('📊 Optimized database stats:');
    const newStats = await pool.query(statsQuery);
    console.log(newStats.rows[0]);
    console.log('');

    console.log('✨ Database optimization complete!');
    console.log('📦 Your database should now fit in Neon\'s 0.5GB free tier\n');

  } catch (error) {
    console.error('❌ Error optimizing database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run optimization
optimizeDatabase().catch(console.error);
