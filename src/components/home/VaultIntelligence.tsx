'use client';
// ─── VaultIntelligence ───────────────────────────────────────
// Bento grid: Dynamic Risk Modeling | Cross-Asset Correlation |
//             Algorithmic Rebalancing (full width)
// Design: Design_Revamp/HomePage.html § Vault Intelligence
// ─────────────────────────────────────────────────────────────

export default function VaultIntelligence() {
  return (
    <section className="max-w-7xl mx-auto px-8 py-32" aria-labelledby="vi-heading">

      {/* Section header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
        <div>
          <h2
            id="vi-heading"
            className="font-['Space_Grotesk'] font-bold text-[#dce5df] mb-4"
            style={{ fontSize: 'clamp(2.5rem,4.5vw,3.5rem)' }}
          >
            Strategic Insights
          </h2>
          <p className="text-[#859586] max-w-md text-lg">
            Proprietary mathematical engines designed to protect and grow capital in volatile market regimes.
          </p>
        </div>
        <div className="hidden md:block">
          <span className="material-symbols-outlined text-[#44f593] text-6xl" style={{ fontVariationSettings: "'FILL' 0" }}>
            query_stats
          </span>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Card 1: Dynamic Risk Modeling — col-span-8 */}
        <div
          className="md:col-span-8 rounded-2xl p-8 hover:bg-[#19211e] transition-colors group"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>security</span>
              </div>
              <h3 className="text-3xl font-['Space_Grotesk'] font-bold text-[#dce5df] mb-4">Dynamic Risk Modeling</h3>
              <p className="text-[#859586] text-lg max-w-lg mb-8">
                Advanced risk analytics powered by institutional-grade models. Monte Carlo simulations — Coming Soon pending SEBI IA registration.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'VAR (95%)', value: '1.24%' },
                { label: 'Beta',      value: '0.82'  },
                { label: 'Sharpe',    value: '2.41'  },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-[#2f3733] border border-white/5 rounded-lg px-3 py-2"
                >
                  <div className="text-xs uppercase text-[#859586] mb-1">{label}</div>
                  <div className="font-['JetBrains_Mono'] text-[#44f593] text-base">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Cross-Asset Correlation — col-span-4 */}
        <div
          className="md:col-span-4 rounded-2xl p-8 hover:bg-[#19211e] transition-colors relative overflow-hidden group"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>grid_view</span>
            </div>
            <h3 className="text-3xl font-['Space_Grotesk'] font-bold text-[#dce5df] mb-4">Cross-Asset Correlation</h3>
            <p className="text-[#859586] text-base leading-relaxed">
              Identifying hidden dependencies between traditional and alternative assets to ensure true diversification.
            </p>
          </div>
          {/* Oversized decorative icon */}
          <div className="absolute bottom-[-20%] right-[-10%] opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-[#44f593]" style={{ fontSize: '180px', fontVariationSettings: "'FILL' 0" }}>hub</span>
          </div>
        </div>

        {/* Card 3: Algorithmic Rebalancing — col-span-12 */}
        <div
          className="md:col-span-12 rounded-2xl p-8 hover:bg-[#19211e] transition-colors group flex flex-col md:flex-row items-center gap-12"
          style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* Left text */}
          <div className="md:w-1/2">
            <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[#44f593]" style={{ fontVariationSettings: "'FILL' 0" }}>autorenew</span>
            </div>
            <h3 className="text-3xl font-['Space_Grotesk'] font-bold text-[#dce5df] mb-4">Algorithmic Rebalancing</h3>
            <p className="text-[#859586] text-lg max-w-md">
              Smart-trigger execution that buys low and sells high automatically based on pre-set mathematical thresholds, not emotions.
            </p>
            <button className="mt-8 text-[#44f593] font-bold flex items-center gap-2 group/btn">
              Explore Algorithms
              <span
                className="material-symbols-outlined group-hover/btn:translate-x-1 transition-transform"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                arrow_forward
              </span>
            </button>
          </div>

          {/* Right dashboard mini-card */}
          <div className="md:w-1/2 w-full">
            <div
              className="relative h-48 rounded-xl border border-white/5 p-6 overflow-hidden"
              style={{ background: '#08100d' }}
            >
              {/* SVG wave bg */}
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="#44f593" strokeWidth="1">
                  <path d="M0,50 Q25,20 50,50 T100,50" />
                  <path d="M0,40 Q25,70 50,40 T100,40" />
                </svg>
              </div>
              {/* Data columns */}
              <div className="flex justify-between items-center relative z-10 h-full">
                <div className="text-center">
                  <div className="text-[#859586] text-xs uppercase">Drift Alert</div>
                  <div className="text-[#ffb4ab] font-['JetBrains_Mono'] font-bold">+5.2%</div>
                </div>
                <div className="h-full w-[1px] bg-[#3c4a3e]/20" />
                <div className="text-center">
                  <div className="text-[#859586] text-xs uppercase">Execution</div>
                  <div className="text-[#44f593] font-['JetBrains_Mono'] font-bold">In Progress</div>
                </div>
                <div className="h-full w-[1px] bg-[#3c4a3e]/20" />
                <div className="text-center">
                  <div className="text-[#859586] text-xs uppercase">Target Var</div>
                  <div className="text-[#dce5df] font-['JetBrains_Mono'] font-bold">±0.5%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
