'use client';

import { c, font } from '@/lib/tokens';
import { NewsItem } from '@/lib/news-data';
import { useConvention } from '@/lib/convention-context';

interface RealNewsTimelineProps {
  news: NewsItem[];
  /** 필터: 전체 / positive / negative / neutral */
  filter: string;
  onFilterChange: (f: string) => void;
}

export default function RealNewsTimeline({ news, filter, onFilterChange }: RealNewsTimelineProps) {
  const filtered = filter === '전체' ? news : news.filter(n => n.sentiment === filter);
  const filters = ['전체', 'positive', 'negative', 'neutral'];
  const filterLabels: Record<string, string> = {
    '전체': '전체',
    positive: '긍정',
    negative: '부정',
    neutral: '중립',
  };

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
      {/* 헤더 */}
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
        <span style={{ fontSize: 11.5, color: c.inkFaint }}>{news.length}건</span>

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {filters.map(f => {
            const active = filter === f;
            return (
              <button
                key={f}
                className="gc-chip"
                onClick={() => onFilterChange(f)}
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
                {filterLabels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 기사 목록 */}
      <div>
        {filtered.length === 0 ? (
          <div style={{ padding: '38px 26px', textAlign: 'center', fontSize: 13, color: c.inkSoft }}>
            이 조건에 맞는 뉴스가 없습니다.
          </div>
        ) : (
          filtered.map(article => (
            <NewsRow key={article.id} article={article} />
          ))
        )}
      </div>
    </div>
  );
}

function NewsRow({ article }: { article: NewsItem }) {
  const { colors } = useConvention();

  const sentimentEmoji = {
    positive: '🟢',
    negative: '🔴',
    neutral: '⚪',
  };

  const pubDate = new Date(article.publishedAt);
  const dateStr = `${String(pubDate.getMonth() + 1).padStart(2, '0')}.${String(pubDate.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(pubDate.getHours()).padStart(2, '0')}:${String(pubDate.getMinutes()).padStart(2, '0')}`;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="gc-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '22px 62px 1fr',
        gap: 12,
        alignItems: 'start',
        padding: '14px 26px',
        borderBottom: `1px solid ${c.borderFaint}`,
        color: c.ink,
        textDecoration: 'none',
      }}
    >
      {/* 감성 인디케이터 */}
      <span style={{ fontSize: 12, marginTop: 2 }}>{sentimentEmoji[article.sentiment]}</span>

      {/* 날짜 */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.inkStrong }}>{dateStr}</div>
        <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 2 }}>{timeStr}</div>
      </div>

      {/* 기사 */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.55, marginBottom: 5 }}>
          {article.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: c.inkMid, fontWeight: 500 }}>{article.source}</span>
          <span style={{ fontSize: 10.5, color: c.inkFaint }}>↗ 원문 보기</span>
        </div>
      </div>
    </a>
  );
}
