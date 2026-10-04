'use client';
import {useEffect,useRef,useState} from 'react';
import {sendChatImage,type ChatMessage,type ChatTarget} from '@/lib/chat';
import {chatImageOutbox,type PendingChatImage} from '@/lib/chat-image-outbox';
import {ApiError} from '@/lib/api';
import {SupportHttpError} from '@/lib/support-session';

export function ChatImageComposer({target,canSend,disabled,onPendingChange,onSendingChange,onSent}:{
  target:ChatTarget;canSend:boolean;disabled:boolean;onPendingChange:(value:boolean)=>void;onSendingChange:(value:boolean)=>void;onSent:(message:ChatMessage)=>void;
}){
  const [selected,setSelected]=useState<PendingChatImage|null>(null),[attempted,setAttempted]=useState(false),[sending,setSending]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState('');
  const picker=useRef<HTMLInputElement>(null),inFlight=useRef(false),active=useRef(true),onSentRef=useRef(onSent),targetRef=useRef(target);
  const [rejected,setRejected]=useState(false);
  useEffect(()=>{onSentRef.current=onSent;targetRef.current=target;},[onSent,target]);
  const storageKey=target.storageKey;
  useEffect(()=>{active.current=true;let disposed=false;
    void chatImageOutbox(storageKey).then(saved=>{if(!disposed){if(saved){setSelected(saved);setAttempted(true);onPendingChange(true);}setReady(true);}}).catch(()=>{if(!disposed){setError('이미지를 보관하지 못했습니다. 브라우저 저장소를 확인해 주세요.');}});
    return()=>{disposed=true;active.current=false;};
  },[storageKey,onPendingChange]);
  useEffect(()=>{
    if(!selected)return;
    const url=URL.createObjectURL(selected.file);void Promise.resolve().then(()=>setPreview(url));
    return()=>URL.revokeObjectURL(url);
  },[selected]);
  const choose=(file:File|undefined)=>{
    if(!file)return;
    if(!['image/jpeg','image/png'].includes(file.type)||file.size===0||file.size>5*1024*1024){setError('JPG·PNG 이미지를 최대 5MB까지 선택해 주세요.');return;}
    setSelected({file,name:file.name,clientMessageId:crypto.randomUUID()});setAttempted(false);setRejected(false);setError('');onPendingChange(true);
  };
  const send=async()=>{
    if(inFlight.current||!selected||!ready||disabled||(!attempted&&!canSend))return;
    inFlight.current=true;setSending(true);onSendingChange(true);setError('');
    let stored=false;
    try{
      // A committed local transaction precedes the request; failed storage never sends bytes.
      await chatImageOutbox(storageKey,selected);stored=true;setAttempted(true);
      const message=await sendChatImage(targetRef.current,selected.file,selected.name,selected.clientMessageId);
      await chatImageOutbox(storageKey,null);
      if(active.current){onSentRef.current(message);setSelected(null);setAttempted(false);setPreview('');onPendingChange(false);}
    }catch(e){if(active.current){
      const refused=(e instanceof ApiError||e instanceof SupportHttpError)&&[400,401,403,404,409,410,413,429].includes(e.status);
      setRejected(refused);setError(stored?`${(e as Error).message} ${refused?'선택을 취소하거나 같은 이미지로 다시 시도해 주세요.':'이미지를 보관했습니다. 같은 이미지로 다시 시도해 주세요.'}`:'이미지를 보관하지 못해 전송하지 않았습니다. 브라우저 저장소를 확인하고 다시 시도해 주세요.');
    }}
    finally{inFlight.current=false;if(active.current){setSending(false);onSendingChange(false);}}
  };
  const discard=async()=>{
    if(sending||inFlight.current)return;
    try{if(attempted)await chatImageOutbox(storageKey,null);setSelected(null);setPreview('');setAttempted(false);setRejected(false);setError('');onPendingChange(false);}
    catch{setError('이미지 보관을 취소하지 못했습니다. 다시 시도해 주세요.');}
  };
  return <section className="chat-image-composer" aria-label="이미지 첨부">
    <div className="chat-image-actions"><button type="button" disabled={!ready||disabled||sending||attempted||!canSend} onClick={()=>picker.current?.click()}>이미지 첨부</button><span>JPG·PNG · 최대 5MB · 대화당 20장</span></div>
    <input ref={picker} type="file" accept="image/jpeg,image/png" hidden onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}}/>
    {selected&&<div className="chat-image-selection">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview&&<img src={preview} alt={`${selected.name} 전송 전 미리보기`}/>}
      <p>{selected.name} · {Math.max(1,Math.round(selected.file.size/1024))}KB</p>
      {attempted&&<p role="status">{sending?'이미지 저장 확인 중…':'전송 결과를 확인합니다. 같은 이미지로 재시도해 주세요.'}</p>}
      <div className="chat-image-actions">
        <button type="button" disabled={sending||disabled||!ready||(!attempted&&!canSend)} onClick={()=>void send()}>{sending?'이미지 전송 중…':attempted?'같은 이미지 재시도':'이미지 전송'}</button>
        {(!attempted||rejected)&&<button type="button" disabled={sending} onClick={()=>void discard()}>선택 취소</button>}
      </div>
    </div>}
    {error&&<p role="alert" className="chat-error">{error}</p>}
  </section>;
}
