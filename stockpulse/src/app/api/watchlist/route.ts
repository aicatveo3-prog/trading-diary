import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

/**
 * GET /api/watchlist
 * 워치리스트 조회 (현재는 기본 사용자)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // TODO: 실제 인증 후 user_id 사용
    // 현재는 첫 번째 사용자 또는 기본 데이터
    const { data, error } = await supabase
      .from('watchlists')
      .select(`
        *,
        stocks (*)
      `)
      .order('added_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 각 종목의 최신 주가도 가져오기
    const enriched = await Promise.all(
      (data || []).map(async (item) => {
        const { data: price } = await supabase
          .from('stock_prices')
          .select('*')
          .eq('stock_id', item.stock_id)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        return {
          ...item,
          latest_price: price,
        };
      })
    );

    return NextResponse.json({ data: enriched });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watchlist
 * 워치리스트에 종목 추가
 * 
 * Body: { stock_id: string, alert_threshold?: number, memo?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stock_id, alert_threshold = 3.0, memo } = body;

    if (!stock_id) {
      return NextResponse.json(
        { error: 'stock_id는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // TODO: 실제 인증 후 user_id 사용
    // 임시: 기본 user_id
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single();

    const userId = users?.id;
    if (!userId) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('watchlists')
      .upsert({
        user_id: userId,
        stock_id,
        alert_threshold,
        memo,
      }, { onConflict: 'user_id,stock_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/watchlist
 * 워치리스트에서 종목 제거
 * 
 * Query: ?stock_id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get('stock_id');

    if (!stockId) {
      return NextResponse.json(
        { error: 'stock_id는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('stock_id', stockId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: '서버 에러가 발생했습니다.' },
      { status: 500 }
    );
  }
}
