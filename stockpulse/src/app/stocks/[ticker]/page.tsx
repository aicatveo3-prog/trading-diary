import { STOCK_META } from '@/lib/events-data';
import StockDetailView from './StockDetailView';

/**
 * 정적 export를 위해 빌드 시점에 종목별 페이지를 미리 생성한다.
 * GitHub Pages에는 서버가 없으므로, 여기 없는 티커는 접근할 수 없다.
 * 실 데이터 연결 후에는 DB의 활성 종목 목록으로 대체한다.
 */
export function generateStaticParams() {
  return Object.keys(STOCK_META).map(ticker => ({ ticker }));
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
