'use client';
import { AdminConsole } from './admin/AdminConsole';
import { useState } from 'react';
import './admin/admin.css';

export interface WorkspaceOrganization {id:string;name:string;permissions:string[];}
export function WorkspaceSettings({organizations,organizationId,platformAdmin,blockedReason,busy,onSwitch,onBack}:{
  organizations:WorkspaceOrganization[];organizationId:string;platformAdmin:boolean;blockedReason:string;busy:boolean;
  onSwitch:(id:string)=>Promise<void>;onBack:()=>void;
}) {
  const current=organizations.find(o=>o.id===organizationId);
  const [platform,setPlatform]=useState(false);
  return <main className="admin-shell"><header className="admin-header"><h1>시스템 설정</h1><button onClick={onBack}>상담 화면으로 돌아가기</button></header>
    <section className="admin-section"><h2>작업 조직</h2><p>가입한 활성 조직 중 하나를 선택하세요. 선택한 조직의 고객·상담과 권한을 사용합니다.</p>
      <label>현재 작업 조직<select aria-label="현재 작업 조직" value={organizationId} disabled={busy||Boolean(blockedReason)} onChange={e=>void onSwitch(e.target.value)}>
        {organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
      </select></label>
      {blockedReason&&<p role="status">{blockedReason} 조직 변경은 상담 완료 후 가능합니다.</p>}
      {!current?.permissions.includes('organization:admin')&&!platformAdmin&&<p>조직 관리는 해당 조직의 관리자에게 요청해 주세요.</p>}
    </section>
    {platformAdmin&&<nav className="admin-tabs" aria-label="관리 범위"><button aria-current={!platform?'page':undefined} onClick={()=>setPlatform(false)}>현재 조직 관리</button><button aria-current={platform?'page':undefined} onClick={()=>setPlatform(true)}>최고관리자</button></nav>}
    {(platformAdmin||current?.permissions.includes('organization:admin'))&&<AdminConsole key={`${platform}:${organizationId}`} platform={platform&&platformAdmin} embedded fixedOrganizationId={platform?undefined:organizationId}/>}
  </main>;
}
