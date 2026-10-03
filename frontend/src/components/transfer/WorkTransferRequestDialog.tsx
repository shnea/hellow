'use client';
import {useEffect,useRef,useState} from 'react';
import {ApiError} from '@/lib/api';
import {confirmedTransfer,pendingTransfer,submitTransfer,transferJson,transferPendingKey,type TransferAssignee,type TransferRequest,type TransferKind,type WorkTransfer} from '@/lib/work-transfer';
import './transfer.css';

export interface TransferSource {id:number;version:number;name:string;liveWork:boolean;kind?:TransferKind;}
interface Draft {to:string;reason:string;memo:string;pending:TransferRequest|null;}
const empty=():Draft=>({to:'',reason:'',memo:'',pending:null});
export function WorkTransferRequestDialog({source,organizationId,issuer,subject,accessKey,allowed,onClose,onCreated}:{
  source:TransferSource|null;organizationId:string;issuer:string;subject:string;accessKey:string;allowed:boolean;
  onClose:()=>void;onCreated:(task:WorkTransfer)=>void;
}) {
  const dialog=useRef<HTMLDialogElement>(null);const flight=useRef(false);const mounted=useRef(true);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});const [assignees,setAssignees]=useState<TransferAssignee[]>([]);
  const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);
  const [error,setError]=useState('');const [storageError,setStorageError]=useState(false);const [revisable,setRevisable]=useState(false);
  const recordId=source?.id;const kind=source?.kind||'WORK';const draftKey=`${kind}:${recordId}`;
  const key=recordId?transferPendingKey(organizationId,issuer,subject,recordId,kind):'';
  const draft=recordId?drafts[draftKey]||empty():empty();
  const patch=(value:Partial<Draft>)=>{if(recordId)setDrafts(prev=>({...prev,[draftKey]:{...(prev[draftKey]||empty()),...value}}));};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    const el=dialog.current;if(!recordId){el?.close();return;}
    const prior=document.activeElement as HTMLElement|null;el?.showModal();
    return()=>{el?.close();prior?.focus();};
  },[recordId]);
  useEffect(()=>{
    if(!recordId)return;
    // A restored submitted request is frozen. Opening a dialog never submits it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError('');setReady(false);setStorageError(false);setRevisable(false);
    try {
      const saved=pendingTransfer(key,recordId);
      if(saved)setDrafts(prev=>({...prev,[draftKey]:{to:String(saved.toMemberId),reason:saved.reason,memo:saved.memo,pending:saved}}));
    }catch(e){setError((e as Error).message);setStorageError(true);}finally{setReady(true);}
  },[key,recordId,draftKey]);
  useEffect(()=>{
    if(!source||!allowed)return;const abort=new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setAssignees([]);
    transferJson<TransferAssignee[]>(`/api/transfers/${kind==='CALL'?'call-assignees':'assignees'}?consultationId=${source.id}`,organizationId,{signal:abort.signal})
      .then(rows=>{if(!abort.signal.aborted)setAssignees(rows);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[source,kind,organizationId,accessKey,allowed]);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(!source||!allowed||flight.current||!ready||storageError)return;
    flight.current=true;setBusy(true);setError('');setRevisable(false);
    try {
      if(!draft.pending&&(!draft.reason.trim()||!assignees.some(a=>String(a.memberId)===draft.to)))throw new Error('현재 선택 가능한 직원과 이관 사유를 입력해 주세요.');
      const task=await submitTransfer(organizationId,key,source.id,draft.pending?undefined:{consultationId:source.id,expectedRecordVersion:source.version,toMemberId:Number(draft.to),reason:draft.reason.trim(),memo:draft.memo},kind);
      if(!mounted.current)return;
      setDrafts(prev=>({...prev,[draftKey]:empty()}));onCreated(task);
    }catch(e){
      if(!mounted.current)return;setError((e as Error).message+' 입력은 유지됩니다.');
      try{patch({pending:pendingTransfer(key,source.id)});}catch{setStorageError(true);}
      setRevisable(e instanceof ApiError&&[400,404,409].includes(e.status));
    }finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  const revise=async()=>{
    if(!source||!draft.pending||flight.current)return;flight.current=true;setBusy(true);setError('');
    try {
      const task=await transferJson<WorkTransfer|null>(`/api/transfers/request/${draft.pending.requestId}`,organizationId);
      if(task){const checked=confirmedTransfer(task,organizationId,source.id,kind);sessionStorage.removeItem(key);if(mounted.current)onCreated(checked);return;}
      sessionStorage.removeItem(key);if(mounted.current){patch({pending:null});setRevisable(false);}
    }catch(e){if(mounted.current)setError((e as Error).message+' 기존 요청을 확인하기 전에는 새 접수를 만들 수 없습니다.');}
    finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  return <dialog ref={dialog} className="transfer-dialog" aria-labelledby="transfer-request-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <header><h2 id="transfer-request-title">{kind==='CALL'?'통화 이관 요청':'상담 업무 이관 요청'}</h2><button type="button" disabled={busy} onClick={onClose}>닫기</button></header>
    {source&&<><p className="transfer-source">{source.name} · 상담 기록 #{source.id}</p>
      <p>{kind==='CALL'?'대상 직원이 수락하고 음성 연결이 확인될 때까지 현재 통화와 담당자를 유지합니다. 연결하지 못하면 현재 상담사가 계속 맡습니다.':'저장된 기록의 담당자를 변경합니다. 대상 직원이 수락할 때까지 현재 담당자가 업무를 계속 맡습니다.'}</p>
      <p>{source.liveWork?'대기 상태의 직원에게 요청하며 30초 안에 응답해야 합니다.':'완료·독립 기록의 수락 기한은 10분입니다.'}{kind==='CALL'&&' 수락 후 20초 안에 마이크와 음성 연결을 확인합니다.'}</p>
      {!allowed&&<p role="alert">현재 조직의 이관 요청 권한이 없습니다. 입력은 유지됩니다.</p>}
      <form onSubmit={submit}><fieldset disabled={busy||loading||!ready||!allowed||storageError||Boolean(draft.pending)}>
        <label>대상 직원<select required value={draft.to} onChange={e=>patch({to:e.target.value})}>
          <option value="">{loading?'직원 확인 중…':'직원 선택'}</option>{assignees.map(a=><option key={a.memberId} value={a.memberId}>{a.name}</option>)}
          {draft.to&&!assignees.some(a=>String(a.memberId)===draft.to)&&<option value={draft.to} disabled>기존 선택 · 현재 이관 불가</option>}
        </select></label>
        <label>이관 사유<textarea required maxLength={2000} rows={3} value={draft.reason} onChange={e=>patch({reason:e.target.value})}/></label>
        <label>대상 직원에게 전달할 메모 (선택)<textarea maxLength={10000} rows={4} value={draft.memo} onChange={e=>patch({memo:e.target.value})}/></label>
      </fieldset>
        {!loading&&!assignees.length&&!draft.pending&&allowed&&<p role="status">현재 선택 가능한 직원이 없습니다. 직원 권한과 수신 상태를 확인한 뒤 다시 열어 주세요.</p>}
        {draft.pending&&<p role="status">응답을 확인하지 못한 요청을 보관하고 있습니다. 원래 요청의 접수 결과를 다시 확인하세요.</p>}
        {error&&<p className="transfer-error" role="alert">{error}</p>}
        <div className="transfer-actions">{draft.pending&&revisable&&<button type="button" disabled={busy||!allowed} onClick={()=>void revise()}>미접수 확인 후 입력 수정</button>}
          <button className="transfer-primary" disabled={busy||!allowed||!ready||storageError||(!draft.pending&&(loading||!assignees.length))}>{busy?'접수 확인 중…':draft.pending?'동일 요청 결과 확인':'이관 요청'}</button></div>
      </form></>}
  </dialog>;
}
