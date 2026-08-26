'use client';

import { Stock, StockPrice } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatChangeRate, formatNumber } from '@/lib/utils';
import { Star } from 'lucide-react';
import Link from 'next/link';

interface WatchlistItem {
  stock: Stock;
  latestPrice: StockPrice;
}

interface WatchlistCardProps {
  items: WatchlistItem[];
}

export default function WatchlistCard({ items }: WatchlistCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          <CardTitle>내 워치리스트</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="p-5 text-center text-sm text-slate-500">
            관심 종목을 추가해보세요
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {items.map(({ stock, latestPrice }) => (
              <Link
                key={stock.id}
                href={`/stocks/${stock.ticker}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">{stock.name}</p>
                  <p className="text-[11px] text-slate-500">{stock.ticker} · {stock.market}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">
                    {formatNumber(latestPrice.close)}
                  </p>
                  <p className={`text-xs font-medium ${
                    latestPrice.change_rate > 0 ? 'text-red-400' : latestPrice.change_rate < 0 ? 'text-blue-400' : 'text-slate-400'
                  }`}>
                    {formatChangeRate(latestPrice.change_rate)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
