'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {MessageSquare,Plus,ArrowLeft} from 'lucide-react';
import {jsonBody,ApiError} from '@/lib/api';
import {workJson,workTime,type InternalRoom,type Person,type WorkPage} from '@/lib/team-collaboration';
import {InternalRoomForm} from './InternalRoomForm';
import {InternalConversation} from './InternalConversation';
import '../work-list.css';
import './collaboration.css';

export function InternalChatWorkspace({active,organizationId,storageKey,canRead,canWrite}:{active:boolean;organizationId:string;storageKey:string;canRead:boolean;canWrite:boolean}) {
  const [rooms,setRooms]=useState<InternalRoom[]>([]),[selected,setSelected]=useState<InternalRoom|null>(null),[people,setPeople]=useState<Person[]>([]),[form,setForm]=useState<'new'|'manage'|null>(null);
  const [q,setQ]=useState(''),[page,setPage]=useState(0),[hasMore,setHasMore]=useState(false),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pendingSend,setPendingSend]=useState(false);
  const mounted=useRef(false),latestSelected=useRef(selected);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{latestSelected.current=selected;},[selected]);
  useEffect(()=>{if(!active||!canRead)return;const abort=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const load=async()=>{try{const result=await workJson<WorkPage<InternalRoom>>(`/api/internal-chat/rooms?page=${page}`,organizationId,{signal:abort.signal});if(abort.signal.aborted)return;setRooms(result.items);setHasMore(result.hasMore);setError('');
      const chosen=latestSelected.current;const fresh=result.items.find(r=>r.id===chosen?.id);if(fresh&&!form)setSelected(fresh);
    }catch(e){if(!abort.signal.aborted){setError((e as Error).message);if(e instanceof ApiError&&[401,403].includes(e.status)){setRooms([]);setSelected(null);}}}finally{if(!abort.signal.aborted){setLoading(false);timer=setTimeout(load,15000);}}};
    void Promise.resolve().then(()=>{if(!abort.signal.aborted){setLoading(true);void load();}});return()=>{abort.abort();clearTimeout(timer);};
  },[active,canRead,organizationId,page,refresh,form]);
  useEffect(()=>{if(!active||!canRead||!canWrite)return;const abort=new AbortController();
    void workJson<Person[]>('/api/internal-chat/candidates',organizationId,{signal:abort.signal}).then(v=>{if(!abort.signal.aborted)setPeople(v);}).catch(e=>{if(!abort.signal.aborted){setPeople([]);setError(e.message);}});return()=>abort.abort();
  },[active,canRead,canWrite,organizationId,refresh]);
  const update=useCallback((room:InternalRoom)=>{setSelected(previous=>previous?.id===room.id?room:previous);setRooms(previous=>previous.map(r=>r.id===room.id?room:r));},[]);
  const leave=async()=>{if(!selected||busy||pendingSend)return;setBusy(true);setError('');try{await workJson(`/api/internal-chat/rooms/${selected.id}/leave`,organizationId,jsonBody({expectedVersion:selected.version}));if(mounted.current){setSelected(null);setForm(null);setRefresh(x=>x+1);}}catch(e){if(mounted.current)setError((e as Error).message);}finally{if(mounted.current)setBusy(false);}};
  if(!canRead)return null;
  const filtered=rooms.filter(r=>`${r.name} ${r.participants.map(p=>p.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  return <section hidden={!active} className={`crm-list-workspace internal-chat-workspace ${selected?"has-conversation":""}`} aria-label="조직 내부 채팅">
    <header className="list-heading"><div><h1>조직 내부 채팅</h1><p>같은 조직의 동료와 1:1 또는 그룹으로 대화합니다.</p></div><div className="work-actions">{canWrite&&<button className="work-primary" onClick={()=>setForm('new')} disabled={busy}><Plus size={16}/>새 대화</button>}<button disabled={loading||busy} onClick={()=>setRefresh(x=>x+1)}>방 목록 다시 조회</button></div></header>
    {error&&<p className="list-error" role="alert">{error}</p>}
    <div className={`internal-layout ${selected||form?'internal-detail-open':''}`}>
      <aside className="internal-room-list" aria-label="내 대화방">
        <label>이 페이지 방·참여자 검색<input placeholder="방 이름·직원 이름" value={q} maxLength={200} onChange={e=>setQ(e.target.value)}/></label>
        <div className="internal-room-scroll">{filtered.map(r=><button key={r.id} aria-pressed={selected?.id===r.id&&!form} className="internal-room-row" onClick={()=>{setSelected(r);setForm(null);setError('');}}><span><strong>{r.name}</strong>{r.unread>0&&<small className="internal-unread" aria-label={`미읽음 ${r.unread}건`}>{r.unread>99?'99+':r.unread}</small>}</span><p>{r.preview||'아직 메시지가 없습니다.'}</p><span><small>{r.kind==='DIRECT'?'1:1':`그룹 ${r.participants.length}명`}</small><time dateTime={r.updatedAt}>{workTime(r.updatedAt)}</time></span></button>)}{!filtered.length&&<p className="list-empty"><MessageSquare size={24}/>{loading?'방을 조회하고 있습니다.':q?'이 페이지에 일치하는 방이 없습니다.':'참여 중인 대화방이 없습니다.'}{canWrite&&!q?'새 대화에서 동료를 선택해 주세요.':''}</p>}</div>
        <footer className="list-pagination"><button disabled={!page||loading} onClick={()=>setPage(x=>x-1)}>이전</button><span>{page+1}</span><button disabled={!hasMore||loading} onClick={()=>setPage(x=>x+1)}>다음</button></footer>
      </aside>
      <div className="internal-room-detail">
        {form?<><button className="internal-mobile-back" onClick={()=>{setSelected(null);setForm(null);}}><ArrowLeft size={16}/>방 목록</button><InternalRoomForm key={form==='manage'?`manage:${selected!.id}`:'new'} organizationId={organizationId} people={people} room={form==='manage'?selected!:undefined} onClose={()=>setForm(null)} onSaved={r=>{setSelected(r);setForm(null);setPage(0);setRefresh(x=>x+1);}}/></>:selected?<><div className="work-actions internal-room-toolbar"><button className="internal-mobile-back" onClick={()=>setSelected(null)}><ArrowLeft size={16}/>방 목록</button>{selected.manageable&&canWrite&&<button onClick={()=>setForm('manage')} disabled={busy}>그룹 관리</button>}<button onClick={()=>void leave()} disabled={busy||pendingSend} title={pendingSend?"전송 결과를 먼저 확인해 주세요.":undefined}>대화방 나가기</button></div><InternalConversation key={selected.id} roomId={selected.id} organizationId={organizationId} storageKey={`${storageKey}:${selected.id}`} active={active} canWrite={canWrite} onRoom={update} onPendingChange={setPendingSend}/></>:<p className="list-empty"><MessageSquare size={28}/>대화할 방을 선택해 주세요.{canWrite?' 새 대화로 동료를 초대할 수 있습니다.':''}</p>}
      </div>
    </div>
  </section>;
}
