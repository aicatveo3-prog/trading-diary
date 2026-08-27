'use client';

import { useMemo, useState } from 'react';
import { c } from '@/lib/tokens';
import { chartGeometry, dateFor } from '@/lib/price-data';
import { NewsPin, newsPinDiameter } from '@/lib/news-pins';
import { pct, won, shortDate } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

interface PinnedChartProps {
  ticker: string;
  periodDays: number;
  pins: NewsPin[];
  selectedDate: string | null;
  onSelect: (tradingDate: string) => void;
}

export default function PinnedChart({
  ticker,
  periodDays,
  pins,
  selectedDate,
  onSelect,
}: PinnedChartProps) {
  const { colors } = useConvention();
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const geo = useMemo(() => chartGeometry(ticker, periodDays), [ticker, periodDays]);

  const lineColor = geo.rising ? colors.up : colors.down;
  const hovered = pins.find(p => p.tradingDate === hoveredDate) ?? null;
  const hoveredPos = hovered ? geo.positionFor(hovered.daysAgo) : null;

  return (
    <div style={{ padding: '20px 26px 8px' }}>
      <div style={{ position: 'relative', height: 296 }}>
        {/* 가로 그리드 — 눈금이 아니라 읽기 보조선이므로 점선으로 약하게 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ borderTop: `1px dashed ${c.grid}` }} />
          <div style={{ borderTop: `1px dashed ${c.grid}` }} />
          <div style={{ borderTop: `1px dashed ${c.grid}` }} />
          <div style={{ borderTop: `1px solid ${c.border}` }} />
        </div>

        <svg
          viewBox="0 0 1000 296"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <polygon points={geo.areaPoints} fill={`${lineColor}14`} />
          <polyline
            points={geo.linePoints}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* y축 상·하단 값만 표기 — 촘촘한 눈금은 읽기를 방해한다 */}
        <div style={{ position: 'absolute', left: 6, top: -2, fontSize: 10.5, color: c.inkFaint }}>
          {won(geo.yMax)}
        </div>
        <div style={{ position: 'absolute', left: 6, bottom: 4, fontSize: 10.5, color: c.inkFaint }}>
          {won(geo.yMin)}
        </div>

        {/* 뉴스 핀 */}
        {pins.map(pin => {
          const pos = geo.positionFor(pin.daysAgo);
          if (!pos) return null;

          const size = newsPinDiameter(pin.articles.length);
          const active = selectedDate === pin.tradingDate || hoveredDate === pin.tradingDate;
          const fill = pin.changeRate >= 0 ? colors.up : colors.down;

          return (
            <button
              key={pin.tradingDate}
              className="gc-pin"
              onMouseEnter={() => setHoveredDate(pin.tradingDate)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => onSelect(pin.tradingDate)}
              aria-label={`${shortDate(dateFor(pin.daysAgo))} 뉴스 ${pin.articles.length}건`}
              style={{
                position: 'absolute',
                left: `${pos.xPct}%`,
                top: `${pos.yPct}%`,
                transform: 'translate(-50%, -50%)',
                width: size,
                height: size,
                borderRadius: '50%',
                background: fill,
                color: c.surface,
                border: `2px solid ${c.surface}`,
                boxShadow: active ? '0 0 0 3px rgba(27,30,35,.5)' : '0 1px 3px rgba(0,0,0,.22)',
                font: `700 ${Math.max(9, size * 0.4)}px 'Noto Sans KR', sans-serif`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                zIndex: active ? 6 : 4,
              }}
            >
              {pin.number}
            </button>
          );
        })}

        {/* 호버 툴팁 — 오른쪽 끝 핀은 왼쪽으로 펼친다 */}
        {hovered && hoveredPos && (
          <div
            style={{
              position: 'absolute',
              left: hoveredPos.xPct > 62 ? 'auto' : `${hoveredPos.xPct}%`,
              right: hoveredPos.xPct > 62 ? `${100 - hoveredPos.xPct}%` : 'auto',
              top: `${Math.min(hoveredPos.yPct, 55)}%`,
              marginTop: 18,
              width: 280,
              background: c.surface,
              border: `1px solid ${c.borderBtn}`,
              boxShadow: '0 6px 22px rgba(24,26,30,.14)',
              padding: '13px 15px',
              zIndex: 9,
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, color: c.inkSoft }}>
                {shortDate(dateFor(hovered.daysAgo))}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  background: c.surfaceMuted,
                  color: c.inkMid,
                  borderRadius: 2,
                }}
              >
                뉴스 {hovered.articles.length}건
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginLeft: 'auto',
                  color: hovered.changeRate >= 0 ? colors.up : colors.down,
                }}
              >
                {pct(hovered.changeRate)}
              </span>
            </div>

            {/* 그 날의 대표 기사 최대 3건 */}
            {hovered.articles.slice(0, 3).map(a => (
              <div
                key={a.id}
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  marginBottom: 6,
                  paddingLeft: 8,
                  borderLeft: `2px solid ${c.borderInput}`,
                }}
              >
                {a.title.length > 42 ? a.title.slice(0, 42) + '…' : a.title}
              </div>
            ))}
            {hovered.articles.length > 3 && (
              <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 4 }}>
                외 {hovered.articles.length - 3}건 · 클릭하면 아래에서 전부 보기
              </div>
            )}
          </div>
        )}
      </div>

      {/* x축 라벨 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9 }}>
        {geo.xLabels.map((label, i) => (
          <span key={`${label}-${i}`} style={{ fontSize: 10.5, color: c.inkFaint }}>
            {label}
          </span>
        ))}
      </div>

      {/* 읽는 법 + 인과 단정 회피 문구 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 0 6px',
          borderTop: `1px solid ${c.borderSoft}`,
          marginTop: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11.5, color: c.inkSoft }}>
          핀 색 = 그날의 방향 · 크기 = 기사 건수 · 번호 = 최신순
        </span>
        <span style={{ fontSize: 11.5, color: c.inkSoft, marginLeft: 'auto' }}>
          같은 날에 일어난 일이라는 뜻이며, 원인을 단정하지 않습니다.
        </span>
      </div>
    </div>
  );
}
