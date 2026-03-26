// ─── EcosystemSection ────────────────────────────────────────
// Centered section: "Powering the Global Wealth Ecosystem"
// 4 partner logos with grayscale → color hover effect
// Design: Design_Revamp/HomePage.html § Ecosystem
// ─────────────────────────────────────────────────────────────

const PARTNERS = [
  { name: 'NEXUS',    icon: 'account_tree' },
  { name: 'AETHER',   icon: 'cloud' },
  { name: 'VELOCITY', icon: 'bolt' },
  { name: 'OMNI',     icon: 'all_inclusive' },
] as const;

export default function EcosystemSection() {
  return (
    <section className="max-w-7xl mx-auto px-8 py-32 text-center" aria-labelledby="ecosystem-heading">

      {/* Centered label */}
      <h2
        id="ecosystem-heading"
        className="text-sm font-bold uppercase tracking-[0.3em] text-[#859586] mb-16 font-['Inter']"
      >
        Powering the Global Wealth Ecosystem
      </h2>

      {/* Partner logos */}
      <div className="flex flex-wrap justify-center items-center gap-16 md:gap-24">
        {PARTNERS.map(({ name, icon }) => (
          <div
            key={name}
            className="flex items-center gap-2 font-['Space_Grotesk'] font-bold text-2xl opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500 cursor-default select-none"
          >
            <span
              className="material-symbols-outlined text-[#44f593]"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              {icon}
            </span>
            <span className="text-[#dce5df]">{name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
