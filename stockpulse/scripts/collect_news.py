#!/usr/bin/env python3
"""
뉴스 수집 — Google News RSS

GitHub Actions에서 매 영업일 장마감 후 실행되어 src/data/news.json 을 갱신한다.
API 키가 필요 없다 — Google News는 RSS를 공개 URL로 제공한다.

핵심 원칙:
  - 제목과 RSS 요약(description)을 수집한다. 본문은 가져오지 않는다 (저작권 회피 + 용량 절약).
  - 원문 링크를 항상 포함해 사용자가 직접 읽을 수 있게 한다.
  - 감성 분석은 키워드 기반으로 한다 (OpenAI 키 없이도 동작).
  - 같은 이야기를 다룬 기사는 대표 1건으로 묶고, 나머지는 related로 접는다.

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

# 종목 목록은 universe.json 단일 소스에서 읽는다.
# 하드코딩하면 종목을 바꿀 때 수집기와 화면이 어긋난다 (실제로 그랬다).
from universe import load_universe

# 종목당 가져올 최대 기사 수 (Google News RSS는 최대 ~100건 반환)
MAX_PER_STOCK = 100

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

def strip_html(html: str) -> str:
    """HTML 태그를 제거하고 텍스트만 남긴다. &amp; 등의 엔티티도 처리."""
    import html as html_mod
    text = re.sub(r"<[^>]+>", " ", html)
    text = html_mod.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_title(raw: str) -> str:
    """Google News RSS 제목에서 ' - 언론사명' 접미사를 제거한다."""
    # "헤드라인 내용 - 한국경제" → "헤드라인 내용"
    parts = raw.rsplit(" - ", 1)
    return parts[0].strip() if len(parts) == 2 else raw.strip()


def extract_description(item) -> str:
    """
    RSS <description> 태그에서 요약 텍스트를 추출한다.

    Google News RSS의 description은 HTML이 섞여 있다.
    HTML 태그를 제거하고 텍스트만 반환한다.
    비어 있거나 제목과 동일하면 빈 문자열을 반환한다.
    """
    desc_el = item.find("description")
    if desc_el is None or not desc_el.text:
        return ""
    raw = strip_html(desc_el.text)
    # 300자 초과 시 잘라낸다 — 용량 절약
    if len(raw) > 300:
        raw = raw[:297] + "…"
    return raw


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

def fetch_news_for_stock(search_query: str) -> list[dict]:
    """검색어로 Google News RSS를 검색해 기사 목록을 반환한다."""
    query = urllib.parse.quote(search_query)
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
        description = extract_description(item)
        sentiment = analyze_sentiment(title)

        # 고유 ID: URL 해시 (중복 방지)
        news_id = hashlib.md5(link.encode()).hexdigest()[:12]

        article: dict = {
            "id": news_id,
            "title": title,
            "source": source,
            "url": link,
            "publishedAt": pub_date.isoformat(timespec="seconds"),
            "sentiment": sentiment["label"],
            "sentimentScore": sentiment["score"],
        }
        if description:
            article["description"] = description

        results.append(article)

    return results


def log(msg: str) -> None:
    print(msg, flush=True)


# --- 누적 병합 ---

def load_existing() -> dict[str, list[dict]]:
    """
    기존 news.json을 읽어 종목별 기사 목록을 반환한다.

    Google News RSS는 '최근' 기사만 준다. 매번 덮어쓰면 과거 기사가 사라져
    커버리지가 낮게 유지된다 (실측: 282거래일 중 52일 = 18%).
    그래서 기존 기사에 새 기사를 병합해 쌓는다.
    """
    path = DATA_DIR / "news.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("stocks", {})
    except Exception as e:
        log(f"  경고: 기존 news.json을 읽을 수 없습니다 ({e}). 새로 시작합니다.")
        return {}


def merge_articles(old: list[dict], new: list[dict]) -> list[dict]:
    """
    기사를 병합한다. id(URL 해시)로 중복을 제거하고 발행일 역순으로 정렬한다.
    MAX_AGE_DAYS를 넘은 기사는 버린다 — 차트 기간을 벗어나면 쓸 곳이 없다.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    by_id: dict[str, dict] = {}

    # 새 기사를 나중에 넣어 최신 감성 분석 결과로 갱신되게 한다
    for article in old + new:
        try:
            published = datetime.fromisoformat(article["publishedAt"])
        except (ValueError, KeyError):
            continue
        if published < cutoff:
            continue
        by_id[article["id"]] = article

    return sorted(by_id.values(), key=lambda a: a["publishedAt"], reverse=True)


