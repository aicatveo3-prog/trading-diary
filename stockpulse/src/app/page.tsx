'use client';

import Link from 'next/link';
import { c, font } from '@/lib/tokens';
import { TODAY_MOVES, STOCK_EVENTS, STOCK_META } from '@/lib/events-data';
import { dateFor } from '@/lib/chart-series';
import { pct, longDate, shortDate } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';
import MarketIndexStrip from '@/components/panels/MarketIndexStrip';
import PromiseCard from '@/components/panels/PromiseCard';

const ASOF = new Date(2026, 7, 26);

const INDICES = [
  { name: 'KOSPI', value: 2641.23, changeRate: 0.82 },
  { name: 'KOSDAQ', value: 842.56, changeRate: -0.34 },
];

/** 워치리스트 — 실 데이터 연결 시 /api/watchlist에서 조회 */
const WATCHLIST = [
  { ticker: '005930', changeRate: -2.7 },
  { ticker: '000660', changeRate: 5.2 },
  { ticker: '035720', changeRate: -0.5 },
  { ticker: '035420', changeRate: 1.1 },
];

export default function DashboardPage() {
  const { colors } = useConvention();

  // 오늘 보도된 이벤트만 (daysAgo === 0)
  const todayEvents = STOCK_EVENTS.filter(e => e.daysAgo === 0);

  return (
    <div className="gc-shell">
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {/* 페이지 제목 */}
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
            오늘
          </h1>
          <p style={{ margin: 0, fontSize: 12.5, color: c.inkMid }}>
            {longDate(ASOF)} 장마감 기준 · 주가가 움직인 날에 무슨 일이 있었는지를 모아둡니다.
          </p>
        </div>

        {/* 지수 */}
        <MarketIndexStrip indices={INDICES} />

        {/* 오늘, 뉴스로 설명되는 움직임 — 대시보드에서는 전체 폭으로 */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          <div
            style={{
              padding: '18px 26px 14px',
              borderBottom: `1px solid ${c.borderSoft}`,
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontFamily: font.serif, fontSize: 16, fontWeight: 700 }}>
              뉴스로 설명되는 움직임
            </span>
            <span style={{ fontSize: 11.5, color: c.inkFaint }}>
              중요도 = 변동폭 × 보도 매체 수
            </span>
          </div>

          <div>
            {TODAY_MOVES.map(move => {
              const dirColor = move.changeRate >= 0 ? colors.up : colors.down;
              return (
                <Link
                  key={move.ticker}
                  href={`/stocks/${move.ticker}`}
                  className="gc-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 96px',
                    gap: 16,
                    alignItems: 'center',
                    padding: '15px 26px',
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
                        marginBottom: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 14.5, fontWeight: 500 }}>{move.name}</span>
                      <span style={{ fontSize: 11, color: c.inkFaint }}>{move.ticker}</span>
                    </div>
                    <div style={{ fontSize: 12, color: c.inkSoft, lineHeight: 1.5 }}>
                      {move.cause}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontFamily: font.serif,
                        fontSize: 17,
                        fontWeight: 700,
                        color: dirColor,
                      }}
                    >
                      {pct(move.changeRate)}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 2 }}>당일</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 오늘 보도된 이벤트 */}
        {todayEvents.length > 0 && (
          <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <div style={{ padding: '18px 26px 14px', borderBottom: `1px solid ${c.borderSoft}` }}>
              <span style={{ fontFamily: font.serif, fontSize: 16, fontWeight: 700 }}>
                오늘 들어온 소식
              </span>
            </div>
            <div>
              {todayEvents.map(event => (
                <Link
                  key={event.id}
                  href="/stocks/005930"
                  className="gc-row"
                  style={{
                    display: 'block',
                    padding: '15px 26px',
                    borderBottom: `1px solid ${c.borderFaint}`,
                    color: c.ink,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 6 }}>
                    {event.headline}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '3px 8px',
                        background: c.surfaceMuted,
                        color: c.inkMid,
                        borderRadius: 2,
                      }}
                    >
                      {event.type}
                    </span>
                    <span style={{ fontSize: 11, color: c.inkFaint }}>
                      {shortDate(dateFor(event.daysAgo))} {event.time}
                    </span>
                    <span style={{ fontSize: 11, color: c.inkFaint }}>{event.sources}개 매체</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 사이드바 */}
      <aside className="gc-aside">
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, padding: '18px 20px' }}>
          <div style={{ fontFamily: font.serif, fontSize: 15, fontWeight: 700, marginBottom: 15 }}>
            워치리스트
          </div>
          <div style={{ display: 'grid', gap: 11 }}>
            {WATCHLIST.map(item => {
              const meta = STOCK_META[item.ticker];
              if (!meta) return null;
              const dirColor = item.changeRate >= 0 ? colors.up : colors.down;
              return (
                <Link
                  key={item.ticker}
                  href={`/stocks/${item.ticker}`}
                  className="gc-fade"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 58px',
                    gap: 10,
                    alignItems: 'center',
                    paddingBottom: 11,
                    borderBottom: `1px solid ${c.borderFaint}`,
                    color: c.ink,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{meta.name}</div>
                    <div style={{ fontSize: 11, color: c.inkSoft, marginTop: 2 }}>
                      {meta.ticker} · {meta.market}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: font.serif,
                      fontSize: 14,
                      fontWeight: 700,
                      textAlign: 'right',
                      color: dirColor,
                    }}
                  >
                    {pct(item.changeRate)}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <PromiseCard />
      </aside>
    </div>
  );
}
