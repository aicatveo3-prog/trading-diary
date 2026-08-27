#!/usr/bin/env python3
"""
뉴스 수집 — Google News RSS

GitHub Actions에서 매 영업일 장마감 후 실행되어 src/data/news.json 을 갱신한다.
API 키가 필요 없다 — Google News는 RSS를 공개 URL로 제공한다.

핵심 원칙:
  - 제목만 수집한다. 본문은 가져오지 않는다 (저작권 회피 + 용량 절약).
  - 원문 링크를 항상 포함해 사용자가 직접 읽을 수 있게 한다.
  - 감성 분석은 키워드 기반으로 한다 (OpenAI 키 없이도 동작).

사용법:
    python scripts/collect_news.py            # 수집 후 기록
    python scripts/collect_news.py --dry-run  # 기록하지 않고 확인만
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

# --- 설정 ---

TARGETS = [
    {"ticker": "005930", "name": "삼성전자"},
    {"ticker": "000660", "name": "SK하이닉스"},
    {"ticker": "035720", "name": "카카오"},
    {"ticker": "035420", "name": "NAVER"},
    {"ticker": "247540", "name": "에코프로비엠"},
    {"ticker": "012450", "name": "한화에어로스페이스"},
]

# 종목당 가져올 최대 기사 수 (Google News RSS는 최대 ~100건 반환)
MAX_PER_STOCK = 30

# 며칠 이내 기사만 유지할지 (오래된 기사는 차트 기간을 벗어남)
MAX_AGE_DAYS = 90

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

KST = timezone(timedelta(hours=9))

# --- 감성 분석 (키워드 기반) ---

POSITIVE_KEYWORDS = [
    "상승", "급등", "신고가", "호실적", "순매수", "상향", "성장",
    "수혜", "흑자", "돌파", "최대", "호조", "회복", "개선",
    "수주", "계약", "인수", "승인", "허가", "랠리", "강세",
    "목표주가 상향", "컨센서스 상회", "어닝서프라이즈",
]

NEGATIVE_KEYWORDS = [
    "하락", "급락", "폭락", "적자", "순매도", "하향", "감소",
    "우려", "리스크", "악화", "부진", "손실", "위기", "규제",
    "조사", "기소", "하한가", "유증", "감자", "약세", "매도",
    "목표주가 하향", "컨센서스 하회", "어닝쇼크", "반토막",
]


def analyze_sentiment(title: str) -> dict:
    """제목에서 키워드를 찾아 감성을 판정한다."""
    score = 0.0
    for kw in POSITIVE_KEYWORDS:
        if kw in title:
            score += 0.3
    for kw in NEGATIVE_KEYWORDS:
        if kw in title:
            score -= 0.3

    score = max(-1.0, min(1.0, score))

    if score > 0.15:
        label = "positive"
    elif score < -0.15:
        label = "negative"
    else:
        label = "neutral"

    return {"score": round(score, 2), "label": label}


# --- HTML 정제 ---

def clean_title(raw: str) -> str:
    """Google News RSS 제목에서 ' - 언론사명' 접미사를 제거한다."""
    # "헤드라인 내용 - 한국경제" → "헤드라인 내용"
    parts = raw.rsplit(" - ", 1)
    return parts[0].strip() if len(parts) == 2 else raw.strip()


def extract_source(item) -> str:
    """<source> 태그가 있으면 그걸 쓰고, 없으면 제목에서 추출한다."""
    source_el = item.find("source")
    if source_el is not None and source_el.text:
        return source_el.text.strip()
    # 제목 끝의 " - 언론사" 패턴
    raw = item.find("title").text or ""
    parts = raw.rsplit(" - ", 1)
    return parts[1].strip() if len(parts) == 2 else "기타"


# --- 수집 ---

def fetch_news_for_stock(name: str) -> list[dict]:
    """종목명으로 Google News RSS를 검색해 기사 목록을 반환한다."""
    query = urllib.parse.quote(f"{name} 주가")
    url = f"https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko"

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; StockPulse/1.0)"})
    resp = urllib.request.urlopen(req, timeout=20)
    xml_data = resp.read().decode("utf-8")
    root = ET.fromstring(xml_data)

    items = root.findall(".//item")
    results = []

    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)

    for item in items[:MAX_PER_STOCK]:
        title_raw = item.find("title").text or ""
        link = item.find("link").text or ""
        pub_date_str = item.find("pubDate").text or ""

        # 날짜 파싱
        try:
            pub_date = parsedate_to_datetime(pub_date_str)
        except Exception:
            continue

        # 너무 오래된 기사 제외
        if pub_date < cutoff:
            continue

        title = clean_title(title_raw)
        source = extract_source(item)
        sentiment = analyze_sentiment(title)

        # 고유 ID: URL 해시 (중복 방지)
        news_id = hashlib.md5(link.encode()).hexdigest()[:12]

        results.append({
            "id": news_id,
            "title": title,
            "source": source,
            "url": link,
            "publishedAt": pub_date.isoformat(timespec="seconds"),
            "sentiment": sentiment["label"],
            "sentimentScore": sentiment["score"],
        })

    return results


def log(msg: str) -> None:
    print(msg, flush=True)


# --- 메인 ---

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="기록하지 않고 확인만")
    args = parser.parse_args()

    log("[1/3] Google News RSS 수집")
    all_news: dict[str, list[dict]] = {}

    for t in TARGETS:
        ticker = t["ticker"]
        name = t["name"]
        try:
            articles = fetch_news_for_stock(name)
            all_news[ticker] = articles
            pos = sum(1 for a in articles if a["sentiment"] == "positive")
            neg = sum(1 for a in articles if a["sentiment"] == "negative")
            log(f"  {ticker} {name:<12} {len(articles):>3}건  (긍정 {pos} / 부정 {neg} / 중립 {len(articles)-pos-neg})")
        except Exception as e:
            log(f"  {ticker} {name:<12}  실패: {e}")
            all_news[ticker] = []

        # Rate limit 대응
        time.sleep(1)

    log("[2/3] 검증")
    total = sum(len(v) for v in all_news.values())
    if total == 0:
        log("  경고: 수집된 뉴스가 0건입니다. 네트워크 문제일 수 있습니다.")
        return 1

    # 최소 3종목 이상에서 뉴스가 있어야 정상으로 본다
    stocks_with_news = sum(1 for v in all_news.values() if len(v) > 0)
    if stocks_with_news < 3:
        log(f"  경고: {stocks_with_news}종목에서만 뉴스가 수집됐습니다. 비정상.")
        return 1

    log(f"  통과: {total}건 ({stocks_with_news}종목)")

    if args.dry_run:
        log("\n--dry-run: 기록을 건너뜁니다")
        return 0

    log("[3/3] 기록")
    payload = {
        "collectedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "stocks": all_news,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "news.json"
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    path.write_text(text + "\n", encoding="utf-8")
    log(f"  {path.relative_to(path.parent.parent.parent)}  {len(text):,} bytes  ({total}건)")

    log(f"\n완료 — {total}건 수집")
    return 0


if __name__ == "__main__":
    sys.exit(main())
