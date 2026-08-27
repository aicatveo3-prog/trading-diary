/**
 * 뉴스 데이터 접근 레이어
 *
 * scripts/collect_news.py 가 생성한 JSON을 읽는다.
 * 실제 Google News RSS에서 수집한 기사이며, 제목·언론사·링크·감성이 포함된다.
 */

import newsJson from '@/data/news.json';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
}

interface NewsFile {
  collectedAt: string;
  stocks: Record<string, NewsItem[]>;
}

const news = newsJson as NewsFile;

/** 뉴스 수집 시각 */
export function newsCollectedAt(): string {
  return news.collectedAt;
}

/** 특정 종목의 뉴스 목록 (최신순) */
export function newsFor(ticker: string): NewsItem[] {
  return (news.stocks[ticker] ?? []).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/** 전 종목 뉴스를 합쳐 최신순으로 반환 */
export function allNews(limit = 20): (NewsItem & { ticker: string })[] {
  const merged: (NewsItem & { ticker: string })[] = [];
  for (const [ticker, items] of Object.entries(news.stocks)) {
    for (const item of items) {
      merged.push({ ...item, ticker });
    }
  }
  return merged
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

/** 종목별 감성 요약 */
export function sentimentSummary(ticker: string): { positive: number; negative: number; neutral: number } {
  const items = news.stocks[ticker] ?? [];
  return {
    positive: items.filter(n => n.sentiment === 'positive').length,
    negative: items.filter(n => n.sentiment === 'negative').length,
    neutral: items.filter(n => n.sentiment === 'neutral').length,
  };
}

/** 뉴스가 수집된 종목인지 */
export function hasNews(ticker: string): boolean {
  return (news.stocks[ticker]?.length ?? 0) > 0;
}

/**
 * 특정 날짜에 보도된 뉴스 수 (핀 선정에 사용)
 * dateStr: 'YYYY-MM-DD'
 */
export function newsCountOnDate(ticker: string, dateStr: string): number {
  return (news.stocks[ticker] ?? []).filter(n => n.publishedAt.startsWith(dateStr)).length;
}
