#!/usr/bin/env python3
"""
종목 유니버스 로더 (수집 스크립트 공용)

src/data/universe.json 을 읽는다. TypeScript(src/lib/universe.ts)와 같은 파일을
공유하므로, 종목을 추가할 때 JSON 한 곳만 고치면 수집기와 화면이 함께 반영된다.

이전에는 TARGETS가 collect_prices / collect_news / collect_minutes 세 곳에
중복 정의돼 있어서 종목을 추가할 때 한 곳을 빼먹기 쉬웠다.
"""

from __future__ import annotations

import json
from pathlib import Path

UNIVERSE_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "universe.json"


class Entry(dict):
    """유니버스 항목. dict를 그대로 쓰되 자주 쓰는 필드를 속성으로 노출한다."""

    @property
    def id(self) -> str:
        return self["id"]

    @property
    def name(self) -> str:
        return self["name"]

    @property
    def market(self) -> str:
        return self["market"]

    @property
    def fdr(self) -> str:
        return self["fdr"]

    @property
    def yahoo(self) -> str:
        return self["yahoo"]

    @property
    def news_query(self) -> str:
        return self["newsQuery"]

    @property
    def asset_type(self) -> str:
        return self["type"]

    @property
    def currency(self) -> str:
        return self["currency"]


def load_universe() -> list[Entry]:
    raw = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
    return [Entry(item) for item in raw["stocks"]]


def by_market(market: str) -> list[Entry]:
    return [e for e in load_universe() if e.market == market]


def markets() -> list[str]:
    """등장 순서를 유지한 시장 목록"""
    seen: list[str] = []
    for e in load_universe():
        if e.market not in seen:
            seen.append(e.market)
    return seen


def stock_meta() -> dict:
    """화면에서 쓸 종목 메타 (src/data/stocks.json 형식)"""
    return {
        e.id: {
            "id": e.id,
            "name": e.name,
            "market": e.market,
            "currency": e.currency,
            "type": e.asset_type,
            "group": e["group"],
        }
        for e in load_universe()
    }


if __name__ == "__main__":
    entries = load_universe()
    print(f"유니버스 {len(entries)}종목")
    current = None
    for e in entries:
        if e["group"] != current:
            current = e["group"]
            print(f"\n[{current}]")
        print(f"  {e.id:<8} {e.name:<18} {e.market}  {e.asset_type:<6} fdr={e.fdr:<10} yahoo={e.yahoo}")
