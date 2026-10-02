import { describe, expect, it } from 'vitest';
import { appendDocument, documentText, readDocument } from './editor-document';
import { fromMarkdown } from '@shnea/editor';
describe('structured editor document',()=>{
  it('preserves formatting and attachment references while appending templates',()=>{
    const document=fromMarkdown('**한글 굵은 문장**');
    document.content.content?.push({type:'file',attrs:{fileId:'owned-file',scope:'org-a:queue-1',kind:'file',name:'report.pdf',size:100}});
    const value=appendDocument(JSON.stringify(document),'새 템플릿');
    expect(value).toContain('owned-file');expect(value).toContain('bold');expect(documentText(value)).toContain('새 템플릿');
    expect(readDocument(value).format).toBe('shnea-editor');
  });
});
