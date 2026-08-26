/**
 * 목업 데이터 - API 키 없이도 UI 개발/프리뷰 가능
 * 실제 운영 시에는 Supabase 데이터로 교체
 */

import { Stock, StockPrice, NewsArticle, CandleData, MarketOverview, TopMover } from '@/types';

// ============================================
// 종목 데이터
// ============================================
export const mockStocks: Stock[] = [
  { id: '1', ticker: '005930', name: '삼성전자', name_en: 'Samsung Electronics', market: 'KOSPI', sector: '반도체', market_cap: 4320000, is_active: true, created_at: '', updated_at: '' },
  { id: '2', ticker: '000660', name: 'SK하이닉스', name_en: 'SK Hynix', market: 'KOSPI', sector: '반도체', market_cap: 1340000, is_active: true, created_at: '', updated_at: '' },
  { id: '3', ticker: '035720', name: '카카오', name_en: 'Kakao', market: 'KOSPI', sector: '인터넷', market_cap: 245000, is_active: true, created_at: '', updated_at: '' },
  { id: '4', ticker: '035420', name: 'NAVER', name_en: 'NAVER', market: 'KOSPI', sector: '인터넷', market_cap: 380000, is_active: true, created_at: '', updated_at: '' },
  { id: '5', ticker: '005380', name: '현대차', name_en: 'Hyundai Motor', market: 'KOSPI', sector: '자동차', market_cap: 520000, is_active: true, created_at: '', updated_at: '' },
  { id: '6', ticker: '373220', name: 'LG에너지솔루션', name_en: 'LG Energy Solution', market: 'KOSPI', sector: '배터리', market_cap: 890000, is_active: true, created_at: '', updated_at: '' },
];

// ============================================
// 주가 데이터 (삼성전자 30일)
// ============================================
export const mockPrices: StockPrice[] = [
  { id: '1', stock_id: '1', date: '2026-08-26', open: 73200, high: 73800, low: 71900, close: 72400, volume: 12345000, change_amount: -900, change_rate: -1.23 },
  { id: '2', stock_id: '1', date: '2026-08-25', open: 73000, high: 74100, low: 72800, close: 73300, volume: 10234000, change_amount: 300, change_rate: 0.41 },
  { id: '3', stock_id: '1', date: '2026-08-22', open: 72500, high: 73500, low: 72200, close: 73000, volume: 9876000, change_amount: -500, change_rate: -0.68 },
  { id: '4', stock_id: '1', date: '2026-08-21', open: 73800, high: 74200, low: 73000, close: 73500, volume: 11234000, change_amount: 800, change_rate: 1.10 },
  { id: '5', stock_id: '1', date: '2026-08-20', open: 72000, high: 73100, low: 71800, close: 72700, volume: 13456000, change_amount: -200, change_rate: -0.27 },
];

export function generateMockCandles(days: number = 90): CandleData[] {
  const candles: CandleData[] = [];
  let price = 72000;
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    // 주말 건너뛰기
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * 2000;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 1000;
    const low = Math.min(open, close) - Math.random() * 1000;
    price = close;

    candles.push({
      time: date.toISOString().split('T')[0],
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
    });
  }

  return candles;
}

// ============================================
// 뉴스 데이터
// ============================================
export const mockNews: NewsArticle[] = [
  {
    id: 'n1',
    title: '삼성전자, HBM3E 엔비디아 품질 테스트 통과…양산 본격화',
    summary: '삼성전자가 엔비디아의 HBM3E 품질 테스트를 최종 통과해 양산 납품을 본격화한다.',
    url: 'https://example.com/news/1',
    source: '한국경제',
    published_at: '2026-08-26T09:30:00Z',
    sentiment_score: 0.8,
    sentiment_label: 'positive',
    is_major: true,
    created_at: '2026-08-26T09:30:00Z',
  },
  {
    id: 'n2',
    title: '외국인, 삼성전자 3거래일 연속 순매도…"단기 차익 실현"',
    summary: '외국인 투자자들이 삼성전자를 3거래일 연속 순매도하고 있다.',
    url: 'https://example.com/news/2',
    source: '매일경제',
    published_at: '2026-08-26T08:15:00Z',
    sentiment_score: -0.4,
    sentiment_label: 'negative',
    is_major: false,
    created_at: '2026-08-26T08:15:00Z',
  },
  {
    id: 'n3',
    title: '반도체 업황 전망 엇갈려…"하반기 수요 회복 vs DRAM 가격 하락 우려"',
    summary: '하반기 반도체 업황에 대한 전문가 전망이 엇갈리고 있다.',
    url: 'https://example.com/news/3',
    source: '서울경제',
    published_at: '2026-08-26T07:00:00Z',
    sentiment_score: -0.1,
    sentiment_label: 'neutral',
    is_major: false,
    created_at: '2026-08-26T07:00:00Z',
  },
  {
    id: 'n4',
    title: 'SK하이닉스, AI 메모리 매출 비중 50% 돌파…"구조적 성장"',
    summary: 'SK하이닉스의 AI용 메모리 반도체 매출 비중이 처음으로 50%를 넘었다.',
    url: 'https://example.com/news/4',
    source: '디일렉',
    published_at: '2026-08-26T10:20:00Z',
    sentiment_score: 0.7,
    sentiment_label: 'positive',
    is_major: true,
    created_at: '2026-08-26T10:20:00Z',
  },
  {
    id: 'n5',
    title: '카카오, 카카오톡 AI 비서 기능 출시 예고…"내달 정식 오픈"',
    summary: '카카오가 카카오톡에 AI 비서 기능을 탑재하는 방안을 공식화했다.',
    url: 'https://example.com/news/5',
    source: '블로터',
    published_at: '2026-08-25T14:30:00Z',
    sentiment_score: 0.5,
    sentiment_label: 'positive',
    is_major: true,
    created_at: '2026-08-25T14:30:00Z',
  },
  {
    id: 'n6',
    title: '한국은행, 기준금리 동결…"경기 하방 리스크 지속 모니터링"',
    summary: '한국은행 금융통화위원회가 기준금리를 2.75%로 동결했다.',
    url: 'https://example.com/news/6',
    source: '연합뉴스',
    published_at: '2026-08-26T11:00:00Z',
    sentiment_score: 0,
    sentiment_label: 'neutral',
    is_major: true,
    created_at: '2026-08-26T11:00:00Z',
  },
  {
    id: 'n7',
    title: 'LG에너지솔루션, 미국 공장 가동률 하락…전기차 수요 둔화 영향',
    summary: '미국 내 전기차 수요 둔화로 LG에너지솔루션 미국 공장 가동률이 하락하고 있다.',
    url: 'https://example.com/news/7',
    source: '이데일리',
    published_at: '2026-08-25T16:00:00Z',
    sentiment_score: -0.6,
    sentiment_label: 'negative',
    is_major: false,
    created_at: '2026-08-25T16:00:00Z',
  },
  {
    id: 'n8',
    title: '현대차, 인도 법인 IPO 흥행 성공…"해외 시장 가치 재평가"',
    summary: '현대차 인도 법인 상장이 예상보다 높은 청약경쟁률을 기록했다.',
    url: 'https://example.com/news/8',
    source: '조선비즈',
    published_at: '2026-08-26T09:00:00Z',
    sentiment_score: 0.6,
    sentiment_label: 'positive',
    is_major: true,
    created_at: '2026-08-26T09:00:00Z',
  },
];

