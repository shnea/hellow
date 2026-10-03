'use client';
import { useState } from 'react';
import { adminJson, permissionLabels, scopeLabels, type AdminMember, type AdminRole, type AdminTeam, type DataScope } from '@/lib/admin';
import { jsonBody } from '@/lib/api';
import { PermissionsField } from './PermissionsField';
import { TeamTree } from './TeamTree';

interface Props {organizationId:string;teams:AdminTeam[];roles:AdminRole[];members:AdminMember[];reload:()=>Promise<void>;}
export function StructureManagement({organizationId,teams,roles,members,reload}:Props) {
  const [team,setTeam]=useState<AdminTeam|null>(null);const [teamName,setTeamName]=useState('');const [parentId,setParentId]=useState('');const [teamActive,setTeamActive]=useState(true);
  const [role,setRole]=useState<AdminRole|null>(null);const [roleName,setRoleName]=useState('');const [grants,setGrants]=useState<Record<string,DataScope>>({});const [roleActive,setRoleActive]=useState(true);
  const [member,setMember]=useState<AdminMember|null>(null);const [memberTeam,setMemberTeam]=useState('');const [roleIds,setRoleIds]=useState<string[]>([]);const [direct,setDirect]=useState<string[]>([]);const [scope,setScope]=useState<DataScope>('SELF');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const chooseTeam=(value:AdminTeam|null)=>{setTeam(value);setTeamName(value?.name||'');setParentId(value?.parentId||'');setTeamActive(value?.active??true);};
  const chooseRole=(value:AdminRole|null)=>{setRole(value);setRoleName(value?.name||'');setGrants(value?.grants||{});setRoleActive(value?.active??true);};
  const chooseMember=(value:AdminMember|null)=>{setMember(value);setMemberTeam(value?.teamId||'');setRoleIds(value?.roleIds||[]);setDirect(value?.permissions||[]);setScope(value?.dataScope||'SELF');};
  const run=async(action:()=>Promise<void>)=>{if(busy)return false;setBusy(true);setError('');setMessage('');try{await action();await reload();return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}};
  const moveMember=(person:AdminMember,teamId:string|null)=>run(async()=>{
    await adminJson(`/api/admin/memberships/${person.id}/access`,organizationId,jsonBody({expectedVersion:person.version,teamId,roleIds:person.roleIds,dataScope:person.dataScope,permissions:person.permissions},'PUT'));
    setMessage(`${person.displayName||person.subject} 직원을 ${teams.find(t=>t.id===teamId)?.name||'팀 미지정'}으로 이동했습니다. 역할과 직접 권한은 유지됩니다.`);
  });
  const saveTeam=()=>run(async()=>{
    const saved=await adminJson<AdminTeam>(`/api/admin/teams${team?`/${team.id}`:''}`,organizationId,jsonBody({name:teamName,parentId:parentId||null,active:teamActive,expectedVersion:team?.version},team?'PUT':'POST'));
    chooseTeam(saved);setMessage('팀 정보를 저장했습니다.');
  });
  const saveRole=()=>run(async()=>{
    const saved=await adminJson<AdminRole>(`/api/admin/roles${role?`/${role.id}`:''}`,organizationId,jsonBody({name:roleName,grants,active:roleActive,expectedVersion:role?.version},role?'PUT':'POST'));
    chooseRole(saved);setMessage('역할을 저장했습니다. 연결된 직원의 다음 요청부터 적용됩니다.');
  });
  const saveMember=()=>run(async()=>{
    if(!member)return;
    const saved=await adminJson<AdminMember>(`/api/admin/memberships/${member.id}/access`,organizationId,jsonBody({expectedVersion:member.version,teamId:memberTeam||null,roleIds,dataScope:scope,permissions:direct},'PUT'));
    chooseMember(saved);setMessage('직원의 팀·역할·접근 범위를 저장했습니다.');
  });
  return <section className="admin-section"><h2>팀·역할·접근 범위</h2><p>역할마다 기능과 접근 범위를 지정하고 직원에게 연결하세요. 여러 역할과 직접 권한이 겹치면 해당 기능의 더 넓은 범위가 적용됩니다.</p>
    {error&&<p role="alert" className="admin-error">{error} 입력은 유지됩니다.</p>}{message&&<p role="status" className="admin-success">{message}</p>}
    <nav className="admin-actions" aria-label="팀·역할 설정 이동"><a href="#structure-teams">팀 관리</a><a href="#structure-roles">역할 관리</a><a href="#structure-members">직원 배치</a></nav>
    <section id="structure-teams"><h3>팀 관리</h3><p>소속 팀과 하위 팀의 기록을 함께 조회할 수 있습니다. 비활성화하기 전에 직원과 하위 팀을 이동하세요.</p>
      {!teams.length?<p>등록된 팀이 없습니다. 아래에서 첫 팀을 만드세요.</p>:<TeamTree teams={teams} members={members} busy={busy} selectedId={team?.id} onEdit={chooseTeam} onMove={moveMember}/>}
      <form className="admin-form" onSubmit={e=>{e.preventDefault();void saveTeam();}}><h4>{team?'팀 변경':'새 팀'}</h4><div className="admin-form-grid">
        <label>팀 이름<input required maxLength={100} disabled={busy} value={teamName} onChange={e=>setTeamName(e.target.value)}/></label>
        <label>상위 팀<select aria-label="상위 팀" disabled={busy} value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">최상위 팀</option>{teams.filter(t=>t.active&&t.id!==team?.id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>{team&&<label className="admin-check"><input type="checkbox" checked={teamActive} disabled={busy} onChange={e=>setTeamActive(e.target.checked)}/>팀 활성</label>}
        <div className="admin-actions"><button className="admin-primary" disabled={busy||!teamName.trim()}>팀 저장</button><button type="button" disabled={busy} onClick={()=>chooseTeam(null)}>새 팀 작성</button></div>
      </form>
    </section>
    <section id="structure-roles"><h3>역할 관리</h3><p>본인은 직접 담당한 기록, 팀은 본인 기록과 소속·하위 팀 기록, 조직 전체는 해당 조직의 모든 기록입니다. 미확인 과거 담당 기록은 조직 전체 권한으로 조회합니다.</p>
      {!roles.length?<p>등록된 역할이 없습니다. 기능별 접근 범위를 선택해 첫 역할을 만드세요.</p>:<ul className="admin-structure-list">{roles.map(r=><li key={r.id}><div><strong>{r.name}</strong><small>{r.active?'활성':'비활성'} · {Object.keys(r.grants).length}개 기능</small></div><button disabled={busy} onClick={()=>chooseRole(r)} aria-label={`${r.name} 역할 편집`}>편집</button></li>)}</ul>}
      <form className="admin-form" onSubmit={e=>{e.preventDefault();void saveRole();}}><h4>{role?'역할 변경':'새 역할'}</h4><label>역할 이름<input required disabled={busy} maxLength={100} value={roleName} onChange={e=>setRoleName(e.target.value)}/></label>
        <div className="admin-scope-grid">{Object.entries(permissionLabels).map(([permission,label])=><label key={permission}>{label}<select aria-label={label} disabled={busy} value={grants[permission]||''} onChange={e=>setGrants(prior=>{const next={...prior};if(e.target.value)next[permission]=e.target.value as DataScope;else delete next[permission];return next;})}>
          <option value="">허용 안 함</option>{Object.entries(scopeLabels).filter(([value])=>permission!=='organization:admin'||value==='ORGANIZATION').map(([value,text])=><option key={value} value={value}>{text}</option>)}
        </select></label>)}</div>
        {role&&<label className="admin-check"><input type="checkbox" checked={roleActive} disabled={busy} onChange={e=>setRoleActive(e.target.checked)}/>역할 활성</label>}
        <div className="admin-actions"><button className="admin-primary" disabled={busy||!roleName.trim()}>역할 저장</button><button type="button" disabled={busy} onClick={()=>chooseRole(null)}>새 역할 작성</button></div>
      </form>
    </section>
    <section id="structure-members"><h3>직원 배치와 권한 연결</h3><p>팀 이동은 이후 담당 기록에 적용됩니다. 이전 기록의 팀은 유지되며 본인이 담당한 기록은 계속 조회할 수 있습니다.</p>
      <div className="admin-table-scroll"><table><thead><tr><th>직원</th><th>소속 팀</th><th>역할·직접 권한</th><th>변경</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td>{m.displayName||m.subject}<small>{m.active?'활성':'접근 회수'}</small></td>
        <td>{teams.find(t=>t.id===m.teamId)?.name||'미지정'}</td><td>{m.roleIds.map(id=>roles.find(r=>r.id===id)?.name||'미확인 역할').join(', ')||'연결된 역할 없음'}<small>직접 권한 {m.permissions.length}개 · {scopeLabels[m.dataScope]}</small></td>
        <td><button disabled={busy} aria-label={`${m.displayName||m.subject} 팀·역할 편집`} onClick={()=>chooseMember(m)}>편집</button></td></tr>)}</tbody></table></div>
      {member?<form className="admin-form" onSubmit={e=>{e.preventDefault();void saveMember();}}><h4>{member.displayName||member.subject} 접근 설정</h4><label>소속 팀<select aria-label="소속 팀" disabled={busy} value={memberTeam} onChange={e=>setMemberTeam(e.target.value)}><option value="">소속 팀 없음</option>{teams.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <fieldset disabled={busy}><legend>연결할 역할</legend><div className="admin-permissions">{roles.filter(r=>r.active).map(r=><label key={r.id}><input type="checkbox" checked={roleIds.includes(r.id)} onChange={e=>setRoleIds(prior=>e.target.checked?[...prior,r.id]:prior.filter(id=>id!==r.id))}/>{r.name}</label>)}</div>{!roles.some(r=>r.active)&&<p>활성 역할을 먼저 만드세요. 직접 권한만 지정할 수도 있습니다.</p>}</fieldset>
        <details><summary>직접 권한 {direct.length}개 · {scopeLabels[scope]}</summary><p>역할로만 권한을 관리하려면 직접 권한을 모두 해제하세요. 직접 조직 전체 권한은 역할의 본인·팀 범위보다 넓게 적용됩니다.</p>
          <PermissionsField value={direct} onChange={setDirect} disabled={busy}/><label>직접 권한의 접근 범위<select aria-label="직접 권한의 접근 범위" disabled={busy} value={scope} onChange={e=>setScope(e.target.value as DataScope)}>{Object.entries(scopeLabels).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>
        </details><div className="admin-actions"><button className="admin-primary" disabled={busy}>팀·권한 저장</button><button type="button" disabled={busy} onClick={()=>chooseMember(null)}>편집 닫기</button></div>
      </form>:<p>위 직원의 편집 버튼에서 소속 팀과 역할을 지정하세요.</p>}
    </section>
  </section>;
}
