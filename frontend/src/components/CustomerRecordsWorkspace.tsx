'use client';
import { useEffect, useRef, useState } from 'react';
import { ActiveWorkspace } from './ActiveWorkspace';
import { apiJson, jsonBody } from '@/lib/api';
import { documentText, readDocument } from '@/lib/editor-document';
import { customerProfile, type ServerCustomer, type ConsultationDraft } from '@/lib/workspace-data';
import type { CustomerProfile } from '@/types';

interface RecordData { id:number;version:number;customerCode:string;queueCode:string|null;categoryMain:string;categorySub:string;
  status:string;memo:string;editorDocument:string|null;tags:string;agentName:string;createdAt:string; }
interface Revision { id:number;actorName:string;changedAt:string;beforeDocument:string; }
const draft=(r:RecordData):ConsultationDraft=>({categoryMain:r.categoryMain,categorySub:r.categorySub,status:r.status.toLowerCase(),memo:r.editorDocument||r.memo||'',selectedTags:r.tags?.split(',').filter(Boolean)||[]});

export function CustomerRecordsWorkspace({customers,organizationId,canWrite,canEditCustomer,onCustomerSaved,active,activeQueues}: {
  customers:CustomerProfile[];organizationId:string;canWrite:boolean;canEditCustomer:boolean;active:boolean;activeQueues:Record<string,string>;
  onCustomerSaved:(customer:CustomerProfile)=>void;
}) {
  const [selectedCustomer,setSelectedCustomer]=useState('');
  const customer=customers.find(c=>c.id===selectedCustomer)||customers[0];
  const [search,setSearch]=useState('');
  const [records,setRecords]=useState<RecordData[]>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [drafts,setDrafts]=useState<Record<number,ConsultationDraft>>({});
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [mobilePanel,setMobilePanel]=useState<'list'|'editor'>('editor');
  const [revisions,setRevisions]=useState<Revision[]|null>(null);
  const requestId=useRef<string>('');
  const customerId=customer?.id;
  useEffect(()=>{
    if(!customerId) return;
    const abort=new AbortController();
    // A customer change clears the displayed list before the new customer's read completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setRecords([]);setError('');setRevisions(null);
    apiJson<RecordData[]>(`/api/consultations/customer/${customerId}`,{signal:abort.signal}).then(rows=>{
      if(abort.signal.aborted)return;
      setRecords(rows);setSelected(prior=>rows.some(r=>r.id===prior)?prior:rows[0]?.id??null);
      setDrafts(prev=>({...Object.fromEntries(rows.map(r=>[r.id,draft(r)])),...prev}));
    }).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[customerId,organizationId,refresh]);
  const record=records.find(r=>r.id===selected);
  const ongoing=record?.queueCode ? activeQueues[record.queueCode] : undefined;
  const create=async()=>{
    if(!customer||busy)return;setBusy(true);setError('');setNotice('');
    if(!requestId.current)requestId.current=crypto.randomUUID();
    try {
      const r=await apiJson<RecordData>('/api/consultations',jsonBody({customerCode:customer.id,requestId:requestId.current}));
      requestId.current='';setRecords(prev=>[r,...prev.filter(p=>p.id!==r.id)]);setDrafts(prev=>({...prev,[r.id]:draft(r)}));setSelected(r.id);setMobilePanel('editor');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const save=async(data:ConsultationDraft&{isComplete:boolean})=>{
    if(!record||busy)throw new Error('저장할 기록을 선택해 주세요.');setBusy(true);setError('');setNotice('');
    try {
      const r=await apiJson<RecordData>(`/api/consultations/${record.id}`,jsonBody({categoryMain:data.categoryMain,categorySub:data.categorySub,
        expectedVersion:record.version,memo:documentText(data.memo),editorDocument:readDocument(data.memo),tags:data.selectedTags.join(','),callDurationSeconds:0,complete:data.isComplete},'PUT'));
      setRecords(prev=>prev.map(p=>p.id===r.id?r:p));setNotice('기록을 저장했습니다. 수정 전 내용은 변경 이력에 보존됩니다.');setRevisions(null);
    }catch(e){setError((e as Error).message);throw e;}finally{setBusy(false);}
  };
  const updateCustomer=async(data:Partial<CustomerProfile>)=>{
    if(!customer||!canEditCustomer)throw new Error('고객 정보 수정 권한이 없습니다.');
    const merged={...customer,...data};
    try{const r=await apiJson<ServerCustomer>(`/api/customers/${customer.id}`,jsonBody({...merged,customerType:merged.customerType.toUpperCase(),complainant:merged.isComplainant||false},'PUT'));onCustomerSaved(customerProfile(r));}
    catch(e){setError((e as Error).message);throw e;}
  };
  const loadRevisions=async()=>{if(!record)return;try{setRevisions(await apiJson<Revision[]>(`/api/consultations/${record.id}/revisions`));}catch(e){setError((e as Error).message);}};
  return <section hidden={!active} className={`customer-records flex flex-1 min-w-0 min-h-0 ${active?'':'!hidden'}`} aria-label="고객과 상담 기록">
    <aside className={`records-directory ${mobilePanel==='list'?'mobile-visible':''} flex flex-col w-72 shrink-0 border-r border-slate-800 bg-slate-900 min-h-0`}>
      <button className="records-mobile-tabs p-3 bg-slate-800" onClick={()=>setMobilePanel('editor')}>편집기로 돌아가기</button>
      <h2 className="font-semibold p-4">고객·상담 이력</h2><input aria-label="고객 검색" placeholder="이름·회사·전화 검색" value={search} onChange={e=>setSearch(e.target.value)} className="mx-3 mb-3 p-2 rounded bg-slate-800"/>
      <div className="overflow-auto max-h-[35%] border-b border-slate-800">{customers.filter(c=>`${c.name} ${c.company} ${c.phoneNumber}`.toLowerCase().includes(search.toLowerCase())).map(c=><button key={c.id} aria-pressed={customerId===c.id} className={`w-full text-left p-3 ${customerId===c.id?'bg-indigo-950 text-indigo-100':'hover:bg-slate-800'}`} onClick={()=>{setSelectedCustomer(c.id);requestId.current='';setNotice('');}}>
        <span className="block font-medium">{c.name}</span><span className="block text-xs text-slate-300">{c.company} · {c.phoneNumber}</span></button>)}{!customers.length&&<p className="p-4 text-slate-300">등록된 고객이 없습니다.</p>}</div>
      <div className="p-3 flex items-center justify-between"><h3 className="text-sm font-semibold">상담 기록 {records.length}건</h3><button className="px-3 py-2 bg-indigo-700 rounded disabled:opacity-50" disabled={!canWrite||!customer||busy||loading} onClick={()=>void create()}>새 기록</button></div>
      <div className="overflow-auto flex-1">{loading?<p className="p-3" role="status">기록 조회 중…</p>:records.map(r=><button key={r.id} aria-pressed={selected===r.id} className={`w-full p-3 text-left border-b border-slate-800 ${selected===r.id?'bg-slate-800':''}`} onClick={()=>{setSelected(r.id);setRevisions(null);setNotice('');setMobilePanel('editor');}}>
        <span className="block text-sm font-semibold break-words">{r.categorySub}</span><span className="block text-xs text-slate-300 mt-1">{new Date(r.createdAt).toLocaleString('ko-KR')} · {r.agentName}</span>
        <span className="block text-xs text-slate-300 mt-1">{r.status==='COMPLETED'?'완료':r.status==='ESCALATED'?'에스컬레이션':'작성 중'}</span></button>)}{!loading&&!records.length&&<p className="p-3 text-sm text-slate-300">이 고객의 기록이 없습니다. 새 기록을 작성할 수 있습니다.</p>}</div>
    </aside>
    <div className={`records-editor flex flex-col flex-1 min-w-0 min-h-0 ${mobilePanel==='editor'?'mobile-visible':''}`}>
      {error&&<p role="alert" className="p-3 text-amber-200">{error}<button className="ml-3 underline" onClick={()=>setRefresh(v=>v+1)}>최신 기록 다시 조회</button></p>}
      {notice&&<p role="status" className="p-3 text-emerald-200">{notice}</p>}
      <div className="records-toolbar p-2 flex gap-2 items-center justify-between bg-slate-800 text-sm">
        <button className="records-mobile-tabs px-2 rounded bg-slate-700" onClick={()=>setMobilePanel('list')}>고객·기록 목록</button>
        <span className="truncate">{customer?.name}{record?ongoing?' · 처리 중':' · 기록 편집':''}</span>
        {record&&<button className="underline p-1 shrink-0" onClick={()=>void loadRevisions()}>변경 이력</button>}</div>
      {revisions&&<div className="p-3 bg-slate-950 max-h-64 overflow-auto text-sm"><button className="underline mb-2" onClick={()=>setRevisions(null)}>변경 이력 닫기</button>{!revisions.length&&<p>변경 이력이 없습니다.</p>}{revisions.map(r=><details key={r.id} className="py-2"><summary>{new Date(r.changedAt).toLocaleString('ko-KR')} · {r.actorName}</summary><p className="whitespace-pre-wrap mt-2">{JSON.parse(r.beforeDocument).memo}</p></details>)}</div>}
      {record&&customer?<ActiveWorkspace key={`${organizationId}:${record.id}`} customer={customer} queueCode={`record-${record.id}`} organizationId={organizationId} initialDraft={drafts[record.id]} onDraftChange={d=>setDrafts(prev=>({...prev,[record.id]:d}))}
        readOnly={!canWrite||Boolean(ongoing)} customerReadOnly={!canEditCustomer} recordMode busy={busy} mediaStatus="idle" onMute={()=>undefined} callDuration={0} isCallActive={false} onEndCall={()=>{}} onStartCall={()=>{}} onOpenTransfer={()=>{}}
        onSaveConsultation={save} onRegisterCustomer={async()=>{throw new Error('고객 목록에서 등록된 고객을 선택해 주세요.');}} onUpdateCustomer={updateCustomer}/>
        :<div className="flex-1 grid place-content-center gap-3 p-6 text-slate-300" role="status"><p>{loading?'상담 기록을 불러오고 있습니다.':customer?`${customer.name} 고객의 기록을 선택하거나 새 기록을 작성해 주세요.`:'등록된 고객이 없습니다.'}</p>{customer&&<button className="px-4 py-3 bg-indigo-700 rounded text-white disabled:opacity-50" disabled={!canWrite||busy||loading} onClick={()=>void create()}>새 상담 기록 작성</button>}</div>}
    </div>
  </section>;
}
