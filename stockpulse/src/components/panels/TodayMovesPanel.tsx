'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { c, font } from '@/lib/tokens';
import { TodayMove, hasDetailPage } from '@/lib/events-data';
import { pct } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

interface TodayMovesPanelProps {
  moves: TodayMove[];
  asOf: string;
}

export default function TodayMovesPanel({ moves, asOf }: TodayMovesPanelProps) {
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
          const linkable = hasDetailPage(move.ticker);

          const body = (
            <>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 3,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {move.name}
                  {!linkable && (
                    <span style={{ fontSize: 10, color: c.inkFaint, fontWeight: 400 }}>
                      상세 준비 중
                    </span>
                  )}
                </div>
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
            </>
          );

          return (
            <Row key={move.ticker} ticker={move.ticker} linkable={linkable}>
              {body}
            </Row>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 상세 페이지가 있으면 링크, 없으면 일반 행으로 렌더한다.
 * 없는 페이지로 링크를 걸면 Next.js가 프리페치하면서 404를 발생시킨다.
 */
function Row({
  ticker,
  linkable,
  children,
}: {
  ticker: string;
  linkable: boolean;
  children: ReactNode;
}) {
  const shared = {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 58px',
    gap: 10,
    alignItems: 'start' as const,
    paddingBottom: 11,
    borderBottom: `1px solid ${c.borderFaint}`,
    color: c.ink,
  };

  if (!linkable) return <div style={shared}>{children}</div>;

  return (
    <Link href={`/stocks/${ticker}`} className="gc-fade" style={shared}>
      {children}
    </Link>
  );
}
