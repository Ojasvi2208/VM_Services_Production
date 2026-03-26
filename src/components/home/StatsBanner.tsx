// ─── StatsBanner ─────────────────────────────────────────────
// 3-column stat strip — 200+ families, 200+ SIPs, 15+ hubs
// Design: Design_Revamp/HomePage.html § Stats Banner
// ─────────────────────────────────────────────────────────────

const STATS = [
  { value: '200+', label: 'Families' },
  { value: '200+', label: 'Active Strategic SIPs', bordered: true },
  { value: '30+',  label: 'Asset Management Companies' },
] as const;

export default function StatsBanner() {
  return (
    <section
      className="bg-[#08100d] border-y border-[#161d1a] py-12"
      aria-label="Key statistics"
    >
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-12">
        {STATS.map(({ value, label, bordered }) => (
          <div
            key={label}
            className={[
              'flex flex-col items-center md:items-start',
              bordered ? 'border-x border-[#161d1a] px-0 md:px-12' : '',
            ].join(' ')}
          >
            <span className="text-5xl font-['Space_Grotesk'] font-bold text-[#44f593]">{value}</span>
            <span className="text-[#859586] font-['Inter'] uppercase tracking-widest text-sm mt-2">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
