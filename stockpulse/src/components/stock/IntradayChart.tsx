'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { c } from '@/lib/tokens';
import {
  aggregateMinutes,
  MinuteInterval,
  MinuteBar,
  formatMinuteDate,
  formatMinuteTime,
} from '@/lib/minute-data';
import { entryFor, formatPrice } from '@/lib/universe';
import { pct } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

interface IntradayChartProps {
  ticker: string;
  /** 표시할 거래일 수 */
  days: number;
  /** 집계 간격 (분) */
  interval: MinuteInterval;
}

const PRICE_H = 268;
const VOLUME_H = 46;
const VIEW_W = 1000;
const VIEW_H = 296;

/**
 * 장중 차트 — 분봉 기반 (OHLC 캔들 지원)
 *
 * PinnedChart와 분리한 이유:
 *   1. 시간축이 다르다. 일봉은 거래일 인덱스, 분봉은 날짜+시각이다.
 *   2. 뉴스 핀을 꽂지 않는다. 뉴스 타임스탬프의 20.8%가 정시(00분)로
 *      반올림되어 있어, 분 단위 위치에 핀을 꽂으면 없는 정밀도를
 *      있는 것처럼 보여주게 된다.
 *
 * 데이터를 런타임 fetch로 가져오므로 로딩 상태가 있다.
 */
