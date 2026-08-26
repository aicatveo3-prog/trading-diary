'use client';

import { c, font } from '@/lib/tokens';
import { pct } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

export interface IndexQuote {
  name: string;
  value: number;
  changeRate: number;
}

interface MarketIndexStripProps {
  indices: IndexQuote[];
}

export default function MarketIndexStrip({ indices }: MarketIndexStripProps) {
  const { colors } = useConvention();

  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        display: 'grid',
        gridTemplateColumns: `repeat(${indices.length}, minmax(0, 1fr))`,
      }}
    >
      {indices.map((idx, i) => {
        const dirColor = idx.changeRate >= 0 ? colors.up : colors.down;
        return (
          <div
            key={idx.name}
            style={{
              padding: '16px 20px',
              borderLeft: i === 0 ? 'none' : `1px solid ${c.borderSoft}`,
            }}
          >
            <div style={{ fontSize: 11, color: c.inkSoft, letterSpacing: '0.04em', marginBottom: 6 }}>
              {idx.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: font.serif,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                {idx.value.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: dirColor }}>
                {pct(idx.changeRate)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
