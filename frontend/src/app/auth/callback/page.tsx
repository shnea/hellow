'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { exchangeCodeForToken } from '@/lib/pkce';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { apiJson } from '@/lib/api';
import { clearAuthentication, storeTokens } from '@/lib/auth-session';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'PROCESSING' | 'SUCCESS' | 'ERROR'>('PROCESSING');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);

  const processingRef=useRef(false);
  useEffect(() => {
    if(processingRef.current) return;
    processingRef.current=true;
    const processAuth = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      if (errorParam) {
        setStatus('ERROR');
        setErrorMessage(errorDesc || errorParam || '인증 서버에서 로그인이 거부되었습니다.');
        return;
      }

      if (!code) {
        setStatus('ERROR');
        setErrorMessage('인가 코드(code)가 전달되지 않았습니다.');
        return;
      }

      const storedState = sessionStorage.getItem('oidc_state');
      const storedVerifier = sessionStorage.getItem('oidc_verifier');

      if (!storedState || !state || storedState !== state) {
        setStatus('ERROR');
        setErrorMessage('보안 상태값(State)이 일치하지 않습니다. 다시 로그인해 주세요.');
        return;
      }

      if (!storedVerifier) {
        setStatus('ERROR');
        setErrorMessage('PKCE 검증값(verifier)이 누락되었습니다. 다시 시도해 주세요.');
        return;
      }

      try {
        const configRes = await fetch('/api/platform/oidc-config');
        if(!configRes.ok) throw new Error('로그인 설정 조회에 실패했습니다.');
        const config = await configRes.json();
        const {issuer,clientId}=config;
        if(!issuer || !clientId) throw new Error('로그인 설정이 없습니다.');
        const redirectUri = `${window.location.origin}/auth/callback`;

        // 토큰 교환
        const tokenData = await exchangeCodeForToken(
          issuer,
          clientId,
          code,
          redirectUri,
          storedVerifier
        );

        if(!tokenData.id_token) throw new Error('ID 토큰이 없습니다.');
        const {payload} = await jwtVerify(tokenData.id_token, createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`)), {issuer,audience:clientId});
        const nonce=sessionStorage.getItem('oidc_nonce');
        if(!nonce || payload.nonce!==nonce) throw new Error('인증 nonce가 일치하지 않습니다.');
        clearAuthentication();
        storeTokens(tokenData);
        const me=await apiJson<{name:string}>('/api/me');
        await apiJson('/api/session/login', {method:'POST'});
        const agentName=me.name;
        const email=typeof payload.email==='string' ? payload.email : '';
        sessionStorage.setItem('hellow_agent_name',agentName);
        setUserInfo({ name: agentName, email });

        setStatus('SUCCESS');

        const requestedUrl = sessionStorage.getItem('auth_redirect_to') || '/';
        const targetUrl = requestedUrl.startsWith('/') && !requestedUrl.startsWith('//') && !requestedUrl.includes('\\') ? requestedUrl : '/';
        sessionStorage.removeItem('auth_redirect_to');

        // 1초 후 워크스페이스로 이동
        setTimeout(() => {
          router.replace(targetUrl);
        }, 1000);
      } catch (err: unknown) {
        clearAuthentication();
        setStatus('ERROR');
        setErrorMessage((err as Error).message || '토큰 교환 중 오류가 발생했습니다.');
      } finally {
        sessionStorage.removeItem('oidc_verifier');
        sessionStorage.removeItem('oidc_state');
        sessionStorage.removeItem('oidc_nonce');
      }
    };

    processAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
        {status === 'PROCESSING' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white">SHNEA 인증 토큰 교환 중</h2>
            <p className="text-xs text-slate-400">
              플랫폼 인증 서버와 보안 토큰을 확인하고 있습니다. 잠시만 기다려 주세요...
            </p>
          </div>
        )}

        {status === 'SUCCESS' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">로그인 성공!</h2>
            <p className="text-xs text-slate-300">
              <strong className="text-white">{userInfo?.name}</strong> 님, 환영합니다.<br />
              상담 워크스페이스로 자동 이동합니다.
            </p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
            >
              지금 바로 이동
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-xl font-bold text-white">인증 실패</h2>
            <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/50 p-3 rounded-xl leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              로그인 화면으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
