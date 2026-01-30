'use client';

import { useState, useEffect, useCallback } from 'react';

interface LoaderProgress {
  currentScheme: number;
  totalSchemes: number;
  processedSchemes: number;
  failedSchemes: number;
  currentSchemeName: string;
  phase: 'HISTORICAL' | 'LATEST' | 'COMPLETE';
  startTime: string;
  estimatedCompletion?: string;
  errors: { schemeCode: number; error: string }[];
  successRate: number;
  estimatedTimeRemaining: string;
  processingSpeed: number;
}

export default function HistoricalDataDashboard() {
  const [progress, setProgress] = useState<LoaderProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoLoad, setAutoLoad] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Load initial progress
  useEffect(() => {
    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-loading loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoLoad && progress && progress.phase !== 'COMPLETE') {
      interval = setInterval(() => {
        if (!isLoading) {
          loadNextBatch();
        }
      }, 3000); // Process every 3 seconds (API-friendly)
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoLoad, progress, isLoading, loadNextBatch]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  const loadProgress = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/historical-loader?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data);
        addLog(`Loaded progress: ${data.data.processedSchemes}/${data.data.totalSchemes} schemes`);
      } else {
        setError(data.error || 'Failed to load progress');
        addLog(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
      setError('Network error while loading progress');
      addLog('Network error while loading progress');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNextBatch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      addLog(`Starting batch load of ${batchSize} schemes...`);
      
      const response = await fetch(`/api/historical-loader?action=load&batchSize=${batchSize}`);
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data);
        addLog(data.message);
        
        if (data.data.phase === 'COMPLETE') {
          setAutoLoad(false);
          addLog('🎉 Historical data loading complete!');
        }
      } else {
        setError(data.error || 'Failed to load batch');
        addLog(`Batch load failed: ${data.error}`);
        setAutoLoad(false);
      }
    } catch (err) {
      console.error('Failed to load batch:', err);
      setError('Network error during batch loading');
      addLog('Network error during batch loading');
      setAutoLoad(false);
    } finally {
      setIsLoading(false);
    }
  }, [batchSize]);

  const updateLatestData = async () => {
    if (!progress) return;
    
    try {
      setIsLoading(true);
      addLog('Updating latest NAV data...');
      
      // Get first 100 scheme codes for update
      const schemeCodes = Array.from({ length: Math.min(100, progress.processedSchemes) }, (_, i) => i + 1);
      
      const response = await fetch('/api/historical-loader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateLatest',
          schemeCodes
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        addLog(`Latest update: ${data.data.updated} updated, ${data.data.failed} failed`);
      } else {
        addLog(`Latest update failed: ${data.error}`);
      }
    } catch {
      addLog('Network error during latest update');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'HISTORICAL': return 'text-blue-600 bg-blue-100';
      case 'LATEST': return 'text-green-600 bg-green-100';
      case 'COMPLETE': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center justify-center gap-3">
            📈 Historical Data Loader
          </h1>
          <p className="text-gray-600">Loading complete historical NAV data from MF API (api.mfapi.in)</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">❌ {error}</span>
            </div>
          </div>
        )}

        {/* Main Progress Dashboard */}
        {progress && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6">
              <div className="text-sm font-medium">📊 Total Schemes</div>
              <div className="text-2xl font-bold mt-2">
                {progress.totalSchemes.toLocaleString()}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6">
              <div className="text-sm font-medium">✅ Processed</div>
              <div className="text-2xl font-bold mt-2">
                {progress.processedSchemes.toLocaleString()}
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6">
              <div className="text-sm font-medium">📈 Success Rate</div>
              <div className="text-2xl font-bold mt-2">
                {progress.successRate.toFixed(1)}%
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6">
              <div className="text-sm font-medium">⚡ Speed</div>
              <div className="text-2xl font-bold mt-2">
                {progress.processingSpeed.toFixed(1)}
              </div>
              <div className="text-xs opacity-80">schemes/min</div>
            </div>

            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg p-6">
              <div className="text-sm font-medium">⏱️ ETA</div>
              <div className="text-lg font-bold mt-2">
                {progress.estimatedTimeRemaining}
              </div>
            </div>
          </div>
        )}

        {/* Phase and Progress */}
        {progress && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Loading Progress</h3>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(progress.phase)}`}>
                {progress.phase}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${(progress.processedSchemes / progress.totalSchemes) * 100}%` }}
                >
                  {((progress.processedSchemes / progress.totalSchemes) * 100).toFixed(1)}%
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Current Scheme:</span>
                  <div className="text-gray-600 truncate">{progress.currentSchemeName || 'N/A'}</div>
                </div>
                <div>
                  <span className="font-medium">Progress:</span>
                  <div className="text-gray-600">{progress.processedSchemes} / {progress.totalSchemes}</div>
                </div>
                <div>
                  <span className="font-medium">Failed:</span>
                  <div className="text-red-600">{progress.failedSchemes}</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                Started: {formatTime(progress.startTime)}
              </div>
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">🎮 Control Panel</h3>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Batch Size:</label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                  className="w-20 px-2 py-1 border rounded"
                  min="1"
                  max="50"
                />
                <span className="text-xs text-gray-500">(1-50 recommended for API limits)</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadProgress}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '⏳' : '🔄'} Refresh Progress
              </button>
              
              <button
                onClick={loadNextBatch}
                disabled={isLoading || progress?.phase === 'COMPLETE'}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '⏳' : '📥'} Load Next Batch
              </button>
              
              <button
                onClick={() => setAutoLoad(!autoLoad)}
                disabled={progress?.phase === 'COMPLETE'}
                className={`px-4 py-2 rounded text-white ${
                  autoLoad ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'
                } disabled:opacity-50`}
              >
                {autoLoad ? '⏸️ Stop Auto Load' : '▶️ Start Auto Load'}
              </button>
              
              <button
                onClick={updateLatestData}
                disabled={isLoading || !progress || progress.processedSchemes === 0}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Update Latest NAVs
              </button>
            </div>
            
            {autoLoad && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm text-yellow-800">
                  🔄 Auto-loading enabled - processing {batchSize} schemes every 3 seconds
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Logs */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">📋 Activity Logs</h3>
          
          <div className="bg-gray-50 rounded p-4 h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No logs yet</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-gray-700">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error Summary */}
        {progress && progress.errors.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-red-600">❌ Failed Schemes ({progress.errors.length})</h3>
            
            <div className="bg-red-50 rounded p-4 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {progress.errors.slice(0, 20).map((error, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">Scheme {error.schemeCode}:</span>
                    <span className="text-red-600 ml-2">{error.error}</span>
                  </div>
                ))}
                {progress.errors.length > 20 && (
                  <div className="text-sm text-gray-500">
                    ... and {progress.errors.length - 20} more errors
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* API Information */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">🌐 API Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Historical Data API:</h4>
              <code className="bg-gray-100 px-2 py-1 rounded">https://api.mfapi.in/mf/[scheme_code]</code>
              <p className="text-gray-600 mt-1">Fetches complete historical NAV data for each fund</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Latest Data API:</h4>
              <code className="bg-gray-100 px-2 py-1 rounded">https://api.mfapi.in/mf/[scheme_code]/latest</code>
              <p className="text-gray-600 mt-1">Fetches only the latest NAV (for daily updates)</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p className="text-sm text-blue-800">
              <strong>Strategy:</strong> Load all historical data once (Phase 1), then only fetch latest NAVs daily (Phase 2).
              This minimizes API calls while keeping data current.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}