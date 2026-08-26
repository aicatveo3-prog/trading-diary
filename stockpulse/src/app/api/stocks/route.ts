import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/stocks
 * 종목 목록 조회
 * 
 * Query Params:
 *   - market: 'KOSPI' | 'KOSDAQ' | 'ALL' (default: 'ALL')
 *   - search: 종목명/티커 검색
 *   - limit: 결과 수 (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'ALL';
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = createServiceClient();

    let query = supabase
      .from('stocks')
      .select('*')
      .eq('is_active', true)
      .order('market_cap', { ascending: false })
      .limit(limit);

    if (market !== 'ALL') {
      query = query.eq('market', market);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,ticker.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}
