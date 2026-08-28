'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { c, font } from '@/lib/tokens';
import { chartGeometry, dateFor, dayQuote } from '@/lib/price-data';
import { NewsPin, newsPinDiameter } from '@/lib/news-pins';
import { pct, shortDate } from '@/lib/format';
import { entryFor, formatPrice } from '@/lib/universe';
import { useConvention } from '@/lib/convention-context';
import { Resolution } from '@/lib/periods';

interface PinnedChartProps {
  ticker: string;
  periodDays: number;
  resolution: Resolution;
  pins: NewsPin[];
  selectedDate: string | null;
  onSelect: (tradingDate: string) => void;
}

/** 가격 영역 높이 (px) */
const PRICE_H = 268;
/** 거래량 영역 높이 (px) */
const VOLUME_H = 46;
/** 핀 사이 최소 여백 (px) */
const PIN_GAP_PX = 7;
/** 겹칠 때 한 번에 밀어올리는 세로 간격 (%) */
const PIN_STEP_PCT = 12;
/** 폭을 측정하기 전 SSR 단계에서 쓸 기본값 */
const FALLBACK_WIDTH = 800;

export type ChartMode = 'line' | 'candle';

export default function PinnedChart({
  ticker,
  periodDays,
  resolution,
  pins,
  selectedDate,
  onSelect,
}: PinnedChartProps) {
  const { colors } = useConvention();
  // 통화별 가격 표기 — 미국 종목을 '원'으로 쓰면 틀린 정보가 된다
  const entry = entryFor(ticker);
  const fmtPrice = (v: number) =>
    entry ? formatPrice(v, entry) : Math.round(v).toLocaleString('ko-KR');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [mode, setMode] = useState<ChartMode>('line');
  /** 크로스헤어가 가리키는 거래일 (마우스 위치 기반) */
  const [cursorDay, setCursorDay] = useState<number | null>(null);

  /**
   * 핀 겹침 계산에는 차트의 **실제 렌더 폭**이 필요하다.
   * SVG viewBox를 그대로 쓰면 안 된다 — 핀 크기는 CSS px이고
   * 컨테이너 폭은 반응형이라 viewBox 좌표와 배율이 다르다.
   */
  const plotRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;

    setChartWidth(el.clientWidth || FALLBACK_WIDTH);
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const geo = useMemo(() => chartGeometry(ticker, periodDays, resolution), [ticker, periodDays, resolution]);

  // 기간이 길면 캔들이 1px 미만으로 얇아져 의미가 없다
  const candleWidth = Math.max(1.5, Math.min(11, (chartWidth / geo.span) * 0.62));

  /** 핀 배치 — 경계 클리핑과 겹침을 보정한다 */
  const layout = useMemo(() => {
    const placed: { pin: NewsPin; size: number; leftPct: number; topPct: number }[] = [];

    const ordered = [...pins]
      .map(pin => ({ pin, pos: geo.positionFor(pin.daysAgo) }))
      .filter((x): x is { pin: NewsPin; pos: { xPct: number; yPct: number } } => x.pos !== null)
      .sort((a, b) => a.pos.xPct - b.pos.xPct);

    for (const { pin, pos } of ordered) {
      const size = newsPinDiameter(pin.articles.length);
      const halfPct = (size / 2 / chartWidth) * 100;
      const leftPct = Math.max(halfPct, Math.min(100 - halfPct, pos.xPct));

      let topPct = pos.yPct;
      let guard = 0;
      while (guard < 8) {
        const collides = placed.some(other => {
          const dxPx = (Math.abs(other.leftPct - leftPct) / 100) * chartWidth;
          const dyPx = (Math.abs(other.topPct - topPct) / 100) * PRICE_H;
          return Math.hypot(dxPx, dyPx) < (other.size + size) / 2 + PIN_GAP_PX;
        });
        if (!collides) break;
        topPct = topPct > 18 ? topPct - PIN_STEP_PCT : topPct + PIN_STEP_PCT;
        guard++;
      }

      placed.push({ pin, size, leftPct, topPct: Math.max(6, Math.min(94, topPct)) });
    }

    return placed;
  }, [pins, geo, chartWidth]);

  const lineColor = geo.rising ? colors.up : colors.down;
  const hoveredEntry = layout.find(l => l.pin.tradingDate === hoveredDate) ?? null;
  const hovered = hoveredEntry?.pin ?? null;

  /** 마우스 x 위치 → 가장 가까운 거래일 */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      setCursorDay(geo.nearestDay(xPct));
    },
    [geo]
  );

  const cursorQuote = cursorDay !== null ? dayQuote(ticker, cursorDay) : null;
  const cursorPos = cursorDay !== null ? geo.positionFor(cursorDay) : null;
  // 핀에 마우스를 올린 동안에는 핀 툴팁을 우선한다
  const showCrosshair = cursorQuote && cursorPos && !hovered;

  return (
    <div style={{ padding: '16px 26px 8px' }}>
      {/* 표시 방식 토글 + 커서 시세 요약 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
          minHeight: 30,
        }}
      >
        <div style={{ display: 'flex', border: `1px solid ${c.border}`, borderRadius: 3, overflow: 'hidden' }}>
          {(['line', 'candle'] as ChartMode[]).map(m => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 500,
                  padding: '5px 11px',
                  background: active ? c.ink : 'transparent',
                  color: active ? c.surface : c.inkSoft,
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                {m === 'line' ? '선' : '캔들'}
              </button>
            );
          })}
        </div>

        {/* 마우스가 가리키는 날의 시세 — 차트 위에서 바로 읽힌다 */}
        {cursorQuote ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }}>
            <span style={{ fontWeight: 700, color: c.ink }}>
              {shortDate(dateFor(cursorQuote.daysAgo))}
            </span>
            <QuoteField label="시" value={cursorQuote.open} format={fmtPrice} />
            <QuoteField label="고" value={cursorQuote.high} format={fmtPrice} />
            <QuoteField label="저" value={cursorQuote.low} format={fmtPrice} />
            <QuoteField label="종" value={cursorQuote.close} format={fmtPrice} strong />
            <span
              style={{
                fontWeight: 700,
                color: cursorQuote.changeRate >= 0 ? colors.up : colors.down,
              }}
            >
              {pct(cursorQuote.changeRate)}
            </span>
            <span style={{ color: c.inkFaint }}>
              거래량 {cursorQuote.volume.toLocaleString('ko-KR')}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11.5, color: c.inkFaint }}>
            차트에 마우스를 올리면 그날의 시세가 표시됩니다
          </span>
        )}
      </div>

      {/* 가격 영역 */}
      <div
        ref={plotRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorDay(null)}
        style={{ position: 'relative', height: PRICE_H }}
      >
        {/* y축 눈금선 */}
        {geo.yTicks.map((tick, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${tick.yPct}%`,
              borderTop:
                i === geo.yTicks.length - 1 ? `1px solid ${c.border}` : `1px dashed ${c.grid}`,
            }}
          />
        ))}

        <svg
          viewBox="0 0 1000 296"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          {mode === 'line' && (
            <>
              <polygon points={geo.areaPoints} fill={`${lineColor}14`} />
              <polyline
                points={geo.linePoints}
                fill="none"
                stroke={lineColor}
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* 캔들 — SVG가 아니라 div로 그린다. viewBox 스케일링이 캔들 폭을 왜곡하기 때문 */}
        {mode === 'candle' &&
          geo.candles.map(candle => {
            const color = candle.rising ? colors.up : colors.down;
            return (
              <div key={candle.daysAgo}>
                {/* 고가~저가 꼬리 */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${candle.xPct}%`,
                    top: `${candle.highPct}%`,
                    height: `${candle.lowPct - candle.highPct}%`,
                    width: 1,
                    marginLeft: -0.5,
                    background: color,
                    opacity: 0.75,
                  }}
                />
                {/* 시가~종가 몸통 */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${candle.xPct}%`,
                    top: `${candle.bodyTopPct}%`,
                    height: `${candle.bodyHeightPct}%`,
                    width: candleWidth,
                    marginLeft: -candleWidth / 2,
                    background: color,
                    borderRadius: candleWidth > 4 ? 1 : 0,
                  }}
                />
              </div>
            );
          })}

        {/* 크로스헤어 */}
        {showCrosshair && (
          <>
            <div
              style={{
                position: 'absolute',
                left: `${cursorPos.xPct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: c.inkSoft,
                opacity: 0.45,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${cursorPos.xPct}%`,
                top: `${cursorPos.yPct}%`,
                transform: 'translate(-50%, -50%)',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: c.surface,
                border: `2px solid ${c.ink}`,
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          </>
        )}

        {/* y축 값 라벨 */}
        {geo.yTicks.map((tick, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 4,
              top: `${tick.yPct}%`,
              transform: i === 0 ? 'translateY(0)' : 'translateY(-50%)',
              fontSize: 10,
              color: c.inkFaint,
              background: `${c.surface}d9`,
              padding: '0 3px',
              pointerEvents: 'none',
            }}
          >
            {fmtPrice(tick.value)}
          </div>
        ))}

        {/* 뉴스 핀 */}
        {layout.map(({ pin, size, leftPct, topPct }) => {
          const original = geo.positionFor(pin.daysAgo);
          const active = selectedDate === pin.tradingDate || hoveredDate === pin.tradingDate;
          const fill = pin.changeRate >= 0 ? colors.up : colors.down;
          const offset = original ? Math.abs(original.yPct - topPct) : 0;
          const shifted = offset > 1;

          return (
            <div key={pin.tradingDate}>
              {/* 겹침 회피로 밀려났으면 실제 데이터 지점을 표시해 혼동을 막는다 */}
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

        {/* 핀 호버 툴팁 */}
        {hovered && hoveredEntry && (
          <div
            style={{
              position: 'absolute',
              left: hoveredEntry.leftPct > 62 ? 'auto' : `${hoveredEntry.leftPct}%`,
              right: hoveredEntry.leftPct > 62 ? `${100 - hoveredEntry.leftPct}%` : 'auto',
              top: `${Math.min(hoveredEntry.topPct, 52)}%`,
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

      {/* 거래량 */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorDay(null)}
        style={{
          position: 'relative',
          height: VOLUME_H,
          marginTop: 6,
          borderTop: `1px solid ${c.borderSoft}`,
          paddingTop: 4,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: 5,
            fontSize: 9.5,
            color: c.inkFaint,
            pointerEvents: 'none',
          }}
        >
          거래량
        </div>
        {geo.volumes.map(v => {
          const isCursor = cursorDay === v.daysAgo;
          return (
            <div
              key={v.daysAgo}
              style={{
                position: 'absolute',
                left: `${v.xPct}%`,
                bottom: 0,
                height: `${v.heightPct}%`,
                width: candleWidth,
                marginLeft: -candleWidth / 2,
                background: v.rising ? colors.up : colors.down,
                opacity: isCursor ? 0.95 : 0.3,
              }}
            />
          );
        })}
      </div>

      {/* x축 라벨 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
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
          marginTop: 10,
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

function QuoteField({
  label,
  value,
  format,
  strong,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  strong?: boolean;
}) {
  return (
    <span style={{ color: c.inkMid }}>
      <span style={{ color: c.inkFaint }}>{label} </span>
      <span style={{ fontWeight: strong ? 700 : 500, color: strong ? c.ink : c.inkStrong }}>
        {format(value)}
      </span>
    </span>
  );
}
