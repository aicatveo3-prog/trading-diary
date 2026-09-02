#!/usr/bin/env python3
"""
원문 기사에서 meta description을 크롤링한다.

Google News RSS URL은 리다이렉트 URL(news.google.com/rss/articles/...)이다.
googlenewsdecoder 라이브러리로 원문 URL을 추출하고, 원문 페이지의
<meta name="description">을 읽는다.

의존성:
    pip install googlenewsdecoder

두 가지 용도:
  1. collect_news.py에서 새 기사 수집 시 호출
  2. backfill_descriptions.py에서 기존 기사에 소급 적용
"""

from __future__ import annotations

import re
import ssl
import urllib.request
from http.cookiejar import CookieJar


# --- Google News URL 디코딩 ---

def resolve_google_news_url(google_url: str, timeout: int = 10) -> str | None:
    """
    Google News 리다이렉트 URL에서 원문 URL을 추출한다.
    googlenewsdecoder 라이브러리를 사용한다.

    google_url: https://news.google.com/rss/articles/CBMi...
    반환: 원문 URL (str) 또는 None (실패 시)
    """
    try:
        from googlenewsdecoder import new_decoderv1
        result = new_decoderv1(google_url, interval=0)
        if result.get("status"):
            decoded_url = result.get("decoded_url")
            if decoded_url and "news.google.com" not in decoded_url:
                return decoded_url
        return None
    except Exception:
        return None


# --- HTTP 공통 ---

def _build_opener() -> urllib.request.OpenerDirector:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    cookie_handler = urllib.request.HTTPCookieProcessor(CookieJar())
    https_handler = urllib.request.HTTPSHandler(context=ctx)
    return urllib.request.build_opener(cookie_handler, https_handler)


_OPENER = _build_opener()
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


# --- Meta description 추출 ---

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
    if len(text) > 200:
        text = text[:197] + "…"
    return text


def fetch_meta_description(article_url: str, timeout: int = 10) -> str | None:
    """
    URL에서 HTML을 가져와 <meta name="description"> 또는 og:description을 추출한다.
    """
    try:
        req = urllib.request.Request(article_url, headers=_HEADERS)
        resp = _OPENER.open(req, timeout=timeout)

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

        raw = next((g for g in match.groups() if g is not None), None)
        if not raw:
            return None

        cleaned = _clean_meta(raw)
        if len(cleaned) < 15:
            return None

        return cleaned

    except Exception:
        return None


def fetch_description_for_article(google_url: str, timeout: int = 10) -> str | None:
    """
    Google News 리다이렉트 URL에서 시작해 원문의 meta description을 가져온다.
    전체 파이프라인: googlenewsdecoder로 URL 디코딩 → 원문 페이지 fetch → meta 추출

    반환: description 문자열 또는 None
    """
    real_url = resolve_google_news_url(google_url, timeout=timeout)
    if not real_url:
        return None
    return fetch_meta_description(real_url, timeout=timeout)
