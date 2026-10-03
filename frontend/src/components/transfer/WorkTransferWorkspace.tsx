'use client';
import {useEffect,useRef,useState} from 'react';
import {ApiError,jsonBody} from '@/lib/api';
import {transferJson,transferLabels,type TransferDirection,type TransferEvent,type TransferPage,type WorkTransfer} from '@/lib/work-transfer';
import './transfer.css';

export function WorkTransferWorkspace({active,organizationId,accessKey,canRead,focus,onChanged,onOpenRecord,localInputs=[]}:{
  active:boolean;organizationId:string;accessKey:string;canRead:boolean;focus:{id:string;revision:number;direction?:TransferDirection}|null;
  onChanged:(task:WorkTransfer)=>void;onOpenRecord:(task:WorkTransfer)=>void;
  localInputs?:{code:string;recordId:number;name:string;text:string}[];
}) {
  const [direction,setDirection]=useState<TransferDirection>('RECEIVED');const [status,setStatus]=useState('OFFERED');
  const [page,setPage]=useState(0);const [rows,setRows]=useState<WorkTransfer[]>([]);const [hasMore,setHasMore]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);const [task,setTask]=useState<WorkTransfer|null>(null);
  const [drafts,setDrafts]=useState<Record<string,{version:number;reason:string}>>({});
  const [loading,setLoading]=useState(false);const [detailLoading,setDetailLoading]=useState(false);const [busy,setBusy]=useState(false);
  const [listError,setListError]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [refresh,setRefresh]=useState(0);
  const [history,setHistory]=useState<TransferEvent[]|null>(null);const [historyPage,setHistoryPage]=useState(0);const [historyBusy,setHistoryBusy]=useState(false);const [historyError,setHistoryError]=useState('');
  const listRead=useRef<AbortController|null>(null);const detailRead=useRef<AbortController|null>(null);const historyRead=useRef<AbortController|null>(null);
  const flight=useRef(false);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;listRead.current?.abort();detailRead.current?.abort();historyRead.current?.abort();};},[]);
  useEffect(()=>{if(!focus)return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(focus.id);setNotice('');setError('');if(focus.direction){setDirection(focus.direction);setStatus('');setPage(0);}
  },[focus]);
  useEffect(()=>{if(!active||!canRead||busy)return;const timer=setInterval(()=>setRefresh(v=>v+1),5000);return()=>clearInterval(timer);},[active,canRead,busy]);
  useEffect(()=>{
    if(!active||!canRead)return;const abort=new AbortController();listRead.current=abort;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setListError('');
    const query=new URLSearchParams({page:String(page),direction});if(status)query.set('status',status);
    transferJson<TransferPage>(`/api/transfers?${query}`,organizationId,{signal:abort.signal}).then(result=>{
      if(abort.signal.aborted)return;setRows(result.items);setHasMore(result.hasMore);setSelected(prior=>prior||result.items[0]?.id||null);
    }).catch(e=>{if(!abort.signal.aborted){setRows([]);setHasMore(false);setListError(e.message);}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[active,canRead,organizationId,accessKey,direction,status,page,refresh]);
  useEffect(()=>{
    historyRead.current?.abort();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(null);setHistoryPage(0);setHistoryBusy(false);setHistoryError('');
  },[selected,active,canRead,accessKey]);
  useEffect(()=>{
    if(!active||!canRead||!selected)return;const abort=new AbortController();detailRead.current=abort;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailLoading(true);
    transferJson<WorkTransfer>(`/api/transfers/${selected}`,organizationId,{signal:abort.signal}).then(value=>{
      if(abort.signal.aborted)return;setTask(value);setDrafts(prev=>prev[value.id]?prev:{...prev,[value.id]:{version:value.version,reason:''}});
    }).catch(e=>{if(!abort.signal.aborted){setTask(null);setError(e.message);}}).finally(()=>{if(!abort.signal.aborted)setDetailLoading(false);});
    return()=>abort.abort();
  },[active,canRead,selected,organizationId,accessKey,refresh]);
  const current=canRead&&task?.id===selected?task:null;const draft=selected?drafts[selected]:undefined;
  const stale=Boolean(current&&draft&&current.version!==draft.version);
  const choose=(id:string)=>{if(busy)return;setSelected(id);setError('');setNotice('');};
  const mutate=async(action:'accept'|'reject'|'cancel')=>{
    if(!current||!draft||flight.current||!canRead||stale||detailLoading)return;
    if(action==='accept'?!current.canAccept:action==='reject'?!current.canReject:!current.canCancel)return;
    flight.current=true;setBusy(true);setError('');setNotice('');listRead.current?.abort();detailRead.current?.abort();historyRead.current?.abort();
    try {
      if(!draft.reason.trim())throw new Error('처리 사유를 입력해 주세요.');
      const saved=await transferJson<WorkTransfer>(`/api/transfers/${current.id}/${action}`,organizationId,jsonBody({expectedVersion:draft.version,reason:draft.reason.trim()}));
      if(!mounted.current)return;setTask(saved);setRows(prev=>prev.map(r=>r.id===saved.id?saved:r));setHistory(null);setHistoryPage(0);
      const preparing=action==='accept'&&saved.kind==='CALL'&&saved.status==='CONNECTING';
      const succeeded=saved.status===({accept:'ACCEPTED',reject:'REJECTED',cancel:'CANCELLED'} as const)[action];
      setDrafts(prev=>({...prev,[saved.id]:{version:saved.version,reason:succeeded?'':prev[saved.id]?.reason||''}}));
      setNotice(preparing?'마이크와 음성 연결을 확인하고 있습니다. 확인 전까지 기존 상담사가 통화를 맡습니다.':succeeded?`처리 결과 · ${transferLabels[saved.status]}`:`${transferLabels[saved.status]} · ${saved.outcome||'기존 담당자를 유지합니다.'}`);onChanged(saved);
    }catch(e){if(mounted.current){setError((e as Error).message+' 입력은 유지됩니다.');if(e instanceof ApiError&&e.status===409)setNotice('최신 상태를 다시 조회해 입력과 비교해 주세요.');}}
    finally{flight.current=false;if(mounted.current){setBusy(false);setLoading(false);setDetailLoading(false);setHistoryBusy(false);setRefresh(v=>v+1);}}
  };
  const loadHistory=async(nextPage=0)=>{
    if(!current||historyBusy)return;historyRead.current?.abort();const abort=new AbortController();historyRead.current=abort;setHistoryBusy(true);setHistoryError('');
    try{const result=await transferJson<TransferEvent[]>(`/api/transfers/${current.id}/history?page=${nextPage}`,organizationId,{signal:abort.signal});if(!abort.signal.aborted){setHistory(result);setHistoryPage(nextPage);}}
    catch(e){if(!abort.signal.aborted)setHistoryError((e as Error).message);}finally{if(!abort.signal.aborted)setHistoryBusy(false);}
  };
  const actionable=current&&(current.status==='OFFERED'||current.status==='CONNECTING')&&(current.canAccept||current.canReject||current.canCancel);
  return <section hidden={!active} className="transfer-workspace" aria-label="상담 이관">
    <header><div><h1>상담 이관</h1><p>업무는 수락 후, 통화는 수락과 음성 연결 확인 후 담당자가 변경됩니다.</p></div><button disabled={busy} onClick={()=>setRefresh(v=>v+1)}>목록·선택 요청 다시 조회</button></header>
    {localInputs.length>0&&<section className="transfer-draft" aria-label="보관한 미저장 상담 입력"><h2>보관한 미저장 상담 입력</h2><p>현재 담당 상담에서 제외된 미저장 입력입니다. 복사해서 보관할 수 있습니다.</p>{localInputs.map(input=><details key={input.code}><summary>{input.name} · 기록 #{input.recordId}</summary><label>내 입력 · 읽고 복사할 수 있습니다<textarea readOnly rows={5} value={input.text}/></label></details>)}</section>}
    {!canRead?<p role="alert">현재 조직의 이관 조회 권한이 없습니다.</p>:<>
      <div className="transfer-filters"><label>요청 구분<select value={direction} disabled={busy} onChange={e=>{setDirection(e.target.value as TransferDirection);setPage(0);}}><option value="RECEIVED">받은 요청</option><option value="SENT">보낸 요청</option><option value="ALL">권한 범위 전체</option></select></label>
        <label>이관 상태<select value={status} disabled={busy} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">전체</option>{Object.entries(transferLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
      {listError&&<p role="alert" className="transfer-error">{listError}</p>}{loading&&<p role="status">이관 목록 조회 중…</p>}
      <div className="transfer-columns"><div><h2>요청 목록</h2>{!rows.length&&!loading&&!listError&&<p>조건에 맞는 요청이 없습니다. 상담 기록에서 업무 이관을 요청할 수 있습니다.</p>}
        <ul className="transfer-list">{rows.map(row=><li key={row.id}><button disabled={busy} aria-pressed={selected===row.id} onClick={()=>choose(row.id)}><strong>{row.fromName} → {row.toName}</strong><span>{row.kind==='CALL'?'통화':'업무'} · 기록 #{row.consultationId} · {transferLabels[row.status]}</span><span>{row.reason}</span><time dateTime={row.requestedAt}>{new Date(row.requestedAt).toLocaleString('ko-KR')}</time></button></li>)}</ul>
        <nav className="transfer-actions" aria-label="이관 목록 페이지"><button disabled={busy||loading||page===0} onClick={()=>setPage(v=>v-1)}>이전</button><span>{page+1}페이지</span><button disabled={busy||loading||!hasMore} onClick={()=>setPage(v=>v+1)}>다음</button></nav>
      </div><div className="transfer-detail">
        {error&&<p role="alert" className="transfer-error">{error}</p>}{notice&&<p role="status">{notice}</p>}{detailLoading&&<p role="status">선택 요청 확인 중…</p>}
        {current?<><h2>{current.fromName} → {current.toName}</h2><dl><dt>상태</dt><dd>{transferLabels[current.status]}</dd><dt>요청자</dt><dd>{current.requesterName}</dd><dt>저장된 상담</dt><dd>기록 #{current.consultationId}{current.liveWork?' · 처리 중 업무':''}</dd><dt>{current.status==='CONNECTING'?'연결 확인 기한':'수락 기한'}</dt><dd><time dateTime={current.expiresAt}>{new Date(current.expiresAt).toLocaleString('ko-KR')}</time></dd></dl>
          <h3>이관 사유</h3><p className="transfer-body">{current.reason}</p><h3>전달 메모</h3><p className="transfer-body">{current.memo||'전달 메모 없음'}</p>{current.outcome&&<><h3>처리 결과</h3><p className="transfer-body">{current.outcome}</p></>}
          <div className="transfer-actions">{current.canReadRecord?<button disabled={busy||detailLoading} onClick={()=>onOpenRecord(current)}>상담 기록 열기</button>:<p>현재 이 기록의 본문 조회 권한이 없습니다. 제안 수신으로 원문이 공개되지는 않습니다.</p>}</div>
          {stale&&<div role="status"><p>요청 상태가 변경되었습니다. 처리 사유는 유지됩니다.</p>{actionable&&<button disabled={busy||detailLoading} onClick={()=>setDrafts(prev=>({...prev,[current.id]:{...prev[current.id],version:current.version}}))}>최신 상태 확인 후 처리 준비</button>}</div>}
          {actionable&&draft&&<div className="transfer-draft"><label>처리 사유<textarea maxLength={2000} rows={3} disabled={busy} value={draft.reason} onChange={e=>setDrafts(prev=>({...prev,[current.id]:{...prev[current.id],reason:e.target.value}}))}/></label>
            <div className="transfer-actions">{current.canAccept&&<button className="transfer-primary" disabled={busy||stale||detailLoading} onClick={()=>void mutate('accept')}>{current.kind==='CALL'?'통화 이관 수락·연결':'업무 이관 수락'}</button>}{current.canReject&&<button disabled={busy||stale||detailLoading} onClick={()=>void mutate('reject')}>이관 거절</button>}{current.canCancel&&<button disabled={busy||stale||detailLoading} onClick={()=>void mutate('cancel')}>요청 취소</button>}</div></div>}
          {!actionable&&draft?.reason&&<label className="transfer-draft">보존한 처리 사유 · 읽고 복사할 수 있습니다<textarea readOnly value={draft.reason} rows={3}/></label>}
          <div className="transfer-history"><button disabled={busy||historyBusy} onClick={()=>void loadHistory()}>수행 이력 조회</button>{historyError&&<p role="alert" className="transfer-error">{historyError}</p>}{historyBusy&&<p role="status">수행 이력 조회 중…</p>}
            {history&&<><ol>{history.map(event=><li key={event.id}><strong>{transferLabels[event.action]||event.action} · {event.actorName}</strong><p><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('ko-KR')}</time></p><p className="transfer-body">{event.reason}</p></li>)}</ol>{!history.length&&<p>수행 이력이 없습니다.</p>}<nav className="transfer-actions" aria-label="수행 이력 페이지"><button disabled={historyBusy||historyPage===0} onClick={()=>void loadHistory(historyPage-1)}>이전 이력</button><span>{historyPage+1}페이지</span><button disabled={historyBusy||history.length<50} onClick={()=>void loadHistory(historyPage+1)}>다음 이력</button></nav></>}
          </div></>:<><p>{selected?'선택한 요청을 다시 확인해 주세요.':'목록에서 요청을 선택해 주세요.'}</p>{draft?.reason&&<label>보존한 처리 사유<textarea readOnly value={draft.reason} rows={3}/></label>}</>}
      </div></div></>}
  </section>;
}

export function IncomingWorkTransfer({task,onOpen,onDismiss}:{task:WorkTransfer;onOpen:()=>void;onDismiss:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;const prior=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();prior?.focus();};},[]);
  return <dialog ref={dialog} className="transfer-dialog" aria-labelledby="incoming-transfer-title" onCancel={e=>{e.preventDefault();onDismiss();}}>
    <header><h2 id="incoming-transfer-title">{task.kind==='CALL'?'통화 이관 요청이 도착했습니다':'업무 이관 요청이 도착했습니다'}</h2></header><p>{task.fromName} 담당 상담 기록 #{task.consultationId}</p><p className="transfer-body">{task.reason}</p>
    <p>{new Date(task.expiresAt).toLocaleTimeString('ko-KR')}까지 이관 화면에서 확인하고 응답해 주세요.</p><div className="transfer-actions"><button onClick={onDismiss}>나중에 확인</button><button className="transfer-primary" onClick={onOpen}>이관 요청 확인</button></div>
  </dialog>;
}
