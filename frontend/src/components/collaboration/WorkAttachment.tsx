'use client';
import {useEffect,useRef,useState} from 'react';
import {Paperclip} from 'lucide-react';
import {workJson,type WorkFile} from '@/lib/team-collaboration';

const imageTypes=new Set(['image/jpeg','image/png','image/gif','image/webp','image/avif','image/bmp']);
const privateImageUrl=(value?:string)=>value&&/^https?:\/\//i.test(value)?value:'';

export function PendingImagePreview({file}:{file:Blob}) {
  const [preview,setPreview]=useState('');
  useEffect(()=>{
    if(!imageTypes.has(file.type))return;
    let live=true;const url=URL.createObjectURL(file);
    void Promise.resolve().then(()=>{if(live)setPreview(url);});
    return()=>{live=false;URL.revokeObjectURL(url);};
  },[file]);
  if(!preview)return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="internal-image-pending" src={preview} alt="전송할 이미지 미리보기" onError={()=>setPreview('')}/>;
}

export function WorkAttachment({file,path,organizationId,previewImage=false,onLoad}:{file:WorkFile;path:string;organizationId:string;previewImage?:boolean;onLoad?:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [preview,setPreview]=useState(''),[previewError,setPreviewError]=useState(''),[retry,setRetry]=useState(0);
  const root=useRef<HTMLSpanElement>(null);
  const isImage=previewImage&&imageTypes.has(file.mime);
  useEffect(()=>{
    if(!isImage)return;
    const abort=new AbortController();let observer:IntersectionObserver|undefined;
    const load=async()=>{
      setPreview('');setPreviewError('');
      try{
        const ticket=await workJson<{thumbnailUrl?:string;previewUrl?:string;originalUrl?:string}>(`${path}/${encodeURIComponent(file.id)}/views`,organizationId,{signal:abort.signal});
        const url=privateImageUrl(ticket.thumbnailUrl)||privateImageUrl(ticket.previewUrl)||privateImageUrl(ticket.originalUrl);
        if(!url)throw new Error('이미지 미리보기 주소를 확인하지 못했습니다.');
        if(!abort.signal.aborted)setPreview(url);
      }catch(e){if(!abort.signal.aborted)setPreviewError((e as Error).message);}
    };
    if(typeof IntersectionObserver==='undefined')void load();
    else {observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer?.disconnect();void load();}},{root:root.current?.closest('.chat-transcript')});if(root.current)observer.observe(root.current);}
    return()=>{abort.abort();observer?.disconnect();};
  },[isImage,file.id,path,organizationId,retry]);
  const open=async()=>{if(busy)return;setBusy(true);setError('');
    // Reserve a window within the click so the browser permits the asynchronous private ticket.
    const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
    try{const ticket=await workJson<{originalUrl?:string}>(`${path}/${encodeURIComponent(file.id)}/views`,organizationId);const url=ticket.originalUrl;
      if(!url||!/^https?:\/\//i.test(url))throw new Error('파일 원본 주소를 확인하지 못했습니다.');
      if(!tab)throw new Error('팝업을 허용한 뒤 다시 열어 주세요.');tab.location.replace(url);
    }catch(e){tab?.close();setError((e as Error).message);}finally{setBusy(false);}
  };
  return <span className="work-attachment" ref={root}>
    {isImage&&(preview?<button type="button" className="work-image-open" onClick={()=>void open()} disabled={busy} aria-label={`${file.name} 원본 이미지 보기`}>
      {/* PRIVATE tickets bypass the shared image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt={file.name} referrerPolicy="no-referrer" onLoad={onLoad} onError={()=>{setPreview('');setPreviewError('이미지를 불러오지 못했습니다.');}}/>
    </button>:previewError?<span className="work-image-error"><span role="alert">{previewError}</span><button type="button" onClick={()=>setRetry(v=>v+1)}>이미지 다시 불러오기</button></span>:<span role="status">이미지 미리보기 확인 중…</span>)}
    <button type="button" onClick={()=>void open()} disabled={busy}><Paperclip size={14}/><span>{file.name}</span><small>{(file.size/1024/1024).toFixed(1)}MB · {busy?'확인 중…':'원본 보기'}</small></button>{error&&<span role="alert" className="list-error">{error} 다시 눌러 주세요.</span>}
  </span>;
}
