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


# 요약 길이 상한 — 대부분의 meta description은 2~3문장이라 여유롭게 둔다.
# 너무 길면(본문 전체가 들어온 경우) 잘라낸다.
MAX_DESC_LEN = 400


def _clean_meta(raw: str) -> str:
    """메타 태그에서 추출한 텍스트를 정리한다."""
    import html as html_mod
    text = html_mod.unescape(raw)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > MAX_DESC_LEN:
        text = text[:MAX_DESC_LEN - 1] + "…"
    return text


# <meta charset="euc-kr"> 또는 Content-Type의 charset 추출용
_CHARSET_META_RE = re.compile(
    r'<meta[^>]+charset=["\']?\s*([a-zA-Z0-9\-_]+)', re.IGNORECASE
)
_CHARSET_HTTP_RE = re.compile(r'charset=\s*([a-zA-Z0-9\-_]+)', re.IGNORECASE)


def _detect_encoding(html_bytes: bytes, content_type: str) -> str:
    """
    HTML 바이트와 Content-Type 헤더에서 인코딩을 감지한다.

    한국 뉴스 사이트(네이트 등)는 EUC-KR을 쓰는데, UTF-8로 잘못 읽으면
    글자가 깨진다(mojibake). HTTP 헤더 → <meta charset> 순으로 확인한다.
    """
    # 1. HTTP 헤더의 charset
    m = _CHARSET_HTTP_RE.search(content_type)
    if m:
        return _normalize_charset(m.group(1))

    # 2. HTML <meta charset> — 헤드 영역만 latin-1로 미리 훑는다 (ASCII는 안전)
    head = html_bytes[:4096].decode("latin-1", errors="replace")
    m = _CHARSET_META_RE.search(head)
    if m:
        return _normalize_charset(m.group(1))

    # 3. 기본값: UTF-8
    return "utf-8"


def _normalize_charset(name: str) -> str:
    """charset 이름을 파이썬 코덱 이름으로 정규화한다."""
    n = name.strip().lower()
    aliases = {
        "euc-kr": "euc-kr",
        "euckr": "euc-kr",
        "ks_c_5601-1987": "euc-kr",
        "ksc5601": "euc-kr",
        "cp949": "cp949",
        "uhc": "cp949",
        "utf8": "utf-8",
        "utf-8": "utf-8",
    }
    return aliases.get(n, n or "utf-8")


def fetch_meta_description(article_url: str, timeout: int = 10) -> str | None:
    """
    URL에서 HTML을 가져와 <meta name="description"> 또는 og:description을 추출한다.
    사이트 인코딩(UTF-8 / EUC-KR / CP949)을 감지해 올바르게 디코딩한다.
    """
    try:
        req = urllib.request.Request(article_url, headers=_HEADERS)
        resp = _OPENER.open(req, timeout=timeout)

        content_type = resp.headers.get("Content-Type", "")
        if "html" not in content_type and "text" not in content_type:
            return None

        # <head> 영역만 읽으면 되므로 상위 30KB만 가져온다
        html_bytes = resp.read(30_000)

        # 인코딩 감지 후 디코딩 (EUC-KR 사이트의 깨진 글자 방지)
        encoding = _detect_encoding(html_bytes, content_type)
        try:
            html = html_bytes.decode(encoding, errors="replace")
        except (LookupError, Exception):
            html = html_bytes.decode("utf-8", errors="replace")

        match = _META_DESC_RE.search(html)
        if not match:
            return None

        raw = next((g for g in match.groups() if g is not None), None)
        if not raw:
            return None

        cleaned = _clean_meta(raw)
        if len(cleaned) < 15:
            return None

        # 디코딩 실패로 치환 문자(U+FFFD)가 남았으면 버린다 — 깨진 글자를 저장하지 않는다
        if "\ufffd" in cleaned:
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
