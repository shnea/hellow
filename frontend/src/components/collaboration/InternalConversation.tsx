'use client';
import {useEffect,useRef,useState} from 'react';
import {Paperclip,X,ArrowDown} from 'lucide-react';
import {ApiError,jsonBody} from '@/lib/api';
import {chatImageOutbox,type PendingChatImage} from '@/lib/chat-image-outbox';
import {workJson,workUpload,internalEvents,workTime,type InternalRoom,type InternalMessage,type InternalConversation as Conversation} from '@/lib/team-collaboration';
import {WorkAttachment,PendingImagePreview} from './WorkAttachment';
import {submitChatOnEnter} from '@/lib/chat-keyboard';
import {refreshInternalUnread} from '@/lib/use-internal-unread';
import '../chat/chat.css';

interface Pending {clientMessageId:string;body:string;attachmentIds:string[];uploadRequestId?:string;}
export function InternalConversation({roomId,organizationId,storageKey,active,canWrite,onRoom,onPendingChange}:{roomId:string;organizationId:string;storageKey:string;active:boolean;canWrite:boolean;onRoom:(room:InternalRoom)=>void;onPendingChange?:(pending:boolean)=>void}) {
  const [room,setRoom]=useState<InternalRoom|null>(null),[messages,setMessages]=useState<InternalMessage[]>([]),[draft,setDraft]=useState(''),[pending,setPending]=useState<Pending|null>(null);
  const [file,setFile]=useState<PendingChatImage|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[connection,setConnection]=useState('대화 확인 중…'),[retry,setRetry]=useState(0),[unseen,setUnseen]=useState(false),[blocked,setBlocked]=useState(false);
  const cursor=useRef(0),stick=useRef(true),transcript=useRef<HTMLDivElement|null>(null),flight=useRef(false),mounted=useRef(false),readSeq=useRef(0),reading=useRef(false),metadata=useRef(onRoom),roomRef=useRef<InternalRoom|null>(null);
  useEffect(()=>{onPendingChange?.(Boolean(pending)||busy);return()=>onPendingChange?.(false);},[pending,busy,onPendingChange]);
  const base=`/api/internal-chat/rooms/${encodeURIComponent(roomId)}`;
  useEffect(()=>{metadata.current=onRoom;},[onRoom]);
  useEffect(()=>{mounted.current=true;void (async()=>{try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}');if(!mounted.current)return;
    if(typeof saved.draft==='string')setDraft(saved.draft);if(saved.pending?.clientMessageId&&typeof saved.pending.body==='string'&&Array.isArray(saved.pending.attachmentIds))setPending(saved.pending);setReady(true);
    const blob=await chatImageOutbox(storageKey);if(mounted.current)setFile(blob);
  }catch{if(mounted.current)setError('전송 초안을 읽지 못했습니다. 브라우저 저장소를 확인해 주세요.');}})();return()=>{mounted.current=false;};},[storageKey]);
  const merge=(incoming:InternalMessage[])=>setMessages(previous=>{const all=new Map(previous.map(m=>[m.sequence,m]));incoming.forEach(m=>all.set(m.sequence,m));return [...all.values()].sort((a,b)=>a.sequence-b.sequence);});
  useEffect(()=>{if(!active)return;const abort=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const apply=(v:Conversation)=>{if(abort.signal.aborted)return;if(!stick.current&&v.messages.length)setUnseen(true);merge(v.messages);cursor.current=v.cursor;roomRef.current=v.room;setRoom(v.room);metadata.current(v.room);setBlocked(false);setConnection('연결됨');};
    const connect=async()=>{try{let v:Conversation;do{v=await workJson<Conversation>(`${base}/messages?afterSequence=${cursor.current}`,organizationId,{signal:abort.signal});apply(v);}while(v.hasMore&&!abort.signal.aborted);
      if(abort.signal.aborted)return;await internalEvents(organizationId,roomId,cursor.current,abort.signal,apply);if(!abort.signal.aborted)timer=setTimeout(connect,1000);
    }catch(e){if(abort.signal.aborted)return;if(e instanceof ApiError&&[401,403,404].includes(e.status)){setMessages([]);setRoom(null);roomRef.current=null;setBlocked(true);setError(e.message);setConnection('이 방에 접근할 수 없습니다.');return;}
      if(e instanceof ApiError&&e.status===409){setMessages([]);setRoom(null);roomRef.current=null;cursor.current=0;setBlocked(true);}
      setConnection('연결이 끊겼습니다. 저장된 대화 위치에서 다시 연결합니다.');timer=setTimeout(connect,2000);
    }};void connect();return()=>{abort.abort();clearTimeout(timer);};
  },[active,organizationId,roomId,base,retry]);
  useEffect(()=>{if(active&&stick.current&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;},[active,messages]);
  useEffect(()=>{if(!active||blocked)return;const mark=()=>{if(document.visibilityState!=='visible'||!stick.current||reading.current||cursor.current<=readSeq.current||!roomRef.current)return;
    const sequence=cursor.current;reading.current=true;void workJson<InternalRoom>(`${base}/read`,organizationId,jsonBody({sequence})).then(v=>{if(!mounted.current)return;readSeq.current=Math.max(readSeq.current,sequence);setRoom(v);metadata.current(v);refreshInternalUnread();}).catch(()=>{}).finally(()=>{reading.current=false;});
  };const timer=setInterval(mark,1500);document.addEventListener('visibilitychange',mark);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',mark);};},[active,blocked,base,organizationId]);
  const store=(text:string,outgoing:Pending|null)=>{try{sessionStorage.setItem(storageKey,JSON.stringify({draft:text,pending:outgoing}));return true;}catch{setError('전송 내용을 보관하지 못했습니다. 브라우저 저장소를 확인해 주세요.');return false;}};
  const pick=async(value:File)=>{if(flight.current||pending)return;if(!value.size||value.size>50*1024*1024){setError('첨부파일은1byte~50MB까지 선택해 주세요.');return;}flight.current=true;setBusy(true);setError('');
    try{const outgoing={clientMessageId:crypto.randomUUID(),name:value.name,file:value};await chatImageOutbox(storageKey,outgoing);if(mounted.current)setFile(outgoing);}catch{if(mounted.current)setError('파일 원본을 보관하지 못했습니다. 저장소를 확인한 뒤 다시 선택해 주세요.');}finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  const cancelFile=async()=>{if(pending||flight.current)return;try{await chatImageOutbox(storageKey,null);setFile(null);}catch{setError('첨부파일 선택을 취소하지 못했습니다. 다시 시도해 주세요.');}};
  const send=async()=>{if(flight.current||!ready||!canWrite||blocked||!room)return;let outgoing=pending||{clientMessageId:crypto.randomUUID(),body:draft,attachmentIds:[],uploadRequestId:file?.clientMessageId};if(!outgoing.body.trim()&&!file&&!outgoing.attachmentIds.length)return;
    if(!store(draft,outgoing))return;setPending(outgoing);flight.current=true;setBusy(true);setError('');
    try{if(outgoing.uploadRequestId&&!outgoing.attachmentIds.length){if(!file||file.clientMessageId!==outgoing.uploadRequestId)throw new Error('보관된 파일 원본을 확인하지 못했습니다. 브라우저 저장소를 확인해 주세요.');
      const f=await workUpload(`${base}/files`,organizationId,file.file,file.name,outgoing.uploadRequestId);outgoing={...outgoing,attachmentIds:[f.id]};if(!store(draft,outgoing))return;if(mounted.current)setPending(outgoing);
    }
      const m=await workJson<InternalMessage>(`${base}/messages`,organizationId,jsonBody(outgoing));if(!mounted.current)return;merge([m]);
      // Clear bytes first: if local cleanup fails the stable message UUID remains retryable.
      if(outgoing.uploadRequestId)await chatImageOutbox(storageKey,null);if(!mounted.current)return;if(store('',null)){setDraft('');setPending(null);setFile(null);}
    }catch(e){if(mounted.current)setError(`${(e as Error).message} 같은 전송으로 다시 시도할 수 있습니다.`);}finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  const keyboard=(e:React.KeyboardEvent<HTMLDivElement>)=>{if(e.target!==e.currentTarget)return;const el=e.currentTarget;const step=el.clientHeight*.9;const move:Record<string,number>={ArrowUp:-40,ArrowDown:40,PageUp:-step,PageDown:step};if(e.key in move){e.preventDefault();el.scrollTop+=move[e.key];}else if(e.key==='Home'||e.key==='End'){e.preventDefault();el.scrollTop=e.key==='Home'?0:el.scrollHeight;}};
  return <section className="chat-panel internal-conversation" aria-label="조직 내부 대화">
    <div className="internal-participants"><strong>{room?.name||'대화'}</strong><p>{room?.participants.map(p=>p.name+(p.owner?' (관리자)':'')).join(' · ')}</p></div>
    <p className="chat-connection" role="status">{connection}{!canWrite?' · 읽기 전용':''}</p>
    {error&&<p className="chat-error" role="alert">{error}<button onClick={()=>{setError('');setRetry(x=>x+1);}}>대화 다시 연결</button></p>}
    <div className="chat-transcript" role="log" aria-label="내부 대화 메시지" aria-live="polite" aria-relevant="additions" tabIndex={0} ref={transcript} onKeyDown={keyboard} onScroll={e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;if(stick.current)setUnseen(false);}}>
      {!messages.length&&<p className="chat-empty">{blocked?'현재 이 방에 접근할 수 없습니다. 방 목록에서 참여 상태를 확인해 주세요.':room?'아직 저장된 메시지가 없습니다.':'대화를 확인하고 있습니다.'}</p>}
      {messages.map(m=><article className={`chat-message ${m.own?'chat-own':'chat-peer'}`} key={m.sequence}><div className="chat-message-header"><strong>{m.senderName}</strong><time dateTime={m.createdAt}>{workTime(m.createdAt)}</time></div>{m.body&&<p>{m.body}</p>}{m.attachments.map(f=><WorkAttachment key={f.id} file={f} path={`${base}/files`} organizationId={organizationId} previewImage onLoad={()=>{if(stick.current&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;}}/>)}{m.own&&<small className="internal-read">{room?.participants.filter(p=>p.readSequence>=m.sequence).length||0}/{room?.participants.length||0}명 읽음</small>}</article>)}
    </div>
    {unseen&&<button className="chat-latest" onClick={()=>{stick.current=true;setUnseen(false);if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;}}><ArrowDown size={14}/>새 메시지 보기</button>}
    {canWrite&&<form className="chat-composer" onSubmit={e=>{e.preventDefault();void send();}}>
      <label>메시지<textarea rows={3} maxLength={10000} placeholder="같은 조직의 동료에게 메시지를 보내세요." value={draft} disabled={!ready||busy||Boolean(pending)||blocked} onKeyDown={e=>submitChatOnEnter(e,()=>void send(),ready&&!busy&&!pending&&!blocked&&Boolean(room)&&canWrite)} onChange={e=>{setDraft(e.target.value);store(e.target.value,pending);}}/></label>
      {file&&<div className="internal-pending"><PendingImagePreview key={file.clientMessageId} file={file.file}/><Paperclip size={16}/><span>{file.name} · {(file.file.size/1024/1024).toFixed(1)}MB</span><button aria-label="첨부 선택 취소" type="button" disabled={busy||Boolean(pending)} onClick={()=>void cancelFile()}><X size={16}/></button></div>}
      <div className="internal-composer-actions"><label className="work-file-select"><Paperclip size={16}/>파일 · 최대50MB<input type="file" disabled={!ready||busy||Boolean(file)||Boolean(pending)||blocked} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void pick(f);}}/></label><button type="submit" disabled={!ready||busy||blocked||!room||(!pending&&!draft.trim()&&!file)}>{busy?'저장 확인 중…':pending?'같은 전송 재시도':'메시지 전송'}</button></div>
      <small>{pending?'전송 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.':'Enter 전송 · Shift+Enter 줄바꿈'}</small>
    </form>}
  </section>;
}
