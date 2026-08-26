'use client';

import { cn } from '@/lib/utils';

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y';

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

const ranges: { key: TimeRange; label: string }[] = [
  { key: '1D', label: '1일' },
  { key: '1W', label: '1주' },
  { key: '1M', label: '1개월' },
  { key: '3M', label: '3개월' },
  { key: '1Y', label: '1년' },
];

export default function TimeRangeSelector({ selected, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
      {ranges.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            selected === key
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
