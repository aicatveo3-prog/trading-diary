import type { NextConfig } from 'next';

/**
 * 빌드 대상에 따라 설정이 갈린다.
 *
 * - 기본 (Vercel/로컬): 서버 런타임 사용. API 라우트가 동작한다.
 * - GITHUB_PAGES=true: 정적 export. 서버가 없으므로 API 라우트는 빌드에서 제외된다
 *   (제외는 워크플로에서 처리 — Next.js는 라우트 단위 제외 옵션을 제공하지 않는다).
 *
 * basePath가 필요한 이유: Pages는 https://<user>.github.io/<repo>/ 하위에 서빙하므로
 * 모든 링크와 정적 자산 경로에 저장소 이름이 접두사로 붙어야 한다.
 */
const isPages = process.env.GITHUB_PAGES === 'true';
const repoName = process.env.PAGES_BASE_PATH ?? '/trading-diary';

const nextConfig: NextConfig = {
  // 런타임에서 basePath를 알 수 있도록 환경 변수로 노출한다.
  // minute-data.ts 등에서 fetch URL 경로 결정에 사용.
  env: {
    NEXT_PUBLIC_BASE_PATH: isPages ? repoName : '',
  },
  ...(isPages
    ? {
        output: 'export' as const,
        basePath: repoName,
        assetPrefix: repoName,
        // Pages에는 이미지 최적화 서버가 없다
        images: { unoptimized: true },
        // 각 경로를 디렉터리+index.html로 내보내 정적 호스팅에서 새로고침이 깨지지 않게 한다
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
