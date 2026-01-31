import { Pool } from 'pg';

const RAILWAY_DB_URL = 'postgresql://postgres:aIFocuQebgyiiibLSlbFpiGrPPavDhtD@gondola.proxy.rlwy.net:45690/railway';

const pool = new Pool({
  connectionString: RAILWAY_DB_URL,
  ssl: { rejectUnauthorized: false }
});

interface SchemaIssue {
  table: string;
  issue: string;
  fix: string;
}

async function comprehensiveSchemaSync() {
  console.log('🔍 COMPREHENSIVE SCHEMA-API SYNCHRONIZATION\n');
  console.log('=' .repeat(60));
  
  const issues: SchemaIssue[] = [];

  try {
    // STEP 1: Get all existing tables
    console.log('\n📊 STEP 1: Auditing existing tables...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map(r => r.table_name);
    console.log('✅ Found tables:', existingTables.join(', '));

    // STEP 2: Verify funds table has ALL required columns
    console.log('\n📊 STEP 2: Verifying funds table schema...');
    const fundsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'funds' 
      ORDER BY ordinal_position
    `);
    
    const existingFundColumns = fundsColumns.rows.map(r => r.column_name);
    console.log('✅ Funds table has', existingFundColumns.length, 'columns');

    // Required columns for funds table based on API usage
    const requiredFundColumns = {
      'scheme_code': 'VARCHAR(50) PRIMARY KEY',
      'scheme_name': 'TEXT NOT NULL',
      'amc_code': 'TEXT',
      'category': 'TEXT',
      'sub_category': 'TEXT',
      'scheme_type': 'TEXT',
      'plan_type': 'VARCHAR(50)',
      'option_type': 'VARCHAR(50)',
      'nav': 'NUMERIC(12,4)',
      'nav_date': 'DATE',
      'latest_nav': 'NUMERIC(12,4)',
      'latest_nav_date': 'DATE',
      'inception_date': 'DATE',
      'fund_size': 'NUMERIC(15,2)',
      'aum': 'NUMERIC(15,2)',
      'expense_ratio': 'NUMERIC(5,2)',
      'exit_load': 'VARCHAR(100)',
      'min_investment': 'NUMERIC(12,2)',
      'min_sip': 'NUMERIC(12,2)',
      'is_active': 'BOOLEAN DEFAULT true',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'last_updated': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    };

    // Check for missing columns
    const missingColumns: string[] = [];
    for (const [colName, colDef] of Object.entries(requiredFundColumns)) {
      if (!existingFundColumns.includes(colName)) {
        missingColumns.push(colName);
        issues.push({
          table: 'funds',
          issue: `Missing column: ${colName}`,
          fix: `ALTER TABLE funds ADD COLUMN ${colName} ${colDef}`
        });
      }
    }

    if (missingColumns.length > 0) {
      console.log('⚠️  Missing columns in funds table:', missingColumns.join(', '));
    } else {
      console.log('✅ All required columns exist in funds table');
    }

    // STEP 3: Verify fund_returns table
    console.log('\n📊 STEP 3: Verifying fund_returns table...');
    const returnsColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fund_returns' 
      ORDER BY ordinal_position
    `);
    
    const existingReturnColumns = returnsColumns.rows.map(r => r.column_name);
    console.log('✅ fund_returns has', existingReturnColumns.length, 'columns');
    console.log('   Columns:', existingReturnColumns.join(', '));

    // STEP 4: Verify nav_history table
    console.log('\n📊 STEP 4: Verifying nav_history table...');
    const navColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'nav_history' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ nav_history has', navColumns.rows.length, 'columns');
    console.log('   Columns:', navColumns.rows.map(r => r.column_name).join(', '));

    // STEP 5: Check data population status
    console.log('\n📊 STEP 5: Checking data population...');
    const dataStats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM funds) as total_funds,
        (SELECT COUNT(*) FROM funds WHERE latest_nav IS NOT NULL) as funds_with_nav,
        (SELECT COUNT(*) FROM nav_history) as nav_records,
        (SELECT COUNT(*) FROM fund_returns) as returns_calculated
    `);
    
    const stats = dataStats.rows[0];
    console.log('   Total Funds:', stats.total_funds);
    console.log('   Funds with NAV:', stats.funds_with_nav);
    console.log('   NAV History Records:', stats.nav_records);
    console.log('   Returns Calculated:', stats.returns_calculated);

    if (parseInt(stats.funds_with_nav) < parseInt(stats.total_funds) * 0.5) {
      issues.push({
        table: 'funds',
        issue: 'Less than 50% of funds have NAV data',
        fix: 'Run NAV population script'
      });
    }

    if (parseInt(stats.returns_calculated) === 0) {
      issues.push({
        table: 'fund_returns',
        issue: 'No returns calculated',
        fix: 'Run returns calculation script'
      });
    }

    // STEP 6: Apply fixes
    console.log('\n📊 STEP 6: Applying fixes...');
    
    if (issues.length === 0) {
      console.log('✅ No issues found! Schema is perfectly synced.');
    } else {
      console.log(`⚠️  Found ${issues.length} issues to fix:\n`);
      
      for (const issue of issues) {
        console.log(`   Table: ${issue.table}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Fix: ${issue.fix}\n`);
        
        // Apply SQL fixes
        if (issue.fix.startsWith('ALTER TABLE')) {
          try {
            await pool.query(issue.fix);
            console.log('   ✅ Applied fix');
          } catch (error: any) {
            console.log('   ❌ Error applying fix:', error.message);
          }
        }
      }
    }

    // STEP 7: Final verification
    console.log('\n📊 STEP 7: Final verification...');
    const finalCheck = await pool.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n✅ FINAL SCHEMA STATUS:');
    finalCheck.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.column_count} columns`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✨ SCHEMA SYNCHRONIZATION COMPLETE\n');

    // Return summary
    return {
      success: true,
      issues: issues.length,
      tables: existingTables.length,
      stats
    };

  } catch (error) {
    console.error('❌ Error during schema sync:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

comprehensiveSchemaSync().catch(console.error);
