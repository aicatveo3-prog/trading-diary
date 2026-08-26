'use client';

import { c } from '@/lib/tokens';
import { PERIODS, PeriodKey } from '@/lib/events-data';

interface PeriodSelectorProps {
  selected: PeriodKey;
  onChange: (key: PeriodKey) => void;
}

export default function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {PERIODS.map(p => {
        const active = p.key === selected;
        return (
          <button
            key={p.key}
            className="gc-chip"
            onClick={() => onChange(p.key)}
            style={{
              height: 27,
              padding: '0 12px',
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 700,
              border: `1px solid ${active ? c.ink : c.borderInput}`,
              background: active ? c.ink : c.surface,
              color: active ? c.surface : c.inkSoft,
            }}
          >
            {p.key}
          </button>
        );
      })}
    </div>
  );
}
