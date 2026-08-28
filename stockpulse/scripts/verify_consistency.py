#!/usr/bin/env python3
"""
실 데이터 정합성 검증

수집기가 만든 파일이 화면에서 쓸 수 있는 상태인지 확인한다.

두 등급을 구분한다:

  FAIL — 데이터가 깨졌다. 종료 코드 1로 워크플로가 커밋을 중단한다.
         잘못된 데이터를 배포하는 것보다 낡은 데이터를 유지하는 편이 낫다.

  WARN — 데이터는 유효하지만 낡았다. 종료 코드는 0이다.
         신선도로 커밋을 막으면 안 된다. 설날·추석에 한국 시장이 며칠 쉬면
         정상인데도 실패로 잡혀 거짓 경보가 되고, 그게 반복되면 진짜 실패
         알림까지 무시하게 된다. 대신 실행 페이지 요약에 남겨 눈에 띄게 한다.

검증 대상:
  1. prices.json  — 시장별 축, 배열 길이, OHLC 관계, 종목 중복
  2. stocks.json  — universe와 일치
  3. public/minutes/ — 종목별 분봉 파일 존재·구조
  4. news.json    — 구조, 유니버스 일치
  5. 신선도       — 수집이 조용히 멈췄는지 (exit 0으로 위장한 정지 탐지)
"""

import glob
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
prices = json.loads((ROOT / "src/data/prices.json").read_text(encoding="utf-8"))
stocks = json.loads((ROOT / "src/data/stocks.json").read_text(encoding="utf-8"))
universe = json.loads((ROOT / "src/data/universe.json").read_text(encoding="utf-8"))

KST = timezone(timedelta(hours=9))

fails = 0
warnings: list[str] = []


def check(label, cond, detail=""):
    global fails
    if not cond:
        fails += 1
    mark = "PASS" if cond else "FAIL"
    suffix = f"  → {detail}" if detail and not cond else ""
    print(f"  {mark}  {label}{suffix}")


def warn(label, cond, detail=""):
    """조건이 False면 경고. 종료 코드에 영향을 주지 않는다."""
    if cond:
        print(f"  PASS  {label}")
        return
    warnings.append(f"{label} — {detail}" if detail else label)
    print(f"  WARN  {label}" + (f"  → {detail}" if detail else ""))


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
    # 5분봉만 수집한다 (30분봉은 화면에서 5분봉을 묶어 만든다).
    expected_files = {f"{sid}_5m" for sid in universe_ids}
    found = {Path(p).stem for p in minute_files}
    check(f"파일 {len(expected_files)}개 (30종목 × 5분봉)", found == expected_files,
          f"누락 {sorted(expected_files - found)[:4]} / 초과 {sorted(found - expected_files)[:4]}")

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

# --- 8. 신선도 — 조용한 정지 탐지 ---
#
# 수집이 멈추면 스크립트는 여전히 exit 0을 반환한다. 파일이 유효하기 때문이다.
# 실패 알림은 '실행됐고 실패했을 때'만 발동하므로, 스케줄이 아예 안 도는
# 경우를 잡지 못한다. 여기서 데이터의 나이를 재서 그 상황을 드러낸다.
#
# 임계값을 영업일로 세는 이유: 월요일에는 금요일 데이터가 최신인 것이 정상이다.
# 달력일로 재면 매주 월요일마다 거짓 경보가 난다.


def business_days_between(older: date, newer: date) -> int:
    """두 날짜 사이의 영업일 수 (주말 제외). 공휴일은 세지 못한다."""
    if older >= newer:
        return 0
    days = 0
    cursor = older
    while cursor < newer:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:  # 월(0)~금(4)
            days += 1
    return days


print("\n=== 신선도 (조용한 정지 탐지) ===")

now_kst = datetime.now(KST)
today = now_kst.date()

# 주가 기준일.
#
# 임계값 근거:
#   정상    KR 0일 (장마감 후 수집), US 1일 (미국 장마감이 06:00 KST라 하루 늦다)
#   연휴    설날·추석에 최대 3~4영업일까지 벌어진다
#   WARN 4  연휴를 넘어서는 지연
#   FAIL 8  설날에도 도달하지 않는 값 — 명백한 정지
STALE_WARN_DAYS = 4
STALE_FAIL_DAYS = 8

