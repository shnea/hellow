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
  'organization:admin':'조직 관리', 'customer:read':'고객 조회', 'customer:write':'고객 등록·수정',
  'queue:read':'대기열 조회', 'queue:accept':'상담 수락', 'consultation:read':'상담 기록 조회',
  'consultation:write':'상담 기록 작성', 'followup:write':'후속 요청 작성','template:personal':'내 템플릿 관리',
};
export const agentPermissions = Object.keys(permissionLabels).filter(key=>key!=='organization:admin');
export function adminJson<T>(path:string, organizationId:string, options:RequestInit={}) {
  const headers=new Headers(options.headers);
  if(organizationId) headers.set('X-Organization-ID',organizationId);
  return apiJson<T>(path,{...options,headers});
}
export const actionLabels:Record<string,string> = {
  ORGANIZATION_CREATED:'조직 생성', MEMBER_ADDED:'직원 등록', MEMBER_CHANGED:'직원 권한 변경', MEMBER_REVOKED:'직원 접근 회수',
  INVITATION_CREATED:'초대 생성', INVITATION_CANCELLED:'초대 취소', INVITATION_ACCEPTED:'초대 수락',
  CONSULTATION_CATALOG_CHANGED:'상담 분류·결과 변경',TEMPLATE_CHANGED:'공유 템플릿 변경',SUPPORT_SETTINGS_CHANGED:'접수 설정 변경', CRM_LOGIN:'CRM 로그인 확인', CRM_LOGOUT:'CRM 로그아웃 요청', CRM_ORGANIZATION_ENTER:'조직 진입',
  TEAM_CREATED:'팀 생성',TEAM_CHANGED:'팀 변경',ROLE_CREATED:'역할 생성',ROLE_CHANGED:'역할 변경',MEMBER_ACCESS_CHANGED:'직원 팀·역할·범위 변경',
};
