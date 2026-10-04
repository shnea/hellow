'use client';
import {useState} from 'react';
import {Paperclip} from 'lucide-react';
import {workJson,type WorkFile} from '@/lib/team-collaboration';

export function WorkAttachment({file,path,organizationId}:{file:WorkFile;path:string;organizationId:string}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const open=async()=>{if(busy)return;setBusy(true);setError('');
    // Reserve a window within the click so the browser permits the asynchronous private ticket.
    const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
    try{const ticket=await workJson<{originalUrl?:string}>(`${path}/${encodeURIComponent(file.id)}/views`,organizationId);const url=ticket.originalUrl;
      if(!url||!/^https?:\/\//i.test(url))throw new Error('파일 원본 주소를 확인하지 못했습니다.');
      if(!tab)throw new Error('팝업을 허용한 뒤 다시 열어 주세요.');tab.location.replace(url);
    }catch(e){tab?.close();setError((e as Error).message);}finally{setBusy(false);}
  };
  return <span className="work-attachment"><button type="button" onClick={()=>void open()} disabled={busy}><Paperclip size={14}/><span>{file.name}</span><small>{(file.size/1024/1024).toFixed(1)}MB · {busy?'확인 중…':'원본 보기'}</small></button>{error&&<span role="alert" className="list-error">{error} 다시 눌러 주세요.</span>}</span>;
}
