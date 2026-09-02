'use client';

import { useState } from 'react';
import { c, font } from '@/lib/tokens';
import { NewsItem, RelatedArticle } from '@/lib/news-data';
import { NewsPin, totalArticleCount } from '@/lib/news-pins';
import { pct, shortDate } from '@/lib/format';
import { dateFor } from '@/lib/price-data';
import { useConvention } from '@/lib/convention-context';

interface GroupedNewsTimelineProps {
  /** 거래일별로 묶인 뉴스 그룹 (최신순) */
  groups: NewsPin[];
  /** 차트에 핀으로 꽂힌 거래일 목록 */
  pinnedDates: Set<string>;
  /** 아직 주가에 반영되지 않은 기사 */
  pending: NewsItem[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export default function GroupedNewsTimeline({
  groups,
  pinnedDates,
  pending,
  selectedDate,
  onSelectDate,
}: GroupedNewsTimelineProps) {
  const grandTotal = groups.reduce((sum, g) => sum + totalArticleCount(g.articles), 0);

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      {/* 헤더 */}
      <div
        style={{
          padding: '18px 26px 14px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
          borderBottom: `1px solid ${c.borderSoft}`,
        }}
      >
        <span style={{ fontFamily: font.serif, fontSize: 16, fontWeight: 700 }}>
          날짜별 타임라인
        </span>
        <span style={{ fontSize: 11.5, color: c.inkFaint }}>
          {groups.length}일 · 기사 {grandTotal}건
        </span>
        {selectedDate && (
          <button
            className="gc-btn-outline"
            onClick={() => onSelectDate(null)}
            style={{
              marginLeft: 'auto',
              height: 26,
              padding: '0 10px',
              background: c.surface,
              border: `1px solid ${c.borderBtn}`,
              fontSize: 11,
              color: c.inkStrong,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            선택 해제
          </button>
        )}
      </div>

      {/* 아직 주가에 반영되지 않은 기사 */}
      {pending.length > 0 && (
        <div
          style={{
            padding: '13px 26px',
            background: c.surfaceAlt,
            borderBottom: `1px solid ${c.borderSoft}`,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: c.inkSoft,
              marginBottom: 8,
            }}
          >
            아직 주가에 반영되지 않은 소식 {pending.length}건
          </div>
          {pending.slice(0, 4).map(a => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                fontSize: 12.5,
                lineHeight: 1.5,
                marginBottom: 5,
                color: c.inkBody,
                textDecoration: 'none',
              }}
            >
              {sentimentDot(a.sentiment)} {a.title}
              <span style={{ color: c.inkFaint, fontSize: 11 }}> · {a.source}</span>
            </a>
          ))}
          <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 6, lineHeight: 1.5 }}>
            장마감 이후 또는 휴장일에 보도된 기사입니다. 다음 거래일 주가에 반영될 수 있습니다.
          </div>
        </div>
      )}

      {/* 거래일별 그룹 */}
      <div>
        {groups.length === 0 ? (
          <div style={{ padding: '38px 26px', textAlign: 'center', fontSize: 13, color: c.inkSoft }}>
            이 기간에 수집된 뉴스가 없습니다.
          </div>
        ) : (
          groups.map(group => (
            <DayGroup
              key={group.tradingDate}
              group={group}
              isPinned={pinnedDates.has(group.tradingDate)}
              isSelected={selectedDate === group.tradingDate}
              onClick={() =>
                onSelectDate(selectedDate === group.tradingDate ? null : group.tradingDate)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function sentimentDot(sentiment: string): string {
  return sentiment === 'positive' ? '🟢' : sentiment === 'negative' ? '🔴' : '⚪';
}

interface DayGroupProps {
  group: NewsPin;
  isPinned: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function DayGroup({ group, isPinned, isSelected }: DayGroupProps) {
  const { colors } = useConvention();
  const dirColor = group.changeRate >= 0 ? colors.up : colors.down;
  const dayTotal = totalArticleCount(group.articles);

  return (
    <div
      id={`day-${group.tradingDate}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '4px 1fr',
        borderBottom: `1px solid ${c.borderFaint}`,
        // 선택된 날짜는 배경으로 강조 — 차트 핀에서 스크롤해 왔을 때 눈에 띄어야 한다
        background: isSelected ? c.surfaceAlt : 'transparent',
      }}
    >
      <div style={{ background: isSelected ? dirColor : 'transparent' }} />

      <div style={{ padding: '16px 26px' }}>
        {/* 날짜 헤더 — 그날의 등락과 기사 수 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: font.serif,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {shortDate(dateFor(group.daysAgo))}
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: dirColor,
            }}
          >
            {pct(group.changeRate)}
          </span>
          <span style={{ fontSize: 11.5, color: c.inkFaint }}>기사 {dayTotal}건</span>
          {isPinned && (
            <span
              style={{
                fontSize: 10,
                padding: '2px 7px',
                background: c.ink,
                color: c.surface,
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              핀 {group.number}
            </span>
          )}
        </div>

        {/* 그날의 기사들 */}
        <div style={{ display: 'grid', gap: 12 }}>
          {group.articles.map(article => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 개별 기사 행 — description 표시 + related 접기/펼치기 */
function ArticleRow({ article }: { article: NewsItem }) {
  const [expanded, setExpanded] = useState(false);
  const related = article.related ?? [];
  const hasRelated = related.length > 0;

  return (
    <div>
      {/* 대표 기사 */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="gc-fade"
        style={{
          display: 'grid',
          gridTemplateColumns: '18px 1fr',
          gap: 9,
          alignItems: 'start',
          color: c.ink,
          textDecoration: 'none',
        }}
      >
        <span style={{ fontSize: 11, marginTop: 3 }}>{sentimentDot(article.sentiment)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }}>
            {article.title}
          </div>
          {/* RSS description 요약 */}
          {article.description && (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: c.inkMid,
                marginTop: 4,
                // 2줄까지만 표시
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {article.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: c.inkFaint, marginTop: 3 }}>
            {article.source}
            {' · '}
            {formatTime(article.publishedAt)}
            {' · '}
            <span style={{ color: c.link }}>원문 ↗</span>
          </div>
        </div>
      </a>

      {/* "외 N건" 토글 — 같은 이야기를 다룬 다른 언론사 기사 */}
      {hasRelated && (
        <div style={{ marginLeft: 27, marginTop: 5 }}>
          <button
            onClick={() => setExpanded(prev => !prev)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '3px 0',
              fontSize: 11.5,
              color: c.inkSoft,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
              fontSize: 9,
            }}>
              ▶
            </span>
            유사 보도 {related.length}건
          </button>

          {expanded && (
            <div style={{ marginTop: 4, paddingLeft: 2, display: 'grid', gap: 4 }}>
              {related.map((r: RelatedArticle) => (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gc-fade"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: c.inkMid,
                    textDecoration: 'none',
                    paddingLeft: 8,
                    borderLeft: `2px solid ${c.borderSoft}`,
                  }}
                >
                  {r.title.length > 55 ? r.title.slice(0, 55) + '…' : r.title}
                  <span style={{ color: c.inkFaint, fontSize: 10.5 }}> · {r.source}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
