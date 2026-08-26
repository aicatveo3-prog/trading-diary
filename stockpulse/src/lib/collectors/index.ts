/**
 * 데이터 수집 파이프라인 오케스트레이터
 * 
 * 실행 주기: 장중 매 30분 (09:00~15:30)
 * 장 마감 후: 16:00에 일일 요약 생성
 * 
 * 사용법:
 *   - Vercel Cron 또는 GitHub Actions에서 호출
 *   - 또는 수동: POST /api/collect
 */

export { searchNaverNews, fetchNewsForStock, fetchNewsForMultipleStocks, fetchMarketNews } from './naver-news';
export { fetchCurrentPrice, fetchDailyPrices, fetchMultipleCurrentPrices } from './stock-price';
export { analyzeSentiment, analyzeSentimentBatch, generateDailySummary } from './sentiment';

/**
 * 전체 수집 파이프라인 실행 순서:
 * 
 * 1. fetchNewsForMultipleStocks(워치리스트 종목명)
 * 2. analyzeSentimentBatch(수집된 뉴스)
 * 3. DB에 뉴스 저장 + news_stock_mappings 생성
 * 4. fetchMultipleCurrentPrices(워치리스트 티커)
 * 5. DB에 주가 업데이트
 * 6. 급변 감지 (|change_rate| >= threshold)
 * 7. (장 마감 후) generateDailySummary
 */
