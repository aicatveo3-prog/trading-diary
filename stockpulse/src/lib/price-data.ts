/**
 * 실 주가 데이터 접근 레이어
 *
 * scripts/collect_prices.py 가 생성한 JSON을 읽는다.
 * 서버가 없는 정적 배포이므로 데이터는 빌드 시점에 번들에 포함된다.
 *
 * 구조:
 *   { collectedAt, markets: { KR: { tradingDate, dates, stocks }, US: { ... } } }
 *
 * 시장별로 거래일 축(dates)이 분리되어 있다 — KR과 US는 공휴일이 달라
 * 같은 축을 공유하면 최대 25%의 데이터가 손실되거나 가짜 봉이 생긴다.
 * 종목은 반드시 자기 시장의 축을 참조해야 한다.
 */

import pricesJson from '@/data/prices.json';
import stocksJson from '@/data/stocks.json';

type Market = 'KR' | 'US';

interface OHLCV {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

interface MarketData {
  tradingDate: string;
  dates: string[];
  stocks: Record<string, OHLCV>;
}

interface PricesFile {
  collectedAt: string;
  markets: Record<Market, MarketData>;
}

interface StockMetaRaw {
  id: string;
  name: string;
  market: string;
  currency: string;
  type: string;
  group: string;
}

const prices = pricesJson as unknown as PricesFile;
const stocksRaw = stocksJson as unknown as Record<string, StockMetaRaw>;

export const DEFAULT_TICKER = '005930';

// --- 시장 결정 ---

/** ticker가 어느 시장에 속하는지 판단 */
function marketOf(ticker: string): Market {
  const meta = stocksRaw[ticker];
  if (meta) return meta.market as Market;
  // 메타에 없으면 실제 데이터에서 찾는다
  if (ticker in prices.markets.KR.stocks) return 'KR';
  return 'US';
}

function marketData(ticker: string): MarketData {
  return prices.markets[marketOf(ticker)];
}

// --- 공개 API ---

/**
 * 해당 종목의 거래일 축 (오름차순, 마지막이 최신).
 * 시장별로 다르므로 ticker를 받는다.
 */
export function tradingDates(ticker?: string): string[] {
  if (!ticker) {
    // 하위 호환: ticker 없이 호출되면 KR 축 반환 (news-pins 등)
    return prices.markets.KR.dates;
  }
  return marketData(ticker).dates;
}

/** 데이터 기준일 (해당 종목의 시장 기준) */
export function tradingDate(ticker?: string): string {
  if (!ticker) return prices.markets.KR.tradingDate;
  return marketData(ticker).tradingDate;
}

/**
 * 수집기가 이 데이터를 마지막으로 기록한 시각 (ISO 8601, KST).
 *
 * tradingDate와 다른 것을 나타낸다:
 *   tradingDate  = 어느 장마감 데이터인가 (휴장일에는 안 바뀐다)
 *   collectedAt  = 파이프라인이 마지막으로 돌아간 시각
 *
 * 후자가 며칠째 그대로면 자동 수집이 멈춘 것이다. 화면에 노출해야
 * 사이트만 보고도 정지를 알아챌 수 있다.
 */
export function collectedAt(): string {
  return prices.collectedAt;
}

export function availableTickers(): string[] {
  return Object.keys(stocksRaw);
}

export function hasPrices(ticker: string): boolean {
  const m = marketOf(ticker);
  return ticker in prices.markets[m].stocks;
}

function series(ticker: string): OHLCV {
  const md = marketData(ticker);
  return md.stocks[ticker] ?? prices.markets.KR.stocks[DEFAULT_TICKER];
}

/** 종가 배열 */
export function closeSeries(ticker: string): number[] {
  return series(ticker).c;
}

/**
 * daysAgo → Date.
 * daysAgo는 거래일 기준이며 0이 최신 거래일이다.
 */
export function dateFor(daysAgo: number, ticker?: string): Date {
  const dates = ticker ? marketData(ticker).dates : prices.markets.KR.dates;
  const i = dates.length - 1 - daysAgo;
  const iso = dates[Math.max(0, Math.min(dates.length - 1, i))];
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 해당 거래일의 데이터가 존재하는지 */
export function hasDay(daysAgo: number, ticker?: string): boolean {
  const dates = ticker ? marketData(ticker).dates : prices.markets.KR.dates;
  return daysAgo >= 0 && daysAgo < dates.length;
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
  const dates = marketData(ticker).dates;
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
  bodyTopPct: number;
  bodyHeightPct: number;
  highPct: number;
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
  span: number;
  yTicks: { value: number; yPct: number }[];
  candles: CandleGeometry[];
  volumes: { daysAgo: number; xPct: number; heightPct: number; rising: boolean }[];
  positionFor: (daysAgo: number) => { xPct: number; yPct: number } | null;
  nearestDay: (xPct: number) => number | null;
}

import { Resolution } from './periods';

const VIEW_W = 1000;
const VIEW_H = 296;

// --- 집계 ---

interface AggregatedBar {
  startIdx: number;
  endIdx: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function aggregateBars(
  ticker: string,
  startIdx: number,
  endIdx: number,
  resolution: Resolution
): AggregatedBar[] {
  if (resolution === 'day') {
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
  const dates = marketData(ticker).dates;
  const bars: AggregatedBar[] = [];

  let groupKey = '';
  let bar: AggregatedBar | null = null;

  for (let i = startIdx; i <= endIdx; i++) {
    const dateStr = dates[i];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);

    let key: string;
    if (resolution === 'week') {
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
 */
export function chartGeometry(ticker: string, periodDays: number, resolution: Resolution = 'day'): ChartGeometry {
  const s = series(ticker);
  const total = s.c.length;
  const span = Math.max(1, Math.min(periodDays, total));
  const offset = total - span;

  const bars = aggregateBars(ticker, offset, total - 1, resolution);
  const barCount = bars.length;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const opens = bars.map(b => b.open);
  const volumes = bars.map(b => b.volume);

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

  const labelCount = barCount <= 6 ? barCount : 5;
  const labelIndices = Array.from({ length: labelCount }, (_, k) =>
    labelCount === 1 ? 0 : Math.round((k * (barCount - 1)) / (labelCount - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  const TICK_COUNT = 5;
  const yTicks = Array.from({ length: TICK_COUNT }, (_, k) => {
    const value = hi - ((hi - lo) * k) / (TICK_COUNT - 1);
    return { value, yPct: toPctY(Y(value)) };
  });

  const maxVolume = Math.max(...volumes, 1);
  const md = marketData(ticker);

  return {
    linePoints: points.join(' '),
    areaPoints: `0,${VIEW_H} ${points.join(' ')} ${VIEW_W},${VIEW_H}`,
    rising: closes[closes.length - 1] >= closes[0],
    yMax: hi,
    yMin: lo,
    span,
    yTicks,
    xLabels: labelIndices.map(i => {
      const bar = bars[i];
      const d = dateFor(total - 1 - bar.endIdx, ticker);
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
      const targetIdx = total - 1 - daysAgo;
      const barI = bars.findIndex(b => b.startIdx <= targetIdx && targetIdx <= b.endIdx);
      if (barI < 0) return null;
      return { xPct: toPctX(X(barI)), yPct: toPctY(Y(closes[barI])) };
    },
    nearestDay: (xPct: number) => {
      if (barCount === 0) return null;
      const i = Math.round((xPct / 100) * (barCount - 1));
      const clamped = Math.max(0, Math.min(barCount - 1, i));
      return total - 1 - bars[clamped].endIdx;
    },
  };
}

// --- 지수 ---

export interface IndexQuote {
  /** universe id */
  id: string;
  name: string;
  value: number;
  changeRate: number;
  date: string;
}

/**
 * 대시보드 상단 지수 스트립.
 *
 * indices.json(별도 파일)을 쓰지 않고 prices.json에서 직접 계산한다.
 * 이유: 그 파일은 어떤 수집기도 갱신하지 않아 낡은 값이 남아 있었다
 * (코스피 6,912 vs 실제 6,839). 단일 소스에서 파생하면 어긋날 수 없다.
 */
const STRIP_IDS = ['KS11', 'USDKRW', 'SPX', 'IXIC'];

export function marketIndices(): IndexQuote[] {
  const out: IndexQuote[] = [];

  for (const id of STRIP_IDS) {
    if (!hasPrices(id)) continue;
    const meta = stocksRaw[id];
    const md = marketData(id);
    const s = md.stocks[id];
    const last = s.c[s.c.length - 1];
    const prev = s.c[s.c.length - 2] ?? last;

    out.push({
      id,
      name: meta?.name ?? id,
      value: last,
      changeRate: prev === 0 ? 0 : ((last - prev) / prev) * 100,
      date: md.tradingDate,
    });
  }

  return out;
}

// --- 종목 메타 ---

export interface StockMeta {
  name: string;
  ticker: string;
  market: string;
  currency: string;
  type: string;
  group: string;
}

export function stockMetaMap(): Record<string, StockMeta> {
  // stocks.json은 { id, name, market, currency, type, group } 구조.
  // 기존 코드와의 호환을 위해 ticker 필드를 추가해 반환한다.
  const result: Record<string, StockMeta> = {};
  for (const [id, raw] of Object.entries(stocksRaw)) {
    result[id] = {
      name: raw.name,
      ticker: id,
      market: raw.market,
      currency: raw.currency,
      type: raw.type,
      group: raw.group,
    };
  }
  return result;
}

export function stockMeta(ticker: string): StockMeta | null {
  return stockMetaMap()[ticker] ?? null;
}

/** 상세 페이지가 생성되는 종목인지 */
export function hasDetailPage(ticker: string): boolean {
  return ticker in stocksRaw;
}
