'use client';
import { agentStateLabels,type AgentState,type AgentView,type Availability } from '@/lib/agent-state';

export function AgentStatusControl({view,state,organizationId,busy,error,onChange,onRetry}:{
  view:AgentView|null;state:AgentState|undefined;organizationId:string;busy:boolean;error:string;
  onChange:(state:Availability)=>void;onRetry:()=>void;
}){
  const elsewhere=view&&view.activeOrganizationId!==organizationId;
  const working=state==='CALLING'||state==='AFTER_CALL'||state==='FOLLOW_UP'||state==='TRANSFER_PENDING';
  return <section className="agent-status-control" aria-label="상담사 수신 상태">
    <strong role="status">{elsewhere?'다른 조직에서 수신 중':state?agentStateLabels[state]:'상태 확인 중…'}</strong>
    {elsewhere?<button disabled={busy||working} onClick={()=>onChange('AVAILABLE')}>현재 조직에서 대기</button>:<>
      <div className="agent-availability-chips" role="group" aria-label="수신 상태 바로 선택">
        {(['AVAILABLE','AWAY','OFFLINE'] as Availability[]).map(value=><button key={value} type="button"
          aria-pressed={view?.availability===value} data-state={value}
          disabled={busy||!view||Boolean(error)||working&&value==='AVAILABLE'} onClick={()=>onChange(value)}>
          <span className="availability-dot" aria-hidden="true"/>{value==='AVAILABLE'?'대기':value==='AWAY'?'자리비움':'오프라인'}
        </button>)}
      </div>
      <label className="agent-availability-select">수신 상태 선택
      <select aria-label="수신 상태 선택" value={view?.availability||'OFFLINE'} disabled={busy||!view||Boolean(error)} onChange={e=>onChange(e.target.value as Availability)}>
        <option value="AVAILABLE" disabled={working}>대기 · 상담 가능</option><option value="AWAY">자리비움</option><option value="OFFLINE">오프라인</option>
      </select></label></>}
    {working&&<span>{state==='TRANSFER_PENDING'?'이관 요청 응답까지 새 상담 수신 차단':state==='FOLLOW_UP'?'후속 업무 종료까지 새 상담 수신 차단':'기록 완료까지 새 상담 수신 차단'}</span>}
    {!working&&!elsewhere&&(state==='OFFLINE'||state==='AWAY')&&!error&&<span>대기를 선택하면 마이크를 확인한 뒤 상담 요청을 받습니다.</span>}
    {error&&<p role="alert">{error}<button disabled={busy} onClick={onRetry}>상태 다시 확인</button></p>}
  </section>;
}
