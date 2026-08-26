/**
 * 네이버 뉴스 검색 API 수집기
 * 
 * 사용법:
 *   1. 네이버 개발자센터에서 애플리케이션 등록
 *   2. NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수 설정
 *   3. fetchNewsForStock('삼성전자') 호출
 * 
 * API 제한: 일 25,000건
 * 문서: https://developers.naver.com/docs/serviceapi/search/news/news.md
 */

import { NaverNewsResponse, NaverNewsItem } from '@/types';
import { stripHtml } from '@/lib/utils';

const NAVER_API_URL = 'https://openapi.naver.com/v1/search/news.json';

interface FetchNewsOptions {
  query: string;
  display?: number;  // 결과 수 (1~100, 기본 10)
  start?: number;    // 시작 위치 (1~1000)
  sort?: 'sim' | 'date';  // 정렬 (sim: 유사도, date: 날짜순)
}

/**
 * 네이버 뉴스 검색 API 호출
 */
export async function searchNaverNews(options: FetchNewsOptions): Promise<NaverNewsResponse> {
  const { query, display = 20, start = 1, sort = 'date' } = options;

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET 환경변수가 필요합니다.');
  }

  const params = new URLSearchParams({
    query,
    display: String(display),
    start: String(start),
    sort,
  });

  const response = await fetch(`${NAVER_API_URL}?${params}`, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`네이버 뉴스 API 에러: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * 종목명으로 뉴스 검색 후 정제된 형태로 반환
 */
export async function fetchNewsForStock(stockName: string, options?: Partial<FetchNewsOptions>) {
  const response = await searchNaverNews({
    query: `${stockName} 주가`,
    display: 20,
    sort: 'date',
    ...options,
  });

  return response.items.map(item => cleanNewsItem(item));
}

/**
 * 여러 종목의 뉴스를 한 번에 수집
 */
export async function fetchNewsForMultipleStocks(
  stockNames: string[],
  options?: Partial<FetchNewsOptions>
) {
  const results: Map<string, ReturnType<typeof cleanNewsItem>[]> = new Map();

  // Rate limiting: 순차 실행 (네이버 API 제한 대응)
  for (const name of stockNames) {
    try {
      const news = await fetchNewsForStock(name, options);
      results.set(name, news);
      // 100ms 딜레이로 Rate Limit 방지
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[뉴스 수집 실패] ${name}:`, error);
      results.set(name, []);
    }
  }

  return results;
}

/**
 * 뉴스 아이템 정제
 */
function cleanNewsItem(item: NaverNewsItem) {
  return {
    title: stripHtml(item.title),
    summary: stripHtml(item.description),
    url: item.originallink || item.link,
    source: extractSource(item.originallink),
    published_at: new Date(item.pubDate).toISOString(),
  };
}

/**
 * URL에서 언론사명 추출
 */
function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const sourceMap: Record<string, string> = {
      'www.hankyung.com': '한국경제',
      'news.hankyung.com': '한국경제',
      'www.mk.co.kr': '매일경제',
      'www.sedaily.com': '서울경제',
      'www.edaily.co.kr': '이데일리',
      'www.etnews.com': '전자신문',
      'www.mt.co.kr': '머니투데이',
      'www.fnnews.com': '파이낸셜뉴스',
      'www.yna.co.kr': '연합뉴스',
      'www.yonhapnewstv.co.kr': '연합뉴스TV',
      'biz.chosun.com': '조선비즈',
      'www.chosun.com': '조선일보',
      'www.donga.com': '동아일보',
      'www.joongang.co.kr': '중앙일보',
      'www.hani.co.kr': '한겨레',
      'www.khan.co.kr': '경향신문',
      'www.newsis.com': '뉴시스',
      'www.news1.kr': '뉴스1',
      'www.thelec.kr': '디일렉',
      'www.bloter.net': '블로터',
    };
    return sourceMap[hostname] || hostname.replace('www.', '').split('.')[0];
  } catch {
    return '기타';
  }
}

/**
 * 시장 전체 뉴스 수집 (매크로 뉴스)
 */
export async function fetchMarketNews() {
  const queries = [
    '코스피 증시',
    '한국은행 금리',
    '외국인 순매수',
  ];

  const allNews: ReturnType<typeof cleanNewsItem>[] = [];

  for (const query of queries) {
    try {
      const response = await searchNaverNews({ query, display: 10, sort: 'date' });
      allNews.push(...response.items.map(item => cleanNewsItem(item)));
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[시장 뉴스 수집 실패] ${query}:`, error);
    }
  }

  // URL 기준 중복 제거
  const uniqueNews = Array.from(
    new Map(allNews.map(n => [n.url, n])).values()
  );

  return uniqueNews;
}
