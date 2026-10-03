import type { ConsultationDraft } from './workspace-data';

export interface ConsultationDraftCache {
  drafts: Record<string, ConsultationDraft>;
  versions: Record<string, number>;
  selected: string;
}

export function consultationDraftKey(issuer: string, subject: string, organizationId: string) {
  return `hellow_consultation_drafts:${JSON.stringify([issuer, subject, organizationId])}`;
}

export function readConsultationDrafts(key: string): ConsultationDraftCache | undefined {
  const raw = sessionStorage.getItem(key);
  if (!raw) return undefined;
  const value = JSON.parse(raw) as ConsultationDraftCache;
  if (!value || typeof value.selected !== 'string' || !value.drafts || !value.versions) throw new Error('보관된 초안을 읽지 못했습니다.');
  for (const [code, draft] of Object.entries(value.drafts)) {
    if(code==='idle'&&value.versions[code]===undefined)value.versions[code]=0;
    if (!draft || typeof draft.memo !== 'string' || typeof draft.categoryMain !== 'string' || typeof draft.categorySub !== 'string'
      || typeof draft.status !== 'string' || !Array.isArray(draft.selectedTags) || !draft.selectedTags.every(tag => typeof tag === 'string')
      || !Number.isSafeInteger(value.versions[code]) || value.versions[code] < 0) throw new Error('보관된 초안을 읽지 못했습니다.');
  }
  return value;
}

export function writeConsultationDrafts(key: string, value: ConsultationDraftCache) {
  sessionStorage.setItem(key, JSON.stringify(value));
}
