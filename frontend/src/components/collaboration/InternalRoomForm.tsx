'use client';
import {useRef,useState} from 'react';
import {jsonBody} from '@/lib/api';
import {workJson,type Person,type InternalRoom} from '@/lib/team-collaboration';

export function InternalRoomForm({organizationId,people,room,onSaved,onClose}:{organizationId:string;people:Person[];room?:InternalRoom;onSaved:(room:InternalRoom)=>void;onClose:()=>void}) {
  const [kind,setKind]=useState(room?.kind||'DIRECT'),[name,setName]=useState(room?.name||''),[query,setQuery]=useState('');
  const [selected,setSelected]=useState<number[]>(room?.participants.map(p=>p.id)||[]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(crypto.randomUUID()),flight=useRef(false),abort=useRef<AbortController|null>(null);
  const choices=people.filter(p=>!p.own||Boolean(room)).filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
  const submit=async()=>{if(flight.current)return;flight.current=true;setBusy(true);setError('');abort.current=new AbortController();
    try{const old=room?.participants.map(p=>p.id)||[];const body=room?{expectedVersion:room.version,name,add:selected.filter(id=>!old.includes(id)),remove:old.filter(id=>!selected.includes(id))}:{requestId:request.current,kind,name,participantIds:selected};
      const v=await workJson<InternalRoom>(room?`/api/internal-chat/rooms/${room.id}`:'/api/internal-chat/rooms',organizationId,{...jsonBody(body),method:room?'PUT':'POST',signal:abort.current.signal});onSaved(v);
    }catch(e){if(!abort.current.signal.aborted)setError((e as Error).message);}finally{flight.current=false;if(!abort.current.signal.aborted)setBusy(false);}
  };
  return <form className="internal-room-form" onSubmit={e=>{e.preventDefault();void submit();}}>
    <div className="work-actions"><h2>{room?'그룹 관리':'새 대화'}</h2><button type="button" disabled={busy} onClick={onClose}>닫기</button></div>
    {error&&<p role="alert" className="list-error">{error}{room?' 입력을 보존했습니다. 방 목록에서 최신 정보를 확인한 뒤 다시 관리해 주세요.':''}</p>}
    {!room&&<label>대화 종류<select disabled={busy} value={kind} onChange={e=>{setKind(e.target.value);setSelected([]);}}><option value="DIRECT">1:1 대화</option><option value="GROUP">그룹 대화</option></select></label>}
    {kind==='GROUP'&&<label>그룹 이름<input value={name} maxLength={150} required disabled={busy} onChange={e=>setName(e.target.value)}/></label>}
    <label>참여자 검색<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="직원 이름"/></label>
    <fieldset disabled={busy}><legend>같은 조직의 채팅 참여자 · 그룹 최대50명</legend><div className="internal-people">{choices.map(p=><label key={p.id}><input type={kind==='DIRECT'?'radio':'checkbox'} name="participant" checked={selected.includes(p.id)} disabled={room?.participants.some(m=>m.id===p.id&&m.owner)} onChange={e=>setSelected(kind==='DIRECT'?[p.id]:e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>{p.name}{room?.participants.some(m=>m.id===p.id&&m.owner)?' · 방 관리자':''}</label>)}{!choices.length&&<p>선택 가능한 직원이 없습니다. 직원의 채팅 조회 권한을 확인해 주세요.</p>}</div></fieldset>
    <div className="work-actions"><span>{selected.length}명 선택{room?'':' · 본인 자동 포함'}</span><button className="work-primary" type="submit" disabled={busy||!selected.length||kind==='GROUP'&&!name.trim()}>{busy?'저장 확인 중…':room?'그룹 변경 저장':'대화 시작'}</button></div>
  </form>;
}
