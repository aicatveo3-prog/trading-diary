import { Convention, directionColors } from './tokens';

/**
 * 등락률 표기 — 마이너스는 하이픈이 아니라 U+2212 마이너스 기호를 쓴다.
 * 숫자가 세로로 정렬되어 읽기 쉽고, 하이픈보다 시각적 무게가 맞다.
 */
export function pct(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

/** 절대 변동금액 표기 (예: "+900", "−1,200") */
export function signedAmount(v: number): string {
  const sign = v >= 0 ? '+' : '\u2212';
  return `${sign}${Math.abs(Math.round(v)).toLocaleString('ko-KR')}`;
}

/** 방향에 따른 색상 — 관설(KR/US)을 따른다 */
export function dirColor(v: number, convention: Convention): string {
  const { up, down } = directionColors(convention);
  return v >= 0 ? up : down;
}

/** 원화 정수 표기 */
export function won(v: number): string {
  return Math.round(v).toLocaleString('ko-KR');
}

/** MM.DD */
export function shortDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY.MM.DD */
export function longDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
