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

/** 하루치 시세 */
export interface DayQuote {
  daysAgo: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changeRate: number;
}

/** 특정 거래일의 시세 전체 */
export function dayQuote(ticker: string, daysAgo: number): DayQuote | null {
  const s = series(ticker);
  const dates = prices.dates;
  const i = dates.length - 1 - daysAgo;
  if (i < 0 || i >= dates.length) return null;

  const prevClose = i > 0 ? s.c[i - 1] : s.c[i];
  return {
    daysAgo,
    date: dates[i],
    open: s.o[i],
    high: s.h[i],
    low: s.l[i],
    close: s.c[i],
    volume: s.v[i],
    changeRate: prevClose === 0 ? 0 : ((s.c[i] - prevClose) / prevClose) * 100,
  };
}

/** 캔들 하나의 좌표 (모두 % 단위) */
export interface CandleGeometry {
  daysAgo: number;
  xPct: number;
  /** 몸통 상단(시가·종가 중 높은 쪽) */
  bodyTopPct: number;
  /** 몸통 높이 */
  bodyHeightPct: number;
  /** 꼬리 상단(고가) */
  highPct: number;
  /** 꼬리 하단(저가) */
  lowPct: number;
  rising: boolean;
}

export interface ChartGeometry {
  linePoints: string;
  areaPoints: string;
  rising: boolean;
  yMax: number;
  yMin: number;
  xLabels: string[];
  /** 실제로 그려진 거래일 수 */
  span: number;
  /** y축 눈금 (위에서 아래로) */
  yTicks: { value: number; yPct: number }[];
  /** 캔들 좌표 */
  candles: CandleGeometry[];
  /** 거래량 바 (heightPct는 최대 거래량 대비 비율) */
  volumes: { daysAgo: number; xPct: number; heightPct: number; rising: boolean }[];
  positionFor: (daysAgo: number) => { xPct: number; yPct: number } | null;
  /** 차트 가로 위치(0~100%)에 가장 가까운 거래일 */
  nearestDay: (xPct: number) => number | null;
}

import { Resolution } from './events-data';

const VIEW_W = 1000;
const VIEW_H = 296;

// --- 집계 ---

interface AggregatedBar {
  /** 이 바의 첫 거래일 인덱스 (원본 dates 배열 기준) */
  startIdx: number;
  /** 이 바의 마지막 거래일 인덱스 */
  endIdx: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 일봉을 주봉 또는 월봉으로 집계한다.
 *
 * OHLCV 집계 규칙:
 *   O = 구간 첫 캔들의 시가
 *   H = 구간 내 최고가
 *   L = 구간 내 최저가
 *   C = 구간 마지막 캔들의 종가
 *   V = 구간 거래량 합계
 *
 * 주봉: 같은 ISO 주차(월~금)에 속하는 거래일을 묶는다.
 * 월봉: 같은 연월에 속하는 거래일을 묶는다.
 */
function aggregateBars(
  ticker: string,
  startIdx: number,
  endIdx: number,
  resolution: Resolution
): AggregatedBar[] {
  if (resolution === 'day') {
    // 집계 없이 일봉 그대로 반환
    const s = series(ticker);
    const bars: AggregatedBar[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      bars.push({
        startIdx: i,
        endIdx: i,
        open: s.o[i],
        high: s.h[i],
        low: s.l[i],
        close: s.c[i],
        volume: s.v[i],
      });
    }
    return bars;
  }

  const s = series(ticker);
  const dates = prices.dates;
  const bars: AggregatedBar[] = [];

  let groupKey = '';
  let bar: AggregatedBar | null = null;

  for (let i = startIdx; i <= endIdx; i++) {
    const dateStr = dates[i];
    // 연-월-일 파싱 (new Date(str)는 UTC 해석이라 시간대 문제를 피하기 위해 직접 파싱)
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);

    let key: string;
    if (resolution === 'week') {
      // ISO 주차: 그 주의 월요일 날짜를 키로 쓴다
      const day = dt.getDay();
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - ((day + 6) % 7));
      key = monday.toISOString().slice(0, 10);
    } else {
      // month
      key = `${y}-${String(m).padStart(2, '0')}`;
    }

    if (key !== groupKey) {
      if (bar) bars.push(bar);
      groupKey = key;
      bar = {
        startIdx: i,
        endIdx: i,
        open: s.o[i],
        high: s.h[i],
        low: s.l[i],
        close: s.c[i],
        volume: s.v[i],
      };
    } else if (bar) {
      bar.endIdx = i;
      bar.high = Math.max(bar.high, s.h[i]);
      bar.low = Math.min(bar.low, s.l[i]);
      bar.close = s.c[i];
      bar.volume += s.v[i];
    }
  }
  if (bar) bars.push(bar);

  return bars;
}

