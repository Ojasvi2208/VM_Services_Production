'use client';

import { useState, useRef } from 'react';

interface CASTransaction {
  date: string;
  description: string;
  amount: number;
  units: number;
  nav: number;
  balance: number;
  type: string;
}

interface CASFolio {
  folioNumber: string;
  amc: string;
  schemeName: string;
  schemeCode?: string;
  pan: string;
  registrar: string;
  closingBalance: number;
  closingNav?: number;
  closingValue?: number;
  transactions: CASTransaction[];
}

interface ParsedCAS {
  investorName: string;
  email: string;
  pan: string;
  statementPeriod: { from: string; to: string };
  folios: CASFolio[];
  summary: {
    totalFolios: number;
    totalSchemes: number;
    totalInvested: number;
    currentValue: number;
  };
}

interface CASUploaderProps {
  onImportComplete: () => void;
}

export default function CASUploader({ onImportComplete }: CASUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCAS | null>(null);
  const [step, setStep] = useState<'upload' | 'review' | 'complete'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Use PDF.js to extract text
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password: password || undefined }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: { str?: string }) => item.str || '')
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setIsUploading(true);
    setIsParsing(true);
    setError(null);

    try {
      // Extract text from PDF
      const textContent = await extractTextFromPDF(file);

      // Send to API for parsing
      const formData = new FormData();
      formData.append('casFile', file);
      formData.append('textContent', textContent);
      if (password) {
        formData.append('password', password);
      }

      const response = await fetch('/api/portfolio/import-cas', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse CAS');
      }

      setParsedData(result.data);
      setStep('review');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process CAS statement');
    } finally {
      setIsUploading(false);
      setIsParsing(false);
    }
  };

  const handleSaveHoldings = async () => {
    if (!parsedData) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/portfolio/import-cas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folios: parsedData.folios }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save holdings');
      }

      setStep('complete');
      setTimeout(() => {
        onImportComplete();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save holdings');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const calculateXIRR = (transactions: CASTransaction[], currentValue: number): number | null => {
    // Simplified XIRR calculation - in production use a proper financial library
    if (transactions.length === 0) return null;
    
    let totalInvested = 0;
    let weightedDays = 0;
    const today = new Date();
    
    for (const tx of transactions) {
      if (tx.type === 'BUY' || tx.type === 'SIP') {
        const txDate = new Date(tx.date);
        const days = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        totalInvested += Math.abs(tx.amount);
        weightedDays += Math.abs(tx.amount) * days;
      }
    }
    
    if (totalInvested === 0) return null;
    
    const avgDays = weightedDays / totalInvested;
    const years = avgDays / 365;
    
    if (years <= 0) return null;
    
    const absoluteReturn = (currentValue - totalInvested) / totalInvested;
    const cagr = Math.pow(1 + absoluteReturn, 1 / years) - 1;
    
    return cagr * 100;
  };

  if (step === 'complete') {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-brand-navy mb-2">Import Complete!</h3>
        <p className="text-gray-600">Your mutual fund holdings have been imported successfully.</p>
      </div>
    );
  }

  if (step === 'review' && parsedData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-brand-navy">Review Imported Holdings</h3>
            <p className="text-sm text-gray-600">Verify the data before saving to your portfolio</p>
          </div>
          <button
            onClick={() => { setStep('upload'); setParsedData(null); }}
            className="text-sm text-brand-royal hover:underline"
          >
            ← Upload Different File
          </button>
        </div>

        {/* Investor Info */}
        <div className="bg-brand-navy/5 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {parsedData.investorName && (
              <div>
                <p className="text-gray-500">Investor</p>
                <p className="font-medium text-brand-navy">{parsedData.investorName}</p>
              </div>
            )}
            {parsedData.pan && (
              <div>
                <p className="text-gray-500">PAN</p>
                <p className="font-medium text-brand-navy">{parsedData.pan}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Total Schemes</p>
              <p className="font-medium text-brand-navy">{parsedData.summary.totalSchemes}</p>
            </div>
            <div>
              <p className="text-gray-500">Statement Period</p>
              <p className="font-medium text-brand-navy">
                {parsedData.statementPeriod.from || 'N/A'} - {parsedData.statementPeriod.to || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Invested</p>
            <p className="text-xl font-bold text-brand-navy">{formatCurrency(parsedData.summary.totalInvested)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Current Value</p>
            <p className="text-xl font-bold text-brand-navy">{formatCurrency(parsedData.summary.currentValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Returns</p>
            <p className={`text-xl font-bold ${parsedData.summary.currentValue >= parsedData.summary.totalInvested ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(parsedData.summary.currentValue - parsedData.summary.totalInvested)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Returns %</p>
            <p className={`text-xl font-bold ${parsedData.summary.currentValue >= parsedData.summary.totalInvested ? 'text-green-600' : 'text-red-600'}`}>
              {parsedData.summary.totalInvested > 0 
                ? ((parsedData.summary.currentValue - parsedData.summary.totalInvested) / parsedData.summary.totalInvested * 100).toFixed(2)
                : 0}%
            </p>
          </div>
        </div>

        {/* Holdings List */}
        <div className="space-y-4">
          <h4 className="font-semibold text-brand-navy">Holdings ({parsedData.folios.length})</h4>
          
          {parsedData.folios.map((folio, index) => {
            const totalInvested = folio.transactions
              .filter(t => t.type === 'BUY' || t.type === 'SIP')
              .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const currentValue = folio.closingValue || (folio.closingBalance * (folio.closingNav || 0));
            const returns = currentValue - totalInvested;
            const returnsPercent = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;
            const xirr = calculateXIRR(folio.transactions, currentValue);

            return (
              <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${folio.schemeCode ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {folio.schemeCode ? 'Matched' : 'Manual Entry Needed'}
                        </span>
                        <span className="text-xs text-gray-500">Folio: {folio.folioNumber}</span>
                      </div>
                      <h5 className="font-semibold text-brand-navy">{folio.schemeName || 'Unknown Scheme'}</h5>
                      <p className="text-sm text-gray-500">{folio.amc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-brand-navy">{formatCurrency(currentValue)}</p>
                      <p className={`text-sm font-medium ${returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {returns >= 0 ? '+' : ''}{formatCurrency(returns)} ({returnsPercent.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-gray-100 text-sm">
                    <div>
                      <p className="text-gray-500">Units</p>
                      <p className="font-medium">{folio.closingBalance.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Avg NAV</p>
                      <p className="font-medium">₹{totalInvested > 0 ? (totalInvested / folio.closingBalance).toFixed(2) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Current NAV</p>
                      <p className="font-medium">₹{folio.closingNav?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Invested</p>
                      <p className="font-medium">{formatCurrency(totalInvested)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">XIRR</p>
                      <p className={`font-medium ${xirr && xirr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {xirr ? `${xirr.toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Transactions */}
                  {folio.transactions.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-brand-royal hover:underline">
                        View {folio.transactions.length} transactions
                      </summary>
                      <div className="mt-2 max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left">Date</th>
                              <th className="px-2 py-1 text-left">Type</th>
                              <th className="px-2 py-1 text-right">Amount</th>
                              <th className="px-2 py-1 text-right">Units</th>
                              <th className="px-2 py-1 text-right">NAV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {folio.transactions.map((tx, txIndex) => (
                              <tr key={txIndex} className="border-t border-gray-100">
                                <td className="px-2 py-1">{formatDate(tx.date)}</td>
                                <td className="px-2 py-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                                    tx.type === 'BUY' || tx.type === 'SIP' ? 'bg-green-100 text-green-700' :
                                    tx.type === 'SELL' || tx.type === 'REDEMPTION' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {tx.type}
                                  </span>
                                </td>
                                <td className="px-2 py-1 text-right">{formatCurrency(tx.amount)}</td>
                                <td className="px-2 py-1 text-right">{tx.units.toFixed(3)}</td>
                                <td className="px-2 py-1 text-right">₹{tx.nav.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleSaveHoldings}
            disabled={isSaving}
            className="flex-1 py-3 bg-brand-royal text-white rounded-xl font-medium hover:bg-brand-navy transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Import to Portfolio'}
          </button>
        </div>

        {/* Info about what can't be calculated */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <h5 className="font-medium text-yellow-800 mb-2">Note on Calculations</h5>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>XIRR</strong>: Approximate calculation based on transaction dates. For exact XIRR, use a financial calculator.</li>
            <li>• <strong>Current NAV</strong>: May not be available in CAS. Will be fetched from live data after import.</li>
            <li>• <strong>Dividend/Bonus</strong>: Reinvested dividends are tracked but payout dividends may not reflect in returns.</li>
            <li>• <strong>Exit Load</strong>: Not calculated. Check with AMC for exit load applicability.</li>
            <li>• <strong>Tax (LTCG/STCG)</strong>: Not calculated. Consult a tax advisor for capital gains tax.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-brand-navy mb-2">Import CAS Statement</h3>
        <p className="text-sm text-gray-600">
          Upload your Consolidated Account Statement (CAS) from CAMS or KFintech to automatically import all your mutual fund holdings.
        </p>
      </div>

      {/* How to get CAS */}
      <div className="bg-brand-navy/5 rounded-xl p-4">
        <h4 className="font-medium text-brand-navy mb-2">How to get your CAS?</h4>
        <ol className="text-sm text-gray-600 space-y-2">
          <li>1. Visit <a href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" target="_blank" rel="noopener noreferrer" className="text-brand-royal hover:underline">CAMS</a> or <a href="https://mfs.kfintech.com/investor/General/ConsolidatedAccountStatement" target="_blank" rel="noopener noreferrer" className="text-brand-royal hover:underline">KFintech</a></li>
          <li>2. Enter your PAN and email address</li>
          <li>3. Select "Detailed" statement type</li>
          <li>4. Choose date range (preferably from your first investment)</li>
          <li>5. Download the PDF and upload here</li>
        </ol>
      </div>

      {/* Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-brand-royal hover:bg-brand-royal/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {file ? (
          <div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-green-700">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="mt-2 text-sm text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="font-medium text-gray-700">Click to upload CAS PDF</p>
            <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
          </div>
        )}
      </div>

      {/* Password field for encrypted PDFs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          PDF Password (if encrypted)
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Usually your PAN or date of birth"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-royal focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          CAS PDFs are often password protected with your PAN (e.g., ABCDE1234F) or DOB (e.g., 01011990)
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full py-3 bg-brand-royal text-white rounded-xl font-medium hover:bg-brand-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {isParsing ? 'Parsing CAS...' : 'Uploading...'}
          </span>
        ) : (
          'Upload & Parse CAS'
        )}
      </button>

      {/* Data we can extract */}
      <div className="p-4 bg-gray-50 rounded-xl">
        <h5 className="font-medium text-gray-700 mb-2">What we extract from CAS:</h5>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Scheme Names & AMC
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Folio Numbers
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Units & NAV
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            All Transactions
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Purchase Dates
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Investment Amounts
          </div>
        </div>
      </div>
    </div>
  );
}
