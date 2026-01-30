'use client';

import { useState, useEffect } from 'react';
import Section from '@/components/Section';
import ResponsiveContainer from '@/components/ResponsiveContainer';

interface NavRecord {
  schemeCode: string;
  date: string;
  nav: number;
  schemeName: string;
  amcCode?: string;
}

interface FundRecord {
  schemeCode: string;
  schemeName: string;
  latestNav: number;
  latestNavDate: string;
  lastUpdated: string;
}

export default function DatabaseViewerPage() {
  const [navRecords, setNavRecords] = useState<NavRecord[]>([]);
  const [fundRecords, setFundRecords] = useState<FundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'nav' | 'funds'>('nav');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScheme, setSelectedScheme] = useState('');

  // Fetch NAV history for a scheme
  const fetchNavHistory = async (schemeCode: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nav/history?schemeCode=${schemeCode}`);
      const result = await response.json();
      
      if (result.success) {
        setNavRecords(result.data);
      } else {
        // Show demo data if no real data available
        showDemoData(schemeCode);
      }
    } catch (error) {
      console.error('Error fetching NAV history:', error);
      // Show demo data on error
      showDemoData(schemeCode);
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest NAV for a scheme
  const fetchLatestNav = async (schemeCode: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nav/latest?schemeCode=${schemeCode}`);
      const result = await response.json();
      
      if (result.success) {
        setNavRecords([result.data]);
      } else {
        // Show demo data if no real data available
        showDemoData(schemeCode);
      }
    } catch (error) {
      console.error('Error fetching latest NAV:', error);
      // Show demo data on error
      showDemoData(schemeCode);
    } finally {
      setLoading(false);
    }
  };

  // Show demo data for testing
  const showDemoData = (schemeCode: string) => {
    const demoData: NavRecord[] = [
      {
        schemeCode: schemeCode,
        schemeName: `HDFC Equity Fund - Direct Plan - Growth (Demo Data)`,
        nav: 856.2340,
        date: '2025-11-15',
        amcCode: 'HDFC Mutual Fund',
      }
    ];
    
    // Generate some historical data
    if (activeTab === 'nav') {
      const historicalData: NavRecord[] = [];
      const baseNav = 856.234;
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const variation = (Math.random() - 0.5) * 20;
        
        historicalData.push({
          schemeCode: schemeCode,
          schemeName: `HDFC Equity Fund - Direct Plan - Growth (Demo Data)`,
          nav: baseNav + variation,
          date: date.toISOString().split('T')[0],
          amcCode: 'HDFC Mutual Fund',
        });
      }
      
      setNavRecords(historicalData);
    } else {
      setNavRecords(demoData);
    }
    
    alert('⚠️ Showing demo data. To see real data:\n1. Set up AWS credentials in .env.local\n2. Create DynamoDB tables\n3. Run NAV sync');
  };

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      alert('Please enter a scheme code');
      return;
    }
    
    setSelectedScheme(searchQuery.trim());
    
    if (activeTab === 'nav') {
      fetchNavHistory(searchQuery.trim());
    } else {
      fetchLatestNav(searchQuery.trim());
    }
  };

  // Test sync status
  const testSync = async () => {
    setLoading(true);
    try {
      // Try to fetch some sample schemes to check if data exists
      const sampleSchemes = ['119551', '119552', '120503'];
      let foundData = false;
      
      for (const scheme of sampleSchemes) {
        const response = await fetch(`/api/nav/latest?schemeCode=${scheme}`);
        const result = await response.json();
        
        if (result.success) {
          foundData = true;
          alert(`✅ Database is working! Found data for scheme ${scheme}`);
          setSearchQuery(scheme);
          fetchLatestNav(scheme);
          break;
        }
      }
      
      if (!foundData) {
        alert('⚠️ No data found. Please run the NAV sync first:\ncurl -X GET http://localhost:3000/api/cron/sync-nav -H "Authorization: Bearer YOUR_CRON_SECRET"');
      }
    } catch (error) {
      console.error('Error testing sync:', error);
      alert('❌ Error connecting to database. Check your AWS credentials in .env.local');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="pt-24"></div>
      
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-brand-navy">Database Viewer</h1>
                <p className="text-brand-navy/70 mt-1">View NAV data stored in DynamoDB</p>
              </div>
              
              <button
                onClick={testSync}
                disabled={loading}
                className="bg-brand-gold text-white px-6 py-3 rounded-lg font-medium hover:bg-yellow-600 transition-all disabled:opacity-50"
              >
                Test Database
              </button>
            </div>

            {/* Tabs */}
            <div className="card-light p-2 inline-flex rounded-lg">
              <button
                onClick={() => setActiveTab('nav')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'nav'
                    ? 'bg-brand-royal text-white'
                    : 'text-brand-navy hover:bg-gray-100'
                }`}
              >
                NAV History
              </button>
              <button
                onClick={() => setActiveTab('funds')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'funds'
                    ? 'bg-brand-royal text-white'
                    : 'text-brand-navy hover:bg-gray-100'
                }`}
              >
                Latest NAV
              </button>
            </div>

            {/* Search */}
            <div className="card-light p-6">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter scheme code (e.g., 119551)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-royal/30 focus:border-brand-royal"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-brand-royal text-white px-8 py-3 rounded-lg font-medium hover:bg-brand-navy transition-all disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Search'}
                </button>
              </div>
              
              <div className="mt-4 flex gap-2 flex-wrap">
                <span className="text-sm text-brand-navy/60">Try:</span>
                {['119551', '119552', '120503', '118989', '119597'].map(code => (
                  <button
                    key={code}
                    onClick={() => {
                      setSearchQuery(code);
                      setSelectedScheme(code);
                      if (activeTab === 'nav') {
                        fetchNavHistory(code);
                      } else {
                        fetchLatestNav(code);
                      }
                    }}
                    className="px-3 py-1 bg-brand-pearl text-brand-navy rounded text-sm hover:bg-brand-royal hover:text-white transition-all"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="card-light p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-royal border-t-transparent"></div>
                <p className="mt-4 text-brand-navy/70">Loading data from DynamoDB...</p>
              </div>
            )}

            {/* Results */}
            {!loading && navRecords.length > 0 && (
              <div className="card-light p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-brand-navy">
                    {activeTab === 'nav' ? 'NAV History' : 'Latest NAV'} - Scheme {selectedScheme}
                  </h3>
                  <span className="text-sm text-brand-navy/60">
                    {navRecords.length} record{navRecords.length !== 1 ? 's' : ''} found
                  </span>
                </div>

                {navRecords[0] && (
                  <div className="mb-4 p-4 bg-brand-pearl rounded-lg">
                    <h4 className="font-semibold text-brand-navy mb-2">
                      {navRecords[0].schemeName}
                    </h4>
                    {navRecords[0].amcCode && (
                      <p className="text-sm text-brand-navy/70">
                        AMC: {navRecords[0].amcCode}
                      </p>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-brand-royal/20">
                        <th className="text-left py-3 px-4 font-semibold text-brand-navy">Date</th>
                        <th className="text-right py-3 px-4 font-semibold text-brand-navy">NAV</th>
                        <th className="text-left py-3 px-4 font-semibold text-brand-navy">Scheme Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {navRecords.map((record, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-brand-pearl/30 transition-colors">
                          <td className="py-3 px-4 text-brand-navy/80">
                            {new Date(record.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-brand-royal">
                            ₹{record.nav.toFixed(4)}
                          </td>
                          <td className="py-3 px-4 text-brand-navy/80 font-mono">
                            {record.schemeCode}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && navRecords.length === 0 && selectedScheme && (
              <div className="card-light p-12 text-center">
                <div className="w-20 h-20 bg-brand-pearl rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-brand-navy mb-2">No Data Found</h3>
                <p className="text-brand-navy/70 mb-4">
                  No NAV data found for scheme code: {selectedScheme}
                </p>
                <p className="text-sm text-brand-navy/60">
                  Make sure the NAV sync has been run and the scheme code is correct.
                </p>
              </div>
            )}

            {/* Initial State */}
            {!loading && navRecords.length === 0 && !selectedScheme && (
              <div className="card-light p-12 text-center">
                <div className="w-20 h-20 bg-brand-pearl rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-brand-royal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-brand-navy mb-2">Search for NAV Data</h3>
                <p className="text-brand-navy/70 mb-4">
                  Enter a scheme code to view NAV data from the database
                </p>
                <p className="text-sm text-brand-navy/60">
                  Or click "Test Database" to check if data is available
                </p>
              </div>
            )}

            {/* Database Info */}
            <div className="card-light p-6 bg-blue-50 border-l-4 border-blue-400">
              <h3 className="font-semibold text-blue-900 mb-2">📊 Database Information</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p><strong>Current Status:</strong> {navRecords.length > 0 && navRecords[0].schemeName?.includes('Demo') ? '🟡 Demo Mode' : '🟢 Live Data'}</p>
                
                <p className="mt-3"><strong>Tables:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><code className="bg-blue-100 px-2 py-1 rounded">vijaymalik-nav-history</code> - Historical NAV data</li>
                  <li><code className="bg-blue-100 px-2 py-1 rounded">vijaymalik-funds</code> - Fund metadata</li>
                </ul>
                
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="font-semibold text-yellow-900 mb-2">🔧 To Enable Real Data:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-yellow-900">
                    <li>Create <code className="bg-yellow-100 px-1 rounded">.env.local</code> with AWS credentials</li>
                    <li>Run: <code className="bg-yellow-100 px-1 rounded">./scripts/setup-nav-tables.sh</code></li>
                    <li>Sync NAV data (see below)</li>
                  </ol>
                </div>
                
                <p className="mt-3"><strong>To sync data:</strong></p>
                <code className="block bg-blue-100 p-3 rounded mt-2 text-xs overflow-x-auto">
                  curl -X GET http://localhost:3000/api/cron/sync-nav \<br/>
                  &nbsp;&nbsp;-H "Authorization: Bearer YOUR_CRON_SECRET"
                </code>
              </div>
            </div>
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
