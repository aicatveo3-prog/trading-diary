# 겹쳐 — NEWS × PRICE

[![Collect Data](https://github.com/aicatveo3-prog/trading-diary/actions/workflows/collect-prices.yml/badge.svg?branch=feature/stockpulse-mvp)](https://github.com/aicatveo3-prog/trading-diary/actions/workflows/collect-prices.yml)
[![Deploy to GitHub Pages](https://github.com/aicatveo3-prog/trading-diary/actions/workflows/deploy-pages.yml/badge.svg?branch=feature/stockpulse-mvp)](https://github.com/aicatveo3-prog/trading-diary/actions/workflows/deploy-pages.yml)

주가가 움직인 날에 무슨 일이 있었는지를 시간 순서대로 보여줍니다.
**예측하지 않고, 추천하지 않습니다.**

**→ [aicatveo3-prog.github.io/trading-diary](https://aicatveo3-prog.github.io/trading-diary/)**

위 배지가 빨간색이면 자동 수집이 실패한 상태입니다. 사이트 상단의 "N시간 전 갱신"
표시로도 파이프라인이 살아 있는지 확인할 수 있습니다.

---

## 어떻게 동작하나

API 키가 **한 개도 없습니다.** 모든 데이터 소스가 키 없이 접근 가능한 공개
엔드포인트라서, 서버 없이 GitHub Actions + GitHub Pages만으로 무인 운영됩니다.

```
평일 16:40 KST (cron)
  │
  ├─ collect_prices.py    FinanceDataReader (주식·지수) + yfinance (환율)
  ├─ verify_consistency.py  ← 실패하면 여기서 멈추고 커밋하지 않는다
  ├─ collect_news.py      Google News RSS (누적 병합)
  ├─ collect_minutes.py   yfinance (5분봉·1시간봉)
  │
  ├─ 봇이 커밋
  └─ deploy-pages.yml 호출 → 정적 빌드 → Pages 배포
```

검증이 실패하면 **파일을 쓰지 않습니다.** 잘못된 데이터를 배포하는 것보다
낡은 데이터를 유지하는 편이 낫다는 판단입니다. 이때 실패 이슈가 자동으로
생성되고, 다음 실행이 성공하면 자동으로 닫힙니다.

### 데이터 소스

| 데이터 | 소스 | 키 | 비고 |
|---|---|---|---|
| 주식·지수 일봉 | FinanceDataReader | 불필요 | |
| 환율 일봉 | yfinance | 불필요 | FDR은 USD/KRW 날짜가 하루 밀리는 버그가 있어 제외 |
| 분봉 (5분·1시간) | yfinance | 불필요 | 프리·애프터마켓 포함 (ET 04:00~20:00) |
| 뉴스 | Google News RSS | 불필요 | 제목·링크만 수집 (본문 미수집) |
| 감성 분석 | 키워드 사전 | 불필요 | LLM 미사용 |

---

## 종목 (30개)

| 그룹 | 종목 |
|---|---|
| 한국 | 코스피, 삼성전자, SK하이닉스, 한미반도체 |
| 매크로 | 원달러 환율 |
| 미국 지수 | S&P 500, 나스닥, 다우존스, VIX |
| ETF·매크로 | SCHD, 미국채 20년+(TLT), 금(GLD), SOXX, SMH |
| 빅테크 | 애플, MS, 알파벳, 아마존, 엔비디아, 메타, 테슬라, 팔란티어 |
| 반도체 | TSMC, 브로드컴, ASML, AMD, ARM |
| 메모리 | 마이크론, 샌디스크, 웨스턴디지털 |

종목 목록은 `stockpulse/src/data/universe.json` 한 곳에서 정의합니다. Python
수집기(`scripts/universe.py`)와 프론트엔드(`src/lib/universe.ts`)가 같은 파일을
읽으므로, 종목을 추가할 때 한 곳만 고치면 됩니다.

심볼이 소스마다 다르므로(`FDR: US500` / `Yahoo: ^GSPC`) `fdr`·`yahoo` 필드를
따로 보관하고, URL에는 내부 `id`를 씁니다.

---

## 설계 판단

이 프로젝트에서 **하지 않기로 한 것**들이 설계의 핵심입니다.

| 하지 않는 것 | 이유 |
|---|---|
| 인과관계 단정 | 차트에 "같은 날 일어난 일이라는 뜻이며, 원인을 단정하지 않습니다"를 항상 표시 |
| 평균 수익률 제시 | 평균은 예측처럼 읽힘 |
| 매수·매도 신호 | 판단은 사용자가 함 |
| 없는 데이터 채우기 | 휴장일을 forward-fill하면 존재하지 않는 캔들이 생김 |
| 분봉에 뉴스 핀 | 뉴스 타임스탬프의 20.8%가 정시로 반올림돼 있어 거짓 정밀도가 됨 |

### 시장별 거래일 축 분리

한국과 미국은 공휴일이 달라 하나의 날짜 축을 공유할 수 없습니다.

| 방식 | 결과 |
|---|---|
| 교집합 | KR 8일 + US 16일 손실 (약 25%) |
| forward-fill | 거래 없는 날에 가짜 캔들 생성 |
| **시장별 분리** (채택) | 손실 0 |

`prices.json`은 `markets.{KR,US}` 구조이며 각 시장이 자기 `dates` 축을 가집니다.
축은 `type == "stock"`인 종목만으로 계산합니다 — 환율은 24시간 거래되어 축을
부풀리고, VIX는 미국 공휴일을 축에 넣어 다른 종목에 공백을 만듭니다.

### 분봉을 종목별 파일로 분리

단일 `minutes.json`(2.3MB)을 정적 `import`하면 webpack이 객체 전체를 번들에
넣습니다. JSON은 트리 셰이킹이 되지 않아, 한 종목을 보려고 30종목 분봉을
모두 내려받게 됩니다.

`public/minutes/{id}_{5m|1h}.json`으로 쪼개고 런타임 `fetch`로 바꿨습니다.

| | 이전 | 이후 |
|---|---|---|
| 번들 내 분봉 | 2.3MB | 0 |
| JS 번들 (gzip) | 약 980KB | 367KB |
| 종목 1개 전송량 | 613KB (전 종목) | 약 16KB |

종목을 30 → 100으로 늘려도 종목당 전송량은 변하지 않습니다.

### 기간별 적응형 해상도

| 기간 | 해상도 | 데이터 |
|---|---|---|
| 1일 | 5분봉 | `public/minutes/*_5m.json` (최근 5거래일 보관) |
| 1주 | 30분봉 | 5분봉을 집계 |
| 1개월·3개월·6개월 | 일봉 | `prices.json` |
| 1년·전체 | 주봉 | 일봉을 집계 |

1년을 일봉으로 그리면 250개가 빽빽해 읽히지 않으므로 주봉으로 집계합니다.

### 뉴스 핀 선정

```
중요도 = 기사 수 × (|당일 등락률| + 1)
```

`+1`을 두는 이유: 단순히 곱하면 등락률 0%인 날의 중요도가 0이 되어, 기사가
아무리 많아도 탈락합니다. "뉴스가 쏟아졌는데도 주가가 안 움직인 날"은 그
자체로 읽을 만한 정보입니다.

주말·휴일 기사는 다음 거래일로 이월하고, 주가보다 최신인 기사는 핀으로 꽂지
않고 "아직 주가에 반영되지 않음"으로 분리합니다.

---

## 로컬 실행

```bash
cd stockpulse
pnpm install
pnpm dev
```

데이터가 저장소에 커밋돼 있어 **키 설정 없이 바로 실행됩니다.**

### 데이터 수집 (선택)

```bash
pip install finance-datareader yfinance

cd stockpulse
python scripts/collect_prices.py      # 일봉 → src/data/prices.json
python scripts/verify_consistency.py  # 검증 (실패 시 exit 1)
python scripts/collect_news.py        # 뉴스 → src/data/news.json (누적)
python scripts/collect_minutes.py     # 분봉 → public/minutes/
```

`--dry-run`을 붙이면 파일을 쓰지 않고 결과만 확인합니다.

### 정적 빌드 재현

```bash
cd stockpulse
GITHUB_PAGES=true PAGES_BASE_PATH=/trading-diary pnpm build
npx serve out
```

---

## 검증

`verify_consistency.py`는 두 등급을 구분합니다.

| 등급 | 종료 코드 | 동작 |
|---|---|---|
| **FAIL** | 1 | 데이터가 깨졌다. 커밋 중단 + 실패 이슈 생성 |
| **WARN** | 0 | 데이터는 유효하나 낡았다. 커밋은 진행, 실행 요약에 기록 |

신선도로 커밋을 막지 않는 이유: 설날·추석에 한국 시장이 며칠 쉬면 정상인데도
실패로 잡혀 거짓 경보가 됩니다. 그게 반복되면 진짜 실패 알림까지 무시하게
됩니다.

검증 항목:

- 시장별 축 — 날짜 정렬·중복, `tradingDate`와 마지막 날짜 일치
- 종목 커버리지 — `universe.json` = `prices.json` = `stocks.json` 3자 일치
- 시계열 — 배열 길이 = 거래일 수, 가격 > 0, OHLC 관계(`H ≥ max(O,C)`, `L ≤ min(O,C)`)
- 종목별 종가가 서로 다른가 (과거에 전 종목이 같은 값이던 버그 감시)
- 분봉 60개 파일 존재·구조
- 뉴스에 유니버스 밖 종목이 섞이지 않았는가
- 신선도 — 기준일·수집 시각·최신 기사 나이 (조용한 정지 탐지)

---

## 알려진 한계

| 항목 | 현재 상태 |
|---|---|
| 뉴스 커버리지 | KR 약 13% / US 약 21%. Google News RSS가 과거 기사를 주지 않아, 누적 방식으로 매일 조금씩 쌓입니다 |
| 감성 분석 | 키워드 사전 기반. 문맥을 못 읽어 중립 비율이 높고 오분류가 있습니다 |
| 프리마켓 거래량 | Yahoo가 정규장 외 거래량을 집계하지 않아 0입니다. 가격은 유효합니다 |
| 데이터 소스 | API 키가 없어 가용성 보장이 없습니다. 형식 변경 시 수집이 멈출 수 있습니다 |
| 실행 누락 | 주가·분봉은 매번 전체를 재수집해 자동 복구되지만, 뉴스는 누적이라 빠뜨린 날의 기사가 영구 손실됩니다 |

---

## 주의

- 투자 판단의 참고 자료이며, 투자 권유가 아닙니다.
- 뉴스와 주가의 관계는 **상관일 수 있고, 인과가 아닐 수 있습니다.**
- 수익률은 종가 기준이며 시장 전체 흐름이 섞여 있습니다.

---

MIT License
