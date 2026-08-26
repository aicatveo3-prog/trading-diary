'use client';

import { c, font } from '@/lib/tokens';
import { SimilarCases } from '@/lib/event-selectors';
import { dateFor } from '@/lib/price-data';
import { pct, shortDate } from '@/lib/format';
import { useConvention } from '@/lib/convention-context';

interface SimilarCasesPanelProps {
  data: SimilarCases;
  stockName: string;
}

/**
 * 유사 사례
 *
 * 같은 유형의 뉴스가 과거에 났을 때 어떻게 갈렸는지 "분포"를 보여준다.
 * 평균이나 예상치를 계산해 보여주지 않는 것이 의도다 — 평균은 예측처럼 읽힌다.
 */
export default function SimilarCasesPanel({ data, stockName }: SimilarCasesPanelProps) {
  const { colors } = useConvention();

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, padding: '18px 20px' }}>
      <div style={{ fontFamily: font.serif, fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
        유사 사례
      </div>
      <div style={{ fontSize: 11, color: c.inkFaint, marginBottom: 15 }}>
        ‘{data.type}’ 뉴스가 {stockName}에 났던 지난 {data.count}번
      </div>

      {/* 분포 요약 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '13px 14px',
          background: c.surfaceAlt,
          marginBottom: 14,
        }}
      >
        <span style={{ fontFamily: font.serif, fontSize: 24, fontWeight: 700 }}>{data.upCount}</span>
        <span style={{ fontSize: 12, color: c.inkMid, lineHeight: 1.4 }}>
          번은 당일 상승, {data.downCount}번은 하락했습니다.
        </span>
      </div>

      {/* 개별 사례 */}
      <div style={{ display: 'grid', gap: 9 }}>
        {data.rows.map((row, i) => (
          <div
            key={`${row.daysAgo}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr 46px',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 11, color: c.inkSoft }}>{shortDate(dateFor(row.daysAgo))}</span>
            <span className="gc-clamp-1" style={{ fontSize: 11.5 }}>
              {row.headline}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                textAlign: 'right',
                color: row.dayChange >= 0 ? colors.up : colors.down,
              }}
            >
              {pct(row.dayChange)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: c.inkFaint, lineHeight: 1.55, marginTop: 14 }}>
        과거 반응이 앞으로를 보장하지 않습니다. 분포를 보는 용도입니다.
      </div>
    </div>
  );
}
