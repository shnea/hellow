import {apiFetch, apiJson, ApiError} from './api';

export interface WorkFile {id:string;name:string;mime:string;size:number;}
export interface Knowledge {id:string;version:number;title:string;category:string;kind:string;visibility:string;state:string;revision:number;publishedRevision:number|null;unpublishedChanges:boolean;document:string;attachments:WorkFile[];authorName:string;updatedAt:string;editable:boolean;publishable:boolean;}
export interface KnowledgeRevision {revision:number;title:string;category:string;kind:string;visibility:string;document:string;attachments:WorkFile[];editorName:string;createdAt:string;}
export interface Person {id:number;name:string;own?:boolean;}
export interface Participant extends Person {readSequence:number;owner:boolean;}
export interface InternalRoom {id:string;version:number;kind:string;name:string;sequence:number;unread:number;preview:string;participants:Participant[];manageable:boolean;updatedAt:string;}
export interface InternalMessage {sequence:number;senderName:string;own:boolean;clientMessageId:string;body:string;attachments:WorkFile[];createdAt:string;}
export interface InternalConversation {room:InternalRoom;messages:InternalMessage[];cursor:number;hasMore:boolean;}
export interface WorkPage<T> {items:T[];hasMore:boolean;}
export const knowledgeStates:Record<string,string>={DRAFT:'초안',PUBLISHED:'게시',ARCHIVED:'보관'};
export const knowledgeKinds:Record<string,string>={DOCUMENT:'문서',FAQ:'FAQ'};
export const visibilityLabels:Record<string,string>={SELF:'본인',TEAM:'소속 팀',ORGANIZATION:'조직 전체'};
export const workTime=(value:string)=>new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
export function workJson<T>(path:string,org:string,options:RequestInit={}) {
  const headers=new Headers(options.headers);headers.set('X-Organization-ID',org);
  return apiJson<T>(path,{...options,headers});
}
export async function workUpload(path:string,org:string,file:Blob,name:string,requestId:string,signal?:AbortSignal):Promise<WorkFile> {
  const body=new FormData();body.append('file',file,name);body.append('requestId',requestId);
  return workJson<WorkFile>(path,org,{method:'POST',body,signal});
}
export async function internalEvents(org:string,room:string,after:number,signal:AbortSignal,onData:(data:InternalConversation)=>void) {
  const response=await apiFetch(`/api/internal-chat/rooms/${encodeURIComponent(room)}/events?afterSequence=${after}`,{headers:{'X-Organization-ID':org,Accept:'text/event-stream'},signal});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new ApiError(response.status,body?.detail||'내부 채팅에 연결하지 못했습니다.');}
  if(!response.body)throw new Error('대화 응답을 읽지 못했습니다.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let boundary:number;
    while((boundary=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const lines=frame.split('\n');const event=lines.find(x=>x.startsWith('event:'))?.slice(6).trim();
      if(event==='unavailable')throw new ApiError(409,'대화 접근 상태를 다시 확인하고 있습니다.');
      if(event==='conversation')onData(JSON.parse(lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n')));
    }
  }}finally{reader.releaseLock();}
}
