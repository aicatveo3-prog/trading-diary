/**
 * 뉴스 → 주가 차트 핀 매핑
 *
 * 이 파일이 "겹쳐"의 핵심이다. 뉴스가 보도된 날짜를 주가 거래일 축에 올려서,
 * 차트 위에 핀으로 꽂을 수 있게 만든다.
 *
 * 두 가지 시간 축 불일치를 처리한다:
 *
 * 1. 비거래일 뉴스 (주말·공휴일)
 *    토요일에 난 뉴스는 토요일 주가가 없다. 하지만 그 뉴스는 월요일 개장에
 *    영향을 준다. 그래서 "다음 거래일"로 이월한다.
 *
 * 2. 주가보다 최신인 뉴스
 *    주가는 장마감 후에 확정되므로, 오늘 장중/장후 뉴스는 반영할 주가가 없다.
 *    이건 핀으로 꽂지 않고 "아직 주가에 반영되지 않음"으로 구분한다.
 *    없는 인과를 만들지 않기 위한 처리다.
 */

import { NewsItem, newsFor } from './news-data';
import { tradingDates, changeAt, closeSeries } from './price-data';

export interface NewsPin {
  /** 최신 거래일로부터 며칠 전 (0 = 최신) */
  daysAgo: number;
  /** 매핑된 거래일 (YYYY-MM-DD) */
  tradingDate: string;
  /** 그 날 묶인 기사들 */
  articles: NewsItem[];
  /** 그 거래일의 전일 대비 등락률 (%) */
  changeRate: number;
  /** 최신순 번호 (1부터) */
  number: number;
}

export interface NewsPinResult {
  /** 차트에 꽂을 핀 (중요도 상위) */
  pins: NewsPin[];
  /** 기간 내 전체 날짜 그룹 (핀이 안 된 것도 포함, 최신순) */
  allGroups: NewsPin[];
  /** 아직 주가에 반영되지 않은 기사 (주가 축보다 최신) */
  pending: NewsItem[];
}

/**
 * 주어진 날짜 이후(포함)의 첫 거래일 인덱스를 찾는다.
 * 없으면 null — 주가 축을 벗어난 미래 뉴스다.
 */
function nextTradingIndex(dateStr: string, dates: string[]): number | null {
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= dateStr) return i;
  }
  return null;
}

/**
 * 중요도 = 기사 건수 × (|등락률| + 1)
 *
 * 기사가 많이 났고 주가도 크게 움직인 날이 가장 중요하다.
 *
 * 등락률에 1을 더하는 이유: 단순히 곱하면 등락률이 0%인 날의 중요도가
 * 0이 되어, 기사가 아무리 많이 나도 핀에서 탈락한다. 그런데 "뉴스가
 * 쏟아졌는데도 주가가 움직이지 않은 날"은 그 자체로 읽을 만한 정보다.
 * 보정값을 두면 기사 건수가 최소한의 발언권을 갖는다.
 */
function importance(pin: NewsPin): number {
  return pin.articles.length * (Math.abs(pin.changeRate) + 1);
}

/**
 * 종목의 뉴스를 거래일에 매핑하고 핀을 선정한다.
 *
 * @param ticker 종목 코드
 * @param periodDays 차트 기간 (거래일 수)
 * @param maxPins 핀 개수 상한 — 너무 많으면 차트가 읽히지 않는다
 */
export function buildNewsPins(
  ticker: string,
  periodDays: number,
  maxPins: number
): NewsPinResult {
  const dates = tradingDates(ticker);
  const articles = newsFor(ticker);

  // 거래일 인덱스 → 기사 목록
  const byTradingIndex = new Map<number, NewsItem[]>();
  const pending: NewsItem[] = [];

  for (const article of articles) {
    const publishedDate = article.publishedAt.slice(0, 10);
    const idx = nextTradingIndex(publishedDate, dates);

    if (idx === null) {
      // 주가 축을 벗어난 최신 뉴스 — 반영할 주가가 아직 없다
      pending.push(article);
      continue;
    }

    const existing = byTradingIndex.get(idx);
    if (existing) {
      existing.push(article);
    } else {
      byTradingIndex.set(idx, [article]);
    }
  }

  // 거래일 그룹 → NewsPin 변환
  const total = dates.length;
  const groups: NewsPin[] = [];

  for (const [idx, group] of byTradingIndex) {
    const daysAgo = total - 1 - idx;

    // 차트 기간을 벗어난 그룹은 제외
    if (daysAgo >= periodDays) continue;

    groups.push({
      daysAgo,
      tradingDate: dates[idx],
      articles: group.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      ),
      changeRate: changeAt(ticker, daysAgo),
      number: 0, // 아래에서 부여
    });
  }

  // 최신순 정렬 후 번호 부여 — 번호는 필터·정렬과 무관하게 고정된다
  groups.sort((a, b) => a.daysAgo - b.daysAgo);
  groups.forEach((g, i) => {
    g.number = i + 1;
  });

  // 중요도 상위만 핀으로
  const pins = [...groups].sort((a, b) => importance(b) - importance(a)).slice(0, maxPins);

  return {
    pins,
    allGroups: groups,
    pending: pending.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    ),
  };
}

/**
 * 핀 지름 — 기사 건수가 많을수록 크게, 상한을 둔다.
 *
 * 등락률이 아니라 기사 건수를 쓰는 이유: 핀의 크기가 "얼마나 화제였는지"를
 * 나타내야 자연스럽다. 등락 방향은 색으로 이미 표현된다.
 */
export function newsPinDiameter(articleCount: number): number {
  return Math.min(32, 18 + articleCount * 1.4);
}
