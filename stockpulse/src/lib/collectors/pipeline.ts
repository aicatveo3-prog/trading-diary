/**
 * 데이터 수집 파이프라인 - 전체 흐름 오케스트레이션
 * 
 * Vercel Cron이나 API 엔드포인트에서 호출하는 메인 파이프라인.
 * 
 * 실행 순서:
 * 1. 워치리스트 종목 조회
 * 2. 뉴스 수집
 * 3. 감성 분석
 * 4. DB 저장 (뉴스 + 매핑)
 * 5. 주가 수집 + DB 저장
 * 6. 급변 감지
 * 7. (장 마감 후) AI 일일 요약
 */

import { createServiceClient } from '@/lib/supabase';
import { fetchNewsForStock } from './naver-news';
import { fetchCurrentPrice, fetchDailyPrices } from './stock-price';
import { analyzeSentimentBatch, generateDailySummary } from './sentiment';

interface PipelineResult {
  success: boolean;
  newsCollected: number;
  pricesUpdated: number;
  alertsTriggered: number;
  errors: string[];
}

/**
 * 메인 수집 파이프라인
 */
export async function runCollectionPipeline(): Promise<PipelineResult> {
  const supabase = createServiceClient();
  const result: PipelineResult = {
    success: true,
    newsCollected: 0,
    pricesUpdated: 0,
    alertsTriggered: 0,
    errors: [],
  };

  try {
    // 1. 활성 종목 조회 (워치리스트 또는 전체 활성 종목)
    const { data: stocks, error: stockError } = await supabase
      .from('stocks')
      .select('*')
      .eq('is_active', true);

    if (stockError || !stocks) {
      result.errors.push(`종목 조회 실패: ${stockError?.message}`);
      result.success = false;
      return result;
    }

    // 2. 뉴스 수집
    const allNewsItems: {
      title: string;
      summary: string;
      url: string;
      source: string;
      published_at: string;
      stock_id: string;
      stock_name: string;
    }[] = [];

    for (const stock of stocks) {
      try {
        const newsItems = await fetchNewsForStock(stock.name, { display: 10 });
        for (const item of newsItems) {
          allNewsItems.push({
            ...item,
            stock_id: stock.id,
            stock_name: stock.name,
          });
        }
        // Rate limit 대응
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        result.errors.push(`뉴스 수집 실패 [${stock.name}]: ${error}`);
      }
    }

    // URL 기준 중복 제거
    const uniqueNews = Array.from(
      new Map(allNewsItems.map(n => [n.url, n])).values()
    );

    // 3. 감성 분석 (배치)
    const sentimentItems = uniqueNews.map(n => ({
      title: n.title,
      stockName: n.stock_name,
      summary: n.summary,
    }));
    const sentiments = await analyzeSentimentBatch(sentimentItems);

    // 4. DB 저장 - 뉴스
    for (let i = 0; i < uniqueNews.length; i++) {
      const news = uniqueNews[i];
      const sentiment = sentiments[i];

      // upsert 뉴스 (URL 기준 중복 방지)
      const { data: insertedNews, error: newsError } = await supabase
        .from('news_articles')
        .upsert({
          title: news.title,
          summary: news.summary,
          url: news.url,
          source: news.source,
          published_at: news.published_at,
          sentiment_score: sentiment.score,
          sentiment_label: sentiment.label,
        }, { onConflict: 'url' })
        .select('id')
        .single();

      if (newsError || !insertedNews) {
        continue;
      }

      // 뉴스-종목 매핑
      await supabase.from('news_stock_mappings').upsert({
        news_id: insertedNews.id,
        stock_id: news.stock_id,
        relevance_score: 0.8,
        impact_type: 'direct',
      }, { onConflict: 'news_id,stock_id' });

      result.newsCollected++;
    }

    // 5. 주가 수집
    for (const stock of stocks) {
      try {
        const price = await fetchCurrentPrice(stock.ticker);

        // 오늘 날짜의 주가 upsert
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('stock_prices').upsert({
          stock_id: stock.id,
          date: today,
          open: price.open,
          high: price.high,
          low: price.low,
          close: price.price,
          volume: price.volume,
          change_amount: price.change_amount,
          change_rate: price.change_rate,
        }, { onConflict: 'stock_id,date' });

        result.pricesUpdated++;

        // 6. 급변 감지 (±3%)
        if (Math.abs(price.change_rate) >= 3.0) {
          result.alertsTriggered++;
          // 향후: 알림 발송 로직 추가
          console.log(`⚠️ 급변 감지: ${stock.name} ${price.change_rate > 0 ? '+' : ''}${price.change_rate}%`);
        }

        await new Promise(resolve => setTimeout(resolve, 60));
      } catch (error) {
        result.errors.push(`주가 수집 실패 [${stock.ticker}]: ${error}`);
      }
    }

    console.log(`✅ 파이프라인 완료: 뉴스 ${result.newsCollected}건, 주가 ${result.pricesUpdated}종목, 급변 ${result.alertsTriggered}건`);
  } catch (error) {
    result.success = false;
    result.errors.push(`파이프라인 전체 에러: ${error}`);
  }

  return result;
}

/**
 * 장 마감 후 일일 요약 생성
 */
export async function runDailySummaryPipeline(): Promise<void> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: stocks } = await supabase
    .from('stocks')
    .select('*')
    .eq('is_active', true);

  if (!stocks) return;

  for (const stock of stocks) {
    try {
      // 오늘 주가
      const { data: price } = await supabase
        .from('stock_prices')
        .select('*')
        .eq('stock_id', stock.id)
        .eq('date', today)
        .single();

      if (!price) continue;

      // 오늘 관련 뉴스
      const { data: mappings } = await supabase
        .from('news_stock_mappings')
        .select('news_articles(*)')
        .eq('stock_id', stock.id);

      const newsItems = (mappings || [])
        .map(m => m.news_articles as unknown as { title: string; sentiment_label: string })
        .filter(Boolean);

      // AI 요약 생성
      const summary = await generateDailySummary(
        stock.name,
        price.change_rate,
        newsItems
      );

      // 저장
      await supabase.from('stock_daily_summaries').upsert({
        stock_id: stock.id,
        date: today,
        summary,
        sentiment_trend: price.change_rate > 1 ? 'improving' : price.change_rate < -1 ? 'declining' : 'stable',
      }, { onConflict: 'stock_id,date' });

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[일일 요약 실패] ${stock.name}:`, error);
    }
  }
}
