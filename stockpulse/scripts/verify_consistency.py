#!/usr/bin/env python3
"""
실 데이터 정합성 검증

수집기가 만든 파일이 화면에서 쓸 수 있는 상태인지 확인한다.
검증 실패 시 종료 코드 1 — 워크플로가 커밋을 중단한다.
잘못된 데이터를 배포하는 것보다 낡은 데이터를 유지하는 편이 낫다.

검증 대상:
  1. prices.json  — 시장별 축, 배열 길이, OHLC 관계, 종목 중복
  2. stocks.json  — universe와 일치
  3. public/minutes/ — 종목별 분봉 파일 존재·구조
  4. news.json    — 구조
"""

import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
prices = json.loads((ROOT / "src/data/prices.json").read_text(encoding="utf-8"))
stocks = json.loads((ROOT / "src/data/stocks.json").read_text(encoding="utf-8"))
universe = json.loads((ROOT / "src/data/universe.json").read_text(encoding="utf-8"))

fails = 0


def check(label, cond, detail=""):
    global fails
    if not cond:
        fails += 1
    mark = "PASS" if cond else "FAIL"
    suffix = f"  → {detail}" if detail and not cond else ""
    print(f"  {mark}  {label}{suffix}")


universe_ids = {e["id"] for e in universe["stocks"]}
entry_by_id = {e["id"]: e for e in universe["stocks"]}

# --- 1. 시장별 축 ---

print("=== 시장별 거래일 축 ===")
check("markets 키 존재", set(prices["markets"]) == {"KR", "US"}, str(set(prices["markets"])))

axis = {}
for market, block in prices["markets"].items():
    dates = block["dates"]
    axis[market] = dates
    check(
        f"{market} 거래일 {len(dates)}일",
        len(dates) >= 200,
        f"{len(dates)}일 — 너무 적다",
    )
    check(f"{market} 날짜 정렬·중복 없음", dates == sorted(set(dates)), "정렬 또는 중복 문제")
    check(f"{market} tradingDate = 마지막 날짜", block["tradingDate"] == dates[-1],
          f"{block['tradingDate']} vs {dates[-1]}")
    print(f"       {market}: {dates[0]} ~ {dates[-1]}  기준일 {block['tradingDate']}")

# --- 2. 종목 커버리지 ---

print("\n=== 종목 커버리지 ===")
all_price_ids = set()
for market, block in prices["markets"].items():
    all_price_ids |= set(block["stocks"])

check(f"universe {len(universe_ids)}종목 = prices {len(all_price_ids)}종목",
      universe_ids == all_price_ids,
      f"누락 {universe_ids - all_price_ids} / 초과 {all_price_ids - universe_ids}")
check("stocks.json이 universe와 일치", set(stocks) == universe_ids,
      f"차이 {set(stocks) ^ universe_ids}")

# 종목이 자기 시장에 들어 있는지
for sid, meta in stocks.items():
    market = meta["market"]
    in_right_market = sid in prices["markets"][market]["stocks"]
    if not in_right_market:
        check(f"{sid} 이 {market} 축에 존재", False, f"{market}에 없다")

# --- 3. 배열 길이와 값 ---

print("\n=== 시계열 무결성 ===")
for market, block in prices["markets"].items():
    expected = len(block["dates"])
    bad_len = []
    bad_ohlc = []
    bad_value = []

    for sid, s in block["stocks"].items():
        for field in ("o", "h", "l", "c", "v"):
            if len(s[field]) != expected:
                bad_len.append(f"{sid}.{field}={len(s[field])}")

        for i in range(len(s["c"])):
            o, h, l, c = s["o"][i], s["h"][i], s["l"][i], s["c"][i]
            if c <= 0 or o <= 0:
                bad_value.append(f"{sid}[{i}]")
                break
            if h < max(o, c) or l > min(o, c):
                bad_ohlc.append(f"{sid} {block['dates'][i]} O{o} H{h} L{l} C{c}")
                break

    check(f"{market} 배열 길이 = 거래일 {expected}", not bad_len, ", ".join(bad_len[:3]))
    check(f"{market} 가격 > 0", not bad_value, ", ".join(bad_value[:3]))
    check(f"{market} OHLC 관계 정상", not bad_ohlc, "; ".join(bad_ohlc[:2]))

