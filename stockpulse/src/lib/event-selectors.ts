/**
 * 이벤트 파생 계산
 *
 * "어떤 이벤트를 차트에 핀으로 꽂을지"를 결정하는 규칙이 여기 있다.
 * 핀을 무한정 꽂으면 차트가 읽히지 않으므로, 중요도 상위 N개만 남긴다.
 */

import { StockEvent, EventType } from './events-data';

/** 중요도 = |당일 변동폭| × 보도 매체 수 */
function importance(e: StockEvent): number {
  return Math.abs(e.dayChange) * e.sources;
}

export interface VisibleEvents {
  /** 기간 내 전체 이벤트 (최신순) */
  all: StockEvent[];
  /** 차트에 핀으로 꽂히는 이벤트 */
  pinned: StockEvent[];
  /** 이벤트 id → 타임라인 번호 (최신순 1부터) */
  numbering: Map<string, number>;
  /** 기간 내 등장하는 유형 목록 */
  types: EventType[];
}

export function selectVisibleEvents(
  events: StockEvent[],
  periodDays: number,
  maxPins: number
): VisibleEvents {
  const inRange = events.filter(e => e.daysAgo < periodDays);

  // 최신순 정렬 후 번호 부여 — 번호는 필터/정렬과 무관하게 고정된다
  const byRecency = [...inRange].sort((a, b) => a.daysAgo - b.daysAgo);
  const numbering = new Map<string, number>();
  byRecency.forEach((e, i) => numbering.set(e.id, i + 1));

  const pinned = [...inRange]
    .sort((a, b) => importance(b) - importance(a))
    .slice(0, maxPins);

  const types = Array.from(new Set(inRange.map(e => e.type)));

  return { all: byRecency, pinned, numbering, types };
}

export type SortMode = 'recent' | 'move';

/** 필터 + 정렬 적용 */
export function applyTimelineView(
  events: StockEvent[],
  filter: EventType | '전체',
  sort: SortMode
): StockEvent[] {
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
 * 예측이 아니라 "분포"를 보여주는 것이 목적이다.
 */
export function similarCases(events: StockEvent[], selected: StockEvent): SimilarCases {
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
