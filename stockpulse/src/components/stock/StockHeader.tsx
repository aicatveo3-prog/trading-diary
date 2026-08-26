'use client';

import { Stock, StockPrice } from '@/types';
import PriceChange from '@/components/ui/PriceChange';
import Badge from '@/components/ui/Badge';
import { formatMarketCap } from '@/lib/utils';
import { Star } from 'lucide-react';

interface StockHeaderProps {
  stock: Stock;
  latestPrice: StockPrice;
  isWatched?: boolean;
  onToggleWatch?: () => void;
}

export default function StockHeader({ stock, latestPrice, isWatched = false, onToggleWatch }: StockHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        {/* 종목명 + 티커 */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{stock.name}</h1>
          <Badge variant="outline" size="md">{stock.ticker}</Badge>
          <Badge variant="neutral" size="md">{stock.market}</Badge>
          {stock.sector && <Badge variant="default" size="md">{stock.sector}</Badge>}
        </div>

        {/* 현재가 + 등락 */}
        <div className="mt-2">
          <PriceChange
            price={latestPrice.close}
            changeRate={latestPrice.change_rate}
            changeAmount={latestPrice.change_amount}
            size="lg"
          />
        </div>

        {/* 부가 정보 */}
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <span>거래량 {latestPrice.volume.toLocaleString()}</span>
          {stock.market_cap && <span>시가총액 {formatMarketCap(stock.market_cap)}</span>}
          <span>{latestPrice.date} 기준</span>
        </div>
      </div>

      {/* 워치리스트 버튼 */}
      <button
        onClick={onToggleWatch}
        className={`p-2 rounded-lg transition-all ${
          isWatched
            ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
            : 'bg-slate-800 text-slate-500 hover:text-yellow-400 hover:bg-slate-700'
        }`}
      >
        <Star size={20} fill={isWatched ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