# --- 4. 종목별 종가가 서로 다른가 (과거 버그) ---

print("\n=== 종목별 종가 구분 (과거 버그 재발 감시) ===")
for market, block in prices["markets"].items():
    closes = {sid: s["c"][-1] for sid, s in block["stocks"].items()}
    unique = len(set(closes.values()))
    check(f"{market} {len(closes)}종목 종가가 서로 다름", unique == len(closes),
          f"중복 있음 ({unique}/{len(closes)})")

# --- 5. 최신 시세 출력 (사람이 눈으로 확인) ---

print("\n=== 최신 시세 ===")
for market in ("KR", "US"):
    block = prices["markets"][market]
    print(f"  [{market}] {block['tradingDate']}")
    rows = []
    for sid, s in block["stocks"].items():
        last, prev = s["c"][-1], s["c"][-2]
        change = (last / prev - 1) * 100 if prev else 0
        rows.append((abs(change), sid, last, change))
    for _, sid, last, change in sorted(rows, reverse=True):
        entry = entry_by_id[sid]
        cur = "" if entry["type"] == "index" else ("$" if entry["currency"] == "USD" else "원")
        name = entry["name"]
        print(f"       {sid:<8} {name:<16} {last:>12,.2f}{cur:<2} {change:+6.2f}%")

# --- 6. 분봉 파일 ---

print("\n=== 분봉 파일 (public/minutes/) ===")
minute_files = sorted(glob.glob(str(ROOT / "public/minutes/*.json")))
check("분봉 파일 존재", len(minute_files) > 0, "public/minutes/ 가 비어 있다")

if minute_files:
    expected_files = {f"{sid}_{iv}" for sid in universe_ids for iv in ("5m", "1h")}
    found = {Path(p).stem for p in minute_files}
    check(f"파일 {len(expected_files)}개 (30종목 × 2간격)", found == expected_files,
          f"누락 {sorted(expected_files - found)[:4]}")

    total_bars = 0
    bad_struct = []
    for path in minute_files:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        name = Path(path).stem
        if "days" not in data or not data["days"]:
            bad_struct.append(f"{name}: days 없음")
            continue
        for date_key, bar in data["days"].items():
            n = len(bar["t"])
            total_bars += n
            if any(len(bar[f]) != n for f in ("s", "o", "h", "l", "c", "v")):
                bad_struct.append(f"{name} {date_key}: 길이 불일치")
                break
            if bar["t"] != sorted(bar["t"]):
                bad_struct.append(f"{name} {date_key}: 시각 미정렬")
                break

    check("분봉 구조 정상", not bad_struct, "; ".join(bad_struct[:3]))
    total_bytes = sum(Path(p).stat().st_size for p in minute_files)
    print(f"       {len(minute_files)}파일 · 바 {total_bars:,}개 · {total_bytes:,} bytes")
    print(f"       종목당 평균 {total_bytes // max(1, len(minute_files)):,} bytes")

# --- 7. 뉴스 ---

news_path = ROOT / "src/data/news.json"
if news_path.exists():
    print("\n=== 뉴스 ===")
    news = json.loads(news_path.read_text(encoding="utf-8"))
    per_stock = {k: len(v) for k, v in news["stocks"].items()}
    total = sum(per_stock.values())
    check("기사 존재", total > 0, "0건")
    covered = sum(1 for v in per_stock.values() if v > 0)
    print(f"       기사 {total}건 · 뉴스 있는 종목 {covered}/{len(universe_ids)}")
    unknown = set(news["stocks"]) - universe_ids
    check("뉴스 종목이 universe 안에 있음", not unknown, f"미등록 {sorted(unknown)[:4]}")

print(f"\n{'전체 통과' if fails == 0 else f'{fails}건 실패'}")
sys.exit(0 if fails == 0 else 1)
