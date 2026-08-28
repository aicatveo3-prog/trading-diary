'use client';

import { c, font } from '@/lib/tokens';
import { pct } from '@/lib/format';
import { entryFor, formatPrice, formatChangeAmount, typeLabel } from '@/lib/universe';
import { useConvention } from '@/lib/convention-context';

interface StockHeaderCardProps {
  name: string;
  ticker: string;
  market: string;
  price: number;
  changeRate: number;
  changeAmount: number;
  asOf: string;
  watched: boolean;
  onToggleWatch: () => void;
}

export default function StockHeaderCard({
  name,
  ticker,
  market,
  price,
  changeRate,
  changeAmount,
  asOf,
  watched,
  onToggleWatch,
}: StockHeaderCardProps) {
  const { colors } = useConvention();
  const dirColor = changeRate >= 0 ? colors.up : colors.down;
  const entry = entryFor(ticker);

  return (
    <div
      style={{
        padding: '22px 26px 18px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
          <h1
            style={{
              fontFamily: font.serif,
              fontSize: 27,
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.03em',
            }}
          >
            {name}
          </h1>
          <span style={{ fontSize: 12.5, color: c.inkSoft }}>
            {ticker} · {market}
          </span>
          {entry && (
            <span
              style={{
                fontSize: 10.5,
                padding: '2px 7px',
                borderRadius: 2,
                background: c.surfaceMuted,
                color: c.inkSoft,
              }}
            >
              {typeLabel(entry.type)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: font.serif,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            {/* 통화별 표기 — 달러는 $, 원화는 정수, 지수는 무단위 */}
            {entry ? formatPrice(price, entry) : price.toLocaleString('ko-KR')}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: dirColor }}>
            {pct(changeRate)} (
            {entry ? formatChangeAmount(changeAmount, entry) : Math.round(changeAmount).toLocaleString('ko-KR')}
            )
          </span>
          <span style={{ fontSize: 12, color: c.inkSoft }}>{asOf}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9 }}>
        <button
          onClick={onToggleWatch}
          style={{
            height: 36,
            padding: '0 15px',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
            borderRadius: 3,
            background: watched ? c.ink : c.surface,
            color: watched ? c.surface : c.ink,
            border: `1px solid ${c.ink}`,
          }}
        >
          {watched ? '워치리스트에 있음' : '＋ 워치리스트'}
        </button>
        <button
          className="gc-btn-outline"
          style={{
            height: 36,
            padding: '0 15px',
            background: c.surface,
            border: `1px solid ${c.borderBtn}`,
            fontSize: 12.5,
            fontWeight: 500,
            color: c.inkStrong,
            cursor: 'pointer',
            borderRadius: 3,
          }}
        >
          공유
        </button>
      </div>
    </div>
  );
}
