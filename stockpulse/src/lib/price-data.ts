/**
 * 실 주가 데이터 접근 레이어
 *
 * scripts/collect_prices.py 가 생성한 JSON을 읽는다.
 * 서버가 없는 정적 배포이므로 데이터는 빌드 시점에 번들에 포함된다.
 *
 * 거래일 축(dates)은 모든 종목이 공유한다 — 종목마다 축이 다르면
 * 차트 x좌표가 어긋나기 때문에 수집 단계에서 이미 정렬해 두었다.
 */

import pricesJson from '@/data/prices.json';
import indicesJson from '@/data/indices.json';
import stocksJson from '@/data/stocks.json';

interface OHLCV {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

interface PricesFile {
  tradingDate: string;
  collectedAt: string;
  dates: string[];
  stocks: Record<string, OHLCV>;
}

const prices = pricesJson as PricesFile;

export const DEFAULT_TICKER = '005930';

/** 공통 거래일 축 (오름차순, 마지막이 최신) */
export function tradingDates(): string[] {
  return prices.dates;
}

/** 데이터 기준일 */
export function tradingDate(): string {
  return prices.tradingDate;
}

export function availableTickers(): string[] {
  return Object.keys(prices.stocks);
}

export function hasPrices(ticker: string): boolean {
  return ticker in prices.stocks;
}

function series(ticker: string): OHLCV {
  return prices.stocks[ticker] ?? prices.stocks[DEFAULT_TICKER];
}

/** 종가 배열 */
export function closeSeries(ticker: string): number[] {
  return series(ticker).c;
}

/**
 * daysAgo → Date.
 * daysAgo는 거래일 기준이며 0이 최신 거래일이다.
 */
export function dateFor(daysAgo: number): Date {
  const dates = prices.dates;
  const i = dates.length - 1 - daysAgo;
  const iso = dates[Math.max(0, Math.min(dates.length - 1, i))];
  // 'YYYY-MM-DD'를 로컬 자정으로 파싱한다 (new Date(iso)는 UTC로 해석되어
  // 시간대에 따라 하루 밀릴 수 있다)
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 해당 거래일의 데이터가 존재하는지 */
export function hasDay(daysAgo: number): boolean {
  return daysAgo >= 0 && daysAgo < prices.dates.length;
}

/** 최신 거래일의 종가와 전일 대비 */
export function latestQuote(ticker: string) {
  const c = closeSeries(ticker);
  const last = c[c.length - 1];
  const prev = c[c.length - 2] ?? last;
  return {
    price: last,
    changeAmount: last - prev,
    changeRate: prev === 0 ? 0 : ((last - prev) / prev) * 100,
  };
}

/** 특정 거래일의 전일 대비 등락률 (%) */
export function changeAt(ticker: string, daysAgo: number): number {
  const c = closeSeries(ticker);
  const i = c.length - 1 - daysAgo;
  if (i <= 0 || i >= c.length) return 0;
  const prev = c[i - 1];
  return prev === 0 ? 0 : ((c[i] - prev) / prev) * 100;
}

/**
 * 기준일로부터 spanDays 거래일 뒤까지의 누적 등락률 (%).
 *
 * spanDays가 아직 다 지나지 않았으면 null을 반환한다.
 * 확보된 마지막 거래일까지만 잘라서 계산하면, 예컨대 2거래일치 수익률을
 * '1주 후'라고 표시하게 되어 라벨이 데이터를 왜곡한다.
 */
export function forwardChange(ticker: string, daysAgo: number, spanDays: number): number | null {
  const c = closeSeries(ticker);
  const base = c.length - 1 - daysAgo;
  if (base < 0 || base >= c.length) return null;

  const target = base + spanDays;
  if (target > c.length - 1) return null;

  return ((c[target] - c[base]) / c[base]) * 100;
}

/** 특정 거래일의 거래량 */
export function volumeAt(ticker: string, daysAgo: number): number {
  const v = series(ticker).v;
  const i = v.length - 1 - daysAgo;
  return v[i] ?? 0;
}

// --- 차트 기하 ---

export interface ChartGeometry {
  linePoints: string;
  areaPoints: string;
  rising: boolean;
  yMax: number;
  yMin: number;
  xLabels: string[];
  positionFor: (daysAgo: number) => { xPct: number; yPct: number } | null;
}

const VIEW_W = 1000;
const VIEW_H = 296;

/**
 * 기간에 맞는 SVG 좌표를 계산한다.
 * 차트 라이브러리를 쓰지 않으므로 여기서 직접 스케일링한다.
 */
export function chartGeometry(ticker: string, periodDays: number): ChartGeometry {
  const all = closeSeries(ticker);
  const span = Math.min(periodDays, all.length);
  const values = all.slice(all.length - span);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.14 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const X = (i: number) => (span === 1 ? 0 : (i / (span - 1)) * VIEW_W);
  const Y = (v: number) => VIEW_H - ((v - lo) / (hi - lo)) * VIEW_H;

  const points = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);

  const step = Math.max(1, Math.floor((span - 1) / 4));
  const labelIndices = [0, step, step * 2, step * 3, span - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i && v < span
  );

  return {
    linePoints: points.join(' '),
    areaPoints: `0,${VIEW_H} ${points.join(' ')} ${VIEW_W},${VIEW_H}`,
    rising: values[values.length - 1] >= values[0],
    yMax: hi,
    yMin: lo,
    xLabels: labelIndices.map(i => {
      const d = dateFor(span - 1 - i);
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }),
    positionFor: (daysAgo: number) => {
      const i = span - 1 - daysAgo;
      if (i < 0 || i >= values.length) return null;
      return { xPct: (X(i) / VIEW_W) * 100, yPct: (Y(values[i]) / VIEW_H) * 100 };
    },
  };
}

// --- 지수 ---

export interface IndexQuote {
  name: string;
  value: number;
  changeRate: number;
  date: string;
}

export function marketIndices(): IndexQuote[] {
  const raw = indicesJson as Record<string, IndexQuote>;
  return ['KS11', 'KQ11'].map(code => raw[code]).filter(Boolean);
}

// --- 종목 메타 ---

export interface StockMeta {
  name: string;
  ticker: string;
  market: string;
}

export function stockMetaMap(): Record<string, StockMeta> {
  return stocksJson as Record<string, StockMeta>;
}

export function stockMeta(ticker: string): StockMeta | null {
  return stockMetaMap()[ticker] ?? null;
}

/** 상세 페이지가 생성되는 종목인지 (정적 배포에서는 이 목록만 접근 가능) */
export function hasDetailPage(ticker: string): boolean {
  return ticker in stockMetaMap();
}
