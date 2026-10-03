'use client';
import {useEffect,useState} from 'react';
import {adminJson} from '@/lib/admin';
import {jsonBody} from '@/lib/api';
import {categoryChain,type Catalog,type CatalogView} from '@/lib/consultation-content';
interface Impact {organizationId:string;name:string;inherited:boolean;}
export function CatalogManagement({scope,organizationId}:{scope:'common'|'organization';organizationId:string}){
  const [baseline,setBaseline]=useState<CatalogView|null>(null);const [draft,setDraft]=useState<Catalog|null>(null);
  const [impact,setImpact]=useState<Impact[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [selected,setSelected]=useState('');const [name,setName]=useState('');const [parent,setParent]=useState('');const [active,setActive]=useState(true);
  const [resultSelected,setResultSelected]=useState('');const [resultName,setResultName]=useState('');const [resultActive,setResultActive]=useState(true);
  useEffect(()=>{const abort=new AbortController();
    Promise.all([adminJson<CatalogView>(`/api/admin/consultation-catalog/${scope}`,organizationId,{signal:abort.signal}),scope==='common'?adminJson<Impact[]>('/api/admin/consultation-catalog/impact/common',organizationId,{signal:abort.signal}):Promise.resolve([])])
      .then(([view,rows])=>{if(!abort.signal.aborted){setBaseline(view);setDraft(structuredClone(view.effective));setImpact(rows);}}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return()=>abort.abort();
  },[scope,organizationId]);
  const reload=async()=>{if(busy)return;setBusy(true);setError('');try{
    const view=await adminJson<CatalogView>(`/api/admin/consultation-catalog/${scope}`,organizationId);setBaseline(view);
    setDraft(prior=>prior?{categories:[...prior.categories,...view.effective.categories.filter(n=>!prior.categories.some(p=>p.id===n.id))],results:[...prior.results,...view.effective.results.filter(n=>!prior.results.some(p=>p.id===n.id))]}:structuredClone(view.effective));
    setNotice('입력을 보존하고 최신 목록을 조회했습니다. 서버 목록과 비교한 뒤 저장하세요.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const save=async(inherit=false)=>{if(!draft||!baseline||busy)return;setBusy(true);setError('');setNotice('');try{
    const view=await adminJson<CatalogView>(`/api/admin/consultation-catalog/${scope}`,organizationId,jsonBody({expectedVersion:baseline.version,expectedCommonVersion:baseline.commonVersion,inherit,catalog:draft},'PUT'));
    setBaseline(view);setDraft(structuredClone(view.effective));setNotice(inherit?'공통 분류·결과를 다시 상속합니다.':'분류와 결과를 저장했습니다. 과거 기록의 표시값은 유지됩니다.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const editCategory=(id:string)=>{const row=draft?.categories.find(n=>n.id===id);if(row){setSelected(id);setName(row.name);setParent(row.parentId||'');setActive(row.active);}};
  const addCategory=()=>{
    if(!draft||!name.trim())return;const id=selected||crypto.randomUUID();const proposed={id,parentId:parent||null,name:name.trim(),active};
    const next=draft.categories.some(n=>n.id===id)?draft.categories.map(n=>n.id===id?proposed:n):[...draft.categories,proposed];
    if(categoryChain(next,id).length>=3&&next.some(n=>n.parentId===id)) {setError('하위 분류를 포함해 최대 3단계로 지정해 주세요.');return;}
    setDraft({...draft,categories:next});setSelected('');setName('');setParent('');setActive(true);setNotice('분류를 편집 목록에 반영했습니다. 아래에서 전체 목록을 저장하세요.');
  };
  const addResult=()=>{if(!draft||!resultName.trim())return;const id=resultSelected||crypto.randomUUID();const row={id,name:resultName.trim(),active:resultActive};
    setDraft({...draft,results:draft.results.some(n=>n.id===id)?draft.results.map(n=>n.id===id?row:n):[...draft.results,row]});setResultSelected('');setResultName('');setResultActive(true);setNotice('결과를 편집 목록에 반영했습니다. 아래에서 전체 목록을 저장하세요.');};
  return <section className="admin-section"><h2>{scope==='common'?'공통 상담 분류·결과':'조직 상담 분류·결과'}</h2>
    <p>분류는 1~3단계로 사용합니다. 기존 항목은 삭제 대신 비활성화하며 이름을 변경해도 과거 상담의 분류·결과는 유지됩니다.</p>
    {baseline&&<p>현재 적용: {baseline.inherited?'공통 목록 상속':scope==='common'?'공통 목록':'조직 지정 목록'}</p>}
    {error&&<p role="alert" className="admin-error">{error} 입력은 유지됩니다.</p>}{notice&&<p role="status" className="admin-success">{notice}</p>}
    {!draft?<p role="status">분류 목록 조회 중…</p>:<>
      <h3>분류 편집 목록</h3><ul className="admin-content-list">{draft.categories.map(n=><li key={n.id}><span>{categoryChain(draft.categories,n.id).map(p=>p.name).join(' › ')} · {n.active?'활성':'비활성'}</span><button disabled={busy} onClick={()=>editCategory(n.id)} aria-label={`${n.name} 분류 편집`}>편집</button></li>)}</ul>
      <form className="admin-form" onSubmit={e=>{e.preventDefault();addCategory();}}><h4>{selected?'분류 수정':'새 분류'}</h4>
        <div className="admin-form-grid"><label>분류 이름<input required maxLength={100} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
          <label>상위 분류<select aria-label="상위 분류" value={parent} disabled={busy} onChange={e=>setParent(e.target.value)}><option value="">1단계 분류</option>{draft.categories.filter(n=>n.id!==selected&&categoryChain(draft.categories,n.id).length<3&&!categoryChain(draft.categories,n.id).some(p=>p.id===selected)).map(n=><option key={n.id} value={n.id}>{categoryChain(draft.categories,n.id).map(p=>p.name).join(' › ')}</option>)}</select></label></div>
        <label className="admin-check"><input type="checkbox" checked={active} disabled={busy} onChange={e=>setActive(e.target.checked)}/>분류 활성</label>
        <div className="admin-actions"><button disabled={busy||!name.trim()}>분류를 목록에 반영</button><button type="button" disabled={busy} onClick={()=>{setSelected('');setName('');setParent('');setActive(true);}}>새 분류 작성</button></div>
      </form>
      <h3>상담 결과 편집 목록</h3><ul className="admin-content-list">{draft.results.map(n=><li key={n.id}><span>{n.name} · {n.active?'활성':'비활성'}</span><button disabled={busy} aria-label={`${n.name} 결과 편집`} onClick={()=>{setResultSelected(n.id);setResultName(n.name);setResultActive(n.active);}}>편집</button></li>)}</ul>
      <form className="admin-form" onSubmit={e=>{e.preventDefault();addResult();}}><h4>{resultSelected?'결과 수정':'새 결과'}</h4><label>결과 이름<input required maxLength={100} disabled={busy} value={resultName} onChange={e=>setResultName(e.target.value)}/></label>
        <label className="admin-check"><input type="checkbox" checked={resultActive} disabled={busy} onChange={e=>setResultActive(e.target.checked)}/>결과 활성</label>
        <div className="admin-actions"><button disabled={busy||!resultName.trim()}>결과를 목록에 반영</button><button type="button" disabled={busy} onClick={()=>{setResultSelected('');setResultName('');setResultActive(true);}}>새 결과 작성</button></div>
      </form>
      <div className="admin-actions"><button className="admin-primary" disabled={busy} onClick={()=>void save()}>{busy?'저장 중…':scope==='common'?'공통 분류·결과 저장':'조직 분류·결과 저장'}</button>
        {scope==='organization'&&<button disabled={busy||baseline?.inherited} onClick={()=>void save(true)}>공통 목록으로 복원</button>}</div>
      {baseline&&<details className="admin-server-copy"><summary>현재 서버 목록 확인</summary><p>편집 목록과 비교한 뒤 저장하세요.</p><ul>{baseline.effective.categories.map(n=><li key={n.id}>{categoryChain(baseline.effective.categories,n.id).map(p=>p.name).join(' › ')} · {n.active?'활성':'비활성'}</li>)}</ul><p>결과: {baseline.effective.results.map(r=>`${r.name} (${r.active?'활성':'비활성'})`).join(', ')}</p></details>}
    </>}
    <button disabled={busy} onClick={()=>void reload()}>입력 유지하고 최신 목록 확인</button>
    {scope==='common'&&<section><h3>공통 변경의 적용 범위</h3><p>공통을 상속하는 조직에만 적용됩니다.</p><ul>{impact.map(o=><li key={o.organizationId}>{o.name} · {o.inherited?'공통 상속':'조직 목록 유지'}</li>)}</ul></section>}
  </section>;
}
