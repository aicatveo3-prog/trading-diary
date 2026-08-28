/**
 * 분봉 데이터 접근 + 집계
 *
 * scripts/collect_minutes.py 가 생성한 JSON을 읽는다.
 *
 * ⚠️ 이 데이터에는 시가·고가·저가가 없다. **종가만 있다.**
 *    따라서 분봉 구간에서는 캔들 차트를 그릴 수 없고 선 차트만 가능하다.
 *    없는 OHLC를 종가로 채워 캔들처럼 보이게 만들지 않는다 — 거짓이 된다.
 */

import minutesJson from '@/data/minutes.json';

interface DayBars {
  /** 시각 'HHMM' */
  t: string[];
  /** 종가 */
  c: number[];
  /** 분당 거래량 (수집 단계에서 누적값을 차분해 둠) */
  v: number[];
}

interface MinutesFile {
  collectedAt: string;
  stocks: Record<string, Record<string, DayBars>>;
}

const minutes = minutesJson as MinutesFile;

/** 분봉 해상도 (분 단위) */
export type MinuteInterval = 1 | 5 | 30 | 60;

/** 집계된 분봉 하나 */
export interface MinuteBar {
  /** 'YYYYMMDD' */
  date: string;
  /** 구간 시작 시각 'HHMM' */
  time: string;
  /** 구간 마지막 종가 */
  close: number;
  /** 구간 내 최고 종가 — 진짜 고가가 아니라 '종가들의 최고값'이다 */
  closeHigh: number;
  /** 구간 내 최저 종가 */
  closeLow: number;
  /** 구간 거래량 합계 */
  volume: number;
}

export function minutesCollectedAt(): string {
  return minutes.collectedAt;
}

export function hasMinutes(ticker: string): boolean {
  const days = minutes.stocks[ticker];
  return !!days && Object.keys(days).length > 0;
}

/** 보유한 거래일 목록 (오름차순, 'YYYYMMDD') */
export function minuteDates(ticker: string): string[] {
  return Object.keys(minutes.stocks[ticker] ?? {}).sort();
}

/** 'HHMM' → 분 단위 정수 (09:05 → 545) */
function toMinuteOfDay(hhmm: string): number {
  return parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(2), 10);
}

/**
 * 최근 N거래일의 분봉을 지정 간격으로 집계해 반환한다.
 *
 * 집계 규칙 (종가만 있으므로 제한적):
 *   close     = 구간 마지막 종가
 *   closeHigh = 구간 종가들의 최고값
 *   closeLow  = 구간 종가들의 최저값
 *   volume    = 구간 거래량 합계
 *
 * 구간은 날짜를 넘지 않는다 — 15:30과 다음 날 09:00을 한 바로 묶으면
 * 존재하지 않는 가격 흐름을 만들어낸다.
 */
export function aggregateMinutes(
  ticker: string,
  days: number,
  interval: MinuteInterval
): MinuteBar[] {
  const store = minutes.stocks[ticker];
  if (!store) return [];

  const dates = minuteDates(ticker).slice(-days);
  const out: MinuteBar[] = [];

  for (const date of dates) {
    const bars = store[date];
    if (!bars) continue;

    // 구간 인덱스 → 누적
    let bucketKey = -1;
    let current: MinuteBar | null = null;

    for (let i = 0; i < bars.t.length; i++) {
      const minuteOfDay = toMinuteOfDay(bars.t[i]);
      const key = Math.floor(minuteOfDay / interval);

      if (key !== bucketKey) {
        if (current) out.push(current);
        bucketKey = key;
        current = {
          date,
          time: bars.t[i],
          close: bars.c[i],
          closeHigh: bars.c[i],
          closeLow: bars.c[i],
          volume: bars.v[i],
        };
      } else if (current) {
        current.close = bars.c[i];
        current.closeHigh = Math.max(current.closeHigh, bars.c[i]);
        current.closeLow = Math.min(current.closeLow, bars.c[i]);
        current.volume += bars.v[i];
      }
    }
    if (current) out.push(current);
  }

  return out;
}

/** 'YYYYMMDD' → 'MM.DD' */
export function formatMinuteDate(date: string): string {
  return `${date.slice(4, 6)}.${date.slice(6, 8)}`;
}

/** 'HHMM' → 'HH:MM' */
export function formatMinuteTime(time: string): string {
  return `${time.slice(0, 2)}:${time.slice(2)}`;
}
