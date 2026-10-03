'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson, jsonBody } from '@/lib/api';
import { actionLabels, adminJson, type AdminOrganization, type AdminMember, type AdminInvitation, type AdminEvent, type SettingsView, type AdminTeam, type AdminRole } from '@/lib/admin';
import { MemberManagement } from './MemberManagement';
import { SettingsManagement } from './SettingsManagement';
import { CatalogManagement } from './CatalogManagement';
import { TemplateManagement } from './TemplateManagement';
import { StructureManagement } from './StructureManagement';
import './admin.css';

interface Identity {subject:string;name:string;platformAdmin:boolean;}
interface Impact {organizationId:string;name:string;inherited:string[];}
export function AdminConsole({platform=false,onWorkspace,embedded=false,fixedOrganizationId}:{platform?:boolean;onWorkspace?:()=>void;embedded?:boolean;fixedOrganizationId?:string}) {
  const [identity,setIdentity]=useState<Identity|null>(null);const [organizations,setOrganizations]=useState<AdminOrganization[]>([]);
  const [organizationId,setOrganizationId]=useState('');const selected=useRef('');
  const [tab,setTab]=useState<'members'|'structure'|'settings'|'content'|'audit'>(platform?'settings':'members');
  const [teams,setTeams]=useState<AdminTeam[]>([]);const [roles,setRoles]=useState<AdminRole[]>([]);
  const [members,setMembers]=useState<AdminMember[]>([]);const [invites,setInvites]=useState<AdminInvitation[]>([]);
  const [events,setEvents]=useState<AdminEvent[]>([]);const [settings,setSettings]=useState<SettingsView|null>(null);const [impact,setImpact]=useState<Impact[]>([]);
  const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const [orgName,setOrgName]=useState('');const [adminSubject,setAdminSubject]=useState('');const [message,setMessage]=useState('');
  useEffect(()=>{
    const abort=new AbortController();
    Promise.all([apiJson<Identity>('/api/me',{signal:abort.signal}),apiJson<AdminOrganization[]>('/api/admin/organizations',{signal:abort.signal})])
      .then(([me,orgs])=>{if(abort.signal.aborted)return;setIdentity(me);setAdminSubject(me.subject);setOrganizations(orgs);
        const prior=sessionStorage.getItem('hellow_organization_id');
        selected.current=fixedOrganizationId?(orgs.find(o=>o.id===fixedOrganizationId)?.id||''):orgs.find(o=>o.id===prior)?.id||orgs[0]?.id||'';setOrganizationId(selected.current);
        if(platform&&!me.platformAdmin)setError('최고관리자 권한이 없습니다. 조직 관리 화면을 이용해 주세요.');
      }).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[platform,fixedOrganizationId]);
  const reload=useCallback(async(signal?:AbortSignal)=>{
    if(!identity || platform&&!identity.platformAdmin || !platform&&!organizationId)return;
    const id=organizationId;
    try{
      const [config,rows,people,invitations,affected,teamRows,roleRows]=await Promise.all([
        adminJson<SettingsView>(`/api/admin/settings/${platform?'common':'organization'}`,id,{signal}),
        adminJson<AdminEvent[]>(platform?'/api/admin/audit/common':'/api/admin/audit',id,{signal}),
        platform?Promise.resolve([]):adminJson<AdminMember[]>('/api/admin/memberships',id,{signal}),
        platform?Promise.resolve([]):adminJson<AdminInvitation[]>('/api/admin/invitations',id,{signal}),
        platform?apiJson<Impact[]>('/api/admin/settings/impact/common',{signal}):Promise.resolve([]),
        platform?Promise.resolve([]):adminJson<AdminTeam[]>('/api/admin/teams',id,{signal}),
        platform?Promise.resolve([]):adminJson<AdminRole[]>('/api/admin/roles',id,{signal}),
      ]);
      if(signal?.aborted || (!platform&&id!==selected.current))return;
      setSettings(config);setEvents(rows);setMembers(people);setInvites(invitations);setImpact(affected);setError('');
      setTeams(teamRows);setRoles(roleRows);
    }catch(e){if(!signal?.aborted&&(platform||id===selected.current))setError((e as Error).message);throw e;}
    finally{if(!signal?.aborted&&(platform||id===selected.current))setLoading(false);}
  },[identity,organizationId,platform]);
  useEffect(()=>{const abort=new AbortController();void reload(abort.signal).catch(()=>{});return()=>abort.abort();},[reload]);
  const createOrganization=async()=>{
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await apiJson('/api/admin/organizations',jsonBody({name:orgName,initialAdminSubject:adminSubject}));
      setOrganizations(await apiJson('/api/admin/organizations'));setOrgName('');setMessage('조직과 최초 관리자를 등록했습니다. 조직 관리 화면에서 설정할 수 있습니다.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const org=organizations.find(o=>o.id===organizationId);
  const Shell=embedded?'section':'main';const Heading=embedded?'h2':'h1';
  return <Shell className="admin-shell"><header className="admin-header"><div><Heading>{platform?'최고관리자':'조직 관리'}</Heading><p>{identity?.name||'계정 확인 중'}{!platform&&org?` · ${org.name}`:''}</p></div>
    {!embedded&&<nav aria-label="관리 화면 이동">{onWorkspace?<button onClick={onWorkspace}>상담 화면으로 돌아가기</button>:<Link href="/">상담 화면</Link>}{!onWorkspace&&<Link href="/admin/organization">조직 관리</Link>}{identity?.platformAdmin&&<Link href="/admin/platform">최고관리자</Link>}</nav>}</header>
    {!identity?<section className="admin-section"><p role="status">{error||'로그인과 관리 권한을 확인하고 있습니다.'}</p><Link href="/login">로그인</Link></section>:
      platform&&!identity.platformAdmin?<p role="alert" className="admin-error">{error}</p>:<>
      {platform&&<section className="admin-section"><h2>조직 생성</h2><form className="admin-form" onSubmit={e=>{e.preventDefault();void createOrganization();}}>
        <div className="admin-form-grid"><label>조직 이름<input required maxLength={150} value={orgName} disabled={busy} onChange={e=>setOrgName(e.target.value)}/></label>
        <label>최초 관리자 계정 ID<input required maxLength={255} value={adminSubject} disabled={busy} onChange={e=>setAdminSubject(e.target.value)}/></label></div>
        <p>현재 계정 ID가 기본으로 입력됩니다. 최초 관리자에게 조직 업무 권한이 부여됩니다.</p>
        <button className="admin-primary" disabled={busy}>{busy?'생성 중…':'조직 생성'}</button></form>{message&&<p role="status" className="admin-success">{message}</p>}
        <h3>등록된 조직</h3><ul className="admin-organization-list">{organizations.map(o=><li key={o.id}><strong>{o.name}</strong><span>{o.active?'활성':'중지'}</span><code>{o.id}</code></li>)}</ul>
      </section>}
      {!platform&&<section className="admin-toolbar">{fixedOrganizationId?<p>관리 대상 · {org?.name||'조직 확인 중'}</p>:<label>대상 조직<select value={organizationId} disabled={loading||busy} onChange={e=>{selected.current=e.target.value;setSettings(null);setLoading(true);setOrganizationId(e.target.value);}}>
        {!organizations.length&&<option value="">관리할 조직 없음</option>}{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
        {org&&<a href={`/support?org=${encodeURIComponent(org.publicCode)}`} target="_blank" rel="noopener noreferrer">고객 접수 화면 열기</a>}
      </section>}
      {(!platform&&!organizations.length)?<p className="admin-section">관리 가능한 조직이 없습니다. 조직 관리자에게 관리 권한을 요청해 주세요.</p>:<>
        <nav className="admin-tabs" aria-label="관리 항목">{(!platform?['members','structure','settings','content','audit']:['settings','content','audit']).map(value=><button key={value} aria-current={tab===value?'page':undefined}
          onClick={()=>setTab(value as typeof tab)}>{value==='members'?'직원·초대':value==='structure'?'팀·역할':value==='settings'?'고객 접수 설정':value==='content'?'분류·템플릿':'로그인·변경 이력'}</button>)}
          <button disabled={loading} onClick={()=>{setError('');void reload().catch(()=>{});}}>다시 조회</button></nav>
        {error&&<p role="alert" className="admin-error">{error}</p>}{loading&&<p role="status" className="admin-section">관리 정보를 불러오고 있습니다.</p>}
        {tab==='content'&&<><CatalogManagement key={`catalog:${platform}:${organizationId}`} scope={platform?'common':'organization'} organizationId={organizationId}/><TemplateManagement key={`templates:${platform}:${organizationId}`} scope={platform?'common':'organization'} organizationId={organizationId}/></>}
        {settings&&tab==='members'&&<MemberManagement key={organizationId} organizationId={organizationId} members={members} invitations={invites} reload={reload}/>}
        {settings&&tab==='structure'&&<StructureManagement key={organizationId} organizationId={organizationId} members={members} teams={teams} roles={roles} reload={reload}/>}
        {tab==='settings'&&settings&&<><SettingsManagement key={`${platform}:${organizationId}`} scope={platform?'common':'organization'} organizationId={organizationId} initial={settings} onSaved={setSettings}/>
          {platform&&<section className="admin-section"><h3>공통 설정의 적용 범위</h3><p>아래 조직에서 상속하는 항목에만 공통 변경이 적용됩니다.</p><ul>{impact.map(o=><li key={o.organizationId}>{o.name} · {o.inherited.length}개 항목 상속</li>)}</ul></section>}
          {!platform&&org&&<section className="admin-section"><h3>홈페이지 상담 버튼 연결</h3><p>홈페이지 버튼의 연결 주소에 아래 URL을 지정하세요.</p><code className="admin-link">{typeof window!=='undefined'?`${window.location.origin}/support?org=${encodeURIComponent(org.publicCode)}`:''}</code></section>}
        </>}
        {settings&&tab==='audit'&&<section className="admin-section"><h2>로그인·변경 이력</h2><p>CRM에서 확인한 로그인·로그아웃 요청·조직 진입과 관리 변경의 최근 100건입니다. 플랫폼 전체 인증 이력과는 별개입니다.</p>
          {!events.length?<p>아직 기록된 이력이 없습니다. 로그인하거나 설정을 변경하면 표시됩니다.</p>:<div className="admin-table-scroll"><table><thead><tr><th>시각</th><th>작업</th><th>계정</th><th>변경 내용</th></tr></thead><tbody>
          {events.map(e=><tr key={e.id}><td>{new Date(e.occurredAt).toLocaleString('ko-KR')}</td><td>{actionLabels[e.action]||e.action}</td><td>{e.actorSubject}</td><td>{e.details}</td></tr>)}
          </tbody></table></div>}</section>}
      </>}
    </>}
  </Shell>;
}
