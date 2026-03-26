// ── ComplianceDisclaimer ─────────────────────────────────────────────────────
// Mandatory SEBI/AMFI disclosures for each page context.
// AMFI Code of Conduct 2022 + SEBI Master Circular June 2024 require these.
// Do NOT remove or abbreviate — these protect against SEBI enforcement action.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';

type DisclaimerVariant = 'fund' | 'goals' | 'goals_detail' | 'portfolio' | 'calculator' | 'premium' | 'general' | 'markets' | 'news';

interface Props {
  variant: DisclaimerVariant;
  className?: string;
}

const DISCLAIMER_CONTENT: Record<DisclaimerVariant, { lines: string[]; badge?: string }> = {
  fund: {
    badge: 'SEBI / AMFI Disclosure',
    lines: [
      'Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully before investing.',
      'Past performance is not indicative of future returns. Returns shown are for the Regular Plan. NAV of schemes may go up or down.',
      'Data sourced from AMFI and AMC-published records. Vijay Malik Financial Services displays publicly available information for reference only. This is not a recommendation to buy, hold, or sell any mutual fund scheme.',
      'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605). We are NOT a SEBI-registered Investment Adviser. We do not provide personalised investment advice. We may earn trail commissions from AMCs on transactions executed through our platform.',
    ],
  },
  goals: {
    badge: 'Important — Educational Tool Only',
    lines: [
      'This Goal Planning tool is an educational, illustrative tracker only. It is NOT investment advice, financial planning, or a guarantee of any financial outcome.',
      'Return assumptions are capped at 13% per AMFI Best Practices Circular 109/2023-24. Actual market returns may be significantly higher or lower, including negative returns.',
      'Goal progress shown is based on your stated inputs (target amount, SIP, timeline). It is a mathematical computation, not a prediction or guarantee of achieving your goals.',
      'Your complete financial situation — tax position, insurance, liabilities, income stability — is not factored into this tool. For personalised financial planning, please consult a SEBI-registered Investment Adviser (RIA).',
      'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser. Goal planning tools are provided for informational and educational purposes only.',
    ],
  },
  goals_detail: {
    badge: 'Regulatory Notice — Educational Tool',
    lines: [
      'This page displays progress tracking data only. Vijay Malik Financial Services is NOT a SEBI-registered Investment Adviser and does not provide personalised financial planning.',
      'Success probability scores, fund transition suggestions, and rebalancing recommendations require SEBI IA registration. These features are currently unavailable on this platform.',
      'The goal target, SIP amount, and progress percentage shown here are data you entered. They are not a recommendation, forecast, or guarantee of any financial outcome.',
      'AMFI-registered distributor · ARN-317605 · Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully before investing.',
    ],
  },
  portfolio: {
    badge: 'Portfolio Tracker — Informational Only',
    lines: [
      'Portfolio data is displayed for informational purposes based on your transaction history. This is NOT investment advice.',
      'Portfolio drift alerts and analytics are observations about changes in your portfolio composition. They do not constitute recommendations to buy, sell, or switch any mutual fund scheme.',
      'LTCG / STCG tax estimates shown are computations based on current statutory tax rates and recorded transactions. These are estimates only — please verify with a qualified Chartered Accountant before taking any action.',
      'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser. Portfolio insights are informational only and do not constitute personalised advice.',
      'Mutual fund investments are subject to market risks. Past performance is not indicative of future returns.',
    ],
  },
  calculator: {
    badge: 'Calculator Disclaimer',
    lines: [
      'This calculator uses hypothetical return assumptions for illustration purposes only. Actual returns may differ significantly.',
      'Return assumptions shown are capped at a maximum of 13% per AMFI guidelines (Best Practices Circular 109/2023-24).',
      'This is an educational tool only and does not constitute investment advice or a recommendation to invest in any specific scheme.',
      'Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully before investing.',
    ],
  },
  premium: {
    badge: 'Subscription Terms',
    lines: [
      'The Pro subscription (₹99/year) provides access to advanced portfolio tracking tools, tax computation features, and data analytics — these are software tools, not investment advisory services.',
      'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser. This subscription does not constitute registration for investment advisory services.',
      'No feature of this subscription constitutes a personalised investment recommendation. All outputs are informational or computational in nature.',
      'Mutual fund investments are subject to market risks. Past performance is not indicative of future returns.',
    ],
  },
  general: {
    badge: 'Regulatory Information',
    lines: [
      'Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully before investing.',
      'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605). We are NOT a SEBI-registered Investment Adviser and do not provide personalised investment advice.',
      'We may earn trail commissions from AMCs for transactions facilitated through our platform. This is disclosed as required under AMFI Code of Conduct, April 2022.',
      'Past performance is not indicative of future returns.',
    ],
  },
  markets: {
    badge: 'Market Data Disclosure',
    lines: [
      'All market data, indices, and price information is sourced from public exchanges and third-party data providers. It is displayed for informational purposes only.',
      'This is NOT investment advice, a trading recommendation, or a signal to buy or sell any security or mutual fund.',
      'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser.',
      'Past performance of any index, fund, or security is not indicative of future returns.',
    ],
  },
  news: {
    badge: 'Content Disclaimer',
    lines: [
      'News articles are aggregated from third-party sources. Vijay Malik Financial Services does not endorse, verify, or take responsibility for third-party content.',
      'News content is for informational purposes only and does NOT constitute investment advice or a recommendation to act on any market event.',
      'Vijay Malik Financial Services is an AMFI-registered Mutual Fund Distributor (ARN-317605) and is NOT a SEBI-registered Investment Adviser.',
    ],
  },
};

export default function ComplianceDisclaimer({ variant, className = '' }: Props) {
  const { lines, badge } = DISCLAIMER_CONTENT[variant];

  return (
    <aside
      aria-label="Regulatory disclosure"
      className={`rounded-xl border border-[#3c4a3e]/60 bg-[#08100d] px-5 py-4 ${className}`}
    >
      {badge && (
        <p className="text-xs font-mono text-[#44f593]/70 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {badge}
        </p>
      )}
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="text-xs text-[#859586] leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
    </aside>
  );
}
