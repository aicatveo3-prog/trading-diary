#!/usr/bin/env python3
"""
주가 수집 — FinanceDataReader

GitHub Actions에서 매 영업일 장마감 후 실행되어 src/data/*.json 을 갱신한다.
서버 없이 정적 배포를 유지하기 위해, 수집 결과를 저장소에 커밋하고
그 커밋이 Pages 재빌드를 트리거하는 구조다.

핵심 원칙: **잘못된 데이터를 커밋하는 것보다 낡은 데이터를 유지하는 것이 낫다.**
검증을 통과하지 못하면 파일을 쓰지 않고 종료 코드 1로 실패한다.

사용법:
    python scripts/collect_prices.py            # 수집 후 검증 통과 시 기록
    python scripts/collect_prices.py --dry-run  # 기록하지 않고 검증만
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import FinanceDataReader as fdr

# --- 설정 ---

# 수집 대상. 종목이 늘어나면 여기만 추가하면 된다.
# market 은 UI 표기용이며 FDR 조회에는 쓰이지 않는다.
TARGETS: list[dict[str, str]] = [
    {"ticker": "005930", "name": "삼성전자", "market": "KOSPI"},
    {"ticker": "000660", "name": "SK하이닉스", "market": "KOSPI"},
    {"ticker": "035720", "name": "카카오", "market": "KOSPI"},
    {"ticker": "035420", "name": "NAVER", "market": "KOSPI"},
    {"ticker": "247540", "name": "에코프로비엠", "market": "KOSDAQ"},
    {"ticker": "012450", "name": "한화에어로스페이스", "market": "KOSPI"},
]

INDICES: list[dict[str, str]] = [
    {"code": "KS11", "name": "KOSPI"},
    {"code": "KQ11", "name": "KOSDAQ"},
]

# 차트가 1Y까지 지원하므로 여유를 두고 받는다
LOOKBACK_DAYS = 420
# 화면이 요구하는 최소 거래일 수 (1Y = 250영업일)
MIN_TRADING_DAYS = 240
# 한국 주식 상·하한가는 ±30%. 이를 넘으면 데이터 오류로 본다
MAX_DAILY_CHANGE_PCT = 31.0
# 최신 데이터가 이보다 오래되면 수집이 밀린 것으로 본다 (연휴 고려)
MAX_STALE_DAYS = 6

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

KST = timezone(timedelta(hours=9))


class ValidationError(Exception):
    """검증 실패 — 이 예외가 나면 파일을 쓰지 않는다."""


def log(msg: str) -> None:
    print(msg, flush=True)


# --- 수집 ---


def fetch_stock_frames(start: str) -> dict[str, "object"]:
    """종목별 일봉을 받아온다. 하나라도 실패하면 예외를 올린다."""
    frames = {}
    for t in TARGETS:
        ticker = t["ticker"]
        df = fdr.DataReader(ticker, start)
        if df is None or len(df) == 0:
            raise ValidationError(f"{ticker}({t['name']}) 응답이 비어 있습니다")
        frames[ticker] = df
        log(f"  {ticker} {t['name']:<10} {len(df):>4}행  최신 {df.index[-1].date()}")
    return frames


def build_price_payload(frames: dict) -> dict:
    """
    공통 거래일 축을 만들고 종목별 OHLCV를 그 축에 정렬한다.

    축을 공유하는 이유:
      - 종목마다 거래정지 등으로 결측일이 생길 수 있는데, 축이 다르면
        차트의 x좌표가 종목별로 어긋난다.
      - 열 지향(column-oriented) 구조라 객체 배열보다 JSON이 훨씬 작다.
    """
    # 모든 종목에 공통으로 존재하는 날짜만 사용한다
    common = None
    for df in frames.values():
        dates = {d.date().isoformat() for d in df.index}
        common = dates if common is None else (common & dates)

    if not common:
        raise ValidationError("종목 간 공통 거래일이 없습니다")

    axis = sorted(common)

    stocks = {}
    for t in TARGETS:
        ticker = t["ticker"]
        df = frames[ticker]
        by_date = {d.date().isoformat(): row for d, row in df.iterrows()}

        o, h, l, c, v = [], [], [], [], []
        for day in axis:
            row = by_date[day]
            o.append(int(row["Open"]))
            h.append(int(row["High"]))
            l.append(int(row["Low"]))
            c.append(int(row["Close"]))
            v.append(int(row["Volume"]))

        stocks[ticker] = {"o": o, "h": h, "l": l, "c": c, "v": v}

    return {
        "tradingDate": axis[-1],
        "collectedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "dates": axis,
        "stocks": stocks,
    }


def fetch_indices(start: str) -> dict:
    """지수 현재값과 전일 대비 등락률."""
    out = {}
    for idx in INDICES:
        df = fdr.DataReader(idx["code"], start)
        if df is None or len(df) < 2:
            raise ValidationError(f"{idx['code']} 지수 응답이 부족합니다")

        last = float(df["Close"].iloc[-1])
        prev = float(df["Close"].iloc[-2])
        if prev == 0:
            raise ValidationError(f"{idx['code']} 전일 종가가 0입니다")

        out[idx["code"]] = {
            "name": idx["name"],
            "value": round(last, 2),
            "changeRate": round((last - prev) / prev * 100, 2),
            "date": df.index[-1].date().isoformat(),
        }
        log(f"  {idx['code']:<6} {idx['name']:<8} {last:>10,.2f}  {out[idx['code']]['changeRate']:+.2f}%")
    return out


def build_stock_meta() -> dict:
    return {t["ticker"]: {"name": t["name"], "ticker": t["ticker"], "market": t["market"]} for t in TARGETS}


# --- 검증 ---


def validate(prices: dict, indices: dict) -> None:
    """
    이상 데이터를 걸러낸다. 여기서 막지 못하면 화면에 잘못된 숫자가 나간다.
    """
    dates = prices["dates"]

    if len(dates) < MIN_TRADING_DAYS:
        raise ValidationError(f"거래일이 부족합니다: {len(dates)}일 < 최소 {MIN_TRADING_DAYS}일")

    if len(set(dates)) != len(dates):
        raise ValidationError("거래일에 중복이 있습니다")

    if dates != sorted(dates):
        raise ValidationError("거래일이 오름차순이 아닙니다")

    # 최신 데이터가 너무 오래되지 않았는지
    latest = date.fromisoformat(dates[-1])
    stale = (date.today() - latest).days
    if stale > MAX_STALE_DAYS:
        raise ValidationError(f"최신 데이터가 {stale}일 전입니다 (허용 {MAX_STALE_DAYS}일)")

    if set(prices["stocks"].keys()) != {t["ticker"] for t in TARGETS}:
        raise ValidationError("수집된 종목 목록이 대상과 다릅니다")

    n = len(dates)
    for ticker, s in prices["stocks"].items():
        for key in ("o", "h", "l", "c", "v"):
            if len(s[key]) != n:
                raise ValidationError(f"{ticker}.{key} 길이가 거래일 수와 다릅니다")

        for i in range(n):
            o, h, l, c = s["o"][i], s["h"][i], s["l"][i], s["c"][i]

            if min(o, h, l, c) <= 0:
                raise ValidationError(f"{ticker} {dates[i]} 가격에 0 이하 값이 있습니다")

            # 고가는 최고, 저가는 최저여야 한다
            if h < max(o, c) or l > min(o, c):
                raise ValidationError(f"{ticker} {dates[i]} OHLC 관계가 깨졌습니다 (O{o} H{h} L{l} C{c})")

            if s["v"][i] < 0:
                raise ValidationError(f"{ticker} {dates[i]} 거래량이 음수입니다")

            # 상·하한가를 넘는 변동은 데이터 오류로 본다
            if i > 0:
                prev_c = s["c"][i - 1]
                change = abs((c - prev_c) / prev_c * 100)
                if change > MAX_DAILY_CHANGE_PCT:
                    raise ValidationError(
                        f"{ticker} {dates[i]} 전일비 {change:.1f}% 변동 "
                        f"({prev_c} → {c}) — 상하한가 초과"
                    )

    for code, idx in indices.items():
        if idx["value"] <= 0:
            raise ValidationError(f"{code} 지수가 0 이하입니다")
        if abs(idx["changeRate"]) > 20:
            raise ValidationError(f"{code} 지수 변동 {idx['changeRate']}% — 비정상")

    log(f"  검증 통과: {len(dates)}거래일 × {len(prices['stocks'])}종목, 최신 {dates[-1]}")


# --- 기록 ---


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # 정렬·개행을 고정해 불필요한 diff가 생기지 않게 한다
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    path.write_text(text + "\n", encoding="utf-8")
    log(f"  {path.relative_to(path.parent.parent.parent)}  {len(text):,} bytes")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="기록하지 않고 검증만 수행")
    args = parser.parse_args()

    start = (date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()

    try:
        log(f"[1/4] 일봉 수집 (since {start})")
        frames = fetch_stock_frames(start)

        log("[2/4] 공통 거래일 축 정렬")
        prices = build_price_payload(frames)

        log("[3/4] 지수 수집")
        indices = fetch_indices((date.today() - timedelta(days=30)).isoformat())

        log("[4/4] 검증")
        validate(prices, indices)

    except ValidationError as e:
        log(f"\n검증 실패 — 파일을 쓰지 않습니다: {e}")
        return 1
    except Exception as e:
        log(f"\n수집 실패: {type(e).__name__}: {e}")
        return 1

    if args.dry_run:
        log("\n--dry-run: 기록을 건너뜁니다")
        return 0

    log("기록")
    write_json(DATA_DIR / "prices.json", prices)
    write_json(DATA_DIR / "indices.json", indices)
    write_json(DATA_DIR / "stocks.json", build_stock_meta())

    log(f"\n완료 — 기준일 {prices['tradingDate']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
