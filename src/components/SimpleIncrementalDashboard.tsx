'use client';

import { useState, useEffect, useCallback } from 'react';

interface FundStats {
  totalFunds: number;
  processedFunds: number;
  progress: number;
  categories: Record<string, number>;
  fundHouses: Record<string, number>;
  lastUpdated: string;
}

interface ProcessedFund {
  schemeCode: number;
  schemeName: string;
  fundHouse: string;
  category: string;
  plan: 'Direct' | 'Regular';
  riskLevel: number;
}

interface ProcessingResult {
  progress: number;
  processed: number;
  total: number;
  isComplete: boolean;
  currentBatch: ProcessedFund[];
}

interface SearchResult {
  query: string;
  results: ProcessedFund[];
  count: number;
}

export default function IncrementalLoaderDashboard() {
  const [stats, setStats] = useState<FundStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [autoProcess, setAutoProcess] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [error, setError] = useState<string | null>(null);

  // Load initial stats
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/incremental-loader?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error || 'Failed to load stats');
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Network error while loading stats');
    } finally {
      setIsLoading(false);
    }
  };

  const processNextBatch = useCallback(async () => {
    try {
      setIsProcessing(true);
      setError(null);
      
      const response = await fetch(`/api/incremental-loader?action=process&batchSize=${batchSize}`);
      const data = await response.json();
      
      if (data.success) {
        setProcessingResult(data.data);
        setStats(prev => prev ? {
          ...prev,
          processedFunds: data.data.processed,
          totalFunds: data.data.total,
          progress: data.data.progress
        } : null);
        
        if (data.data.isComplete) {
          setAutoProcess(false);
        }
      } else {
        setError(data.error || 'Failed to process batch');
        setAutoProcess(false);
      }
    } catch (err) {
      console.error('Failed to process batch:', err);
      setError('Network error during processing');
      setAutoProcess(false);
    } finally {
      setIsProcessing(false);
    }
  }, [batchSize]);

  // Auto-processing loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoProcess && stats && (stats.progress < 100)) {
      interval = setInterval(async () => {
        if (!isProcessing) {
          await processNextBatch();
        }
      }, 2000); // Process every 2 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoProcess, stats, isProcessing, processNextBatch]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/incremental-loader?action=search&q=${encodeURIComponent(searchQuery)}&limit=50`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.data);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Network error during search');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-800 flex items-center justify-center gap-3">
            📊 Incremental Fund Loader
          </h1>
          <p className="text-slate-600">Smart one-at-a-time fund processing to prevent server crashes</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">❌ {error}</span>
            </div>
          </div>
        )}

        {/* Main Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6">
            <div className="text-sm font-medium">📊 Total Funds</div>
            <div className="text-2xl font-bold mt-2">
              {stats?.totalFunds?.toLocaleString() || '0'}
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6">
            <div className="text-sm font-medium">✅ Processed</div>
            <div className="text-2xl font-bold mt-2">
              {stats?.processedFunds?.toLocaleString() || '0'}
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6">
            <div className="text-sm font-medium">📈 Progress</div>
            <div className="text-2xl font-bold mt-2">
              {stats?.progress?.toFixed(1) || '0'}%
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6">
            <div className="text-sm font-medium">⏰ Status</div>
            <div className="text-sm font-bold mt-2 bg-white bg-opacity-20 rounded px-2 py-1 inline-block">
              {isProcessing ? 'Processing...' : stats?.progress === 100 ? 'Complete' : 'Ready'}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {stats && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Processing Progress</h3>
              <button
                onClick={loadStats}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? '🔄' : '↻'} Refresh
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${stats.progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>{stats.processedFunds.toLocaleString()} funds processed</span>
                <span>{(stats.totalFunds - stats.processedFunds).toLocaleString()} remaining</span>
              </div>
              <div className="text-xs text-slate-500">
                Last updated: {formatTime(stats.lastUpdated)}
              </div>
            </div>
          </div>
        )}

        {/* Processing Controls */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">⚡ Processing Controls</h3>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Batch Size:</label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                  className="w-20 px-2 py-1 border rounded"
                  min="1"
                  max="100"
                />
              </div>
              
              <button
                onClick={processNextBatch}
                disabled={isProcessing || stats?.progress === 100}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? '⏳' : '▶️'} Process Batch
              </button>
              
              <button
                onClick={() => setAutoProcess(!autoProcess)}
                disabled={stats?.progress === 100}
                className={`px-4 py-2 rounded text-white flex items-center gap-2 ${
                  autoProcess ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                } disabled:opacity-50`}
              >
                {autoProcess ? '⏸️ Stop Auto' : '▶️ Start Auto'}
              </button>
            </div>
            
            {processingResult && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm">
                  <strong>Last Batch:</strong> Processed {processingResult.currentBatch.length} funds
                  {processingResult.currentBatch.length > 0 && (
                    <div className="mt-1 text-xs text-slate-600">
                      Latest: {processingResult.currentBatch[0].schemeName.substring(0, 60)}...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Interface */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">🔍 Quick Search (Processed Funds Only)</h3>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search funds by name, category, or fund house..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button 
                onClick={handleSearch} 
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                🔍 Search
              </button>
            </div>
            
            {searchResults && (
              <div className="space-y-2">
                <div className="text-sm text-slate-600">
                  Found {searchResults.count} results for &quot;{searchResults.query}&quot;
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {searchResults.results.map((fund) => (
                    <div key={fund.schemeCode} className="p-2 bg-slate-50 rounded text-sm">
                      <div className="font-medium">{fund.schemeName}</div>
                      <div className="text-xs text-slate-600 flex gap-4">
                        <span>Code: {fund.schemeCode}</span>
                        <span>House: {fund.fundHouse}</span>
                        <span>Category: {fund.category}</span>
                        <span>Plan: {fund.plan}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Categories Overview */}
        {stats && Object.keys(stats.categories).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">📋 Fund Categories</h3>
              <div className="space-y-2">
                {Object.entries(stats.categories).map(([category, count]) => (
                  <div key={category} className="flex justify-between text-sm">
                    <span>{category}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">🏢 Top Fund Houses</h3>
              <div className="space-y-2">
                {Object.entries(stats.fundHouses)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([house, count]) => (
                  <div key={house} className="flex justify-between text-sm">
                    <span className="truncate">{house}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}