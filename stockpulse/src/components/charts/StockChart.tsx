'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  LineStyle,
} from 'lightweight-charts';
import { CandleData, ChartMarker, NewsArticle } from '@/types';
import { sentimentColor } from '@/lib/utils';

interface StockChartProps {
  candles: CandleData[];
  markers?: ChartMarker[];
  news?: NewsArticle[];
  height?: number;
  onMarkerClick?: (newsId: string) => void;
}

export default function StockChart({
  candles,
  markers = [],
  news = [],
  height = 400,
  onMarkerClick,
}: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 차트 생성
    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { color: '#0f172a' }, // slate-900
        textColor: '#94a3b8', // slate-400
      },
      grid: {
        vertLines: { color: '#1e293b' }, // slate-800
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: '#475569',
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#475569',
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#334155', // slate-700
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // 캔들스틱 시리즈 추가
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#ef4444', // red-500 (한국: 상승=빨강)
      downColor: '#3b82f6', // blue-500 (한국: 하락=파랑)
      borderUpColor: '#ef4444',
      borderDownColor: '#3b82f6',
      wickUpColor: '#ef4444',
      wickDownColor: '#3b82f6',
    });

    seriesRef.current = candleSeries;

    // 데이터 설정
    const chartData: CandlestickData<Time>[] = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(chartData);

    // 뉴스 마커 설정
    if (markers.length > 0) {
      const chartMarkers = markers.map(m => ({
        time: m.time as Time,
        position: m.position as 'aboveBar' | 'belowBar',
        color: m.color,
        shape: m.shape as 'circle' | 'arrowUp' | 'arrowDown',
        text: m.text.length > 15 ? m.text.substring(0, 15) + '…' : m.text,
      }));

      candleSeries.setMarkers(chartMarkers);
    }

    // 차트 크기 자동 조절
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // 차트를 최근 데이터에 맞춤
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, markers, height]);

  // 뉴스 마커로 변환
  const newsMarkers: ChartMarker[] = news.map(n => ({
    time: n.published_at.split('T')[0],
    position: n.sentiment_label === 'negative' ? 'belowBar' : 'aboveBar',
    color: sentimentColor(n.sentiment_label),
    shape: n.sentiment_label === 'positive' ? 'arrowUp' : n.sentiment_label === 'negative' ? 'arrowDown' : 'circle',
    text: n.title.substring(0, 10),
    news_id: n.id,
  }));

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />
      
      {/* 호버된 마커 툴팁 */}
      {hoveredMarker && (
        <div className="absolute top-2 left-2 bg-slate-800 border border-slate-700 rounded-lg p-3 max-w-sm z-10 shadow-xl">
          <p className="text-sm text-slate-200">{hoveredMarker}</p>
        </div>
      )}
    </div>
  );
}
