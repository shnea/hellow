'use client';
import {useEffect,useRef,useState} from 'react';
import {chatJson,type ChatMessage,type ChatTarget} from '@/lib/chat';
import {ApiError} from '@/lib/api';
import {SupportHttpError} from '@/lib/support-session';

function imageUrl(value:unknown){
  if(typeof value!=='string')return '';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
export function ChatImage({message,target,readOnly,onLoad}:{message:ChatMessage;target:ChatTarget;readOnly:boolean;onLoad:()=>void}){
  const [urls,setUrls]=useState<{preview:string;original:string}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const root=useRef<HTMLDivElement>(null);
  const kind=target.kind,session=kind==='customer'?target.sessionId:'',queue=kind==='staff'?target.queueCode:'',organization=kind==='staff'?target.organizationId:'',storageKey=target.storageKey;
  useEffect(()=>{
    const abort=new AbortController();let observer:IntersectionObserver|undefined;
    const load=async()=>{
      setUrls(null);setError('');
      try{
        const t:ChatTarget=kind==='customer'?{kind,sessionId:session,storageKey}:{kind,queueCode:queue,organizationId:organization,storageKey};
        const ticket=await chatJson<Record<string,unknown>>(t,`images/${message.sequence}/views${readOnly&&kind==='staff'?'?history=true':''}`,undefined,abort.signal);
        const original=imageUrl(ticket.originalUrl),preview=imageUrl(ticket.previewUrl)||imageUrl(ticket.thumbnailUrl)||original;
        if(!preview)throw Error('이미지 주소를 확인하지 못했습니다.');
        if(!abort.signal.aborted)setUrls({preview,original:original||preview});
      }catch(e){if(!abort.signal.aborted)setError(e instanceof ApiError||e instanceof SupportHttpError?e.message:'이미지를 불러오지 못했습니다. 연결을 확인하고 다시 불러와 주세요.');}
    };
    if(typeof IntersectionObserver==='undefined')void load();
    else {observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();void load();}},{root:root.current?.closest('.chat-transcript')});if(root.current)observer.observe(root.current);}
    return()=>{abort.abort();observer?.disconnect();};
  },[kind,session,queue,organization,storageKey,message.sequence,readOnly,retry]);
  return <div className="chat-image" ref={root}>
    {urls?<a href={urls.original} target="_blank" rel="noopener noreferrer" aria-label={`${message.image?.name} 원본 이미지 보기`}>
      {/* Short-lived private tickets must bypass the shared image optimizer cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls.preview} alt={message.image?.name||'고객 첨부 이미지'} referrerPolicy="no-referrer" onLoad={onLoad} onError={()=>{setUrls(null);setError('이미지를 불러오지 못했습니다. 다시 불러와 주세요.');}}/>
    </a>:error?<><p role="alert">{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)}>이미지 다시 불러오기</button></>:<p role="status">이미지를 불러오고 있습니다.</p>}
    <p className="chat-image-name">{message.image?.name} · {Math.max(1,Math.round((message.image?.size||0)/1024))}KB{urls?' · 선택하면 원본 보기':''}</p>
  </div>;
}
