'use client';

import { useState, useMemo, useCallback } from 'react';
import { c, font } from '@/lib/tokens';
import { PERIODS, PeriodKey } from '@/lib/events-data';
import { latestQuote, stockMeta, dateFor, closeSeries, chartGeometry } from '@/lib/price-data';
import { newsFor, hasNews, sentimentSummary } from '@/lib/news-data';
import { shortDate } from '@/lib/format';

import StockHeaderCard from '@/components/stock/StockHeaderCard';
import PeriodSelector from '@/components/stock/PeriodSelector';
import PinnedChart from '@/components/stock/PinnedChart';
import RealNewsTimeline from '@/components/news/RealNewsTimeline';
import PromiseCard from '@/components/panels/PromiseCard';

interface StockDetailViewProps {
  ticker: string;
}

export default function StockDetailView({ ticker }: StockDetailViewProps) {
  const [period, setPeriod] = useState<PeriodKey>('3M');
  const [newsFilter, setNewsFilter] = useState('전체');
  const [watched, setWatched] = useState(false);

  const meta = stockMeta(ticker);
  const quote = latestQuote(ticker);
  const news = newsFor(ticker);
  const sentiment = sentimentSummary(ticker);

  const available = closeSeries(ticker).length;
  const periodDays = Math.min(PERIODS.find(p => p.key === period)?.days ?? 64, available);

  if (!meta) {
    return (
      <div className="gc-shell">
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, padding: '40px 26px' }}>
          <p style={{ margin: 0, fontSize: 14, color: c.inkMid }}>
            아직 수집 대상이 아닌 종목입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gc-shell">
      {/* 본문 */}
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {/* 종목 헤더 + 차트 */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          <StockHeaderCard
            name={meta.name}
            ticker={meta.ticker}
            market={meta.market}
            price={quote.price}
            changeRate={quote.changeRate}
            changeAmount={quote.changeAmount}
            asOf={`${shortDate(dateFor(0))} 장마감`}
            watched={watched}
            onToggleWatch={() => setWatched(v => !v)}
          />

          {/* 기간 선택 */}
          <div
            style={{
              padding: '0 26px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              borderBottom: `1px solid ${c.borderSoft}`,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 12.5, color: c.inkMid }}>
              관련 뉴스 <strong style={{ color: c.ink }}>{news.length}건</strong> 수집됨
              {' · '}긍정 {sentiment.positive} / 부정 {sentiment.negative} / 중립 {sentiment.neutral}
            </div>
            <PeriodSelector selected={period} onChange={setPeriod} />
          </div>

          <PinnedChart
            ticker={ticker}
            periodDays={periodDays}
            pinnedEvents={[]}
            numbering={new Map()}
            selectedId={null}
            onSelect={() => {}}
          />
        </div>

        {/* 뉴스 타임라인 — 실제 Google News 기사 */}
        <RealNewsTimeline
          news={news}
          filter={newsFilter}
          onFilterChange={setNewsFilter}
        />
      </div>

      {/* 사이드바 */}
      <aside className="gc-aside">
        {/* 감성 요약 */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, padding: '18px 20px' }}>
          <div style={{ fontFamily: font.serif, fontSize: 15, fontWeight: 700, marginBottom: 15 }}>
            뉴스 감성 분포
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <StatBox label="긍정" count={sentiment.positive} color="#17805a" />
            <StatBox label="부정" count={sentiment.negative} color="#c0392b" />
            <StatBox label="중립" count={sentiment.neutral} color="#6f747c" />
          </div>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
            {news.length > 0 && (
              <>
                <div style={{ width: `${(sentiment.positive / news.length) * 100}%`, background: '#17805a' }} />
                <div style={{ width: `${(sentiment.neutral / news.length) * 100}%`, background: '#d9dade' }} />
                <div style={{ width: `${(sentiment.negative / news.length) * 100}%`, background: '#c0392b' }} />
              </>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 10, lineHeight: 1.55 }}>
            키워드 기반 자동 분류입니다. 참고용이며 정확도에 한계가 있습니다.
          </div>
        </div>

        <PromiseCard />
      </aside>
    </div>
  );
}

function StatBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: c.surfaceAlt, borderRadius: 4 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: 10.5, color: c.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );
}
