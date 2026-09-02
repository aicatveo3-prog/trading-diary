#!/usr/bin/env python3
"""
원문 기사에서 meta description을 크롤링한다.

Google News RSS URL은 리다이렉트 URL(news.google.com/rss/articles/...)이다.
이 URL을 디코딩해 원문 URL을 얻고, 거기서 <meta> 태그를 읽는다.

디코딩 방법 (우선순위):
  1. base64 디코딩 — URL의 CBMi... 부분에 원문 URL이 protobuf로 들어있다.
     새 포맷(AU_yq...)과 구 포맷(CBMi...) 모두 지원.
  2. Google 내부 batch API — base64 실패 시 POST 요청으로 원문 URL을 요청한다.
  3. HTTP redirect follow — 위 두 방법이 모두 실패하면 리다이렉트를 따라간다.

두 가지 용도:
  1. collect_news.py에서 새 기사 수집 시 호출
  2. backfill_descriptions.py에서 기존 기사에 소급 적용

원칙:
  - 실패해도 기존 데이터를 망가뜨리지 않는다 (description은 optional).
  - 타임아웃과 에러를 관대하게 처리한다 — 한 기사 실패가 전체를 막지 않는다.
  - 요청 간 간격을 두어 원문 사이트에 부담을 주지 않는다.
"""

from __future__ import annotations

import base64
import json
import re
import ssl
import urllib.request
import urllib.error
from http.cookiejar import CookieJar


# --- SSL / HTTP 공통 ---

def _build_opener() -> urllib.request.OpenerDirector:
    """리다이렉트를 따라가는 opener. SSL 검증을 느슨하게 둔다 (뉴스 사이트 인증서 문제 대응)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    cookie_handler = urllib.request.HTTPCookieProcessor(CookieJar())
    https_handler = urllib.request.HTTPSHandler(context=ctx)
    return urllib.request.build_opener(cookie_handler, https_handler)


_OPENER = _build_opener()
_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}


# --- 방법 1: base64 protobuf 디코딩 ---

def _decode_base64(google_url: str) -> str | None:
    """
    Google News URL의 인코딩된 부분을 base64 디코딩해 원문 URL을 추출한다.

    URL 구조: https://news.google.com/rss/articles/{encoded}?oc=5
    encoded 부분은 protobuf 바이너리를 base64(url-safe)로 인코딩한 것이다.
    그 안에 원문 URL이 ASCII 문자열로 들어있다.
    """
    try:
        parts = google_url.split("/articles/")
        if len(parts) < 2:
            return None

        encoded = parts[1].split("?")[0]
        # base64 패딩 보정
        padded = encoded + "=" * (4 - len(encoded) % 4)
        decoded = base64.urlsafe_b64decode(padded)

        # protobuf 바이너리에서 https:// 또는 http:// URL 추출
        # URL은 보통 \x22 (protobuf string field) 뒤에 나온다
        text = decoded.decode("latin-1")
        url_match = re.search(r"https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+", text)
        if url_match:
            found = url_match.group(0)
            # Google 자체 URL이면 무시 (디코딩 실패)
            if "news.google.com" not in found and "google.com/rss" not in found:
                return found

        return None
    except Exception:
        return None


# --- 방법 2: Google 내부 batch API ---

_BATCH_URL = "https://news.google.com/rss/articles/"


def _decode_via_batch_api(google_url: str, timeout: int = 10) -> str | None:
    """
    Google News 내부 API에 POST를 보내 원문 URL을 얻는다.

    googlenewsdecoder 라이브러리와 동일한 원리:
    Google News 페이지를 요청하면 응답 HTML/JS에 원문 URL이 포함된다.
    """
    try:
        # Google News 페이지를 GET으로 요청 (RSS가 아닌 웹 페이지)
        # rss/articles/ → articles/ 변환
        web_url = google_url.replace("/rss/articles/", "/articles/")

        req = urllib.request.Request(web_url, headers={
            **_HEADERS,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        })
        resp = _OPENER.open(req, timeout=timeout)
        html_bytes = resp.read(50_000)
        html = html_bytes.decode("utf-8", errors="replace")

        # Google News 페이지의 JS에서 원문 URL 추출
        # 패턴 1: data-n-au="https://..." (article URL)
        m = re.search(r'data-n-au="(https?://[^"]+)"', html)
        if m:
            return m.group(1)

        # 패턴 2: "https://..." 형태로 외부 URL이 포함됨
        # window.location.replace 또는 href 패턴
        m = re.search(r'(?:href|url|location\.replace)\s*[=(]\s*["\']?(https?://(?!news\.google\.com)[^"\'>\s]+)', html)
        if m:
            return m.group(1)

        # 패턴 3: 리다이렉트가 이미 되어 최종 URL이 원문일 수 있음
        final_url = resp.url
        if "news.google.com" not in final_url and "consent.google" not in final_url:
            return final_url

        return None
    except Exception:
        return None


# --- 방법 3: HTTP redirect follow ---

def _resolve_via_redirect(google_url: str, timeout: int = 10) -> str | None:
    """
    Google News 리다이렉트 URL을 따라가 원문 URL을 얻는다.
    consent 페이지로 빠지면 None을 반환한다.
    """
    try:
        req = urllib.request.Request(google_url, headers=_HEADERS)
        resp = _OPENER.open(req, timeout=timeout)
        final_url: str = resp.url
        if "consent.google" in final_url or "news.google.com" in final_url:
            return None
        return final_url
    except Exception:
        return None


def resolve_google_news_url(google_url: str, timeout: int = 10) -> str | None:
    """
    Google News URL에서 원문 URL을 추출한다.
    3가지 방법을 순서대로 시도한다.
    """
    # 방법 1: base64 (가장 빠르고, 네트워크 요청 없음)
    result = _decode_base64(google_url)
    if result:
        return result

    # 방법 2: Google News 웹 페이지에서 추출
    result = _decode_via_batch_api(google_url, timeout=timeout)
    if result:
        return result

    # 방법 3: HTTP redirect follow (fallback)
    return _resolve_via_redirect(google_url, timeout=timeout)


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
    전체 파이프라인: URL 디코딩 → 원문 페이지 fetch → meta 추출

    반환: description 문자열 또는 None
    """
    real_url = resolve_google_news_url(google_url, timeout=timeout)
    if not real_url:
        return None
    return fetch_meta_description(real_url, timeout=timeout)
