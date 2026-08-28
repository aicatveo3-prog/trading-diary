'use client';

import { useState, useMemo, useCallback } from 'react';
import { c, font } from '@/lib/tokens';
import { PERIODS, PeriodKey, Resolution } from '@/lib/periods';
import { latestQuote, stockMeta, dateFor, closeSeries } from '@/lib/price-data';
import { newsFor, sentimentSummary } from '@/lib/news-data';
import { hasMinutes } from '@/lib/minute-data';
import { buildNewsPins } from '@/lib/news-pins';
import { shortDate } from '@/lib/format';

import StockHeaderCard from '@/components/stock/StockHeaderCard';
import PeriodSelector from '@/components/stock/PeriodSelector';
import PinnedChart from '@/components/stock/PinnedChart';
import IntradayChart from '@/components/stock/IntradayChart';
import GroupedNewsTimeline from '@/components/news/GroupedNewsTimeline';
import PromiseCard from '@/components/panels/PromiseCard';
import DataFreshness from '@/components/layout/DataFreshness';

/** 차트에 꽂을 핀 개수 상한 — 이보다 많으면 차트가 읽히지 않는다 */
const MAX_PINS = 5;

interface StockDetailViewProps {
  ticker: string;
}

export default function StockDetailView({ ticker }: StockDetailViewProps) {
  const [period, setPeriod] = useState<PeriodKey>('1M');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [watched, setWatched] = useState(false);

  const meta = stockMeta(ticker);
  const quote = latestQuote(ticker);
  const sentiment = sentimentSummary(ticker);
  const allArticles = newsFor(ticker);

  // '전체'는 큰 값을 두었으므로 보유 데이터 길이로 잘라낸다
  const available = closeSeries(ticker).length;
  const selectedPeriod = PERIODS.find(p => p.key === period);
  const periodDays = Math.min(selectedPeriod?.days ?? 22, available);
  const periodLabel = selectedPeriod?.label ?? '';
  const resolution = selectedPeriod?.resolution ?? 'day';
  const isIntraday = resolution === 'minute';
  const minuteInterval = (selectedPeriod as { interval?: 5 | 30 })?.interval ?? 5;
  const hasIntraday = hasMinutes(ticker);

  // 뉴스를 거래일 축에 매핑하고 핀을 선정한다
  const { pins, allGroups, pending } = useMemo(
    () => buildNewsPins(ticker, periodDays, MAX_PINS),
    [ticker, periodDays]
  );

  const pinnedDates = useMemo(() => new Set(pins.map(p => p.tradingDate)), [pins]);

  /** 차트 핀 클릭 → 해당 날짜 선택 + 타임라인으로 스크롤 */
  const handlePinSelect = useCallback((tradingDate: string) => {
    setSelectedDate(tradingDate);
    requestAnimationFrame(() => {
      document
        .getElementById(`day-${tradingDate}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  if (!meta) {
    return (
      <div className="gc-shell">
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, padding: '40px 26px' }}>
          <p style={{ margin: 0, fontSize: 14, color: c.inkMid }}>
            아직 수집 대상이 아닌 종목입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gc-shell">
      {/* 본문 */}
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {/* 종목 헤더 + 차트 */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}` }}>
          <StockHeaderCard
            name={meta.name}
            ticker={meta.ticker}
            market={meta.market}
            price={quote.price}
            changeRate={quote.changeRate}
            changeAmount={quote.changeAmount}
            asOf={`${shortDate(dateFor(0))} 장마감`}
            watched={watched}
            onToggleWatch={() => setWatched(v => !v)}
          />

          {/* 핀 개수 안내 + 기간 선택 */}
          <div
            style={{
              padding: '0 26px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              borderBottom: `1px solid ${c.borderSoft}`,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 12.5, color: c.inkMid }}>
              {isIntraday ? (
                <>
                  최근 {periodLabel} · {minuteInterval}분봉
                  {!hasIntraday && ' · 분봉 데이터 없음'}
                </>
              ) : (
                <>
                  최근 {periodLabel} · 거래일 {periodDays}일
                  {' · '}뉴스 핀 <strong style={{ color: c.ink }}>{pins.length}개</strong>
                </>
              )}
              <DataFreshness prefix=" · " />
            </div>
            <PeriodSelector selected={period} onChange={setPeriod} />
          </div>

          {/* 분봉 구간과 일봉 구간은 시간축과 사용 가능한 데이터가 달라 컴포넌트를 분리했다 */}
          {isIntraday ? (
            <IntradayChart ticker={ticker} days={periodDays} interval={minuteInterval} />
          ) : (
            <PinnedChart
              ticker={ticker}
              periodDays={periodDays}
              resolution={resolution}
              pins={pins}
              selectedDate={selectedDate}
              onSelect={handlePinSelect}
            />
          )}
        </div>

        {/* 날짜별 뉴스 타임라인 */}
        <GroupedNewsTimeline
          groups={allGroups}
          pinnedDates={pinnedDates}
          pending={pending}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* 사이드바 */}
      <aside className="gc-aside">
        {/* 감성 분포 */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, padding: '18px 20px' }}>
          <div style={{ fontFamily: font.serif, fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
            뉴스 감성 분포
          </div>
          <div style={{ fontSize: 11, color: c.inkFaint, marginBottom: 15 }}>
            수집된 {allArticles.length}건 기준
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <StatBox label="긍정" count={sentiment.positive} color="#17805a" />
            <StatBox label="중립" count={sentiment.neutral} color="#6f747c" />
            <StatBox label="부정" count={sentiment.negative} color="#c0392b" />
          </div>
          {allArticles.length > 0 && (
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(sentiment.positive / allArticles.length) * 100}%`,
                  background: '#17805a',
                }}
              />
              <div
                style={{
                  width: `${(sentiment.neutral / allArticles.length) * 100}%`,
                  background: '#d9dade',
                }}
              />
              <div
                style={{
                  width: `${(sentiment.negative / allArticles.length) * 100}%`,
                  background: '#c0392b',
                }}
              />
            </div>
          )}
          <div style={{ fontSize: 10.5, color: c.inkFaint, marginTop: 10, lineHeight: 1.55 }}>
            제목의 키워드로 자동 분류합니다. 문맥을 읽지 못해 오분류가 있을 수 있습니다.
          </div>
        </div>

        {/* 읽는 법 */}
        <div
          style={{
            border: `1px solid ${c.borderAlt}`,
            background: c.surfaceAlt,
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.09em',
              color: c.inkSoft,
              marginBottom: 7,
            }}
          >
            핀을 읽는 법
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 12, lineHeight: 1.7, color: c.inkStrong }}>
            차트 위 번호를 클릭하면 그날 어떤 기사가 났는지 아래에서 바로 볼 수 있습니다.
          </p>
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.65, color: c.inkMid }}>
            핀은 <strong style={{ color: c.ink }}>기사가 많이 났고 주가도 크게 움직인 날</strong>에
            꽂힙니다. 주말·휴일 기사는 다음 거래일로 묶입니다.
          </p>
        </div>

        <PromiseCard />
      </aside>
    </div>
  );
}

function StatBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '10px 0',
        background: c.surfaceAlt,
        borderRadius: 4,
      }}
    >
      <div style={{ fontFamily: font.serif, fontSize: 20, fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: 10.5, color: c.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );
}
