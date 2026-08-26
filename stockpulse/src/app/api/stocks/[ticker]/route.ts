import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/stocks/[ticker]
 * 종목 상세 정보 + 최근 주가 + 관련 뉴스
 * 
 * Query Params:
 *   - days: 주가 데이터 일수 (default: 90)
 *   - news_limit: 관련 뉴스 수 (default: 20)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const { ticker } = params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90');
    const newsLimit = parseInt(searchParams.get('news_limit') || '20');

    const supabase = createServiceClient();

    // 1. 종목 기본 정보
    const { data: stock, error: stockError } = await supabase
      .from('stocks')
      .select('*')
      .eq('ticker', ticker)
      .single();

    if (stockError || !stock) {
      return NextResponse.json(
        { error: `종목을 찾을 수 없습니다: ${ticker}` },
        { status: 404 }
      );
    }

    // 2. 주가 데이터 (최근 N일)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: prices } = await supabase
      .from('stock_prices')
      .select('*')
      .eq('stock_id', stock.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // 3. 관련 뉴스 (매핑 기반)
    const { data: newsMappings } = await supabase
      .from('news_stock_mappings')
      .select(`
        relevance_score,
        impact_type,
        news_articles (*)
      `)
      .eq('stock_id', stock.id)
      .order('mapped_at', { ascending: false })
      .limit(newsLimit);

    // 4. AI 일일 요약 (최신)
    const { data: summary } = await supabase
      .from('stock_daily_summaries')
      .select('*')
      .eq('stock_id', stock.id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // 뉴스 데이터 정리
    const news = (newsMappings || []).map(mapping => ({
      ...mapping.news_articles,
      relevance_score: mapping.relevance_score,
      impact_type: mapping.impact_type,
    }));

    return NextResponse.json({
      data: {
        stock,
        prices: prices || [],
        news,
        summary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}
