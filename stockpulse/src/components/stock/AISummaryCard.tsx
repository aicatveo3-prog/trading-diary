'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Bot, Sparkles } from 'lucide-react';

interface AISummaryCardProps {
  summary: string;
  date?: string;
  isLoading?: boolean;
}

export default function AISummaryCard({ summary, date, isLoading = false }: AISummaryCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 animate-pulse">
              <Bot className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/20 bg-purple-500/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-purple-400">AI 분석</span>
              {date && <span className="text-[10px] text-slate-600">{date} 기준</span>}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {summary}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
