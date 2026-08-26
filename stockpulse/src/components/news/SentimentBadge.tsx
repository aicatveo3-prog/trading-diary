'use client';

import { SentimentLabel } from '@/types';

interface SentimentBadgeProps {
  label: SentimentLabel;
  score?: number;
  size?: 'sm' | 'md';
}

export default function SentimentBadge({ label, score, size = 'sm' }: SentimentBadgeProps) {
  const config = {
    positive: {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      border: 'border-green-500/20',
      label: '긍정',
    },
    negative: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/20',
      label: '부정',
    },
    neutral: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/20',
      label: '중립',
    },
  };

  const { bg, text, border, label: labelText } = config[label];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${bg} ${text} ${border} ${sizeClasses} font-medium`}>
      {labelText}
      {score !== undefined && (
        <span className="opacity-75">
          {score > 0 ? '+' : ''}{(score * 100).toFixed(0)}
        </span>
      )}
    </span>
  );
}
