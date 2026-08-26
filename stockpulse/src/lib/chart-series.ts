/**
 * 차트 시리즈 생성
 *
 * 실 데이터 연결 전까지는 결정러적(seeded) 시리즈를 쓴다.
 * 이벤트가 있던 날에는 그 이벤트의 실제 등락률을 주입하므로,
 * 핀이 꽂힌 위치의 꺾임이 해설과 어긋나지 않는다.
 */

import { STOCK_EVENTS } from './events-data';

const TOTAL_DAYS = 250;
const SEED = 20260826;
const START_PRICE = 47100;

let cachedSeries: number[] | null = null;
let cachedDates: Date[] | null = null;

/**
 * 종가 시리즈. 인덱스 0이 가장 오래된 날, 마지막 인덱스가 오늘.
 */
export function priceSeries(): number[] {
  if (cachedSeries) return cachedSeries;

  // 이벤트를 시리즈 인덱스에 매핑 (daysAgo 0 → 마지막 인덱스)
  const changeAt = new Map<number, number>();
  for (const e of STOCK_EVENTS) {
    changeAt.set(TOTAL_DAYS - 1 - e.daysAgo, e.dayChange);
  }

  let seed = SEED;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let value = START_PRICE;
  const out: number[] = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const injected = changeAt.get(i);
    const changePct = injected !== undefined ? injected : 0.055 + (rnd() - 0.5) * 2.1;
    value = value * (1 + changePct / 100);
    out.push(value);
  }

  cachedSeries = out;
  return out;
}

/**
 * 영업일 날짜 배열. 인덱스 0 = 오늘, 인덱스 n = n영업일 전.
 * (이벤트의 daysAgo와 직접 대응한다)
 */
export function businessDates(): Date[] {
  if (cachedDates) return cachedDates;

  const out: Date[] = [];
  const cursor = new Date(2026, 7, 26); // 2026-08-26
  while (out.length < TOTAL_DAYS) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  cachedDates = out;
  return out;
}

/** daysAgo → Date */
export function dateFor(daysAgo: number): Date {
  return businessDates()[daysAgo] ?? businessDates()[0];
}

export interface ChartGeometry {
  /** polyline points 문자열 */
  linePoints: string;
  /** 영역 채움용 polygon points */
  areaPoints: string;
  /** 이 기간의 방향 (시작 대비 끝) */
  rising: boolean;
  yMax: number;
  yMin: number;
  /** x축 라벨 (5개) */
  xLabels: string[];
  /** daysAgo → 차트상 좌표(%) */
  positionFor: (daysAgo: number) => { xPct: number; yPct: number } | null;
}

const VIEW_W = 1000;
const VIEW_H = 296;

/**
 * 기간에 맞는 차트 기하 정보를 계산한다.
 */
export function chartGeometry(periodDays: number): ChartGeometry {
  const all = priceSeries();
  const values = all.slice(TOTAL_DAYS - periodDays);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.14 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const X = (i: number) => (i / (periodDays - 1)) * VIEW_W;
  const Y = (v: number) => VIEW_H - ((v - lo) / (hi - lo)) * VIEW_H;

  const points = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);

  const step = Math.floor((periodDays - 1) / 4);
  const labelIndices = [0, step, step * 2, step * 3, periodDays - 1];

  return {
    linePoints: points.join(' '),
    areaPoints: `0,${VIEW_H} ${points.join(' ')} ${VIEW_W},${VIEW_H}`,
    rising: values[values.length - 1] >= values[0],
    yMax: hi,
    yMin: lo,
    xLabels: labelIndices.map(i => {
      const d = dateFor(periodDays - 1 - i);
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }),
    positionFor: (daysAgo: number) => {
      const i = periodDays - 1 - daysAgo;
      if (i < 0 || i >= values.length) return null;
      return {
        xPct: (X(i) / VIEW_W) * 100,
        yPct: (Y(values[i]) / VIEW_H) * 100,
      };
    },
  };
}

/** 오늘 종가와 전일 대비 */
export function latestQuote() {
  const all = priceSeries();
  const last = all[all.length - 1];
  const prev = all[all.length - 2];
  return {
    price: last,
    changeAmount: last - prev,
    changeRate: ((last - prev) / prev) * 100,
  };
}
