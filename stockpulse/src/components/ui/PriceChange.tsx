'use client';

import { formatChangeRate, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriceChangeProps {
  price: number;
  changeRate: number;
  changeAmount?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export default function PriceChange({
  price,
  changeRate,
  changeAmount,
  size = 'md',
  showIcon = true,
}: PriceChangeProps) {
  const isUp = changeRate > 0;
  const isDown = changeRate < 0;

  const colorClass = isUp ? 'text-red-400' : isDown ? 'text-blue-400' : 'text-slate-400';
  
  const sizeConfig = {
    sm: { price: 'text-sm', change: 'text-xs', icon: 12 },
    md: { price: 'text-xl', change: 'text-sm', icon: 16 },
    lg: { price: 'text-3xl', change: 'text-base', icon: 20 },
  };

  const { price: priceClass, change: changeClass, icon: iconSize } = sizeConfig[size];

  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className="flex items-baseline gap-2">
      <span className={`${priceClass} font-bold text-white`}>
        {formatNumber(price)}
      </span>
      <div className={`flex items-center gap-1 ${colorClass}`}>
        {showIcon && <Icon size={iconSize} />}
        <span className={`${changeClass} font-medium`}>
          {formatChangeRate(changeRate)}
        </span>
        {changeAmount !== undefined && (
          <span className={`${changeClass} opacity-70`}>
            ({changeAmount > 0 ? '+' : ''}{formatNumber(changeAmount)})
          </span>
        )}
      </div>
    </div>
  );
}
