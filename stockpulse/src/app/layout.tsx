import type { Metadata } from 'next';
import { Noto_Sans_KR, Noto_Serif_KR } from 'next/font/google';
import './globals.css';
import { ConventionProvider } from '@/lib/convention-context';
import SiteHeader from '@/components/layout/SiteHeader';

const notoSans = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

const notoSerif = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-noto-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '겹쳐 — 뉴스와 주가를 같은 시간축에서',
  description:
    '주가가 움직인 날에 무슨 일이 있었는지를 시간 순서대로 보여줍니다. 예측하지 않고, 추천하지 않습니다.',
  keywords: ['주식', '뉴스', '주가', '타임라인', '한국 주식', '이벤트'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body
        className={`${notoSans.variable} ${notoSerif.variable}`}
        style={{ fontFamily: "'Noto Sans KR', sans-serif", minHeight: '100vh' }}
      >
        <ConventionProvider>
          <SiteHeader />
          {children}
        </ConventionProvider>
      </body>
    </html>
  );
}
