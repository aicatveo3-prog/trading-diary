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

/** SVG viewBox 기준 폭·높이. 핀 겹침 계산에서 % ↔ px 환산에 쓴다. */
const CHART_PX_WIDTH = 1000;
const CHART_PX_HEIGHT = 296;
/** 핀 사이 최소 여백 (px) */
const PIN_GAP_PX = 4;
/** 겹칠 때 한 번에 밀어올리는 세로 간격 (%) */
const PIN_STEP_PCT = 11;

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

  /**
   * 핀 배치를 계산한다.
   *
   * 두 가지 보정이 필요하다:
   *
   * 1. 경계 클리핑 — x가 0%/100%에 가까우면 translate(-50%)로 인해 핀의 절반이
   *    차트 밖으로 잘린다. 지름의 절반만큼 안쪽으로 민다.
   *
   * 2. 겹침 — 최근 거래일이 연속으로 핀이 되면(예: 8/24·8/25·8/26) 서로 붙어
   *    번호를 읽을 수 없다. 가로로 가까운 핀을 감지해 세로로 계단식 오프셋을 준다.
   */
  const layout = useMemo(() => {
    const placed: {
      pin: NewsPin;
      size: number;
      leftPct: number;
      topPct: number;
    }[] = [];

    // 가로 순서대로 처리해야 겹침 판정이 일관된다
    const ordered = [...pins]
      .map(pin => ({ pin, pos: geo.positionFor(pin.daysAgo) }))
      .filter((x): x is { pin: NewsPin; pos: { xPct: number; yPct: number } } => x.pos !== null)
      .sort((a, b) => a.pos.xPct - b.pos.xPct);

    for (const { pin, pos } of ordered) {
      const size = newsPinDiameter(pin.articles.length);

      // 차트 폭 기준 핀 반지름을 %로 환산 (컨테이너 폭을 모르므로 1000 기준 근사)
      const halfPct = (size / 2 / CHART_PX_WIDTH) * 100;
      const leftPct = Math.max(halfPct, Math.min(100 - halfPct, pos.xPct));

      // 이미 배치된 핀과 가로로 겹치는지 확인
      let topPct = pos.yPct;
      let guard = 0;
      while (guard < 8) {
        const collides = placed.some(other => {
          const dx = Math.abs(other.leftPct - leftPct);
          const dy = Math.abs(other.topPct - topPct);
          // % 단위 거리를 px로 환산해 두 핀의 반지름 합과 비교
          const dxPx = (dx / 100) * CHART_PX_WIDTH;
          const dyPx = (dy / 100) * CHART_PX_HEIGHT;
          const minDist = (other.size + size) / 2 + PIN_GAP_PX;
          return Math.hypot(dxPx, dyPx) < minDist;
        });

        if (!collides) break;

        // 위로 밀어올린다. 상단에 닿으면 아래로 방향을 바꾼다.
        topPct = topPct > 18 ? topPct - PIN_STEP_PCT : topPct + PIN_STEP_PCT;
        guard++;
      }

      placed.push({
        pin,
        size,
        leftPct,
        topPct: Math.max(6, Math.min(94, topPct)),
      });
    }

    return placed;
  }, [pins, geo]);

  const lineColor = geo.rising ? colors.up : colors.down;
  const hoveredEntry = layout.find(l => l.pin.tradingDate === hoveredDate) ?? null;
  const hovered = hoveredEntry?.pin ?? null;

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

        {/* 뉴스 핀 — 원래 데이터 지점과 어긋난 경우 연결선을 함께 그린다 */}
        {layout.map(({ pin, size, leftPct, topPct }) => {
          const original = geo.positionFor(pin.daysAgo);
          const active = selectedDate === pin.tradingDate || hoveredDate === pin.tradingDate;
          const fill = pin.changeRate >= 0 ? colors.up : colors.down;

          // 겹침 회피로 핀이 밀려났으면, 실제 데이터 지점을 점으로 표시해 혼동을 막는다
          const offset = original ? Math.abs(original.yPct - topPct) : 0;
          const shifted = offset > 1;

          return (
            <div key={pin.tradingDate}>
              {shifted && original && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      left: `${original.xPct}%`,
                      top: `${original.yPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: fill,
                      opacity: 0.85,
                      zIndex: 3,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: `${original.xPct}%`,
                      top: `${Math.min(original.yPct, topPct)}%`,
                      height: `${offset}%`,
                      width: 1,
                      background: fill,
                      opacity: 0.3,
                      zIndex: 3,
                    }}
                  />
                </>
              )}

              <button
                className="gc-pin"
                onMouseEnter={() => setHoveredDate(pin.tradingDate)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => onSelect(pin.tradingDate)}
                aria-label={`${shortDate(dateFor(pin.daysAgo))} 뉴스 ${pin.articles.length}건, ${pct(pin.changeRate)}`}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
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
                  zIndex: active ? 7 : 5,
                }}
              >
                {pin.number}
              </button>
            </div>
          );
        })}

        {/* 호버 툴팁 — 오른쪽 끝 핀은 왼쪽으로 펼친다 */}
        {hovered && hoveredEntry && (
          <div
            style={{
              position: 'absolute',
              left: hoveredEntry.leftPct > 62 ? 'auto' : `${hoveredEntry.leftPct}%`,
              right: hoveredEntry.leftPct > 62 ? `${100 - hoveredEntry.leftPct}%` : 'auto',
              top: `${Math.min(hoveredEntry.topPct, 55)}%`,
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
