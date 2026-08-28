/**
 * 분봉 데이터 접근 + 집계
 *
 * scripts/collect_minutes.py 가 생성한 종목별 JSON을 런타임 fetch로 읽는다.
 *
 * 파일 위치: public/minutes/{id}_{interval}.json
 * 파일 구조: { collectedAt: string, days: { "YYYYMMDD": { t, s, o, h, l, c, v } } }
 *
 * ✅ 이제 OHLC가 완비되어 캔들 차트를 그릴 수 있다.
 *    - o: 시가, h: 고가, l: 저가, c: 종가
 *    - s: 세션코드 (0=프리마켓, 1=정규장, 2=애프터마켓)
 *
 * 기존 정적 import(minutes.json 2.3MB 번들 포함)에서 런타임 fetch로 전환.
 * 효과: 1종목당 전송량 ~20KB(gzip ~6KB). 종목 수와 무관.
 */

import { entryFor } from './universe';

/** 분봉 파일 하나의 구조 */
interface MinuteFileData {
  collectedAt: string;
  days: Record<string, DayBars>;
}

interface DayBars {
  /** 시각 'HHMM' */
  t: string[];
  /** 세션 코드: 0=프리, 1=정규, 2=애프터 */
  s: number[];
  /** 시가 */
  o: number[];
  /** 고가 */
  h: number[];
  /** 저가 */
  l: number[];
  /** 종가 */
  c: number[];
  /** 거래량 */
  v: number[];
}

/** 분봉 해상도 (분 단위) */
export type MinuteInterval = 5 | 30 | 60;

/** 세션 필터 */
export type SessionFilter = 'all' | 'regular';

/** 집계된 분봉 하나 */
export interface MinuteBar {
  /** 'YYYYMMDD' */
  date: string;
  /** 구간 시작 시각 'HHMM' */
  time: string;
  /** 시가 (구간 첫 바의 시가) */
  open: number;
  /** 구간 내 최고가 */
  high: number;
  /** 구간 내 최저가 */
  low: number;
  /** 종가 (구간 마지막 바의 종가) */
  close: number;
  /** 구간 거래량 합계 */
  volume: number;
  /** 세션 코드 (구간 첫 바 기준) */
  session: number;
}

// --- 캐시 ---

const cache = new Map<string, MinuteFileData>();
const inflight = new Map<string, Promise<MinuteFileData | null>>();

function basePath(): string {
  // Next.js 정적 export에서 basePath가 설정된 경우를 처리한다.
  // process.env.NEXT_PUBLIC_BASE_PATH가 있으면 사용, 없으면 빈 문자열.
  return process.env.NEXT_PUBLIC_BASE_PATH ?? '';
}

function fileUrl(ticker: string, interval: MinuteInterval | '5m' | '1h'): string {
  const key = typeof interval === 'number' ? (interval <= 5 ? '5m' : '1h') : interval;
  return `${basePath()}/minutes/${ticker}_${key}.json`;
}

/**
 * 종목별 분봉 데이터를 fetch로 가져온다.
 * 캐시가 있으면 즉시 반환, 없으면 네트워크 요청.
 */
async function fetchMinuteFile(
  ticker: string,
  interval: MinuteInterval
): Promise<MinuteFileData | null> {
  const key = `${ticker}_${interval <= 5 ? '5m' : '1h'}`;

  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = (async () => {
    try {
      const url = fileUrl(ticker, interval);
      const res = await fetch(url);
      if (!res.ok) return null;
      const data: MinuteFileData = await res.json();
      cache.set(key, data);
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * 종목에 분봉 데이터가 존재하는지 (빌드 시점에서는 알 수 없으므로
 * universe에 등록된 종목이면 true를 반환한다).
 */
export function hasMinutes(ticker: string): boolean {
  return entryFor(ticker) !== null;
}

/** 'HHMM' → 분 단위 정수 (09:05 → 545) */
function toMinuteOfDay(hhmm: string): number {
  return parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(2), 10);
}

/**
 * 최근 N거래일의 분봉을 지정 간격으로 집계해 반환한다.
 *
 * 집계 규칙 (OHLC 완비):
 *   open   = 구간 첫 바의 시가
 *   high   = 구간 내 최고가
 *   low    = 구간 내 최저가
 *   close  = 구간 마지막 바의 종가
 *   volume = 구간 거래량 합계
 *
 * 구간은 날짜를 넘지 않는다 — 15:30과 다음 날 09:00을 한 바로 묶으면
 * 존재하지 않는 가격 흐름을 만들어낸다.
 */
export async function aggregateMinutes(
  ticker: string,
  days: number,
  interval: MinuteInterval,
  session: SessionFilter = 'all'
): Promise<MinuteBar[]> {
  const data = await fetchMinuteFile(ticker, interval);
  if (!data) return [];

  const dates = Object.keys(data.days).sort().slice(-days);
  const out: MinuteBar[] = [];

  for (const date of dates) {
    const bars = data.days[date];
    if (!bars) continue;

    let bucketKey = -1;
    let current: MinuteBar | null = null;

    for (let i = 0; i < bars.t.length; i++) {
      // 세션 필터
      if (session === 'regular' && bars.s[i] !== 1) continue;

      const minuteOfDay = toMinuteOfDay(bars.t[i]);
      const key = Math.floor(minuteOfDay / interval);

      if (key !== bucketKey) {
        if (current) out.push(current);
        bucketKey = key;
        current = {
          date,
          time: bars.t[i],
          open: bars.o[i],
          high: bars.h[i],
          low: bars.l[i],
          close: bars.c[i],
          volume: bars.v[i],
          session: bars.s[i],
        };
      } else if (current) {
        current.high = Math.max(current.high, bars.h[i]);
        current.low = Math.min(current.low, bars.l[i]);
        current.close = bars.c[i];
        current.volume += bars.v[i];
      }
    }
    if (current) out.push(current);
  }

  return out;
}

/** 보유한 거래일 목록 (오름차순, 'YYYYMMDD') — fetch 후 사용 */
export async function minuteDates(
  ticker: string,
  interval: MinuteInterval
): Promise<string[]> {
  const data = await fetchMinuteFile(ticker, interval);
  if (!data) return [];
  return Object.keys(data.days).sort();
}

/** 'YYYYMMDD' → 'MM.DD' */
export function formatMinuteDate(date: string): string {
  return `${date.slice(4, 6)}.${date.slice(6, 8)}`;
}

/** 'HHMM' → 'HH:MM' */
export function formatMinuteTime(time: string): string {
  return `${time.slice(0, 2)}:${time.slice(2)}`;
}
