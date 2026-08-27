#!/usr/bin/env python3
"""
뉴스 핀 매핑 검증

news-pins.ts 의 로직을 재현해 핀이 올바른 거래일에 꽂히는지 확인한다.
특히 주말·휴일 이월과 미래 뉴스 분리가 제대로 되는지 본다.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
prices = json.loads((ROOT / "src/data/prices.json").read_text(encoding="utf-8"))
news = json.loads((ROOT / "src/data/news.json").read_text(encoding="utf-8"))
stocks = json.loads((ROOT / "src/data/stocks.json").read_text(encoding="utf-8"))

dates = prices["dates"]
n = len(dates)
MAX_PINS = 5
fails = 0


def check(label, cond, detail=""):
    global fails
    if not cond:
        fails += 1
    print(f"  {'PASS' if cond else 'FAIL'}  {label}" + (f"  → {detail}" if detail and not cond else ""))


def next_trading_index(date_str):
    """date_str 이상인 첫 거래일 인덱스. 없으면 None."""
    for i, d in enumerate(dates):
        if d >= date_str:
            return i
    return None


def change_at(ticker, days_ago):
    c = prices["stocks"][ticker]["c"]
    i = len(c) - 1 - days_ago
    if i <= 0:
        return 0.0
    return (c[i] - c[i - 1]) / c[i - 1] * 100


def build_pins(ticker, period_days, max_pins=MAX_PINS):
    articles = news["stocks"].get(ticker, [])
    by_idx = defaultdict(list)
    pending = []

    for a in articles:
        pub = a["publishedAt"][:10]
        idx = next_trading_index(pub)
        if idx is None:
            pending.append(a)
        else:
            by_idx[idx].append(a)

    groups = []
    for idx, arts in by_idx.items():
        days_ago = n - 1 - idx
        if days_ago >= period_days:
            continue
        groups.append({
            "daysAgo": days_ago,
            "tradingDate": dates[idx],
            "articles": arts,
            "changeRate": change_at(ticker, days_ago),
        })

    groups.sort(key=lambda g: g["daysAgo"])
    for i, g in enumerate(groups):
        g["number"] = i + 1

    pins = sorted(groups, key=lambda g: len(g["articles"]) * (abs(g["changeRate"]) + 1), reverse=True)[:max_pins]
    return pins, groups, pending


print(f"=== 기본 ===")
print(f"  거래일 축 {n}일 ({dates[0]} ~ {dates[-1]})")
print(f"  종목 {len(stocks)}개")

print(f"\n=== 주말·휴일 뉴스가 다음 거래일로 이월되는가 ===")
# 8/22(토) → 8/24(월) 확인
sat_idx = next_trading_index("2026-08-22")
check("2026-08-22(토) → 다음 거래일", dates[sat_idx] == "2026-08-24", f"got {dates[sat_idx]}")
# 8/15(광복절) 확인
hol_idx = next_trading_index("2026-08-15")
check(f"2026-08-15(공휴일) → {dates[hol_idx]}", dates[hol_idx] > "2026-08-15", f"got {dates[hol_idx]}")
# 거래일 자체는 그대로
same_idx = next_trading_index("2026-08-26")
check("2026-08-26(거래일) → 자기 자신", dates[same_idx] == "2026-08-26", f"got {dates[same_idx]}")

print(f"\n=== 주가 축보다 최신인 뉴스는 pending으로 분리되는가 ===")
future = next_trading_index("2026-08-27")
check("2026-08-27 → 매핑 불가(None)", future is None, f"got {future}")

print(f"\n=== 종목별 핀 선정 (1M = 22거래일) ===")
for ticker in sorted(prices["stocks"].keys()):
    name = stocks[ticker]["name"]
    pins, groups, pending = build_pins(ticker, 22)
    total_arts = sum(len(g["articles"]) for g in groups)
    print(f"\n  [{ticker}] {name}")
    print(f"    뉴스 난 날 {len(groups)}일 · 기사 {total_arts}건 · 핀 {len(pins)}개 · 미반영 {len(pending)}건")
    check(f"    핀 개수 <= {MAX_PINS}", len(pins) <= MAX_PINS)
    check(f"    번호가 1부터 연속", [g["number"] for g in groups] == list(range(1, len(groups) + 1)))

    # 중요도 순위 표시
    ranked = sorted(groups, key=lambda g: len(g["articles"]) * (abs(g["changeRate"]) + 1), reverse=True)
    for g in ranked[:6]:
        is_pin = "핀" if g in pins else "  "
        imp = len(g["articles"]) * (abs(g["changeRate"]) + 1)
        print(f"      {is_pin} {g['tradingDate']}  기사{len(g['articles']):>2}건 × ({abs(g['changeRate']):.2f}%+1) = {imp:>6.1f}  (번호 {g['number']})")

print(f"\n=== 핀 색이 실제 등락 방향과 일치하는가 ===")
for ticker in ["005930", "000660"]:
    pins, groups, _ = build_pins(ticker, 22)
    c = prices["stocks"][ticker]["c"]
    for p in pins:
        i = len(c) - 1 - p["daysAgo"]
        actually_up = c[i] > c[i - 1]
        shown_up = p["changeRate"] > 0
        check(
            f"  {ticker} {p['tradingDate']} {p['changeRate']:+.2f}%",
            shown_up == actually_up or p["changeRate"] == 0,
            f"표시 {p['changeRate']:+.2f}% / 실제 {c[i-1]:,}→{c[i]:,}",
        )

print(f"\n=== 핀 지름: 기사 건수에 비례, 32px 상한 ===")
def pin_diameter(count):
    return min(32, 18 + count * 1.4)

check("기사 1건 → 19.4px", abs(pin_diameter(1) - 19.4) < 0.01)
check("기사 10건 → 32px (상한)", pin_diameter(10) == 32)
check("기사 100건 → 32px (상한 유지)", pin_diameter(100) == 32)

print(f"\n=== 기간을 늘리면 그룹이 늘어나는가 ===")
for period, label in [(22, "1M"), (64, "3M"), (250, "1Y")]:
    pins, groups, _ = build_pins("005930", period)
    print(f"  {label} ({period}일): 그룹 {len(groups)}일, 핀 {len(pins)}개")

prev = 0
for period in [22, 64, 250]:
    _, groups, _ = build_pins("005930", period)
    check(f"  {period}일 그룹 수가 단조 증가", len(groups) >= prev, f"{len(groups)} < {prev}")
    prev = len(groups)

print(f"\n{'전체 통과' if fails == 0 else f'{fails}건 실패'}")
sys.exit(0 if fails == 0 else 1)
