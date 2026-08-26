'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { c } from '@/lib/tokens';
import {
  STOCK_EVENTS,
  PERIODS,
  PeriodKey,
  EventType,
  STOCK_META,
  TODAY_MOVES,
} from '@/lib/events-data';
import { selectVisibleEvents, applyTimelineView, similarCases, SortMode } from '@/lib/event-selectors';
import { latestQuote } from '@/lib/chart-series';
import { longDate } from '@/lib/format';

import StockHeaderCard from '@/components/stock/StockHeaderCard';
import PeriodSelector from '@/components/stock/PeriodSelector';
import PinnedChart from '@/components/stock/PinnedChart';
import NewsTimeline from '@/components/news/NewsTimeline';
import TodayMovesPanel from '@/components/panels/TodayMovesPanel';
import SimilarCasesPanel from '@/components/panels/SimilarCasesPanel';
import PromiseCard from '@/components/panels/PromiseCard';

/** 차트에 꽂을 핀 개수 상한 — 이보다 많으면 차트가 읽히지 않는다 */
const MAX_PINS = 5;

export default function StockDetailPage() {
  const params = useParams();
  const ticker = typeof params.ticker === 'string' ? params.ticker : '005930';

  const [period, setPeriod] = useState<PeriodKey>('1M');
  const [filter, setFilter] = useState<EventType | '전체'>('전체');
  const [sort, setSort] = useState<SortMode>('recent');
  const [selectedId, setSelectedId] = useState<string | null>('e3');
  const [watched, setWatched] = useState(false);

  const meta = STOCK_META[ticker] ?? { name: '삼성전자', ticker: '005930', market: 'KOSPI' };
  const periodDays = PERIODS.find(p => p.key === period)?.days ?? 22;
  const quote = latestQuote();

  const visible = useMemo(
    () => selectVisibleEvents(STOCK_EVENTS, periodDays, MAX_PINS),
    [periodDays]
  );

  const timelineEvents = useMemo(
    () => applyTimelineView(visible.all, filter, sort),
    [visible.all, filter, sort]
  );

  const pinnedIds = useMemo(() => new Set(visible.pinned.map(e => e.id)), [visible.pinned]);

  // 유사 사례는 선택된 이벤트의 유형을 기준으로 한다
  const selectedEvent =
    STOCK_EVENTS.find(e => e.id === selectedId) ?? visible.all[0] ?? STOCK_EVENTS[0];
  const similar = useMemo(() => similarCases(STOCK_EVENTS, selectedEvent), [selectedEvent]);

  /** 차트 핀 클릭 → 선택 + 필터 해제 + 해당 타임라인 항목으로 스크롤 */
  const handlePinSelect = useCallback((id: string) => {
    setSelectedId(id);
    setFilter('전체');
    requestAnimationFrame(() => {
      document.getElementById(`event-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

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
            asOf="08.26 장마감"
            watched={watched}
            onToggleWatch={() => setWatched(v => !v)}
          />

          {/* 핀 개수 안내 + 기간 선택 */}
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
              이 기간에 꽂힌 뉴스 핀{' '}
              <strong style={{ color: c.ink }}>{visible.pinned.length}개</strong> · 전체 이벤트{' '}
              {visible.all.length}건
            </div>
            <PeriodSelector selected={period} onChange={setPeriod} />
          </div>

          <PinnedChart
            periodDays={periodDays}
            pinnedEvents={visible.pinned}
            numbering={visible.numbering}
            selectedId={selectedId}
            onSelect={handlePinSelect}
          />
        </div>

        {/* 뉴스 타임라인 */}
        <NewsTimeline
          events={timelineEvents}
          types={visible.types}
          filter={filter}
          onFilterChange={setFilter}
          sort={sort}
          onSortToggle={() => setSort(s => (s === 'recent' ? 'move' : 'recent'))}
          numbering={visible.numbering}
          pinnedIds={pinnedIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* 사이드바 */}
      <aside className="gc-aside">
        <TodayMovesPanel moves={TODAY_MOVES} asOf={longDate(new Date(2026, 7, 26))} />
        <SimilarCasesPanel data={similar} stockName={meta.name} />
        <PromiseCard />
      </aside>
    </div>
  );
}
