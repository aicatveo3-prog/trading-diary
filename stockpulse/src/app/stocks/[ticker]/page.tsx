'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import StockChart from '@/components/charts/StockChart';
import TimeRangeSelector from '@/components/charts/TimeRangeSelector';
import StockHeader from '@/components/stock/StockHeader';
import AISummaryCard from '@/components/stock/AISummaryCard';
import SentimentGauge from '@/components/stock/SentimentGauge';
import NewsTimeline from '@/components/news/NewsTimeline';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { mockStocks, mockNews, mockPrices, generateMockCandles } from '@/lib/mock-data';
import { sentimentColor } from '@/lib/utils';
import { ChartMarker, NewsArticle } from '@/types';
import { Newspaper, Calendar } from 'lucide-react';

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y';

export default function StockDetailPage() {
  const params = useParams();
  const ticker = params.ticker as string;
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [isWatched, setIsWatched] = useState(false);

  // 목업 데이터로 해당 종목 찾기
  const stock = mockStocks.find(s => s.ticker === ticker) || mockStocks[0];
  const latestPrice = {
    ...mockPrices[0],
    stock_id: stock.id,
  };

  // 캔들 데이터 생성 (시간 범위에 따라)
  const rangeDays: Record<TimeRange, number> = {
    '1D': 1,
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '1Y': 365,
  };

  const candles = useMemo(() => generateMockCandles(rangeDays[timeRange]), [timeRange]);

  // 해당 종목 관련 뉴스 (목업)
  const relatedNews: NewsArticle[] = mockNews.filter(n => {
    // 간이 매칭: 제목에 종목명이 포함되면 연관 뉴스
    return n.title.includes(stock.name) || 
           n.title.includes('반도체') && stock.sector === '반도체' ||
           n.title.includes('AI') && stock.sector === '인터넷';
  });

  // 모든 뉴스가 매칭 안 되면 기본 목업 뉴스 표시
  const displayNews = relatedNews.length > 0 ? relatedNews : mockNews.slice(0, 4);

  // 뉴스를 차트 마커로 변환
  const newsMarkers: ChartMarker[] = displayNews.map(n => ({
    time: n.published_at.split('T')[0],
    position: n.sentiment_label === 'negative' ? 'belowBar' as const : 'aboveBar' as const,
    color: sentimentColor(n.sentiment_label),
    shape: n.sentiment_label === 'positive' ? 'arrowUp' as const : n.sentiment_label === 'negative' ? 'arrowDown' as const : 'circle' as const,
    text: n.title.substring(0, 8),
    news_id: n.id,
  }));

  // 감성 분석 집계
  const sentimentStats = useMemo(() => {
    const positive = displayNews.filter(n => n.sentiment_label === 'positive').length;
    const negative = displayNews.filter(n => n.sentiment_label === 'negative').length;
    const neutral = displayNews.filter(n => n.sentiment_label === 'neutral').length;
    const scores = displayNews.map(n => n.sentiment_score || 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { positive, negative, neutral, averageScore: avg };
  }, [displayNews]);

  // AI 요약 (목업)
  const aiSummary = `${stock.name}은(는) 오늘 ${latestPrice.change_rate > 0 ? '상승' : '하락'}세를 보이고 있습니다. 외국인의 연속 순매도에도 불구하고 HBM3E 품질 테스트 통과 소식이 긍정적으로 작용하며 하방을 제한하는 것으로 보입니다. 반도체 업황 전반에 대한 불확실성이 단기 변동성을 확대할 수 있습니다.`;

  return (
    <div className="space-y-6">
      {/* 종목 헤더 */}
      <StockHeader
        stock={stock}
        latestPrice={latestPrice}
        isWatched={isWatched}
        onToggleWatch={() => setIsWatched(!isWatched)}
      />

      {/* AI 요약 */}
      <AISummaryCard summary={aiSummary} date={latestPrice.date} />

      {/* 차트 섹션 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>주가 차트</CardTitle>
          <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
        </CardHeader>
        <CardContent className="p-0">
          <StockChart
            candles={candles}
            markers={newsMarkers}
            height={420}
          />
        </CardContent>
        <div className="px-5 py-3 border-t border-slate-800 flex items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            긍정 뉴스
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            부정 뉴스
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
            중립 뉴스
          </span>
          <span className="ml-auto">📌 마커를 클릭하면 관련 뉴스를 볼 수 있습니다</span>
        </div>
      </Card>

      {/* 하단: 뉴스 타임라인 + 감성 분석 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 뉴스 타임라인 (2/3) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-blue-400" />
                <CardTitle>관련 뉴스 타임라인</CardTitle>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full ml-auto">
                  {displayNews.length}건
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <NewsTimeline news={displayNews} maxItems={10} />
            </CardContent>
          </Card>
        </div>

        {/* 감성 분석 (1/3) */}
        <div className="space-y-6">
          <SentimentGauge
            positiveCount={sentimentStats.positive}
            negativeCount={sentimentStats.negative}
            neutralCount={sentimentStats.neutral}
            averageScore={sentimentStats.averageScore}
          />

          {/* 종목 정보 카드 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <CardTitle>종목 정보</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <InfoRow label="시장" value={stock.market} />
                <InfoRow label="섹터" value={stock.sector || '-'} />
                <InfoRow label="시가총액" value={stock.market_cap ? `${(stock.market_cap / 10000).toFixed(1)}조` : '-'} />
                <InfoRow label="거래량" value={latestPrice.volume.toLocaleString()} />
                <InfoRow label="시가" value={`${latestPrice.open.toLocaleString()}원`} />
                <InfoRow label="고가" value={`${latestPrice.high.toLocaleString()}원`} />
                <InfoRow label="저가" value={`${latestPrice.low.toLocaleString()}원`} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  );
}
