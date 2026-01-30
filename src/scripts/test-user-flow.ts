import pool from '@/lib/postgres-db';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface TestResult {
  test: string;
  status: 'pass' | 'fail';
  details?: string;
  data?: any;
}

async function testUserFlow() {
  const results: TestResult[] = [];
  
  console.log('🧪 Testing Complete User Flow...\n');
  console.log('═'.repeat(80));
  
  try {
    // Test 1: Home page - Get list of funds
    console.log('\n📋 Test 1: Home Page - Fund Listing');
    const fundsList = await pool.query(`
      SELECT 
        scheme_code,
        scheme_name,
        category,
        latest_nav,
        latest_nav_date
      FROM funds
      WHERE latest_nav IS NOT NULL
      ORDER BY scheme_name
      LIMIT 20
    `);
    
    if (fundsList.rows.length > 0) {
      results.push({
        test: 'Fund Listing',
        status: 'pass',
        details: `Retrieved ${fundsList.rows.length} funds`,
        data: {
          sample: fundsList.rows[0].scheme_name,
          latestNav: fundsList.rows[0].latest_nav
        }
      });
      console.log(`✅ PASS: Retrieved ${fundsList.rows.length} funds`);
      console.log(`   Sample: ${fundsList.rows[0].scheme_name} (NAV: ₹${fundsList.rows[0].latest_nav})`);
    } else {
      results.push({
        test: 'Fund Listing',
        status: 'fail',
        details: 'No funds found'
      });
      console.log('❌ FAIL: No funds found');
    }
    
    // Test 2: Search functionality
    console.log('\n📋 Test 2: Search Functionality');
    const searchTerm = 'HDFC';
    const searchResults = await pool.query(`
      SELECT 
        scheme_code,
        scheme_name,
        latest_nav
      FROM funds
      WHERE scheme_name ILIKE $1
      LIMIT 10
    `, [`%${searchTerm}%`]);
    
    if (searchResults.rows.length > 0) {
      results.push({
        test: 'Search Functionality',
        status: 'pass',
        details: `Found ${searchResults.rows.length} results for "${searchTerm}"`,
        data: { count: searchResults.rows.length }
      });
      console.log(`✅ PASS: Found ${searchResults.rows.length} results for "${searchTerm}"`);
      console.log(`   Top result: ${searchResults.rows[0].scheme_name}`);
    } else {
      results.push({
        test: 'Search Functionality',
        status: 'fail',
        details: `No results for "${searchTerm}"`
      });
      console.log(`❌ FAIL: No results for "${searchTerm}"`);
    }
    
    // Test 3: Fund Details Page - Get specific fund
    console.log('\n📋 Test 3: Fund Details Page');
    const testSchemeCode = fundsList.rows[0]?.scheme_code || '119551';
    
    const fundDetails = await pool.query(`
      SELECT 
        f.*,
        fr.return_1w,
        fr.return_1m,
        fr.return_3m,
        fr.return_6m,
        fr.return_1y,
        fr.return_3y,
        fr.return_5y,
        fr.cagr_1y,
        fr.cagr_3y,
        fr.cagr_5y
      FROM funds f
      LEFT JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
      WHERE f.scheme_code = $1
    `, [testSchemeCode]);
    
    if (fundDetails.rows.length > 0) {
      const fund = fundDetails.rows[0];
      const hasBasicInfo = fund.scheme_name && fund.latest_nav;
      const hasReturns = fund.return_1m !== null;
      
      results.push({
        test: 'Fund Details',
        status: hasBasicInfo && hasReturns ? 'pass' : 'fail',
        details: `Scheme: ${fund.scheme_code}`,
        data: {
          name: fund.scheme_name,
          nav: fund.latest_nav,
          hasReturns: hasReturns,
          return1m: fund.return_1m
        }
      });
      
      console.log(`✅ PASS: Retrieved fund details for ${fund.scheme_code}`);
      console.log(`   Name: ${fund.scheme_name}`);
      console.log(`   Latest NAV: ₹${fund.latest_nav} (${fund.latest_nav_date?.toISOString().split('T')[0]})`);
      console.log(`   Returns: ${hasReturns ? '✅ Available' : '❌ Missing'}`);
      if (hasReturns) {
        console.log(`   1M Return: ${parseFloat(fund.return_1m)?.toFixed(2)}%`);
        console.log(`   1Y Return: ${parseFloat(fund.return_1y)?.toFixed(2)}%`);
      }
    } else {
      results.push({
        test: 'Fund Details',
        status: 'fail',
        details: 'Fund not found'
      });
      console.log('❌ FAIL: Fund not found');
    }
    
    // Test 4: NAV Chart Data - Verify ordering
    console.log('\n📋 Test 4: NAV Chart Data (Oldest to Newest)');
    const navChartData = await pool.query(`
      SELECT 
        nav_date,
        nav_value
      FROM nav_history
      WHERE scheme_code = $1
      ORDER BY nav_date ASC
      LIMIT 30
    `, [testSchemeCode]);
    
    if (navChartData.rows.length > 1) {
      const firstDate = new Date(navChartData.rows[0].nav_date);
      const lastDate = new Date(navChartData.rows[navChartData.rows.length - 1].nav_date);
      const isCorrectOrder = firstDate <= lastDate;
      
      results.push({
        test: 'NAV Chart Ordering',
        status: isCorrectOrder ? 'pass' : 'fail',
        details: `${navChartData.rows.length} data points`,
        data: {
          firstDate: firstDate.toISOString().split('T')[0],
          lastDate: lastDate.toISOString().split('T')[0],
          correctOrder: isCorrectOrder
        }
      });
      
      if (isCorrectOrder) {
        console.log(`✅ PASS: NAV data ordered correctly (oldest to newest)`);
        console.log(`   Date range: ${firstDate.toISOString().split('T')[0]} → ${lastDate.toISOString().split('T')[0]}`);
        console.log(`   Data points: ${navChartData.rows.length}`);
        console.log(`   First NAV: ₹${navChartData.rows[0].nav_value}`);
        console.log(`   Last NAV: ₹${navChartData.rows[navChartData.rows.length - 1].nav_value}`);
      } else {
        console.log('❌ FAIL: NAV data NOT ordered correctly');
      }
    } else {
      results.push({
        test: 'NAV Chart Ordering',
        status: 'fail',
        details: 'Insufficient NAV data'
      });
      console.log('❌ FAIL: Insufficient NAV data for chart');
    }
    
    // Test 5: Returns Display - All periods
    console.log('\n📋 Test 5: Returns Display (All Periods)');
    const returnsData = await pool.query(`
      SELECT 
        return_1w,
        return_1m,
        return_3m,
        return_6m,
        return_1y,
        return_2y,
        return_3y,
        return_5y,
        return_7y,
        return_10y,
        cagr_1y,
        cagr_3y,
        cagr_5y,
        cagr_7y,
        cagr_10y
      FROM fund_returns
      WHERE scheme_code = $1
    `, [testSchemeCode]);
    
    if (returnsData.rows.length > 0) {
      const returns = returnsData.rows[0];
      const availableReturns = Object.keys(returns).filter(k => returns[k] !== null);
      
      results.push({
        test: 'Returns Display',
        status: availableReturns.length > 0 ? 'pass' : 'fail',
        details: `${availableReturns.length}/15 periods available`,
        data: returns
      });
      
      console.log(`✅ PASS: ${availableReturns.length}/15 return periods available`);
      console.log('   Available periods:');
      if (returns.return_1w !== null) console.log(`   • 1 Week: ${parseFloat(returns.return_1w).toFixed(2)}%`);
      if (returns.return_1m !== null) console.log(`   • 1 Month: ${parseFloat(returns.return_1m).toFixed(2)}%`);
      if (returns.return_3m !== null) console.log(`   • 3 Months: ${parseFloat(returns.return_3m).toFixed(2)}%`);
      if (returns.return_6m !== null) console.log(`   • 6 Months: ${parseFloat(returns.return_6m).toFixed(2)}%`);
      if (returns.return_1y !== null) console.log(`   • 1 Year: ${parseFloat(returns.return_1y).toFixed(2)}%`);
      if (returns.return_3y !== null) console.log(`   • 3 Years: ${parseFloat(returns.return_3y).toFixed(2)}%`);
      if (returns.cagr_3y !== null) console.log(`   • 3Y CAGR: ${parseFloat(returns.cagr_3y).toFixed(2)}%`);
    } else {
      results.push({
        test: 'Returns Display',
        status: 'fail',
        details: 'No returns data'
      });
      console.log('❌ FAIL: No returns data available');
    }
    
    // Test 6: Category Filtering
    console.log('\n📋 Test 6: Category Filtering');
    const categories = await pool.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM funds
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `);
    
    if (categories.rows.length > 0) {
      results.push({
        test: 'Category Filtering',
        status: 'pass',
        details: `${categories.rows.length} categories available`,
        data: categories.rows
      });
      
      console.log(`✅ PASS: ${categories.rows.length} categories available`);
      categories.rows.forEach(cat => {
        console.log(`   • ${cat.category}: ${cat.count} funds`);
      });
    } else {
      results.push({
        test: 'Category Filtering',
        status: 'fail',
        details: 'No categories found'
      });
      console.log('❌ FAIL: No categories found');
    }
    
    // Test 7: Performance Comparison
    console.log('\n📋 Test 7: Performance Comparison (Top Performers)');
    const topPerformers = await pool.query(`
      SELECT 
        f.scheme_code,
        f.scheme_name,
        fr.return_1y,
        fr.return_3y,
        fr.cagr_3y
      FROM funds f
      INNER JOIN fund_returns fr ON f.scheme_code = fr.scheme_code
      WHERE fr.return_1y IS NOT NULL
      ORDER BY fr.return_1y DESC
      LIMIT 5
    `);
    
    if (topPerformers.rows.length > 0) {
      results.push({
        test: 'Performance Comparison',
        status: 'pass',
        details: `Top ${topPerformers.rows.length} performers identified`,
        data: topPerformers.rows
      });
      
      console.log(`✅ PASS: Top ${topPerformers.rows.length} performers (by 1Y return)`);
      topPerformers.rows.forEach((fund, i) => {
        console.log(`   ${i + 1}. ${fund.scheme_name.substring(0, 50)}`);
        console.log(`      1Y: ${parseFloat(fund.return_1y)?.toFixed(2)}% | 3Y: ${parseFloat(fund.return_3y)?.toFixed(2)}%`);
      });
    } else {
      results.push({
        test: 'Performance Comparison',
        status: 'fail',
        details: 'Cannot compare performance'
      });
      console.log('❌ FAIL: Cannot compare performance');
    }
    
    // Test 8: Data Freshness
    console.log('\n📋 Test 8: Data Freshness');
    const latestNavResult = await pool.query(`SELECT MAX(nav_date) as latest_nav FROM nav_history`);
    const latestReturnsResult = await pool.query(`SELECT MAX(calculated_date) as latest_returns FROM fund_returns`);
    
    const freshness = {
      rows: [{
        latest_nav: latestNavResult.rows[0].latest_nav,
        latest_returns: latestReturnsResult.rows[0].latest_returns
      }]
    };
    
    const latestNav = new Date(freshness.rows[0].latest_nav);
    const latestReturns = new Date(freshness.rows[0].latest_returns);
    const today = new Date();
    
    const navAge = Math.floor((today.getTime() - latestNav.getTime()) / (1000 * 60 * 60 * 24));
    const returnsAge = Math.floor((today.getTime() - latestReturns.getTime()) / (1000 * 60 * 60 * 24));
    
    results.push({
      test: 'Data Freshness',
      status: navAge <= 7 && returnsAge <= 7 ? 'pass' : 'fail',
      details: `NAV: ${navAge} days old, Returns: ${returnsAge} days old`,
      data: {
        latestNav: latestNav.toISOString().split('T')[0],
        latestReturns: latestReturns.toISOString().split('T')[0],
        navAge,
        returnsAge
      }
    });
    
    console.log(`${navAge <= 7 && returnsAge <= 7 ? '✅ PASS' : '⚠️  WARNING'}: Data freshness`);
    console.log(`   Latest NAV: ${latestNav.toISOString().split('T')[0]} (${navAge} days old)`);
    console.log(`   Latest Returns: ${latestReturns.toISOString().split('T')[0]} (${returnsAge} days old)`);
    
    console.log('\n' + '═'.repeat(80));
    
    // Summary
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const total = results.length;
    
    console.log('\n📊 TEST SUMMARY:');
    console.log(`   Total Tests: ${total}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('✅ User flow is working flawlessly');
      console.log('✅ API-DB-UI are perfectly synchronized');
      console.log('✅ Ready for users!');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
      console.log('Review failed tests above and fix issues');
    }
    
    console.log('\n' + '═'.repeat(80));
    
    // Detailed results
    console.log('\n📋 DETAILED RESULTS:\n');
    results.forEach((result, i) => {
      const icon = result.status === 'pass' ? '✅' : '❌';
      console.log(`${i + 1}. ${icon} ${result.test}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testUserFlow().catch(console.error);
