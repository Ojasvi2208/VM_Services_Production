'use client';

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface SIPCalculation {
  monthlyInvestment: number;
  years: number;
  expectedReturn: number;
  stepUp: number;
  inflationRate: number;
  totalInvested: number;
  futureValue: number;
  wealthGained: number;
  yearlyData: {
    year: number;
    invested: number;
    value: number;
    gain: number;
  }[];
}

export default function AdvancedSIPCalculator() {
  const [monthlyInvestment, setMonthlyInvestment] = useState(10000);
  const [years, setYears] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [stepUp, setStepUp] = useState(10);
  const [inflationRate, setInflationRate] = useState(6);
  const [calculationType, setCalculationType] = useState<'regular' | 'stepup'>('regular');

  // Calculate SIP
  const calculation = useMemo((): SIPCalculation => {
    const monthlyRate = expectedReturn / 100 / 12;
    const months = years * 12;
    let totalInvested = 0;
    let futureValue = 0;
    const yearlyData: SIPCalculation['yearlyData'] = [];

    if (calculationType === 'regular') {
      // Regular SIP calculation
      totalInvested = monthlyInvestment * months;
      futureValue = monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);

      // Yearly breakdown
      for (let year = 1; year <= years; year++) {
        const monthsElapsed = year * 12;
        const invested = monthlyInvestment * monthsElapsed;
        const value = monthlyInvestment * ((Math.pow(1 + monthlyRate, monthsElapsed) - 1) / monthlyRate) * (1 + monthlyRate);
        
        yearlyData.push({
          year,
          invested,
          value,
          gain: value - invested,
        });
      }
    } else {
      // Step-up SIP calculation
      let currentMonthly = monthlyInvestment;
      let balance = 0;

      for (let year = 1; year <= years; year++) {
        for (let month = 1; month <= 12; month++) {
          totalInvested += currentMonthly;
          balance = (balance + currentMonthly) * (1 + monthlyRate);
        }

        yearlyData.push({
          year,
          invested: totalInvested,
          value: balance,
          gain: balance - totalInvested,
        });

        // Increase monthly investment by step-up percentage
        currentMonthly = currentMonthly * (1 + stepUp / 100);
      }

      futureValue = balance;
    }

    return {
      monthlyInvestment,
      years,
      expectedReturn,
      stepUp,
      inflationRate,
      totalInvested,
      futureValue,
      wealthGained: futureValue - totalInvested,
      yearlyData,
    };
  }, [monthlyInvestment, years, expectedReturn, stepUp, calculationType, inflationRate]);

  // Calculate inflation-adjusted value
  const inflationAdjustedValue = calculation.futureValue / Math.pow(1 + inflationRate / 100, years);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    } else {
      return `₹${value.toLocaleString('en-IN')}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-brand-navy">Advanced SIP Calculator</h2>
        <p className="text-brand-navy/70 mt-1">Plan your wealth creation journey with precision</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="card-light p-6 space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-brand-navy mb-4">Investment Details</h3>
            
            {/* SIP Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-brand-navy mb-2">SIP Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCalculationType('regular')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    calculationType === 'regular'
                      ? 'bg-brand-royal text-white shadow-lg'
                      : 'bg-gray-100 text-brand-navy hover:bg-gray-200'
                  }`}
                >
                  Regular SIP
                </button>
                <button
                  onClick={() => setCalculationType('stepup')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    calculationType === 'stepup'
                      ? 'bg-brand-royal text-white shadow-lg'
                      : 'bg-gray-100 text-brand-navy hover:bg-gray-200'
                  }`}
                >
                  Step-up SIP
                </button>
              </div>
            </div>

            {/* Monthly Investment */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-brand-navy mb-2">
                Monthly Investment
              </label>
              <input
                type="range"
                min="500"
                max="100000"
                step="500"
                value={monthlyInvestment}
                onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
                className="w-full h-2 bg-brand-pearl rounded-lg appearance-none cursor-pointer accent-brand-royal"
              />
              <div className="flex justify-between mt-2">
                <span className="text-sm text-brand-navy/60">₹500</span>
                <span className="text-lg font-bold text-brand-royal">
                  ₹{monthlyInvestment.toLocaleString('en-IN')}
                </span>
                <span className="text-sm text-brand-navy/60">₹1,00,000</span>
              </div>
            </div>

            {/* Investment Period */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-brand-navy mb-2">
                Investment Period (Years)
              </label>
              <input
                type="range"
                min="1"
                max="40"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full h-2 bg-brand-pearl rounded-lg appearance-none cursor-pointer accent-brand-royal"
              />
              <div className="flex justify-between mt-2">
                <span className="text-sm text-brand-navy/60">1 year</span>
                <span className="text-lg font-bold text-brand-royal">{years} years</span>
                <span className="text-sm text-brand-navy/60">40 years</span>
              </div>
            </div>

            {/* Expected Return */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-brand-navy mb-2">
                Expected Annual Return (%)
              </label>
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(Number(e.target.value))}
                className="w-full h-2 bg-brand-pearl rounded-lg appearance-none cursor-pointer accent-brand-royal"
              />
              <div className="flex justify-between mt-2">
                <span className="text-sm text-brand-navy/60">1%</span>
                <span className="text-lg font-bold text-brand-royal">{expectedReturn}%</span>
                <span className="text-sm text-brand-navy/60">30%</span>
              </div>
            </div>

            {/* Step-up Percentage (only for step-up SIP) */}
            {calculationType === 'stepup' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-brand-navy mb-2">
                  Annual Step-up (%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={stepUp}
                  onChange={(e) => setStepUp(Number(e.target.value))}
                  className="w-full h-2 bg-brand-pearl rounded-lg appearance-none cursor-pointer accent-brand-gold"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-sm text-brand-navy/60">0%</span>
                  <span className="text-lg font-bold text-brand-gold">{stepUp}%</span>
                  <span className="text-sm text-brand-navy/60">30%</span>
                </div>
              </div>
            )}

            {/* Inflation Rate */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-brand-navy mb-2">
                Expected Inflation (%)
              </label>
              <input
                type="range"
                min="0"
                max="15"
                step="0.5"
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
                className="w-full h-2 bg-brand-pearl rounded-lg appearance-none cursor-pointer accent-brand-navy"
              />
              <div className="flex justify-between mt-2">
                <span className="text-sm text-brand-navy/60">0%</span>
                <span className="text-lg font-bold text-brand-navy">{inflationRate}%</span>
                <span className="text-sm text-brand-navy/60">15%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card-light p-6 bg-gradient-to-br from-brand-royal to-brand-navy text-white">
              <p className="text-sm opacity-90 mb-1">Total Invested</p>
              <p className="text-3xl font-bold">{formatCurrency(calculation.totalInvested)}</p>
            </div>
            
            <div className="card-light p-6 bg-gradient-to-br from-brand-gold to-yellow-500 text-white">
              <p className="text-sm opacity-90 mb-1">Future Value</p>
              <p className="text-3xl font-bold">{formatCurrency(calculation.futureValue)}</p>
            </div>
            
            <div className="card-light p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
              <p className="text-sm opacity-90 mb-1">Wealth Gained</p>
              <p className="text-3xl font-bold">{formatCurrency(calculation.wealthGained)}</p>
            </div>
            
            <div className="card-light p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <p className="text-sm opacity-90 mb-1">Today's Value</p>
              <p className="text-3xl font-bold">{formatCurrency(inflationAdjustedValue)}</p>
              <p className="text-xs opacity-75 mt-1">Inflation adjusted</p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="card-light p-6">
            <h3 className="text-lg font-semibold text-brand-navy mb-4">Key Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-brand-navy/70">Total Months</span>
                <span className="font-semibold text-brand-navy">{years * 12} months</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-navy/70">Return on Investment</span>
                <span className="font-semibold text-green-600">
                  {((calculation.wealthGained / calculation.totalInvested) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-navy/70">Absolute Returns</span>
                <span className="font-semibold text-brand-royal">
                  {formatCurrency(calculation.wealthGained)}
                </span>
              </div>
              {calculationType === 'stepup' && (
                <div className="flex justify-between items-center">
                  <span className="text-brand-navy/70">Final Monthly SIP</span>
                  <span className="font-semibold text-brand-gold">
                    ₹{Math.round(monthlyInvestment * Math.pow(1 + stepUp / 100, years - 1)).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wealth Growth Chart */}
      <div className="card-light p-6">
        <h3 className="text-xl font-semibold text-brand-navy mb-4">Wealth Growth Projection</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={calculation.yearlyData}>
            <defs>
              <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2E5984" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#2E5984" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C5A572" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#C5A572" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="year" 
              stroke="#1B365D"
              label={{ value: 'Years', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              stroke="#1B365D"
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '2px solid #2E5984',
                borderRadius: '8px',
                padding: '12px'
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="invested" 
              stroke="#2E5984" 
              fillOpacity={1} 
              fill="url(#colorInvested)"
              name="Total Invested"
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#C5A572" 
              fillOpacity={1} 
              fill="url(#colorValue)"
              name="Future Value"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Yearly Breakdown Table */}
      <div className="card-light p-6 overflow-x-auto">
        <h3 className="text-xl font-semibold text-brand-navy mb-4">Year-wise Breakdown</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-brand-royal/20">
              <th className="text-left py-3 px-4 font-semibold text-brand-navy">Year</th>
              <th className="text-right py-3 px-4 font-semibold text-brand-navy">Invested</th>
              <th className="text-right py-3 px-4 font-semibold text-brand-navy">Value</th>
              <th className="text-right py-3 px-4 font-semibold text-brand-navy">Gain</th>
              <th className="text-right py-3 px-4 font-semibold text-brand-navy">Return %</th>
            </tr>
          </thead>
          <tbody>
            {calculation.yearlyData.map((data) => (
              <tr key={data.year} className="border-b border-gray-200 hover:bg-brand-pearl/30 transition-colors">
                <td className="py-3 px-4 font-medium text-brand-navy">Year {data.year}</td>
                <td className="py-3 px-4 text-right text-brand-navy/80">
                  {formatCurrency(data.invested)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-brand-royal">
                  {formatCurrency(data.value)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-green-600">
                  {formatCurrency(data.gain)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-brand-gold">
                  {((data.gain / data.invested) * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disclaimer */}
      <div className="card-light p-4 bg-yellow-50 border-l-4 border-yellow-400">
        <p className="text-sm text-yellow-800">
          <strong>Disclaimer:</strong> This calculator provides estimates based on assumed rates of return. 
          Actual returns may vary. Past performance is not indicative of future results. 
          Mutual fund investments are subject to market risks. Please read all scheme related documents carefully.
        </p>
      </div>
    </div>
  );
}
