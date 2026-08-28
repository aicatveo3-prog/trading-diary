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

  // 종목·기간·간격이 바뀌면 이전 데이터를 즉시 감추고 로딩 상태로 전환한 뒤
  // 새 분봉을 fetch한다.
  //
  // effect 안의 동기 setState는 보통 cascading render를 유발해 피해야 하지만,
  // 여기서는 "외부 시스템(fetch)과의 동기화를 시작하기 전에 UI를 로딩 상태로
  // 되돌리는" 정당한 용도다. 입력이 바뀔 때마다 한 번의 추가 렌더가 있을 뿐이고,
  // 이걸 없애면 이전 종목의 차트가 새 데이터가 도착할 때까지 남아 오해를 준다.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 입력 변경 시 로딩 표시(의도적)
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

    // 세션 구간 (프리/정규/애프터).
    //
    // 다 이어서 보여주되 배경색과 경계선으로 구분한다. 나누지 않는다 —
    // 04:00~20:00이 한 줄로 그려지고, 그 위에 어느 구간이 프리·정규·애프터인지
    // 표시만 얹는다.
    //
    // 구간은 세션이 바뀌거나 날짜가 바뀌면 끊는다. 한국 종목은 세션이 전부
    // 정규장(1)이라 밴드도 경계선도 생기지 않는다 — 미국 종목에서만 나타난다.
    //
    // 경계(xPct)는 두 막대 사이 중점으로 잡는다. 막대 위치를 그대로 쓰면
    // 배경이 캔들을 반쯤 덮거나 비게 된다.
    const sessionBands: { startPct: number; endPct: number; session: number }[] = [];
    const sessionLines: number[] = [];
    const midPct = (i: number) => ((X(i - 1) + X(i)) / 2 / VIEW_W) * 100;

    let runStart = 0;
    for (let i = 1; i <= bars.length; i++) {
      const end = i === bars.length;
      const sessionChanged = !end && bars[i].session !== bars[i - 1].session;
      const dateChanged = !end && bars[i].date !== bars[i - 1].date;

      if (end || sessionChanged || dateChanged) {
        sessionBands.push({
          startPct: runStart === 0 ? 0 : midPct(runStart),
          endPct: end ? 100 : midPct(i),
          session: bars[runStart].session,
        });
        // 같은 날 안에서 세션이 바뀌는 지점에만 경계선을 긋는다.
        // 날짜 경계는 이미 dayBoundaries가 별도로 그린다.
        if (sessionChanged) sessionLines.push(midPct(i));
        runStart = i;
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
      sessionBands,
      sessionLines,
      maxVolume,
      xOf: (i: number) => (X(i) / VIEW_W) * 100,
      yOf: (v: number) => (Y(v) / VIEW_H) * 100,
    };
  }, [bars]);

  const barWidth = bars.length > 0 ? Math.max(1, Math.min(8, 700 / bars.length)) : 2;
  // 캔들 모드: interval >= 30분이면 캔들로 표시, 아래는 선 차트
  const showCandles = interval >= 30 && bars.length <= 200;
  // 정규장 외 데이터(프리·애프터)가 있으면 세션 범례를 보여준다.
  // 한국 종목은 전부 정규장이라 범례가 뜨지 않는다.
  const hasExtendedHours = bars.some(b => b.session !== 1);

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
        {/*
          세션 배경 — 정규장 외(프리·애프터) 구간에만 옅은 색을 깐다.
          정규장은 기본 배경 그대로 두어, "본장이 어디인지"가 대비로 드러나게 한다.
          맨 먼저 그려 그리드·차트 아래에 깔린다.
        */}
        {geo.sessionBands.map((band, i) =>
          band.session === 1 ? null : (
            <div
              key={`band-${i}`}
              title={band.session === 0 ? '프리마켓' : '애프터마켓'}
              style={{
                position: 'absolute',
                left: `${band.startPct}%`,
                width: `${band.endPct - band.startPct}%`,
                top: 0,
                bottom: 0,
                // 프리(아침)와 애프터(저녁)를 살짝 다른 톤으로 구분한다
                background: band.session === 0 ? 'rgba(70,110,170,0.07)' : 'rgba(150,110,70,0.08)',
                pointerEvents: 'none',
              }}
            />
          )
        )}

        {/* 세션 경계선 — 같은 날 안에서 프리→정규, 정규→애프터가 바뀌는 지점 */}
        {geo.sessionLines.map((xPct, i) => (
          <div
            key={`sline-${i}`}
            style={{
              position: 'absolute',
              left: `${xPct}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: c.borderSoft,
              pointerEvents: 'none',
            }}
          />
        ))}

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
        {/* 세션 범례 — 미국 종목처럼 정규장 외 거래가 있을 때만 */}
        {hasExtendedHours && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
            <LegendSwatch color="rgba(70,110,170,0.35)" label="프리마켓" />
            <LegendSwatch color="transparent" label="정규장" bordered />
            <LegendSwatch color="rgba(150,110,70,0.4)" label="애프터마켓" />
          </div>
        )}

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

/** 세션 범례의 색 견본 하나 */
function LegendSwatch({
  color,
  label,
  bordered,
}: {
  color: string;
  label: string;
  bordered?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.inkSoft }}>
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 2,
          background: color,
          border: bordered ? `1px solid ${c.borderBtn}` : 'none',
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
