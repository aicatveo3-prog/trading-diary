'use client';

import { c } from '@/lib/tokens';
import { PERIODS, PeriodKey } from '@/lib/periods';

interface PeriodSelectorProps {
  selected: PeriodKey;
  onChange: (key: PeriodKey) => void;
}

export default function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {PERIODS.map(p => {
        const active = p.key === selected;
        return (
          <button
            key={p.key}
            className="gc-chip"
            onClick={() => onChange(p.key)}
            style={{
              height: 28,
              padding: '0 11px',
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: active ? 700 : 500,
              whiteSpace: 'nowrap',
              border: `1px solid ${active ? c.ink : c.borderInput}`,
              background: active ? c.ink : c.surface,
              color: active ? c.surface : c.inkMid,
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
