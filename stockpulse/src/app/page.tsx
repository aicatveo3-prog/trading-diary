'use client';

import Link from 'next/link';
import { c, font } from '@/lib/tokens';
import { eventsFor } from '@/lib/events-data';
import { todayMoves } from '@/lib/today-moves';
import {
  marketIndices,
  stockMetaMap,
  changeAt,
  dateFor,
  tradingDate,
  latestQuote,
} from '@/lib/price-data';
import { pct, longDate, shortDate, won } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';
import MarketIndexStrip from '@/components/panels/MarketIndexStrip';
import PromiseCard from '@/components/panels/PromiseCard';

/** 워치리스트 — 실 데이터 연결 시 /api/watchlist에서 조회 */
const WATCHED = ['005930', '000660', '035720', '035420'];

export default function DashboardPage() {
  const { colors } = useConvention();

  const indices = marketIndices();
  const moves = todayMoves(5);
  const asOfDate = dateFor(0);
  const metas = stockMetaMap();

  // 오늘 보도된 예시 이벤트 (전 종목)
  const todayEvents = Object.keys(metas).flatMap(t =>
    eventsFor(t)
      .filter(e => e.daysAgo === 0)
      .map(e => ({ event: e, meta: metas[t] }))
  );

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
            {longDate(asOfDate)} 장마감 기준 · 주가가 움직인 날에 무슨 일이 있었는지를 모아둡니다.
          </p>
        </div>

        {/* 지수 */}
        <MarketIndexStrip indices={indices} />

        {/* 오늘 크게 움직인 종목 */}
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
              오늘 크게 움직인 종목
            </span>
            <span style={{ fontSize: 11.5, color: c.inkFaint }}>변동폭 기준 · 수집 종목 내</span>
          </div>

          <div>
            {moves.map(move => {
              const dirColor = move.changeRate >= 0 ? colors.up : colors.down;
              const quote = latestQuote(move.ticker);

              return (
                <Link
                  key={move.ticker}
                  href={`/stocks/${move.ticker}`}
                  className="gc-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px',
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
                      <span style={{ fontSize: 11, color: c.inkFaint }}>
                        {move.ticker} · {move.market}
                      </span>
                    </div>
                    {move.cause ? (
                      <div style={{ fontSize: 12, color: c.inkSoft, lineHeight: 1.5 }}>
                        {move.cause}
                        <span style={{ color: c.inkFaint }}> · 예시 뉴스</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: c.inkFaint, lineHeight: 1.5 }}>
                        관련 뉴스 미수집
                      </div>
                    )}
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
                    <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 2 }}>
                      {won(quote.price)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 오늘 들어온 소식 */}
        {todayEvents.length > 0 && (
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
                오늘 들어온 소식
              </span>
              <span style={{ fontSize: 11.5, color: c.inkFaint }}>예시 데이터</span>
            </div>
            <div>
              {todayEvents.map(({ event, meta }) => (
                <Link
                  key={event.id}
                  href={`/stocks/${event.ticker}`}
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
                    <span style={{ fontSize: 11, color: c.inkMid, fontWeight: 500 }}>
                      {meta.name}
                    </span>
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
            {WATCHED.map(ticker => {
              const meta = metas[ticker];
              if (!meta) return null;
              const rate = changeAt(ticker, 0);
              const dirColor = rate >= 0 ? colors.up : colors.down;
              return (
                <Link
                  key={ticker}
                  href={`/stocks/${ticker}`}
                  className="gc-fade"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 62px',
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
                    {pct(rate)}
                  </div>
                </Link>
              );
            })}
          </div>
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
            데이터 출처
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: c.inkStrong }}>
            주가·지수는 실제 시장 데이터입니다 (기준일 {tradingDate()}). 뉴스 헤드라인은 아직 예시이며,
            수집이 연결되면 실제 보도로 대체됩니다.
          </p>
        </div>

        <PromiseCard />
      </aside>
    </div>
  );
}
