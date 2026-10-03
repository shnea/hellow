'use client';
import {useEffect,useRef,useState} from 'react';
import {ApiError,jsonBody} from '@/lib/api';
import {followUpJson,koreanInput,koreanInstant,pendingRequest,type FollowUp,type FollowUpRequest,type FollowUpType} from '@/lib/followup';
import './followup.css';

export function FollowUpRequestForm({organizationId,identityKey,queueCode,actionType,disabled,onCreated,onOpenList}:{
  organizationId:string;identityKey:string;queueCode:string;actionType:FollowUpType;disabled:boolean;
  onCreated:(task:FollowUp)=>void;onOpenList?:()=>void;
}){
  const key=`hellow_followup_pending:${organizationId}:${identityKey}:${queueCode}:${actionType}`;
  const [title,setTitle]=useState('');const [details,setDetails]=useState('');const [proposed,setProposed]=useState('');
  const [pending,setPending]=useState<FollowUpRequest|null>(null);const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [storageError,setStorageError]=useState(false);
  const [canRevise,setCanRevise]=useState(false);
  const flight=useRef(false);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;
    try{const saved=pendingRequest(key,queueCode,actionType);
      // Restore a frozen, explicitly submitted request without sending it on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if(saved){setPending(saved);setTitle(saved.title);setDetails(saved.details);setProposed(koreanInput(saved.proposedAt||null));}
    }catch(e){setError((e as Error).message);setStorageError(true);}finally{setReady(true);}
    return()=>{mounted.current=false;};
  },[key,queueCode,actionType]);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(flight.current||disabled||!ready||storageError)return;
    flight.current=true;setBusy(true);setError('');setNotice('');
    let payload=pending;
    try{
      if(payload){
        const existing=await followUpJson<FollowUp|null>(`/api/followup/request/${payload.requestId}`,organizationId);
        if(existing){sessionStorage.removeItem(key);if(mounted.current){setPending(null);onCreated(existing);}return;}
      }
      if(!payload){
        if(!title.trim()||!details.trim())throw new Error('요청 목적과 메모를 입력해 주세요.');
        const proposedAt=proposed?koreanInstant(proposed):undefined;
        if(proposedAt&&Date.parse(proposedAt)<=Date.now())throw new Error('희망 시각은 현재 이후로 지정해 주세요.');
        payload={queueCode,actionType,title:title.trim(),details:details.trim(),requestId:crypto.randomUUID(),...(proposedAt?{proposedAt,timeZone:'Asia/Seoul'}:{})};
        // Persistence precedes transmission. Storage failure must not create an untraceable duplicate.
        sessionStorage.setItem(key,JSON.stringify(payload));setPending(payload);
      }
      const task=await followUpJson<FollowUp>('/api/followup',organizationId,jsonBody(payload));
      sessionStorage.removeItem(key);
      if(!mounted.current)return;
      setPending(null);setTitle('');setDetails('');setProposed('');setNotice('접수를 확인했습니다. 예약 목록에서 담당자와 일정을 확정하세요.');onCreated(task);
    }catch(e){if(mounted.current){setError((e as Error).message+' 입력과 보관한 요청은 유지됩니다.');setCanRevise(e instanceof ApiError&&e.status===400);}}
    finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  return <section className="followup-request" aria-label={actionType==='VISIT'?'방문 요청 접수':'콜백 요청 접수'}>
    <form onSubmit={submit}><fieldset disabled={disabled||busy||!ready||Boolean(pending)||storageError}>
      <label>요청 목적<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>요청 메모<textarea required maxLength={10000} rows={3} value={details} onChange={e=>setDetails(e.target.value)}/></label>
      <label>희망 일시 · 한국 시간 (선택)<input type="datetime-local" value={proposed} onChange={e=>setProposed(e.target.value)}/></label>
      <p>희망 일시는 요청 사항입니다. 담당자와 확정 일정은 예약 목록에서 정합니다.</p>
    </fieldset>
      {pending&&<p role="status">응답을 확인하지 못한 요청을 보관하고 있습니다. 같은 내용으로 접수 결과를 다시 확인하세요.</p>}
      {error&&<p role="alert" className="followup-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
      {pending&&canRevise&&<button type="button" disabled={busy} onClick={()=>{try{sessionStorage.removeItem(key);setPending(null);setCanRevise(false);setError('');}catch(e){setError((e as Error).message);}}}>접수되지 않은 요청의 입력 수정</button>}
      <div className="followup-actions"><button className="followup-primary" disabled={disabled||busy||!ready||storageError}>{busy?'접수 확인 중…':pending?'동일 요청 접수 확인':'요청 접수'}</button>{onOpenList&&<button type="button" onClick={onOpenList}>예약 목록 열기</button>}</div>
    </form>
  </section>;
}
