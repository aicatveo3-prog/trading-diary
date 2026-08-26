'use client';

import { MarketOverview } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { formatChangeRate } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketOverviewCardProps {
  data: MarketOverview;
}

export default function MarketOverviewCard({ data }: MarketOverviewCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
          시장 요약
        </h3>
        <div className="space-y-3">
          <MarketIndex
            name="KOSPI"
            value={data.kospi.value}
            changeRate={data.kospi.change_rate}
          />
          <MarketIndex
            name="KOSDAQ"
            value={data.kosdaq.value}
            changeRate={data.kosdaq.change_rate}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MarketIndex({ name, value, changeRate }: { name: string; value: number; changeRate: number }) {
  const isUp = changeRate > 0;
  const colorClass = isUp ? 'text-red-400' : 'text-blue-400';
  const bgClass = isUp ? 'bg-red-500/5' : 'bg-blue-500/5';
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${bgClass}`}>
      <div>
        <p className="text-xs text-slate-500 font-medium">{name}</p>
        <p className="text-lg font-bold text-white">{value.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className={`flex items-center gap-1 ${colorClass}`}>
        <Icon size={14} />
        <span className="text-sm font-semibold">{formatChangeRate(changeRate)}</span>
      </div>
    </div>
  );
}
