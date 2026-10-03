'use client';
import {useEffect,useState} from 'react';
import {apiJson} from '@/lib/api';
import {attemptLabels} from '@/lib/agent-state';
import type {QueueItem} from '@/types';

interface Attempt {id:string;agentName:string;offeredAt:string;receivedAt:string|null;finishedAt:string|null;outcome:string;routingCycle:number;}
export function AssignmentHistory({item,busy,canRestart,onRestart}:{item:QueueItem;busy:boolean;canRestart:boolean;onRestart:()=>void}){
  const [open,setOpen]=useState(false);const [rows,setRows]=useState<Attempt[]>([]);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(!open)return;
    const abort=new AbortController();
    // Request state changes when a new assignment is visible, not on every parent heartbeat.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setError('');
    apiJson<Attempt[]>(`/api/queue/${item.id}/attempts`,{signal:abort.signal})
      .then(rows=>{if(!abort.signal.aborted)setRows(rows);}).catch(error=>{if(!abort.signal.aborted)setError(error.message);})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[open,item.id,item.offer?.id,item.status,item.version,refresh]);
  return <details className="assignment-history" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>배정 이력{item.attemptCount?` · ${item.attemptCount}회`:''}</summary>
    {open&&<div>
      <p>최근 배정 시도 100건입니다. 고객의 상담 기록은 별도로 보존합니다.</p>
      {loading?<p role="status">배정 이력을 불러오고 있습니다.</p>:error?<p role="alert">{error}</p>:!rows.length?<p>아직 배정 시도가 없습니다.</p>:
        <ol>{rows.map(a=><li key={a.id}><strong>{a.agentName} · {attemptLabels[a.outcome]||a.outcome}</strong>
          <span>{new Date(a.offeredAt).toLocaleString('ko-KR')} · {a.routingCycle+1}회차</span>
          {a.finishedAt&&<span>처리 {new Date(a.finishedAt).toLocaleTimeString('ko-KR')}</span>}</li>)}</ol>}
      <div className="assignment-history-actions"><button disabled={loading} onClick={()=>setRefresh(v=>v+1)}>이력 다시 조회</button>
        {canRestart&&item.status==='WAITING'&&!item.offer&&Boolean(item.attemptCount)&&<button disabled={busy||loading} onClick={onRestart}>배정 다시 시작</button>}</div>
    </div>}
  </details>;
}
