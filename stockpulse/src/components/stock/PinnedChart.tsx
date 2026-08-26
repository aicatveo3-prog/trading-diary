'use client';

import { useMemo, useState } from 'react';
import { c, font } from '@/lib/tokens';
import { chartGeometry, dateFor } from '@/lib/chart-series';
import { StockEvent } from '@/lib/events-data';
import { pinDiameter } from '@/lib/event-selectors';
import { pct, won, shortDate } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

interface PinnedChartProps {
  periodDays: number;
  pinnedEvents: StockEvent[];
  numbering: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function PinnedChart({
  periodDays,
  pinnedEvents,
  numbering,
  selectedId,
  onSelect,
}: PinnedChartProps) {
  const { colors } = useConvention();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const geo = useMemo(() => chartGeometry(periodDays), [periodDays]);

  const lineColor = geo.rising ? colors.up : colors.down;
  const hovered = pinnedEvents.find(e => e.id === hoveredId) ?? null;
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
        {pinnedEvents.map(event => {
          const pos = geo.positionFor(event.daysAgo);
          if (!pos) return null;

          const size = pinDiameter(event.dayChange);
          const active = selectedId === event.id || hoveredId === event.id;
          const fill = event.dayChange >= 0 ? colors.up : colors.down;

          return (
            <button
              key={event.id}
              className="gc-pin"
              onMouseEnter={() => setHoveredId(event.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelect(event.id)}
              aria-label={`${shortDate(dateFor(event.daysAgo))} ${event.headline}`}
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
                boxShadow: active
                  ? '0 0 0 3px rgba(27,30,35,.5)'
                  : '0 1px 3px rgba(0,0,0,.22)',
                font: `700 ${Math.max(9, size * 0.42)}px 'Noto Sans KR', sans-serif`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                zIndex: active ? 6 : 4,
              }}
            >
              {numbering.get(event.id)}
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
              top: `${Math.min(hoveredPos.yPct, 58)}%`,
              marginTop: 18,
              width: 268,
              background: c.surface,
              border: `1px solid ${c.borderBtn}`,
              boxShadow: '0 6px 22px rgba(24,26,30,.14)',
              padding: '13px 15px',
              zIndex: 9,
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
                {hovered.type}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginLeft: 'auto',
                  color: hovered.dayChange >= 0 ? colors.up : colors.down,
                }}
              >
                {pct(hovered.dayChange)}
              </span>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 500 }}>{hovered.headline}</div>
            <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 6 }}>
              {hovered.sources}개 매체 보도 · 클릭하면 아래에서 이어 읽기
            </div>
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
          핀 색 = 그날의 방향 · 크기 = 변동폭 · 번호 = 최신순 타임라인 순서
        </span>
        <span style={{ fontSize: 11.5, color: c.inkSoft, marginLeft: 'auto' }}>
          같은 날에 일어난 일이라는 뜻이며, 원인을 단정하지 않습니다.
        </span>
      </div>
    </div>
  );
}
