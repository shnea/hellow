import { emptyDocument, fromMarkdown, parseDocument, type EditorDocument } from '@shnea/editor';

export function readDocument(value: string): EditorDocument {
  if (!value) return emptyDocument();
  try { return parseDocument(JSON.parse(value)); } catch { return fromMarkdown(value); }
}

export function appendDocument(value: string, text: string): string {
  const document = structuredClone(readDocument(value));
  const addition = fromMarkdown(text);
  document.content.content = [...(document.content.content || []), ...(addition.content.content || [])];
  return JSON.stringify(document);
}

export function documentText(value: string): string {
  const document = readDocument(value);
  const visit = (node: { type?: string; text?: string; content?: typeof document.content.content }): string => {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    const text = (node.content || []).map(visit).join('');
    return ['paragraph', 'heading', 'codeBlock', 'listItem'].includes(node.type || '') ? `${text}\n` : text;
  };
  return visit(document.content).trim();
}
