'use client';

import { useState, useEffect } from 'react';

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

export default function SimpleHistoricalDashboard() {
  const [progress, setProgress] = useState<LoaderProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(5);

  const loadProgress = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/historical-loader?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data);
      } else {
        setError(data.error || 'Failed to load progress');
      }
    } catch {
      setError('Network error while loading progress');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNextBatch = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/historical-loader?action=load&batchSize=${batchSize}`);
      const data = await response.json();
      
      if (data.success) {
        setProgress(data.data);
      } else {
        setError(data.error || 'Failed to load batch');
      }
    } catch {
      setError('Network error during batch loading');
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial progress
  useEffect(() => {
    loadProgress();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-800">📈 Historical Data Loader</h1>
          <p className="text-gray-600">Loading complete historical NAV data from MF API</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-700">❌ {error}</div>
          </div>
        )}

        {/* Stats Cards */}
        {progress && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-500 text-white rounded-lg p-6 text-center">
              <div className="text-sm">Total Schemes</div>
              <div className="text-2xl font-bold">{progress.totalSchemes}</div>
            </div>
            <div className="bg-green-500 text-white rounded-lg p-6 text-center">
              <div className="text-sm">Processed</div>
              <div className="text-2xl font-bold">{progress.processedSchemes}</div>
            </div>
            <div className="bg-purple-500 text-white rounded-lg p-6 text-center">
              <div className="text-sm">Success Rate</div>
              <div className="text-2xl font-bold">{progress.successRate.toFixed(1)}%</div>
            </div>
            <div className="bg-orange-500 text-white rounded-lg p-6 text-center">
              <div className="text-sm">Status</div>
              <div className="text-lg font-bold">{progress.phase}</div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {progress && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Progress</h3>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${(progress.processedSchemes / progress.totalSchemes) * 100}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-600">
              {progress.processedSchemes} / {progress.totalSchemes} schemes processed
            </div>
            {progress.currentSchemeName && (
              <div className="text-sm text-gray-500 mt-2">
                Current: {progress.currentSchemeName}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Controls</h3>
          <div className="flex gap-4 items-center">
            <div>
              <label className="text-sm font-medium">Batch Size:</label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                className="ml-2 w-16 px-2 py-1 border rounded"
                min="1"
                max="20"
              />
            </div>
            
            <button
              onClick={loadProgress}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? '⏳' : '🔄'} Refresh
            </button>
            
            <button
              onClick={loadNextBatch}
              disabled={isLoading || progress?.phase === 'COMPLETE'}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isLoading ? '⏳' : '📥'} Load Next Batch
            </button>
          </div>
        </div>

        {/* API Info */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">🌐 API Information</h3>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Historical Data:</strong> <code className="bg-gray-100 px-2 py-1 rounded">https://api.mfapi.in/mf/[scheme_code]</code>
            </div>
            <div>
              <strong>Latest Data:</strong> <code className="bg-gray-100 px-2 py-1 rounded">https://api.mfapi.in/mf/[scheme_code]/latest</code>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded">
              <strong>Strategy:</strong> Load all historical data once, then only fetch latest NAVs for daily updates.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}