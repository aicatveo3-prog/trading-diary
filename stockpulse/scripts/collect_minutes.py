#!/usr/bin/env python3
"""
분봉 수집 — Yahoo Finance (yfinance)

네이버 차트 API를 대체했다. 실측으로 확인한 차이:

  | 항목        | 네이버        | Yahoo              |
  |------------|--------------|--------------------|
  | OHLC       | 종가만        | 완비 → 캔들 가능    |
  | 5분봉 범위  | 7거래일       | 60거래일           |
  | 1시간봉     | 없음         | 730거래일          |
  | 미국 종목   | 불가         | 가능               |
  | 프리·애프터 | 없음         | ET 04:00~20:00     |

Yahoo가 충분한 범위를 주므로 누적 병합이 필요 없다 — 매번 새로 받는다.
(네이버는 7일치만 줘서 매일 병합해 쌓아야 했다)

프리마켓 거래량은 전 종목 0이다. Yahoo가 정규장 외 거래량을 집계하지 않는다.
가격은 유효하므로 그대로 저장하고, 화면에서 '거래량 미제공'을 명시한다.

출력:
    public/minutes/{id}_5m.json
    public/minutes/{id}_1h.json

    종목별 분할 저장. 이유:
    - 단일 minutes.json(2.3MB)은 번들에 박혀 모든 페이지가 전량 전송
    - 분할하면 해당 종목만 런타임 fetch → 1종목당 ~20KB(gzip ~6KB)
    - 종목 수가 30→100으로 늘어도 전송량 불변

사용법:
    python scripts/collect_minutes.py
    python scripts/collect_minutes.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yfinance as yf

from universe import load_universe

# --- 설정 ---

# (간격, 조회기간, 보관 거래일 수)
#
# 5분봉만 수집한다. 화면의 1일 차트는 5분봉을 그대로, 1주 차트는 6개씩 묶어
# 30분봉으로 보여준다. 두 용도 모두 5분봉 하나로 충분하다.
#
# 1시간봉은 예전에 '1개월 차트용'으로 함께 수집했으나, 1개월 차트는 일봉을
# 쓰고(뉴스 핀이 일봉 구간에만 꽂힌다) 1시간봉을 읽는 화면이 없어 제거했다.
# 다시 필요하면 아래에 {"key": "1h", "yf": "1h", "period": "90d", "keep_days": 60}
# 항목을 추가하면 된다. Yahoo가 1시간봉 730일을 제공하므로 과거 손실은 없다.
INTERVALS = [
    {"key": "5m", "yf": "5m", "period": "10d", "keep_days": 5},
]

# 시장별 시간대. 저장하는 날짜·시각은 이 시간대의 로컬 값이다.
MARKET_TZ = {"KR": "Asia/Seoul", "US": "America/New_York"}

# 미국 정규장 경계 (ET 분 단위). 서머타임은 tz_convert가 처리하므로
# 로컬 시각으로 비교하면 EDT/EST 전환에 영향받지 않는다.
US_REGULAR_OPEN = 9 * 60 + 30
US_REGULAR_CLOSE = 16 * 60

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "minutes"
KST = timezone(timedelta(hours=9))


class CollectError(Exception):
    """수집 실패 — 파일을 쓰지 않는다."""


def log(msg: str) -> None:
    print(msg, flush=True)


def is_missing(value) -> bool:
    if value is None:
        return True
    try:
        f = float(value)
    except (TypeError, ValueError):
        return True
    return math.isnan(f) or math.isinf(f)


def num(value) -> float | int:
    f = float(value)
    return int(f) if f == int(f) else round(f, 4)


def session_code(market: str, minute_of_day: int) -> int:
    """
    세션 코드. 0=프리마켓, 1=정규장, 2=애프터마켓.

    한국은 프리·애프터마켓이 없어 항상 정규장이다.
    """
    if market != "US":
        return 1
    if minute_of_day < US_REGULAR_OPEN:
        return 0
    if minute_of_day >= US_REGULAR_CLOSE:
        return 2
    return 1


def fetch_interval(interval: dict) -> dict[str, dict]:
    """
    한 간격에 대해 전 종목을 일괄 수집한다.

    yfinance는 여러 심볼을 한 번에 받을 수 있고 30종목이 0.6초면 끝난다.
    종목별로 따로 호출하면 30배 느리고 rate limit에 걸릴 위험도 커진다.
    """
    entries = load_universe()
    symbol_to_entry = {e.yahoo: e for e in entries}

    raw = yf.download(
        list(symbol_to_entry.keys()),
        period=interval["period"],
        interval=interval["yf"],
        prepost=True,
        progress=False,
        auto_adjust=False,
        group_by="ticker",
        threads=True,
    )

    if raw is None or raw.empty:
        raise CollectError(f"{interval['key']} 응답이 비어 있습니다")

    out: dict[str, dict] = {}

    for symbol, entry in symbol_to_entry.items():
        if symbol not in raw.columns.get_level_values(0):
            raise CollectError(f"{entry.id}({symbol}) 응답에 없습니다")

        df = raw[symbol].dropna(how="all")
        if df.empty:
            raise CollectError(f"{entry.id} 데이터가 비어 있습니다")

        tz = MARKET_TZ[entry.market]
        local = df.index.tz_convert(tz)

        by_date: dict[str, dict] = {}

        for pos, ts in enumerate(local):
            row = df.iloc[pos]
            if any(is_missing(row[c]) for c in ("Open", "High", "Low", "Close")):
                continue

            date_key = ts.strftime("%Y%m%d")
            hhmm = ts.strftime("%H%M")
            minute_of_day = ts.hour * 60 + ts.minute

            bucket = by_date.setdefault(
                date_key, {"t": [], "s": [], "o": [], "h": [], "l": [], "c": [], "v": []}
            )
            bucket["t"].append(hhmm)
            bucket["s"].append(session_code(entry.market, minute_of_day))
            bucket["o"].append(num(row["Open"]))
            bucket["h"].append(num(row["High"]))
            bucket["l"].append(num(row["Low"]))
            bucket["c"].append(num(row["Close"]))
            vol = row["Volume"]
            bucket["v"].append(0 if is_missing(vol) or float(vol) < 0 else int(float(vol)))

        # 최근 N거래일만 보관
        for stale in sorted(by_date.keys())[: -interval["keep_days"]]:
            del by_date[stale]

        if not by_date:
            raise CollectError(f"{entry.id} 보관할 거래일이 없습니다")

        out[entry.id] = by_date

    return out


def validate(intervals: dict) -> None:
    expected = {e.id for e in load_universe()}

    for key, block in intervals.items():
        stocks = block["stocks"]
        if set(stocks.keys()) != expected:
            missing = expected - set(stocks.keys())
            raise CollectError(f"{key} 종목 누락: {missing}")

        for sid, days in stocks.items():
            if not days:
                raise CollectError(f"{key} {sid} 거래일이 없습니다")

            for date_key, bar in days.items():
                n = len(bar["t"])
                if n == 0:
                    raise CollectError(f"{key} {sid} {date_key} 바가 0개입니다")
                for field in ("s", "o", "h", "l", "c", "v"):
                    if len(bar[field]) != n:
                        raise CollectError(f"{key} {sid} {date_key} {field} 길이 불일치")
                if bar["t"] != sorted(bar["t"]):
                    raise CollectError(f"{key} {sid} {date_key} 시각이 정렬되지 않았습니다")
                if any(c <= 0 for c in bar["c"]):
                    raise CollectError(f"{key} {sid} {date_key} 종가에 0 이하 값이 있습니다")
                # OHLC 관계
                for i in range(n):
                    o, h, l, c = bar["o"][i], bar["h"][i], bar["l"][i], bar["c"][i]
                    if h < max(o, c) or l > min(o, c):
                        raise CollectError(
                            f"{key} {sid} {date_key} {bar['t'][i]} OHLC 관계 깨짐 "
                            f"(O{o} H{h} L{l} C{c})"
                        )


def summarize(intervals: dict) -> None:
    for key, block in intervals.items():
        stocks = block["stocks"]
        total = sum(len(b["t"]) for days in stocks.values() for b in days.values())
        all_days = {d for days in stocks.values() for d in days}
        log(f"  [{key}] {len(stocks)}종목 · {len(all_days)}거래일 · 바 {total:,}개")

        # 세션 분포는 미국 종목에서만 의미가 있다
        us_ids = [e.id for e in load_universe() if e.market == "US"]
        counts = {0: 0, 1: 0, 2: 0}
        vols = {0: 0, 1: 0, 2: 0}
        for sid in us_ids:
            for bar in stocks.get(sid, {}).values():
                for s, v in zip(bar["s"], bar["v"]):
                    counts[s] += 1
                    vols[s] += v
        labels = {0: "프리", 1: "정규", 2: "애프터"}
        parts = [f"{labels[s]} {counts[s]:,}바(거래량 {vols[s]:,})" for s in (0, 1, 2)]
        log(f"        미국 세션: {' / '.join(parts)}")


def write_per_stock(intervals: dict, collected_at: str) -> None:
    """
    종목별·간격별로 public/minutes/{id}_{interval}.json 을 기록한다.

    파일 구조:
    {
      "collectedAt": "...",
      "days": { "20260828": { "t": [...], "s": [...], "o": [...], ... }, ... }
    }
    """
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    file_count = 0

    for key, block in intervals.items():
        for sid, days in block["stocks"].items():
            payload = {
                "collectedAt": collected_at,
                "days": days,
            }
            text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            path = OUT_DIR / f"{sid}_{key}.json"
            path.write_text(text + "\n", encoding="utf-8")
            total_bytes += len(text)
            file_count += 1

    log(f"  {file_count}파일 · 총 {total_bytes:,} bytes → public/minutes/")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        log("[1/3] 분봉 수집")
        intervals = {}
        for spec in INTERVALS:
            log(f"  {spec['key']} 수집 중 (period={spec['period']})...")
            intervals[spec["key"]] = {
                "keepDays": spec["keep_days"],
                "stocks": fetch_interval(spec),
            }

        collected_at = datetime.now(KST).isoformat(timespec="seconds")

        log("[2/3] 검증")
        validate(intervals)
        summarize(intervals)

    except CollectError as e:
        log(f"\n검증 실패 — 파일을 쓰지 않습니다: {e}")
        return 1
    except Exception as e:
        log(f"\n수집 실패: {type(e).__name__}: {e}")
        return 1

    if args.dry_run:
        log("\n--dry-run: 기록을 건너뜁니다")
        return 0

    log("[3/3] 기록 (종목별 분할)")
    write_per_stock(intervals, collected_at)

    log("\n완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
