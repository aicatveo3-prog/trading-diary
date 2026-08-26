'use client';

import { NewsArticle } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import NewsTimeline from '@/components/news/NewsTimeline';
import { Newspaper } from 'lucide-react';

interface TodayNewsCardProps {
  news: NewsArticle[];
}

export default function TodayNewsCard({ news }: TodayNewsCardProps) {
  // 주요 뉴스만 필터 (is_major) 또는 최신 5개
  const majorNews = news.filter(n => n.is_major).slice(0, 5);
  const displayNews = majorNews.length > 0 ? majorNews : news.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-blue-400" />
          <CardTitle>오늘의 핵심 뉴스</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <NewsTimeline news={displayNews} maxItems={5} compact />
      </CardContent>
    </Card>
  );
}
