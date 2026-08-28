/**
 * 종목 유니버스
 *
 * src/data/universe.json 을 읽는다. 이 JSON은 Python 수집기와 공유하는
 * 단일 소스다 — 종목을 추가할 때 한 곳만 고치면 수집·화면이 함께 반영된다.
 *
 * 심볼이 소스마다 다르다:
 *   FDR:   005930, US500, USD/KRW
 *   Yahoo: 005930.KS, ^GSPC, KRW=X
 * 그래서 id(내부 식별자)와 별도로 fdr/yahoo를 따로 보관한다.
 * URL에 쓰이는 것은 id다.
 */

import universeJson from '@/data/universe.json';

export type Market = 'KR' | 'US';
export type Currency = 'KRW' | 'USD';
export type AssetType = 'stock' | 'index' | 'etf' | 'fx';

export interface UniverseEntry {
  id: string;
  name: string;
  market: Market;
  currency: Currency;
  type: AssetType;
  fdr: string;
  yahoo: string;
  newsQuery: string;
  group: string;
}

const entries = (universeJson as { stocks: UniverseEntry[] }).stocks;

export function allEntries(): UniverseEntry[] {
  return entries;
}

export function entryFor(id: string): UniverseEntry | null {
  return entries.find(e => e.id === id) ?? null;
}

export function entriesByMarket(market: Market): UniverseEntry[] {
  return entries.filter(e => e.market === market);
}

/** 화면 목록용 그룹 순서 — universe.json의 등장 순서를 따른다 */
export function groupedEntries(): { group: string; items: UniverseEntry[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, UniverseEntry[]>();

  for (const entry of entries) {
    if (!buckets.has(entry.group)) {
      buckets.set(entry.group, []);
      order.push(entry.group);
    }
    buckets.get(entry.group)!.push(entry);
  }

  return order.map(group => ({ group, items: buckets.get(group)! }));
}

/**
 * 통화에 맞춘 가격 표기.
 *
 * 원화는 정수로, 달러는 소수 2자리로 쓴다. 지수는 통화 기호를 붙이지 않는다 —
 * 코스피 6,839는 '원'이 아니라 포인트다.
 */
export function formatPrice(value: number, entry: UniverseEntry): string {
  if (entry.type === 'index') {
    return value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (entry.currency === 'USD') {
    return `$${value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // 환율은 소수 2자리, 원화 주식은 정수
  if (entry.type === 'fx') {
    return value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return `${Math.round(value).toLocaleString('ko-KR')}`;
}

/** 변동금액 표기 (부호 포함) */
export function formatChangeAmount(value: number, entry: UniverseEntry): string {
  const sign = value >= 0 ? '+' : '\u2212';
  const abs = Math.abs(value);
  if (entry.currency === 'USD' || entry.type === 'index' || entry.type === 'fx') {
    return `${sign}${abs.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${sign}${Math.round(abs).toLocaleString('ko-KR')}`;
}

/** 자산 유형 라벨 */
export function typeLabel(type: AssetType): string {
  switch (type) {
    case 'index':
      return '지수';
    case 'etf':
      return 'ETF';
    case 'fx':
      return '환율';
    default:
      return '주식';
  }
}
