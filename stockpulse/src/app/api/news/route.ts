import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/news
 * 뉴스 목록 조회
 * 
 * Query Params:
 *   - stock_id: 특정 종목의 뉴스만
 *   - sentiment: 'positive' | 'negative' | 'neutral'
 *   - major_only: 'true' - 주요 뉴스만
 *   - limit: 결과 수 (default: 30)
 *   - offset: 페이지네이션 오프셋
 *   - date_from: 시작일 (YYYY-MM-DD)
 *   - date_to: 종료일 (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get('stock_id');
    const sentiment = searchParams.get('sentiment');
    const majorOnly = searchParams.get('major_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const supabase = createServiceClient();

    // 종목 ID로 필터시: 매핑 테이블 경유
    if (stockId) {
      let query = supabase
        .from('news_stock_mappings')
        .select(`
          relevance_score,
          impact_type,
          news_articles (*)
        `)
        .eq('stock_id', stockId)
        .order('mapped_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const news = (data || [])
        .map(m => ({ ...m.news_articles, relevance_score: m.relevance_score, impact_type: m.impact_type }))
        .filter(n => {
          if (sentiment && n.sentiment_label !== sentiment) return false;
          if (majorOnly && !n.is_major) return false;
          return true;
        });

      return NextResponse.json({ data: news, meta: { total: news.length, offset, limit } });
    }

    // 전체 뉴스 조회
    let query = supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sentiment) {
      query = query.eq('sentiment_label', sentiment);
    }

    if (majorOnly) {
      query = query.eq('is_major', true);
    }

    if (dateFrom) {
      query = query.gte('published_at', `${dateFrom}T00:00:00Z`);
    }

    if (dateTo) {
      query = query.lte('published_at', `${dateTo}T23:59:59Z`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      meta: { total: count || data?.length || 0, offset, limit },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}
