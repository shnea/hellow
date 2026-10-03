'use client';
import { useState } from 'react';
import { adminJson, agentPermissions, type AdminMember, type AdminInvitation } from '@/lib/admin';
import { jsonBody } from '@/lib/api';
import { PermissionsField } from './PermissionsField';
interface Props { organizationId:string; members:AdminMember[]; invitations:AdminInvitation[]; reload:()=>Promise<void>; }
export function MemberManagement({organizationId,members,invitations,reload}:Props) {
  const [edit,setEdit]=useState<AdminMember|null>(null);
  const [subject,setSubject]=useState(''); const [name,setName]=useState('');
  const [permissions,setPermissions]=useState<string[]>(agentPermissions); const [active,setActive]=useState(true);
  const [email,setEmail]=useState(''); const [link,setLink]=useState('');
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const choose=(member:AdminMember|null)=>{setEdit(member);setSubject(member?.subject||'');setName(member?.displayName||'');setPermissions(member?.permissions||agentPermissions);setActive(member?.active??true);setError('');setMessage('');};
  const run=async(action:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();await reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const save=()=>run(async()=>{
    if(edit){const result=await adminJson<AdminMember>(`/api/admin/memberships/${edit.id}`,organizationId,jsonBody({expectedVersion:edit.version,displayName:name,permissions,active},'PUT'));setEdit(result);}
    else {await adminJson('/api/admin/memberships',organizationId,jsonBody({subject,displayName:name,permissions}));setSubject('');setName('');}
    setMessage('직원 정보를 저장했습니다.');
  });
  const invite=()=>run(async()=>{
    const result=await adminJson<{path:string;expiresAt:string}>('/api/admin/invitations',organizationId,jsonBody({email,permissions}));
    setLink(new URL(result.path,window.location.origin).href);setMessage('초대 링크를 만들었습니다. 7일 안에 수락할 수 있습니다.');
  });
  return <section className="admin-section"><h2>직원과 관리자</h2><p>관리자를 바꾸려면 새 관리자를 먼저 지정한 뒤 기존 관리자 권한을 해제하세요.</p>
    <div className="admin-table-scroll"><table><thead><tr><th>직원</th><th>권한</th><th>상태</th><th>변경</th></tr></thead><tbody>
      {members.map(member=><tr key={member.id}><td>{member.displayName||'이름 미등록'}<small>{member.subject}</small></td>
        <td>{member.permissions.includes('organization:admin')?'조직 관리자':'직원'}</td><td>{member.active?'활성':'접근 회수'}</td>
        <td><button disabled={busy} onClick={()=>choose(member)} aria-label={`${member.displayName||member.subject} 권한 편집`}>편집</button></td></tr>)}
    </tbody></table></div>
    <form className="admin-form" onSubmit={e=>{e.preventDefault();void save();}}>
      <h3>{edit?'직원 권한 변경':'계정 ID로 직원 등록'}</h3><div className="admin-form-grid">
        <label>플랫폼 계정 ID<input required value={subject} disabled={busy||Boolean(edit)} maxLength={255} onChange={e=>setSubject(e.target.value)}/></label>
        <label>표시 이름<input value={name} disabled={busy} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
      </div><PermissionsField value={permissions} onChange={setPermissions} disabled={busy}/>
      {edit&&<label className="admin-check"><input type="checkbox" checked={active} disabled={busy} onChange={e=>setActive(e.target.checked)}/>조직 접근 허용</label>}
      <div className="admin-actions"><button className="admin-primary" disabled={busy||!subject.trim()}>{busy?'처리 중…':'직원 저장'}</button><button type="button" disabled={busy} onClick={()=>choose(null)}>새 직원 등록</button></div>
    </form>
    <form className="admin-form" onSubmit={e=>{e.preventDefault();void invite();}}><h3>이메일로 직원 초대</h3>
      <p>위에서 선택한 기능 권한으로 초대합니다. 초대받은 이메일이 인증된 플랫폼 계정으로 수락해야 합니다.</p>
      <label>초대받을 이메일<input type="email" required maxLength={254} disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <button className="admin-primary" disabled={busy||!email.trim()}>초대 링크 만들기</button>
      {link&&<label>초대 링크<input readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label>}
    </form>
    {error&&<p role="alert" className="admin-error">{error} 입력은 유지됩니다.</p>}{message&&<p role="status" className="admin-success">{message}</p>}
    <h3>최근 초대</h3>{!invitations.length?<p>등록된 초대가 없습니다. 이메일로 초대 링크를 만들어 전달할 수 있습니다.</p>:<div className="admin-table-scroll"><table><thead><tr><th>이메일</th><th>만료</th><th>상태</th><th>관리</th></tr></thead><tbody>
      {invitations.map(i=><tr key={i.id}><td>{i.recipientEmail}</td><td>{new Date(i.expiresAt).toLocaleString('ko-KR')}</td><td>{i.acceptedSubject?'수락 완료':i.cancelled?'취소':new Date(i.expiresAt)<new Date()?'만료':'수락 대기'}</td>
        <td><button disabled={busy||i.cancelled||Boolean(i.acceptedSubject)} onClick={()=>void run(async()=>{await adminJson(`/api/admin/invitations/${i.id}/cancel`,organizationId,{method:'POST'});setMessage('초대를 취소했습니다.');})}>초대 취소</button></td></tr>)}
    </tbody></table></div>}
  </section>;
}
