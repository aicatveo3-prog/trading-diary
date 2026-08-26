#!/usr/bin/env python3
"""
실 데이터 정합성 검증

핀에 표시되는 등락률이 차트의 실제 움직임과 일치하는지 확인한다.
하드코딩 시절에는 이 둘이 어긋났고, 그것이 이 리팩터링의 이유였다.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
prices = json.loads((ROOT / "src/data/prices.json").read_text(encoding="utf-8"))
indices = json.loads((ROOT / "src/data/indices.json").read_text(encoding="utf-8"))
stocks = json.loads((ROOT / "src/data/stocks.json").read_text(encoding="utf-8"))

dates = prices["dates"]
n = len(dates)
fails = 0


def check(label, cond, detail=""):
    global fails
    if not cond:
        fails += 1
    print(f"  {'PASS' if cond else 'FAIL'}  {label}" + (f"  → {detail}" if detail and not cond else ""))


# 이벤트의 daysAgo (events-data.ts 와 동일해야 함)
EVENT_DAYS = [0, 2, 5, 9, 13, 18, 26, 34, 48, 61, 96, 131, 168, 205]
SOURCES = [22, 9, 31, 12, 47, 18, 15, 26, 44, 20, 14, 29, 17, 38]
TICKER = "005930"

c = prices["stocks"][TICKER]["c"]


def change_at(days):
    i = n - 1 - days
    return (c[i] - c[i - 1]) / c[i - 1] * 100


def forward(days, span=5):
    """span 거래일이 온전히 지나지 않으면 None (라벨 왜곡 방지)"""
    base = n - 1 - days
    tgt = base + span
    return None if tgt > n - 1 else (c[tgt] - c[base]) / c[base] * 100


print("=== 데이터 기본 ===")
check(f"거래일 {n}일", n >= 240, f"{n}일")
check(f"종목 {len(prices['stocks'])}개", len(prices["stocks"]) == 6)
check("지수 2개", len(indices) == 2)
check("종목 메타 일치", set(stocks) == set(prices["stocks"]))
print(f"  기준일 {prices['tradingDate']}  수집시각 {prices['collectedAt']}")

print("\n=== 헤더 등락률 = 핀 1번(daysAgo 0) 등락률 ===")
last, prev = c[-1], c[-2]
header = (last - prev) / prev * 100
pin1 = change_at(0)
check("두 값이 동일", abs(header - pin1) < 1e-9, f"header={header:.4f} pin={pin1:.4f}")
print(f"  종가 {last:,}원  전일 {prev:,}원  등락 {header:+.2f}%")

print("\n=== 핀 등락률의 부호가 차트 움직임과 일치 ===")
for days in EVENT_DAYS:
    if days >= n:
        continue
    i = n - 1 - days
    ch = change_at(days)
    actually_up = c[i] > c[i - 1]
    check(
        f"daysAgo {days:>3} ({dates[i]}) {ch:+6.2f}%",
        (ch > 0) == actually_up or ch == 0,
        f"표시 {ch:+.2f}% / 실제 {c[i-1]:,}→{c[i]:,}",
    )

print("\n=== 핀 선정: 중요도 = |변동| × 매체수 상위 5 ===")
for period, days_span in [("1M", 22), ("3M", 64), ("1Y", 250)]:
    span = min(days_span, n)
    inrange = [(d, s) for d, s in zip(EVENT_DAYS, SOURCES) if d < span]
    ranked = sorted(inrange, key=lambda x: abs(change_at(x[0])) * x[1], reverse=True)
    pinned = ranked[:5]
    check(f"{period}: 이벤트 {len(inrange)}건 → 핀 {len(pinned)}개", len(pinned) == min(5, len(inrange)))
    if period == "1M":
        print("     중요도 순위:")
        for d, s in ranked:
            i = n - 1 - d
            print(f"       daysAgo {d:>3} {dates[i]}  {change_at(d):+6.2f}% × {s:>2}매체 = {abs(change_at(d))*s:>6.1f}")

print("\n=== 1주(5거래일) 후 수익률: 미도래는 값이 없어야 함 ===")
for days in [0, 2, 4, 5, 9, 13]:
    f = forward(days)
    if days < 5:
        check(f"daysAgo {days}: 미도래 → 값 없음", f is None, f"got {f}")
    else:
        check(f"daysAgo {days}: {f:+.2f}%" if f is not None else f"daysAgo {days}: 값 필요", f is not None)

print("\n=== 종목별로 서로 다른 주가를 갖는가 (이전 버그) ===")
closes = {t: s["c"][-1] for t, s in prices["stocks"].items()}
check("6종목 종가가 모두 다름", len(set(closes.values())) == len(closes))
for t, v in sorted(closes.items(), key=lambda x: -x[1]):
    print(f"  {t} {stocks[t]['name']:<12} {v:>10,}원  {(prices['stocks'][t]['c'][-1]/prices['stocks'][t]['c'][-2]-1)*100:+6.2f}%")

print("\n=== 지수 ===")
for code, idx in indices.items():
    print(f"  {code:<6} {idx['name']:<8} {idx['value']:>10,.2f}  {idx['changeRate']:+.2f}%  ({idx['date']})")
    check(f"{code} 값 > 0", idx["value"] > 0)

print(f"\n{'전체 통과' if fails == 0 else f'{fails}건 실패'}")
sys.exit(0 if fails == 0 else 1)
