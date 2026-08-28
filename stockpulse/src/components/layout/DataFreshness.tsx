'use client';

import { useEffect, useState } from 'react';
import { c } from '@/lib/tokens';
import { collectedAt } from '@/lib/price-data';

/**
 * 데이터 수집 시각을 상대 시간으로 표시한다 ("3시간 전 갱신").
 *
 * 왜 클라이언트에서 계산하는가:
 *   정적 export(SSG)이므로 서버 렌더는 빌드 시점에 한 번만 일어난다.
 *   빌드 때 "0시간 전"을 렌더하면 그 문자열이 HTML에 박혀서, 일주일 뒤에
 *   방문해도 "0시간 전"으로 보인다. 상대 시간은 반드시 브라우저에서
 *   현재 시각과 비교해 계산해야 한다.
 *
 * 왜 첫 렌더에 아무것도 안 그리는가:
 *   서버 HTML과 클라이언트 첫 렌더가 다르면 React가 하이드레이션 불일치
 *   경고를 낸다. mounted 플래그로 첫 페인트를 비워두고 useEffect 이후에
 *   채우면 서버·클라이언트가 항상 일치한다.
 *
 * 임계값 근거:
 *   워크플로는 평일 16:40 KST에만 돈다. 금요일 수집 후 월요일 오후까지
 *   최대 72시간이 정상이고, 설날·추석에는 120시간까지 벌어진다.
 *   그래서 5일을 넘을 때만 경고색을 쓴다 — 주말마다 빨간불이 켜지면
 *   경고가 무의미해진다.
 */

/** 이 시간을 넘으면 수집이 멈춘 것으로 본다 (연휴를 고려한 값) */
const STALE_HOURS = 24 * 5;

function formatRelative(from: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60000);

  if (minutes < 0) return '방금'; // 시간대 오차 등으로 미래로 계산된 경우
  if (minutes < 2) return '방금';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

interface DataFreshnessProps {
  /** 앞에 붙일 구분자 (예: ' · ') */
  prefix?: string;
}

export default function DataFreshness({ prefix = '' }: DataFreshnessProps) {
  const [state, setState] = useState<{ label: string; stale: boolean } | null>(null);

  useEffect(() => {
    const iso = collectedAt();

    const compute = () => {
      const collected = new Date(iso);
      if (Number.isNaN(collected.getTime())) {
        setState(null);
        return;
      }
      const now = new Date();
      const hours = (now.getTime() - collected.getTime()) / 3600000;
      setState({ label: formatRelative(collected, now), stale: hours > STALE_HOURS });
    };

    compute();
    // 탭을 오래 열어두면 표시가 낡는다. 1분마다 다시 계산한다.
    const timer = setInterval(compute, 60_000);
    return () => clearInterval(timer);
  }, []);

  // 첫 페인트에는 렌더하지 않는다 (하이드레이션 불일치 방지)
  if (!state) return null;

  return (
    <span style={{ color: state.stale ? '#c0392b' : c.inkFaint }}>
      {prefix}
      {state.stale && '⚠ '}
      {state.label} 갱신
      {state.stale && ' — 자동 수집이 멈췄을 수 있습니다'}
    </span>
  );
}
