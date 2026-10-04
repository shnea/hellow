import {apiFetch,ApiError,jsonBody} from './api';
import {SupportHttpError} from './support-session';

export interface ChatMessage {sequence:number;sender:'CUSTOMER'|'AGENT';senderName:string;clientMessageId:string;body:string;createdAt:string;image?:{name:string;mime:string;size:number}|null;}
export interface ChatView {queueCode:string;state:'WAITING'|'OPEN'|'CLOSED';endedAt:string|null;canSend:boolean;messages:ChatMessage[];cursor:number;hasMore:boolean;}
export type ChatTarget = {kind:'customer';sessionId:string;storageKey:string}|{kind:'staff';queueCode:string;organizationId:string;storageKey:string};
export async function chatFetch(target:ChatTarget,action:string,options:RequestInit={}){
  const headers=new Headers(options.headers);
  headers.set('Accept',action.startsWith('events')?'text/event-stream':'application/json');
  if(target.kind==='customer')headers.set('X-Support-Session',target.sessionId);
  else headers.set('X-Organization-ID',target.organizationId);
  const prefix=target.kind==='customer'?'/api/support/chat':`/api/chat/${encodeURIComponent(target.queueCode)}`;
  const response=await (target.kind==='customer'?fetch(prefix+'/'+action,{...options,headers,cache:'no-store'}):apiFetch(prefix+'/'+action,{...options,headers}));
  if(!response.ok){
    const body=await response.json().catch(()=>null);
    const message=body?.detail||'채팅에 연결하지 못했습니다. 다시 시도해 주세요.';
    throw target.kind==='customer'?new SupportHttpError(response.status,message):new ApiError(response.status,message);
  }
  return response;
}
export async function chatJson<T>(target:ChatTarget,action:string,data?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await chatFetch(target,action,{...(data!==undefined?jsonBody(data):{}),signal});
  return response.json() as Promise<T>;
}
export async function sendChatImage(target:ChatTarget,file:Blob,name:string,clientMessageId:string):Promise<ChatMessage>{
  const body=new FormData();body.append('file',file,name);body.append('clientMessageId',clientMessageId);
  return (await chatFetch(target,'images',{method:'POST',body})).json() as Promise<ChatMessage>;
}
// Fetch streaming permits authentication headers; EventSource would put capabilities in URLs.
export async function readChatEvents(response:Response,onView:(view:ChatView)=>void){
  if(!response.body)throw new Error('채팅 연결 응답을 읽지 못했습니다.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  try{while(true){
    const {done,value}=await reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');
    let boundary:number;
    while((boundary=buffer.indexOf('\n\n'))>=0){
      const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
      const event=frame.split('\n').find(line=>line.startsWith('event:'))?.slice(6).trim();
      if(event==='unavailable')throw new Error('채팅 접근 상태가 변경되었습니다. 다시 연결하고 있습니다.');
      if(event==='conversation'){
        const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
        onView(JSON.parse(data) as ChatView);
      }
    }
  }}finally{reader.releaseLock();}
}
