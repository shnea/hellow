'use client';
import {useEffect,useState} from 'react';
import {adminJson} from '@/lib/admin';
import {jsonBody} from '@/lib/api';
import {templateSource,type TextTemplate} from '@/lib/consultation-content';
interface Impact {organizationId:string;name:string;overridden:boolean;}
export function TemplateManagement({scope,organizationId}:{scope:'common'|'organization'|'personal';organizationId:string}){
  const path=scope==='personal'?'/api/templates/personal':`/api/admin/templates/${scope}`;
  const [rows,setRows]=useState<TextTemplate[]|null>(null);const [selected,setSelected]=useState<string|null>(null);
  const [name,setName]=useState('');const [body,setBody]=useState('');const [active,setActive]=useState(true);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [impact,setImpact]=useState<Impact[]>([]);
  const current=rows?.find(t=>t.id===selected);
  useEffect(()=>{const abort=new AbortController();adminJson<TextTemplate[]>(path,organizationId,{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setRows(r);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[path,organizationId]);
  useEffect(()=>{if(scope!=='common'||!selected)return;const abort=new AbortController();adminJson<Impact[]>(`/api/admin/templates/impact/${selected}`,organizationId,{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setImpact(r);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[selected,scope,organizationId]);
  const edit=(row:TextTemplate)=>{setSelected(row.id);setName(row.name);setBody(row.body);setActive(row.active);setError('');setNotice('');};
  const clear=()=>{setSelected(null);setName('');setBody('');setActive(true);setNotice('');setImpact([]);};
  const reload=async()=>{if(busy)return;setBusy(true);setError('');try{setRows(await adminJson<TextTemplate[]>(path,organizationId));setNotice('입력을 보존하고 최신 목록을 조회했습니다. 서버 내용과 비교한 뒤 저장하세요.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const save=async()=>{if(busy||!rows)return;setBusy(true);setError('');setNotice('');try{
    if(selected&&!current)throw new Error('선택한 템플릿의 접근 권한 또는 목록이 변경됐습니다. 입력을 복사해 보존한 뒤 새로 작성해 주세요.');
    const origin=scope==='organization'&&current&&(current.inherited||current.overrideId)?current.id:null;
    const updateId=current?(scope==='organization'?current.overrideId||(!origin?current.id:null):current.id):null;
    const payload={expectedVersion:current?.version||0,expectedCommonVersion:origin?current!.commonVersion:null,originId:origin,name:name.trim(),body,active};
    const result=await adminJson<TextTemplate|TextTemplate[]>(updateId?`${path}/${updateId}`:path,organizationId,jsonBody(payload,updateId?'PUT':'POST'));
    if(scope==='personal'){const row=result as TextTemplate;setRows(prev=>[...(prev||[]).filter(t=>t.id!==row.id),row]);setSelected(row.id);}
    else{const list=result as TextTemplate[];setRows(list);if(!current){const created=list.find(t=>!rows.some(p=>p.id===t.id));if(created)setSelected(created.id);}}
    setNotice('템플릿을 저장했습니다. 이전에 삽입한 상담 내용은 변경되지 않습니다.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const restore=async()=>{if(!current?.overrideId||busy)return;setBusy(true);setError('');setNotice('');try{
    const list=await adminJson<TextTemplate[]>(`/api/admin/templates/organization/${current.overrideId}/restore`,organizationId,jsonBody({expectedVersion:current.version,expectedCommonVersion:current.commonVersion}));
    setRows(list);const restored=list.find(t=>t.id===current.id);if(restored){setName(restored.name);setBody(restored.body);setActive(restored.active);}setNotice('공통 템플릿을 다시 상속합니다. 기존 상담 내용은 유지됩니다.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <section className="admin-section"><h2>{scope==='common'?'공통 템플릿':scope==='organization'?'조직 공유 템플릿':'내 템플릿'}</h2>
    <p>{scope==='common'?'공통 템플릿을 수정하면 해당 템플릿을 상속하는 조직에 적용됩니다.':scope==='organization'?'공통 템플릿을 그대로 사용하거나 조직의 내용으로 바꿀 수 있습니다. 조직에서 새 템플릿을 추가할 수도 있습니다.':'현재 조직에서 본인만 관리하는 템플릿입니다. 조직 관리자도 다른 직원의 개인 템플릿을 열람할 수 없습니다.'} 비활성 템플릿은 새 상담의 삽입 목록에서 숨겨집니다.</p>
    {error&&<p className="admin-error" role="alert">{error} 입력은 유지됩니다.</p>}{notice&&<p className="admin-success" role="status">{notice}</p>}
    {rows===null?<p role="status">템플릿 조회 중…</p>:<>
      {!rows.length?<p>등록된 템플릿이 없습니다. 아래에서 새 템플릿을 작성하세요.</p>:<ul className="admin-content-list">{rows.map(t=><li key={t.id}><div><strong>{t.name}</strong><small>{templateSource[t.source]} · {t.active?'활성':'비활성'}{scope==='organization'&&t.inherited?' · 상속 중':''}</small></div><button aria-label={`${t.name} 템플릿 편집`} disabled={busy} onClick={()=>edit(t)}>편집</button></li>)}</ul>}
      <form className="admin-form" onSubmit={e=>{e.preventDefault();void save();}}><h3>{selected?'템플릿 편집':'새 템플릿'}</h3>
        <label>템플릿 이름<input required maxLength={150} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
        <label>템플릿 본문<textarea required maxLength={200000} rows={8} value={body} disabled={busy} onChange={e=>setBody(e.target.value)}/></label>
        <p>일반 글 또는 Markdown 서식을 입력하세요. 상담에서는 선택 후 ‘본문에 삽입’으로 사용합니다.</p>
        <label className="admin-check"><input type="checkbox" checked={active} disabled={busy} onChange={e=>setActive(e.target.checked)}/>템플릿 활성</label>
        <div className="admin-actions"><button className="admin-primary" disabled={busy||!name.trim()||!body.trim()}>{busy?'저장 중…':current?.inherited?'조직 템플릿으로 저장':'템플릿 저장'}</button>
          <button type="button" disabled={busy} onClick={clear}>새 템플릿 작성</button>
          {scope==='organization'&&current?.overrideId&&!current.inherited&&<button type="button" disabled={busy} onClick={()=>void restore()}>공통 템플릿으로 복원</button>}</div>
      </form>
      {current&&<details className="admin-server-copy"><summary>현재 서버 템플릿 확인</summary><h4>{current.name}</h4><p className="admin-template-body">{current.body}</p><p>{current.active?'활성':'비활성'}</p></details>}
    </>}
    <button disabled={busy} onClick={()=>void reload()}>입력 유지하고 최신 목록 확인</button>
    {scope==='common'&&selected&&<section><h3>이 템플릿 변경의 적용 범위</h3><ul>{impact.map(o=><li key={o.organizationId}>{o.name} · {o.overridden?'조직 내용 유지':'공통 상속'}</li>)}</ul></section>}
  </section>;
}
