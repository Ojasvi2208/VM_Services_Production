'use client';

import { useMemo } from 'react';

interface NAVPoint {
  date: string;
  nav: number;
}

interface NAVChartProps {
  data: NAVPoint[];
  fundName?: string;
}

export default function NAVChart({ data, fundName }: NAVChartProps) {
  // Calculate min and max for scaling
  const { minNav, maxNav, navRange } = useMemo(() => {
    if (data.length === 0) return { minNav: 0, maxNav: 100, navRange: 100 };
    
    const navValues = data.map(d => parseFloat(d.nav.toString()));
    const min = Math.min(...navValues);
    const max = Math.max(...navValues);
    const range = max - min;
    
    return {
      minNav: min - (range * 0.1), // 10% padding
      maxNav: max + (range * 0.1),
      navRange: range * 1.2
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="card-light p-12 text-center">
        <div className="text-4xl mb-4">📈</div>
        <h3 className="text-xl font-semibold text-brand-navy mb-2">NAV Chart</h3>
        <p className="text-brand-navy/70">
          Historical NAV data will be available once imported
        </p>
      </div>
    );
  }

  // Simple SVG line chart
  const width = 800;
  const height = 400;
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  // Create path for line chart
  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const navValue = parseFloat(point.nav.toString());
    const y = padding + chartHeight - ((navValue - minNav) / navRange) * chartHeight;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;

  // Create area fill
  const areaPath = `${linePath} L ${padding + chartWidth},${padding + chartHeight} L ${padding},${padding + chartHeight} Z`;

  return (
    <div className="card-light overflow-hidden">
      <div className="bg-brand-royal text-white px-6 py-4">
        <h3 className="text-xl font-bold">NAV History</h3>
        <p className="text-sm text-white/80">
          {fundName || 'Fund'} - Last {data.length} days
        </p>
      </div>

      <div className="p-6">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ maxHeight: '400px' }}
        >
          {/* Grid lines */}
          <g className="grid-lines" stroke="#e5e7eb" strokeWidth="1">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding + chartHeight * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={padding}
                  y1={y}
                  x2={padding + chartWidth}
                  y2={y}
                  strokeDasharray="4 4"
                />
              );
            })}
          </g>

          {/* Area fill */}
          <path
            d={areaPath}
            fill="url(#gradient)"
            opacity="0.3"
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#1e40af"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e40af" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1e40af" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis labels */}
          <g className="y-axis-labels" fill="#6b7280" fontSize="12">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding + chartHeight * (1 - ratio);
              const value = minNav + navRange * ratio;
              return (
                <text
                  key={ratio}
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                >
                  ₹{parseFloat(value.toString()).toFixed(2)}
                </text>
              );
            })}
          </g>

          {/* X-axis labels */}
          <g className="x-axis-labels" fill="#6b7280" fontSize="12">
            {[0, 0.5, 1].map((ratio) => {
              const index = Math.floor(ratio * (data.length - 1));
              const x = padding + ratio * chartWidth;
              const dateStr = data[index]?.date;
              const date = dateStr ? new Date(dateStr).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric'
              }) : '';
              return (
                <text
                  key={ratio}
                  x={x}
                  y={padding + chartHeight + 20}
                  textAnchor="middle"
                >
                  {date}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm text-brand-navy/60">Current NAV</p>
            <p className="text-2xl font-bold text-brand-royal">
              ₹{data[data.length - 1]?.nav ? parseFloat(data[data.length - 1].nav.toString()).toFixed(4) : 'N/A'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-brand-navy/60">Highest</p>
            <p className="text-2xl font-bold text-green-600">
              ₹{maxNav ? parseFloat(maxNav.toString()).toFixed(4) : 'N/A'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-brand-navy/60">Lowest</p>
            <p className="text-2xl font-bold text-red-600">
              ₹{minNav ? parseFloat(minNav.toString()).toFixed(4) : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
