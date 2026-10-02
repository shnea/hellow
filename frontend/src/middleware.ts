import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 비로그인 접근 허용 경로:
  // - /login (로그인 페이지)
  // - /auth/callback (OIDC 인가 코드 콜백)
  // - /support (고객용 외부 웹 상담 접수 페이지)
  // - /api/* (API 프록시 및 백엔드 통신)
  // - /_next/* (Next.js 빌드 자산)
  // - 정적 에셋 (favicon, tgz 등)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.tgz')
  ) {
    return NextResponse.next();
  }

  // 로그인 상태 검사 (쿠키 hellow_logged_in 확인)
  const loggedInCookie = request.cookies.get('hellow_logged_in')?.value;
  if (loggedInCookie !== 'true') {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect_to', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 정적 파일 및 내부 Next.js 자산을 제외한 모든 라우트 감시
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
