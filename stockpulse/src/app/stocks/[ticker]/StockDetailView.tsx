'use client';

import { useState, useMemo, useCallback } from 'react';
import { c, font } from '@/lib/tokens';
import { eventsFor, PERIODS, PeriodKey, EventType } from '@/lib/events-data';
import {
  resolveEvents,
  selectVisibleEvents,
  applyTimelineView,
  similarCases,
  SortMode,
} from '@/lib/event-selectors';
import { latestQuote, stockMeta, tradingDate, dateFor, closeSeries } from '@/lib/price-data';
import { shortDate } from '@/lib/format';

import StockHeaderCard from '@/components/stock/StockHeaderCard';
import PeriodSelector from '@/components/stock/PeriodSelector';
import PinnedChart from '@/components/stock/PinnedChart';
import NewsTimeline from '@/components/news/NewsTimeline';
import SimilarCasesPanel from '@/components/panels/SimilarCasesPanel';
import PromiseCard from '@/components/panels/PromiseCard';

/** 차트에 꽂을 핀 개수 상한 — 이보다 많으면 차트가 읽히지 않는다 */
const MAX_PINS = 5;

interface StockDetailViewProps {
  ticker: string;
}

export default function StockDetailView({ ticker }: StockDetailViewProps) {
  const [period, setPeriod] = useState<PeriodKey>('1M');
  const [filter, setFilter] = useState<EventType | '전체'>('전체');
  const [sort, setSort] = useState<SortMode>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [watched, setWatched] = useState(false);

  const meta = stockMeta(ticker);
  const quote = latestQuote(ticker);

  // 실제 보유한 거래일 수를 넘지 않도록 기간을 제한한다
  const available = closeSeries(ticker).length;
  const periodDays = Math.min(PERIODS.find(p => p.key === period)?.days ?? 22, available);

  // 예시 이벤트에 실제 등락률을 채운다
  const resolved = useMemo(() => resolveEvents(ticker, eventsFor(ticker)), [ticker]);

  const visible = useMemo(
    () => selectVisibleEvents(resolved, periodDays, MAX_PINS),
    [resolved, periodDays]
  );

  const timelineEvents = useMemo(
    () => applyTimelineView(visible.all, filter, sort),
    [visible.all, filter, sort]
  );

  const pinnedIds = useMemo(() => new Set(visible.pinned.map(e => e.id)), [visible.pinned]);

  const selectedEvent = resolved.find(e => e.id === selectedId) ?? visible.all[0] ?? null;
  const similar = useMemo(
    () => (selectedEvent ? similarCases(resolved, selectedEvent) : null),
    [resolved, selectedEvent]
  );

  /** 차트 핀 클릭 → 선택 + 필터 해제 + 해당 타임라인 항목으로 스크롤 */
  const handlePinSelect = useCallback((id: string) => {
    setSelectedId(id);
    setFilter('전체');
    requestAnimationFrame(() => {
      document.getElementById(`event-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

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

  const hasEvents = resolved.length > 0;

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
              {hasEvents ? (
                <>
                  이 기간에 꽂힌 뉴스 핀{' '}
                  <strong style={{ color: c.ink }}>{visible.pinned.length}개</strong> · 전체 이벤트{' '}
                  {visible.all.length}건
                </>
              ) : (
                <>뉴스 수집이 연결되면 이 자리에 핀이 표시됩니다</>
              )}
            </div>
            <PeriodSelector selected={period} onChange={setPeriod} />
          </div>

          <PinnedChart
            ticker={ticker}
            periodDays={periodDays}
            pinnedEvents={visible.pinned}
            numbering={visible.numbering}
            selectedId={selectedId}
            onSelect={handlePinSelect}
          />
        </div>

        {/* 뉴스 타임라인 */}
        {hasEvents ? (
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
        ) : (
          <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
            <div style={{ padding: '18px 26px 14px', borderBottom: `1px solid ${c.borderSoft}` }}>
              <span style={{ fontFamily: font.serif, fontSize: 16, fontWeight: 700 }}>
                뉴스 타임라인
              </span>
            </div>
            <div style={{ padding: '38px 26px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontSize: 13.5, color: c.inkStrong }}>
                이 종목의 뉴스는 아직 수집되지 않았습니다.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: c.inkFaint, lineHeight: 1.6 }}>
                위 차트의 주가는 실제 데이터입니다. 뉴스 수집이 연결되면
                <br />
                이 자리에 그날 무슨 일이 있었는지 시간 순서대로 쌓입니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 사이드바 */}
      <aside className="gc-aside">
        {similar && <SimilarCasesPanel data={similar} stockName={meta.name} />}
        <PromiseCard />
      </aside>
    </div>
  );
}
