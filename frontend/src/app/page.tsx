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
import type { AgentStatus, CustomerProfile, QueueItem, TimelineItem } from '@/types';

interface Identity { subject: string; name: string; organizations: { id: string; name: string; permissions: string[] }[]; }
interface SavedConsultation { version: number; categoryMain: string; categorySub: string; tags: string; editorDocument: string; memo: string; }

export default function ConsultationWorkspacePage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [authError, setAuthError] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const synchronized = useRef(false);
  const [customers, setCustomers] = useState<Record<string, CustomerProfile>>({});
  const [selected, setSelected] = useState('');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineError, setTimelineError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const generation = useRef(0);
  const [drafts, setDrafts] = useState<Record<string, ConsultationDraft>>({});
  const versions = useRef<Record<string, number>>({});
  const [draftReady, setDraftReady] = useState<Record<string, boolean>>({});
  const [draftError, setDraftError] = useState('');
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const call = useCall(activeCall);
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
    apiJson<Identity>('/api/me', { signal: abort.signal }).then(me => {
      if(abort.signal.aborted) return;
      setIdentity(me); sessionStorage.setItem('hellow_agent_name', me.name);
      const prior = sessionStorage.getItem('hellow_organization_id');
      const org = me.organizations.find(o => o.id === prior) || me.organizations[0];
      if (org) { sessionStorage.setItem('hellow_organization_id', org.id); setOrganizationId(org.id); }
      else setAuthError('로그인은 확인됐지만 활성 조직 권한이 없습니다. 조직 관리자에게 가입·권한 배정을 요청해 주세요.');
    }).catch(error => { if (!abort.signal.aborted) setAuthError(error.message); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!organizationId) return;
    const current = ++generation.current;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const [items, profiles] = await Promise.all([
          apiJson<ServerQueue[]>('/api/queue', { signal: abort.signal }), apiJson<ServerCustomer[]>('/api/customers', { signal: abort.signal }),
        ]);
        if (abort.signal.aborted || generation.current !== current) return;
        const mapped = items.map(queueItem);
        if (synchronized.current) {
          const ids = new Set(queueRef.current.map(q => q.id));
          const incoming = mapped.filter(q => !ids.has(q.id) && q.status === 'WAITING');
          if (incoming.length) notify('info', '새 상담 요청', `${incoming.length}건의 상담 요청이 접수됐습니다.`);
        }
        synchronized.current = true; queueRef.current = mapped; setQueue(mapped);
        setCustomers(Object.fromEntries(profiles.map(c => [c.code, customerProfile(c)])));
        setSelected(previous => previous || mapped[0]?.id || '');
        const mine = mapped.find(q => q.type === 'call' && q.status === 'PROCESSING' && q.assignedSubject === identity?.subject && !q.callEnded);
        setActiveCall(mine?.id || null); setQueueError('');
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
  const customer = item ? (item.customerCode ? customers[item.customerCode] : requestProfile(item)) : null;
  const writable = item?.status === 'PROCESSING' && item.assignedSubject === identity?.subject;
  const can = (permission: string) => identity?.organizations.find(o => o.id === organizationId)?.permissions.includes(permission) || false;
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
    if (!selectedQueueCode) return;
    const abort = new AbortController();
    const path = customerCode ? `customer/${customerCode}` : `queue/${selectedQueueCode}`;
    apiJson<ServerTimeline[]>(`/api/timeline/${path}`, { signal: abort.signal })
      .then(rows => { if (!abort.signal.aborted) setTimeline(rows.map(timelineItem)); })
      .catch(error => { if (!abort.signal.aborted) setTimelineError(error.message); });
    return () => abort.abort();
  }, [selectedQueueCode, customerCode, timelineRefresh, organizationId]);
  useEffect(() => {
    // Reset the prior interaction's load error; actual data arrives asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftError('');
    if (!selectedQueueCode || !writable || draftReady[selectedQueueCode]) return;
    const code = selectedQueueCode; const abort = new AbortController();
    apiJson<SavedConsultation | null>(`/api/consultations/queue/${code}`, { signal: abort.signal }).then(saved => {
      if (abort.signal.aborted) return;
      versions.current[code] = saved?.version || 0;
      if (saved) setDrafts(prev => ({ ...prev, [code]: { categoryMain: saved.categoryMain, categorySub: saved.categorySub,
        status: 'in_progress', selectedTags: saved.tags?.split(',') || [], memo: saved.editorDocument || saved.memo || '' } }));
      setDraftReady(prev => ({ ...prev, [code]: true }));
    }).catch(error => { if (!abort.signal.aborted) setDraftError(error.message); });
    return () => abort.abort();
  }, [selectedQueueCode, writable, draftReady]);
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) throw new Error('이전 요청을 처리 중입니다.');
    busyRef.current = true; setBusy(true); generation.current += 1;
    try { await action(); }
    catch (error) { notify('warning', '작업 실패 · 입력 보존', (error as Error).message); throw error; }
    finally { busyRef.current = false; setBusy(false); setRefresh(value => value + 1); }
  };
  const accept = (q: QueueItem) => { void run(async () => {
    await apiJson<ServerQueue>(`/api/queue/${q.id}/accept`, { method: 'POST' }); setSelected(q.id); setAgentStatus('busy');
    notify('success', '상담 수락', '배정이 확인됐습니다. 음성 연결 상태는 통화 표시에서 확인해 주세요.');
  }).catch(() => {}); };
  const endCall = () => { if (activeCall) void run(async () => {
    await apiJson(`/api/queue/${activeCall}/end-call`, { method: 'POST' }); setActiveCall(null); setAgentStatus('online');
    notify('info', '통화 종료', '상담 기록은 후처리 후 별도로 완료해 주세요.');
  }).catch(() => {}); };
  const save = async (data: ConsultationDraft & { isComplete: boolean }) => run(async () => {
    const code = selected;
    const saved = await apiJson<SavedConsultation>(`/api/consultations/queue/${code}`, jsonBody({ categoryMain: data.categoryMain,
      categorySub: data.categorySub, expectedVersion: versions.current[code] || 0, memo: documentText(data.memo), editorDocument: readDocument(data.memo),
      tags: data.selectedTags.join(','), callDurationSeconds: activeCall === code ? call.duration : 0, complete: data.isComplete }, 'PUT'));
    versions.current[code] = saved.version; setTimelineRefresh(value => value + 1);
    if (data.isComplete) { setQueue(prev => prev.filter(q => q.id !== code)); queueRef.current = queueRef.current.filter(q => q.id !== code); setSelected(''); }
    notify('success', data.isComplete ? '상담 저장·완료' : '초안 저장', '서버 저장이 확인됐습니다.');
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
  </main>;
  return <div className="flex h-screen min-w-[1100px] overflow-hidden bg-slate-950 text-slate-100">
    <SidebarGNB agentName={identity.name} currentTab="workspace" onTabChange={() => notify('info', '준비 중', '현재 상담 워크스페이스를 먼저 제공합니다.')} agentStatus={agentStatus} onAgentStatusChange={setAgentStatus} />
    <div className="flex flex-1 flex-col min-w-0">
      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-sm"><span>{identity.organizations.find(o => o.id === organizationId)?.name} · {identity.name}</span>
        <span>{busy ? '서버 처리 중' : activeCall ? `통화 진행 중 · ${call.status === 'connected' ? '음성 연결됨' : call.status === 'error' ? '음성 연결 실패' : '연결 확인 중'}` : '진행 중인 통화 없음'}</span>
        {activeCall && activeCall !== selected && <button className="text-indigo-300 underline" onClick={() => setSelected(activeCall)}>현재 통화로 돌아가기</button>}</div>
      {queueError && <div role="alert" className="p-3 text-amber-200 bg-amber-950"><span>{queueError}</span><button className="ml-3 underline" onClick={() => setRefresh(v => v + 1)}>다시 조회</button></div>}
      <div className="flex flex-1 min-h-0">
        <QueuePanel queueItems={queue} selectedQueueId={selected} onSelectQueueItem={setSelected} onAcceptCall={can('queue:accept') && !busy && !queueError ? accept : undefined} />
        {customer && item ? <div className="flex flex-1 min-w-0"><div className="flex flex-col flex-1 min-w-0">
          {writable && !item.customerCode && can('customer:write') && <label className="p-2 text-sm text-slate-300">기존 고객 연결 (직원 확인)
            <select aria-label="기존 고객 연결" value="" disabled={busy || Boolean(queueError)} onChange={event=>linkCustomer(event.target.value)} className="ml-2 bg-slate-800 p-1 rounded">
              <option value="">고객 선택</option>{Object.values(customers).filter(c=>c.isRegistered).map(c=><option key={c.id} value={c.id}>{c.name} · {c.phoneNumber}</option>)}
            </select></label>}
          {!writable && <p className="px-4 py-2 text-sm bg-slate-800">참고 조회 · {item.assignedAgent ? `${item.assignedAgent} 담당` : '상담을 수락하면 기록을 작성할 수 있습니다.'}</p>}
          {draftError && <p role="alert" className="p-3 text-amber-300">{draftError}<button className="ml-2 underline" onClick={() => {setDraftReady({});setRefresh(v=>v+1);}}>초안 다시 조회</button></p>}
          {writable && !draftReady[item.id] ? <p role="status" className="p-5">저장된 초안을 확인하고 있습니다.</p> : <ActiveWorkspace key={`${item.id}:${writable}`} customer={customer} queueCode={item.id} organizationId={organizationId}
            initialDraft={drafts[item.id]} onDraftChange={draft => setDrafts(prev => ({ ...prev, [item.id]: draft }))} readOnly={!writable || !can('consultation:write') || Boolean(queueError)} busy={busy}
            callDuration={activeCall === item.id ? call.duration : 0} isCallActive={activeCall === item.id} mediaStatus={call.status} onMute={call.setMuted} onEndCall={endCall}
            onStartCall={() => notify('info', '발신 미지원', '현재는 고객이 요청한 웹 음성 상담을 수락할 수 있습니다.')} onOpenTransfer={() => setFollowupTab('transfer')}
            onSaveConsultation={save} onRegisterCustomer={data => changeCustomer(data, true)} onUpdateCustomer={data => changeCustomer(data, false)} quotedText={quotedText} onClearQuotedText={() => setQuotedText('')} />}
        </div><div className="flex flex-col w-96 shrink-0">
          {timelineError && <p role="alert" className="p-2 text-amber-300">{timelineError}<button className="ml-2 underline" onClick={() => setTimelineRefresh(v=>v+1)}>이력 다시 조회</button></p>}
          <ContextActionPanel key={item.id} timeline={timeline} customerName={customer.name} customerPhone={customer.phoneNumber} readOnly={!writable || !can('followup:write') || busy || Boolean(queueError)}
            onQuoteTimeline={setQuotedText} onAddFollowUpAction={followup} activeFollowUpTab={followupTab} />
        </div></div> : <main className="flex-1 grid place-content-center text-slate-400" role="status">{loading ? '대기열을 불러오고 있습니다.' : '상담 요청을 선택해 주세요.'}</main>}
      </div>
    </div><ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
  </div>;
}
