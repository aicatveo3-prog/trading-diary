'use client';

import Link from 'next/link';
import { c, font } from '@/lib/tokens';
import { STOCK_META, STOCK_EVENTS, hasDetailPage } from '@/lib/events-data';
import { dateFor } from '@/lib/chart-series';
import { pct, shortDate } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';
import PromiseCard from '@/components/panels/PromiseCard';

/**
 * 워치리스트 — 실 데이터 연결 시 /api/watchlist에서 조회한다.
 * 지금은 로컬 목록으로 화면 구조만 보여준다.
 */
const WATCHED = [
  { ticker: '005930', changeRate: -2.7, memo: '반도체 업황 관세 이슈 추적' },
  { ticker: '000660', changeRate: 5.2, memo: 'HBM 증설 진행 확인' },
  { ticker: '035720', changeRate: -0.5, memo: '' },
  { ticker: '035420', changeRate: 1.1, memo: '라인야후 지분 정리 이후' },
  { ticker: '247540', changeRate: -6.1, memo: '미 보조금 정책 영향' },
];

export default function WatchlistPage() {
  const { colors } = useConvention();

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
            관심 종목 {WATCHED.length}개 · 종목을 누르면 뉴스와 주가를 겹쳐 볼 수 있습니다.
          </p>
        </div>

        <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          {WATCHED.map(item => {
            const meta = STOCK_META[item.ticker];
            if (!meta) return null;

            const dirColor = item.changeRate >= 0 ? colors.up : colors.down;

            // 이 종목과 연관된 가장 최근 이벤트를 함께 보여준다
            const latestEvent = STOCK_EVENTS[0];

            return (
              <Link
                key={item.ticker}
                href={`/stocks/${item.ticker}`}
                className="gc-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 110px',
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
                  {item.memo ? (
                    <div style={{ fontSize: 12, color: c.inkSoft, lineHeight: 1.5 }}>
                      {item.memo}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: c.inkFaint, lineHeight: 1.5 }}>
                      메모 없음
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: font.serif,
                      fontSize: 18,
                      fontWeight: 700,
                      color: dirColor,
                    }}
                  >
                    {pct(item.changeRate)}
                  </div>
                  <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 2 }}>
                    {shortDate(dateFor(0))} 장마감
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
            보여줍니다.
          </p>
        </div>
      </div>

      <aside className="gc-aside">
        <PromiseCard />
      </aside>
    </div>
  );
}
