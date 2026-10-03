'use client';
import {RecordingIcon} from './RecordingIcon';
import {Play,RefreshCw,LoaderCircle} from 'lucide-react';
import {useEffect,useState} from 'react';
import {apiJson,jsonBody} from '@/lib/api';
interface Recording {id:string;status:string;durationSeconds:number;errorCode:string|null;canPlay:boolean;canRetry:boolean;}
const labels:Record<string,string>={PENDING:'양쪽 음성 연결 확인 중',STARTING:'녹음 준비 중',RECORDING:'통화 녹음 중',UPLOADING:'녹음 저장 중',READY:'저장 완료',FAILED:'녹음 생성 실패',NO_AUDIO:'연결된 음성이 없어 녹음 없음'};
export function RecordingPlayer({queueCode,active,accessKey,hideEmpty=false}:{queueCode:string;active:boolean;accessKey:string;hideEmpty?:boolean}){
  const [recording,setRecording]=useState<Recording|null>(null);const [loaded,setLoaded]=useState(false);const [error,setError]=useState('');const [source,setSource]=useState('');const [busy,setBusy]=useState(false);const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource('');setRecording(null);setLoaded(false);setError('');
    if(!active)return;
    const abort=new AbortController();
    const read=()=>apiJson<{recording?:Recording}>(`/api/recordings/queue/${encodeURIComponent(queueCode)}`,{signal:abort.signal}).then(r=>{if(!abort.signal.aborted){setRecording(r.recording||null);setLoaded(true);}}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    void read();const timer=setInterval(()=>void read(),10000);return()=>{abort.abort();clearInterval(timer);};
  },[queueCode,active,accessKey,refresh]);
  const play=async()=>{if(!recording||busy)return;setBusy(true);setError('');try{const view=await apiJson<{originalUrl?:string}>(`/api/recordings/${recording.id}/playback`,jsonBody({}));if(!view.originalUrl)throw new Error('녹음 재생 주소가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');setSource(view.originalUrl);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const retry=async()=>{if(!recording||busy)return;setBusy(true);setError('');try{await apiJson(`/api/recordings/${recording.id}/retry`,jsonBody({}));setRefresh(v=>v+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  if(hideEmpty&&(!loaded||!recording||recording.status==='NO_AUDIO'))return null;
  return <section className="recording-player border-b border-slate-700 px-3 py-2 text-sm" aria-label="통화 녹음"><div className="flex flex-wrap items-center gap-3"><RecordingIcon status={recording?.status}/><strong>통화 녹음</strong><span className="text-slate-300">{recording?labels[recording.status]||recording.status:loaded?'저장된 녹음 없음':'녹음 확인 중…'}</span>
    {recording?.status==='READY'&&(recording.canPlay?<button disabled={busy} className="inline-flex items-center justify-center min-h-11 min-w-11 rounded hover:bg-slate-700" title={busy?'준비 중':source?'재생 주소 갱신':'녹음 듣기'} aria-label={busy?'준비 중':source?'재생 주소 갱신':'녹음 듣기'} onClick={()=>void play()}>{busy?<LoaderCircle size={20} aria-hidden="true"/>:source?<RefreshCw size={20} aria-hidden="true"/>:<Play size={20} aria-hidden="true"/>}</button>:<span>이 녹음의 재생 권한이 없습니다.</span>)}
    {recording?.errorCode&&recording.canRetry&&['UPLOADING','STARTING','RECORDING'].includes(recording.status)&&<button disabled={busy} className="underline min-h-9" onClick={()=>void retry()}>저장 다시 시도</button>}</div>
    {error&&<p role="alert" className="text-amber-200 py-2">{error}<button className="ml-2 underline" onClick={()=>setRefresh(v=>v+1)}>다시 확인</button></p>}
    {active&&source&&recording?.canPlay&&<audio key={source} className="w-full mt-2" controls autoPlay preload="metadata" src={source} onError={()=>{setSource('');setError('녹음을 재생하지 못했습니다. 녹음 듣기를 다시 눌러 주세요.');}}/>}
  </section>;
}
