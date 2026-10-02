'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { emptyDocument, type EditorDocument } from '@shnea/editor';
import '@shnea/editor/style.css';
import { AlertCircle } from 'lucide-react';

// SSR 비활성화로 클라이언트 전용 렌더링
const ShneaEditor = dynamic(
  () => import('@shnea/editor/react').then((mod) => mod.ShneaEditor),
  { ssr: false }
);

interface ShneaConsultationEditorProps {
  documentKey: string;
  initialText?: string;
  onChangeText?: (text: string) => void;
  readOnly?: boolean;
}

export const ShneaConsultationEditor: React.FC<ShneaConsultationEditorProps> = ({
  documentKey,
  initialText,
  onChangeText,
  readOnly = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [editorValue, setEditorValue] = useState<EditorDocument>(emptyDocument());
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SHNEA 공식 에디터 첨부파일 어댑터 (editor.md 표준 규격 준수)
  const attachments = useMemo(() => ({
    platformImageOrigin: 'https://platform.shnea.kr',
    scope: () => 'hellow-consultation-dev',
    async upload(file: File, context: any) {
      const body = new FormData();
      body.set('file', file);
      body.set('kind', context.kind || 'attachment');
      if (context.requestId) body.set('requestId', context.requestId);

      const response = await fetch('/api/editor/files', {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        throw new Error('SHNEA 플랫폼에 파일을 업로드하지 못했습니다.');
      }
      return response.json(); // { fileId, scope, kind, name, size }
    },
    async resolve(file: any, signal?: AbortSignal) {
      const response = await fetch(`/api/editor/files/${encodeURIComponent(file.fileId)}/views`, {
        signal,
      });
      if (!response.ok) {
        throw new Error('파일 보기 정보를 불러오지 못했습니다.');
      }
      return response.json(); // view-ticket 원문
    },
  }), []);

  if (!mounted) {
    return (
      <div className="h-64 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-500 flex items-center justify-center">
        SHNEA 에디터를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="shnea-editor-wrapper bg-slate-900/90 rounded-b-xl border border-t-0 border-slate-700 overflow-hidden text-slate-100 flex flex-col">
      {editorError && (
        <div className="p-2.5 bg-rose-950/60 border-b border-rose-800 text-rose-300 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{editorError}</span>
        </div>
      )}

      <div className="p-3 min-h-[220px] max-h-[360px] overflow-y-auto font-sans text-sm focus:outline-none">
        <ShneaEditor
          value={editorValue}
          documentKey={documentKey}
          attachments={attachments}
          editable={!readOnly}
          appearance={{
            fontSize: 14,
            lineHeight: 1.6,
          }}
          onChange={({ document }) => {
            setEditorValue(document);
            if (onChangeText) {
              // 텍스트 블록들을 줄바꿈으로 추출하여 상위 상담 메모와 동기화
              try {
                const docJson = JSON.stringify(document);
                onChangeText(docJson);
              } catch (e) {
                console.error(e);
              }
            }
          }}
          onError={(err) => {
            console.error('SHNEA Editor error:', err);
            setEditorError((err as Error)?.message || '에디터 오류가 발생했습니다.');
          }}
        />
      </div>
    </div>
  );
};
