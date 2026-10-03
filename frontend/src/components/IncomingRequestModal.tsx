'use client';
import { useEffect, useRef } from 'react';
import { PhoneIncoming, Ticket } from 'lucide-react';
import type { QueueItem } from '@/types';

export function IncomingRequestModal({ item, blocked, busy, onAccept, onDismiss,onReject,onReceived }: {
  item: QueueItem; blocked: string; busy: boolean; onAccept: () => void; onDismiss: () => void;onReject:()=>void;onReceived:(id:string)=>void;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const offeredId=item.offer?.id;
  useEffect(()=>{const el=dialog.current;const prior=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();prior?.focus();};},[]);
  useEffect(()=>{if(offeredId)onReceived(offeredId);},[offeredId,onReceived]);
  return <dialog ref={dialog} className="incoming-request bg-slate-900 text-slate-100 rounded-2xl p-0 shadow-xl" aria-labelledby="incoming-title" onCancel={event=>{event.preventDefault();if(!busy)onDismiss();}}>
    <div className="p-6 sm:p-9 space-y-6">
      <div className="flex gap-4 items-center">{item.type==='call'?<PhoneIncoming size={40} className="text-emerald-400 shrink-0"/>:<Ticket size={40} className="text-indigo-300 shrink-0"/>}
        <h2 id="incoming-title" className="text-2xl sm:text-3xl font-bold">{item.type==='call'?'전화 상담이 들어왔습니다':'새 상담 요청이 도착했습니다'}</h2></div>
      <div><p className="text-2xl font-semibold break-words">{item.customerName}</p><p className="text-slate-300 mt-2">{item.companyName} {item.phoneNumber}</p>
        <p className="text-slate-300 mt-4 whitespace-pre-wrap break-words max-h-40 overflow-auto">{item.summary||'접수 내용 없음'}</p></div>
      {blocked&&<p role="status" className="text-amber-200">{blocked}</p>}
      {item.offer&&<p className="text-slate-300">본인에게 배정된 상담입니다. {new Date(item.offer.expiresAt).toLocaleTimeString('ko-KR')}까지 응답해 주세요.</p>}
      <div className="flex flex-wrap gap-3 justify-end"><button disabled={busy} className="rounded-lg px-4 py-3 bg-slate-800" onClick={onDismiss}>대기열에서 확인</button>
        <button disabled={busy||Boolean(blocked)} className="rounded-lg px-4 py-3 bg-slate-800" onClick={onReject}>상담 거절</button>
        <button className="rounded-lg px-6 py-3 bg-emerald-700 text-white font-semibold disabled:opacity-50" disabled={busy||Boolean(blocked)} onClick={onAccept}>{busy?'처리 중…':item.type==='call'?'통화 수락':'상담 수락'}</button></div>
    </div>
  </dialog>;
}
