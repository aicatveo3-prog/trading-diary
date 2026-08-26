import { availableTickers } from '@/lib/price-data';
import StockDetailView from './StockDetailView';

/**
 * 정적 export를 위해 빌드 시점에 종목별 페이지를 미리 생성한다.
 * 수집된 주가가 있는 종목만 대상이다 — 데이터가 없으면 보여줄 것이 없다.
 */
export function generateStaticParams() {
  return availableTickers().map(ticker => ({ ticker }));
}

/** 사전 생성 목록에 없는 티커는 404 — 정적 배포에서는 동적 생성이 불가능하다 */
export const dynamicParams = false;

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return <StockDetailView ticker={ticker} />;
}
