'use client';
import { useState } from 'react';
import { ChevronDown,ChevronRight,Users } from 'lucide-react';
import type { AdminTeam,AdminMember } from '@/lib/admin';

export function TeamTree({teams,members,busy,selectedId,onEdit,onMove}:{teams:AdminTeam[];members:AdminMember[];busy:boolean;selectedId?:string;onEdit:(team:AdminTeam)=>void;onMove:(member:AdminMember,teamId:string|null)=>Promise<boolean>}) {
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [shownTeam,setShownTeam]=useState<string|null>(null);
  const [dragged,setDragged]=useState<number|null>(null);const [dropTarget,setDropTarget]=useState<string|null>(null);
  const [moving,setMoving]=useState<AdminMember|null>(null);const [target,setTarget]=useState('');
  const ids=new Set(teams.map(t=>t.id));const children=new Map<string,AdminTeam[]>();
  for(const team of teams){const parent=team.parentId&&ids.has(team.parentId)?team.parentId:'';children.set(parent,[...(children.get(parent)||[]),team]);}
  children.forEach(rows=>rows.sort((a,b)=>a.name.localeCompare(b.name,'ko')));
  const direct=(id:string)=>members.filter(m=>m.active&&m.teamId===id).length;
  const total=(id:string,visited=new Set<string>()):number=>{if(visited.has(id))return 0;const next=new Set(visited).add(id);return direct(id)+(children.get(id)||[]).reduce((sum,t)=>sum+total(t.id,next),0);};
  const move=async(person:AdminMember,teamId:string|null)=>{
    if(busy||!person.active||person.teamId===teamId)return;
    if(await onMove(person,teamId)){setShownTeam(teamId);setMoving(null);}
  };
  const people=(teamId:string|null)=>{
    const rows=members.filter(m=>(m.teamId||null)===teamId);
    if(!rows.length)return <p className="admin-team-members">이 팀에 소속된 직원이 없습니다.</p>;
    return <ul className="admin-team-members" aria-label={`${teams.find(t=>t.id===teamId)?.name||'팀 미지정'} 소속 직원`}>{rows.map(person=><li key={person.id}>
      <span draggable={!busy&&person.active} onDragStart={e=>{setDragged(person.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-hellow-member',String(person.id));}}
        onDragEnd={()=>{setDragged(null);setDropTarget(null);}} title="다른 팀으로 드래그하여 이동"><strong>{person.displayName||person.loginId||'이름 미확인 직원'}</strong><small>{person.active?'다른 팀으로 드래그하여 이동':'접근 회수'}</small></span>
      <button type="button" disabled={busy||!person.active} aria-label={`${person.displayName||person.loginId||'이름 미확인 직원'} 이동할 팀 선택`} onClick={()=>{setMoving(person);setTarget(person.teamId||'');}}>이동</button>
    </li>)}</ul>;
  };
  const branch=(team:AdminTeam,visited:Set<string>):React.ReactNode=>{
    if(visited.has(team.id))return null;const next=new Set(visited).add(team.id);const rows=children.get(team.id)||[];const open=!collapsed.has(team.id);
    return <li key={team.id}><div className={`admin-team-row${team.active?'':' admin-team-inactive'}`} data-drop-target={dropTarget===team.id}
      onDragOver={e=>{if(dragged!==null&&team.active&&!busy){e.preventDefault();e.dataTransfer.dropEffect='move';setDropTarget(team.id);}}}
      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDropTarget(null);}}
      onDrop={e=>{e.preventDefault();setDropTarget(null);const person=members.find(m=>m.id===dragged);setDragged(null);if(person&&team.active&&!busy)void move(person,team.id);}}>
      {rows.length?<button type="button" className="admin-team-toggle" aria-label={`${team.name} 하위 팀 ${open?'접기':'펼치기'}`} aria-expanded={open} aria-controls={`team-children-${team.id}`}
        onClick={()=>setCollapsed(prior=>{const value=new Set(prior);if(open)value.add(team.id);else value.delete(team.id);return value;})}>{open?<ChevronDown size={18}/>:<ChevronRight size={18}/>}</button>:<span className="admin-team-leaf" aria-hidden="true"><Users size={18}/></span>}
      <button type="button" className="admin-team-name" aria-label={`${team.name} 소속 직원 보기`} aria-expanded={shownTeam===team.id} onClick={()=>setShownTeam(prior=>prior===team.id?null:team.id)}><strong>{team.name}</strong><small>{team.active?'활성':'비활성'} · 직원 {direct(team.id)}명{rows.length?` · 하위 포함 ${total(team.id)}명`:''}</small></button>
      <button type="button" disabled={busy} aria-pressed={selectedId===team.id} aria-label={`${team.name} 팀 편집`} onClick={()=>onEdit(team)}>편집</button>
    </div>{shownTeam===team.id&&people(team.id)}{rows.length>0&&open&&<ul id={`team-children-${team.id}`}>{rows.map(t=>branch(t,next))}</ul>}</li>;
  };
  return <><div className="admin-actions"><button type="button" onClick={()=>setCollapsed(new Set())}>전체 펼치기</button><button type="button" onClick={()=>setCollapsed(new Set(teams.map(t=>t.id)))}>전체 접기</button></div>
    <div className="admin-team-tree"><ul aria-label="조직 팀 트리">{(children.get('')||[]).map(t=>branch(t,new Set()))}</ul></div>
    {members.some(m=>!m.teamId)&&<details open><summary>팀 미지정 직원 {members.filter(m=>m.active&&!m.teamId).length}명</summary>{people(null)}</details>}
    {moving&&<form className="admin-form" onSubmit={e=>{e.preventDefault();void move(moving,target||null);}}><h4>{moving.displayName||moving.loginId||'이름 미확인 직원'} 팀 이동</h4>
      <label>이동할 팀<select aria-label="이동할 팀" disabled={busy} value={target} onChange={e=>setTarget(e.target.value)}><option value="">팀 미지정</option>{teams.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <p>역할과 직접 권한을 유지하며 소속 팀만 바꿉니다. 이전 상담 기록의 작성 당시 팀은 유지됩니다.</p>
      <div className="admin-actions"><button disabled={busy||(moving.teamId||'')===target} className="admin-primary">선택한 팀으로 이동</button><button type="button" disabled={busy} onClick={()=>setMoving(null)}>이동 취소</button></div>
    </form>}
  </>;
}
