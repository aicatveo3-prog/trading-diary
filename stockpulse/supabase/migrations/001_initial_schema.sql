-- StockPulse Korea - 초기 DB 스키마
-- Supabase PostgreSQL

-- ============================================
-- 1. 종목 마스터
-- ============================================
CREATE TABLE stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL UNIQUE,        -- 005930
  name VARCHAR(100) NOT NULL,                -- 삼성전자
  name_en VARCHAR(100),                      -- Samsung Electronics
  market VARCHAR(10) NOT NULL DEFAULT 'KOSPI', -- KOSPI / KOSDAQ
  sector VARCHAR(50),                        -- 반도체
  market_cap BIGINT,                         -- 시가총액 (억원)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stocks_ticker ON stocks(ticker);
CREATE INDEX idx_stocks_market ON stocks(market);
CREATE INDEX idx_stocks_name ON stocks(name);

-- ============================================
-- 2. 일별 주가 (OHLCV)
-- ============================================
CREATE TABLE stock_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  open INTEGER NOT NULL,                     -- 시가
  high INTEGER NOT NULL,                     -- 고가
  low INTEGER NOT NULL,                      -- 저가
  close INTEGER NOT NULL,                    -- 종가
  volume BIGINT NOT NULL DEFAULT 0,          -- 거래량
  change_amount INTEGER DEFAULT 0,           -- 전일 대비 변동금액
  change_rate DECIMAL(8,4) DEFAULT 0,        -- 전일 대비 등락률 (%)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stock_id, date)
);

CREATE INDEX idx_stock_prices_stock_date ON stock_prices(stock_id, date DESC);
CREATE INDEX idx_stock_prices_change ON stock_prices(change_rate);

-- ============================================
-- 3. 뉴스 원본
-- ============================================
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  summary TEXT,                              -- 요약 (2~3문장)
  content TEXT,                              -- 본문 일부 (저작권 주의)
  url VARCHAR(1000) NOT NULL UNIQUE,         -- 원문 링크
  source VARCHAR(100),                       -- 한경, 연합뉴스 등
  author VARCHAR(100),
  thumbnail_url VARCHAR(1000),
  published_at TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  sentiment_score DECIMAL(4,3),              -- -1.000 ~ +1.000
  sentiment_label VARCHAR(20) DEFAULT 'neutral', -- positive/negative/neutral
  is_major BOOLEAN DEFAULT FALSE,            -- 주요 뉴스 여부
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_sentiment ON news_articles(sentiment_label);
CREATE INDEX idx_news_source ON news_articles(source);

-- ============================================
-- 4. 뉴스-종목 매핑 (핵심 테이블)
-- ============================================
CREATE TABLE news_stock_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  relevance_score DECIMAL(4,3) DEFAULT 0.5,  -- 연관도 0~1
  impact_type VARCHAR(20) DEFAULT 'direct',  -- direct/indirect/sector/market
  mapped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(news_id, stock_id)
);

CREATE INDEX idx_mapping_stock ON news_stock_mappings(stock_id);
CREATE INDEX idx_mapping_news ON news_stock_mappings(news_id);
CREATE INDEX idx_mapping_relevance ON news_stock_mappings(relevance_score DESC);

-- ============================================
-- 5. 시장 이벤트 (매크로/정책)
-- ============================================
CREATE TABLE market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,           -- monetary_policy, earnings, regulation, geopolitics
  event_date DATE NOT NULL,
  impact_scope VARCHAR(20) DEFAULT 'market', -- market/sector/stock
  impact_direction VARCHAR(20),              -- positive/negative/neutral
  source_url VARCHAR(1000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_date ON market_events(event_date DESC);
CREATE INDEX idx_events_type ON market_events(event_type);

-- ============================================
-- 6. 사용자 (공개 전환 대비)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(100),
  avatar_url VARCHAR(500),
  provider VARCHAR(50) DEFAULT 'google',     -- google/kakao
  is_premium BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',               -- 사용자 설정
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 워치리스트
-- ============================================
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  alert_threshold DECIMAL(5,2) DEFAULT 3.0,  -- 급변 알림 기준 (%)
  memo VARCHAR(500),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stock_id)
);

