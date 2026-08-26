'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Activity } from 'lucide-react';

interface SentimentGaugeProps {
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  averageScore: number;
}

export default function SentimentGauge({
  positiveCount,
  negativeCount,
  neutralCount,
  averageScore,
}: SentimentGaugeProps) {
  const total = positiveCount + negativeCount + neutralCount;
  const positiveRatio = total > 0 ? (positiveCount / total) * 100 : 50;
  const negativeRatio = total > 0 ? (negativeCount / total) * 100 : 50;

  // 감성 스코어를 0~100 게이지로 변환 (-1~+1 → 0~100)
  const gaugeValue = ((averageScore + 1) / 2) * 100;

  const getLabel = () => {
    if (averageScore > 0.3) return '매우 긍정';
    if (averageScore > 0.1) return '약간 긍정';
    if (averageScore > -0.1) return '중립';
    if (averageScore > -0.3) return '약간 부정';
    return '매우 부정';
  };

  const getColor = () => {
    if (averageScore > 0.1) return 'text-green-400';
    if (averageScore < -0.1) return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <CardTitle>뉴스 감성 분석</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* 게이지 바 */}
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 via-slate-500 to-red-500 opacity-30 w-full"
          />
          <div
            className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg transition-all"
            style={{ left: `${gaugeValue}%` }}
          />
        </div>

        {/* 라벨 */}
        <div className="flex justify-between text-[10px] text-slate-600 mb-4">
          <span>부정</span>
          <span>중립</span>
          <span>긍정</span>
        </div>

        {/* 현재 감성 */}
        <div className="text-center mb-4">
          <span className={`text-lg font-bold ${getColor()}`}>{getLabel()}</span>
          <p className="text-xs text-slate-500 mt-0.5">
            평균 스코어: {averageScore > 0 ? '+' : ''}{averageScore.toFixed(2)}
          </p>
        </div>

        {/* 분포 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-green-500/5">
            <p className="text-lg font-bold text-green-400">{positiveCount}</p>
            <p className="text-[10px] text-slate-500">긍정</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-500/5">
            <p className="text-lg font-bold text-slate-400">{neutralCount}</p>
            <p className="text-[10px] text-slate-500">중립</p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/5">
            <p className="text-lg font-bold text-red-400">{negativeCount}</p>
            <p className="text-[10px] text-slate-500">부정</p>
          </div>
        </div>

        {/* 비율 바 */}
        {total > 0 && (
          <div className="flex h-2 rounded-full overflow-hidden mt-3">
            <div className="bg-green-500" style={{ width: `${positiveRatio}%` }} />
            <div className="bg-slate-600" style={{ width: `${100 - positiveRatio - negativeRatio}%` }} />
            <div className="bg-red-500" style={{ width: `${negativeRatio}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
