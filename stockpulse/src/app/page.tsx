'use client';

import Link from 'next/link';
import { c, font } from '@/lib/tokens';
import { todayMoves } from '@/lib/today-moves';
import { allNews } from '@/lib/news-data';
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

  // 실제 최신 뉴스 (전 종목 합쳐서 10건)
  const latestNews = allNews(10);

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
            {longDate(asOfDate)} 장마감 기준
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
            <span style={{ fontSize: 11.5, color: c.inkFaint }}>변동폭 기준</span>
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
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 500 }}>{move.name}</span>
                      <span style={{ fontSize: 11, color: c.inkFaint }}>{move.ticker}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: font.serif, fontSize: 17, fontWeight: 700, color: dirColor }}>
                      {pct(move.changeRate)}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 2 }}>{won(quote.price)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 최신 뉴스 — 실제 Google News 기사 */}
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
              최신 뉴스
            </span>
            <span style={{ fontSize: 11.5, color: c.inkFaint }}>Google News 수집</span>
          </div>

          <div>
            {latestNews.map(article => {
              const sentimentEmoji = { positive: '🟢', negative: '🔴', neutral: '⚪' };
              const stockName = metas[article.ticker]?.name ?? article.ticker;
              const pubDate = new Date(article.publishedAt);
              const dateStr = `${String(pubDate.getMonth() + 1).padStart(2, '0')}.${String(pubDate.getDate()).padStart(2, '0')}`;

              return (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gc-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '22px 1fr',
                    gap: 12,
                    alignItems: 'start',
                    padding: '14px 26px',
                    borderBottom: `1px solid ${c.borderFaint}`,
                    color: c.ink,
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontSize: 12, marginTop: 2 }}>{sentimentEmoji[article.sentiment]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.55, marginBottom: 5 }}>
                      {article.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: c.inkMid, fontWeight: 500 }}>{stockName}</span>
                      <span style={{ fontSize: 11, color: c.inkFaint }}>{article.source}</span>
                      <span style={{ fontSize: 11, color: c.inkFaint }}>{dateStr}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
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
                  <div style={{ fontFamily: font.serif, fontSize: 14, fontWeight: 700, textAlign: 'right', color: dirColor }}>
                    {pct(rate)}
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
