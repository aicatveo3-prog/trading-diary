import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StockPulse Korea - 뉴스와 주가를 한눈에',
  description: '한국 주식 시장의 뉴스 이벤트와 주가 변동을 시간축 위에서 연결해 보여주는 투자 인사이트 도구',
  keywords: ['주식', '뉴스', '주가', '한국', '투자', '감성분석'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        {/* 네비게이션 */}
        <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* 로고 */}
              <a href="/" className="flex items-center gap-2">
                <span className="text-lg">📈</span>
                <span className="font-bold text-white tracking-tight">StockPulse</span>
                <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                  BETA
                </span>
              </a>

              {/* 네비게이션 링크 */}
              <div className="flex items-center gap-6">
                <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                  대시보드
                </a>
                <a href="/stocks/005930" className="text-sm text-slate-400 hover:text-white transition-colors">
                  종목 분석
                </a>
              </div>

              {/* 우측 */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-600">
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                </span>
              </div>
            </div>
          </div>
        </nav>

        {/* 메인 콘텐츠 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* 푸터 */}
        <footer className="border-t border-slate-800/50 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <p>© 2026 StockPulse. 투자 판단의 참고 자료일 뿐, 투자 권유가 아닙니다.</p>
              <p>뉴스 출처: 네이버 뉴스 · 주가: 한국투자증권 API</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
