'use client';

import MarketOverviewCard from '@/components/dashboard/MarketOverviewCard';
import TopMoversCard from '@/components/dashboard/TopMoversCard';
import TodayNewsCard from '@/components/dashboard/TodayNewsCard';
import WatchlistCard from '@/components/dashboard/WatchlistCard';
import { mockMarketOverview, mockTopMovers, mockNews, mockStocks, mockPrices } from '@/lib/mock-data';

export default function DashboardPage() {
  // 목업 워치리스트 데이터
  const watchlistItems = mockStocks.slice(0, 5).map((stock, idx) => ({
    stock,
    latestPrice: {
      ...mockPrices[0],
      stock_id: stock.id,
      close: [72400, 178000, 52300, 215000, 253000][idx] || 72400,
      change_rate: [-1.23, 2.14, -0.51, 0.95, 4.5][idx] || 0,
      change_amount: [-900, 3700, -270, 2000, 11000][idx] || 0,
    },
  }));

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-sm text-slate-500 mt-1">
          오늘의 시장 동향과 주요 뉴스를 한눈에 확인하세요
        </p>
      </div>

      {/* 상단: 시장 요약 + 급변 종목 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 시장 요약 + 워치리스트 */}
        <div className="space-y-6">
          <MarketOverviewCard data={mockMarketOverview} />
          <WatchlistCard items={watchlistItems} />
        </div>

        {/* 중앙: 급변 종목 */}
        <div className="lg:col-span-2">
          <TopMoversCard movers={mockTopMovers} />
        </div>
      </div>

      {/* 하단: 오늘의 핵심 뉴스 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayNewsCard news={mockNews} />

        {/* 시장 감성 요약 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span className="text-lg">🧠</span>
            시장 감성 종합
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
              <p className="text-2xl font-bold text-green-400">4</p>
              <p className="text-[11px] text-slate-500 mt-1">긍정 뉴스</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-500/5 border border-slate-500/10">
              <p className="text-2xl font-bold text-slate-400">2</p>
              <p className="text-[11px] text-slate-500 mt-1">중립 뉴스</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <p className="text-2xl font-bold text-red-400">2</p>
              <p className="text-[11px] text-slate-500 mt-1">부정 뉴스</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex h-2 rounded-full overflow-hidden">
              <div className="bg-green-500" style={{ width: '50%' }} />
              <div className="bg-slate-600" style={{ width: '25%' }} />
              <div className="bg-red-500" style={{ width: '25%' }} />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              오늘 수집된 뉴스 8건 중 긍정 50% · 중립 25% · 부정 25%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
