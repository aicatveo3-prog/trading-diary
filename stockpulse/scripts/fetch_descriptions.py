#!/usr/bin/env python3
"""
원문 기사에서 meta description을 크롤링한다.

Google News RSS URL은 리다이렉트 URL(news.google.com/rss/articles/...)이다.
이 URL을 따라가면 원문 사이트로 리다이렉트되고, 거기서 <meta> 태그를 읽는다.

두 가지 용도:
  1. collect_news.py에서 새 기사 수집 시 호출
  2. backfill_descriptions.py에서 기존 기사에 소급 적용

원칙:
  - 실패해도 기존 데이터를 망가뜨리지 않는다 (description은 optional).
  - 타임아웃과 에러를 관대하게 처리한다 — 한 기사 실패가 전체를 막지 않는다.
  - 요청 간 간격을 두어 원문 사이트에 부담을 주지 않는다.
"""

from __future__ import annotations

import re
import ssl
import urllib.request
import urllib.error
from http.cookiejar import CookieJar


# --- Google News 리다이렉트 해석 ---

def _build_opener() -> urllib.request.OpenerDirector:
    """리다이렉트를 따라가는 opener. SSL 검증을 느슨하게 둔다 (뉴스 사이트 인증서 문제 대응)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    cookie_handler = urllib.request.HTTPCookieProcessor(CookieJar())
    https_handler = urllib.request.HTTPSHandler(context=ctx)
    return urllib.request.build_opener(cookie_handler, https_handler)


_OPENER = _build_opener()
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockPulse/1.0; +https://github.com/aicatveo3-prog/trading-diary)"}


def resolve_google_news_url(google_url: str, timeout: int = 10) -> str | None:
    """
    Google News 리다이렉트 URL을 따라가 원문 URL을 얻는다.

    google_url: https://news.google.com/rss/articles/CBMi...
    반환: 원문 URL (str) 또는 None (실패 시)
    """
    try:
        req = urllib.request.Request(google_url, headers=_HEADERS)
        resp = _OPENER.open(req, timeout=timeout)
        final_url: str = resp.url
        # Google consent 페이지로 빠진 경우 무시
        if "consent.google" in final_url or "news.google.com" in final_url:
            return None
        return final_url
    except Exception:
        return None


# --- Meta description 추출 ---

# <meta name="description" content="..."> 또는 <meta property="og:description" content="...">
_META_DESC_RE = re.compile(
    r'<meta\s+(?:'
    r'name=["\']description["\']\s+content=["\']([^"\']*)["\']'
    r'|'
    r'content=["\']([^"\']*?)["\']\s+name=["\']description["\']'
    r'|'
    r'property=["\']og:description["\']\s+content=["\']([^"\']*)["\']'
    r'|'
    r'content=["\']([^"\']*?)["\']\s+property=["\']og:description["\']'
    r')',
    re.IGNORECASE,
)


def _clean_meta(raw: str) -> str:
    """메타 태그에서 추출한 텍스트를 정리한다."""
    import html as html_mod
    text = html_mod.unescape(raw)
    text = re.sub(r"\s+", " ", text).strip()
    # 200자 상한 — 너무 긴 description은 페이지 전체가 들어온 것
    if len(text) > 200:
        text = text[:197] + "…"
    return text


def fetch_meta_description(article_url: str, timeout: int = 10) -> str | None:
    """
    URL에서 HTML을 가져와 <meta name="description"> 또는 og:description을 추출한다.

    article_url: 원문 기사 URL
    반환: description 문자열 또는 None (실패/비어있음)
    """
    try:
        req = urllib.request.Request(article_url, headers=_HEADERS)
        resp = _OPENER.open(req, timeout=timeout)

        # Content-Type 확인 — HTML만 파싱
        content_type = resp.headers.get("Content-Type", "")
        if "html" not in content_type and "text" not in content_type:
            return None

        # <head> 영역만 읽으면 되므로 상위 20KB만 가져온다
        html_bytes = resp.read(20_000)
        try:
            html = html_bytes.decode("utf-8", errors="replace")
        except Exception:
            html = html_bytes.decode("latin-1", errors="replace")

        match = _META_DESC_RE.search(html)
        if not match:
            return None

        # 4개 캡처 그룹 중 매칭된 것
        raw = next((g for g in match.groups() if g is not None), None)
        if not raw:
            return None

        cleaned = _clean_meta(raw)
        # 너무 짧거나 의미 없는 기본값은 무시
        if len(cleaned) < 15:
            return None

        return cleaned

    except Exception:
        return None


def fetch_description_for_article(google_url: str, timeout: int = 10) -> str | None:
    """
    Google News 리다이렉트 URL에서 시작해 원문의 meta description을 가져온다.
    전체 파이프라인: 리다이렉트 해석 → 원문 페이지 fetch → meta 추출

    반환: description 문자열 또는 None
    """
    real_url = resolve_google_news_url(google_url, timeout=timeout)
    if not real_url:
        return None
    return fetch_meta_description(real_url, timeout=timeout)
