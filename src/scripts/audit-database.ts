import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface AuditResult {
  category: string;
  metric: string;
  value: string | number;
  status: 'good' | 'warning' | 'error';
  notes?: string;
}

async function auditDatabase() {
  const results: AuditResult[] = [];
  
  console.log('🔍 Starting Database Audit...\n');
  
  try {
    // 1. Check total funds
    const fundsCount = await pool.query('SELECT COUNT(*) as count FROM funds');
    const totalFunds = parseInt(fundsCount.rows[0].count);
    results.push({
      category: 'Funds',
      metric: 'Total Funds',
      value: totalFunds,
      status: totalFunds > 0 ? 'good' : 'error',
      notes: totalFunds === 0 ? 'No funds in database!' : undefined
    });

    // 2. Check NAV history
    const navCount = await pool.query('SELECT COUNT(*) as count FROM nav_history');
    const totalNavRecords = parseInt(navCount.rows[0].count);
    results.push({
      category: 'NAV History',
      metric: 'Total NAV Records',
      value: totalNavRecords,
      status: totalNavRecords > 0 ? 'good' : 'error',
      notes: totalNavRecords === 0 ? 'No NAV history!' : undefined
    });

    // 3. Check NAV date range
    const navDateRange = await pool.query(
      'SELECT MAX(nav_date) as latest, MIN(nav_date) as oldest FROM nav_history'
    );
    if (navDateRange.rows[0].latest) {
      results.push({
        category: 'NAV History',
        metric: 'Latest NAV Date',
        value: navDateRange.rows[0].latest,
        status: 'good'
      });
      results.push({
        category: 'NAV History',
        metric: 'Oldest NAV Date',
        value: navDateRange.rows[0].oldest,
        status: 'good'
      });
    }

    // 4. Check funds without NAV data
    const fundsWithoutNav = await pool.query(`
      SELECT COUNT(*) as count 
      FROM funds 
      WHERE scheme_code NOT IN (SELECT DISTINCT scheme_code FROM nav_history)
    `);
    const missingNavCount = parseInt(fundsWithoutNav.rows[0].count);
    results.push({
      category: 'Data Quality',
      metric: 'Funds Without NAV Data',
      value: missingNavCount,
      status: missingNavCount === 0 ? 'good' : 'warning',
      notes: missingNavCount > 0 ? `${missingNavCount} funds have no NAV history` : undefined
    });

    // 5. Check fund returns
    const returnsCount = await pool.query('SELECT COUNT(*) as count FROM fund_returns');
    const totalReturns = parseInt(returnsCount.rows[0].count);
    results.push({
      category: 'Returns',
      metric: 'Funds with Returns',
      value: totalReturns,
      status: totalReturns > 0 ? 'good' : 'error',
      notes: totalReturns === 0 ? 'No returns calculated!' : undefined
    });

    // 6. Check returns calculation date
    const latestReturns = await pool.query(
      'SELECT MAX(calculated_date) as latest FROM fund_returns'
    );
    if (latestReturns.rows[0].latest) {
      const latestDate = new Date(latestReturns.rows[0].latest);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
      results.push({
        category: 'Returns',
        metric: 'Last Calculation Date',
        value: latestReturns.rows[0].latest,
        status: daysDiff <= 1 ? 'good' : 'warning',
        notes: daysDiff > 1 ? `Returns are ${daysDiff} days old` : undefined
      });
    }

    // 7. Check funds with missing returns
    const fundsWithoutReturns = await pool.query(`
      SELECT COUNT(*) as count 
      FROM funds 
      WHERE scheme_code NOT IN (SELECT DISTINCT scheme_code FROM fund_returns)
    `);
    const missingReturnsCount = parseInt(fundsWithoutReturns.rows[0].count);
    results.push({
      category: 'Data Quality',
      metric: 'Funds Without Returns',
      value: missingReturnsCount,
      status: missingReturnsCount === 0 ? 'good' : 'warning',
      notes: missingReturnsCount > 0 ? `${missingReturnsCount} funds have no returns` : undefined
    });

    // 8. Check for duplicate NAV entries
    const duplicateNav = await pool.query(`
      SELECT scheme_code, nav_date, COUNT(*) as count
      FROM nav_history
      GROUP BY scheme_code, nav_date
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    results.push({
      category: 'Data Quality',
      metric: 'Duplicate NAV Entries',
      value: duplicateNav.rows.length > 0 ? 'Found' : 'None',
      status: duplicateNav.rows.length === 0 ? 'good' : 'error',
      notes: duplicateNav.rows.length > 0 ? 'Database has duplicate NAV entries!' : undefined
    });

    // 9. Check NAV data distribution
    const navDistribution = await pool.query(`
      SELECT 
        scheme_code,
        COUNT(*) as nav_count
      FROM nav_history
      GROUP BY scheme_code
      ORDER BY nav_count DESC
      LIMIT 5
    `);
    if (navDistribution.rows.length > 0) {
      const avgNavPerFund = Math.floor(totalNavRecords / totalFunds);
      results.push({
        category: 'NAV History',
        metric: 'Avg NAV Records per Fund',
        value: avgNavPerFund,
        status: avgNavPerFund > 100 ? 'good' : 'warning',
        notes: avgNavPerFund < 100 ? 'Limited historical data' : undefined
      });
    }

    // 10. Check database size
    const dbSize = await pool.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as size
    `);
    results.push({
      category: 'Database',
      metric: 'Total Size',
      value: dbSize.rows[0].size,
      status: 'good'
    });

    // Print results
    console.log('📊 AUDIT RESULTS:\n');
    console.log('═'.repeat(80));
    
    let currentCategory = '';
    for (const result of results) {
      if (result.category !== currentCategory) {
        console.log(`\n${result.category}:`);
        console.log('─'.repeat(80));
        currentCategory = result.category;
      }
      
      const statusIcon = result.status === 'good' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${result.metric}: ${result.value}`);
      if (result.notes) {
        console.log(`   → ${result.notes}`);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    
    // Summary
    const errors = results.filter(r => r.status === 'error').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const good = results.filter(r => r.status === 'good').length;
    
    console.log('\n📈 SUMMARY:');
    console.log(`   ✅ Good: ${good}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    if (errors > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND - Immediate action required!');
    } else if (warnings > 0) {
      console.log('\n⚠️  WARNINGS FOUND - Review recommended');
    } else {
      console.log('\n🎉 ALL CHECKS PASSED - Database is healthy!');
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (missingNavCount > 0) {
      console.log(`   • Import NAV data for ${missingNavCount} funds`);
    }
    if (missingReturnsCount > 0) {
      console.log(`   • Calculate returns for ${missingReturnsCount} funds`);
    }
    if (latestReturns.rows[0].latest) {
      const latestDate = new Date(latestReturns.rows[0].latest);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 1) {
        console.log(`   • Run daily update script (returns are ${daysDiff} days old)`);
      }
    }
    
    console.log('\n');

  } catch (error) {
    console.error('❌ Audit failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

auditDatabase().catch(console.error);
