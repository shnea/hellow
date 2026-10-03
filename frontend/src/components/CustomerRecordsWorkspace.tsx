'use client';
import { useEffect, useRef, useState } from 'react';
import { savedClassification } from '@/lib/consultation-content';
import { ActiveWorkspace } from './ActiveWorkspace';
import {CustomerHistoryLinker} from './CustomerHistoryLinker';
import { ApiError, apiJson, jsonBody } from '@/lib/api';
import { readConsultationDrafts, writeConsultationDrafts } from '@/lib/consultation-drafts';
import { documentText, readDocument } from '@/lib/editor-document';
import { customerProfile, type ServerQueue, type ServerCustomer, type ConsultationDraft } from '@/lib/workspace-data';
import type { CustomerProfile } from '@/types';
import {sameConsultationDraft} from '@/lib/work-transfer';
import {RecordingPlayer} from './RecordingPlayer';
import type {TransferSource} from './transfer/WorkTransferRequestDialog';

interface RecordData { customerName?:string;phoneNumber?:string;companyName?:string;customerType?:string;customerRegistered?:boolean;contactVersion?:number;contactEditable?:boolean; categoryId?:string|null;categoryPath?:string|null;resultId?:string|null;resultName?:string; id:number;version:number;customerCode:string|null;queueCode:string|null;categoryMain:string;categorySub:string;
  status:string;memo:string;editorDocument:string|null;tags:string;agentName:string;createdAt:string;editable?:boolean;processing?:boolean;currentAssigneeName?:string|null; }
interface Revision { id:number;actorName:string;changedAt:string;beforeDocument:string; }
const draft=(r:RecordData):ConsultationDraft=>({...savedClassification(r),resultId:r.resultId??null,resultName:r.resultName||'',status:r.status.toLowerCase(),memo:r.editorDocument||r.memo||'',selectedTags:r.tags?.split(',').filter(Boolean)||[]});

