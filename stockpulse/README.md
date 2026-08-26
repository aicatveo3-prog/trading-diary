# 겹쳐 — NEWS × PRICE

> 주가가 움직인 날에 무슨 일이 있었는지를 시간 순서대로 보여줍니다.
> **예측하지 않고, 추천하지 않습니다.** 판단은 사용자가 합니다.

"오늘 왜 빠졌지?" — 이 질문에 답하기 위해 차트와 뉴스를 따로 뒤질 필요가 없게 만드는 것이 목표입니다.

---

## 화면 구성

### 종목 상세 (`/stocks/[ticker]`)

주가 라인 위에 뉴스가 **번호 핀**으로 꽂힙니다.

| 핀의 표현 | 의미 |
|---|---|
| 색 | 그날의 방향 (상승/하락) |
| 크기 | 변동폭 (17px~30px, 상한 있음) |
| 번호 | 최신순 타임라인 순서 |

핀을 클릭하면 아래 타임라인의 해당 항목으로 스크롤되고, **"이게 왜 주가에 영향을 주나요"** 해설이 펼쳐집니다. 이 해설은 금융 용어를 모르는 사람도 읽을 수 있게 쓰여 있습니다.

```
관세는 제품을 미국에 팔 때 붙는 세금입니다. 세금이 늘면 같은 물건을
팔아도 회사에 남는 돈이 줄어들 수 있어, 시장은 미래 이익을 미리 깎아서
계산합니다. 아직 "검토" 단계라는 점이 중요합니다 — 확정 발표 때 한 번
더 크게 움직이는 경우가 많습니다.
```

각 항목은 **당일**과 **1주 후** 수익률을 나란히 보여줍니다. 하루 만에 소화된 뉴스와 며칠에 걸쳐 이어진 뉴스가 구분되기 때문입니다.

### 대시보드 (`/`)

- KOSPI / KOSDAQ 지수
- **뉴스로 설명되는 움직임** — 중요도(변동폭 × 보도 매체 수) 상위 종목과 그 원인 뉴스
- 오늘 들어온 소식
- 워치리스트

---

## 설계 원칙

이 프로젝트가 **하지 않는** 것들이 디자인의 핵심입니다.

| 하지 않는 것 | 이유 |
|---|---|
| 인과관계 단정 | 차트 하단에 "같은 날에 일어난 일이라는 뜻이며, 원인을 단정하지 않습니다"를 항상 표시 |
| 평균 수익률 제시 | 평균은 예측처럼 읽힘. 유사 사례는 "상승 n번 / 하락 n번" 분포만 보여줌 |
| 매수·매도 신호 | 사이드바 "이 화면의 약속"에 명시 |
| 핀 무제한 표시 | 5개 상한. 그 이상은 차트가 읽히지 않음 |

### 색 관설 토글 (KR / US)

한국은 상승이 빨강, 미국·유럽은 상승이 초록입니다. 헤더에서 전환할 수 있고, 차트·타임라인·사이드바의 모든 색이 함께 바뀝니다.

| | 상승 | 하락 |
|---|---|---|
| KR (기본) | 빨강 `#c0392b` | 파랑 `#1f5fbf` |
| US | 초록 `#17805a` | 빨강 `#c0392b` |

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|---|---|---|
| Framework | Next.js 16 (App Router) | Route Handler의 `params`는 `Promise` |
| 언어 | TypeScript | |
| 차트 | 순수 SVG (`polyline` + `polygon`) | 차트 라이브러리 없음 — 디자인이 요구하는 형태가 단순하고, 핀 오버레이를 DOM으로 직접 제어하는 편이 정확함 |
| 스타일 | 인라인 스타일 + 최소 CSS | 특정 hex/px 값 의존 + 색 관설이 런타임에 바뀌므로. `:hover`·미디어쿼리·폰트만 `globals.css`에 둠 |
| 폰트 | Noto Serif KR (제목·숫자) / Noto Sans KR (본문) | `next/font` |
| DB | Supabase (PostgreSQL + RLS) | |
| 뉴스 수집 | 네이버 뉴스 검색 API | 일 25,000건 |
| 주가 수집 | 한국투자증권 Open API | |
| 감성·요약 | OpenAI GPT-4o-mini | 키 없으면 키워드 기반 폴백 |
| 배포 | Vercel + Vercel Cron | |

---

## 배포

두 가지 방식을 모두 지원하며, 빌드 설정은 `GITHUB_PAGES` 환경변수로 갈립니다.

| | GitHub Pages | Vercel |
|---|---|---|
| 현재 UI | ✅ 완전히 동작 | ✅ 동작 |
| `/api/*` 라우트 | ❌ 서버 없음 | ✅ 동작 |
| Cron 자동 수집 | ❌ 불가 | ✅ 동작 |
| 비용 | 무료 | 무료 티어 |

현재 프론트엔드는 API를 호출하지 않고 로컬 데이터로만 렌더링하므로, **지금 시점에는 Pages로도 화면 전체가 정상 동작합니다.** 실 데이터 수집을 가동할 때 Vercel로 옮기면 됩니다.

### GitHub Pages

`.github/workflows/deploy-pages.yml`이 자동 배포합니다. 저장소에서 한 번만 설정하면 됩니다.

1. **Settings → Pages → Build and deployment**
2. **Source**를 `GitHub Actions`로 변경
3. 브랜치에 push하면 워크플로가 실행되고, 완료 후 아래 주소로 접속

```
https://<사용자명>.github.io/trading-diary/
```

저장소 이름을 바꾸면 워크플로의 `PAGES_BASE_PATH`도 함께 수정해야 합니다. Pages는 `https://user.github.io/<저장소명>/` 하위에 서빙되므로 모든 경로에 접두사가 필요합니다.

