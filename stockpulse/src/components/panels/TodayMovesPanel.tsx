'use client';

import Link from 'next/link';
import { c, font } from '@/lib/tokens';
import { TodayMove } from '@/lib/events-data';
import { pct } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

interface TodayMovesPanelProps {
  moves: TodayMove[];
  asOf: string;
  /** 사이드바용 압축 모드 여부 */
  compact?: boolean;
}

export default function TodayMovesPanel({ moves, asOf, compact = true }: TodayMovesPanelProps) {
  const { colors } = useConvention();

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, padding: '18px 20px' }}>
      <div style={{ fontFamily: font.serif, fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
        오늘, 뉴스로 설명되는 움직임
      </div>
      <div style={{ fontSize: 11, color: c.inkFaint, marginBottom: 15 }}>
        {asOf} · 중요도 상위 {moves.length}
      </div>

      <div style={{ display: 'grid', gap: 11 }}>
        {moves.map(move => {
          const dirColor = move.changeRate >= 0 ? colors.up : colors.down;
          return (
            <Link
              key={move.ticker}
              href={`/stocks/${move.ticker}`}
              className="gc-fade"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 58px',
                gap: 10,
                alignItems: 'start',
                paddingBottom: 11,
                borderBottom: `1px solid ${c.borderFaint}`,
                color: c.ink,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{move.name}</div>
                <div style={{ fontSize: 11, color: c.inkSoft, lineHeight: 1.45 }}>{move.cause}</div>
              </div>
              <div
                style={{
                  fontFamily: font.serif,
                  fontSize: 14,
                  fontWeight: 700,
                  textAlign: 'right',
                  color: dirColor,
                }}
              >
                {pct(move.changeRate)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
