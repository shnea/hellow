'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { emptyDocument, fromMarkdown, parseDocument, type EditorDocument } from '@shnea/editor';
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
  onReady?: (editor: any) => void;
  readOnly?: boolean;
}

// EditorDocument에서 사람이 읽을 수 있는 일반 텍스트 추출
function extractPlainText(doc: EditorDocument): string {
  if (!doc || !doc.content) return '';
  const lines: string[] = [];

  const visit = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.type === 'hardBreak') {
      return '\n';
    }
    if (node.content && Array.isArray(node.content)) {
      const textParts = node.content.map(visit).join('');
      if (node.type === 'paragraph' || node.type === 'heading') {
        lines.push(textParts);
      } else if (node.type === 'listItem' || node.type === 'taskItem') {
        lines.push((node.attrs?.checked ? '[x] ' : '• ') + textParts);
      } else if (node.type === 'codeBlock') {
        lines.push(textParts);
      } else {
        return textParts;
      }
    }
    return '';
  };

  if (Array.isArray(doc.content.content)) {
    doc.content.content.forEach(visit);
    return lines.join('\n').trim();
  }
  return '';
}

// 문자열을 EditorDocument로 안전하게 변환
function textToDocument(text: string): EditorDocument {
  if (!text || !text.trim()) return emptyDocument();
  const trimmed = text.trim();

  // 만약 JSON 포맷으로 저장된 문서라면 parseDocument 파싱
  if (trimmed.startsWith('{"format":"shnea-editor"')) {
    try {
      return parseDocument(JSON.parse(trimmed));
    } catch {
      // 파싱 실패 시 fallback
    }
  }

  // 일반 마크다운 / 텍스트 문자열 파싱
  try {
    return fromMarkdown(trimmed);
  } catch (e) {
    console.error('Failed to parse from markdown:', e);
    return emptyDocument();
  }
}

