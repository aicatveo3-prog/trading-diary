import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * HTML 태그 제거
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
}

/**
 * 숫자를 한국식 포맷으로 변환
 * 예: 1234567 → "1,234,567"
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num);
}

/**
 * 등락률 포맷 (+2.34%, -1.23%)
 */
export function formatChangeRate(rate: number): string {
  const prefix = rate > 0 ? '+' : '';
  return `${prefix}${rate.toFixed(2)}%`;
}

/**
 * 가격 포맷 (원)
 */
export function formatPrice(price: number): string {
  return `${formatNumber(price)}원`;
}

/**
 * 시가총액 포맷 (조/억)
 */
export function formatMarketCap(cap: number): string {
  if (cap >= 10000) {
    return `${(cap / 10000).toFixed(1)}조`;
  }
  return `${formatNumber(cap)}억`;
}

/**
 * 감성 스코어 → 색상
 */
export function sentimentColor(label: 'positive' | 'negative' | 'neutral'): string {
  switch (label) {
    case 'positive':
      return '#22c55e'; // green-500
    case 'negative':
      return '#ef4444'; // red-500
    case 'neutral':
      return '#6b7280'; // gray-500
  }
}

/**
 * 등락률 → 색상
 */
export function changeRateColor(rate: number): string {
  if (rate > 0) return 'text-red-500';
  if (rate < 0) return 'text-blue-500';
  return 'text-gray-500';
}

/**
 * 날짜를 한국식 표기로
 */
export function formatDateKR(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 상대 시간 (몇 분 전, 몇 시간 전)
 */
export function relativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return formatDateKR(date);
}
