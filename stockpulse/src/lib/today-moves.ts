/**
 * 오늘 크게 움직인 종목
 *
 * 실제 종가로 등락률을 계산해 변동폭이 큰 순으로 정렬한다.
 *
 * 원인(뉴스)은 아직 붙이지 않는다. 예전에는 예시 이벤트(events-data)에서
 * 원인 후보를 끌어왔으나, 그 데이터는 삼성전자 자리표시자였고 거래일 축이
 * 바뀐 뒤로는 엉뚱한 날짜를 가리켜 제거했다. 실제 뉴스에서 그날의 원인을
 * 뽑아 붙이는 것은 별도 작업으로 남겨둔다 (news-pins가 이미 종목 상세에서
 * 뉴스를 거래일에 매핑하므로, 그 로직을 대시보드로 끌어오면 된다).
 */

import { availableTickers, changeAt, stockMeta } from './price-data';

export interface TodayMove {
  ticker: string;
  name: string;
  market: string;
  changeRate: number;
}

/**
 * 변동폭이 큰 순으로 정렬해 반환한다.
 */
export function todayMoves(limit = 5): TodayMove[] {
  const moves: TodayMove[] = [];

  for (const ticker of availableTickers()) {
    const meta = stockMeta(ticker);
    if (!meta) continue;

    moves.push({
      ticker,
      name: meta.name,
      market: meta.market,
      changeRate: changeAt(ticker, 0),
    });
  }

  return moves
    .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
    .slice(0, limit);
}
