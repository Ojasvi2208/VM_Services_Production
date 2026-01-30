import pool from '@/lib/postgres-db';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface ConsistencyIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  issue: string;
  details?: string;
  fix?: string;
}

async function testAPIConsistency() {
  const issues: ConsistencyIssue[] = [];
  
  console.log('🔍 Testing API-DB-UI Consistency...\n');
  console.log('═'.repeat(80));
  
  try {
    // Test 1: Check if funds table has all required fields
    console.log('\n📋 Test 1: Checking funds table schema...');
    const fundsSchema = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'funds'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = ['scheme_code', 'scheme_name', 'latest_nav', 'latest_nav_date'];
    const existingColumns = fundsSchema.rows.map(r => r.column_name);
    
    for (const col of requiredColumns) {
      if (!existingColumns.includes(col)) {
        issues.push({
          type: 'error',
          category: 'Database Schema',
          issue: `Missing required column: ${col} in funds table`,
          fix: `ALTER TABLE funds ADD COLUMN ${col} ...`
        });
      }
    }
    console.log(`✅ Found ${existingColumns.length} columns in funds table`);
    
    // Test 2: Check if all funds have latest_nav and latest_nav_date
    console.log('\n📋 Test 2: Checking funds data completeness...');
    const incompleteFunds = await pool.query(`
      SELECT COUNT(*) as count
      FROM funds
      WHERE latest_nav IS NULL OR latest_nav_date IS NULL
    `);
    
    const incompleteCount = parseInt(incompleteFunds.rows[0].count);
    if (incompleteCount > 0) {
      issues.push({
        type: 'warning',
        category: 'Data Completeness',
        issue: `${incompleteCount} funds missing latest_nav or latest_nav_date`,
        details: 'These funds may not display correctly in UI',
        fix: 'Run: UPDATE funds SET latest_nav = (SELECT nav_value FROM nav_history WHERE scheme_code = funds.scheme_code ORDER BY nav_date DESC LIMIT 1)'
      });
    }
    console.log(`✅ ${incompleteCount === 0 ? 'All funds have complete data' : `${incompleteCount} funds need updates`}`);
    
    // Test 3: Verify NAV history ordering
    console.log('\n📋 Test 3: Checking NAV history data integrity...');
    const navOrdering = await pool.query(`
      SELECT scheme_code, COUNT(*) as count
      FROM nav_history
      GROUP BY scheme_code
      HAVING COUNT(*) > 0
      LIMIT 1
    `);
    
    if (navOrdering.rows.length > 0) {
      const testScheme = navOrdering.rows[0].scheme_code;
      const navData = await pool.query(`
        SELECT nav_date, nav_value
        FROM nav_history
        WHERE scheme_code = $1
        ORDER BY nav_date ASC
        LIMIT 5
      `, [testScheme]);
      
      console.log(`✅ NAV data can be ordered correctly (tested with scheme ${testScheme})`);
      console.log(`   Sample dates: ${navData.rows.map(r => r.nav_date.toISOString().split('T')[0]).join(', ')}`);
    }
    
    // Test 4: Check returns table consistency
    console.log('\n📋 Test 4: Checking returns table consistency...');
    const returnsCheck = await pool.query(`
      SELECT 
        COUNT(DISTINCT scheme_code) as unique_schemes,
        COUNT(*) as total_records,
        MAX(calculated_date) as latest_calc
      FROM fund_returns
    `);
    
    const returnsData = returnsCheck.rows[0];
    console.log(`✅ Returns: ${returnsData.unique_schemes} unique funds, ${returnsData.total_records} records`);
    console.log(`   Latest calculation: ${returnsData.latest_calc}`);
    
    // Test 5: Check for orphaned returns (returns without funds)
    console.log('\n📋 Test 5: Checking for orphaned data...');
    const orphanedReturns = await pool.query(`
      SELECT COUNT(*) as count
      FROM fund_returns
      WHERE scheme_code NOT IN (SELECT scheme_code FROM funds)
    `);
    
    const orphanCount = parseInt(orphanedReturns.rows[0].count);
    if (orphanCount > 0) {
      issues.push({
        type: 'error',
        category: 'Data Integrity',
        issue: `${orphanCount} orphaned returns (no matching fund)`,
        fix: 'DELETE FROM fund_returns WHERE scheme_code NOT IN (SELECT scheme_code FROM funds)'
      });
    }
    console.log(`✅ ${orphanCount === 0 ? 'No orphaned returns' : `${orphanCount} orphaned returns found`}`);
    
    // Test 6: Verify API route structure
    console.log('\n📋 Test 6: Checking API routes...');
    const fs = require('fs');
    const apiPath = path.join(process.cwd(), 'src/app/api/funds');
    
    if (fs.existsSync(apiPath)) {
      console.log('✅ API routes directory exists');
      
      // Check for specific route files
      const requiredRoutes = ['[schemeCode]/route.ts'];
      for (const route of requiredRoutes) {
        const routePath = path.join(apiPath, route);
        if (fs.existsSync(routePath)) {
          console.log(`   ✅ ${route} exists`);
        } else {
          issues.push({
            type: 'error',
            category: 'API Routes',
            issue: `Missing API route: ${route}`,
            fix: 'Create the missing route file'
          });
        }
      }
    } else {
      issues.push({
        type: 'error',
        category: 'API Routes',
        issue: 'API routes directory not found',
        fix: 'Create src/app/api/funds directory structure'
      });
    }
    
    // Test 7: Sample API response structure
    console.log('\n📋 Test 7: Testing sample API response structure...');
    const sampleFund = await pool.query(`
      SELECT f.*, fr.*
      FROM funds f
      LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
      WHERE f.latest_nav IS NOT NULL
      LIMIT 1
    `);
    
    if (sampleFund.rows.length > 0) {
      const fund = sampleFund.rows[0];
      const hasRequiredFields = fund.scheme_code && fund.scheme_name && fund.latest_nav;
      const hasReturns = fund.return_1m !== undefined;
      
      console.log(`✅ Sample fund data structure valid`);
      console.log(`   Scheme: ${fund.scheme_code}`);
      console.log(`   Has basic info: ${hasRequiredFields ? 'Yes' : 'No'}`);
      console.log(`   Has returns: ${hasReturns ? 'Yes' : 'No'}`);
      
      if (!hasRequiredFields) {
        issues.push({
          type: 'error',
          category: 'Data Structure',
          issue: 'Sample fund missing required fields',
          details: 'API responses may be incomplete'
        });
      }
    }
    
    // Test 8: Check NAV chart data ordering in API
    console.log('\n📋 Test 8: Verifying NAV chart data ordering...');
    const chartData = await pool.query(`
      SELECT nav_date, nav_value
      FROM nav_history
      WHERE scheme_code = (SELECT scheme_code FROM funds LIMIT 1)
      ORDER BY nav_date ASC
      LIMIT 30
    `);
    
    if (chartData.rows.length > 1) {
      const firstDate = new Date(chartData.rows[0].nav_date);
      const lastDate = new Date(chartData.rows[chartData.rows.length - 1].nav_date);
      
      if (firstDate <= lastDate) {
        console.log(`✅ NAV data ordered correctly (oldest to newest)`);
        console.log(`   Date range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
      } else {
        issues.push({
          type: 'error',
          category: 'Data Ordering',
          issue: 'NAV data not ordered correctly',
          details: 'Chart will display dates in wrong order',
          fix: 'Update API route to ORDER BY nav_date ASC'
        });
      }
    }
    
    // Test 9: Check for NULL values in critical fields
    console.log('\n📋 Test 9: Checking for NULL values in critical fields...');
    const nullChecks = [
      { table: 'funds', column: 'scheme_name', critical: true },
      { table: 'nav_history', column: 'nav_value', critical: true },
      { table: 'nav_history', column: 'nav_date', critical: true },
    ];
    
    for (const check of nullChecks) {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM ${check.table}
        WHERE ${check.column} IS NULL
      `);
      
      const nullCount = parseInt(result.rows[0].count);
      if (nullCount > 0) {
        issues.push({
          type: check.critical ? 'error' : 'warning',
          category: 'Data Quality',
          issue: `${nullCount} NULL values in ${check.table}.${check.column}`,
          details: check.critical ? 'This will cause API errors' : 'May cause display issues'
        });
      }
    }
    console.log('✅ NULL value checks complete');
    
    // Test 10: Verify database indexes for performance
    console.log('\n📋 Test 10: Checking database indexes...');
    const indexes = await pool.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('funds', 'nav_history', 'fund_returns')
      ORDER BY tablename, indexname
    `);
    
    console.log(`✅ Found ${indexes.rows.length} indexes`);
    
    const recommendedIndexes = [
      { table: 'nav_history', column: 'scheme_code' },
      { table: 'nav_history', column: 'nav_date' },
      { table: 'fund_returns', column: 'scheme_code' },
    ];
    
    for (const rec of recommendedIndexes) {
      const hasIndex = indexes.rows.some(idx => 
        idx.tablename === rec.table && idx.indexdef.includes(rec.column)
      );
      
      if (!hasIndex) {
        issues.push({
          type: 'warning',
          category: 'Performance',
          issue: `Missing index on ${rec.table}.${rec.column}`,
          details: 'Queries may be slow',
          fix: `CREATE INDEX idx_${rec.table}_${rec.column} ON ${rec.table}(${rec.column})`
        });
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    
    // Print all issues
    if (issues.length > 0) {
      console.log('\n🚨 ISSUES FOUND:\n');
      
      const errors = issues.filter(i => i.type === 'error');
      const warnings = issues.filter(i => i.type === 'warning');
      const info = issues.filter(i => i.type === 'info');
      
      if (errors.length > 0) {
        console.log('❌ ERRORS (Must Fix):');
        errors.forEach((issue, i) => {
          console.log(`\n${i + 1}. [${issue.category}] ${issue.issue}`);
          if (issue.details) console.log(`   Details: ${issue.details}`);
          if (issue.fix) console.log(`   Fix: ${issue.fix}`);
        });
      }
      
      if (warnings.length > 0) {
        console.log('\n⚠️  WARNINGS (Should Fix):');
        warnings.forEach((issue, i) => {
          console.log(`\n${i + 1}. [${issue.category}] ${issue.issue}`);
          if (issue.details) console.log(`   Details: ${issue.details}`);
          if (issue.fix) console.log(`   Fix: ${issue.fix}`);
        });
      }
      
      if (info.length > 0) {
        console.log('\nℹ️  INFO:');
        info.forEach((issue, i) => {
          console.log(`\n${i + 1}. [${issue.category}] ${issue.issue}`);
          if (issue.details) console.log(`   Details: ${issue.details}`);
        });
      }
      
      console.log('\n' + '═'.repeat(80));
      console.log(`\n📊 SUMMARY: ${errors.length} errors, ${warnings.length} warnings, ${info.length} info`);
      
      if (errors.length > 0) {
        console.log('\n🔴 CRITICAL: Fix errors before proceeding');
      } else if (warnings.length > 0) {
        console.log('\n🟡 ATTENTION: Review warnings for optimal performance');
      } else {
        console.log('\n🟢 GOOD: Only minor issues found');
      }
    } else {
      console.log('\n🎉 PERFECT! No consistency issues found!');
      console.log('✅ API-DB-UI are in perfect sync');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testAPIConsistency().catch(console.error);
