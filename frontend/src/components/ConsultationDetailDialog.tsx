'use client';
import {useEffect,useRef,type ComponentProps} from 'react';
import {CustomerRecordsWorkspace} from './CustomerRecordsWorkspace';
import './consultation-history.css';
type Props=ComponentProps<typeof CustomerRecordsWorkspace>&{open:boolean;onClose:()=>void;onQuote?:()=>void;quoteBusy?:boolean;quoteError?:string};
export function ConsultationDetailDialog({open,onClose,onQuote,quoteBusy,quoteError,...props}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;if(open&&props.active){if(!el?.open)el?.showModal();}else el?.close();},[open,props.active]);
 return <dialog ref={dialog} className="history-dialog" aria-label={props.readOnly?'상담 상세 · 읽기 전용':'상담 상세·수정'} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClose={onClose}>
   <header><h2>{props.readOnly?'상담 상세 · 읽기 전용':'상담 상세·수정'}</h2><div className="flex items-center gap-2">{onQuote&&<button disabled={quoteBusy} onClick={onQuote}>현재 상담에 인용</button>}<button autoFocus onClick={onClose}>닫기</button></div></header>
   {quoteError&&<p role="alert" className="history-error">{quoteError}</p>}
   {props.focus&&<CustomerRecordsWorkspace {...props} active={open&&props.active} embedded historyMode returnLabel="닫기" onReturn={onClose}/>}
 </dialog>;
}
