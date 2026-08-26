/**
 * 겹쳐 (NEWS × PRICE) — 디자인 토큰
 *
 * 종이 톤 라이트 테마. 숫자·제목은 Noto Serif KR, 본문은 Noto Sans KR.
 * 색은 "정보의 위계"만 표현하고, 감정은 표현하지 않는다.
 */

export const c = {
  /** 페이지 배경 — 따뜻한 종이 */
  bg: '#f2f1ee',
  /** 카드 표면 */
  surface: '#ffffff',
  /** 강조 배경 (해설 박스, 통계 박스) */
  surfaceAlt: '#f8f7f4',
  /** 입력창·배지 배경 */
  surfaceMuted: '#f4f4f2',
  /** 행 호버 */
  surfaceHover: '#fbfbfa',

  /** 테두리 — 진한 순서 */
  border: '#e0e1e4',
  borderSoft: '#ecedee',
  borderFaint: '#f0f0ef',
  borderInput: '#e4e5e8',
  borderBtn: '#d9dade',
  borderAlt: '#dedbd4',
  borderAltInner: '#e7e5e0',

  /** 텍스트 위계 */
  ink: '#1b1e23',
  inkBody: '#3d424a',
  inkStrong: '#4a4f57',
  inkMid: '#6f747c',
  inkSoft: '#9a9ea5',
  inkFaint: '#b3b6bb',

  /** 링크 */
  link: '#1f5fbf',
  linkHover: '#14304f',

  /** 차트 그리드 */
  grid: '#eceef0',
} as const;

/** 등락 색 관설 — 한국식(상승 빨강) / 미국식(상승 초록) */
export type Convention = 'KR' | 'US';

export interface DirectionColors {
  up: string;
  down: string;
}

export function directionColors(convention: Convention): DirectionColors {
  return convention === 'US'
    ? { up: '#17805a', down: '#c0392b' }
    : { up: '#c0392b', down: '#1f5fbf' };
}

export const font = {
  serif: "'Noto Serif KR', serif",
  sans: "'Noto Sans KR', sans-serif",
} as const;
