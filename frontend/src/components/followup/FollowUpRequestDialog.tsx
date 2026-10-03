'use client';
import {useEffect,useRef,useState} from 'react';
import {FollowUpRequestForm} from './FollowUpRequestForm';
import type {FollowUp} from '@/lib/followup';
import '../consultation-history.css';
export function FollowUpRequestDialog({source,organizationId,identityKey,allowed,onClose,onCreated}:{source:{code:string;name:string}|null;organizationId:string;identityKey:string;allowed:boolean;onClose:()=>void;onCreated:(task:FollowUp)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [type,setType]=useState<'CALLBACK'|'VISIT'>('CALLBACK');
 useEffect(()=>{const el=dialog.current;if(source){if(!el?.open)el?.showModal();}else el?.close();},[source]);
 return <dialog ref={dialog} className="history-dialog followup-request-dialog" aria-label="콜백·방문 요청" onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClose={onClose}>
  <header><h2>콜백·방문 요청 · {source?.name}</h2><button autoFocus onClick={onClose}>닫기</button></header>
  {source&&<div className="overflow-auto p-4"><label className="flex gap-3 items-center mb-3">요청 종류<select className="bg-slate-800 p-2" value={type} onChange={e=>setType(e.target.value as 'CALLBACK'|'VISIT')}><option value="CALLBACK">콜백</option><option value="VISIT">방문</option></select></label>
  {(['CALLBACK','VISIT'] as const).map(kind=><div key={`${source.code}:${kind}`} hidden={kind!==type}><FollowUpRequestForm organizationId={organizationId} identityKey={identityKey} queueCode={source.code} actionType={kind} disabled={!allowed} onCreated={onCreated}/></div>)}</div>}
 </dialog>;
}
