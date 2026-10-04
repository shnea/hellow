'use client';
import {useEffect,useRef,useState} from 'react';
import {ApiError} from '@/lib/api';
import {SupportHttpError} from '@/lib/support-session';
import {chatFetch,chatJson,readChatEvents,type ChatMessage,type ChatTarget,type ChatView} from '@/lib/chat';
import './chat.css';
import {ChatImage} from './ChatImage';
import {ChatImageComposer} from './ChatImageComposer';

interface Pending {clientMessageId:string;body:string;}
export function ChatPanel({target,readOnly=false}:{target:ChatTarget;readOnly?:boolean}){
  const [messages,setMessages]=useState<ChatMessage[]>([]),[view,setView]=useState<ChatView|null>(null);
  const [connection,setConnection]=useState('대화를 불러오고 있습니다.'),[error,setError]=useState('');
  const [draft,setDraft]=useState(''),[pending,setPending]=useState<Pending|null>(null),[ready,setReady]=useState(false);
  const [sending,setSending]=useState(false),[ending,setEnding]=useState(false),[retry,setRetry]=useState(0),[unseen,setUnseen]=useState(false);
  const [imagePending,setImagePending]=useState(false),[imageSending,setImageSending]=useState(false);
  const transcript=useRef<HTMLDivElement>(null),stick=useRef(true),cursor=useRef(0),inFlight=useRef(false);
  const targetRef=useRef(target);
  useEffect(()=>{targetRef.current=target;},[target]);
  const storageKey=target.storageKey;
  const ownSender=target.kind==='customer'?'CUSTOMER':'AGENT';
  const merge=(rows:ChatMessage[])=>setMessages(previous=>{
    const all=new Map(previous.map(m=>[m.sequence,m]));rows.forEach(m=>all.set(m.sequence,m));return [...all.values()].sort((a,b)=>a.sequence-b.sequence);
  });
  useEffect(()=>{const abort=new AbortController();let timer:ReturnType<typeof setTimeout>;let closed=false;
    const apply=(data:ChatView)=>{
      if(abort.signal.aborted)return;
      if(!stick.current&&data.messages.length)setUnseen(true);
      merge(data.messages);cursor.current=data.cursor;setView(data);closed=data.state==='CLOSED'&&!data.hasMore;
      setConnection(closed?'대화가 종료되었습니다. 기록은 보존됩니다.':data.state==='WAITING'?'상담사가 수락하면 메시지를 보낼 수 있습니다.':'연결됨');
    };
    const connect=async()=>{
      try{
        let data:ChatView;
        do{data=await chatJson<ChatView>(targetRef.current,`messages?afterSequence=${cursor.current}${readOnly&&targetRef.current.kind==='staff'?'&history=true':''}`,undefined,abort.signal);apply(data);}while(data.hasMore&&!abort.signal.aborted);
        if(readOnly||closed||abort.signal.aborted)return;
        const response=await chatFetch(targetRef.current,`events?afterSequence=${cursor.current}`,{signal:abort.signal});
        await readChatEvents(response,apply);
        if(!closed&&!abort.signal.aborted)timer=setTimeout(connect,1000);
      }catch(e){if(abort.signal.aborted)return;
        if((e instanceof ApiError||e instanceof SupportHttpError)&&[401,403,404,410].includes(e.status)){
          setMessages([]);setView(null);setConnection('대화에 접근할 수 없습니다.');setError(e.message);return;
        }
        setConnection('연결이 끊겼습니다. 메시지를 보존하고 다시 연결합니다.');timer=setTimeout(connect,2000);
      }
    };
    void Promise.resolve().then(()=>{
      if(abort.signal.aborted)return;
      try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}');
        if(typeof saved.draft==='string')setDraft(saved.draft);
        if(saved.pending&&typeof saved.pending.body==='string'&&typeof saved.pending.clientMessageId==='string')setPending(saved.pending);
        setReady(true);
      }catch{setError('전송할 내용을 보관하지 못했습니다. 브라우저 저장소를 확인해 주세요.');}
      void connect();
    });
    const online=()=>{if(!abort.signal.aborted){clearTimeout(timer);abort.abort();setRetry(v=>v+1);}};
    window.addEventListener('online',online);
    return()=>{abort.abort();clearTimeout(timer);window.removeEventListener('online',online);};
  },[storageKey,readOnly,retry]);
  useEffect(()=>{if(stick.current&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;},[messages]);
  const store=(text:string,outgoing:Pending|null)=>{
    try{sessionStorage.setItem(storageKey,JSON.stringify({draft:text,pending:outgoing}));return true;}
    catch{setError('전송할 내용을 보관하지 못했습니다. 브라우저 저장소를 확인한 뒤 다시 시도해 주세요.');return false;}
  };
  const send=async()=>{
    if(inFlight.current||imageSending||!ready||readOnly||(!pending&&!view?.canSend))return;
    const outgoing=pending||{clientMessageId:crypto.randomUUID(),body:draft};if(!outgoing.body.trim())return;
    if(!store(draft,outgoing))return;
    inFlight.current=true;setPending(outgoing);setSending(true);setError('');
    try{const message=await chatJson<ChatMessage>(targetRef.current,'messages',outgoing);merge([message]);
      if(store('',null)){setDraft('');setPending(null);}
    }catch(e){setError(`${(e as Error).message} 같은 메시지로 다시 시도할 수 있습니다.`);}
    finally{inFlight.current=false;setSending(false);}
  };
  const end=async()=>{if(ending||sending||pending||imagePending||imageSending||readOnly||!view?.canSend)return;setEnding(true);setError('');
    try{const result=await chatJson<ChatView>(targetRef.current,'end',{});setView(result);setConnection('대화가 종료되었습니다. 기록은 보존됩니다.');setRetry(v=>v+1);}
    catch(e){setError(`${(e as Error).message} 종료 여부를 다시 확인해 주세요.`);}finally{setEnding(false);}
  };
  return <section className="chat-panel" aria-label="고객 실시간 대화">
    <header className="chat-heading"><h2>실시간 대화</h2>{!readOnly&&<button type="button" disabled={!view?.canSend||ending||sending||Boolean(pending)||imagePending||imageSending} onClick={()=>void end()}>{ending?'종료 확인 중…':'대화 종료'}</button>}</header>
    <p role="status" className="chat-connection">{connection}{readOnly?' · 읽기 전용':''}</p>
    {error&&<p role="alert" className="chat-error">{error}</p>}
    <div className="chat-transcript" ref={transcript} tabIndex={0} role="log" aria-label="대화 메시지" aria-live="polite" aria-relevant="additions" onKeyDown={e=>{
      if(e.target!==e.currentTarget)return;
      const el=e.currentTarget,step=el.clientHeight*.9;
      const deltas:Record<string,number>={ArrowUp:-40,ArrowDown:40,PageUp:-step,PageDown:step},delta=deltas[e.key];
      if(delta!==undefined){e.preventDefault();el.scrollTop+=delta;}
      else if(e.key==='Home'||e.key==='End'){e.preventDefault();el.scrollTop=e.key==='Home'?0:el.scrollHeight;}
    }} onScroll={()=>{if(transcript.current){const el=transcript.current;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;if(stick.current)setUnseen(false);}}}>
      {!messages.length&&<p className="chat-empty">{view?'아직 저장된 메시지가 없습니다.':'저장된 메시지를 확인하고 있습니다.'}</p>}
      {messages.map(m=><article key={m.sequence} className={`chat-message ${m.sender===ownSender?'chat-own':'chat-peer'}`}><div className="chat-message-header"><strong>{m.senderName}</strong><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div>{m.body&&<p>{m.body}</p>}{m.image&&<ChatImage message={m} target={target} readOnly={readOnly} onLoad={()=>{if(stick.current&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;}}/>}</article>)}
    </div>
    {unseen&&<button type="button" className="chat-latest" onClick={()=>{stick.current=true;setUnseen(false);if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;}}>새 메시지 보기</button>}
    {!readOnly&&<form className="chat-composer" onSubmit={e=>{e.preventDefault();void send();}}>
      <label>메시지<textarea rows={3} maxLength={10000} value={draft} disabled={!ready||!view?.canSend||Boolean(pending)} onChange={e=>{setDraft(e.target.value);store(e.target.value,pending);}} placeholder={view?.state==='CLOSED'?'종료된 대화입니다.':'메시지를 입력해 주세요.'}/></label>
      <div><span>{pending?sending?'서버 저장 확인 중…':'전송 결과를 확인하지 못했습니다. 같은 메시지로 재시도합니다.':'서버에 저장된 메시지가 대화에 표시됩니다.'}</span><button type="submit" disabled={!ready||sending||imageSending||(!pending&&(!view?.canSend||!draft.trim()))}>{sending?'전송 중…':pending?'같은 메시지 재시도':'메시지 전송'}</button></div>
    </form>}
    {!readOnly&&target.kind==='customer'&&<ChatImageComposer target={target} canSend={Boolean(view?.canSend)} disabled={sending||ending||Boolean(pending)} onPendingChange={setImagePending} onSendingChange={setImageSending} onSent={message=>merge([message])}/>}
  </section>;
}
