'use client';

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

interface ReturnsTableProps {
  returns: Returns | null;
}

export default function ReturnsTable({ returns }: ReturnsTableProps) {
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

  const periods = [
    { label: '1 Week', abs: returns.return1w, cagr: null },
    { label: '1 Month', abs: returns.return1m, cagr: null },
    { label: '3 Months', abs: returns.return3m, cagr: null },
    { label: '6 Months', abs: returns.return6m, cagr: null },
    { label: '1 Year', abs: returns.return1y, cagr: returns.cagr1y },
    { label: '2 Years', abs: returns.return2y, cagr: returns.cagr2y },
    { label: '3 Years', abs: returns.return3y, cagr: returns.cagr3y },
    { label: '5 Years', abs: returns.return5y, cagr: returns.cagr5y },
    { label: '7 Years', abs: returns.return7y, cagr: returns.cagr7y },
    { label: '10 Years', abs: returns.return10y, cagr: returns.cagr10y },
    { label: 'Since Inception', abs: returns.returnInception, cagr: returns.cagrInception },
  ];

  const formatReturn = (value?: number | string | null) => {
    if (value === undefined || value === null) return '-';
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return `${numValue > 0 ? '+' : ''}${numValue.toFixed(2)}%`;
  };

  const getReturnColor = (value?: number | string | null) => {
    if (value === undefined || value === null) return 'text-brand-navy/50';
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'text-brand-navy/50';
    return numValue >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
  };

  return (
    <div className="card-light overflow-hidden">
      <div className="bg-brand-royal text-white px-6 py-4">
        <h3 className="text-xl font-bold">Returns Performance</h3>
        <p className="text-sm text-white/80">Historical returns across different time periods</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-brand-pearl">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-brand-navy">Period</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-brand-navy">Absolute Return</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-brand-navy">CAGR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {periods.map((period, index) => (
              <tr key={index} className="hover:bg-brand-pearl/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-brand-navy">
                  {period.label}
                </td>
                <td className={`px-6 py-4 text-sm text-right ${getReturnColor(period.abs)}`}>
                  {formatReturn(period.abs)}
                </td>
                <td className={`px-6 py-4 text-sm text-right ${getReturnColor(period.cagr)}`}>
                  {period.cagr !== null ? formatReturn(period.cagr) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 px-6 py-3 text-xs text-brand-navy/60">
        <p>
          <span className="font-semibold">Note:</span> Past performance is not indicative of future results. 
          Returns are calculated based on NAV changes and do not include dividends.
        </p>
      </div>
    </div>
  );
}
