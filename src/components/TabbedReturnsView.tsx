'use client';

import { useState } from 'react';

interface Returns {
  return1w?: number | string;
  return1m?: number | string;
  return3m?: number | string;
  return6m?: number | string;
  return1y?: number | string;
  return2y?: number | string;
  return3y?: number | string;
  return5y?: number | string;
  return7y?: number | string;
  return10y?: number | string;
  returnInception?: number | string;
  cagr1y?: number | string;
  cagr2y?: number | string;
  cagr3y?: number | string;
  cagr5y?: number | string;
  cagr7y?: number | string;
  cagr10y?: number | string;
  cagrInception?: number | string;
}

interface TabbedReturnsViewProps {
  returns: Returns | null;
}

interface Period {
  id: string;
  label: string;
  shortLabel: string;
  absoluteReturn?: number | string;
  cagr?: number | string;
}

export default function TabbedReturnsView({ returns }: TabbedReturnsViewProps) {
  if (!returns) {
    return (
      <div className="card-light p-8 text-center">
        <p className="text-brand-navy/70">Returns data not available yet</p>
        <p className="text-sm text-brand-navy/50 mt-2">
          Returns will be calculated once historical NAV data is imported
        </p>
      </div>
    );
  }

  // Build available periods dynamically based on what data exists
  const allPeriods: Period[] = [
    { id: '1w', label: '1 Week', shortLabel: '1W', absoluteReturn: returns.return1w, cagr: undefined },
    { id: '1m', label: '1 Month', shortLabel: '1M', absoluteReturn: returns.return1m, cagr: undefined },
    { id: '3m', label: '3 Months', shortLabel: '3M', absoluteReturn: returns.return3m, cagr: undefined },
    { id: '6m', label: '6 Months', shortLabel: '6M', absoluteReturn: returns.return6m, cagr: undefined },
    { id: '1y', label: '1 Year', shortLabel: '1Y', absoluteReturn: returns.return1y, cagr: returns.cagr1y },
    { id: '2y', label: '2 Years', shortLabel: '2Y', absoluteReturn: returns.return2y, cagr: returns.cagr2y },
    { id: '3y', label: '3 Years', shortLabel: '3Y', absoluteReturn: returns.return3y, cagr: returns.cagr3y },
    { id: '5y', label: '5 Years', shortLabel: '5Y', absoluteReturn: returns.return5y, cagr: returns.cagr5y },
    { id: '7y', label: '7 Years', shortLabel: '7Y', absoluteReturn: returns.return7y, cagr: returns.cagr7y },
    { id: '10y', label: '10 Years', shortLabel: '10Y', absoluteReturn: returns.return10y, cagr: returns.cagr10y },
    { id: 'inception', label: 'Since Inception', shortLabel: 'Inception', absoluteReturn: returns.returnInception, cagr: returns.cagrInception },
  ];

  // Filter to only show periods with data
  const availablePeriods = allPeriods.filter(period => {
    const value = period.absoluteReturn;
    if (value === undefined || value === null) return false;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(numValue);
  });

  const [selectedPeriod, setSelectedPeriod] = useState<Period>(
    availablePeriods.length > 0 ? availablePeriods[0] : allPeriods[0]
  );

  const formatReturn = (value?: number | string | null) => {
    if (value === undefined || value === null) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return numValue.toFixed(2);
  };

  const getReturnColor = (value?: number | string | null) => {
    if (value === undefined || value === null) return 'text-brand-navy/50';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'text-brand-navy/50';
    return numValue >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getReturnBgColor = (value?: number | string | null) => {
    if (value === undefined || value === null) return 'bg-gray-100';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'bg-gray-100';
    return numValue >= 0 ? 'bg-green-50' : 'bg-red-50';
  };

  const absoluteValue = formatReturn(selectedPeriod.absoluteReturn);
  const cagrValue = formatReturn(selectedPeriod.cagr);
  const hasAbsolute = absoluteValue !== '-';
  const hasCagr = cagrValue !== '-';

  return (
    <div className="card-light overflow-hidden">
      {/* Header */}
      <div className="bg-brand-royal text-white px-6 py-4">
        <h3 className="text-xl font-bold">Returns Performance</h3>
        <p className="text-sm text-white/80">Select a time period to view returns</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex overflow-x-auto scrollbar-hide">
          {availablePeriods.map((period) => (
            <button
              key={period.id}
              onClick={() => setSelectedPeriod(period)}
              className={`
                px-6 py-4 text-sm font-medium whitespace-nowrap transition-all
                border-b-2 hover:bg-white/50
                ${
                  selectedPeriod.id === period.id
                    ? 'border-brand-royal text-brand-royal bg-white'
                    : 'border-transparent text-brand-navy/60 hover:text-brand-navy'
                }
              `}
            >
              {period.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Period Title */}
        <div className="text-center mb-8">
          <h4 className="text-2xl font-bold text-brand-navy mb-2">
            {selectedPeriod.label}
          </h4>
          <p className="text-sm text-brand-navy/60">
            Performance metrics for the selected period
          </p>
        </div>

        {/* Returns Display */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Absolute Return Card */}
          <div className={`rounded-xl p-6 border-2 ${getReturnBgColor(selectedPeriod.absoluteReturn)} ${hasAbsolute ? 'border-gray-200' : 'border-gray-300'}`}>
            <div className="text-center">
              <div className="text-sm font-medium text-brand-navy/60 mb-2">
                Absolute Return
              </div>
              {hasAbsolute ? (
                <>
                  <div className={`text-5xl font-bold ${getReturnColor(selectedPeriod.absoluteReturn)} mb-2`}>
                    {parseFloat(absoluteValue) > 0 ? '+' : ''}{absoluteValue}%
                  </div>
                  <div className="text-xs text-brand-navy/50">
                    Total return over {selectedPeriod.label.toLowerCase()}
                  </div>
                </>
              ) : (
                <div className="text-3xl font-bold text-brand-navy/30">
                  No Data
                </div>
              )}
            </div>
          </div>

          {/* CAGR Card */}
          <div className={`rounded-xl p-6 border-2 ${getReturnBgColor(selectedPeriod.cagr)} ${hasCagr ? 'border-gray-200' : 'border-gray-300'}`}>
            <div className="text-center">
              <div className="text-sm font-medium text-brand-navy/60 mb-2">
                CAGR (Annualized)
              </div>
              {hasCagr ? (
                <>
                  <div className={`text-5xl font-bold ${getReturnColor(selectedPeriod.cagr)} mb-2`}>
                    {parseFloat(cagrValue) > 0 ? '+' : ''}{cagrValue}%
                  </div>
                  <div className="text-xs text-brand-navy/50">
                    Compound annual growth rate
                  </div>
                </>
              ) : (
                <div className="text-3xl font-bold text-brand-navy/30">
                  {selectedPeriod.id === '1w' || selectedPeriod.id === '1m' || 
                   selectedPeriod.id === '3m' || selectedPeriod.id === '6m' 
                    ? 'N/A' 
                    : 'No Data'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 mt-0.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-blue-900 mb-1">
                Understanding Returns
              </h5>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>Absolute Return:</strong> Total percentage change in NAV over the period</li>
                <li>• <strong>CAGR:</strong> Compound Annual Growth Rate - annualized return (available for periods ≥ 1 year)</li>
                <li>• Returns are calculated based on NAV changes and do not include dividends</li>
              </ul>
            </div>
          </div>
        </div>

        {/* All Periods Summary Table */}
        <div className="mt-8">
          <h5 className="text-sm font-semibold text-brand-navy mb-4">Quick Comparison</h5>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-brand-navy/70">Period</th>
                  <th className="px-4 py-2 text-right font-medium text-brand-navy/70">Absolute Return</th>
                  <th className="px-4 py-2 text-right font-medium text-brand-navy/70">CAGR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {availablePeriods.map((period) => (
                  <tr 
                    key={period.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedPeriod.id === period.id ? 'bg-brand-pearl' : ''
                    }`}
                    onClick={() => setSelectedPeriod(period)}
                  >
                    <td className="px-4 py-3 font-medium text-brand-navy">
                      {period.label}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${getReturnColor(period.absoluteReturn)}`}>
                      {formatReturn(period.absoluteReturn) !== '-' 
                        ? `${parseFloat(formatReturn(period.absoluteReturn)) > 0 ? '+' : ''}${formatReturn(period.absoluteReturn)}%`
                        : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${getReturnColor(period.cagr)}`}>
                      {formatReturn(period.cagr) !== '-' 
                        ? `${parseFloat(formatReturn(period.cagr)) > 0 ? '+' : ''}${formatReturn(period.cagr)}%`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-gray-50 px-6 py-3 text-xs text-brand-navy/60 border-t border-gray-200">
        <p>
          <span className="font-semibold">Note:</span> Past performance is not indicative of future results. 
          Returns shown are based on historical NAV data.
        </p>
      </div>
    </div>
  );
}
