# 겹쳐 — 앱 (stockpulse)

프로젝트 개요·데이터 파이프라인·설계 판단은 **[저장소 루트 README](../README.md)**를 보세요.
이 문서는 코드 구조와 개발 시 주의점만 다룹니다.

---

## 기술 스택

| 레이어 | 선택 | 이유 |
|---|---|---|
| Framework | Next.js 16 (App Router) + 정적 export | 서버가 없어야 GitHub Pages에 무료로 올라간다 |
| 언어 | TypeScript | |
| 차트 | 순수 SVG (`polyline`·`polygon`·`rect`) | 라이브러리 없음. 필요한 형태가 단순하고, 핀 오버레이를 DOM으로 직접 제어하는 편이 정확하다 |
| 스타일 | 인라인 스타일 + 최소 CSS | 색 관설(KR/US)이 런타임에 바뀐다. `:hover`·미디어쿼리·폰트만 `globals.css` |
| 폰트 | Noto Serif KR (제목·숫자) / Noto Sans KR (본문) | `next/font` |
| 데이터 | 저장소에 커밋된 JSON | DB·API 서버 없음 |

서버가 없다. 화면은 빌드에 포함된 JSON(`prices`·`news`·`universe`·`stocks`)과
런타임 fetch하는 분봉(`public/minutes/`)만 읽는다. 이전에 있던 Supabase·API
라우트·네이버 수집기·Vercel Cron은 모두 제거하고, Python 수집기 + GitHub
Actions + 커밋된 JSON 구조로 대체했다.

---

## 데이터 파일

| 파일 | 생성 스크립트 | 전달 방식 |
|---|---|---|
| `src/data/universe.json` | 수동 (단일 소스) | 번들 |
| `src/data/prices.json` | `collect_prices.py` | 번들 |
| `src/data/stocks.json` | `collect_prices.py` | 번들 |
| `src/data/news.json` | `collect_news.py` | 번들 |
| `public/minutes/{id}_{5m\|1h}.json` | `collect_minutes.py` | **런타임 fetch** |

분봉만 fetch인 이유는 루트 README의 "분봉을 종목별 파일로 분리" 참조.

### 구조

```jsonc
// prices.json — 시장별로 거래일 축이 분리돼 있다
{
  "collectedAt": "2026-08-28T16:40:00+09:00",
  "markets": {
    "KR": { "tradingDate": "2026-08-28", "dates": [...], "stocks": { "005930": { "o":[], "h":[], "l":[], "c":[], "v":[] } } },
    "US": { "tradingDate": "2026-08-27", "dates": [...], "stocks": { ... } }
  }
}

// public/minutes/005930_5m.json — s는 세션 (0=프리, 1=정규, 2=애프터)
{
  "collectedAt": "...",
  "days": { "20260828": { "t":["0900",...], "s":[1,...], "o":[], "h":[], "l":[], "c":[], "v":[] } }
}
```

---

## 주의점

### 종목을 추가할 때

`src/data/universe.json` **한 곳만** 고칩니다. Python 수집기와 프론트엔드가 같은
파일을 읽습니다. 과거에 `TARGETS`가 세 수집기에 중복 정의돼 있어, 종목을 바꿀 때
한 곳을 빼먹고 화면에 유령 종목이 남는 사고가 있었습니다.

추가 후 `python scripts/collect_prices.py && python scripts/collect_minutes.py &&
python scripts/collect_news.py`를 돌려야 데이터가 채워집니다.

### 시장별 축 때문에 ticker가 필요하다

`tradingDates()`·`dateFor()`·`hasDay()`는 optional `ticker`를 받습니다. 넘기지
않으면 KR 축을 씁니다. 미국 종목을 다룰 때는 반드시 넘겨야 합니다 — 안 넘기면
뉴스 핀이 엉뚱한 날짜에 꽂힙니다.

### 가격 표기는 통화별로 다르다

