# 📈 StockPulse Korea

> 한국 주식 뉴스와 주가 변동을 시간축 위에서 연결해 보여주는 투자 인사이트 도구

"오늘 왜 빠졌지?" — 이 질문에 대한 답을 한 화면에서 바로 볼 수 있습니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| **📊 주가 차트 + 뉴스 오버레이** | 캔들차트 위에 뉴스 이벤트를 감성별(긍정🟢/부정🔴/중립⚪) 마커로 표시 |
| **🤖 AI 일일 요약** | "이 종목이 오늘 왜 움직였나" 2~3문장 자동 생성 (OpenAI) |
| **📰 뉴스 감성 분석** | 뉴스 제목/본문의 주가 영향도를 -1.0~+1.0 스코어로 분석 |
| **🔥 급변 종목 감지** | ±3% 이상 움직인 종목 + 관련 뉴스 자동 매핑 |
| **⭐ 워치리스트** | 관심 종목 등록 및 뉴스 피드 자동 구성 |
| **🗓️ 타임라인 뷰** | 시간순으로 뉴스와 주가 변동을 한눈에 조망 |

---

## 🛠️ 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| 차트 | TradingView Lightweight Charts |
| 스타일 | Tailwind CSS (다크모드) |
| Backend | Next.js API Routes |
| DB | Supabase (PostgreSQL + RLS) |
| AI/NLP | OpenAI GPT-4o-mini (감성분석 + 요약) |
| 뉴스 수집 | 네이버 뉴스 검색 API |
| 주가 수집 | 한국투자증권 Open API |
| 배포 | Vercel |
| 스케줄링 | Vercel Cron |

---

## 🚀 시작하기

### 1. 클론 & 의존성 설치

```bash
cd stockpulse
pnpm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열고 각 API 키를 입력합니다:

| 환경변수 | 발급처 | 필수 |
|----------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com) 프로젝트 생성 | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 대시보드 → Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 동일 | ✅ |
| `NAVER_CLIENT_ID` | [네이버 개발자센터](https://developers.naver.com) | ✅ |
| `NAVER_CLIENT_SECRET` | 동일 | ✅ |
| `KIS_APP_KEY` | [한국투자증권 API](https://apiportal.koreainvestment.com) | ✅ |
| `KIS_APP_SECRET` | 동일 | ✅ |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys) | 선택* |

> *OpenAI API 키가 없어도 키워드 기반 간이 감성분석으로 동작합니다.

### 3. Supabase DB 설정

Supabase 대시보드 → SQL Editor에서 마이그레이션 파일 실행:

```sql
-- supabase/migrations/001_initial_schema.sql 내용 복사하여 실행
```

또는 Supabase CLI 사용:

```bash
npx supabase db push
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

http://localhost:3000 에서 확인

---

## 📁 프로젝트 구조

```
stockpulse/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # 대시보드 (메인)
│   │   ├── layout.tsx            # 루트 레이아웃 + 네비게이션
│   │   ├── globals.css           # 글로벌 스타일
│   │   ├── stocks/[ticker]/      # 종목 상세 페이지
│   │   └── api/                  # API 라우트
│   │       ├── stocks/           # 종목 조회 API
│   │       ├── news/             # 뉴스 조회 API
│   │       ├── watchlist/        # 워치리스트 CRUD
│   │       ├── summary/          # AI 요약 조회/생성
│   │       └── collect/          # 데이터 수집 트리거
│   ├── components/               # React 컴포넌트
│   │   ├── charts/               # 차트 관련 (StockChart, TimeRange)
│   │   ├── dashboard/            # 대시보드 카드들
│   │   ├── news/                 # 뉴스 관련 (Timeline, Sentiment)
│   │   ├── stock/                # 종목 상세 (Header, AI Summary)
│   │   └── ui/                   # 기본 UI (Card, Badge, PriceChange)
│   ├── lib/                      # 유틸리티 & 비즈니스 로직
│   │   ├── collectors/           # 데이터 수집 모듈
│   │   │   ├── naver-news.ts     # 네이버 뉴스 API
│   │   │   ├── stock-price.ts    # 한국투자증권 API
│   │   │   ├── sentiment.ts      # AI 감성분석
│   │   │   └── pipeline.ts       # 수집 파이프라인 오케스트레이션
│   │   ├── supabase.ts           # Supabase 클라이언트
│   │   ├── utils.ts              # 공용 유틸리티
│   │   └── mock-data.ts          # 목업 데이터 (개발용)
│   └── types/                    # TypeScript 타입 정의
│       └── index.ts
├── supabase/
│   └── migrations/               # DB 스키마 마이그레이션
│       └── 001_initial_schema.sql
├── .env.example                  # 환경변수 템플릿
├── vercel.json                   # Vercel 배포 설정 (Cron)
└── package.json
```

---

## 📡 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/stocks` | 종목 목록 (?market=KOSPI&search=삼성) |
| `GET` | `/api/stocks/[ticker]` | 종목 상세 + 주가 + 뉴스 |
| `GET` | `/api/news` | 뉴스 목록 (?stock_id=&sentiment=&date_from=) |
| `GET` | `/api/watchlist` | 워치리스트 조회 |
| `POST` | `/api/watchlist` | 워치리스트 추가 |
| `DELETE` | `/api/watchlist` | 워치리스트 삭제 (?stock_id=) |
| `GET` | `/api/summary` | AI 요약 조회 (?stock_id=&date=) |
| `POST` | `/api/summary` | AI 요약 생성 |
| `POST` | `/api/collect` | 데이터 수집 실행 (Cron) |

---

## ⏰ 데이터 수집 스케줄

| 시간 | 주기 | 동작 |
|------|------|------|
| 09:00~15:30 | 30분마다 | 뉴스 수집 + 감성분석 + 주가 업데이트 + 급변 감지 |
| 16:00 | 1일 1회 | AI 일일 요약 생성 |

Vercel Cron으로 자동 실행됩니다 (`vercel.json` 참조).

---

## 🗺️ 로드맵

### Phase 1 (현재) — MVP
- [x] 대시보드 (시장 요약 + 급변 종목)
- [x] 종목 상세 (차트 + 뉴스 오버레이)
- [x] 뉴스 감성 분석
- [x] AI 일일 요약
- [x] 워치리스트

### Phase 2 — 공개 서비스
- [ ] Google/Kakao 로그인 (Supabase Auth)
- [ ] 실시간 알림 (급변 시 푸시)
- [ ] 캘린더 뷰 (날짜별 시장 조망)
- [ ] 매매일지 연동 (trading-diary)
- [ ] 패턴 아카이브 (유사 뉴스 → 유사 반응)

### Phase 3 — 프리미엄
- [ ] 실시간 주가 (WebSocket)
- [ ] 커뮤니티 주석 기능
- [ ] 섹터별 뉴스 대시보드
- [ ] 미국 주식 확장

---

## ⚠️ 주의사항

- 이 도구는 **투자 판단의 참고 자료**일 뿐, 투자 권유가 아닙니다.
- 뉴스와 주가의 연관은 **인과관계가 아닌 상관관계**일 수 있습니다.
- AI 감성분석 결과는 완벽하지 않으며, 참고용으로만 활용하세요.

---

## 📄 라이선스

MIT License
