import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateDailySummary } from '@/lib/collectors/sentiment';

/**
 * GET /api/summary
 * AI 일일 요약 조회
 * 
 * Query Params:
 *   - stock_id: 종목 ID (필수)
 *   - date: 날짜 (YYYY-MM-DD, default: 오늘)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get('stock_id');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!stockId) {
      return NextResponse.json(
        { error: 'stock_id는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 캐시된 요약 확인
    const { data: cached } = await supabase
      .from('stock_daily_summaries')
      .select('*')
      .eq('stock_id', stockId)
      .eq('date', date)
      .single();

    if (cached) {
      return NextResponse.json({ data: cached });
    }

    return NextResponse.json({ data: null, message: '요약이 아직 생성되지 않았습니다.' });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/summary
 * AI 일일 요약 생성 (수동 트리거)
 * 
 * Body: { stock_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stock_id } = body;

    if (!stock_id) {
      return NextResponse.json(
        { error: 'stock_id는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // 종목 정보
    const { data: stock } = await supabase
      .from('stocks')
      .select('*')
      .eq('id', stock_id)
      .single();

    if (!stock) {
      return NextResponse.json({ error: '종목을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 오늘 주가
    const { data: price } = await supabase
      .from('stock_prices')
      .select('*')
      .eq('stock_id', stock_id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // 관련 뉴스
    const { data: newsMappings } = await supabase
      .from('news_stock_mappings')
      .select('news_articles (title, sentiment_label)')
      .eq('stock_id', stock_id)
      .order('mapped_at', { ascending: false })
      .limit(10);

    const newsItems = (newsMappings || [])
      .map(m => m.news_articles as unknown as { title: string; sentiment_label: string })
      .filter(Boolean);

    const changeRate = price?.change_rate || 0;

    // AI 요약 생성
    const summary = await generateDailySummary(stock.name, changeRate, newsItems);

    // DB 저장
    const { data: saved, error } = await supabase
      .from('stock_daily_summaries')
      .upsert({
        stock_id,
        date: today,
        summary,
        sentiment_trend: changeRate > 1 ? 'improving' : changeRate < -1 ? 'declining' : 'stable',
      }, { onConflict: 'stock_id,date' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}