export const ShneaConsultationEditor: React.FC<ShneaConsultationEditorProps> = ({
  documentKey,
  initialText = '',
  onChangeText,
  onReady,
  readOnly = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [editorValue, setEditorValue] = useState<EditorDocument>(() => textToDocument(initialText));
  const [editorError, setEditorError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  // 내부 에코 방지용 Ref (자신이 보낸 텍스트로 인한 불필요한 재렌더링 방지)
  const lastEmittedTextRef = useRef<string>(initialText);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 외부 initialText 변경 시 동기화 (템플릿 삽입, 인용, 고객 변경 등)
  useEffect(() => {
    if (!mounted) return;

    // 만약 에디터 내부에서 방금 타이핑하여 emit된 값과 같다면 무시 (무한 루프 방지)
    if (initialText === lastEmittedTextRef.current) {
      return;
    }

    const newDoc = textToDocument(initialText);
    setEditorValue(newDoc);
    lastEmittedTextRef.current = initialText;
  }, [initialText, mounted, documentKey]);

  // SHNEA 공식 에디터 첨부파일 어댑터 (editor.md 표준 규격 준수)
  const attachments = useMemo(() => ({
    platformImageOrigin: 'https://platform.shnea.kr',
    scope: () => 'hellow-consultation-dev',
    async upload(file: File, context: any) {
      const body = new FormData();
      body.set('file', file);
      const kind = context.kind || (file.type.startsWith('image/') ? 'image' : 'file');
      const scope = context.scope || 'hellow-consultation-dev';
      body.set('kind', kind);
      body.set('scope', scope);
      if (context.requestId) body.set('requestId', context.requestId);

      const response = await fetch('/api/editor/files', {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'SHNEA 플랫폼에 파일을 업로드하지 못했습니다.');
      }
      const resData = await response.json();
      return {
        fileId: resData.fileId,
        scope: scope,
        kind: kind,
        name: resData.name || file.name,
        size: Number.isSafeInteger(resData.size) ? resData.size : file.size,
      };
    },
    async resolve(file: any, signal?: AbortSignal) {
      const response = await fetch(`/api/editor/files/${encodeURIComponent(file.fileId)}/views`, {
        signal,
      });
      if (!response.ok) {
        throw new Error('파일 보기 정보를 불러오지 못했습니다.');
      }
      const data = await response.json();
      if (!data.fileId) data.fileId = file.fileId;
      return data;
    },
  }), []);

  if (!mounted) {
    return (
      <div className="flex-1 min-h-[480px] rounded-b-xl border border-t-0 border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-500 flex items-center justify-center">
        SHNEA 공식 에디터를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="shnea-consultation-editor flex-1 h-full min-h-0 flex flex-col relative select-text">
      {/* SHNEA 에디터 다크 테마 및 높이 전역 스타일 */}
      <style jsx global>{`
        .shnea-consultation-editor {
          --surface: #0b1120;
          --text: #f8fafc;
          --muted: #94a3b8;
          --line: #334155;
          --accent: #6366f1;
          --raised: #1e293b;
          --se-bg: #0b1120;
          --se-text: #f8fafc;
          --se-muted: #94a3b8;
          --se-line: #334155;
          --se-accent: #6366f1;
          --se-raised: #1e293b;
          --se-radius: 0px 0px 12px 12px;
          --se-font-size: 13.5px;
          --se-line-height: 1.65;
          --se-content-padding: 16px 20px;
          --se-paragraph-spacing: 0.6em;
          flex: 1 1 0%;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          min-width: 0;
        }
        .shnea-consultation-editor .shnea-editor {
          flex: 1 1 0%;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          border-radius: 0 0 12px 12px;
          border: 1px solid #334155;
          border-top: none;
          background-color: #0b1120 !important;
          color: #f8fafc !important;
          overflow: hidden;
        }
        .shnea-consultation-editor .shnea-editor .tiptap {
          flex: 1 1 0%;
          min-height: 480px;
          height: 100%;
          outline: none;
          color: #f8fafc !important;
          background: transparent !important;
          font-family: inherit;
          overflow-y: auto;
        }
        .shnea-consultation-editor .shnea-editor .tiptap p,
        .shnea-consultation-editor .shnea-editor .tiptap h1,
        .shnea-consultation-editor .shnea-editor .tiptap h2,
        .shnea-consultation-editor .shnea-editor .tiptap h3,
        .shnea-consultation-editor .shnea-editor .tiptap h4,
        .shnea-consultation-editor .shnea-editor .tiptap h5,
        .shnea-consultation-editor .shnea-editor .tiptap h6,
        .shnea-consultation-editor .shnea-editor .tiptap blockquote,
        .shnea-consultation-editor .shnea-editor .tiptap pre,
        .shnea-consultation-editor .shnea-editor .tiptap ul,
        .shnea-consultation-editor .shnea-editor .tiptap ol,
        .shnea-consultation-editor .shnea-editor .tiptap div,
        .shnea-consultation-editor .shnea-editor .tiptap section {
          max-width: 100% !important;
          color: #f1f5f9;
        }
        .shnea-consultation-editor .shnea-editor button {
          background-color: #1e293b !important;
          color: #f1f5f9 !important;
          border-color: #334155 !important;
        }
        .shnea-consultation-editor .shnea-editor button:hover:not(:disabled) {
          background-color: #334155 !important;
        }
        .shnea-consultation-editor .shnea-editor button[aria-pressed=true] {
          background-color: #312e81 !important;
          border-color: #6366f1 !important;
          color: #c7d2fe !important;
        }
        .shnea-consultation-editor .shnea-editor input,
        .shnea-consultation-editor .shnea-editor select {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          border-color: #334155 !important;
        }
        .shnea-consultation-editor .shnea-editor .se-insert-menu {
          background-color: #0f172a !important;
          border-color: #475569 !important;
          color: #f8fafc !important;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6) !important;
        }
        .shnea-consultation-editor .shnea-editor .se-command-list button {
          background-color: #1e293b !important;
          color: #f8fafc !important;
        }
        .shnea-consultation-editor .shnea-editor .se-command-list button:hover:not(:disabled) {
          background-color: #334155 !important;
        }
        .shnea-consultation-editor .shnea-editor .se-hint,
        .shnea-consultation-editor .shnea-editor .se-message {
          border-color: #1e293b !important;
          color: #64748b !important;
          background-color: #0b1120 !important;
        }
      `}</style>

      {editorError && (
        <div className="p-2.5 bg-rose-950/60 border-b border-rose-800 text-rose-300 text-xs flex items-center gap-1.5 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{editorError}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <ShneaEditor
          value={editorValue}
          documentKey={documentKey}
          attachments={attachments}
          editable={!readOnly}
          appearance={{
            fontSize: 13.5,
            lineHeight: 1.65,
          }}
          onReady={(editor) => {
            editorRef.current = editor;
            if (onReady) onReady(editor);
          }}
          onChange={({ document }) => {
            setEditorValue(document);
            if (onChangeText) {
              const plain = extractPlainText(document);
              lastEmittedTextRef.current = plain;
              onChangeText(plain);
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
