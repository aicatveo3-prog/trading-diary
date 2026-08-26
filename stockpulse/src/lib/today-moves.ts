/**
 * 오늘, 뉴스로 설명되는 움직임
 *
 * 실제 등락률로 순위를 만들고, 그날 해당 종목의 예시 이벤트가 있으면
 * 원인 후보로 함께 보여준다. 이벤트가 없으면 그 사실을 그대로 표시한다 —
 * 없는 원인을 지어내지 않는다.
 */

import { availableTickers, changeAt, stockMeta } from './price-data';
import { eventsFor } from './events-data';

export interface TodayMove {
  ticker: string;
  name: string;
  market: string;
  changeRate: number;
  /** 같은 날 보도된 예시 뉴스 헤드라인. 없으면 null */
  cause: string | null;
  /** 보도 매체 수 */
  sources: number | null;
}

/**
 * 변동폭이 큰 순으로 정렬해 반환한다.
 * 중요도에 매체 수를 곱하지 않는 이유: 뉴스가 없는 종목이 대부분이라
 * 곱하면 뉴스 있는 종목만 상위에 남는다. 여기서는 '움직임'이 기준이다.
 */
export function todayMoves(limit = 5): TodayMove[] {
  const moves: TodayMove[] = [];

  for (const ticker of availableTickers()) {
    const meta = stockMeta(ticker);
    if (!meta) continue;

    const changeRate = changeAt(ticker, 0);

    // 오늘(daysAgo 0) 보도된 이벤트가 있으면 원인 후보로 쓴다
    const todayEvent = eventsFor(ticker).find(e => e.daysAgo === 0);

    moves.push({
      ticker,
      name: meta.name,
      market: meta.market,
      changeRate,
      cause: todayEvent?.headline ?? null,
      sources: todayEvent?.sources ?? null,
    });
  }

  return moves
    .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
    .slice(0, limit);
}