로컬에서 정적 빌드를 재현하려면:

```bash
rm -rf src/app/api          # Pages에서는 실행 불가하므로 제외
GITHUB_PAGES=true PAGES_BASE_PATH=/trading-diary pnpm build
npx serve out               # out/ 확인
git checkout src/app/api    # 복원
```

### Vercel

1. [vercel.com](https://vercel.com) → GitHub 로그인
2. 저장소 Import → **Root Directory를 `stockpulse`로 지정**
3. 환경변수 입력 후 Deploy

---

## 시작하기

```bash
cd stockpulse
pnpm install
cp .env.example .env.local   # API 키 입력
pnpm dev
```

**API 키 없이도 전체 UI가 동작합니다.** `src/lib/events-data.ts`의 이벤트 데이터와 `chart-series.ts`의 결정러적 시리즈로 렌더링되므로, 화면을 먼저 확인하고 실 데이터를 점진적으로 연결할 수 있습니다.

### 환경변수

| 변수 | 발급처 | 필수 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com) | 실 데이터 연결 시 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | 실 데이터 연결 시 |
| `SUPABASE_SERVICE_ROLE_KEY` | 동일 | 실 데이터 연결 시 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | [네이버 개발자센터](https://developers.naver.com) | 뉴스 수집 시 |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | [한국투자증권 API](https://apiportal.koreainvestment.com) | 주가 수집 시 |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys) | 선택 (없으면 폴백) |
| `CRON_SECRET` | 임의 문자열 | Cron 보호용 |

### DB 설정

Supabase → SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 실행.

---

## 프로젝트 구조

```
stockpulse/
├── src/
│   ├── app/
│   │   ├── page.tsx                    대시보드
│   │   ├── layout.tsx                  폰트 + 헤더 + 색관설 Provider
│   │   ├── globals.css                 :hover / 미디어쿼리 / 그리드
│   │   ├── stocks/[ticker]/page.tsx    종목 상세
│   │   └── api/                        종목·뉴스·워치리스트·요약·수집
│   ├── components/
│   │   ├── layout/SiteHeader.tsx       로고·검색·KR/US 토글
│   │   ├── stock/
│   │   │   ├── PinnedChart.tsx         SVG 차트 + 번호 핀 + 툴팁
│   │   │   ├── StockHeaderCard.tsx     종목명·가격·워치 버튼
│   │   │   └── PeriodSelector.tsx      1M / 3M / 1Y
│   │   ├── news/NewsTimeline.tsx       칩 필터 + 정렬 + 확장 해설
│   │   └── panels/
│   │       ├── TodayMovesPanel.tsx     뉴스로 설명되는 움직임
│   │       ├── SimilarCasesPanel.tsx   유사 사례 분포
│   │       ├── MarketIndexStrip.tsx    지수
│   │       └── PromiseCard.tsx         이 화면의 약속
│   ├── lib/
│   │   ├── tokens.ts                   색 팔레트 + 방향색
│   │   ├── format.ts                   등락률·날짜 표기
│   │   ├── events-data.ts              이벤트 + 해설 원문
│   │   ├── chart-series.ts             시리즈 생성 + SVG 기하
│   │   ├── event-selectors.ts          핀 선정·번호·유사 사례
│   │   ├── convention-context.tsx      KR/US 상태
│   │   └── collectors/                 네이버·KIS·감성·파이프라인
│   └── types/index.ts
└── supabase/migrations/
```

### 핀 선정 규칙

```
중요도 = |당일 변동률| × 보도 매체 수
```

기간 내 이벤트를 중요도로 정렬해 상위 5개만 핀으로 꽂습니다. 번호는 **필터·정렬과 무관하게 최신순으로 고정**되므로, 정렬을 바꿔도 "핀 3번"이 가리키는 뉴스는 변하지 않습니다.

---

## 데이터 수집 스케줄

| 시각 | 주기 | 동작 |
|---|---|---|
| 09:00~15:30 | 30분 | 뉴스 수집 → 감성 분석 → 종목 매핑 → 주가 갱신 → ±3% 급변 감지 |
| 16:00 | 1일 1회 | 종목별 일일 요약 생성 |

`vercel.json`의 Cron 설정으로 자동 실행됩니다.

---

## API

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/stocks` | 종목 목록 (`?market=`, `?search=`) |
| `GET` | `/api/stocks/[ticker]` | 종목 상세 + 주가 + 뉴스 + 요약 |
| `GET` | `/api/news` | 뉴스 (`?stock_id=`, `?sentiment=`, `?date_from=`) |
| `GET`·`POST`·`DELETE` | `/api/watchlist` | 워치리스트 |
| `GET`·`POST` | `/api/summary` | 일일 요약 조회·생성 |
| `POST` | `/api/collect` | 수집 실행 (`{type:"full"\|"summary"}`) |

---

## 로드맵

- [x] 종목 상세 — 핀 차트 + 확장형 해설 타임라인
- [x] 대시보드 — 뉴스로 설명되는 움직임
- [x] 유사 사례 분포
- [x] KR/US 색 관설 전환
- [ ] 실 데이터 연결 (Supabase + 수집 파이프라인 가동)
- [ ] Google/Kakao 로그인
- [ ] 급변 알림
- [ ] 매매일지 연동 (`trading-diary`)
- [ ] 미국 주식 (헤더 US 탭)

---

## 주의

- 투자 판단의 참고 자료이며, 투자 권유가 아닙니다.
- 뉴스와 주가의 관계는 **상관일 수 있고, 인과가 아닐 수 있습니다.**
- 수익률은 해당 종목 종가 기준이며 시장 전체 흐름이 섞여 있습니다.

---

MIT License