export default function IntradayChart({ ticker, days, interval }: IntradayChartProps) {
  const { colors } = useConvention();
  const [cursor, setCursor] = useState<number | null>(null);
  const [bars, setBars] = useState<MinuteBar[]>([]);
  const [loading, setLoading] = useState(true);

  const entry = entryFor(ticker);

  // fetch 데이터
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCursor(null);

    aggregateMinutes(ticker, days, interval).then(result => {
      if (!cancelled) {
        setBars(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [ticker, days, interval]);

  const geo = useMemo(() => {
    if (bars.length === 0) return null;

    const closes = bars.map(b => b.close);
    const min = Math.min(...bars.map(b => b.low));
    const max = Math.max(...bars.map(b => b.high));
    const pad = (max - min) * 0.1 || 1;
    const lo = min - pad;
    const hi = max + pad;

    const n = bars.length;
    const X = (i: number) => (n === 1 ? VIEW_W / 2 : (i / (n - 1)) * VIEW_W);
    const Y = (v: number) => VIEW_H - ((v - lo) / (hi - lo)) * VIEW_H;

    const points = closes.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);

    // 날짜가 바뀌는 지점
    const dayBoundaries: { xPct: number; date: string }[] = [];
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].date !== bars[i - 1].date) {
        dayBoundaries.push({ xPct: (X(i) / VIEW_W) * 100, date: bars[i].date });
      }
    }

    const TICKS = 5;
    const yTicks = Array.from({ length: TICKS }, (_, k) => {
      const value = hi - ((hi - lo) * k) / (TICKS - 1);
      return { value, yPct: (Y(value) / VIEW_H) * 100 };
    });

    const maxVolume = Math.max(...bars.map(b => b.volume), 1);

    return {
      linePoints: points.join(' '),
      areaPoints: `0,${VIEW_H} ${points.join(' ')} ${VIEW_W},${VIEW_H}`,
      rising: closes[closes.length - 1] >= closes[0],
      hi,
      lo,
      yTicks,
      dayBoundaries,
      maxVolume,
      xOf: (i: number) => (X(i) / VIEW_W) * 100,
      yOf: (v: number) => (Y(v) / VIEW_H) * 100,
    };
  }, [bars]);

  const barWidth = bars.length > 0 ? Math.max(1, Math.min(8, 700 / bars.length)) : 2;
  // 캔들 모드: interval >= 30분이면 캔들로 표시, 아래는 선 차트
  const showCandles = interval >= 30 && bars.length <= 200;

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (bars.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const i = Math.round(ratio * (bars.length - 1));
      setCursor(Math.max(0, Math.min(bars.length - 1, i)));
    },
    [bars.length]
  );

  // 로딩 상태
  if (loading) {
    return (
      <div style={{ padding: '40px 26px', textAlign: 'center', fontSize: 13, color: c.inkSoft }}>
        분봉 데이터를 불러오는 중...
      </div>
    );
  }

  if (!geo || bars.length === 0) {
    return (
      <div style={{ padding: '40px 26px', textAlign: 'center', fontSize: 13, color: c.inkSoft }}>
        이 종목의 분봉 데이터가 아직 없습니다.
      </div>
    );
  }

  const cursorBar = cursor !== null ? bars[cursor] : null;
  const cursorChange =
    cursor !== null && cursor > 0
      ? ((bars[cursor].close - bars[cursor - 1].close) / bars[cursor - 1].close) * 100
      : null;

  const lineColor = geo.rising ? colors.up : colors.down;
  const firstClose = bars[0].close;
  const lastBar = bars[bars.length - 1];
  const lastClose = lastBar.close;
  const periodChange = ((lastClose - firstClose) / firstClose) * 100;

  // 마지막 바 시각으로 장중 여부 판단
  const isPartialDay = lastBar.time < '1530';

  /** 가격 표시 — universe 엔트리가 있으면 통화에 맞게 */
  const fmtPrice = (v: number) => {
    if (entry) return formatPrice(v, entry);
    return v.toLocaleString('ko-KR');
  };

  return (
    <div style={{ padding: '16px 26px 8px' }}>
      {/* 커서 시세 요약 */}
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
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: '4px 9px',
            background: c.surfaceMuted,
            color: c.inkMid,
            borderRadius: 2,
          }}
        >
          {interval}분봉
        </span>

        <span style={{ fontSize: 11, color: c.inkFaint }}>
          {formatMinuteDate(lastBar.date)}
          {isPartialDay ? ' 장중' : ' 장마감'}
          {' 기준'}
        </span>

        {cursorBar ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }}>
            <span style={{ fontWeight: 700, color: c.ink }}>
              {formatMinuteDate(cursorBar.date)} {formatMinuteTime(cursorBar.time)}
            </span>
            <span style={{ color: c.inkMid }}>
              <span style={{ color: c.inkFaint }}>종가 </span>
              <span style={{ fontWeight: 700, color: c.ink }}>{fmtPrice(cursorBar.close)}</span>
            </span>
            {cursorChange !== null && (
              <span
                style={{ fontWeight: 700, color: cursorChange >= 0 ? colors.up : colors.down }}
              >
                {pct(cursorChange)}
              </span>
            )}
            <span style={{ color: c.inkFaint }}>
              거래량 {cursorBar.volume.toLocaleString('ko-KR')}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11.5, color: c.inkFaint }}>
            구간 등락 {' '}
            <strong style={{ color: periodChange >= 0 ? colors.up : colors.down }}>
              {pct(periodChange)}
            </strong>
            {' · '}차트에 마우스를 올리면 시각별 시세가 표시됩니다
          </span>
        )}
      </div>

      {/* 가격 영역 */}
      <div
        onMouseMove={handleMove}
        onMouseLeave={() => setCursor(null)}
        style={{ position: 'relative', height: PRICE_H }}
      >
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

        {/* 날짜 구분선 */}
        {geo.dayBoundaries.map(b => (
          <div key={b.date}>
            <div
              style={{
                position: 'absolute',
                left: `${b.xPct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: c.borderBtn,
                opacity: 0.7,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${b.xPct}%`,
                top: 2,
                marginLeft: 3,
                fontSize: 9,
                color: c.inkFaint,
                whiteSpace: 'nowrap',
              }}
            >
              {formatMinuteDate(b.date)}
            </div>
          </div>
        ))}

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {showCandles ? (
            /* 캔들 모드 — OHLC가 완비되어 있으므로 실제 캔들을 그린다 */
            <>
              {bars.map((bar, i) => {
                const x = geo.xOf(i);
                const rising = bar.close >= bar.open;
                const bodyTop = geo.yOf(Math.max(bar.open, bar.close));
                const bodyBottom = geo.yOf(Math.min(bar.open, bar.close));
                const wickTop = geo.yOf(bar.high);
                const wickBottom = geo.yOf(bar.low);
                const candleW = Math.max(0.3, Math.min(2.5, 60 / bars.length));
                const fill = rising ? colors.up : colors.down;

                return (
                  <g key={`${bar.date}-${bar.time}`}>
                    {/* 꼬리 */}
                    <line
                      x1={`${x}%`}
                      y1={`${wickTop}%`}
                      x2={`${x}%`}
                      y2={`${wickBottom}%`}
                      stroke={fill}
                      strokeWidth="0.8"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* 몸통 */}
                    <rect
                      x={`${x - candleW / 2}%`}
                      y={`${bodyTop}%`}
                      width={`${candleW}%`}
                      height={`${Math.max(bodyBottom - bodyTop, 0.3)}%`}
                      fill={fill}
                      opacity={cursor === i ? 1 : 0.85}
                    />
                  </g>
                );
              })}
            </>
          ) : (
            /* 선 차트 모드 */
            <>
              <polygon points={geo.areaPoints} fill={`${lineColor}14`} />
              <polyline
                points={geo.linePoints}
                fill="none"
                stroke={lineColor}
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* 크로스헤어 */}
        {cursor !== null && cursorBar && (
          <>
            <div
              style={{
                position: 'absolute',
                left: `${geo.xOf(cursor)}%`,
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
                left: `${geo.xOf(cursor)}%`,
                top: `${geo.yOf(cursorBar.close)}%`,
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

        {/* y축 값 */}
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
      </div>

      {/* 거래량 */}
      <div
        onMouseMove={handleMove}
        onMouseLeave={() => setCursor(null)}
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
        {bars.map((bar, i) => {
          const up = i === 0 || bar.close >= bars[i - 1].close;
          return (
            <div
              key={`${bar.date}-${bar.time}`}
              style={{
                position: 'absolute',
                left: `${geo.xOf(i)}%`,
                bottom: 0,
                height: `${(bar.volume / geo.maxVolume) * 100}%`,
                width: barWidth,
                marginLeft: -barWidth / 2,
                background: up ? colors.up : colors.down,
                opacity: cursor === i ? 0.95 : 0.3,
              }}
            />
          );
        })}
      </div>

      {/* x축 — 첫/중간/끝 시각 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
        {[0, Math.floor(bars.length / 2), bars.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map(i => (
            <span key={i} style={{ fontSize: 10.5, color: c.inkFaint }}>
              {formatMinuteDate(bars[i].date)} {formatMinuteTime(bars[i].time)}
            </span>
          ))}
      </div>

      {/* 분봉 안내 */}
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
          {showCandles
            ? 'OHLC 캔들 차트 · 시가/고가/저가/종가 표시'
            : '선 차트 (5분봉은 데이터가 많아 선으로 표시)'}
        </span>
        <span style={{ fontSize: 11.5, color: c.inkSoft, marginLeft: 'auto' }}>
          뉴스 핀은 일봉 기간(1개월 이상)에서 표시됩니다
        </span>
      </div>
    </div>
  );
}
