'use client';

interface PlanTypeToggleProps {
  value: 'Regular' | 'Direct' | 'All';
  onChange: (value: 'Regular' | 'Direct' | 'All') => void;
}

export default function PlanTypeToggle({ value, onChange }: PlanTypeToggleProps) {
  return (
    <div className="inline-flex rounded-xl border-2 border-brand-royal p-1 bg-white shadow-sm">
      <button
        onClick={() => onChange('Regular')}
        className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
          value === 'Regular'
            ? 'bg-brand-royal text-white shadow-md'
            : 'text-brand-navy hover:bg-brand-pearl'
        }`}
      >
        Regular Plans
      </button>
      <button
        onClick={() => onChange('Direct')}
        className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
          value === 'Direct'
            ? 'bg-brand-royal text-white shadow-md'
            : 'text-brand-navy hover:bg-brand-pearl'
        }`}
      >
        Direct Plans
      </button>
      <button
        onClick={() => onChange('All')}
        className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
          value === 'All'
            ? 'bg-brand-royal text-white shadow-md'
            : 'text-brand-navy hover:bg-brand-pearl'
        }`}
      >
        All Plans
      </button>
    </div>
  );
}