for market in ("KR", "US"):
    trading_date = date.fromisoformat(prices["markets"][market]["tradingDate"])
    age = business_days_between(trading_date, today)

    warn(
        f"{market} 주가 기준일 {trading_date} (영업일 {age}일 전)",
        age <= STALE_WARN_DAYS,
        f"{age}영업일 지연 — 수집이 멈췄을 수 있습니다",
    )
    check(
        f"{market} 주가가 심각하게 낡지 않음 (< {STALE_FAIL_DAYS}영업일)",
        age < STALE_FAIL_DAYS,
        f"{age}영업일 지연 — 파이프라인이 정지한 것으로 판단합니다",
    )

# 수집 시각. 파일이 실제로 다시 쓰였는지를 본다.
#
# tradingDate와 다른 것을 잡는다: 휴장일에는 tradingDate가 안 바뀌어도
# collectedAt은 갱신돼야 정상이다. 이 값이 며칠째 그대로면 워크플로가
# 아예 돌지 않았다는 뜻이다.
COLLECTED_WARN_HOURS = 48
COLLECTED_FAIL_HOURS = 24 * 10

sources = [("prices.json", prices.get("collectedAt"))]
if news_path.exists():
    sources.append(("news.json", news.get("collectedAt")))
if minute_files:
    first_minute = json.loads(Path(minute_files[0]).read_text(encoding="utf-8"))
    sources.append(("public/minutes/", first_minute.get("collectedAt")))

for name, stamp in sources:
    if not stamp:
        check(f"{name} collectedAt 존재", False, "필드가 없습니다")
        continue

    collected = datetime.fromisoformat(stamp)
    hours = (now_kst - collected).total_seconds() / 3600

    warn(
        f"{name} 수집 {hours:.0f}시간 전",
        hours <= COLLECTED_WARN_HOURS,
        f"{hours / 24:.1f}일간 갱신되지 않았습니다",
    )
    check(
        f"{name} 수집이 심각하게 낡지 않음 (< {COLLECTED_FAIL_HOURS // 24}일)",
        hours < COLLECTED_FAIL_HOURS,
        f"{hours / 24:.1f}일 경과 — 파이프라인이 정지한 것으로 판단합니다",
    )

# 뉴스 최신 기사.
#
# 누적 저장이라 총 건수는 줄지 않는다. 그래서 '건수'로는 정지를 알 수 없고,
# 가장 최근 기사의 발행 시각을 봐야 한다. RSS가 막히면 이 값이 멈춘다.
if news_path.exists():
    all_articles = [a for v in news["stocks"].values() for a in v]
    if all_articles:
        newest = max(a["publishedAt"] for a in all_articles)
        newest_dt = datetime.fromisoformat(newest).astimezone(KST)
        age_days = (now_kst - newest_dt).total_seconds() / 86400
        warn(
            f"뉴스 최신 기사 {newest_dt.strftime('%Y-%m-%d %H:%M')} ({age_days:.1f}일 전)",
            age_days <= 4,
            f"{age_days:.1f}일간 새 기사가 없습니다 — RSS 수집을 확인하세요",
        )

# --- 결과 ---

print()
if fails:
    print(f"{fails}건 실패" + (f", {len(warnings)}건 경고" if warnings else ""))
elif warnings:
    print(f"전체 통과 ({len(warnings)}건 경고)")
else:
    print("전체 통과")

# GitHub Actions 실행 페이지에 경고를 남긴다.
# 경고는 커밋을 막지 않으므로, 로그에만 있으면 아무도 보지 않는다.
summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
if summary_path and warnings:
    with open(summary_path, "a", encoding="utf-8") as f:
        f.write("### ⚠️ 데이터 신선도 경고\n\n")
        for w in warnings:
            f.write(f"- {w}\n")
        f.write(
            "\n데이터는 유효하지만 낡았습니다. 커밋은 계속 진행됩니다.\n"
            "연휴가 아니라면 수집 파이프라인을 확인하세요.\n"
        )

# Actions 로그에 경고 주석을 남겨 실행 목록에서도 보이게 한다
if os.environ.get("GITHUB_ACTIONS"):
    for w in warnings:
        print(f"::warning title=데이터 신선도::{w}")

sys.exit(0 if fails == 0 else 1)