# --- 제목 유사도 기반 클러스터링 ---

# 클러스터링에서 무시할 토큰 (기사마다 반복되는 일반 단어)
_STOP_TOKENS = frozenset([
    "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to",
    "for", "of", "and", "or", "but", "vs", "이", "그", "저", "것", "수",
    "등", "약", "중", "때", "후", "전", "내", "외",
])

def _normalize_title(title: str) -> str:
    """클러스터링용 제목 정규화: 특수문자 제거, 소문자, 공백 통일."""
    t = re.sub(r"[^\w\s]", "", title)
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t


def _title_tokens(title: str) -> set[str]:
    """정규화된 제목에서 의미 있는 토큰 집합을 만든다."""
    tokens = set(_normalize_title(title).split())
    return tokens - _STOP_TOKENS


def _jaccard(a: set[str], b: set[str]) -> float:
    """두 토큰 집합의 Jaccard 유사도."""
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


# 이 임계값 이상이면 "같은 이야기"로 판정한다.
# 실측: 0.45면 "4대그룹 10억 주식부자" 같은 복붙 기사는 전부 잡히고,
#        "삼성전자 목표가 상향" vs "삼성전자 목표가 하향"은 잡히지 않는다.
CLUSTER_THRESHOLD = 0.45


def cluster_articles(articles: list[dict]) -> list[dict]:
    """
    같은 이야기를 다룬 기사를 클러스터링한다.

    같은 날(publishedAt 기준 날짜)에 제목 유사도가 CLUSTER_THRESHOLD 이상인
    기사들을 하나의 클러스터로 묶는다.

    대표 기사(가장 긴 제목 = 가장 상세한 헤드라인)에 related 배열을 붙인다.
    나머지 기사는 목록에서 제거된다.

    반환: 클러스터링 후 기사 목록 (대표 기사만, related 포함)
    """
    if len(articles) <= 1:
        return articles

    from collections import defaultdict

    # 날짜별로 그룹화 — 다른 날짜의 기사끼리는 묶지 않는다
    by_date: dict[str, list[dict]] = defaultdict(list)
    for a in articles:
        date_key = a["publishedAt"][:10]
        by_date[date_key].append(a)

    result: list[dict] = []

    for date_key, day_articles in by_date.items():
        if len(day_articles) <= 1:
            result.extend(day_articles)
            continue

        # 토큰 사전 계산
        tokens_map = {a["id"]: _title_tokens(a["title"]) for a in day_articles}

        # Union-Find로 클러스터링
        parent: dict[str, str] = {a["id"]: a["id"] for a in day_articles}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x: str, y: str) -> None:
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py

        # 쌍별 유사도 비교
        for i in range(len(day_articles)):
            for j in range(i + 1, len(day_articles)):
                ai, aj = day_articles[i], day_articles[j]
                sim = _jaccard(tokens_map[ai["id"]], tokens_map[aj["id"]])
                if sim >= CLUSTER_THRESHOLD:
                    union(ai["id"], aj["id"])

        # 클러스터별로 대표 기사 선정
        clusters: dict[str, list[dict]] = defaultdict(list)
        for a in day_articles:
            root = find(a["id"])
            clusters[root].append(a)

        for cluster in clusters.values():
            if len(cluster) == 1:
                result.append(cluster[0])
            else:
                # 대표 기사: 가장 긴 제목 (더 상세한 헤드라인)
                cluster.sort(key=lambda a: len(a["title"]), reverse=True)
                representative = {**cluster[0]}  # 복사
                # related: 나머지 기사의 요약 정보
                representative["related"] = [
                    {"id": a["id"], "title": a["title"], "source": a["source"], "url": a["url"]}
                    for a in cluster[1:]
                ]
                result.append(representative)

    # 발행일 역순 정렬 유지
    result.sort(key=lambda a: a["publishedAt"], reverse=True)
    return result


