#!/usr/bin/env python3
"""
기존 news.json에 원문 meta description을 소급 적용한다.

description이 없는 기사의 URL에서 원문 페이지를 열어 <meta name="description">
또는 <meta property="og:description">을 가져온다.

일회성 스크립트이지만, 여러 번 돌려도 안전하다 — 이미 description이 있는
기사는 건너뛴다.

사용법:
    python scripts/backfill_descriptions.py              # 실행
    python scripts/backfill_descriptions.py --dry-run    # 기록하지 않고 확인만
    python scripts/backfill_descriptions.py --limit 50   # 50건만 처리
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fetch_descriptions import fetch_description_for_article

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
KST = timezone(timedelta(hours=9))


def log(msg: str) -> None:
    print(msg, flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="기존 news.json에 meta description 소급 적용")
    parser.add_argument("--dry-run", action="store_true", help="기록하지 않고 확인만")
    parser.add_argument("--limit", type=int, default=0, help="처리할 최대 기사 수 (0 = 전부)")
    parser.add_argument("--delay", type=float, default=0.3, help="요청 간 대기 시간(초)")
    args = parser.parse_args()

    path = DATA_DIR / "news.json"
    if not path.exists():
        log("news.json이 없습니다.")
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))

    # description이 없는 대표 기사 수집
    targets: list[dict] = []
    already = 0
    for stock_id, articles in data["stocks"].items():
        for a in articles:
            if a.get("description"):
                already += 1
            else:
                targets.append(a)

    total = len(targets)
    if args.limit > 0:
        targets = targets[:args.limit]

    log(f"전체 대표 기사: {already + total}건")
    log(f"  이미 description 있음: {already}건")
    log(f"  크롤링 대상: {total}건" + (f" (--limit {args.limit})" if args.limit else ""))
    log(f"  예상 소요: ~{len(targets) * (args.delay + 0.5):.0f}초")
    log("")

    success = 0
    failed = 0

    for i, article in enumerate(targets):
        try:
            desc = fetch_description_for_article(article["url"], timeout=8)
            if desc:
                article["description"] = desc
                success += 1
                if success <= 5:
                    # 처음 몇 건은 결과를 보여준다
                    log(f"  ✓ {article['title'][:50]}")
                    log(f"    → {desc[:80]}")
            else:
                failed += 1
        except Exception as e:
            failed += 1
            if failed <= 3:
                log(f"  ✗ {article['title'][:50]}: {e}")

        # 진행 로그 — 100건마다
        if (i + 1) % 100 == 0 or (i + 1) == len(targets):
            log(f"  [{i+1}/{len(targets)}] 성공 {success} / 실패 {failed}")

        time.sleep(args.delay)

    log("")
    log(f"완료: 성공 {success}건, 실패 {failed}건")
    rate = success / max(success + failed, 1) * 100
    log(f"성공률: {rate:.1f}%")

    if args.dry_run:
        log("\n--dry-run: 기록을 건너뜁니다")
        return 0

    if success == 0:
        log("성공한 기사가 없습니다. 기록을 건너뜁니다.")
        return 0

    # 기록
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    path.write_text(text + "\n", encoding="utf-8")
    log(f"\nnews.json 저장: {len(text):,} bytes")

    return 0


if __name__ == "__main__":
    sys.exit(main())