/**
 * 기간에 맞는 SVG 좌표를 계산한다.
 * 차트 라이브러리를 쓰지 않으므로 여기서 직접 스케일링한다.
 *
 * resolution이 'week'이나 'month'이면 일봉을 집계한 뒤 그 결과를 그린다.
 * 이렇게 하면 1년 차트가 250개(빽빽)가 아니라 52개(선명)로 나온다.
 */
export function chartGeometry(ticker: string, periodDays: number, resolution: Resolution = 'day'): ChartGeometry {
  const s = series(ticker);
  const total = s.c.length;
  const span = Math.max(1, Math.min(periodDays, total));
  const offset = total - span;

  // 집계 — resolution에 따라 일봉을 주봉/월봉으로 묶는다
  const bars = aggregateBars(ticker, offset, total - 1, resolution);
  const barCount = bars.length;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const opens = bars.map(b => b.open);
  const volumes = bars.map(b => b.volume);

  // 캔들의 꼬리까지 보이려면 고가·저가를 스케일에 포함해야 한다.
  // 종가만으로 범위를 잡으면 꼬리가 차트 밖으로 삐져나간다.
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const pad = (max - min) * 0.1 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const X = (i: number) => (barCount === 1 ? VIEW_W / 2 : (i / (barCount - 1)) * VIEW_W);
  const Y = (v: number) => VIEW_H - ((v - lo) / (hi - lo)) * VIEW_H;
  const toPctX = (x: number) => (x / VIEW_W) * 100;
  const toPctY = (y: number) => (y / VIEW_H) * 100;

  const points = closes.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);

  // x축 라벨 — 집계된 바 개수 기준으로 배치한다
  const labelCount = barCount <= 6 ? barCount : 5;
  const labelIndices = Array.from({ length: labelCount }, (_, k) =>
    labelCount === 1 ? 0 : Math.round((k * (barCount - 1)) / (labelCount - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  // y축 눈금 5개 — 값이 2개뿐이면 중간 수준을 읽을 수 없다
  const TICK_COUNT = 5;
  const yTicks = Array.from({ length: TICK_COUNT }, (_, k) => {
    const value = hi - ((hi - lo) * k) / (TICK_COUNT - 1);
    return { value, yPct: toPctY(Y(value)) };
  });

  const maxVolume = Math.max(...volumes, 1);

  return {
    linePoints: points.join(' '),
    areaPoints: `0,${VIEW_H} ${points.join(' ')} ${VIEW_W},${VIEW_H}`,
    rising: closes[closes.length - 1] >= closes[0],
    yMax: hi,
    yMin: lo,
    span,
    yTicks,
    xLabels: labelIndices.map(i => {
      // 집계된 바의 마지막 거래일을 라벨로 쓴다
      const bar = bars[i];
      const d = dateFor(total - 1 - bar.endIdx);
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }),
    candles: closes.map((close, i) => {
      const open = opens[i];
      const top = Math.max(open, close);
      const bottom = Math.min(open, close);
      const topPct = toPctY(Y(top));
      const bottomPct = toPctY(Y(bottom));
      return {
        daysAgo: total - 1 - bars[i].endIdx,
        xPct: toPctX(X(i)),
        bodyTopPct: topPct,
        // 시가와 종가가 같으면 높이가 0이 되어 보이지 않으므로 최소 두께를 준다
        bodyHeightPct: Math.max(bottomPct - topPct, 0.35),
        highPct: toPctY(Y(highs[i])),
        lowPct: toPctY(Y(lows[i])),
        rising: close >= open,
      };
    }),
    volumes: volumes.map((v, i) => ({
      daysAgo: total - 1 - bars[i].endIdx,
      xPct: toPctX(X(i)),
      heightPct: (v / maxVolume) * 100,
      rising: closes[i] >= opens[i],
    })),
    positionFor: (daysAgo: number) => {
      // 뉴스 핀은 daysAgo(거래일 기준)로 위치를 요청한다.
      // 집계 모드에서는 해당 daysAgo가 속한 바의 x 위치를 반환한다.
      const targetIdx = total - 1 - daysAgo;
      const barI = bars.findIndex(b => b.startIdx <= targetIdx && targetIdx <= b.endIdx);
      if (barI < 0) return null;
      return { xPct: toPctX(X(barI)), yPct: toPctY(Y(closes[barI])) };
    },
    nearestDay: (xPct: number) => {
      if (barCount === 0) return null;
      const i = Math.round((xPct / 100) * (barCount - 1));
      const clamped = Math.max(0, Math.min(barCount - 1, i));
      // 바의 마지막 거래일을 daysAgo로 반환
      return total - 1 - bars[clamped].endIdx;
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
