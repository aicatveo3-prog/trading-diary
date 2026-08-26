// ============================================
// StockPulse Korea - TypeScript 타입 정의
// ============================================

// --- 종목 ---
export interface Stock {
  id: string;
  ticker: string;
  name: string;
  name_en?: string;
  market: 'KOSPI' | 'KOSDAQ';
  sector?: string;
  market_cap?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- 주가 ---
export interface StockPrice {
  id: string;
  stock_id: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change_amount: number;
  change_rate: number;
}

// 차트용 캔들 데이터
export interface CandleData {
  time: string; // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
}

// --- 뉴스 ---
export type SentimentLabel = 'positive' | 'negative' | 'neutral';

export interface NewsArticle {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source?: string;
  author?: string;
  thumbnail_url?: string;
  published_at: string;
  sentiment_score?: number;
  sentiment_label: SentimentLabel;
  is_major: boolean;
  created_at: string;
}

// 뉴스 + 종목 매핑 결합
export interface NewsWithMapping extends NewsArticle {
  relevance_score: number;
  impact_type: 'direct' | 'indirect' | 'sector' | 'market';
}

// --- 뉴스-종목 매핑 ---
export interface NewsStockMapping {
  id: string;
  news_id: string;
  stock_id: string;
  relevance_score: number;
  impact_type: 'direct' | 'indirect' | 'sector' | 'market';
  mapped_at: string;
}

// --- 시장 이벤트 ---
export interface MarketEvent {
  id: string;
  title: string;
  description?: string;
  event_type: 'monetary_policy' | 'earnings' | 'regulation' | 'geopolitics' | 'economic_data';
  event_date: string;
  impact_scope: 'market' | 'sector' | 'stock';
  impact_direction?: 'positive' | 'negative' | 'neutral';
  source_url?: string;
}

// --- 사용자 ---
export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  provider: 'google' | 'kakao';
  is_premium: boolean;
  settings: UserSettings;
  created_at: string;
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  default_market?: 'KOSPI' | 'KOSDAQ' | 'ALL';
  alert_enabled?: boolean;
}

// --- 워치리스트 ---
export interface WatchlistItem {
  id: string;
  user_id: string;
  stock_id: string;
  alert_threshold: number;
  memo?: string;
  added_at: string;
  // 조인 시
  stock?: Stock;
  latest_price?: StockPrice;
}

// --- 매매일지 ---
export interface TradeLog {
  id: string;
  user_id: string;
  stock_id: string;
  trade_type: 'buy' | 'sell';
  price: number;
  quantity: number;
  trade_date: string;
  trade_time?: string;
  memo?: string;
  emotion?: 'confident' | 'nervous' | 'fomo' | 'rational';
  linked_news_ids: string[];
  pnl?: number;
  created_at: string;
  // 조인 시
  stock?: Stock;
  linked_news?: NewsArticle[];
}

// --- AI 일일 요약 ---
export interface StockDailySummary {
  id: string;
  stock_id: string;
  date: string;
  summary: string;
  key_factors: string[];
  sentiment_trend: 'improving' | 'declining' | 'stable';
  generated_at: string;
}

// --- 대시보드용 집계 타입 ---
export interface MarketOverview {
  kospi: {
    value: number;
    change_rate: number;
  };
  kosdaq: {
    value: number;
    change_rate: number;
  };
}

export interface TopMover {
  stock: Stock;
  price: StockPrice;
  top_news?: NewsArticle;
}

// --- 차트 마커 (뉴스 오버레이) ---
export interface ChartMarker {
  time: string;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'circle' | 'arrowUp' | 'arrowDown';
  text: string;
  news_id: string;
}

// --- API 응답 타입 ---
export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// --- 네이버 뉴스 API 응답 ---
export interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

export interface NaverNewsResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}
