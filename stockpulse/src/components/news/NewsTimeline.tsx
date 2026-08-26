'use client';

import { c, font } from '@/lib/tokens';
import { StockEvent, EventType } from '@/lib/events-data';
import { SortMode } from '@/lib/event-selectors';
import { dateFor } from '@/lib/chart-series';
import { pct, shortDate } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

interface NewsTimelineProps {
  events: StockEvent[];
  types: EventType[];
  filter: EventType | '전체';
  onFilterChange: (t: EventType | '전체') => void;
  sort: SortMode;
  onSortToggle: () => void;
  numbering: Map<string, number>;
  pinnedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 모든 해설을 펼친 상태로 둘지 */
  expandAll?: boolean;
}

export default function NewsTimeline({
  events,
  types,
  filter,
  onFilterChange,
  sort,
  onSortToggle,
  numbering,
  pinnedIds,
  selectedId,
  onSelect,
  expandAll = false,
}: NewsTimelineProps) {
  const chipOptions: (EventType | '전체')[] = ['전체', ...types];

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      {/* 헤더: 유형 칩 + 정렬 */}
      <div
        style={{
          padding: '18px 26px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          borderBottom: `1px solid ${c.borderSoft}`,
        }}
      >
        <span style={{ fontFamily: font.serif, fontSize: 16, fontWeight: 700 }}>뉴스 타임라인</span>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chipOptions.map(option => {
            const active = filter === option;
            return (
              <button
                key={option}
                className="gc-chip"
                onClick={() => onFilterChange(option)}
                style={{
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  border: `1px solid ${active ? c.ink : c.borderInput}`,
                  background: active ? c.ink : c.surface,
                  color: active ? c.surface : c.inkMid,
                }}
              >
                {option}
              </button>
            );
          })}
        </div>

        <button
          className="gc-btn-outline"
          onClick={onSortToggle}
          style={{
            marginLeft: 'auto',
            height: 28,
            padding: '0 11px',
            background: c.surface,
            border: `1px solid ${c.borderBtn}`,
            fontSize: 11.5,
            fontWeight: 500,
            color: c.inkStrong,
            cursor: 'pointer',
            borderRadius: 3,
            whiteSpace: 'nowrap',
          }}
        >
          {sort === 'recent' ? '최신순 ↓' : '변동 큰 날 순 ↓'}
        </button>
      </div>

      {/* 이벤트 목록 */}
      <div>
        {events.length === 0 ? (
          <div style={{ padding: '38px 26px', textAlign: 'center', fontSize: 13, color: c.inkSoft }}>
            이 조건에 맞는 뉴스가 없습니다.
          </div>
        ) : (
          events.map(event => (
            <TimelineRow
              key={event.id}
              event={event}
              number={numbering.get(event.id)}
              isPinned={pinnedIds.has(event.id)}
              open={expandAll || selectedId === event.id}
              selected={selectedId === event.id}
              onClick={() => onSelect(selectedId === event.id ? null : event.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TimelineRowProps {
  event: StockEvent;
  number?: number;
  isPinned: boolean;
  open: boolean;
  selected: boolean;
  onClick: () => void;
}

function TimelineRow({ event, number, isPinned, open, selected, onClick }: TimelineRowProps) {
  const { colors } = useConvention();
  const dayColor = event.dayChange >= 0 ? colors.up : colors.down;
  const weekColor = event.week1Change >= 0 ? colors.up : colors.down;

  return (
    <div
      id={`event-${event.id}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '4px 1fr',
        borderBottom: `1px solid ${c.borderFaint}`,
      }}
    >
      {/* 선택 표시 바 */}
      <div style={{ background: selected ? dayColor : 'transparent' }} />

      <div className="gc-row" onClick={onClick} style={{ padding: '16px 26px 16px 22px', cursor: 'pointer' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '62px 1fr 96px',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* 날짜 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.inkStrong }}>
              {shortDate(dateFor(event.daysAgo))}
            </div>
            <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 2 }}>{event.time}</div>
          </div>

          {/* 헤드라인 + 메타 */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.5, marginBottom: 7 }}>
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
              <span style={{ fontSize: 11, color: c.inkFaint }}>{event.sources}개 매체</span>
              <span style={{ fontSize: 11, color: c.inkFaint }}>
                {isPinned && number ? `핀 ${number}` : '리스트 전용'}
              </span>
            </div>
          </div>

          {/* 당일 등락 */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: font.serif, fontSize: 17, fontWeight: 700, color: dayColor }}>
              {pct(event.dayChange)}
            </div>
            <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 2 }}>당일</div>
          </div>
        </div>

        {/* 확장형 해설 */}
        {open && (
          <div
            style={{
              marginTop: 15,
              padding: '16px 18px',
              background: c.surfaceAlt,
              borderLeft: `2px solid ${c.ink}`,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: c.inkSoft,
                marginBottom: 7,
              }}
            >
              이게 왜 주가에 영향을 주나요
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.72, color: c.inkBody }}>
              {event.explainer}
            </p>

            {/* 당일 / 1주 후 — 두 시점을 나란히 보여주면 "하루 반응"과 "이어진 흐름"이 구분된다 */}
            <div
              style={{
                display: 'flex',
                gap: 20,
                padding: '11px 0',
                borderTop: `1px solid ${c.borderAltInner}`,
                borderBottom: `1px solid ${c.borderAltInner}`,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: c.inkSoft, marginBottom: 2 }}>당일</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: dayColor }}>
                  {pct(event.dayChange)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: c.inkSoft, marginBottom: 2 }}>1주 후</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: weekColor }}>
                  {pct(event.week1Change)}
                </div>
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  maxWidth: 220,
                  fontSize: 10.5,
                  lineHeight: 1.5,
                  color: c.inkFaint,
                  textAlign: 'right',
                }}
              >
                수익률은 이 종목의 종가 기준이며, 시장 전체 흐름이 섞여 있습니다.
              </div>
            </div>

            {/* 보도 매체 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {event.articles.map(article => (
                <span
                  key={article.source}
                  style={{
                    fontSize: 11.5,
                    padding: '5px 10px',
                    background: c.surface,
                    border: `1px solid ${c.borderInput}`,
                    borderRadius: 2,
                    color: c.inkStrong,
                  }}
                >
                  {article.source} <span style={{ color: c.inkFaint }}>↗</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
