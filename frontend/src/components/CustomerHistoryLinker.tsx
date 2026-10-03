'use client';
import {useEffect,useRef,useState} from 'react';
import {apiJson,jsonBody} from '@/lib/api';
import type {CustomerProfile} from '@/types';

interface Selection {queueCode:string;queueVersion:number;recordVersion:number|null;}
interface Candidate extends Selection {createdAt:string;customerName:string;phoneNumber:string;type:string;agentName:string;category:string|null;result:string|null;}
interface CandidatePage {items:Candidate[];hasNext:boolean;page:number;}
interface Link extends Selection {id:string;actorName:string;linkedAt:string;undoneAt:string|null;customerName:string;phoneNumber:string;createdAt:string;category:string|null;}
export function CustomerHistoryLinker({customer,onClose,onChanged}:{customer:CustomerProfile;onClose:()=>void;onChanged:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);const generation=useRef(0);
  const [phone,setPhone]=useState(customer.phoneNumber);const [searchPhone,setSearchPhone]=useState(customer.phoneNumber);
  const [page,setPage]=useState(0);const [refresh,setRefresh]=useState(0);
  const [rows,setRows]=useState<Candidate[]>([]);const [links,setLinks]=useState<Link[]>([]);const [hasNext,setHasNext]=useState(false);
  const [selected,setSelected]=useState<Record<string,Candidate>>({});const [confirmed,setConfirmed]=useState(false);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const base=`/api/customers/${encodeURIComponent(customer.id)}/history`;
  useEffect(()=>{const element=dialog.current;const prior=document.activeElement as HTMLElement|null;element?.showModal();return()=>{element?.close();if(prior?.isConnected)prior.focus();};},[]);
  useEffect(()=>{
    const abort=new AbortController();const current=++generation.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setError('');setRows([]);setHasNext(false);
    Promise.all([apiJson<CandidatePage>(`${base}/candidates?phone=${encodeURIComponent(searchPhone)}&page=${page}`,{signal:abort.signal}),apiJson<Link[]>(`${base}/links`,{signal:abort.signal})])
      .then(([c,l])=>{if(abort.signal.aborted||current!==generation.current)return;setRows(c.items);setHasNext(c.hasNext);setLinks(l);
        // Only an explicit reload changes the versions of already selected visible rows.
        setSelected(prior=>Object.fromEntries(Object.entries(prior).map(([code,row])=>[code,c.items.find(item=>item.queueCode===code)||row])));})
      .catch(e=>{if(!abort.signal.aborted&&current===generation.current)setError(e.message);})
      .finally(()=>{if(!abort.signal.aborted&&current===generation.current)setLoading(false);});
    return()=>abort.abort();
  },[base,searchPhone,page,refresh]);
  const choose=(row:Candidate,checked:boolean)=>{setConfirmed(false);setSelected(prior=>{const next={...prior};if(checked)next[row.queueCode]=row;else delete next[row.queueCode];return next;});};
  const connect=async()=>{
    if(busy||!confirmed||!Object.keys(selected).length)return;setBusy(true);setError('');setNotice('');
    try{await apiJson(`${base}/links`,jsonBody({items:Object.values(selected).map(({queueCode,queueVersion,recordVersion})=>({queueCode,queueVersion,recordVersion}))}));
      setSelected({});setConfirmed(false);setNotice('선택한 이전 이력을 고객에 연결했습니다. 아래 연결 기록에서 취소할 수 있습니다.');setRefresh(v=>v+1);onChanged();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const undo=async(link:Link)=>{if(busy)return;setBusy(true);setError('');setNotice('');
    try{await apiJson(`${base}/links/${link.id}/undo`,jsonBody({queueCode:link.queueCode,queueVersion:link.queueVersion,recordVersion:link.recordVersion}));setNotice('고객 연결을 취소했습니다. 상담 원문은 그대로 보존됩니다.');setRefresh(v=>v+1);onChanged();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <dialog ref={dialog} className="history-link-dialog" aria-labelledby="history-link-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header><h2 id="history-link-title">이전 미연결 이력 찾기</h2><button type="button" disabled={busy} onClick={onClose}>닫기</button></header>
    <p className="history-link-target">연결할 고객 · <strong>{customer.name}</strong> · {customer.phoneNumber}</p>
    <p>접수 당시 이름·연락처를 확인하고 같은 고객의 이력만 선택하세요. 본문과 당시 담당자·분류는 유지됩니다.</p>
    <form className="history-link-search" onSubmit={e=>{e.preventDefault();setSelected({});setConfirmed(false);setPage(0);setSearchPhone(phone);setRefresh(v=>v+1);}}>
      <label>찾을 연락처<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy}/></label><button disabled={busy||loading}>이력 찾기</button>
    </form>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" disabled={busy||loading} onClick={()=>setRefresh(v=>v+1)}>선택 유지하고 다시 조회</button>
    <section aria-label="미연결 이력 후보"><h3>완료된 미연결 이력</h3>
      {loading?<p role="status">이력을 확인하고 있습니다…</p>:rows.length?rows.map(row=><label key={row.queueCode} className="history-link-row">
        <input type="checkbox" checked={Boolean(selected[row.queueCode])} disabled={busy||(!selected[row.queueCode]&&Object.keys(selected).length>=20)} onChange={e=>choose(row,e.target.checked)}/>
        <span><strong>{row.customerName} · {row.phoneNumber}</strong><span>{new Date(row.createdAt).toLocaleString('ko-KR')} · {row.type==='CALL'?'통화':'상담'} · {row.agentName||'담당자 미지정'}</span>
          <span>{row.category||'상담 타임라인'}{row.result?` · ${row.result}`:''}</span></span>
      </label>):<p>이 연락처의 연결 가능한 완료 이력이 없습니다. 다른 연락처로 조회할 수 있습니다.</p>}
      <nav aria-label="이력 후보 페이지"><button disabled={page===0||busy||loading} onClick={()=>setPage(v=>v-1)}>이전</button><span>{page+1}페이지</span><button disabled={!hasNext||busy||loading} onClick={()=>setPage(v=>v+1)}>다음</button></nav>
    </section>
    <section aria-label="선택한 이전 이력"><h3>선택한 이력 {Object.keys(selected).length}건</h3>
      {Object.values(selected).map(row=><div key={row.queueCode} className="history-link-selected"><span>{row.customerName} · {row.phoneNumber} · {new Date(row.createdAt).toLocaleDateString('ko-KR')}</span><button disabled={busy} onClick={()=>choose(row,false)}>선택 해제</button></div>)}
      <label className="history-link-confirm"><input type="checkbox" checked={confirmed} disabled={busy||!Object.keys(selected).length} onChange={e=>setConfirmed(e.target.checked)}/>선택한 이력이 {customer.name} 고객의 이력임을 확인했습니다.</label>
      <button className="history-link-primary" disabled={busy||loading||!confirmed||!Object.keys(selected).length} onClick={()=>void connect()}>{busy?'처리 중…':`선택한 ${Object.keys(selected).length}건 고객에 연결`}</button>
    </section>
    <section aria-label="고객 이력 연결 기록"><h3>이전 이력 연결 기록</h3>{!links.length&&<p>이전에 연결한 이력이 없습니다.</p>}
      {links.map(link=><div className="history-link-selected" key={link.id}><span><strong>{link.customerName} · {link.phoneNumber}</strong><span>{new Date(link.createdAt).toLocaleString('ko-KR')} · {link.category||'상담 타임라인'}</span><span>{link.undoneAt?'연결 취소됨':'고객 연결됨'} · {new Date(link.linkedAt).toLocaleString('ko-KR')} · {link.actorName}</span></span>
        {!link.undoneAt&&<button disabled={busy||loading} onClick={()=>void undo(link)}>고객 연결 취소</button>}</div>)}
    </section>
  </dialog>;
}
