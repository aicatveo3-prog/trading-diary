/**
 * 차트 기간 옵션
 *
 * (예전 events-data.ts에서 분리했다. 그 파일에는 예시 뉴스 이벤트가
 *  섞여 있었으나, 실제 뉴스 수집이 붙으면서 예시는 죽은 데이터가 되어
 *  제거하고 기간 정의만 남겼다.)
 *
 * days는 거래일 수다. 달력일이 아니라 거래일이라 1개월이 22일이다.
 * label은 한글로 둔다 — '1M'은 무슨 뜻인지 바로 읽히지 않는다.
 * '전체'는 보유한 데이터를 모두 쓰도록 큰 값을 두고 호출부에서 clamp한다.
 *
 * resolution: 캔들 1개가 나타내는 시간 폭. 기간이 길어질수록 해상도를 낮춰
 * 캔들 수를 화면에 맞는 범위(50~150개)로 유지한다.
 *   'minute' — 분봉 (별도 파일). 1일은 5분봉, 1주는 5분봉을 묶어 30분봉
 *   'day'    — 일봉 원본
 *   'week'   — 일봉을 주봉으로 집계
 */
export const PERIODS = [
  { key: '1D' as const, label: '1일', days: 1, resolution: 'minute' as const, interval: 5 as const },
  { key: '1W' as const, label: '1주', days: 5, resolution: 'minute' as const, interval: 30 as const },
  { key: '1M' as const, label: '1개월', days: 22, resolution: 'day' as const },
  { key: '3M' as const, label: '3개월', days: 64, resolution: 'day' as const },
  { key: '6M' as const, label: '6개월', days: 125, resolution: 'day' as const },
  { key: '1Y' as const, label: '1년', days: 250, resolution: 'week' as const },
  { key: 'ALL' as const, label: '전체', days: 99999, resolution: 'week' as const },
];

export type PeriodKey = (typeof PERIODS)[number]['key'];

/** 'minute'는 분봉(별도 데이터), 'day'는 일봉 원본, 'week'/'month'는 일봉 집계 */
export type Resolution = 'day' | 'week' | 'month' | 'minute';
