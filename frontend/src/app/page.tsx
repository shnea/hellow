'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SidebarGNB } from '@/components/SidebarGNB';
import { QueuePanel } from '@/components/QueuePanel';
import { ActiveWorkspace } from '@/components/ActiveWorkspace';
import { ContextActionPanel } from '@/components/ContextActionPanel';
import { ToastContainer, type ToastMessage } from '@/components/Toast';
import { ApiError, apiJson, jsonBody } from '@/lib/api';
import { documentText, readDocument } from '@/lib/editor-document';
import { customerProfile, queueItem, requestProfile, timelineItem, type ConsultationDraft, type ServerCustomer, type ServerQueue, type ServerTimeline } from '@/lib/workspace-data';
import { useCall } from '@/hooks/use-call';
import { CustomerRecordsWorkspace } from '@/components/CustomerRecordsWorkspace';
import { IncomingRequestModal } from '@/components/IncomingRequestModal';
import { savedClassification } from '@/lib/consultation-content';
import { WorkspaceSettings } from '@/components/WorkspaceSettings';
import './workspace.css';
import type { AgentStatus, CustomerProfile, QueueItem, TimelineItem } from '@/types';

interface Identity { subject: string; name: string; platformAdmin?: boolean; organizations: { id: string; name: string; publicCode?: string; permissions: string[];scopes?:Record<string,string>;teamId?:string }[]; }
interface SavedConsultation { categoryId?:string|null;categoryPath?:string|null;resultId?:string|null;resultName?:string; version: number; categoryMain: string; categorySub: string; tags: string; editorDocument: string; memo: string; }