export function CustomerRecordsWorkspace({customers,organizationId,draftStorageKey,contentRefresh=0,recordRefresh=0,accessKey,canRead,canWrite,canEditCustomer,onCustomerSaved,active,activeQueues,canRequestFollowUp=false,onRequestFollowUp,focus,canTransfer=false,onRequestTransfer,historyMode=false,embedded=false,onReturn,onRecordSaved,returnLabel='현재 상담으로 돌아가기'}: {
  historyMode?:boolean;embedded?:boolean;onReturn?:()=>void;onRecordSaved?:()=>void;returnLabel?:string;
  customers:CustomerProfile[];organizationId:string;contentRefresh?:number;recordRefresh?:number;accessKey:string;canRead:boolean;canWrite:boolean;canEditCustomer:boolean;active:boolean;activeQueues:Record<string,string>;
  onCustomerSaved:(customer:CustomerProfile)=>void;canRequestFollowUp?:boolean;onRequestFollowUp?:(queueCode:string,name:string)=>void;
  focus?:{id:number;revision:number}|null;canTransfer?:boolean;onRequestTransfer?:(source:TransferSource)=>void;
  draftStorageKey?:string;
}) {
  const [selectedCustomer,setSelectedCustomer]=useState('');
  const [selected,setSelected]=useState<number|null>(null);
  const [page,setPage]=useState(0);const [hasMore,setHasMore]=useState(false);
  const [directRecordId,setDirectRecordId]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const [records,setRecords]=useState<RecordData[]>([]);
  const focusedRecord=records.find(r=>r.id===(directRecordId||selected));
  const customer:CustomerProfile|undefined=(directRecordId||historyMode)?customers.find(c=>c.id===focusedRecord?.customerCode)||{
    id:focusedRecord?.customerCode||`record:${focusedRecord?.id}`,name:focusedRecord?.customerName||'상담 고객',customerType:focusedRecord?.customerType==='CORPORATE'?'corporate':'individual',company:focusedRecord?.companyName||'',phoneNumber:focusedRecord?.phoneNumber||'',email:'',tier:'Standard',
    isRegistered:focusedRecord?.customerRegistered||false,lastContactDate:'',totalCalls:0,managerName:'',customerNotes:'',canEdit:!focusedRecord?.customerCode&&Boolean(focusedRecord?.contactEditable),
  }:customers.find(c=>c.id===selectedCustomer)||customers[0];
  const [drafts,setDrafts]=useState<Record<number,ConsultationDraft>>({});
  const [draftVersions,setDraftVersions]=useState<Record<number,number>>({});
  const [dirtyRecords,setDirtyRecords]=useState<Record<number,boolean>>({});
  const dirtyRef=useRef(dirtyRecords);
  const [cacheReady,setCacheReady]=useState(false);
  const [cacheError,setCacheError]=useState('');
  useEffect(()=>{dirtyRef.current=dirtyRecords;},[dirtyRecords]);
  useEffect(()=>{
    if(!draftStorageKey)return;
    try{
      const cached=readConsultationDrafts(draftStorageKey);
      if(cached){
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDrafts(cached.drafts);setDraftVersions(cached.versions);
        const dirty=Object.fromEntries(Object.keys(cached.drafts).map(id=>[id,true]));
        dirtyRef.current=dirty;setDirtyRecords(dirty);
        const id=Number(cached.selected);
        if(Number.isSafeInteger(id)&&id!==0){setDirectRecordId(id);setSelected(id);}
      }
      setCacheReady(true);
    }catch{setCacheError('보관된 상담 기록 초안을 읽지 못했습니다. 이 탭을 닫지 말고 저장 상태를 확인해 주세요.');}
  },[draftStorageKey]);
  useEffect(()=>{
    if(!draftStorageKey||!cacheReady)return;
    const unsaved=Object.fromEntries(Object.entries(drafts).filter(([id])=>dirtyRecords[Number(id)]));
    try{writeConsultationDrafts(draftStorageKey,{drafts:unsaved,versions:draftVersions,selected:selected&&unsaved[selected]?String(selected):Object.keys(unsaved)[0]||''});}
    catch{
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCacheError('브라우저에 초안을 보관하지 못했습니다. 화면을 닫거나 새로고침하기 전에 서버에 저장해 주세요.');
    }
  },[draftStorageKey,cacheReady,drafts,draftVersions,dirtyRecords,selected]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [mobilePanel,setMobilePanel]=useState<'list'|'editor'>('editor');
  const [revisions,setRevisions]=useState<Revision[]|null>(null);
  const [linking,setLinking]=useState(false);
  const requestId=useRef<string>('');
  const customerId=customer?.id;
  const listCustomerId=directRecordId||historyMode?'':customerId;
  useEffect(()=>{if(!focus)return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDirectRecordId(focus.id);setSelected(focus.id);setMobilePanel('editor');setNotice('');
  },[focus]);
  useEffect(()=>{
    if(!active||(!historyMode&&!directRecordId&&!listCustomerId)||!canRead) return;
    const abort=new AbortController();
    // A customer change clears the displayed list before the new customer's read completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setRecords([]);setError('');setRevisions(null);
    const read=historyMode&&!directRecordId?apiJson<{items:RecordData[];hasMore:boolean}>(`/api/consultations?page=${page}&search=${encodeURIComponent(search)}`,{signal:abort.signal}).then(result=>{if(!abort.signal.aborted)setHasMore(result.hasMore);return result.items;}):directRecordId?apiJson<RecordData>(`/api/consultations/${directRecordId}`,{signal:abort.signal}).then(row=>[row]):apiJson<RecordData[]>(`/api/consultations/customer/${listCustomerId}`,{signal:abort.signal});
    read.then(rows=>{
      if(abort.signal.aborted)return;
      setRecords(rows);setSelected(prior=>rows.some(r=>r.id===prior)?prior:rows[0]?.id??null);
      setDrafts(prev=>({...prev,...Object.fromEntries(rows.filter(r=>!dirtyRef.current[r.id]).map(r=>[r.id,draft(r)]))}));
      setDraftVersions(prev=>({...prev,...Object.fromEntries(rows.filter(r=>!dirtyRef.current[r.id]).map(r=>[r.id,r.version]))}));
    }).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[active,listCustomerId,directRecordId,focus?.revision,organizationId,refresh,recordRefresh,canRead,accessKey,historyMode,page,search]);
  const record=canRead?records.find(r=>r.id===selected):undefined;
  const ongoing=record?.processing?'PROCESSING':record?.queueCode ? activeQueues[record.queueCode] : undefined;
  const stale=Boolean(record&&draftVersions[record.id]!==undefined&&draftVersions[record.id]!==record.version);
  const create=async()=>{
    if(!customer||busy||directRecordId)return;setBusy(true);setError('');setNotice('');
    if(!requestId.current)requestId.current=crypto.randomUUID();
    try {
      const r=await apiJson<RecordData>('/api/consultations',jsonBody({customerCode:customer.id,requestId:requestId.current}));
      requestId.current='';setRecords(prev=>[r,...prev.filter(p=>p.id!==r.id)]);setDrafts(prev=>({...prev,[r.id]:draft(r)}));setDraftVersions(prev=>({...prev,[r.id]:r.version}));setSelected(r.id);setMobilePanel('editor');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const save=async(data:ConsultationDraft&{isComplete:boolean})=>{
    if(!record||busy)throw new Error('저장할 기록을 선택해 주세요.');setBusy(true);setError('');setNotice('');
    try {
      if(stale)throw new Error('최신 기록과 내 입력을 확인한 뒤 다시 적용해 주세요.');
      const r=await apiJson<RecordData>(record.id<0?`/api/consultations/queue/${record.queueCode}`:`/api/consultations/${record.id}`,jsonBody({categoryMain:data.categoryMain,categorySub:data.categorySub,categoryId:data.categoryId??null,resultId:data.resultId??null,
        expectedVersion:draftVersions[record.id]??record.version,memo:documentText(data.memo),editorDocument:readDocument(data.memo),tags:data.selectedTags.join(','),callDurationSeconds:0,complete:data.isComplete},'PUT'));
      setRecords(prev=>prev.map(p=>p.id===record.id?{...p,...r}:p));setSelected(r.id);if(directRecordId)setDirectRecordId(r.id);setRefresh(v=>v+1);setNotice('기록을 저장했습니다. 수정 전 내용은 변경 이력에 보존됩니다.');setRevisions(null);
      const confirmed=draft(r);setDrafts(prev=>({...prev,[r.id]:confirmed}));setDraftVersions(prev=>({...prev,[r.id]:r.version}));setDirtyRecords(prev=>({...prev,[record.id]:false,[r.id]:false}));onRecordSaved?.();return confirmed;
    }catch(e){
      setError((e as Error).message);
      if(e instanceof ApiError&&e.status===409)setRefresh(v=>v+1);
      throw e;
    }finally{setBusy(false);}
  };
  const updateCustomer=async(data:Partial<CustomerProfile>)=>{
    if(!customer||!canEditCustomer)throw new Error('고객 정보 수정 권한이 없습니다.');
    const merged={...customer,...data};
    if(!customer.isRegistered){
      if(!record?.queueCode)throw new Error('연락처를 변경할 접수를 찾지 못했습니다.');
      try{const q=await apiJson<ServerQueue>(`/api/queue/${record.queueCode}/contact`,jsonBody({expectedVersion:record.contactVersion,name:merged.name,phoneNumber:merged.phoneNumber,company:merged.company,customerType:merged.customerType.toUpperCase()},'PUT'));
        setRecords(prev=>prev.map(r=>r.id===record.id?{...r,customerName:q.customerName,phoneNumber:q.phoneNumber,companyName:q.companyName||'',contactVersion:q.version}:r));onRecordSaved?.();return;
      }catch(e){if(e instanceof ApiError&&e.status===409)setRefresh(v=>v+1);throw e;}
    }
    try{const r=await apiJson<ServerCustomer>(`/api/customers/${customer.id}`,jsonBody({...merged,customerType:merged.customerType.toUpperCase(),complainant:merged.isComplainant||false},'PUT'));onCustomerSaved(customerProfile(r));}
    catch(e){setError((e as Error).message);throw e;}
  };
  const loadRevisions=async()=>{if(!record)return;if(record.id<0){setRevisions([]);return;}try{setRevisions(await apiJson<Revision[]>(`/api/consultations/${record.id}/revisions`));}catch(e){setError((e as Error).message);}};
  const requestTransfer=()=>{
    if(!record||!onRequestTransfer||!canTransfer||!canWrite||record.editable===false||ongoing||busy||loading)return;
    if(stale){setError('최신 기록을 확인한 뒤 업무 이관을 요청해 주세요. 내 입력은 유지됩니다.');return;}
    if(!sameConsultationDraft(drafts[record.id]||draft(record),draft(record))){setError('변경한 내용을 먼저 저장한 뒤 업무 이관을 요청해 주세요.');return;}
    onRequestTransfer({id:record.id,version:record.version,name:customer?.name||'상담 기록',liveWork:false});
  };
  return <section hidden={!active} className={`customer-records flex flex-1 min-w-0 min-h-0 ${active?'':'!hidden'}`} aria-label="고객과 상담 기록">
    {!embedded&&<aside className={`records-directory ${mobilePanel==='list'?'mobile-visible':''} flex flex-col w-72 shrink-0 border-r border-slate-800 bg-slate-900 min-h-0`}>
      <button className="records-mobile-tabs p-3 bg-slate-800" onClick={()=>setMobilePanel('editor')}>편집기로 돌아가기</button>
      <h2 className="font-semibold p-4">{historyMode?'상담 이력':'고객·상담 이력'}</h2><input aria-label="고객 검색" placeholder="이름·회사·전화 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);if(historyMode)setDirectRecordId(null);}} className="mx-3 mb-3 p-2 rounded bg-slate-800"/>
      {!historyMode&&<div className="overflow-auto max-h-[35%] border-b border-slate-800">{customers.filter(c=>`${c.name} ${c.company} ${c.phoneNumber}`.toLowerCase().includes(search.toLowerCase())).map(c=><button key={c.id} aria-pressed={customerId===c.id} className={`w-full text-left p-3 ${customerId===c.id?'bg-indigo-950 text-indigo-100':'hover:bg-slate-800'}`} onClick={()=>{setDirectRecordId(null);setSelectedCustomer(c.id);setRecords([]);setSelected(null);requestId.current='';setNotice('');}}>
        <span className="block font-medium">{c.name}</span><span className="block text-xs text-slate-300">{c.company} · {c.phoneNumber}</span></button>)}{!customers.length&&<p className="p-4 text-slate-300">등록된 고객이 없습니다.</p>}</div>}
      <div className="p-3 flex items-center justify-between"><h3 className="text-sm font-semibold">상담 기록 {canRead?records.length:0}건</h3><button className="px-3 py-2 bg-indigo-700 rounded disabled:opacity-50" disabled={!canRead||!canWrite||!customer||busy||loading||Boolean(directRecordId)||historyMode} onClick={()=>void create()}>새 기록</button></div>
      <div className="overflow-auto flex-1">{!canRead?<p className="p-3" role="status">상담 기록 조회 권한이 없습니다.</p>:loading?<p className="p-3" role="status">기록 조회 중…</p>:records.map(r=><button key={r.id} aria-pressed={selected===r.id} className={`w-full p-3 text-left border-b border-slate-800 ${selected===r.id?'bg-slate-800':''}`} onClick={()=>{setSelected(r.id);setRevisions(null);setNotice('');setMobilePanel('editor');}}>
        {historyMode&&<><span className="block font-medium">{r.customerName||'상담 고객'} · {r.customerRegistered?'등록':'미등록'}</span><span className="block text-xs text-slate-300">{r.phoneNumber}</span></>}<span className="block text-sm font-semibold break-words">{savedClassification(r).categoryPath?.join(' › ')||r.categorySub}</span>{r.resultName&&<span className="block text-xs text-slate-300">결과 · {r.resultName}</span>}<span className="block text-xs text-slate-300 mt-1">{new Date(r.createdAt).toLocaleString('ko-KR')} · {r.agentName}</span>
        <span className="block text-xs text-slate-300 mt-1">{r.status==='COMPLETED'?'완료':r.status==='ESCALATED'?'에스컬레이션':'작성 중'}</span></button>)}{!loading&&!records.length&&<p className="p-3 text-sm text-slate-300">{historyMode?'조회된 상담 기록이 없습니다.':'이 고객의 기록이 없습니다. 새 기록을 작성할 수 있습니다.'}</p>}</div>
      {historyMode&&<div className="flex gap-3 p-3 items-center"><button disabled={page===0||loading} onClick={()=>{setPage(p=>p-1);setDirectRecordId(null);}}>이전</button><span>{page+1} 페이지</span><button disabled={!hasMore||loading} onClick={()=>{setPage(p=>p+1);setDirectRecordId(null);}}>다음</button></div>}
    </aside>}
    <div className={`records-editor flex flex-col flex-1 min-w-0 min-h-0 ${mobilePanel==='editor'?'mobile-visible':''}`}>
      {cacheError&&<p role="alert" className="p-3 text-amber-200">{cacheError}</p>}
      {error&&<p role="alert" className="p-3 text-amber-200">{error}<button className="ml-3 underline" onClick={()=>setRefresh(v=>v+1)}>최신 기록 다시 조회</button></p>}
      {notice&&<p role="status" className="p-3 text-emerald-200">{notice}</p>}
      {!loading&&Object.entries(dirtyRecords).filter(([id,dirty])=>dirty&&(!canRead||!records.some(r=>r.id===Number(id)))).map(([id])=><details key={id} className="p-3 text-sm bg-slate-900"><summary className="py-2">화면에 없는 기록 #{id} · 미저장 입력 보관</summary><label>내 입력 · 읽고 복사할 수 있습니다<textarea readOnly rows={5} value={documentText(drafts[Number(id)]?.memo||'')} className="w-full p-2 bg-slate-800"/></label></details>)}
      {record&&stale&&<div role="status" className="p-3 bg-slate-950 text-sm"><p>기록이 다른 작업에서 변경되었습니다. 내 입력은 편집기에 유지됩니다.</p><details><summary className="py-2 cursor-pointer">최신 서버 본문 확인</summary><p className="whitespace-pre-wrap">{documentText(record.editorDocument||record.memo)}</p></details>{canWrite&&record.editable!==false&&!ongoing&&<button disabled={busy||loading} className="underline py-2" onClick={()=>setDraftVersions(prev=>({...prev,[record.id]:record.version}))}>최신 버전에 내 입력 다시 적용 준비</button>}</div>}
      <div className="records-toolbar p-2 flex gap-2 items-center justify-between bg-slate-800 text-sm">
        {embedded?<button className="px-3 py-2 underline" onClick={onReturn}>{returnLabel}</button>:<button className="records-mobile-tabs px-2 rounded bg-slate-700" onClick={()=>setMobilePanel('list')}>고객·기록 목록</button>}
        <span className="truncate">{embedded&&record?`${new Date(record.createdAt).toLocaleString('ko-KR')} · 이전 상담 · `:''}{customer?.name}{record?ongoing?' · 처리 중':!canWrite||record.editable===false?' · 기록 읽기 전용':' · 기록 편집':''}</span>
        {record?.currentAssigneeName&&<span>현재 담당 · {record.currentAssigneeName}</span>}
        {customer?.isRegistered&&canRead&&canWrite&&canEditCustomer&&customer.canEdit!==false&&<button className="underline p-1 shrink-0" onClick={()=>setLinking(true)}>이전 이력 연결</button>}
        {record?.queueCode&&record.status==='COMPLETED'&&canRead&&canRequestFollowUp&&onRequestFollowUp&&<button disabled={busy||loading} className="underline p-1 shrink-0" onClick={()=>onRequestFollowUp(record.queueCode!,customer?.name||'상담 고객')}>콜백·방문 요청</button>}
        {record&&canTransfer&&canWrite&&record.editable!==false&&!ongoing&&onRequestTransfer&&<button disabled={busy||loading||stale} className="underline p-1 shrink-0" onClick={requestTransfer}>업무 이관 요청</button>}
        {record&&<button className="underline p-1 shrink-0" onClick={()=>void loadRevisions()}>변경 이력</button>}</div>
      {record?.queueCode&&<RecordingPlayer key={record.queueCode} queueCode={record.queueCode} active={active&&canRead} accessKey={accessKey}/>}
      {canRead&&revisions&&<div className="p-3 bg-slate-950 max-h-64 overflow-auto text-sm"><button className="underline mb-2" onClick={()=>setRevisions(null)}>변경 이력 닫기</button>{!revisions.length&&<p>변경 이력이 없습니다.</p>}{revisions.map(r=><details key={r.id} className="py-2"><summary>{new Date(r.changedAt).toLocaleString('ko-KR')} · {r.actorName}</summary><p className="whitespace-pre-wrap mt-2">{JSON.parse(r.beforeDocument).memo}</p></details>)}</div>}
      {record&&customer?<ActiveWorkspace key={`${organizationId}:${record.id}`} customer={customer} queueCode={record.id<0?record.queueCode!: `record-${record.id}`} organizationId={organizationId} contentRefresh={contentRefresh} initialDraft={drafts[record.id]} onDraftChange={d=>{setDrafts(prev=>({...prev,[record.id]:d}));setDirtyRecords(prev=>({...prev,[record.id]:!sameConsultationDraft(d,draft(record))}));}}
        readOnly={!canWrite||record.editable===false||Boolean(ongoing)||stale} customerReadOnly={!canEditCustomer||customer.canEdit===false} recordMode busy={busy} mediaStatus="idle" onMute={()=>undefined} callDuration={0} isCallActive={false} onEndCall={()=>{}} onStartCall={()=>{}} onOpenTransfer={()=>{}}
        onSaveConsultation={save} onRegisterCustomer={async()=>{throw new Error('고객 목록에서 등록된 고객을 선택해 주세요.');}} onUpdateCustomer={updateCustomer}/>
        :<div className="flex-1 grid place-content-center gap-3 p-6 text-slate-300" role="status"><p>{loading?'상담 기록을 불러오고 있습니다.':customer?`${customer.name} 고객의 기록을 선택하거나 새 기록을 작성해 주세요.`:'상담 기록을 선택해 주세요.'}</p>{customer&&!historyMode&&!embedded&&<button className="px-4 py-3 bg-indigo-700 rounded text-white disabled:opacity-50" disabled={!canWrite||busy||loading} onClick={()=>void create()}>새 상담 기록 작성</button>}</div>}
    </div>
    {linking&&active&&customer&&canRead&&canWrite&&canEditCustomer&&customer.canEdit!==false&&<CustomerHistoryLinker key={customer.id} customer={customer} onClose={()=>setLinking(false)} onChanged={()=>{setRefresh(v=>v+1);setRevisions(null);}}/>}
  </section>;
}