// ============================================
// 시장 개요
// ============================================
export const mockMarketOverview: MarketOverview = {
  kospi: { value: 2641.23, change_rate: 0.82 },
  kosdaq: { value: 842.56, change_rate: -0.34 },
};

// ============================================
// 급변 종목
// ============================================
export const mockTopMovers: TopMover[] = [
  {
    stock: { id: '10', ticker: '028300', name: 'HLB', market: 'KOSDAQ', sector: '바이오', is_active: true, created_at: '', updated_at: '' },
    price: { id: '', stock_id: '10', date: '2026-08-26', open: 52000, high: 68000, low: 51500, close: 67500, volume: 45000000, change_amount: 15500, change_rate: 29.8 },
    top_news: { id: 'tm1', title: 'HLB, 간암 신약 FDA 우선심사 지정…허가 임박', url: '', source: '한경', published_at: '2026-08-26T08:00:00Z', sentiment_score: 0.9, sentiment_label: 'positive', is_major: true, created_at: '' },
  },
  {
    stock: { id: '11', ticker: '086520', name: '에코프로', market: 'KOSDAQ', sector: '배터리', is_active: true, created_at: '', updated_at: '' },
    price: { id: '', stock_id: '11', date: '2026-08-26', open: 98000, high: 99200, low: 88000, close: 89000, volume: 32000000, change_amount: -8200, change_rate: -8.4 },
    top_news: { id: 'tm2', title: '에코프로, 5000억 규모 유상증자 결정…"시설투자 재원 확보"', url: '', source: '연합뉴스', published_at: '2026-08-26T07:30:00Z', sentiment_score: -0.7, sentiment_label: 'negative', is_major: true, created_at: '' },
  },
  {
    stock: { id: '4', ticker: '035420', name: 'NAVER', market: 'KOSPI', sector: '인터넷', is_active: true, created_at: '', updated_at: '' },
    price: { id: '', stock_id: '4', date: '2026-08-26', open: 195000, high: 208000, low: 194000, close: 206000, volume: 8900000, change_amount: 12000, change_rate: 6.2 },
    top_news: { id: 'tm3', title: 'NAVER, 일본 라인야후 지분 매각 확정…2조원 유입 예정', url: '', source: '매일경제', published_at: '2026-08-26T06:00:00Z', sentiment_score: 0.6, sentiment_label: 'positive', is_major: true, created_at: '' },
  },
  {
    stock: { id: '5', ticker: '005380', name: '현대차', market: 'KOSPI', sector: '자동차', is_active: true, created_at: '', updated_at: '' },
    price: { id: '', stock_id: '5', date: '2026-08-26', open: 242000, high: 255000, low: 241000, close: 253000, volume: 5600000, change_amount: 11000, change_rate: 4.5 },
    top_news: { id: 'tm4', title: '현대차, 인도 법인 IPO 흥행에 그룹 가치 재평가 기대', url: '', source: '조선비즈', published_at: '2026-08-26T09:00:00Z', sentiment_score: 0.6, sentiment_label: 'positive', is_major: true, created_at: '' },
  },
  {
    stock: { id: '6', ticker: '373220', name: 'LG에너지솔루션', market: 'KOSPI', sector: '배터리', is_active: true, created_at: '', updated_at: '' },
    price: { id: '', stock_id: '6', date: '2026-08-26', open: 385000, high: 387000, low: 368000, close: 370000, volume: 2100000, change_amount: -15000, change_rate: -3.9 },
    top_news: { id: 'tm5', title: '전기차 보조금 축소 우려에 배터리주 일제히 하락', url: '', source: '서울경제', published_at: '2026-08-26T10:30:00Z', sentiment_score: -0.5, sentiment_label: 'negative', is_major: true, created_at: '' },
  },
];
