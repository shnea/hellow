import {apiJson, jsonBody} from './api';
import {readDocument} from './editor-document';
import type {ConsultationDraft} from './workspace-data';

export type TransferStatus='OFFERED'|'CONNECTING'|'ACCEPTED'|'REJECTED'|'CANCELLED'|'EXPIRED'|'FAILED'|'REVOKED';
export type TransferKind='WORK'|'CALL';
export type TransferDirection='ALL'|'SENT'|'RECEIVED';
export interface WorkTransfer {
  kind?:TransferKind;fromMediaIdentity?:string|null;targetMediaIdentity?:string|null;
  id:string;version:number;organizationId:string;consultationId:number;queueCode:string|null;
  recordVersion:number;liveWork:boolean;fromMemberId:number;fromName:string;toMemberId:number;toName:string;
  fromIssuer:string;fromSubject:string;toIssuer:string;toSubject:string;requesterIssuer:string;requesterSubject:string;requesterName:string;
  reason:string;memo:string;requestedAt:string;expiresAt:string;finishedAt:string|null;outcome:string|null;
  status:TransferStatus;canAccept:boolean;canReject:boolean;canCancel:boolean;canReadRecord:boolean;
}
export interface TransferPage {items:WorkTransfer[];page:number;hasMore:boolean;}
export interface TransferAssignee {memberId:number;name:string;teamId:string|null;}
export interface TransferEvent {id:number;action:TransferStatus;actorName:string;occurredAt:string;reason:string;}
export interface TransferRequest {consultationId:number;expectedRecordVersion:number;toMemberId:number;reason:string;memo:string;requestId:string;}
export type TransferInput=Omit<TransferRequest,'requestId'>;
export const transferLabels:Record<TransferStatus,string>={
  OFFERED:'수락 대기',CONNECTING:'음성 연결 확인 중',ACCEPTED:'이관 완료',REJECTED:'거절',CANCELLED:'취소',EXPIRED:'기한 만료',FAILED:'이관 실패',REVOKED:'권한·수신 상태 변경',
};
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)]));
  return value;
}
/** Formatting and attachments are part of the saved source, even when the plain text is unchanged. */
export function sameConsultationDraft(left:ConsultationDraft,right:ConsultationDraft) {
  const comparable=(d:ConsultationDraft)=>({categoryMain:d.categoryMain,categorySub:d.categorySub,categoryId:d.categoryId??null,resultId:d.resultId??null,
    status:d.status,tags:d.selectedTags.filter(Boolean),document:readDocument(d.memo)});
  return JSON.stringify(canonical(comparable(left)))===JSON.stringify(canonical(comparable(right)));
}
export function transferJson<T>(path:string,organizationId:string,options:RequestInit={}) {
  const headers=new Headers(options.headers);headers.set('X-Organization-ID',organizationId);
  return apiJson<T>(path,{...options,headers});
}
export function transferPendingKey(organizationId:string,issuer:string,subject:string,consultationId:number,kind:TransferKind='WORK') {
  return `${kind==='CALL'?'hellow_call_transfer_pending':'hellow_transfer_pending'}:${JSON.stringify([organizationId,issuer,subject,consultationId])}`;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseRequest(value:unknown,consultationId:number):TransferRequest {
  if(!value||typeof value!=='object')throw new Error('이관 요청 형식을 확인해 주세요.');
  const v=value as Record<string,unknown>;
  if(v.consultationId!==consultationId||!Number.isSafeInteger(v.consultationId)||(v.consultationId as number)<1
    ||!Number.isSafeInteger(v.expectedRecordVersion)||(v.expectedRecordVersion as number)<0
    ||!Number.isSafeInteger(v.toMemberId)||(v.toMemberId as number)<1
    ||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>2000
    ||typeof v.memo!=='string'||v.memo.length>10000||typeof v.requestId!=='string'||!uuid.test(v.requestId))throw new Error('이관 대상, 원본 버전과 사유를 확인해 주세요.');
  // Only the frozen API fields are restored; storage cannot inject extra submission fields.
  return {consultationId:v.consultationId as number,expectedRecordVersion:v.expectedRecordVersion as number,
    toMemberId:v.toMemberId as number,reason:v.reason,memo:v.memo,requestId:v.requestId};
}
export function pendingTransfer(key:string,consultationId:number):TransferRequest|null {
  try {
    const raw=sessionStorage.getItem(key);return raw?parseRequest(JSON.parse(raw),consultationId):null;
  }catch {
    throw new Error('보관한 이관 요청을 읽지 못했습니다. 이관 목록에서 접수 여부를 확인해 주세요.');
  }
}
export function confirmedTransfer(value:WorkTransfer|null,organizationId:string,consultationId:number,kind:TransferKind='WORK'):WorkTransfer {
  if(!value||typeof value.id!=='string'||!uuid.test(value.id)||!Object.hasOwn(transferLabels,value.status)
    ||(value.kind||'WORK')!==kind||value.organizationId!==organizationId||value.consultationId!==consultationId||!Number.isSafeInteger(value.version)||value.version<0)
    throw new Error('이관 접수 응답을 확인하지 못했습니다. 보관한 요청으로 다시 확인해 주세요.');
  return value;
}
/** Persist before POST; a retry first resolves the original UUID and never replaces it. */
export async function submitTransfer(organizationId:string,key:string,consultationId:number,input?:TransferInput,kind:TransferKind='WORK'):Promise<WorkTransfer> {
  let payload=pendingTransfer(key,consultationId);
  if(payload) {
    if(input&&JSON.stringify(parseRequest({...input,requestId:payload.requestId},consultationId))!==JSON.stringify(payload))
      throw new Error('보관한 요청의 내용은 변경할 수 없습니다. 기존 접수 결과를 먼저 확인해 주세요.');
    const existing=await transferJson<WorkTransfer|null>(`/api/transfers/request/${payload.requestId}`,organizationId);
    if(existing){const result=confirmedTransfer(existing,organizationId,consultationId,kind);sessionStorage.removeItem(key);return result;}
  } else {
    if(!input)throw new Error('이관 대상과 사유를 입력해 주세요.');
    payload=parseRequest({...input,requestId:crypto.randomUUID()},consultationId);
    sessionStorage.setItem(key,JSON.stringify(payload));
  }
  const result=confirmedTransfer(await transferJson<WorkTransfer>(`/api/transfers/${kind.toLowerCase()}`,organizationId,jsonBody(payload)),organizationId,consultationId,kind);
  sessionStorage.removeItem(key);return result;
}
