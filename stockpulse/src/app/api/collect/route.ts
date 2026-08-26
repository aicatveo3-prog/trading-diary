import { NextRequest, NextResponse } from 'next/server';
import { runCollectionPipeline, runDailySummaryPipeline } from '@/lib/collectors/pipeline';

/**
 * POST /api/collect
 * 데이터 수집 파이프라인 수동 트리거
 * 
 * Body: { type: 'full' | 'summary' }
 * 
 * 사용처:
 *   - Vercel Cron: 장중 매 30분 (type=full)
 *   - Vercel Cron: 장 마감 후 16:00 (type=summary)
 *   - 수동 실행: 대시보드에서 새로고침 버튼
 * 
 * 인증:
 *   - CRON_SECRET 헤더로 보호 (Vercel Cron 자동 전달)
 *   - 또는 관리자 인증
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type = 'full' } = body;

    if (type === 'summary') {
      await runDailySummaryPipeline();
      return NextResponse.json({
        success: true,
        message: '일일 요약 생성 완료',
      });
    }

    // 전체 수집 파이프라인
    const result = await runCollectionPipeline();

    return NextResponse.json({
      success: result.success,
      data: {
        newsCollected: result.newsCollected,
        pricesUpdated: result.pricesUpdated,
        alertsTriggered: result.alertsTriggered,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `파이프라인 실행 실패: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collect
 * 수집 상태 확인 (Health Check)
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'StockPulse 데이터 수집 파이프라인',
    endpoints: {
      'POST /api/collect': '수집 실행 (body: {type: "full" | "summary"})',
    },
    schedule: {
      full: '장중 매 30분 (09:00~15:30 KST)',
      summary: '장 마감 후 16:00 KST',
    },
  });
}
