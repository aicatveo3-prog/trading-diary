'use client';

import { TopMover } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatChangeRate, formatNumber } from '@/lib/utils';
import { Flame } from 'lucide-react';
import Link from 'next/link';

interface TopMoversCardProps {
  movers: TopMover[];
}

export default function TopMoversCard({ movers }: TopMoversCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <CardTitle>급변 종목 TOP {movers.length}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-800/50">
          {movers.map((mover, idx) => (
            <TopMoverItem key={mover.stock.id} mover={mover} rank={idx + 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TopMoverItem({ mover, rank }: { mover: TopMover; rank: number }) {
  const { stock, price, top_news } = mover;
  const isUp = price.change_rate > 0;
  const colorClass = isUp ? 'text-red-400' : 'text-blue-400';

  return (
    <Link
      href={`/stocks/${stock.ticker}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors"
    >
      {/* 순위 */}
      <span className="text-xs font-bold text-slate-600 w-5">{rank}</span>

      {/* 종목 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{stock.name}</span>
          <span className={`text-xs font-bold ${colorClass}`}>
            {formatChangeRate(price.change_rate)}
          </span>
        </div>
        {top_news && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {isUp ? '🟢' : '🔴'} {top_news.title}
          </p>
        )}
      </div>

      {/* 현재가 */}
      <span className="text-xs text-slate-400 font-medium">
        {formatNumber(price.close)}
      </span>
    </Link>
  );
}
