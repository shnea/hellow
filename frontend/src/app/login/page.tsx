'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Headphones, 
  ArrowRight, 
  AlertCircle, 
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
  const [oidcConfig, setOidcConfig] = useState<OidcAuthConfig | null>(null);

  useEffect(() => {
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

      // 설정된 환경 issuer만 사용
      const issuer =
        activeConfig?.issuer;
      if (!issuer) throw new Error('로그인 환경이 설정되지 않았습니다. 관리자에게 문의해 주세요.');
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
