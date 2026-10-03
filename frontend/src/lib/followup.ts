import {apiJson} from './api';
export type FollowUpType='VISIT'|'CALLBACK';
export type FollowUpStatus='PENDING'|'SCHEDULED'|'IN_PROGRESS'|'COMPLETED'|'FAILED'|'CANCELLED';
export interface FollowUp {
  contactName?:string|null;phoneNumber?:string|null;
  id:number;version:number;actionType:FollowUpType;title:string;details:string;status:FollowUpStatus;
  queueCode:string|null;customerCode:string|null;createdAt:string;creatorName:string|null;assignedName:string|null;
  assignedMemberId:number|null;proposedAt:string|null;scheduledAt:string|null;scheduledEndAt:string|null;
  timeZone:string|null;durationMinutes:number|null;outcome:string|null;canWrite:boolean;canAssign:boolean;canProcess:boolean;
}
export interface FollowUpPage {items:FollowUp[];page:number;hasMore:boolean;}
export interface ActiveFollowUp {processing:boolean;id:number|null;}
export interface FollowUpAssignee {memberId:number;name:string;teamId:string|null;}
export interface FollowUpEvent {id:number;action:string;actorName:string;occurredAt:string;reason:string;beforeSnapshot:string|null;afterSnapshot:string;}
export interface FollowUpRequest {queueCode:string;actionType:FollowUpType;title:string;details:string;requestId:string;proposedAt?:string;timeZone?:string;}
export const followUpLabels:Record<FollowUpStatus,string>={PENDING:'일정 미확정',SCHEDULED:'일정 확정',IN_PROGRESS:'처리 중',COMPLETED:'완료',FAILED:'처리 실패',CANCELLED:'취소'};
export const followUpEventLabels:Record<string,string>={CREATED:'요청 접수',EDITED:'내용 수정',SCHEDULED:'일정 확정·변경',REASSIGNED:'담당 재배정',IN_PROGRESS:'처리 시작',COMPLETED:'처리 완료',FAILED:'실패 기록',CANCELLED:'취소'};
export function followUpJson<T>(path:string,organizationId:string,options:RequestInit={}){
  const headers=new Headers(options.headers);headers.set('X-Organization-ID',organizationId);
  return apiJson<T>(path,{...options,headers});
}
const koreanParts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function koreanInput(at:string|null){return at?koreanParts.format(new Date(at)).replace(' ','T'):'';}
export function koreanInstant(value:string){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('한국 시간으로 일자와 시각을 입력해 주세요.');
  const date=new Date(value+':00+09:00');
  if(!Number.isFinite(date.getTime())||koreanInput(date.toISOString())!==value)throw new Error('유효한 일자와 시각을 입력해 주세요.');
  return date.toISOString();
}
export function followUpTime(at:string|null){return at?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(at)):'미확정';}
export function pendingRequest(key:string,queueCode:string,actionType:FollowUpType):FollowUpRequest|null{
  const raw=sessionStorage.getItem(key);if(!raw)return null;
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object')throw new Error('보관한 요청을 읽지 못했습니다. 예약 목록에서 접수 여부를 확인해 주세요.');
  const v=value as Record<string,unknown>;
  if(v.queueCode!==queueCode||v.actionType!==actionType||typeof v.title!=='string'||!v.title.trim()||v.title.length>200||typeof v.details!=='string'||!v.details.trim()||v.details.length>10000||typeof v.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.requestId)
      ||(v.proposedAt===undefined)!==(v.timeZone===undefined)
      ||v.proposedAt!==undefined&&(typeof v.proposedAt!=='string'||!Number.isFinite(Date.parse(v.proposedAt))||v.timeZone!=='Asia/Seoul'))
    throw new Error('보관한 요청을 읽지 못했습니다. 예약 목록에서 접수 여부를 확인해 주세요.');
  return v as unknown as FollowUpRequest;
}