# --- 메인 ---

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="기록하지 않고 확인만")
    args = parser.parse_args()

    entries = load_universe()
    existing = load_existing()

    # universe에서 빠진 종목의 기사는 버린다 (종목 교체 시 옛 데이터가 남는 문제)
    valid_ids = {e.id for e in entries}
    dropped = set(existing) - valid_ids
    if dropped:
        log(f"[0/3] universe에 없는 종목 {len(dropped)}개의 뉴스를 제거합니다: {sorted(dropped)}")
        existing = {k: v for k, v in existing.items() if k in valid_ids}

    log(f"[1/4] Google News RSS 수집 ({len(entries)}종목)")
    all_news: dict[str, list[dict]] = {}
    new_count = 0

    for entry in entries:
        prior = existing.get(entry.id, [])
        try:
            fetched = fetch_news_for_stock(entry.news_query)
            merged = merge_articles(prior, fetched)
            added = len(merged) - len(prior)
            new_count += max(0, added)
            all_news[entry.id] = merged

            pos = sum(1 for a in merged if a["sentiment"] == "positive")
            neg = sum(1 for a in merged if a["sentiment"] == "negative")
            log(
                f"  {entry.id:<8} {entry.name:<16} 총 {len(merged):>3}건"
                f" (신규 +{added:<3})  긍정 {pos} / 부정 {neg} / 중립 {len(merged)-pos-neg}"
            )
        except Exception as e:
            # 실패해도 기존 기사는 유지한다 — 일시적 네트워크 오류로 데이터를 잃지 않는다
            all_news[entry.id] = merge_articles(prior, [])
            log(f"  {entry.id:<8} {entry.name:<16} 실패: {e} (기존 {len(prior)}건 유지)")

        # Rate limit 대응
        time.sleep(1)

    log("[2/4] 중복 기사 클러스터링")
    total_before = sum(len(v) for v in all_news.values())
    clustered_news: dict[str, list[dict]] = {}
    total_related = 0
    for stock_id, articles in all_news.items():
        clustered = cluster_articles(articles)
        clustered_news[stock_id] = clustered
        related_in_stock = sum(len(a.get("related", [])) for a in clustered)
        total_related += related_in_stock
    all_news = clustered_news
    total_after = sum(len(v) for v in all_news.values())
    log(f"  {total_before}건 → {total_after}건 (중복 {total_before - total_after}건을 '외 N건'으로 접음, related 총 {total_related}건)")

    log("[3/5] 원문 meta description 크롤링")
    from fetch_descriptions import fetch_description_for_article
    desc_added = 0
    desc_failed = 0
    desc_skipped = 0
    # 대표 기사 중 description이 없는 것만 크롤링한다
    targets = []
    for stock_id, articles in all_news.items():
        for a in articles:
            if not a.get("description"):
                targets.append(a)
            else:
                desc_skipped += 1
    log(f"  대상: {len(targets)}건 (이미 있음: {desc_skipped}건)")
    for i, article in enumerate(targets):
        try:
            desc = fetch_description_for_article(article["url"], timeout=8)
            if desc:
                article["description"] = desc
                desc_added += 1
            else:
                desc_failed += 1
        except Exception:
            desc_failed += 1
        # 진행 로그 — 100건마다
        if (i + 1) % 100 == 0:
            log(f"  ... {i+1}/{len(targets)} (성공 {desc_added}, 실패 {desc_failed})")
        # 원문 사이트에 부담을 주지 않기 위한 간격
        time.sleep(0.3)
    log(f"  완료: 성공 {desc_added}건, 실패 {desc_failed}건")

    log("[4/5] 검증")
    total = sum(len(v) for v in all_news.values())
    if total == 0:
        log("  경고: 기사가 0건입니다. 네트워크 문제일 수 있습니다.")
        return 1

    stocks_with_news = sum(1 for v in all_news.values() if len(v) > 0)
    if stocks_with_news < 3:
        log(f"  경고: {stocks_with_news}종목에서만 뉴스가 수집됐습니다. 비정상.")
        return 1

    # 기존보다 줄어들면 뭔가 잘못된 것이다 (병합 로직 버그 등)
    # 클러스터링 전 기준으로 비교한다 — 클러스터링으로 줄어드는 것은 정상
    prior_total = sum(len(v) for v in existing.values())
    if prior_total > 0 and total_before < prior_total * 0.9:
        log(f"  경고: 기사가 {prior_total}건 → {total_before}건으로 줄었습니다. 기록을 중단합니다.")
        return 1

    log(f"  통과: 총 {total}건 ({stocks_with_news}/{len(entries)}종목) · 이번 실행 신규 +{new_count}건")

    if args.dry_run:
        log("\n--dry-run: 기록을 건너뜁니다")
        return 0

    log("[5/5] 기록")
    payload = {
        "collectedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "stocks": all_news,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "news.json"
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    path.write_text(text + "\n", encoding="utf-8")
    log(f"  news.json  {len(text):,} bytes  ({total}건)")

    log(f"\n완료 — 총 {total}건 (신규 +{new_count})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
