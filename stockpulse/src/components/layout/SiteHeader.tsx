'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { c, font, Convention } from '@/lib/tokens';
import { useConvention } from '@/lib/convention-context';
import { stockMetaMap } from '@/lib/price-data';

export default function SiteHeader() {
  const { convention, setConvention } = useConvention();
  const [query, setQuery] = useState('');
  const router = useRouter();

  const submitSearch = () => {
    const term = query.trim();
    if (!term) return;

    // 티커 직접 입력이면 그대로, 종목명이면 티커로 변환
    const metas = stockMetaMap();
    if (metas[term]) {
      router.push(`/stocks/${term}`);
      return;
    }

    const match = Object.values(metas).find(s => s.name === term);
    if (match) router.push(`/stocks/${match.ticker}`);
  };

  return (
    <header
      style={{
        height: 62,
        background: c.surface,
        borderBottom: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* 브랜드 */}
      <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: 9, color: c.ink }}>
        <span
          style={{
            fontFamily: font.serif,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
        >
          겹쳐
        </span>
        <span style={{ fontSize: 10.5, color: c.inkSoft, letterSpacing: '0.06em' }}>
          NEWS × PRICE
        </span>
      </Link>

      {/* 검색 */}
      <div
        className="gc-header-search"
        style={{
          flex: 1,
          maxWidth: 420,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          height: 36,
          padding: '0 13px',
          background: c.surfaceMuted,
          border: `1px solid ${c.borderInput}`,
          borderRadius: 3,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={c.inkSoft} strokeWidth="1.6">
          <circle cx="6.8" cy="6.8" r="4.7" />
          <path d="M10.4 10.4L14 14" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submitSearch();
          }}
          placeholder="삼성전자"
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            background: 'transparent',
            fontSize: 13.5,
            color: c.ink,
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 10.5, color: c.inkFaint, whiteSpace: 'nowrap' }}>종목명 · 티커</span>
      </div>

      {/* 색 관설 토글 — 한국식(상승 빨강) / 미국식(상승 초록) */}
      <div
        style={{
          display: 'flex',
          border: `1px solid ${c.border}`,
          borderRadius: 3,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {(['KR', 'US'] as Convention[]).map(key => {
          const active = convention === key;
          return (
            <button
              key={key}
              onClick={() => setConvention(key)}
              title={key === 'KR' ? '한국식 · 상승 빨강' : '미국식 · 상승 초록'}
              style={{
                fontSize: 11.5,
                fontWeight: active ? 700 : 500,
                padding: '6px 12px',
                background: active ? c.ink : 'transparent',
                color: active ? c.surface : c.inkSoft,
                border: 0,
                cursor: 'pointer',
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* 내비게이션 */}
      <nav
        className="gc-header-nav"
        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22, flexShrink: 0 }}
      >
        <Link href="/" style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>
          오늘
        </Link>
        <Link href="/watchlist" style={{ fontSize: 13, color: c.inkMid }}>
          워치리스트
        </Link>
        <div style={{ width: 29, height: 29, borderRadius: '50%', background: c.borderInput }} />
      </nav>
    </header>
  );
}
