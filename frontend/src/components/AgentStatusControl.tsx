'use client';
import { agentStateLabels,type AgentState,type AgentView,type Availability } from '@/lib/agent-state';

export function AgentStatusControl({view,state,organizationId,busy,error,onChange,onRetry}:{
  view:AgentView|null;state:AgentState|undefined;organizationId:string;busy:boolean;error:string;
  onChange:(state:Availability)=>void;onRetry:()=>void;
}){
  const elsewhere=view&&view.activeOrganizationId!==organizationId;
  const working=state==='CALLING'||state==='AFTER_CALL';
  return <section className="agent-status-control" aria-label="상담사 수신 상태">
    <strong role="status">{elsewhere?'다른 조직에서 수신 중':state?agentStateLabels[state]:'상태 확인 중…'}</strong>
    {elsewhere?<button disabled={busy||working} onClick={()=>onChange('AVAILABLE')}>현재 조직에서 대기</button>:<label>수신 상태 선택
      <select aria-label="수신 상태 선택" value={view?.availability||'OFFLINE'} disabled={busy||!view||Boolean(error)} onChange={e=>onChange(e.target.value as Availability)}>
        <option value="AVAILABLE" disabled={working}>대기 · 상담 가능</option><option value="AWAY">자리비움</option><option value="OFFLINE">오프라인</option>
      </select></label>}
    {working&&<span>기록 완료까지 새 상담 수신 차단</span>}
    {!working&&!elsewhere&&state==='OFFLINE'&&!error&&<span>대기를 선택하면 상담 요청을 받습니다.</span>}
    {error&&<p role="alert">{error}<button disabled={busy} onClick={onRetry}>상태 다시 확인</button></p>}
  </section>;
}
