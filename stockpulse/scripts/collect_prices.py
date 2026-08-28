#!/usr/bin/env python3
"""
일봉 수집 — FinanceDataReader

GitHub Actions에서 매 영업일 장마감 후 실행되어 src/data/prices.json 을 갱신한다.
서버 없이 정적 배포를 유지하기 위해, 수집 결과를 저장소에 커밋하고
그 커밋이 Pages 재빌드를 트리거하는 구조다.

핵심 원칙: **잘못된 데이터를 커밋하는 것보다 낡은 데이터를 유지하는 것이 낫다.**
검증을 통과하지 못하면 파일을 쓰지 않고 종료 코드 1로 실패한다.

시장별 거래일 축을 쓰는 이유:
  한국과 미국은 휴장일이 다르다. 예전처럼 전 종목의 교집합을 쓰면
  '한국만 열린 날'과 '미국만 열린 날'이 모두 버려져 데이터가 25% 사라진다.
  시장마다 자기 축을 갖게 해서 손실을 0으로 만든다.

사용법:
    python scripts/collect_prices.py
    python scripts/collect_prices.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import FinanceDataReader as fdr
import yfinance as yf

from universe import load_universe, markets, stock_meta

# --- 설정 ---

# 차트가 1년까지 지원하므로 여유를 두고 받는다
LOOKBACK_DAYS = 420
# 시장 축이 이보다 짧으면 수집이 잘못된 것으로 본다
MIN_TRADING_DAYS = 200
# 일간 변동 상한. 한국 주식은 ±30%지만 미국은 상하한가가 없어 더 넉넉히 둔다.
MAX_DAILY_CHANGE_PCT = {"KR": 31.0, "US": 60.0}
# 최신 데이터가 이보다 오래되면 수집이 밀린 것으로 본다 (연휴 고려)
MAX_STALE_DAYS = 6

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
KST = timezone(timedelta(hours=9))


class ValidationError(Exception):
    """검증 실패 — 이 예외가 나면 파일을 쓰지 않는다."""


def log(msg: str) -> None:
    print(msg, flush=True)


def is_missing(value) -> bool:
    """
    값이 비어 있는지 판정한다.

    환율과 일부 지수(VIX)는 휴장일에도 행이 존재하지만 값이 NaN이다.
    FDR이 날짜는 만들고 값은 비워두기 때문이다.
    예: USD/KRW 2025-12-25, VIX 2025-09-01(노동절)
    """
    if value is None:
        return True
    try:
        f = float(value)
    except (TypeError, ValueError):
        return True
    return math.isnan(f) or math.isinf(f)


def num(value) -> float | int:
    """
    JSON에 넣을 숫자로 변환한다.

    한국 주식은 정수(261500), 미국 주식·지수·환율은 소수(314.58)다.
    정수로 표현 가능하면 int로 저장해 JSON 크기를 줄인다.
    """
    f = float(value)
    if math.isnan(f) or math.isinf(f):
        raise ValidationError(f"숫자가 아닌 값: {value}")
    return int(f) if f == int(f) else round(f, 4)


def normalize_ohlc(o, h, l, c) -> tuple:
    """
    OHLC 논리 일관성을 보정한다.

    환율처럼 여러 소스를 합친 데이터는 '저가 > 시가' 같은 모순이 나타난다.
    실제 예: USD/KRW 2025-07-03 → O=1357.1 H=1366.98 L=1358.12 C=1357.1
    저가가 시가보다 높아 캔들을 그릴 수 없다.

    시가·종가는 신뢰하고, 고가·저가를 관측된 실제 범위로 맞춘다.
    없는 정보를 만들어내는 것이 아니라, 네 값이 서로 모순되지 않게만 정리한다.
    """
    hi = max(o, h, l, c)
    lo = min(o, h, l, c)
    return o, hi, lo, c


def close_only_fallback(o, h, l, c) -> tuple[tuple, bool]:
    """
    시가·고가·저가가 0으로 비어 있고 종가만 유효한 행을 처리한다.

    FDR은 값을 NaN이 아니라 0으로 채워 보내는 경우가 있다. is_missing()은
    NaN만 걸러내므로 0은 그대로 통과하고, normalize_ohlc()가 min()을 계산해
    저가가 0이 되어 검증에서 걸린다.

    실측: VIX 2026-08-27 → O=0.00 H=0.00 L=0.00 C=14.51
    (전날까지는 O=15.65 H=15.74 L=15.21 C=15.21 로 정상이었다.
     FDR이 데이터를 갱신하면서 OHLC만 0으로 덮어썼다)

    시장별로 종목이 같은 거래일 축을 공유하므로 이 행만 빼면 배열 길이가
    어긋난다. 그래서 종가로 네 값을 채운다 — 그날 '움직임을 모른다'는 뜻이며,
    캔들은 도지(십자)로 그려진다. 가짜 고가·저가를 만들지는 않는다.

    수집기는 매번 전체 기간을 새로 받으므로, FDR이 OHLC를 복구하면
    다음 실행에서 자동으로 정상 값으로 돌아온다.

    반환: ((o, h, l, c), 종가로_대체했는지)
    """
    if c <= 0:
        # 종가마저 없으면 손쓸 수 없다 — 검증에서 걸러진다
        return (o, h, l, c), False
    if o > 0 and h > 0 and l > 0:
        return (o, h, l, c), False
    return (c, c, c, c), True


def safe_volume(row) -> int:
    """거래량. 환율·일부 지수는 거래량이 없거나 NaN이다."""
    if "Volume" not in row.index:
        return 0
    v = row["Volume"]
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0
    if math.isnan(f) or math.isinf(f) or f < 0:
        return 0
    return int(f)


# --- 수집 ---


def fetch_one(entry, start: str):
    """
    종목 하나의 일봉을 받아온다.

    환율만 Yahoo를 쓰는 이유:
      FDR의 USD/KRW는 날짜가 하루 앞으로 밀려 기록된다. 금요일 종가가
      목요일 행에 들어가고 금요일 행은 아예 없으며, 대신 일요일 행이 생긴다.
      실측: FDR 08-06(목)=1422.30 인데 Yahoo 08-07(금)=1422.30 으로 동일.
      주식·지수는 FDR과 Yahoo가 정확히 일치해 FDR을 그대로 쓴다.
    """
    if entry.asset_type == "fx":
        df = yf.download(entry.yahoo, start=start, progress=False, auto_adjust=False)
        if df is not None and len(df) and hasattr(df.columns, "levels"):
            df.columns = [c[0] for c in df.columns]
        return df
    return fdr.DataReader(entry.fdr, start)


def fetch_frames(start: str) -> dict[str, object]:
    """종목별 일봉을 받아온다. 하나라도 실패하면 예외를 올린다."""
    frames = {}
    for entry in load_universe():
        df = fetch_one(entry, start)
        if df is None or len(df) == 0:
            raise ValidationError(f"{entry.id}({entry.name}) 응답이 비어 있습니다")

        missing = [c for c in ("Open", "High", "Low", "Close") if c not in df.columns]
        if missing:
            raise ValidationError(f"{entry.id} OHLC 컬럼 누락: {missing}")

        frames[entry.id] = df
        log(f"  {entry.id:<8} {entry.name:<18} {len(df):>4}행  최신 {df.index[-1].date()}")
    return frames


def build_market_payload(market: str, frames: dict) -> dict:
    """
    한 시장의 거래일 축을 만들고 종목별 OHLCV를 정렬한다.

    축은 그 시장 종목들의 **합집합**이다. 교집합을 쓰면 일부 종목의
    거래정지·신규상장 때문에 축 전체가 잘려나간다.
    특정 종목에 데이터가 없는 날은 null로 둔다 — 직전 값으로 채우면
    존재하지 않은 가격을 만들어내기 때문이다.
    """
    entries = [e for e in load_universe() if e.market == market]

    axis_set: set[str] = set()
    indexed: dict[str, dict] = {}

    for entry in entries:
        df = frames[entry.id]
        by_date = {}
        for ts, row in df.iterrows():
            # OHLC 중 하나라도 비어 있으면 그 날은 데이터가 없는 것으로 본다.
            # 이 행을 걸러야 축에도 들어가지 않는다 — 안 그러면 모든 종목이
            # null인 빈 날이 축에 생겨 차트에 구멍이 난다.
            if any(is_missing(row[c]) for c in ("Open", "High", "Low", "Close")):
                continue
            by_date[ts.date().isoformat()] = row
        indexed[entry.id] = by_date

        # 축은 **주식 종목으로만** 만든다. 주식이 거래된 날이 곧 시장이 열린 날이다.
        #
        # 지수·환율을 축에 넣으면 안 되는 이유 (실측):
        #   - 환율은 24시간 거래라 주말에도 값이 있다 → KR 축이 282일→334일로 부풀었다
        #   - VIX는 지수 계산값이라 휴장일에도 값이 나온다 → 미국 메모리얼데이(2026-05-25)가
        #     축에 들어가 나머지 24종목이 전부 공백인 날이 생겼다
        if entry.asset_type == "stock":
            axis_set |= set(by_date.keys())

    if not axis_set:
        raise ValidationError(f"{market} 시장의 거래일이 없습니다")

    axis = sorted(axis_set)

    stocks = {}
    fixed_total = 0

    for entry in entries:
        by_date = indexed[entry.id]
        o, h, l, c, v = [], [], [], [], []
        fixed = 0
        close_only = 0

        for day in axis:
            row = by_date.get(day)
            if row is None:
                # 그 종목이 거래되지 않은 날 (상장 전, 거래정지 등)
                o.append(None)
                h.append(None)
                l.append(None)
                c.append(None)
                v.append(None)
                continue

            ro, rh, rl, rc = (num(row[k]) for k in ("Open", "High", "Low", "Close"))

            # OHLC가 0으로 비어 있으면 종가로 채운다 (FDR의 VIX 등)
            (ro, rh, rl, rc), used_close = close_only_fallback(ro, rh, rl, rc)
            if used_close:
                close_only += 1

            no, nh, nl, nc = normalize_ohlc(ro, rh, rl, rc)
            if (nh, nl) != (rh, rl):
                fixed += 1

            o.append(no)
            h.append(nh)
            l.append(nl)
            c.append(nc)
            v.append(safe_volume(row))

        if fixed:
            log(f"    {entry.id} OHLC 보정 {fixed}건")
            fixed_total += fixed
        if close_only:
            log(f"    {entry.id} 종가만 제공된 행 {close_only}건 — OHLC를 종가로 채웠습니다")

        stocks[entry.id] = {"o": o, "h": h, "l": l, "c": c, "v": v}

    return {"tradingDate": axis[-1], "dates": axis, "stocks": stocks}


# --- 검증 ---


def validate(payload: dict) -> None:
    """이상 데이터를 걸러낸다. 여기서 막지 못하면 화면에 잘못된 숫자가 나간다."""
    for market, data in payload["markets"].items():
        dates = data["dates"]
        limit = MAX_DAILY_CHANGE_PCT.get(market, 60.0)

        if len(dates) < MIN_TRADING_DAYS:
            raise ValidationError(f"{market} 거래일 부족: {len(dates)}일 < {MIN_TRADING_DAYS}일")
        if len(set(dates)) != len(dates):
            raise ValidationError(f"{market} 거래일에 중복이 있습니다")
        if dates != sorted(dates):
            raise ValidationError(f"{market} 거래일이 오름차순이 아닙니다")

        stale = (date.today() - date.fromisoformat(dates[-1])).days
        if stale > MAX_STALE_DAYS:
            raise ValidationError(f"{market} 최신 데이터가 {stale}일 전입니다")

        expected = {e.id for e in load_universe() if e.market == market}
        if set(data["stocks"].keys()) != expected:
            raise ValidationError(f"{market} 종목 목록이 유니버스와 다릅니다")

        n = len(dates)
        for sid, s in data["stocks"].items():
            for key in ("o", "h", "l", "c", "v"):
                if len(s[key]) != n:
                    raise ValidationError(f"{sid}.{key} 길이가 거래일 수와 다릅니다")

            valid_count = 0
            prev_close = None

            for i in range(n):
                o, h, l, c = s["o"][i], s["h"][i], s["l"][i], s["c"][i]

                if c is None:
                    prev_close = None  # 공백 구간 뒤에는 변동률을 계산하지 않는다
                    continue

                valid_count += 1

                if min(o, h, l, c) <= 0:
                    raise ValidationError(f"{sid} {dates[i]} 가격에 0 이하 값이 있습니다")
                if h < max(o, c) or l > min(o, c):
                    raise ValidationError(
                        f"{sid} {dates[i]} OHLC 관계가 깨졌습니다 (O{o} H{h} L{l} C{c})"
                    )

                if prev_close:
                    change = abs((c - prev_close) / prev_close * 100)
                    if change > limit:
                        raise ValidationError(
                            f"{sid} {dates[i]} 전일비 {change:.1f}% 변동 "
                            f"({prev_close} → {c}) — {market} 상한 {limit}% 초과"
                        )
                prev_close = c

            if valid_count < 20:
                raise ValidationError(f"{sid} 유효 데이터가 {valid_count}일뿐입니다")

        log(f"  {market}: {len(dates)}거래일 × {len(data['stocks'])}종목, 최신 {dates[-1]}")


# --- 기록 ---


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    path.write_text(text + "\n", encoding="utf-8")
    log(f"  {path.name}  {len(text):,} bytes")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="기록하지 않고 검증만 수행")
    args = parser.parse_args()

    start = (date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()

    try:
        log(f"[1/3] 일봉 수집 (since {start})")
        frames = fetch_frames(start)

        log("[2/3] 시장별 축 정렬")
        payload = {
            "collectedAt": datetime.now(KST).isoformat(timespec="seconds"),
            "markets": {m: build_market_payload(m, frames) for m in markets()},
        }

        log("[3/3] 검증")
        validate(payload)

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
    write_json(DATA_DIR / "prices.json", payload)
    write_json(DATA_DIR / "stocks.json", stock_meta())

    latest = {m: d["tradingDate"] for m, d in payload["markets"].items()}
    log(f"\n완료 — 기준일 {latest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