export default function ConsultationWorkspacePage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const organizationRef=useRef('');
  const [identityRefresh,setIdentityRefresh]=useState(0);
  const identityGeneration=useRef(0);
  const [checkingIdentity,setCheckingIdentity]=useState(true);
  const refreshIdentity=useCallback(()=>{setCheckingIdentity(true);setIdentityRefresh(value=>value+1);},[]);
  const [authError, setAuthError] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const synchronized = useRef(false);
  const [customers, setCustomers] = useState<Record<string, CustomerProfile>>({});
  const [selected, setSelected] = useState('');
  const [currentTab,setCurrentTab]=useState('workspace');
  const [mobilePanel,setMobilePanel]=useState<'queue'|'editor'|'history'>('editor');
  const [dismissedIncoming,setDismissedIncoming]=useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineError, setTimelineError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const generation = useRef(0);
  const [drafts, setDrafts] = useState<Record<string, ConsultationDraft>>({});
  const versions = useRef<Record<string, number>>({});
  const organizationDrafts=useRef<Record<string,{drafts:Record<string,ConsultationDraft>;versions:Record<string,number>;ready:Record<string,boolean>;selected:string}>>({});
  const [draftReady, setDraftReady] = useState<Record<string, boolean>>({});
  const [draftError, setDraftError] = useState('');
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const call = useCall(activeCall);
  const durations=useRef<Record<string,number>>({});
  useEffect(()=>{if(activeCall&&call.duration>0)durations.current[activeCall]=call.duration;},[activeCall,call.duration]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('online');
  const [quotedText, setQuotedText] = useState('');
  const [followupTab, setFollowupTab] = useState<'visit' | 'callback' | 'transfer' | 'notification'>('visit');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const notify = useCallback((type: ToastMessage['type'], title: string, message: string) => {
    setToasts(prev => [...prev.slice(-4), { id: crypto.randomUUID(), type, title, message }]);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const current=++identityGeneration.current;
    apiJson<Identity>('/api/me', { signal: abort.signal }).then(me => {
      if(abort.signal.aborted||identityGeneration.current!==current) return;
      setIdentity(me); sessionStorage.setItem('hellow_agent_name', me.name);
      const prior = sessionStorage.getItem('hellow_organization_id');
      const org = me.organizations.find(o => o.id === prior) || me.organizations[0];
      if(org?.id!==organizationRef.current){
        setActiveCall(null);setQueue([]);queueRef.current=[];setCustomers({});setTimeline([]);setSelected('');
        setDrafts({});versions.current={};setDraftReady({});synchronized.current=false;
      }
      organizationRef.current=org?.id||'';
      if (org) { sessionStorage.setItem('hellow_organization_id', org.id); setOrganizationId(org.id);setAuthError('');
        void apiJson('/api/session/organization',{method:'POST',signal:abort.signal}).catch(()=>{}); }
      else {setOrganizationId('');setAuthError('로그인은 확인됐지만 활성 조직 권한이 없습니다. 조직을 등록했거나 권한을 배정받았다면 다시 확인해 주세요.');}
    }).catch(error => { if (!abort.signal.aborted&&identityGeneration.current===current) setAuthError(error.message); })
      .finally(()=>{if(!abort.signal.aborted&&identityGeneration.current===current)setCheckingIdentity(false);});
    return () => abort.abort();
  }, [identityRefresh]);
  useEffect(()=>{
    const visible=()=>{if(document.visibilityState==='visible')refreshIdentity();};
    window.addEventListener('focus',refreshIdentity);document.addEventListener('visibilitychange',visible);
    return()=>{window.removeEventListener('focus',refreshIdentity);document.removeEventListener('visibilitychange',visible);};
  },[refreshIdentity]);
  useEffect(() => {
    if (!organizationId) return;
    const current = ++generation.current;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const me=await apiJson<Identity>('/api/me',{signal:abort.signal});
        const org=me.organizations.find(o=>o.id===organizationId);
        if(!org)throw new ApiError(403,'이 조직의 접근 권한이 회수되었습니다.');
        const permitted=(permission:string)=>org.permissions.includes(permission);
        const [items, profiles] = await Promise.all([
          permitted('queue:read')?apiJson<ServerQueue[]>('/api/queue', { signal: abort.signal }):Promise.resolve([]),
          permitted('customer:read')?apiJson<ServerCustomer[]>('/api/customers', { signal: abort.signal }):Promise.resolve([]),
        ]);
        if (abort.signal.aborted || generation.current !== current) return;
        setIdentity(me);
        const mapped = items.map(queueItem);
        if (synchronized.current) {
          const ids = new Set(queueRef.current.map(q => q.id));
          const incoming = mapped.filter(q => !ids.has(q.id) && q.status === 'WAITING');
          if (incoming.length) setDismissedIncoming(prev=>prev.filter(id=>mapped.some(q=>q.id===id)));
        }
        synchronized.current = true; queueRef.current = mapped; setQueue(mapped);
        setCustomers(Object.fromEntries(profiles.map(c => [c.code, customerProfile(c)])));
        setSelected(previous => previous || mapped[0]?.id || '');
        const mine = mapped.find(q => q.type === 'call' && q.status === 'PROCESSING' && q.assignedSubject === identity?.subject && !q.callEnded);
        setActiveCall(permitted('queue:accept')?mine?.id||null:null); setQueueError('');setAuthError('');
      } catch (error) {
        if (!abort.signal.aborted && generation.current === current) {
          setQueueError(`${(error as Error).message} 표시 중인 정보는 마지막 조회 결과입니다.`);
          if (error instanceof ApiError && [401, 403].includes(error.status)) {
            setActiveCall(null); setQueue([]); queueRef.current = []; setCustomers({}); setTimeline([]); setAuthError(error.message);
          }
        }
      } finally {
        if (!abort.signal.aborted && generation.current === current) { setLoading(false); timer = setTimeout(poll, 2500); }
      }
    };
    void poll(); return () => { abort.abort(); clearTimeout(timer); };
  }, [organizationId, identity?.subject, refresh, notify]);
  const item = queue.find(q => q.id === selected);
  const selectedQueueCode=item?.id;
  const customerCode=item?.customerCode;
  const customer = item ? (item.customerCode ? customers[item.customerCode]||requestProfile(item) : requestProfile(item)) : null;
  const writable = item?.status === 'PROCESSING' && item.assignedSubject === identity?.subject;
  const can = (permission: string) => identity?.organizations.find(o => o.id === organizationId)?.permissions.includes(permission) || false;
  const currentOrganization=identity?.organizations.find(o=>o.id===organizationId);
  const accessKey=JSON.stringify([currentOrganization?.teamId,Object.entries(currentOrganization?.scopes||{}).sort(),currentOrganization?.permissions.slice().sort()]);
  const canReadConsultation=can('consultation:read');
  const unfinishedCall=queue.find(q=>q.type==='call'&&q.status==='PROCESSING'&&q.assignedSubject===identity?.subject);
  const receivingBlocked=unfinishedCall ? unfinishedCall.callEnded ? '후처리 중입니다. 상담 기록을 저장·완료한 뒤 새 통화를 수락할 수 있습니다.' : '통화 중입니다. 현재 통화와 후처리를 완료해 주세요.' : '';
  const incoming=queue.find(q=>q.status==='WAITING'&&!dismissedIncoming.includes(q.id));
  const showRecords=currentTab==='customers'||currentTab==='tickets'||!item;
  const selectQueue=(code:string)=>{setSelected(code);setCurrentTab('workspace');setMobilePanel('editor');};
  const linkCustomer = (code: string) => { if(code) void run(async () => {
    if(!item) return;
    await apiJson(`/api/customers/queue/${item.id}/link`,jsonBody({customerCode:code}));
    setQueue(prev=>prev.map(q=>q.id===item.id?{...q,customerCode:code}:q));setTimelineRefresh(v=>v+1);
    notify('success','기존 고객 연결','상담과 고객 이력을 연결했습니다.');
  }).catch(()=>{}); };
  useEffect(() => {
    // Drop context from the previous selection before loading this interaction.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeline([]); setTimelineError(''); setQuotedText('');
    if (!selectedQueueCode || !canReadConsultation) return;
    const abort = new AbortController();
    const path = customerCode ? `customer/${customerCode}` : `queue/${selectedQueueCode}`;
    apiJson<ServerTimeline[]>(`/api/timeline/${path}`, { signal: abort.signal })
      .then(rows => { if (!abort.signal.aborted) setTimeline(rows.map(timelineItem)); })
      .catch(error => { if (!abort.signal.aborted) setTimelineError(error.message); });
    return () => abort.abort();
  }, [selectedQueueCode, customerCode, timelineRefresh, organizationId, canReadConsultation, accessKey]);
  useEffect(() => {
    // Reset the prior interaction's load error; actual data arrives asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftError('');
    if (!selectedQueueCode || !writable || draftReady[selectedQueueCode]) return;
    const code = selectedQueueCode; const abort = new AbortController();
    apiJson<SavedConsultation | null>(`/api/consultations/queue/${code}`, { signal: abort.signal }).then(saved => {
      if (abort.signal.aborted) return;
      versions.current[code] = saved?.version || 0;
      if (saved) setDrafts(prev => ({ ...prev, [code]: { ...savedClassification(saved),resultId:saved.resultId??null,resultName:saved.resultName||'',
        status: 'in_progress', selectedTags: saved.tags?.split(',') || [], memo: saved.editorDocument || saved.memo || '' } }));
      setDraftReady(prev => ({ ...prev, [code]: true }));
    }).catch(error => { if (!abort.signal.aborted) setDraftError(error.message); });
    return () => abort.abort();
  }, [selectedQueueCode, writable, draftReady]);
  const run = async <T,>(action: () => Promise<T>):Promise<T> => {
    if (busyRef.current) throw new Error('이전 요청을 처리 중입니다.');
    busyRef.current = true; setBusy(true); generation.current += 1;
    try { return await action(); }
    catch (error) { notify('warning', '작업 실패 · 입력 보존', (error as Error).message); throw error; }
    finally { busyRef.current = false; setBusy(false); setRefresh(value => value + 1); }
  };
  const switchOrganization=async(id:string)=>{
    if(id===organizationId)return;
    try{await run(async()=>{
      const unfinished=queueRef.current.some(q=>q.type==='call'&&q.status==='PROCESSING'&&q.assignedSubject===identity?.subject);
      if(unfinished)throw new Error('현재 통화와 후처리를 완료한 뒤 조직을 변경해 주세요.');
      const me=await apiJson<Identity>('/api/me');
      const org=me.organizations.find(o=>o.id===id);
      if(!org)throw new Error('이 조직의 활성 권한이 없습니다. 조직 권한을 다시 확인해 주세요.');
      identityGeneration.current++;setCheckingIdentity(false);
      organizationDrafts.current[organizationId]={drafts,versions:{...versions.current},ready:draftReady,selected};
      const saved=organizationDrafts.current[id];
      // Invalidate old reads before changing the header used by all workspace requests.
      generation.current++;setActiveCall(null);setQueue([]);queueRef.current=[];setCustomers({});setTimeline([]);synchronized.current=false;
      setDrafts(saved?.drafts||{});versions.current=saved?.versions||{};setDraftReady(saved?.ready||{});setSelected(saved?.selected||'');
      organizationRef.current=id;sessionStorage.setItem('hellow_organization_id',id);setIdentity(me);setOrganizationId(id);setAuthError('');
      setTimelineRefresh(value=>value+1);setAgentStatus('online');
      notify('success','작업 조직 변경',`${org.name}의 권한과 데이터를 사용합니다.`);
    });}catch{/* run reports the failure while retaining the current organization. */}
  };
  const accept = (q: QueueItem) => { void run(async () => {
    const accepted = queueItem(await apiJson<ServerQueue>(`/api/queue/${q.id}/accept`, { method: 'POST' }));
    setQueue(previous => previous.map(item => item.id === accepted.id ? accepted : item));
    queueRef.current = queueRef.current.map(item => item.id === accepted.id ? accepted : item);
    setSelected(q.id); setCurrentTab('workspace');setMobilePanel('editor');setAgentStatus('busy');
    setDismissedIncoming(prev=>[...prev,q.id]);
    notify('success', '상담 수락', '배정이 확인됐습니다. 음성 연결 상태는 통화 표시에서 확인해 주세요.');
  }).catch(() => {}); };
  const endCall = () => { if (activeCall) void run(async () => {
    const ended=queueItem(await apiJson<ServerQueue>(`/api/queue/${activeCall}/end-call`, { method: 'POST' }));
    setQueue(prev=>prev.map(q=>q.id===ended.id?ended:q));queueRef.current=queueRef.current.map(q=>q.id===ended.id?ended:q);
    setActiveCall(null); setAgentStatus('busy');
    notify('info', '통화 종료', '상담 기록은 후처리 후 별도로 완료해 주세요.');
  }).catch(() => {}); };
  const save = async (data: ConsultationDraft & { isComplete: boolean }) => run(async () => {
    const code = selected;
    const saved = await apiJson<SavedConsultation>(`/api/consultations/queue/${code}`, jsonBody({ categoryMain: data.categoryMain,
      categorySub: data.categorySub,categoryId:data.categoryId??null,resultId:data.resultId??null, expectedVersion: versions.current[code] || 0, memo: documentText(data.memo), editorDocument: readDocument(data.memo),
      tags: data.selectedTags.join(','), callDurationSeconds: activeCall === code ? call.duration : durations.current[code]||0, complete: data.isComplete }, 'PUT'));
    versions.current[code] = saved.version; setTimelineRefresh(value => value + 1);
    if (data.isComplete) { setQueue(prev => prev.filter(q => q.id !== code)); queueRef.current = queueRef.current.filter(q => q.id !== code); setSelected(''); }
    notify('success', data.isComplete ? '상담 저장·완료' : '초안 저장', '서버 저장이 확인됐습니다.');
    const confirmed={...data,...savedClassification(saved),resultId:saved.resultId??null,resultName:saved.resultName||''};setDrafts(prev=>({...prev,[code]:confirmed}));return confirmed;
  });
  const changeCustomer = async (data: Partial<CustomerProfile>, register: boolean) => run(async () => {
    if (!customer || !item) return;
    const merged = { ...customer, ...data };
    const result = await apiJson<ServerCustomer>(register ? '/api/customers' : `/api/customers/${customer.id}`, jsonBody({ ...merged,
      customerType: merged.customerType.toUpperCase(), complainant: merged.isComplainant || false, queueCode: item.id }, register ? 'POST' : 'PUT'));
    setCustomers(prev => ({ ...prev, [result.code]: customerProfile(result) }));
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, customerCode: result.code } : q)); notify('success', '고객 정보 저장', '고객 ID와 상담 연결을 확인했습니다.');
  });
  const followup = (type: string, details: string) => { void run(async () => {
    const actionType = type.includes('방문') ? 'VISIT' : type.includes('콜백') ? 'CALLBACK' : null;
    if (!actionType) throw new Error('호전환·메시지 발송은 아직 연결되지 않았습니다.');
    await apiJson('/api/followup', jsonBody({ queueCode: selected, actionType, title: type, details }));
    setTimelineRefresh(value => value + 1); notify('success', '후속 요청 접수', '요청을 저장했습니다. 일정·담당자 배정은 아직 확정되지 않았습니다.');
  }).catch(() => {}); };
  if (!identity || authError || !organizationId) return <main className="min-h-screen bg-slate-950 text-slate-200 grid place-content-center gap-4 p-6">
    <h1 className="text-xl font-semibold">상담 워크스페이스</h1><p role="status" className="max-w-xl">{authError || '서버에서 로그인·조직 권한을 확인하고 있습니다.'}</p>
    {authError && <a href="/login" className="text-indigo-300 underline">로그인으로 돌아가기</a>}
    {identity&&<button disabled={checkingIdentity} onClick={refreshIdentity} className="text-left text-indigo-300 underline">{checkingIdentity?'권한 확인 중…':'조직 권한 다시 확인'}</button>}
    {identity?.platformAdmin && <a href="/admin/platform" className="text-indigo-300 underline">최고관리자 화면으로 이동</a>}
  </main>;
  return <>{currentTab==='settings'&&<WorkspaceSettings organizations={identity.organizations} organizationId={organizationId} platformAdmin={Boolean(identity.platformAdmin)}
    blockedReason={receivingBlocked} busy={busy} onSwitch={switchOrganization} onBack={()=>{setCurrentTab('workspace');refreshIdentity();}}/>}
  <div className={`crm-shell flex h-dvh overflow-hidden bg-slate-950 text-slate-100 ${currentTab==='settings'?'workspace-settings-hidden':''}`}>
    <SidebarGNB agentName={identity.name} currentTab={currentTab} showSettings
      supportLink={identity.organizations.find(o=>o.id===organizationId)?.publicCode?`/support?org=${encodeURIComponent(identity.organizations.find(o=>o.id===organizationId)!.publicCode!)}`:undefined}
      onTabChange={tab=>{if(tab==='stats')notify('info','준비 중','통계 화면을 연결하고 있습니다.');else setCurrentTab(tab);}}
      agentStatus={unfinishedCall?'busy':agentStatus} onAgentStatusChange={setAgentStatus} />
    <div className="flex flex-1 flex-col min-w-0">
      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-sm"><span>{identity.organizations.find(o => o.id === organizationId)?.name} · {identity.name}</span>
        <span>{busy ? '서버 처리 중' : activeCall ? `통화 진행 중 · ${call.status === 'connected' ? '음성 연결됨' : call.status === 'error' ? '음성 연결 실패' : '연결 확인 중'}` : unfinishedCall?.callEnded ? '후처리 중 · 새 통화 수신 차단' : '진행 중인 통화 없음'}</span>
        {unfinishedCall && (showRecords || unfinishedCall.id !== selected) && <button className="text-indigo-300 underline" onClick={() => selectQueue(unfinishedCall.id)}>현재 상담으로 돌아가기</button>}</div>
      {call.error&&<p role="alert" className="p-3 text-amber-200">{call.error}</p>}
      <nav className="workspace-mobile-tabs flex gap-2 p-2 border-b border-slate-800" aria-label="상담 화면 전환">
        <button onClick={()=>{setCurrentTab('workspace');setMobilePanel('queue');}}>대기열 {queue.length}</button>
        <button onClick={()=>{setCurrentTab('workspace');setMobilePanel('editor');}}>편집기</button>
        <button onClick={()=>{setCurrentTab('workspace');setMobilePanel('history');}}>이력·후속 요청</button>
        <button onClick={()=>setCurrentTab('customers')}>고객·기록</button>
        <button onClick={()=>setCurrentTab('settings')}>설정</button>
      </nav>
      {queueError && <div role="alert" className="p-3 text-amber-200 bg-amber-950"><span>{queueError}</span><button className="ml-3 underline" onClick={() => setRefresh(v => v + 1)}>다시 조회</button></div>}
      <div className="workspace-layout flex flex-1 min-h-0">
        <div className={`queue-pane ${mobilePanel==='queue'&&!showRecords?'mobile-visible':''} ${showRecords?'records-active':''}`}>
          <QueuePanel queueItems={queue} selectedQueueId={selected} onSelectQueueItem={selectQueue} callBlocked={Boolean(receivingBlocked)} onAcceptCall={can('queue:accept') && !busy && !queueError ? accept : undefined} />
        </div>
        <CustomerRecordsWorkspace key={organizationId} active={showRecords} customers={Object.values(customers)} organizationId={organizationId} contentRefresh={identityRefresh} accessKey={accessKey} canRead={canReadConsultation} canWrite={can('consultation:write')&&!queueError} canEditCustomer={can('customer:write')&&!queueError}
          activeQueues={Object.fromEntries(queue.map(q=>[q.id,q.status||'']))} onCustomerSaved={c=>setCustomers(prev=>({...prev,[c.id]:c}))}/>
        {customer && item && !showRecords ? <div className="interaction-workspace flex flex-1 min-w-0 min-h-0"><div className={`interaction-editor flex flex-col flex-1 min-w-0 min-h-0 ${mobilePanel==='editor'?'mobile-visible':''}`}>
          {writable && !item.customerCode && can('customer:write') && <label className="p-2 text-sm text-slate-300">기존 고객 연결 (직원 확인)
            <select aria-label="기존 고객 연결" value="" disabled={busy || Boolean(queueError)} onChange={event=>linkCustomer(event.target.value)} className="ml-2 bg-slate-800 p-1 rounded">
              <option value="">고객 선택</option>{Object.values(customers).filter(c=>c.isRegistered).map(c=><option key={c.id} value={c.id}>{c.name} · {c.phoneNumber}</option>)}
            </select></label>}
          {!writable && <div className="px-4 py-3 text-sm bg-slate-800 flex flex-wrap items-center justify-between gap-3" role="status">
            <div><p className="font-semibold text-slate-100">상담 기록 · 읽기 전용</p>
              <p className="text-slate-300">{item.status === 'WAITING'
                ? '이 상담을 수락하면 에디터 입력·줄바꿈·첨부 기능을 사용할 수 있습니다.'
                : item.assignedAgent ? `${item.assignedAgent} 담당 상담입니다. 본인이 수락한 상담에서 기록을 작성할 수 있습니다.` : '완료된 상담은 이력에서 확인할 수 있습니다.'}</p></div>
            {item.status === 'WAITING' && can('queue:accept') && can('consultation:write') && <button type="button"
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
              disabled={busy || Boolean(queueError) || (item.type==='call'&&Boolean(receivingBlocked))} onClick={() => accept(item)}>
              {busy ? '수락 중…' : item.type === 'call' ? '수신 후 기록 작성' : '상담 수락 후 기록 작성'}
            </button>}
          </div>}
          {writable && !can('consultation:write') && <p role="status" className="px-4 py-3 text-sm bg-slate-800">상담 기록 작성 권한이 없습니다. 조직 관리자에게 권한을 요청해 주세요.</p>}
          {draftError && <p role="alert" className="p-3 text-amber-300">{draftError}<button className="ml-2 underline" onClick={() => {setDraftReady({});setRefresh(v=>v+1);}}>초안 다시 조회</button></p>}
          {writable && !draftReady[item.id] ? <p role="status" className="p-5">저장된 초안을 확인하고 있습니다.</p> : <ActiveWorkspace key={`${item.id}:${writable}`} customer={customer} queueCode={item.id} organizationId={organizationId} contentRefresh={identityRefresh}
            initialDraft={drafts[item.id]} onDraftChange={draft => setDrafts(prev => ({ ...prev, [item.id]: draft }))} readOnly={!writable || !can('consultation:write') || Boolean(queueError)} customerReadOnly={!can('customer:write')||customer.canEdit===false||Boolean(queueError)} busy={busy}
            callDuration={activeCall === item.id ? call.duration : 0} isCallActive={activeCall === item.id} mediaStatus={call.status} onMute={call.setMuted} onEndCall={endCall}
            onStartCall={() => notify('info', '발신 미지원', '현재는 고객이 요청한 웹 음성 상담을 수락할 수 있습니다.')} onOpenTransfer={() => setFollowupTab('transfer')}
            onSaveConsultation={save} onRegisterCustomer={data => changeCustomer(data, true)} onUpdateCustomer={data => changeCustomer(data, false)} quotedText={quotedText} onClearQuotedText={() => setQuotedText('')} />}
        </div><div className={`interaction-history flex flex-col w-96 shrink-0 min-h-0 ${mobilePanel==='history'?'mobile-visible':''}`}>
          {timelineError && <p role="alert" className="p-2 text-amber-300">{timelineError}<button className="ml-2 underline" onClick={() => setTimelineRefresh(v=>v+1)}>이력 다시 조회</button></p>}
          <ContextActionPanel key={item.id} timeline={timeline} customerName={customer.name} customerPhone={customer.phoneNumber} readOnly={!writable || !can('followup:write') || busy || Boolean(queueError)}
            onQuoteTimeline={setQuotedText} onAddFollowUpAction={followup} activeFollowUpTab={followupTab} />
        </div></div> : null}
        {loading&&<p className="sr-only" role="status">업무 데이터를 불러오고 있습니다.</p>}
      </div>
    </div>
  </div><ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    {incoming&&can('queue:accept')&&<IncomingRequestModal key={incoming.id} item={incoming} busy={busy} blocked={queueError||(incoming.type==='call'?receivingBlocked:'')} onAccept={()=>accept(incoming)} onDismiss={()=>setDismissedIncoming(prev=>[...prev,incoming.id])}/>}
  </>;
}
