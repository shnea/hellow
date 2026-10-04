'use client';
import {useEffect,useState} from 'react';
import {ApiError} from './api';
import {workJson} from './team-collaboration';

export const refreshInternalUnread=()=>window.dispatchEvent(new Event('hellow-internal-unread-changed'));

export function useInternalUnread(organizationId:string,enabled:boolean,identityKey:string) {
  const [snapshot,setSnapshot]=useState({organizationId:'',identityKey:'',count:0});
  useEffect(()=>{
    if(!enabled||!organizationId)return;
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>,loading=false,again=false;
    const load=async()=>{
      if(abort.signal.aborted)return;
      if(loading){again=true;return;}
      clearTimeout(timer);loading=true;
      try{
        const result=await workJson<{count:number}>('/api/internal-chat/unread',organizationId,{signal:abort.signal});
        if(!abort.signal.aborted)setSnapshot({organizationId,identityKey,count:Math.max(0,result.count)});
      }catch(e){
        if(!abort.signal.aborted&&e instanceof ApiError&&[401,403,404].includes(e.status))setSnapshot({organizationId,identityKey,count:0});
      }finally{
        loading=false;
        if(!abort.signal.aborted){const delay=again?0:5000;again=false;timer=setTimeout(load,delay);}
      }
    };
    const refresh=()=>void load();
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    void load();window.addEventListener('hellow-internal-unread-changed',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
    return()=>{abort.abort();clearTimeout(timer);window.removeEventListener('hellow-internal-unread-changed',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
  },[organizationId,enabled,identityKey]);
  return enabled&&snapshot.organizationId===organizationId&&snapshot.identityKey===identityKey?snapshot.count:0;
}
