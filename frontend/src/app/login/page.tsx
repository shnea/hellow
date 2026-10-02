'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Headphones, 
  ArrowRight, 
  AlertCircle, 
  UserCheck, 
  Lock,
  LogIn
} from 'lucide-react';
import { buildAuthorizationUrl, OidcAuthConfig } from '@/lib/pkce';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect_to') || '/';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [oidcConfig, setOidcConfig] = useState<OidcAuthConfig | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);

      // 이미 로그인되어 있는 상태라면 메인 또는 지정 경로로 이동
      const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith('hellow_logged_in=true'));
      const hasSession = sessionStorage.getItem('hellow_logged_in') === 'true';
      if (hasCookie || hasSession) {
        router.replace(redirectTo);
        return;
      }

      // 개발 환경 여부 판단 (로컬호스트, dev- 도메인, 개발 파라미터)
      const isLocalOrDev = 
        process.env.NODE_ENV !== 'production' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('dev-') ||
        window.location.search.includes('dev=true');
      setIsDevMode(isLocalOrDev);
    }

    // OIDC 설정 로드
    fetch('/api/platform/oidc-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setOidcConfig(data);
        }
      })
      .catch(() => {});
  }, [redirectTo, router]);

  // 동적 콜백 URL 계산
  const callbackUrl = currentOrigin
    ? `${currentOrigin}/auth/callback`
    : 'https://dev-hellow.shnea.kr/auth/callback';

  // OIDC 로그인 시작
  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      let activeConfig = oidcConfig;

      // 1. 만약 마운트 시점 fetch가 아직 끝나지 않았거나 실패했을 경우 즉시 재조회
      if (!activeConfig?.issuer) {
        try {
          const res = await fetch('/api/platform/oidc-config');
          if (res.ok) {
            activeConfig = await res.json();
            setOidcConfig(activeConfig);
          }
        } catch {
          // 네트워크 일시 오류 시 fallback 진행
        }
      }

      // 2. 플랫폼 환경 기본 Issuer Fallback 적용
      const issuer =
        activeConfig?.issuer ||
        'https://platform.shnea.kr/auth/realms/p-06c8d669f15648298cefcb904742d306';
      const clientId = activeConfig?.clientId || 'app';
      const redirectUri = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : 'https://dev-hellow.shnea.kr/auth/callback';

      const config: OidcAuthConfig = {
        issuer,
        clientId,
        redirectUri,
        scopes: activeConfig?.scopes || 'openid profile email',
        prompt: 'login', // Keycloak 세션 잔류 시에도 항상 ID/PW 로그인 화면 강제
      };

      const { url } = await buildAuthorizationUrl(config);
      // 로그인 후 돌아올 경로 보존
      if (redirectTo && redirectTo !== '/') {
        sessionStorage.setItem('auth_redirect_to', redirectTo);
      }
      window.location.href = url;
    } catch (err: unknown) {
      setError((err as Error).message || '로그인 URL 생성 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 개발자 모드 즉시 접속 (개발 환경에서만 노출)
  const handleDevBypassLogin = () => {
    // 쿠키 및 세션 스토리지 동시 설정
    document.cookie = 'hellow_logged_in=true; path=/; max-age=86400; SameSite=Lax';
    sessionStorage.setItem('hellow_agent_name', '이소연 선임 (상담1팀)');
    sessionStorage.setItem('hellow_logged_in', 'true');
    router.replace(redirectTo);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-950">
            <Headphones className="w-4 h-4" />
          </div>
          <span className="font-bold text-base text-white tracking-tight">hellow CRM</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur relative overflow-hidden">
            {/* Top decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-indigo-600/30">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">로그인</h1>
              <p className="text-xs text-slate-400 mt-1">
                상담 워크스페이스에 접속하려면 로그인하세요.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Main Login Action */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? '로그인 중...' : '로그인'}</span>
                {!loading && <ArrowRight className="w-4 h-4 ml-0.5" />}
              </button>

              {/* 개발자 모드 즉시 접속: 개발 환경에서만 표시 */}
              {isDevMode && (
                <>
                  <div className="relative flex py-1.5 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-2 text-[10px] text-slate-500 font-mono">DEV MODE</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDevBypassLogin}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/80 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>개발자 모드 즉시 접속</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-center text-xs text-slate-600">
        <span>© 2026 hellow CRM</span>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        로딩 중...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