`won()`을 쓰면 안 됩니다. `Math.round()`가 들어 있어 NVDA `$227.98`이 `228`로
렌더됩니다. `universe.ts`의 `formatPrice()` / `formatChangeAmount()`를 쓰세요.

| 유형 | 표기 |
|---|---|
| USD | `$227.98` (소수 2자리) |
| KRW 주식 | `259,500` (정수) |
| 지수 | `6,839.74` (통화 기호 없음 — 포인트다) |
| 환율 | `1,378.94` |

### 상대 시간은 클라이언트에서 계산해야 한다

정적 export는 빌드 시점에 HTML이 고정됩니다. "3시간 전"을 서버에서 렌더하면
일주일 뒤에도 "3시간 전"으로 보입니다. `DataFreshness.tsx`처럼 `useEffect` 이후에
계산하고, 첫 페인트는 비워 하이드레이션 불일치를 피하세요.

### 없는 데이터를 만들지 않는다

- 휴장일을 forward-fill하지 않는다 (가짜 캔들)
- OHLC가 0으로 비어 오면 종가로 채워 도지로 표시한다 (`close_only_fallback`).
  전일 종가에서 시가를 끌어오면 없는 정보를 만드는 것이다
- 분봉에 뉴스 핀을 꽂지 않는다 (타임스탬프 20.8%가 정시 반올림)

---

## 구조

```
stockpulse/
├── scripts/                       Python 수집기
│   ├── universe.py                유니버스 로더 (공용)
│   ├── collect_prices.py          일봉 → prices.json, stocks.json
│   ├── collect_news.py            Google News RSS → news.json (누적 병합)
│   ├── collect_minutes.py         분봉 → public/minutes/*.json
│   └── verify_consistency.py      검증 (FAIL=exit 1 / WARN=exit 0)
├── public/minutes/                종목별 분봉 (런타임 fetch)
└── src/
    ├── app/
    │   ├── page.tsx               대시보드
    │   ├── watchlist/page.tsx     워치리스트
    │   └── stocks/[ticker]/       종목 상세 (generateStaticParams로 30페이지)
    ├── components/
    │   ├── layout/
    │   │   ├── SiteHeader.tsx     로고·검색·KR/US 토글
    │   │   └── DataFreshness.tsx  "N시간 전 갱신"
    │   ├── stock/
    │   │   ├── PinnedChart.tsx    일봉 + 뉴스 핀
    │   │   ├── IntradayChart.tsx  분봉 (fetch + OHLC 캔들)
    │   │   ├── StockHeaderCard.tsx
    │   │   └── PeriodSelector.tsx 1일~전체 7단계
    │   ├── news/GroupedNewsTimeline.tsx
    │   └── panels/
    │       ├── MarketIndexStrip.tsx
    │       └── PromiseCard.tsx
    └── lib/
        ├── universe.ts            유니버스 + 통화별 포맷
        ├── price-data.ts          일봉 접근 + 시장 라우팅 + SVG 기하
        ├── minute-data.ts         분봉 fetch + 집계
        ├── news-data.ts           뉴스 접근
        ├── news-pins.ts           뉴스 → 거래일 매핑 + 핀 선정
        ├── periods.ts             차트 기간 정의 (PERIODS)
        ├── today-moves.ts         등락률 순위 (대시보드)
        ├── tokens.ts              색 팔레트
        └── convention-context.tsx KR/US 색 관설 상태
```

### 남은 개선 여지

- `today-moves.ts`는 등락률 순위만 낸다. 그날의 원인 뉴스를 붙이려면
  `news-pins.ts`의 거래일 매핑을 대시보드로 끌어오면 된다.
- 감성 분석이 키워드 사전 기반이라 중립 비율이 높다.

---

## 색 관설 (KR / US)

한국은 상승이 빨강, 미국은 상승이 초록입니다. 헤더에서 전환하면 차트·타임라인·
목록의 모든 방향색이 함께 바뀝니다.

| | 상승 | 하락 |
|---|---|---|
| KR (기본) | `#c0392b` | `#1f5fbf` |
| US | `#17805a` | `#c0392b` |
