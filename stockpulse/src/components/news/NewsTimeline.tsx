'use client';

import { NewsArticle } from '@/types';
import { relativeTime, sentimentColor } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface NewsTimelineProps {
  news: NewsArticle[];
  maxItems?: number;
  compact?: boolean;
}

export default function NewsTimeline({ news, maxItems = 10, compact = false }: NewsTimelineProps) {
  const displayNews = news.slice(0, maxItems);

  if (displayNews.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        관련 뉴스가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {displayNews.map((article) => (
        <NewsTimelineItem key={article.id} article={article} compact={compact} />
      ))}
    </div>
  );
}

function NewsTimelineItem({ article, compact }: { article: NewsArticle; compact: boolean }) {
  const sentimentEmoji = {
    positive: '🟢',
    negative: '🔴',
    neutral: '⚪',
  };

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
    >
      {/* 감성 인디케이터 */}
      <div className="flex-shrink-0 mt-0.5">
        <span className="text-sm">{sentimentEmoji[article.sentiment_label]}</span>
      </div>

      {/* 뉴스 내용 */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-slate-200 group-hover:text-white transition-colors line-clamp-2',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {article.title}
        </p>
        
        {!compact && article.summary && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
            {article.summary}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-slate-500">{article.source}</span>
          <span className="text-[10px] text-slate-600">·</span>
          <span className="text-[10px] text-slate-500">{relativeTime(article.published_at)}</span>
          {article.sentiment_score !== undefined && (
            <>
              <span className="text-[10px] text-slate-600">·</span>
              <span
                className="text-[10px] font-medium"
                style={{ color: sentimentColor(article.sentiment_label) }}
              >
                {article.sentiment_score > 0 ? '+' : ''}{(article.sentiment_score * 100).toFixed(0)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 외부 링크 아이콘 */}
      <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
