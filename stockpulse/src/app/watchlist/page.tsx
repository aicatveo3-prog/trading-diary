'use client';

import Link from 'next/link';
import { c, font } from '@/lib/tokens';
import { stockMetaMap, changeAt, latestQuote, dateFor } from '@/lib/price-data';
import { pct, shortDate } from '@/lib/format';
import { entryFor, formatPrice, formatChangeAmount } from '@/lib/universe';
import { useConvention } from '@/lib/convention-context';
import PromiseCard from '@/components/panels/PromiseCard';

/**
 * 워치리스트 — 실 데이터 연결 시 /api/watchlist에서 조회한다.
 * 지금은 고정 목록이며, 등락률은 실제 주가에서 계산한다.
 */
const WATCHED: { ticker: string; memo: string }[] = [
  { ticker: '005930', memo: '반도체 업황 관세 이슈 추적' },
  { ticker: '000660', memo: 'HBM 증설 진행 확인' },
  { ticker: '042700', memo: 'HBM 장비 수주 흐름' },
  { ticker: 'NVDA', memo: 'AI 가속기 수요 — 전체 반도체 방향타' },
  { ticker: 'MU', memo: '메모리 사이클 — 하이닉스와 함께 확인' },
  { ticker: 'USDKRW', memo: '환율이 외국인 수급에 미치는 영향' },
];

export default function WatchlistPage() {
  const { colors } = useConvention();
  const metas = stockMetaMap();
  const items = WATCHED.filter(w => metas[w.ticker]);

  return (
    <div className="gc-shell">
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        <div>
          <h1
            style={{
              fontFamily: font.serif,
              fontSize: 25,
              fontWeight: 700,
              margin: '0 0 5px',
              letterSpacing: '-0.03em',
            }}
          >
            워치리스트
          </h1>
          <p style={{ margin: 0, fontSize: 12.5, color: c.inkMid }}>
            관심 종목 {items.length}개 · {shortDate(dateFor(0))} 장마감 기준
          </p>
        </div>

        <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          {items.map(item => {
            const meta = metas[item.ticker];
            const rate = changeAt(item.ticker, 0);
            const quote = latestQuote(item.ticker);
            const dirColor = rate >= 0 ? colors.up : colors.down;
            const entry = entryFor(item.ticker);

            return (
              <Link
                key={item.ticker}
                href={`/stocks/${item.ticker}`}
                className="gc-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px',
                  gap: 16,
                  alignItems: 'center',
                  padding: '16px 26px',
                  borderBottom: `1px solid ${c.borderFaint}`,
                  color: c.ink,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      marginBottom: 5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{meta.name}</span>
                    <span style={{ fontSize: 11, color: c.inkFaint }}>
                      {meta.ticker} · {meta.market}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: item.memo ? c.inkSoft : c.inkFaint,
                      lineHeight: 1.5,
                    }}
                  >
                    {item.memo || '메모 없음'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: font.serif, fontSize: 18, fontWeight: 700 }}>
                    {entry ? formatPrice(quote.price, entry) : quote.price.toLocaleString('ko-KR')}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: dirColor, marginTop: 2 }}>
                    {pct(rate)} (
                    {entry
                      ? formatChangeAmount(quote.changeAmount, entry)
                      : Math.round(quote.changeAmount).toLocaleString('ko-KR')}
                    )
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div
          style={{
            border: `1px solid ${c.borderAlt}`,
            background: c.surfaceAlt,
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.09em',
              color: c.inkSoft,
              marginBottom: 7,
            }}
          >
            아직 준비 중
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: c.inkStrong }}>
            종목 추가·삭제와 급변 알림은 로그인 기능과 함께 붙습니다. 지금은 고정된 목록만
            보여주며, 등락률은 실제 시장 데이터입니다.
          </p>
        </div>
      </div>

      <aside className="gc-aside">
        <PromiseCard />
      </aside>
    </div>
  );
}
