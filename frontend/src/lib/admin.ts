import { apiJson } from './api';
export interface AdminOrganization { id: string; name: string; publicCode: string; active: boolean; }
export type DataScope = 'SELF'|'TEAM'|'ORGANIZATION';
export const scopeLabels:Record<DataScope,string> = {SELF:'본인',TEAM:'소속 팀·하위 팀',ORGANIZATION:'조직 전체'};
export interface AdminTeam {id:string;name:string;parentId:string|null;active:boolean;version:number;}
export interface AdminRole {id:string;name:string;grants:Record<string,DataScope>;active:boolean;version:number;}
export interface AdminMember { id: number; subject: string; displayName: string | null; permissions: string[]; active: boolean; version: number; teamId:string|null;roleIds:string[];dataScope:DataScope;effectiveScopes?:Record<string,DataScope>; }
export interface AdminInvitation { id: string; recipientEmail: string; expiresAt: string; cancelled: boolean; acceptedSubject: string | null; }
export interface AdminEvent { id: number; occurredAt: string; action: string; actorSubject: string; target: string | null; details: string | null; }
export interface SettingsView { version: number; overrides: Record<string,string>; effective: Record<string,string>; }
export const permissionLabels: Record<string,string> = {
  'recording:read':'통화 녹음 재생·다운로드', 'recording:manage':'통화 녹음 저장 재시도',
  'organization:admin':'조직 관리', 'customer:read':'고객 조회', 'customer:write':'고객 등록·수정',
  'queue:read':'대기열 조회', 'queue:accept':'상담 수락', 'consultation:read':'상담 기록 조회',
  'consultation:write':'상담 기록 작성', 'consultation:transfer':'상담 이관 요청', 'transfer:read':'상담 이관 조회·응답',
  'followup:read':'후속 업무 조회','followup:write':'후속 업무 작성·처리','followup:assign':'후속 업무 재배정','template:personal':'내 템플릿 관리',
};
export const agentPermissions = Object.keys(permissionLabels).filter(key=>key!=='organization:admin'&&key!=='followup:assign'&&key!=='recording:manage'&&key!=='recording:read');
export function adminJson<T>(path:string, organizationId:string, options:RequestInit={}) {
  const headers=new Headers(options.headers);
  if(organizationId) headers.set('X-Organization-ID',organizationId);
  return apiJson<T>(path,{...options,headers});
}
export const actionLabels:Record<string,string> = {
  'followup.created':'후속 요청 접수','followup.edited':'후속 내용 수정','followup.scheduled':'후속 일정 확정·변경','followup.reassigned':'후속 담당 재배정',
  'followup.in_progress':'후속 처리 시작','followup.completed':'후속 처리 완료','followup.failed':'후속 실패 기록','followup.cancelled':'후속 취소',
  'agent.state.change':'상담사 수신 상태 변경','queue.routing.restart':'상담 배정 다시 시작',
  'customer.register':'고객 신규 등록','customer.queue.link':'상담에 기존 고객 연결',
  'customer.history.link':'등록 전 이력 연결','customer.history.undo':'등록 전 이력 연결 취소',
  ORGANIZATION_CREATED:'조직 생성', MEMBER_ADDED:'직원 등록', MEMBER_CHANGED:'직원 권한 변경', MEMBER_REVOKED:'직원 접근 회수',
  INVITATION_CREATED:'초대 생성', INVITATION_CANCELLED:'초대 취소', INVITATION_ACCEPTED:'초대 수락',
  CONSULTATION_CATALOG_CHANGED:'상담 분류·결과 변경',TEMPLATE_CHANGED:'공유 템플릿 변경',SUPPORT_SETTINGS_CHANGED:'접수 설정 변경', CRM_LOGIN:'CRM 로그인 확인', CRM_LOGOUT:'CRM 로그아웃 요청', CRM_ORGANIZATION_ENTER:'조직 진입',
  TEAM_CREATED:'팀 생성',TEAM_CHANGED:'팀 변경',ROLE_CREATED:'역할 생성',ROLE_CHANGED:'역할 변경',MEMBER_ACCESS_CHANGED:'직원 팀·역할·범위 변경',
};
