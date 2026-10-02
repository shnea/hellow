'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Headphones, 
  ShieldCheck, 
  ArrowRight, 
  Copy, 
  Check, 
  AlertCircle, 
  UserCheck, 
  Lock,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { buildAuthorizationUrl, OidcAuthConfig } from '@/lib/pkce';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [oidcConfig, setOidcConfig] = useState<OidcAuthConfig | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
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
  }, []);

  // 동적 콜백 URL 계산
  const callbackUrl = currentOrigin
    ? `${currentOrigin}/auth/callback`
    : 'https://dev-hellow.shnea.kr/auth/callback';

  // SHNEA Keycloak OIDC 로그인 시작
  const handleOidcLogin = async () => {
    if (!oidcConfig?.issuer) {
      setError('OIDC Issuer 설정이 확인되지 않았습니다. 관리자 설정을 확인해 주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const config: OidcAuthConfig = {
        issuer: oidcConfig.issuer,
        clientId: oidcConfig.clientId || 'app',
        redirectUri: callbackUrl,
        scopes: 'openid profile email',
      };

      const { url } = await buildAuthorizationUrl(config);
      // Keycloak 로그인 화면으로 리다이렉트
      window.location.href = url;
    } catch (err: unknown) {
      setError((err as Error).message || '로그인 URL 생성 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 로컬 개발 모드 로그인 (즉시 워크스페이스 진입)
  const handleDevBypassLogin = () => {
    sessionStorage.setItem('hellow_agent_name', '이소연 선임 (상담1팀)');
    sessionStorage.setItem('hellow_logged_in', 'true');
    router.push('/');
  };

  const copyCallbackUrl = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Simple Bar */}
      <header className="px-6 py-4 border-b border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-950">
            <Headphones className="w-4 h-4" />
          </div>
          <span className="font-bold text-base text-white tracking-tight">hellow CRM</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>SHNEA Platform OIDC 보호 모드</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur relative overflow-hidden">
            {/* Top decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-indigo-600/30">
                <Lock className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">상담사 및 관리자 로그인</h1>
              <p className="text-xs text-slate-400 mt-1.5">
                SHNEA 통합 플랫폼 계정으로 인증하고 워크스페이스에 접속합니다.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* OIDC Primary Login Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleOidcLogin}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                {loading ? '인증 서버로 연결 중...' : 'SHNEA 계정으로 로그인 (Keycloak OIDC)'}
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-500">또는</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Dev Bypass Login Button */}
              <button
                type="button"
                onClick={handleDevBypassLogin}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                개발자 모드로 즉시 접속 (이소연 선임)
              </button>
            </div>

            {/* Keycloak Callback Guide Box */}
            <div className="mt-6 pt-5 border-t border-slate-800 text-left">
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Keycloak 리다이렉트 콜백 경로 (Callback URL)
              </span>
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
                <span className="truncate flex-1 select-all">{callbackUrl}</span>
                <button
                  type="button"
                  onClick={copyCallbackUrl}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-sans flex items-center gap-1 shrink-0 transition"
                  title="콜백 주소 복사"
                >
                  {copiedCallback ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>복사</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                플랫폼 관리자 화면(<strong>인증 설정 → 로그인 주소</strong>)의 유효한 리디렉션 URI에 위 주소를 등록해 주세요.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-900">
        <span>© 2026 hellow CRM · SHNEA Platform Integration Spec Version 3</span>
      </footer>
    </div>
  );
}
