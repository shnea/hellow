'use client';
import { useEffect, useRef, useState } from 'react';
import { apiJson,jsonBody } from '@/lib/api';
import { LiveKitCallSession } from '@/lib/livekit';
import {useCallClock} from './use-call-clock';
import {endCallOnPageExit} from '@/lib/call-exit';
import {confirmedTransfer,transferJson,type WorkTransfer} from '@/lib/work-transfer';

interface CallOptions {organizationId?:string;mediaIdentity?:string|null;callStartedAt?:string|null;callEndedAt?:string|null;transfer?:WorkTransfer|null;onTransferChanged?:(task:WorkTransfer)=>void;}
interface MediaToken {url:string;token:string;identity?:string;roomName?:string;}

export function useCall(queueCode: string | null,options:CallOptions={}) {
  const latest=useRef(options);useEffect(()=>{latest.current=options;},[options]);
  const mediaIdentity=options.mediaIdentity||'';const organizationId=options.organizationId||'';
  const session = useRef<LiveKitCallSession | null>(null);
  const lease = useRef<Promise<unknown> | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const duration=useCallClock(options.callStartedAt,options.callEndedAt);
  const [error, setError] = useState('');
  const [restart,setRestart]=useState(0);
  const [audioBlocked,setAudioBlocked]=useState(false);
  const [audioError,setAudioError]=useState('');
  const [isMuted,setIsMuted]=useState(false);
  const mutePreference=useRef({key:'',muted:false});
  useEffect(() => {
    // Synchronize the independent media session lifecycle when its queue changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError('');
    setAudioBlocked(false);setAudioError('');
    const muteKey=JSON.stringify([organizationId,queueCode]);
    if(mutePreference.current.key!==muteKey)mutePreference.current={key:muteKey,muted:false};
    setIsMuted(mutePreference.current.muted);
    if (!queueCode) { setStatus('idle'); return; }
    let active = true;
    let connected=false;
    const leave=()=>{if(active&&connected)endCallOnPageExit(`/api/queue/${queueCode}/end-call`,organizationId);};
    window.addEventListener('pagehide',leave);
    const call = new LiveKitCallSession({ onConnected: () => {if(active){setStatus('connected');setError('');}},
      onConnectionStateChanged: state=>{if(active&&state==='reconnecting')setStatus('connecting');},
      onAudioPlaybackChanged: allowed=>{if(active){setAudioBlocked(!allowed);if(allowed)setAudioError('');}},
      onDisconnected: () => {connected=false;if(active)setStatus('idle');}, onError: err => {if(active){setError(err.message);setStatus('error');}} });
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
      await call.connect(data.url,data.token,mutePreference.current.muted);
      if(!active)return;
      connected=true;
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
    const previousLease=lease.current;
    const start=(async()=>{
      // A retry in this hook must wait for its own previous lease to release.
      if(previousLease)await previousLease.catch(()=>{});
      if(!active)return;
      if(!navigator.locks)throw new Error('통화 중복 연결 방지를 지원하는 최신 브라우저를 사용해 주세요.');
      await navigator.locks.request('hellow-agent-audio', { ifAvailable: true }, async lock => {
          if (!active) return;
          if (!lock) throw new Error('다른 창에서 통화가 연결돼 있습니다. 그 창에서 통화를 진행해 주세요.');
          try { await connect(); await new Promise<void>(resolve => { release = resolve; if (!active) resolve(); }); }
          finally { call.disconnect(); }
        });
    })();
    lease.current=start;
    void start.catch(err => { if(active) { setError((err as Error).message); setStatus('error'); } });
    return () => { window.removeEventListener('pagehide',leave);active = false; abort.abort(); release?.(); call.disconnect(); session.current = null; };
  }, [queueCode,mediaIdentity,organizationId,restart]);
  const setMuted=async(muted:boolean)=>{
    const call=session.current;if(!call)throw new Error('음성 연결을 먼저 확인해 주세요.');
    await call.setMuted(muted);
    if(session.current===call){mutePreference.current.muted=muted;setIsMuted(muted);}
  };
  const startAudio=async()=>{
    const call=session.current;if(!call)return;
    try{await call.startAudio();if(session.current===call)setAudioError('');}
    catch{if(session.current===call)setAudioError('소리를 재생하지 못했습니다. 브라우저의 소리 권한을 확인한 뒤 다시 눌러 주세요.');}
  };
  return { status, duration, error, audioBlocked,audioError,startAudio,isMuted,retry:()=>setRestart(value=>value+1),setMuted };
}
