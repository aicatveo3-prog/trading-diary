#!/usr/bin/env python3
"""
분봉 수집 — 네이버 차트 API

GitHub Actions에서 매 영업일 장마감 후 실행되어 src/data/minutes.json 을 갱신한다.
API 키가 필요 없다.

중요한 제약 (실측으로 확인):
  1. OHLC 중 시가·고가·저가가 null이다. **종가만 제공된다.**
     → 캔들 차트를 그릴 수 없다. 선 차트만 가능하다.
  2. 거래량이 일중 누적값이다. 분당 거래량을 얻으려면 차분해야 한다.
  3. 하루 381개 (09:00~15:19 + 15:30). 15:20~15:29는 동시호가로 분봉이 없다.
  4. 약 7거래일치만 제공한다. 그 이상은 매일 수집해 누적해야 한다.

사용법:
    python scripts/collect_minutes.py
    python scripts/collect_minutes.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

TARGETS = [
    {"ticker": "005930", "name": "삼성전자"},
    {"ticker": "000660", "name": "SK하이닉스"},
    {"ticker": "035720", "name": "카카오"},
    {"ticker": "035420", "name": "NAVER"},
    {"ticker": "247540", "name": "에코프로비엠"},
    {"ticker": "012450", "name": "한화에어로스페이스"},
]

# 한 번에 요청할 분봉 개수. 381 × 7일 ≈ 2,700
REQUEST_COUNT = 2700
# 보관할 최대 거래일 수. 늘리면 누적되지만 JSON이 커진다.
MAX_DAYS = 10
# 하루 분봉이 이보다 적으면 미완성(장중)으로 본다
FULL_DAY_BARS = 381

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
KST = timezone(timedelta(hours=9))


class CollectError(Exception):
    """수집 실패 — 파일을 쓰지 않는다."""


def log(msg: str) -> None:
    print(msg, flush=True)


def fetch_minutes(ticker: str) -> dict[str, dict]:
    """
    종목의 분봉을 날짜별로 묶어 반환한다.

    반환: { "20260820": {"t": ["0900",...], "c": [248500,...], "v": [928418,...]} }
    v는 차분된 분당 거래량이다.
    """
    url = (
        f"https://fchart.stock.naver.com/sise.nhn"
        f"?symbol={ticker}&timeframe=minute&count={REQUEST_COUNT}&requestType=0"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; StockPulse/1.0)"})
    raw = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")

    items = re.findall(r'data="([^"]+)"', raw)
    if not items:
        raise CollectError(f"{ticker} 분봉 응답이 비어 있습니다")

    by_date: dict[str, dict] = {}

    for item in items:
        parts = item.split("|")
        if len(parts) < 6:
            continue

        timestamp = parts[0]
        close_raw = parts[4]
        volume_raw = parts[5]

        # 종가가 없는 행은 버린다 (거래 정지 등)
        if close_raw in ("null", ""):
            continue

        date_key = timestamp[:8]
        hhmm = timestamp[8:12]

        try:
            close = int(close_raw)
            cumulative_volume = int(volume_raw)
        except ValueError:
            continue

        bucket = by_date.setdefault(date_key, {"t": [], "c": [], "_cum": []})
        bucket["t"].append(hhmm)
        bucket["c"].append(close)
        bucket["_cum"].append(cumulative_volume)

    # 누적 거래량을 분당 거래량으로 차분한다.
    # 하루의 첫 분봉은 시초 동시호가 물량이 포함되므로 그대로 둔다.
    for date_key, bucket in by_date.items():
        cum = bucket.pop("_cum")
        volumes = []
        prev = 0
        for i, value in enumerate(cum):
            volumes.append(value if i == 0 else max(0, value - prev))
            prev = value
        bucket["v"] = volumes

    return by_date


def merge_days(existing: dict, incoming: dict) -> dict:
    """
    기존 데이터와 병합한다.

    새로 받은 날짜는 덮어쓴다 — 장중에 수집한 미완성 데이터가
    장마감 후 완성 데이터로 교체되어야 하기 때문이다.
    """
    merged = dict(existing)
    merged.update(incoming)

    # 최근 MAX_DAYS만 보관
    for date_key in sorted(merged.keys())[:-MAX_DAYS]:
        del merged[date_key]

    return merged


def validate(payload: dict) -> None:
    stocks = payload["stocks"]
    if set(stocks.keys()) != {t["ticker"] for t in TARGETS}:
        raise CollectError("수집된 종목이 대상과 다릅니다")

    for ticker, days in stocks.items():
        if not days:
            raise CollectError(f"{ticker} 데이터가 비어 있습니다")

        for date_key, bucket in days.items():
            n = len(bucket["t"])
            if not (len(bucket["c"]) == n and len(bucket["v"]) == n):
                raise CollectError(f"{ticker} {date_key} 배열 길이가 불일치합니다")
            if n == 0:
                raise CollectError(f"{ticker} {date_key} 분봉이 0개입니다")
            if any(c <= 0 for c in bucket["c"]):
                raise CollectError(f"{ticker} {date_key} 종가에 0 이하 값이 있습니다")
            if any(v < 0 for v in bucket["v"]):
                raise CollectError(f"{ticker} {date_key} 거래량에 음수가 있습니다")
            # 시각이 오름차순인지
            if bucket["t"] != sorted(bucket["t"]):
                raise CollectError(f"{ticker} {date_key} 시각이 정렬되지 않았습니다")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    path = DATA_DIR / "minutes.json"
    previous = {}
    if path.exists():
        try:
            previous = json.loads(path.read_text(encoding="utf-8")).get("stocks", {})
        except Exception:
            previous = {}

    log("[1/3] 분봉 수집")
    stocks: dict[str, dict] = {}

    try:
        for target in TARGETS:
            ticker = target["ticker"]
            incoming = fetch_minutes(ticker)
            merged = merge_days(previous.get(ticker, {}), incoming)
            stocks[ticker] = merged

            days = sorted(merged.keys())
            complete = sum(1 for d in days if len(merged[d]["t"]) >= FULL_DAY_BARS)
            total_bars = sum(len(merged[d]["t"]) for d in days)
            log(
                f"  {ticker} {target['name']:<12} {len(days)}일 "
                f"(완성 {complete}일) 분봉 {total_bars:,}개  {days[0]}~{days[-1]}"
            )
            time.sleep(0.6)

        log("[2/3] 검증")
        payload = {
            "collectedAt": datetime.now(KST).isoformat(timespec="seconds"),
            "stocks": stocks,
        }
        validate(payload)

        all_days = {d for days in stocks.values() for d in days}
        total = sum(len(b["t"]) for days in stocks.values() for b in days.values())
        log(f"  통과: {len(all_days)}거래일 × {len(stocks)}종목, 분봉 {total:,}개")

    except CollectError as e:
        log(f"\n검증 실패 — 파일을 쓰지 않습니다: {e}")
        return 1
    except Exception as e:
        log(f"\n수집 실패: {type(e).__name__}: {e}")
        return 1

    if args.dry_run:
        log("\n--dry-run: 기록을 건너뜁니다")
        return 0

    log("[3/3] 기록")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    path.write_text(text + "\n", encoding="utf-8")
    log(f"  src/data/minutes.json  {len(text):,} bytes")

    log(f"\n완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
