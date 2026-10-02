'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Key, 
  Layers, 
  Globe, 
  UploadCloud, 
  ExternalLink,
  RefreshCw,
  FileCheck
} from 'lucide-react';

interface PlatformContext {
  projectId: string | null;
  environmentId: string | null;
  kind: string;
  issuer: string | null;
  scopes: string[];
  verified: boolean;
  statusMessage: string;
}

interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string;
}

interface PlatformIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUploadedToMemo?: (textToInsert: string) => void;
}

export const PlatformIntegrationModal: React.FC<PlatformIntegrationModalProps> = ({
  isOpen,
  onClose,
  onFileUploadedToMemo,
}) => {
  const [context, setContext] = useState<PlatformContext | null>(null);
  const [oidcConfig, setOidcConfig] = useState<OidcConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [ctxRes, oidcRes] = await Promise.all([
        fetch('/api/platform/context'),
        fetch('/api/platform/oidc-config'),
      ]);

      if (ctxRes.ok) {
        setContext(await ctxRes.json());
      }
      if (oidcRes.ok) {
        setOidcConfig(await oidcRes.json());
      }
    } catch (e) {
      console.error('Failed to load platform status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setUploadMessage(null);
    }
  }, [isOpen]);

  const handleTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('visibility', 'PUBLIC');

    try {
      const res = await fetch('/api/platform/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('파일 업로드에 실패했습니다.');
      const data = await res.json();

      const insertedText = `\n[첨부: ${data.originalName} (${(data.size / 1024).toFixed(1)} KB)] - ${data.viewUrl}\n`;
      setUploadMessage(`업로드 성공! 파일 ID: ${data.fileId}`);

      if (onFileUploadedToMemo) {
        onFileUploadedToMemo(insertedText);
      }
    } catch (err: unknown) {
      setUploadMessage(`오류: ${(err as Error).message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                SHNEA 플랫폼 연동 관리
                {context?.verified && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                    정상 연결됨
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">OIDC 회원 인증, 조직(Organization) 및 파일 서비스 연동 상태</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* 1. 플랫폼 연결 상태 요약 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                플랫폼 환경 정보 (Context)
              </span>
              <button
                onClick={fetchStatus}
                disabled={loading}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <span className="block text-slate-500 mb-0.5">프로젝트 ID</span>
                <span className="font-mono text-slate-200 truncate block" title={context?.projectId || '미설정'}>
                  {context?.projectId || '미설정'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <span className="block text-slate-500 mb-0.5">환경 구분 / ID</span>
                <span className="font-mono text-slate-200 truncate block">
                  <span className="text-amber-400 font-bold mr-1.5">{context?.kind || 'DEV'}</span>
                  {context?.environmentId?.substring(0, 18)}...
                </span>
              </div>
            </div>

            {context?.statusMessage && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                context.verified 
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' 
                  : 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
              }`}>
                {context.verified ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                {context.statusMessage}
              </div>
            )}
          </div>

          {/* 2. 활성 연동 권한 스코프 */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-400" />
              발급된 플랫폼 API 권한 (X-Platform-Key)
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {context?.scopes && context.scopes.length > 0 ? (
                context.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60"
                  >
                    {scope}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">권한 정보를 불러오는 중...</span>
              )}
            </div>
          </div>

          {/* 3. OIDC 로그인 설정 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-violet-400" />
              OIDC 직원 인증 규격 (Keycloak Discovery)
            </h3>
            <div className="space-y-1.5 text-xs text-slate-300 font-mono">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500 font-sans">인증 서버 (Issuer)</span>
                <span className="truncate max-w-[340px] text-right text-indigo-300">{oidcConfig?.issuer || '로딩 중...'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500 font-sans">클라이언트 ID</span>
                <span className="text-emerald-400 font-bold">{oidcConfig?.clientId || 'app'}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-sans">인증 방식</span>
                <span className="text-slate-400 font-sans">Authorization Code + PKCE S256</span>
              </div>
            </div>

            {oidcConfig?.issuer && (
              <a
                href={`${oidcConfig.issuer}/.well-known/openid-configuration`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Keycloak OIDC 메타데이터 열기
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* 4. 파일 서비스 연동 테스트 */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                플랫폼 파일 저장소 직접 테스트
              </span>
              <span className="text-[11px] text-slate-500">청크 분할 & SHA-256 검증</span>
            </div>
            <p className="text-xs text-slate-400">
              상담 메모에 첨부할 문서나 이미지를 선택하면 플랫폼 File API로 즉시 업로드하고 메모장에 링크를 삽입합니다.
            </p>

            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50">
                <UploadCloud className="w-4 h-4" />
                {uploading ? '플랫폼에 전송 중...' : '파일 선택 및 업로드'}
                <input
                  type="file"
                  onChange={handleTestUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {uploadMessage && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" />
                  {uploadMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>SHNEA Integration Spec Version 3 준수</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
