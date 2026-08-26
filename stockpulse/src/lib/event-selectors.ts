/**
 * 이벤트 파생 계산
 *
 * 예시 이벤트(날짜·헤드라인)와 실제 주가를 결합해,
 * 화면에 표시할 등락률을 만들어낸다.
 *
 * 이 레이어가 존재하는 이유: 등락률을 이벤트에 하드코딩하면 실제 차트와
 * 어긋난다. 항상 실제 종가에서 계산해 핀과 차트가 모순되지 않게 한다.
 */

import { StockEvent, EventType } from './events-data';
import { changeAt, forwardChange, hasDay } from './price-data';

/** 실제 주가에서 등락률을 채운 이벤트 */
export interface ResolvedEvent extends StockEvent {
  /** 당일 등락률 (%) — 실제 종가 기준 */
  dayChange: number;
  /** 1주(5거래일) 후 누적 등락률 (%). 아직 도래하지 않았으면 null */
  week1Change: number | null;
}

const WEEK_TRADING_DAYS = 5;

/**
 * 이벤트에 실제 등락률을 채운다.
 * 주가 데이터 범위를 벗어난 이벤트는 제외한다.
 */
export function resolveEvents(ticker: string, events: StockEvent[]): ResolvedEvent[] {
  return events
    .filter(e => hasDay(e.daysAgo))
    .map(e => ({
      ...e,
      dayChange: changeAt(ticker, e.daysAgo),
      week1Change: forwardChange(ticker, e.daysAgo, WEEK_TRADING_DAYS),
    }));
}

/** 중요도 = |당일 변동폭| × 보도 매체 수 */
function importance(e: ResolvedEvent): number {
  return Math.abs(e.dayChange) * e.sources;
}

export interface VisibleEvents {
  /** 기간 내 전체 이벤트 (최신순) */
  all: ResolvedEvent[];
  /** 차트에 핀으로 꽂히는 이벤트 */
  pinned: ResolvedEvent[];
  /** 이벤트 id → 타임라인 번호 (최신순 1부터) */
  numbering: Map<string, number>;
  /** 기간 내 등장하는 유형 목록 */
  types: EventType[];
}

export function selectVisibleEvents(
  events: ResolvedEvent[],
  periodDays: number,
  maxPins: number
): VisibleEvents {
  const inRange = events.filter(e => e.daysAgo < periodDays);

  // 최신순 정렬 후 번호 부여 — 번호는 필터/정렬과 무관하게 고정된다
  const byRecency = [...inRange].sort((a, b) => a.daysAgo - b.daysAgo);
  const numbering = new Map<string, number>();
  byRecency.forEach((e, i) => numbering.set(e.id, i + 1));

  const pinned = [...inRange].sort((a, b) => importance(b) - importance(a)).slice(0, maxPins);

  const types = Array.from(new Set(inRange.map(e => e.type)));

  return { all: byRecency, pinned, numbering, types };
}

export type SortMode = 'recent' | 'move';

/** 필터 + 정렬 적용 */
export function applyTimelineView(
  events: ResolvedEvent[],
  filter: EventType | '전체',
  sort: SortMode
): ResolvedEvent[] {
  const filtered = events.filter(e => filter === '전체' || e.type === filter);
  return [...filtered].sort((a, b) =>
    sort === 'recent' ? a.daysAgo - b.daysAgo : Math.abs(b.dayChange) - Math.abs(a.dayChange)
  );
}

/** 핀 지름 — 변동폭이 클수록 크게, 상한을 둔다 */
export function pinDiameter(dayChange: number): number {
  return Math.min(30, 17 + Math.abs(dayChange) * 2.4);
}

export interface SimilarCases {
  type: EventType;
  count: number;
  upCount: number;
  downCount: number;
  rows: { daysAgo: number; headline: string; dayChange: number }[];
}

/**
 * 같은 유형의 뉴스가 과거에 났을 때의 반응 분포.
 * 평균을 내지 않는다 — 평균은 예측처럼 읽히기 때문이다.
 */
export function similarCases(
  events: ResolvedEvent[],
  selected: ResolvedEvent
): SimilarCases {
  const same = events.filter(e => e.type === selected.type);
  return {
    type: selected.type,
    count: same.length,
    upCount: same.filter(e => e.dayChange > 0).length,
    downCount: same.filter(e => e.dayChange < 0).length,
    rows: same.slice(0, 4).map(e => ({
      daysAgo: e.daysAgo,
      headline: e.headline,
      dayChange: e.dayChange,
    })),
  };
}
