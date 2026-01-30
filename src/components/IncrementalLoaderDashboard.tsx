'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  PlayCircle, 
  PauseCircle, 
  BarChart3, 
  Database, 
  Search, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

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

  // Auto-processing loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoProcess && stats && !stats.progress || stats.progress < 100) {
      interval = setInterval(async () => {
        if (!isProcessing) {
          await processNextBatch();
        }
      }, 2000); // Process every 2 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoProcess, stats, isProcessing]);

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

  const processNextBatch = async () => {
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
  };

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
            <Database className="h-10 w-10 text-blue-600" />
            Incremental Fund Loader
          </h1>
          <p className="text-slate-600">Smart one-at-a-time fund processing to prevent server crashes</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Total Funds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalFunds?.toLocaleString() || '0'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Processed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.processedFunds?.toLocaleString() || '0'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.progress?.toFixed(1) || '0'}%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={`text-xs ${isProcessing ? 'bg-yellow-400' : stats?.progress === 100 ? 'bg-green-400' : 'bg-blue-400'} text-black`}>
                {isProcessing ? 'Processing...' : stats?.progress === 100 ? 'Complete' : 'Ready'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Processing Progress</span>
                <Button
                  onClick={loadStats}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={stats.progress} className="h-3" />
              <div className="flex justify-between text-sm text-slate-600">
                <span>{stats.processedFunds.toLocaleString()} funds processed</span>
                <span>{(stats.totalFunds - stats.processedFunds).toLocaleString()} remaining</span>
              </div>
              <div className="text-xs text-slate-500">
                Last updated: {formatTime(stats.lastUpdated)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Processing Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Batch Size:</label>
                <Input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                  className="w-20"
                  min="1"
                  max="100"
                />
              </div>
              
              <Button
                onClick={processNextBatch}
                disabled={isProcessing || stats?.progress === 100}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Process Batch
              </Button>
              
              <Button
                onClick={() => setAutoProcess(!autoProcess)}
                variant={autoProcess ? "destructive" : "secondary"}
                disabled={stats?.progress === 100}
                className="flex items-center gap-2"
              >
                {autoProcess ? (
                  <PauseCircle className="h-4 w-4" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                {autoProcess ? 'Stop Auto' : 'Start Auto'}
              </Button>
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
          </CardContent>
        </Card>

        {/* Search Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Quick Search (Processed Funds Only)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search funds by name, category, or fund house..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            
            {searchResults && (
              <div className="space-y-2">
                <div className="text-sm text-slate-600">
                  Found {searchResults.count} results for "{searchResults.query}"
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
          </CardContent>
        </Card>

        {/* Categories Overview */}
        {stats && Object.keys(stats.categories).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Fund Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.categories).map(([category, count]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span>{category}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Top Fund Houses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.fundHouses)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .map(([house, count]) => (
                    <div key={house} className="flex justify-between text-sm">
                      <span className="truncate">{house}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}