CREATE INDEX idx_watchlist_user ON watchlists(user_id);

-- ============================================
-- 8. 매매일지
-- ============================================
CREATE TABLE trade_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  trade_type VARCHAR(10) NOT NULL,           -- buy/sell
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  trade_date DATE NOT NULL,
  trade_time TIME,
  memo TEXT,
  emotion VARCHAR(20),                       -- confident/nervous/fomo/rational
  linked_news_ids UUID[] DEFAULT '{}',       -- 관련 뉴스 ID 배열
  pnl INTEGER,                               -- 손익 (매도 시)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_user ON trade_logs(user_id);
CREATE INDEX idx_trades_stock ON trade_logs(stock_id);
CREATE INDEX idx_trades_date ON trade_logs(trade_date DESC);

-- ============================================
-- 9. AI 일일 요약
-- ============================================
CREATE TABLE stock_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT NOT NULL,                     -- AI 생성 한줄 요약
  key_factors JSONB DEFAULT '[]',            -- ["외국인 매도", "실적 우려"]
  sentiment_trend VARCHAR(20),               -- improving/declining/stable
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stock_id, date)
);

CREATE INDEX idx_summaries_stock_date ON stock_daily_summaries(stock_id, date DESC);

-- ============================================
-- 10. 초기 시드 데이터: 주요 종목
-- ============================================
INSERT INTO stocks (ticker, name, name_en, market, sector) VALUES
  ('005930', '삼성전자', 'Samsung Electronics', 'KOSPI', '반도체'),
  ('000660', 'SK하이닉스', 'SK Hynix', 'KOSPI', '반도체'),
  ('035720', '카카오', 'Kakao', 'KOSPI', '인터넷'),
  ('035420', 'NAVER', 'NAVER', 'KOSPI', '인터넷'),
  ('005380', '현대차', 'Hyundai Motor', 'KOSPI', '자동차'),
  ('006400', '삼성SDI', 'Samsung SDI', 'KOSPI', '배터리'),
  ('373220', 'LG에너지솔루션', 'LG Energy Solution', 'KOSPI', '배터리'),
  ('051910', 'LG화학', 'LG Chem', 'KOSPI', '화학'),
  ('003670', '포스코퓨처엠', 'POSCO Future M', 'KOSPI', '소재'),
  ('247540', '에코프로비엠', 'EcoPro BM', 'KOSDAQ', '배터리'),
  ('086520', '에코프로', 'EcoPro', 'KOSDAQ', '배터리'),
  ('028260', '삼성물산', 'Samsung C&T', 'KOSPI', '건설'),
  ('105560', 'KB금융', 'KB Financial', 'KOSPI', '금융'),
  ('055550', '신한지주', 'Shinhan Financial', 'KOSPI', '금융'),
  ('012330', '현대모비스', 'Hyundai Mobis', 'KOSPI', '자동차'),
  ('066570', 'LG전자', 'LG Electronics', 'KOSPI', '전자'),
  ('003550', 'LG', 'LG Corp', 'KOSPI', '지주'),
  ('034730', 'SK', 'SK Inc', 'KOSPI', '지주'),
  ('015760', '한국전력', 'KEPCO', 'KOSPI', '전력'),
  ('032830', '삼성생명', 'Samsung Life', 'KOSPI', '보험');

-- ============================================
-- Row Level Security (공개 전환 대비)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_logs ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터만 접근
CREATE POLICY "Users can view own data" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage own watchlist" ON watchlists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own trades" ON trade_logs
  FOR ALL USING (auth.uid() = user_id);

-- 공개 데이터는 누구나 읽기 가능
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stocks are public" ON stocks FOR SELECT USING (TRUE);

ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prices are public" ON stock_prices FOR SELECT USING (TRUE);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News are public" ON news_articles FOR SELECT USING (TRUE);

ALTER TABLE news_stock_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mappings are public" ON news_stock_mappings FOR SELECT USING (TRUE);

ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are public" ON market_events FOR SELECT USING (TRUE);

ALTER TABLE stock_daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Summaries are public" ON stock_daily_summaries FOR SELECT USING (TRUE);
