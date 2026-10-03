'use client';
import {useEffect,useRef,useState} from 'react';
import {ApiError,jsonBody} from '@/lib/api';
import {followUpJson,followUpLabels,followUpEventLabels,followUpTime,koreanInput,koreanInstant,type FollowUp,type FollowUpPage,type FollowUpStatus,type FollowUpAssignee,type FollowUpEvent} from '@/lib/followup';
import {FollowUpRequestForm} from './FollowUpRequestForm';
import './followup.css';

interface Draft {version:number;title:string;details:string;at:string;minutes:string;memberId:string;memberName:string;reason:string;}
const draftOf=(task:FollowUp):Draft=>({version:task.version,title:task.title,details:task.details,at:koreanInput(task.scheduledAt||task.proposedAt),minutes:String(task.durationMinutes||30),memberId:task.assignedMemberId?String(task.assignedMemberId):'',memberName:task.assignedName||'',reason:''});
export function FollowUpWorkspace({active,organizationId,identityKey,accessKey,canRead,canWrite,focus,source,onCreated,onChanged,onSourceClosed}:{
  active:boolean;organizationId:string;identityKey:string;accessKey:string;canRead:boolean;canWrite:boolean;
  focus:{id:number;revision:number}|null;source:{code:string;name:string}|null;onCreated:(task:FollowUp)=>void;onChanged:(task:FollowUp)=>void;onSourceClosed:()=>void;
}){
  const [type,setType]=useState('');const [status,setStatus]=useState('');const [page,setPage]=useState(0);
  const [rows,setRows]=useState<FollowUp[]>([]);const [hasMore,setHasMore]=useState(false);const [selected,setSelected]=useState<number|null>(null);
  const [task,setTask]=useState<FollowUp|null>(null);const [drafts,setDrafts]=useState<Record<number,Draft>>({});
  const [assignees,setAssignees]=useState<FollowUpAssignee[]>([]);const [assigneeError,setAssigneeError]=useState('');
  const [loading,setLoading]=useState(false);const [detailLoading,setDetailLoading]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [listError,setListError]=useState('');const [notice,setNotice]=useState('');const [refresh,setRefresh]=useState(0);
  const [history,setHistory]=useState<FollowUpEvent[]|null>(null);const [historyError,setHistoryError]=useState('');const [historyPage,setHistoryPage]=useState(0);const [historyBusy,setHistoryBusy]=useState(false);
  const [requestType,setRequestType]=useState<'VISIT'|'CALLBACK'>('CALLBACK');
  const flight=useRef(false);const detailRead=useRef<AbortController|null>(null);const listRead=useRef<AbortController|null>(null);const historyRead=useRef<AbortController|null>(null);
  const focusRevision=useRef<number|null>(null);const mounted=useRef(true);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;if(active&&canRead&&selected!==null){if(!el?.open)el?.showModal();}else el?.close();},[active,canRead,selected]);
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{if(!active)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;historyRead.current?.abort();};},[]);
  useEffect(()=>{
    if(!focus||focusRevision.current===focus.revision)return;focusRevision.current=focus.revision;
    // Explicit creation/navigation chooses the new task; background reads never select over it.
    setSelected(focus.id);setType('');setStatus('');setPage(0);setRefresh(v=>v+1);
  },[focus]);
  useEffect(()=>{
    if(!active||!canRead)return;
    const abort=new AbortController();listRead.current=abort;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setListError('');
    const params=new URLSearchParams({page:String(page)});if(type)params.set('actionType',type);if(status)params.set('status',status);
    followUpJson<FollowUpPage>(`/api/followup?${params}`,organizationId,{signal:abort.signal}).then(result=>{
      if(abort.signal.aborted)return;setRows(result.items);setHasMore(result.hasMore);
    }).catch(e=>{if(!abort.signal.aborted){setListError(e.message);setRows([]);}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[active,canRead,organizationId,accessKey,type,status,page,refresh]);
  useEffect(()=>{
    historyRead.current?.abort();
    // An aborted history request cannot clear its own loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryBusy(false);
    if(!active||!canRead||selected===null)return;
    const abort=new AbortController();detailRead.current=abort;
    setDetailLoading(true);setError('');setHistory(null);setHistoryError('');setHistoryPage(0);
    followUpJson<FollowUp>(`/api/followup/${selected}`,organizationId,{signal:abort.signal}).then(value=>{
      if(abort.signal.aborted)return;setTask(value);setDrafts(prev=>prev[value.id]?prev:{...prev,[value.id]:draftOf(value)});
    }).catch(e=>{if(!abort.signal.aborted){setTask(null);setError(e.message);}}).finally(()=>{if(!abort.signal.aborted)setDetailLoading(false);});
    return()=>abort.abort();
  },[active,canRead,selected,organizationId,accessKey,refresh]);
  useEffect(()=>{
    if(!active||!canRead||!canWrite)return;
    const abort=new AbortController();
    followUpJson<FollowUpAssignee[]>('/api/followup/assignees',organizationId,{signal:abort.signal}).then(value=>{if(!abort.signal.aborted){setAssignees(value);setAssigneeError('');}})
      .catch(e=>{if(!abort.signal.aborted){setAssignees([]);setAssigneeError(e.message);}});
    return()=>abort.abort();
  },[active,canRead,canWrite,organizationId,accessKey,refresh]);
  const current=canRead&&task?.id===selected?task:null;const draft=current?drafts[current.id]:undefined;
  const editable=current&&canWrite&&current.canWrite&&['PENDING','SCHEDULED','FAILED'].includes(current.status);
  const stale=current&&draft&&draft.version!==current.version;
  const textDirty=Boolean(current&&draft&&(draft.title!==current.title||draft.details!==current.details));
  const scheduleDirty=Boolean(current&&draft&&current.status==='SCHEDULED'&&(draft.at!==koreanInput(current.scheduledAt)||draft.memberId!==String(current.assignedMemberId)||draft.minutes!==String(current.durationMinutes)));
  const scheduleInputDirty=Boolean(current&&draft&&(draft.at!==koreanInput(current.scheduledAt||current.proposedAt)||draft.memberId!==(current.assignedMemberId?String(current.assignedMemberId):'')||draft.minutes!==String(current.durationMinutes||30)));
  const patch=(value:Partial<Draft>)=>{if(current)setDrafts(prev=>({...prev,[current.id]:{...prev[current.id],...value}}));};
  const choose=(id:number)=>{if(busy)return;setSelected(id);setNotice('');setError('');};
  const mutate=async(kind:'edit'|'schedule'|'status',nextStatus?:FollowUpStatus)=>{
    if(!current||!draft||flight.current||!canWrite||!current.canWrite||stale||detailLoading)return;
    flight.current=true;setBusy(true);setError('');setNotice('');detailRead.current?.abort();listRead.current?.abort();historyRead.current?.abort();
    try{
      if(!draft.reason.trim())throw new Error('변경 사유 또는 처리 결과를 입력해 주세요.');
      let body:Record<string,unknown>={expectedVersion:draft.version,reason:draft.reason.trim()};
      if(kind==='edit')body={...body,title:draft.title.trim(),details:draft.details.trim()};
      if(kind==='schedule'){
        const at=koreanInstant(draft.at);if(Date.parse(at)<=Date.now())throw new Error('확정 시각은 현재 이후로 지정해 주세요.');
        const minutes=Number(draft.minutes);if(!Number.isInteger(minutes)||minutes<5||minutes>480)throw new Error('소요 시간은 5~480분으로 지정해 주세요.');
        if(!assignees.some(a=>String(a.memberId)===draft.memberId))throw new Error('현재 선택 가능한 담당자를 다시 확인해 주세요.');
        body={...body,scheduledAt:at,timeZone:'Asia/Seoul',durationMinutes:minutes,assignedMemberId:Number(draft.memberId)};
      }
      if(kind==='status')body={...body,status:nextStatus};
      const saved=await followUpJson<FollowUp>(`/api/followup/${current.id}${kind==='edit'?'':kind==='schedule'?'/schedule':'/status'}`,organizationId,jsonBody(body,kind==='edit'?'PUT':'POST'));
      if(!mounted.current)return;
      setTask(saved);setRows(prev=>prev.map(row=>row.id===saved.id?saved:row));setHistory(null);setHistoryPage(0);
      setDrafts(prev=>({...prev,[saved.id]:{...prev[saved.id],version:saved.version,reason:'',...(kind==='edit'?{title:saved.title,details:saved.details}:kind==='schedule'?{at:koreanInput(saved.scheduledAt),minutes:String(saved.durationMinutes),memberId:String(saved.assignedMemberId),memberName:saved.assignedName||''}:{})}}));
      setNotice('서버 저장을 확인했습니다.');onChanged(saved);
    }catch(e){if(mounted.current){setError((e as Error).message+' 입력은 유지됩니다.' );if(e instanceof ApiError&&e.status===409)setNotice('최신 상태를 다시 조회해 내 입력과 비교해 주세요.');}}
    finally{flight.current=false;if(mounted.current){setBusy(false);setLoading(false);setDetailLoading(false);setHistoryBusy(false);}}
  };
  const loadHistory=async(nextPage=0)=>{
    if(!current||historyBusy)return;historyRead.current?.abort();const abort=new AbortController();historyRead.current=abort;setHistoryBusy(true);setHistoryError('');
    try{const result=await followUpJson<FollowUpEvent[]>(`/api/followup/${current.id}/history?page=${nextPage}`,organizationId,{signal:abort.signal});if(!abort.signal.aborted){setHistory(result);setHistoryPage(nextPage);}}
    catch(e){if(!abort.signal.aborted)setHistoryError((e as Error).message);}finally{if(!abort.signal.aborted)setHistoryBusy(false);}
  };
  const created=(value:FollowUp)=>{setSelected(value.id);setType('');setStatus('');setPage(0);setRefresh(v=>v+1);onCreated(value);};
  return <section hidden={!active} className="followup-workspace" aria-label="콜백·방문 예약">
    <header><div><h1>콜백·방문 예약</h1><p>권한 범위 안의 요청을 확인하고 담당자와 일정을 관리하세요.</p></div><button disabled={busy||loading} onClick={()=>setRefresh(v=>v+1)}>목록·선택 업무 다시 조회</button></header>
    {!canRead?<p role="alert">현재 조직의 후속 업무 조회 권한이 없습니다.</p>:<>
      {source&&canWrite&&<details open><summary>새 후속 요청 · {source.name}</summary><button disabled={busy} onClick={onSourceClosed}>접수 폼 닫기</button>
        <label>요청 종류<select value={requestType} onChange={e=>setRequestType(e.target.value as 'VISIT'|'CALLBACK')}><option value="CALLBACK">콜백</option><option value="VISIT">방문</option></select></label>
        <FollowUpRequestForm key={`${source.code}:${requestType}`} organizationId={organizationId} identityKey={identityKey} queueCode={source.code} actionType={requestType} disabled={busy} onCreated={created} onOpenList={onSourceClosed}/>
      </details>}
      <div className="followup-filters"><label>업무 종류<select value={type} disabled={busy} onChange={e=>{setType(e.target.value);setPage(0);}}><option value="">전체</option><option value="CALLBACK">콜백</option><option value="VISIT">방문</option></select></label>
        <label>예약 상태<select value={status} disabled={busy} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">전체</option>{Object.entries(followUpLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <span>일시 표시는 한국 시간 (Asia/Seoul)</span></div>
      {listError&&<p role="alert" className="followup-error">{listError}</p>}{loading&&<p role="status">예약 목록을 조회하고 있습니다.</p>}
      <div><h2>예약 목록</h2>{!rows.length&&!loading&&!listError&&<p>조건에 맞는 예약이 없습니다. 상담에서 후속 요청을 접수하면 이 목록에서 확인할 수 있습니다.</p>}
        <p>행을 더블 클릭하거나 상세 보기로 예약을 확인하세요.</p>
        <div className="followup-table-scroll"><table><thead><tr><th>요청 목적</th><th>고객</th><th>종류</th><th>상태</th><th>확정 일시</th><th>담당자</th><th>상세</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} onDoubleClick={()=>choose(row.id)}><td>{row.title}</td><td>{row.contactName||'이름 미확인'}</td><td>{row.actionType==='VISIT'?'방문':'콜백'}</td><td>{followUpLabels[row.status]}</td><td>{followUpTime(row.scheduledAt)}</td><td>{row.assignedName||'담당 미확정'}</td><td><button disabled={busy} aria-label={`${row.title} 상세 보기`} onClick={()=>choose(row.id)}>상세 보기</button></td></tr>)}</tbody></table></div>
        <nav className="followup-actions" aria-label="예약 목록 페이지"><button disabled={busy||loading||page===0} onClick={()=>setPage(v=>v-1)}>이전 목록</button><span>{page+1}페이지</span><button disabled={busy||loading||!hasMore} onClick={()=>setPage(v=>v+1)}>다음 목록</button></nav>
      </div><dialog ref={dialog} className="followup-detail-dialog" aria-label="콜백·방문 예약 상세" onCancel={e=>{e.preventDefault();e.stopPropagation();if(!busy)setSelected(null);}}><header><h2>콜백·방문 예약 상세</h2><button disabled={busy} onClick={()=>setSelected(null)}>닫기</button></header><div className="followup-detail">
        {detailLoading&&<p role="status">선택한 업무를 확인하고 있습니다.</p>}{error&&<p role="alert" className="followup-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
        {!current&&!detailLoading&&!error&&<p>예약을 선택하면 확정 일정과 처리 이력이 표시됩니다.</p>}
        {current&&draft&&<><h2>{current.title}</h2><dl><dt>고객</dt><dd>{current.contactName||'기존 기록 · 확인되지 않음'}</dd><dt>연락처</dt><dd>{current.phoneNumber||'기존 기록 · 확인되지 않음'}</dd><dt>상태</dt><dd>{followUpLabels[current.status]}</dd><dt>담당자</dt><dd>{current.assignedName||'미확정'}</dd><dt>확정 일시</dt><dd>{followUpTime(current.scheduledAt)}{current.durationMinutes?` · ${current.durationMinutes}분`:''}</dd><dt>희망 일시</dt><dd>{followUpTime(current.proposedAt)}</dd><dt>요청자</dt><dd>{current.creatorName||'기존 기록 · 확인되지 않음'}</dd></dl>
          <p className="followup-text">{current.details}</p>{current.outcome&&<p className="followup-text">처리 결과 · {current.outcome}</p>}
          {current.timeZone&&current.timeZone!=='Asia/Seoul'&&<p>저장된 시간대: {current.timeZone}. 변경 입력은 한국 시간으로 적용합니다.</p>}
          {stale&&<div role="status"><p>서버 버전이 변경되었습니다. 위의 최신 상태와 내 입력을 비교하세요.</p>{editable&&<button disabled={busy||detailLoading} onClick={()=>patch({version:current.version})}>최신 버전에 내 입력 다시 적용 준비</button>}</div>}
          {!editable&&(textDirty||scheduleInputDirty||draft.reason)&&<section aria-label="저장되지 않은 내 입력"><h3>저장되지 않은 내 입력</h3><p>현재 업무 상태에서는 이 입력을 저장할 수 없습니다. 복사하여 보관할 수 있습니다.</p><p className="followup-text">{draft.title}</p><p className="followup-text">{draft.details}</p><p>입력한 일시 · {draft.at?draft.at.replace('T',' '):'미입력'} · {draft.minutes}분</p>{draft.memberId&&<p>입력한 담당자 · {draft.memberName||assignees.find(a=>String(a.memberId)===draft.memberId)?.name||`직원 ${draft.memberId} (현재 이름 확인 불가)`}</p>}{draft.reason&&<p className="followup-text">{draft.reason}</p>}</section>}
          {current.canWrite&&canWrite?<form onSubmit={e=>e.preventDefault()}>
            {editable&&<fieldset disabled={busy||detailLoading}><legend>요청 내용·확정 일정</legend>
              <label>요청 목적<input required maxLength={200} value={draft.title} onChange={e=>patch({title:e.target.value})}/></label>
              <label>요청 메모<textarea required maxLength={10000} rows={4} value={draft.details} onChange={e=>patch({details:e.target.value})}/></label>
              <button type="button" disabled={Boolean(stale)||!draft.title.trim()||!draft.details.trim()||!draft.reason.trim()} onClick={()=>void mutate('edit')}>요청 내용 저장</button>
              <div className="followup-form-grid"><label>확정 일시 · 한국 시간<input type="datetime-local" value={draft.at} onChange={e=>patch({at:e.target.value})}/></label><label>소요 시간 (분)<input type="number" min={5} max={480} step={1} value={draft.minutes} onChange={e=>patch({minutes:e.target.value})}/></label></div>
              <label>담당자<select value={draft.memberId} onChange={e=>patch({memberId:e.target.value,memberName:assignees.find(a=>String(a.memberId)===e.target.value)?.name||''})}><option value="">담당자 선택</option>{assignees.filter(a=>current.canAssign||a.memberId===current.assignedMemberId||current.status==='PENDING').map(a=><option key={a.memberId} value={a.memberId}>{a.name}</option>)}</select></label>
              {assigneeError&&<p role="alert" className="followup-error">담당자 조회 실패: {assigneeError} 위의 다시 조회로 확인하세요.</p>}
              {!current.canAssign&&<p>다른 직원으로 담당자를 바꾸려면 재배정 권한이 필요합니다.</p>}
              <button type="button" className="followup-primary" disabled={Boolean(stale)||!draft.at||!draft.memberId||!draft.reason.trim()||Boolean(assigneeError)} onClick={()=>void mutate('schedule')}>{current.status==='FAILED'?'실패 업무 재예약':current.status==='PENDING'?'담당자·일정 확정':'일정 변경·담당 재배정'}</button>
            </fieldset>}
            {!['COMPLETED','CANCELLED'].includes(current.status)&&<label>변경 사유·처리 결과<textarea maxLength={2000} rows={3} disabled={busy||detailLoading} value={draft.reason} onChange={e=>patch({reason:e.target.value})}/></label>}
            {editable&&(textDirty||scheduleDirty)&&<p>입력한 내용과 일정 변경을 먼저 저장하거나 서버 내용으로 되돌린 뒤 처리 상태를 변경하세요.</p>}
            <div className="followup-actions">
              {current.status==='SCHEDULED'&&current.canProcess&&<button type="button" disabled={busy||detailLoading||Boolean(stale)||textDirty||scheduleDirty||!draft.reason.trim()||!current.scheduledAt||Date.parse(current.scheduledAt)>now} onClick={()=>void mutate('status','IN_PROGRESS')}>예약 업무 시작</button>}
              {current.status==='IN_PROGRESS'&&current.canProcess&&<><button type="button" className="followup-primary" disabled={busy||detailLoading||Boolean(stale)||!draft.reason.trim()} onClick={()=>void mutate('status','COMPLETED')}>처리 완료</button><button type="button" disabled={busy||detailLoading||Boolean(stale)||!draft.reason.trim()} onClick={()=>void mutate('status','FAILED')}>실패 기록</button></>}
              {!['COMPLETED','CANCELLED'].includes(current.status)&&(current.status!=='IN_PROGRESS'||current.canProcess||current.canAssign)&&<button type="button" disabled={busy||detailLoading||Boolean(stale)||textDirty||scheduleDirty||!draft.reason.trim()} onClick={()=>void mutate('status','CANCELLED')}>예약·요청 취소</button>}
              {(textDirty||scheduleDirty)&&<button type="button" disabled={busy||detailLoading} onClick={()=>setDrafts(prev=>({...prev,[current.id]:draftOf(current)}))}>내 입력을 서버 내용으로 되돌리기</button>}
            </div>
          </form>:<p>조회 가능한 기록입니다. 현재 권한으로는 수정할 수 없습니다.</p>}
          <h3>변경 이력</h3><button disabled={historyBusy||busy} onClick={()=>void loadHistory(0)}>{historyBusy?'이력 조회 중…':'변경 이력 조회'}</button>{historyError&&<p role="alert" className="followup-error">{historyError}</p>}
          {history&&<><ol className="followup-history">{history.map(event=><li key={event.id}><strong>{followUpEventLabels[event.action]||event.action} · {event.actorName}</strong><p>{followUpTime(event.occurredAt)}</p><p className="followup-text">{event.reason}</p><EventDetails event={event}/></li>)}</ol>{!history.length&&<p>확인된 변경 이력이 없습니다. 기존 기록의 과거 변경은 추정하지 않습니다.</p>}
            <nav className="followup-actions" aria-label="변경 이력 페이지"><button disabled={historyBusy||historyPage===0} onClick={()=>void loadHistory(historyPage-1)}>최근 이력</button><button disabled={historyBusy||history.length<50} onClick={()=>void loadHistory(historyPage+1)}>이전 이력</button></nav></>}
        </>}
      </div></dialog>
    </>}
  </section>;
}
function EventDetails({event}:{event:FollowUpEvent}){
  const read=(value:string|null):Partial<FollowUp>|null=>{try{return value?JSON.parse(value):null;}catch{return null;}};
  const before=read(event.beforeSnapshot);const after=read(event.afterSnapshot);
  return <details><summary>변경 전후 확인</summary>{[before,after].map((value,index)=><div key={index}><h4>{index===0?'변경 전':'변경 후'}</h4>{value?<><p>{value.title} · {value.status?followUpLabels[value.status]:''}</p><p>{value.assignedName||'담당 미확정'} · {followUpTime(value.scheduledAt||null)}</p><p className="followup-text">{value.details}</p>{value.outcome&&<p className="followup-text">{value.outcome}</p>}</>:<p>기록 없음</p>}</div>)}</details>;
}
