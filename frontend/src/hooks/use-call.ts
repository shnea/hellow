'use client';
import { useEffect, useRef, useState } from 'react';
import { apiJson,jsonBody } from '@/lib/api';
import { LiveKitCallSession } from '@/lib/livekit';
import {confirmedTransfer,transferJson,type WorkTransfer} from '@/lib/work-transfer';

interface CallOptions {organizationId?:string;mediaIdentity?:string|null;transfer?:WorkTransfer|null;onTransferChanged?:(task:WorkTransfer)=>void;}
interface MediaToken {url:string;token:string;identity?:string;roomName?:string;}

export function useCall(queueCode: string | null,options:CallOptions={}) {
  const latest=useRef(options);useEffect(()=>{latest.current=options;},[options]);
  const mediaIdentity=options.mediaIdentity||'';const organizationId=options.organizationId||'';
  const session = useRef<LiveKitCallSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [restart,setRestart]=useState(0);
  useEffect(() => {
    // Synchronize the independent media session lifecycle when its queue changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDuration(0);
    setError('');
    if (!queueCode) { setStatus('idle'); return; }
    let active = true;
    const call = new LiveKitCallSession({ onConnected: () => active && setStatus('connected'),
      onDisconnected: () => active && setStatus('idle'), onError: err => {if(active){setError(err.message);setStatus('error');}} });
    session.current = call;
    setStatus('connecting');
    const abort = new AbortController();
    let release: (() => void) | undefined;
    const connect = async () => {
      if (!active) return;
      let preview=latest.current.transfer;let data:MediaToken;
      if(preview?.kind==='CALL'&&preview.queueCode===queueCode&&preview.status==='CONNECTING') {
        const response=await transferJson<{transfer:WorkTransfer;media:MediaToken|null}>(`/api/transfers/${preview.id}/media-token`,organizationId,{...jsonBody({expectedVersion:preview.version}),signal:abort.signal});
        if(!active)return;
        const checked=confirmedTransfer(response.transfer,organizationId,preview.consultationId,'CALL');
        if(checked.id!==preview.id||checked.queueCode!==queueCode||checked.targetMediaIdentity!==mediaIdentity)throw new Error('이관 연결 응답이 현재 요청과 다릅니다. 최신 상태를 다시 확인해 주세요.');
        preview=checked;latest.current.onTransferChanged?.(preview);
        if(response.media)data=response.media;
        else if(preview.status==='ACCEPTED')data=await apiJson<MediaToken>(`/api/queue/${queueCode}/token`,{method:'POST',signal:abort.signal});
        else throw new Error('통화 이관이 종료되었습니다. 기존 상담사가 통화를 계속 맡습니다.');
      }else data=await apiJson<MediaToken>(`/api/queue/${queueCode}/token`,{method:'POST',signal:abort.signal});
      if(data.identity&&mediaIdentity&&data.identity!==mediaIdentity)throw new Error('통화 담당 연결이 변경되었습니다. 최신 접수를 다시 조회해 주세요.');
      if(preview&&(data.identity!==mediaIdentity||data.roomName!==`${organizationId}-${queueCode}`))throw new Error('이관 통화의 연결 정보를 확인하지 못했습니다. 다시 조회해 주세요.');
      if(!active)return;
      await call.connect(data.url,data.token);
      if(!active)return;
      setStatus('connected');
      // Keep this exact room and its browser lease when CONNECTING becomes ACCEPTED.
      while(active&&preview?.status==='CONNECTING') {
        const value=await transferJson<WorkTransfer>(`/api/transfers/${preview.id}/confirm-media`,organizationId,{...jsonBody({expectedVersion:preview.version}),signal:abort.signal});
        if(!active)return;
        const checked=confirmedTransfer(value,organizationId,preview.consultationId,'CALL');
        if(checked.id!==preview.id||checked.queueCode!==queueCode||checked.targetMediaIdentity!==mediaIdentity)throw new Error('이관 연결 확인 응답이 현재 요청과 다릅니다.');
        preview=checked;latest.current.onTransferChanged?.(checked);
        if(value.status==='ACCEPTED')break;
        if(value.status!=='CONNECTING')throw new Error('통화 이관이 완료되지 않았습니다. 기존 상담사가 통화를 계속 맡습니다.');
        await new Promise<void>(resolve=>{
          const finish=()=>{clearTimeout(timer);abort.signal.removeEventListener('abort',finish);resolve();};
          const timer=setTimeout(finish,1000);abort.signal.addEventListener('abort',finish,{once:true});
        });
      }
    };
    // Hold one origin-wide lock for the full media lifecycle, including token acquisition.
    const start = navigator.locks
      ? navigator.locks.request('hellow-agent-audio', { ifAvailable: true }, async lock => {
          if (!active) return;
          if (!lock) throw new Error('다른 창에서 통화가 연결돼 있습니다. 그 창에서 통화를 진행해 주세요.');
          try { await connect(); await new Promise<void>(resolve => { release = resolve; if (!active) resolve(); }); }
          finally { call.disconnect(); }
        })
      : Promise.reject(new Error('통화 중복 연결 방지를 지원하는 최신 브라우저를 사용해 주세요.'));
    void start.catch(err => { if(active) { setError((err as Error).message); setStatus('error'); } });
    return () => { active = false; abort.abort(); release?.(); call.disconnect(); session.current = null; };
  }, [queueCode,mediaIdentity,organizationId,restart]);
  useEffect(() => {
    if (status !== 'connected') return;
    const timer = setInterval(() => setDuration(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);
  return { status, duration, error, retry:()=>setRestart(value=>value+1),setMuted: (muted: boolean) => session.current?.setMuted(muted) };
}
