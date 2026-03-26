'use client';

interface Props {
  activeAmc: string;
  activeCategory: string;
  onAmcToggle: (amc: string) => void;
  onCategoryToggle: (cat: string) => void;
}

const AMC_PILLS = [
  'HDFC Mutual Fund',
  'SBI Mutual Fund',
  'ICICI Prudential',
  'Axis Asset Management',
  'Kotak Mahindra',
  'Mirae Asset',
  'Nippon India',
  'UTI Mutual Fund',
];

const CATEGORY_PILLS = [
  'Large Cap',
  'Flexi Cap',
  'Mid Cap',
  'Small Cap',
  'Hybrid',
  'Debt',
  'ELSS',
  'Index',
];

// Short label shown on pill (full label in title attr for a11y)
const AMC_SHORT: Record<string, string> = {
  'HDFC Mutual Fund':      'HDFC',
  'SBI Mutual Fund':       'SBI',
  'ICICI Prudential':      'ICICI Pru',
  'Axis Asset Management': 'Axis',
  'Kotak Mahindra':        'Kotak',
  'Mirae Asset':           'Mirae',
  'Nippon India':          'Nippon',
  'UTI Mutual Fund':       'UTI',
};

function Pill({
  label, title, active, onClick,
}: {
  label: string; title: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'flex-shrink-0 px-4 py-1.5 rounded-full text-[0.8125rem] font-medium transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-[#00D87A] text-[#060C08] shadow-[0_0_12px_rgba(0,216,122,0.28)]'
          : 'bg-[#0E1713] border border-[#1F2B24] text-[#7A8C84] hover:border-[rgba(0,216,122,0.3)] hover:text-[#C4CFC9]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export default function FilterPillsRow({ activeAmc, activeCategory, onAmcToggle, onCategoryToggle }: Props) {
  return (
    <div className="border-y border-[#1F2B24] bg-[#060D0A] py-3.5">
      <div className="vault-container space-y-3">

        {/* AMC row */}
        <div className="flex items-center gap-4">
          <span
            className="text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-[#3D4F47] flex-shrink-0 w-12"
            aria-label="Filter by AMC"
          >
            AMC
          </span>
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5"
            role="group"
            aria-label="AMC filter pills"
          >
            {AMC_PILLS.map(amc => (
              <Pill
                key={amc}
                label={AMC_SHORT[amc] ?? amc}
                title={amc}
                active={activeAmc === amc}
                onClick={() => onAmcToggle(amc)}
              />
            ))}
          </div>
        </div>

        {/* Category row */}
        <div className="flex items-center gap-4">
          <span
            className="text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-[#3D4F47] flex-shrink-0 w-12"
            aria-label="Filter by category"
          >
            Type
          </span>
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5"
            role="group"
            aria-label="Category filter pills"
          >
            {CATEGORY_PILLS.map(cat => (
              <Pill
                key={cat}
                label={cat}
                title={cat}
                active={activeCategory === cat}
                onClick={() => onCategoryToggle(cat)}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
