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
import { AgentStatusControl } from '@/components/AgentStatusControl';
import { AssignmentHistory } from '@/components/AssignmentHistory';
import {FollowUpWorkspace} from '@/components/followup/FollowUpWorkspace';
import {followUpJson,type FollowUp,type ActiveFollowUp} from '@/lib/followup';
import {agentStateLabels,type AgentView,type Availability,type AgentState} from '@/lib/agent-state';
import {WorkTransferWorkspace,IncomingWorkTransfer} from '@/components/transfer/WorkTransferWorkspace';
import {WorkTransferRequestDialog,type TransferSource} from '@/components/transfer/WorkTransferRequestDialog';
import {sameConsultationDraft,transferJson,transferLabels,type TransferDirection,type TransferPage,type WorkTransfer} from '@/lib/work-transfer';
import './workspace.css';
import './routing.css';
import type { AgentStatus, CustomerProfile, QueueItem, TimelineItem } from '@/types';

interface Identity { issuer?:string;subject: string; name: string; platformAdmin?: boolean; organizations: { id: string; name: string; publicCode?: string; permissions: string[];scopes?:Record<string,string>;teamId?:string }[]; }
interface SavedConsultation { id:number;status?:string;categoryId?:string|null;categoryPath?:string|null;resultId?:string|null;resultName?:string; version: number; categoryMain: string; categorySub: string; tags: string; editorDocument: string; memo: string; }
const savedDraft=(saved:SavedConsultation):ConsultationDraft=>({...savedClassification(saved),resultId:saved.resultId??null,resultName:saved.resultName||'',status:saved.status?.toLowerCase()||'in_progress',selectedTags:saved.tags?.split(',').filter(Boolean)||[],memo:saved.editorDocument||saved.memo||''});
interface HandoffBaseline {recordId:number;name:string;draft:ConsultationDraft;}

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
  const [customers, setCustomers] = useState<Record<string, CustomerProfile>>({});
  const [selected, setSelected] = useState('');
  const [currentTab,setCurrentTab]=useState('workspace');
  const [transferSource,setTransferSource]=useState<TransferSource|null>(null);
  const [transferFocus,setTransferFocus]=useState<{id:string;revision:number;direction?:TransferDirection}|null>(null);
  const [recordFocus,setRecordFocus]=useState<{id:number;revision:number}|null>(null);
  const transferRevision=useRef(0);
  const [receivedTransfers,setReceivedTransfers]=useState<WorkTransfer[]>([]);
  const [callHandoff,setCallHandoff]=useState<WorkTransfer|null>(null);
  const callHandoffRef=useRef<WorkTransfer|null>(null);
  useEffect(()=>{callHandoffRef.current=callHandoff;},[callHandoff]);
  const [dismissedTransfers,setDismissedTransfers]=useState<string[]>([]);
  const [transferStateError,setTransferStateError]=useState('');
  const [followUpFocus,setFollowUpFocus]=useState<{id:number;revision:number}|null>(null);
  const [followUpSource,setFollowUpSource]=useState<{code:string;name:string}|null>(null);
  const followUpRevision=useRef(0);
  const [activeFollowUp,setActiveFollowUp]=useState<ActiveFollowUp|null>(null);
  const activeFollowUpRef=useRef<ActiveFollowUp|null>(null);
  const [followUpStateError,setFollowUpStateError]=useState('');
  const [mobilePanel,setMobilePanel]=useState<'queue'|'editor'|'history'>('editor');
  const [dismissedOffers,setDismissedOffers]=useState<string[]>([]);
  const receivedOffer=useRef<string|null>(null);
  const markReceived=useCallback((id:string)=>{receivedOffer.current=id;},[]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineError, setTimelineError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const generation = useRef(0);
  const [drafts, setDrafts] = useState<Record<string, ConsultationDraft>>({});
  const [handoffBaselines,setHandoffBaselines]=useState<Record<string,HandoffBaseline>>({});
  const versions = useRef<Record<string, number>>({});
  const organizationDrafts=useRef<Record<string,{drafts:Record<string,ConsultationDraft>;versions:Record<string,number>;ready:Record<string,boolean>;selected:string;handoffs?:Record<string,HandoffBaseline>}>>({});
  const [draftReady, setDraftReady] = useState<Record<string, boolean>>({});
  const [draftError, setDraftError] = useState('');
  const [draftConflicts,setDraftConflicts]=useState<Record<string,SavedConsultation>>({});
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const updateCallTransfer=useCallback((task:WorkTransfer)=>{
    if(task.kind!=='CALL'||task.toSubject!==identity?.subject||task.toIssuer!==identity?.issuer)return;
    setCallHandoff(prior=>task.status==='CONNECTING'||task.status==='ACCEPTED'
      ?prior?.id===task.id&&prior.version===task.version&&prior.status===task.status?prior:task:null);
    if(task.status!=='CONNECTING')setRefresh(value=>value+1);
  },[identity?.subject,identity?.issuer]);
  const callTransfer=callHandoff?.organizationId===organizationId?callHandoff:receivedTransfers.find(t=>t.kind==='CALL'&&t.status==='CONNECTING'&&t.toSubject===identity?.subject&&t.toIssuer===identity?.issuer);
  const mediaCode=activeCall||callTransfer?.queueCode||null;
  const mediaIdentity=queue.find(q=>q.id===activeCall)?.mediaAgentIdentity
    ||(mediaCode===callTransfer?.queueCode?callTransfer?.targetMediaIdentity:null)||(activeCall?`agent-${identity?.subject}`:null);
  const call = useCall(mediaCode,{organizationId,mediaIdentity,transfer:callTransfer,onTransferChanged:updateCallTransfer});
  const durations=useRef<Record<string,number>>({});
  useEffect(()=>{if(activeCall&&call.duration>0)durations.current[activeCall]=call.duration;},[activeCall,call.duration]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [agentView,setAgentView]=useState<AgentView|null>(null);
  const agentRef=useRef<AgentView|null>(null);
  const [agentError,setAgentError]=useState('');
  const storeAgent=useCallback((view:AgentView|null)=>{agentRef.current=view;setAgentView(view);},[]);
  const [quotedText, setQuotedText] = useState('');
  const [followupTab] = useState<'visit' | 'callback' | 'transfer' | 'notification'>('visit');
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
        setTransferSource(null);setTransferFocus(null);setRecordFocus(null);setReceivedTransfers([]);setCallHandoff(null);setDismissedTransfers([]);setTransferStateError('');
        setDraftConflicts({});
        setHandoffBaselines({});
        setFollowUpFocus(null);setFollowUpSource(null);
        setActiveFollowUp(null);activeFollowUpRef.current=null;setFollowUpStateError('');
        setActiveCall(null);setQueue([]);queueRef.current=[];setCustomers({});setTimeline([]);setSelected('');
        setDrafts({});versions.current={};setDraftReady({});storeAgent(null);receivedOffer.current=null;setDismissedOffers([]);
      }
      organizationRef.current=org?.id||'';
      if (org) { sessionStorage.setItem('hellow_organization_id', org.id); setOrganizationId(org.id);setAuthError('');
        void apiJson('/api/session/organization',{method:'POST',signal:abort.signal}).catch(()=>{}); }
      else {setOrganizationId('');setAuthError('로그인은 확인됐지만 활성 조직 권한이 없습니다. 조직을 등록했거나 권한을 배정받았다면 다시 확인해 주세요.');}
    }).catch(error => { if (!abort.signal.aborted&&identityGeneration.current===current) setAuthError(error.message); })
      .finally(()=>{if(!abort.signal.aborted&&identityGeneration.current===current)setCheckingIdentity(false);});
    return () => abort.abort();
  }, [identityRefresh,storeAgent]);
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
        let followUpState:ActiveFollowUp|null=null;let followUpError='';
        if(permitted('followup:read'))try{
          followUpState=await followUpJson<ActiveFollowUp>('/api/followup/active',organizationId,{signal:abort.signal});
        }catch(error){followUpError=(error as Error).message;}
        let state:AgentView|null=null;let stateError='';
        if(permitted('queue:read')&&permitted('queue:accept'))try{
          state=await apiJson<AgentView>('/api/agents/me/heartbeat',{...jsonBody({receivedAttemptId:receivedOffer.current}),signal:abort.signal});
        }catch(error){
          if(error instanceof ApiError&&[401,403].includes(error.status))throw error;
          stateError=(error as Error).message;
          if(error instanceof ApiError&&error.status===409)try{state=await apiJson<AgentView>('/api/agents/me',{signal:abort.signal});}catch{/* Keep the independent state error visible; CRM reads continue. */}
        }
        let transfers:WorkTransfer[]=[];let transferError='';
        if(permitted('transfer:read'))try{
          const result=await transferJson<TransferPage>('/api/transfers?direction=RECEIVED&status=OFFERED&page=0',organizationId,{signal:abort.signal});transfers=result.items;
          for(const id of new Set([state?.workTransferId,callHandoffRef.current?.id].filter(Boolean)))
            if(!transfers.some(t=>t.id===id))transfers.unshift(await transferJson<WorkTransfer>(`/api/transfers/${id}`,organizationId,{signal:abort.signal}));
        }catch(error){transferError=(error as Error).message;}
        const [items, profiles] = await Promise.all([
          permitted('queue:read')?apiJson<ServerQueue[]>('/api/queue', { signal: abort.signal }):Promise.resolve([]),
          permitted('customer:read')?apiJson<ServerCustomer[]>('/api/customers', { signal: abort.signal }):Promise.resolve([]),
        ]);
        if (abort.signal.aborted || generation.current !== current) return;
        setIdentity(me);
        setReceivedTransfers(transfers);setTransferStateError(transferError);setDismissedTransfers(prev=>prev.filter(id=>transfers.some(t=>t.id===id)));
        setFollowUpStateError(followUpError);
        if(!followUpError){setActiveFollowUp(followUpState);activeFollowUpRef.current=followUpState;}
        storeAgent(state);setAgentError(stateError);
        if(state?.attemptId!==receivedOffer.current)receivedOffer.current=null;
        const mapped = items.map(queueItem);
        setDismissedOffers(prev=>prev.filter(id=>mapped.some(q=>q.offer?.id===id)));
        queueRef.current = mapped; setQueue(mapped);
        setCustomers(Object.fromEntries(profiles.map(c => [c.code, customerProfile(c)])));
        setSelected(previous => previous || mapped[0]?.id || '');
        const mine = mapped.find(q => q.type === 'call' && q.status === 'PROCESSING' && q.assignedSubject === identity?.subject && !q.callEnded);
        setCallHandoff(prior=>{
          if(!prior)return null;const current=transfers.find(t=>t.id===prior.id);
          if(current?.status==='CONNECTING')return current;
          // Queue, owner and Media Identity are adopted in the same render; no new room or lease.
          if(current?.status==='ACCEPTED'||prior.status==='ACCEPTED')return null;
          return current?null:prior;
        });
        setActiveCall(permitted('queue:accept')?mine?.id||null:null); setQueueError('');setAuthError('');
      } catch (error) {
        if (!abort.signal.aborted && generation.current === current) {
          setQueueError(`${(error as Error).message} 표시 중인 정보는 마지막 조회 결과입니다.`);
          setAgentError('상담 상태를 확인하지 못했습니다. 다시 조회한 뒤 수신해 주세요.');
          if (error instanceof ApiError && [401, 403].includes(error.status)) {
            setActiveCall(null);setCallHandoff(null); setQueue([]); queueRef.current = []; setCustomers({}); setTimeline([]); setAuthError(error.message);
          }
        }
      } finally {
        if (!abort.signal.aborted && generation.current === current) { setLoading(false); timer = setTimeout(poll, 2500); }
      }
    };
    void poll(); return () => { abort.abort(); clearTimeout(timer); };
  }, [organizationId, identity?.subject, refresh, notify,storeAgent]);
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
  const unfinishedInteraction=queue.find(q=>q.status==='PROCESSING'&&q.assignedSubject===identity?.subject);
  const receivingBlocked=unfinishedInteraction ? unfinishedInteraction.type==='call'&&unfinishedInteraction.callEnded ? '후처리 중입니다. 상담 기록을 저장·완료한 뒤 새 상담을 수락할 수 있습니다.' : '상담 중입니다. 현재 상담과 후처리를 완료해 주세요.' : agentView?.state==='TRANSFER_PENDING'?'상담 이관 응답 대기 중입니다. 요청을 처리한 뒤 새 상담 수신·조직 변경이 가능합니다.':activeFollowUp?.processing||agentView?.state==='FOLLOW_UP'?'후속 업무 처리 중입니다. 예약 업무를 종료한 뒤 새 상담을 수락할 수 있습니다.':followUpStateError?'후속 업무 상태를 확인하지 못했습니다. 다시 조회한 뒤 수신·조직 변경이 가능합니다.':'';
  const effectiveAgentState:AgentState|undefined=unfinishedInteraction?(unfinishedInteraction.type==='call'&&unfinishedInteraction.callEnded?'AFTER_CALL':'CALLING'):activeFollowUp?.processing?'FOLLOW_UP':agentView?.state;
  const sidebarStatus:AgentStatus=effectiveAgentState==='AWAY'?'away':effectiveAgentState==='OFFLINE'||!effectiveAgentState?'offline':effectiveAgentState==='AVAILABLE'?'online':'busy';
  const incoming=!receivingBlocked&&!agentError?queue.find(q=>q.status==='WAITING'&&q.canAccept===true&&q.offer&&q.offer.subject===identity?.subject&&!dismissedOffers.includes(q.offer.id)):undefined;
  const showFollowUps=currentTab==='followups';
  const showTransfers=currentTab==='transfers';
  const showRecords=!showFollowUps&&!showTransfers&&(currentTab==='customers'||currentTab==='tickets'||!item);
  const incomingTransfer=!showTransfers&&!transferSource&&!incoming&&currentTab!=='settings'?receivedTransfers.find(t=>t.status==='OFFERED'&&!dismissedTransfers.includes(t.id)&&(t.canAccept||t.canReject)):undefined;
  const selectQueue=(code:string)=>{setSelected(code);setCurrentTab('workspace');setMobilePanel('editor');};
  const linkCustomer = (code: string) => { if(code) void run(async () => {
    if(!item) return;
    const linked=await apiJson<ServerCustomer>(`/api/customers/queue/${item.id}/link`,jsonBody({customerCode:code}));
    if(linked.consultationVersion!==undefined)versions.current[item.id]=linked.consultationVersion;
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
      const hasLocal=Boolean(drafts[code])&&versions.current[code]!==undefined;
      if(hasLocal&&saved&&versions.current[code]!==saved.version)setDraftConflicts(prev=>({...prev,[code]:saved}));
      else if(!hasLocal){versions.current[code]=saved?.version||0;if(saved)setDrafts(prev=>({...prev,[code]:savedDraft(saved)}));}
      setDraftReady(prev => ({ ...prev, [code]: true }));
    }).catch(error => { if (!abort.signal.aborted) setDraftError(error.message); });
    return () => abort.abort();
  // Local input and its baseline are deliberately captured at read start; later typing never restarts this read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const unfinished=queueRef.current.some(q=>q.status==='PROCESSING'&&q.assignedSubject===identity?.subject);
      if(unfinished)throw new Error('현재 상담과 후처리를 완료한 뒤 조직을 변경해 주세요.');
      if(agentRef.current?.state==='TRANSFER_PENDING')throw new Error('이관 요청에 응답한 뒤 조직을 변경해 주세요.');
      if(activeFollowUpRef.current?.processing||agentRef.current?.state==='FOLLOW_UP'||followUpStateError)throw new Error('후속 업무 상태를 확인하고 처리 중인 업무를 종료한 뒤 조직을 변경해 주세요.');
      const me=await apiJson<Identity>('/api/me');
      const org=me.organizations.find(o=>o.id===id);
      if(!org)throw new Error('이 조직의 활성 권한이 없습니다. 조직 권한을 다시 확인해 주세요.');
      const state=agentRef.current;
      if(state&&can('queue:read')&&can('queue:accept')){
        const receiving=org.permissions.includes('queue:read')&&org.permissions.includes('queue:accept');
        const next=await apiJson<AgentView>('/api/agents/me/status',{...jsonBody({state:receiving?state.availability:'OFFLINE',expectedVersion:state.version},'PUT'),headers:{'Content-Type':'application/json','X-Organization-ID':receiving?id:organizationId}});
        storeAgent(receiving?next:null);
      }else storeAgent(null);
      identityGeneration.current++;setCheckingIdentity(false);
      organizationDrafts.current[organizationId]={drafts,versions:{...versions.current},ready:draftReady,selected,handoffs:handoffBaselines};
      const saved=organizationDrafts.current[id];
      // Invalidate old reads before changing the header used by all workspace requests.
      generation.current++;setActiveCall(null);setQueue([]);queueRef.current=[];setCustomers({});setTimeline([]);receivedOffer.current=null;setDismissedOffers([]);
      setFollowUpFocus(null);setFollowUpSource(null);
      setTransferSource(null);setTransferFocus(null);setRecordFocus(null);setReceivedTransfers([]);setCallHandoff(null);setDismissedTransfers([]);setTransferStateError('');
      setDraftConflicts({});
      setHandoffBaselines(saved?.handoffs||{});
      setActiveFollowUp(null);activeFollowUpRef.current=null;setFollowUpStateError('');
      setDrafts(saved?.drafts||{});versions.current=saved?.versions||{};setDraftReady(saved?.ready||{});setSelected(saved?.selected||'');
      organizationRef.current=id;sessionStorage.setItem('hellow_organization_id',id);setIdentity(me);setOrganizationId(id);setAuthError('');
      setTimelineRefresh(value=>value+1);setAgentError('');
      notify('success','작업 조직 변경',`${org.name}의 권한과 데이터를 사용합니다.`);
    });}catch{/* run reports the failure while retaining the current organization. */}
  };
  const changeAgent=(state:Availability)=>{void run(async()=>{
    const current=agentRef.current||await apiJson<AgentView>('/api/agents/me');
    const saved=await apiJson<AgentView>('/api/agents/me/status',jsonBody({state,expectedVersion:current.version},'PUT'));
    storeAgent(saved);setAgentError('');receivedOffer.current=null;
    notify('success','수신 상태 변경',agentStateLabels[saved.state]);
  }).catch(()=>{});};
  const accept = (q: QueueItem) => { void run(async () => {
    if(q.canAccept!==true||receivingBlocked||agentError)throw new Error('대기 상태와 본인 수신 배정을 먼저 확인해 주세요.');
    const accepted = queueItem(await apiJson<ServerQueue>(`/api/queue/${q.id}/accept`,jsonBody({attemptId:q.offer?.id??null})));
    setQueue(previous => previous.map(item => item.id === accepted.id ? accepted : item));
    queueRef.current = queueRef.current.map(item => item.id === accepted.id ? accepted : item);
    setSelected(q.id); setCurrentTab('workspace');setMobilePanel('editor');receivedOffer.current=null;
    notify('success', '상담 수락', accepted.type==='call'?'배정이 확인됐습니다. 음성 연결 상태는 통화 표시에서 확인해 주세요.':'배정이 확인됐습니다. 상담 기록을 작성해 주세요.');
  }).catch(() => {}); };
  const reject=(q:QueueItem)=>{void run(async()=>{
    if(!q.offer||q.canAccept!==true)throw new Error('본인에게 배정된 요청만 거절할 수 있습니다.');
    const id=q.offer.id;
    const state=await apiJson<AgentView>(`/api/queue/${q.id}/reject`,jsonBody({attemptId:id}));
    storeAgent(state);receivedOffer.current=null;setDismissedOffers(prev=>[...prev,id]);
    const clear=(rows:QueueItem[])=>rows.map(row=>row.offer?.id===id?{...row,offer:null,canAccept:false}:row);
    setQueue(clear);queueRef.current=clear(queueRef.current);
    notify('info','상담 거절','다음 가능한 상담사에게 배정합니다.');
  }).catch(()=>{});};
  const restartRouting=(q:QueueItem)=>{void run(async()=>{
    await apiJson(`/api/queue/${q.id}/restart-routing`,jsonBody({expectedVersion:q.version}));
    notify('success','배정 다시 시작','이전 배정 이력을 보존하고 다시 배정합니다.');
  }).catch(()=>{});};
  const endCall = () => { if (activeCall) void run(async () => {
    const ended=queueItem(await apiJson<ServerQueue>(`/api/queue/${activeCall}/end-call`, { method: 'POST' }));
    setQueue(prev=>prev.map(q=>q.id===ended.id?ended:q));queueRef.current=queueRef.current.map(q=>q.id===ended.id?ended:q);
    setActiveCall(null);
    notify('info', '통화 종료', '상담 기록은 후처리 후 별도로 완료해 주세요.');
  }).catch(() => {}); };
  const save = async (data: ConsultationDraft & { isComplete: boolean }) => run(async () => {
    const code = selected;
    if(draftConflicts[code])throw new Error('최신 서버 본문과 내 입력을 확인한 뒤 다시 적용해 주세요.');
    const saved = await apiJson<SavedConsultation>(`/api/consultations/queue/${code}`, jsonBody({ categoryMain: data.categoryMain,
      categorySub: data.categorySub,categoryId:data.categoryId??null,resultId:data.resultId??null, expectedVersion: versions.current[code] || 0, memo: documentText(data.memo), editorDocument: readDocument(data.memo),
      tags: data.selectedTags.join(','), callDurationSeconds: activeCall === code ? call.duration : durations.current[code]||0, complete: data.isComplete }, 'PUT'));
    versions.current[code] = saved.version; setTimelineRefresh(value => value + 1);
    setDraftConflicts(prev=>{const copy={...prev};delete copy[code];return copy;});
    if (data.isComplete) { setQueue(prev => prev.filter(q => q.id !== code)); queueRef.current = queueRef.current.filter(q => q.id !== code); setSelected(''); }
    notify('success', data.isComplete ? '상담 저장·완료' : '초안 저장', '서버 저장이 확인됐습니다.');
    const confirmed={...data,...savedClassification(saved),resultId:saved.resultId??null,resultName:saved.resultName||'',status:saved.status?.toLowerCase()||data.status};setDrafts(prev=>({...prev,[code]:confirmed}));
    setHandoffBaselines(prev=>prev[code]?{...prev,[code]:{...prev[code],draft:confirmed}}:prev);return confirmed;
  });
  const changeCustomer = async (data: Partial<CustomerProfile>, register: boolean) => run(async () => {
    if (!customer || !item) return;
    const merged = { ...customer, ...data };
    const result = await apiJson<ServerCustomer>(register ? '/api/customers' : `/api/customers/${customer.id}`, jsonBody({ ...merged,
      customerType: merged.customerType.toUpperCase(), complainant: merged.isComplainant || false, queueCode: item.id }, register ? 'POST' : 'PUT'));
    if(register&&result.consultationVersion!==undefined)versions.current[item.id]=result.consultationVersion;
    setCustomers(prev => ({ ...prev, [result.code]: customerProfile(result) }));
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, customerCode: result.code } : q)); notify('success', '고객 정보 저장', '고객 ID와 상담 연결을 확인했습니다.');
  });
  const followUpChanged=(task?:FollowUp)=>{if(task?.canProcess){const state={processing:task.status==='IN_PROGRESS',id:task.status==='IN_PROGRESS'?task.id:null};setActiveFollowUp(state);activeFollowUpRef.current=state;}setRefresh(v=>v+1);setTimelineRefresh(v=>v+1);};
  const openFollowUp=(id:number)=>{setFollowUpFocus({id,revision:++followUpRevision.current});setCurrentTab('followups');};
  const followUpCreated=(task:FollowUp)=>{setFollowUpSource(null);openFollowUp(task.id);followUpChanged();};
  const openTransfer=(id:string,direction?:TransferDirection)=>{setTransferFocus({id,revision:++transferRevision.current,direction});setDismissedTransfers(prev=>[...prev,id]);setCurrentTab('transfers');};
  const transferChanged=(task:WorkTransfer)=>{updateCallTransfer(task);setRefresh(v=>v+1);setTimelineRefresh(v=>v+1);setReceivedTransfers(prev=>prev.filter(t=>t.id!==task.id||task.status==='OFFERED'));};
  const transferCreated=(task:WorkTransfer)=>{setTransferSource(null);openTransfer(task.id,'SENT');transferChanged(task);notify(task.status==='OFFERED'?'success':'info','이관 접수 확인',transferLabels[task.status]);};
  const requestQueueTransfer=()=>{void run(async()=>{
    if(!item||!writable||!can('consultation:transfer')||!can('transfer:read'))throw new Error('본인 상담과 이관 권한을 확인해 주세요.');
    const saved=await apiJson<SavedConsultation|null>(`/api/consultations/queue/${item.id}`);
    if(!saved)throw new Error('상담 기록을 먼저 저장한 뒤 업무 이관을 요청해 주세요.');
    if(saved.version!==versions.current[item.id]){setDraftConflicts(prev=>({...prev,[item.id]:saved}));throw new Error('저장된 기록이 변경되었습니다. 내 입력을 보존하고 최신 기록을 확인해 주세요.');}
    if(drafts[item.id]&&!sameConsultationDraft(drafts[item.id],savedDraft(saved)))throw new Error('변경한 내용을 먼저 저장한 뒤 업무 이관을 요청해 주세요.');
    setHandoffBaselines(prev=>({...prev,[item.id]:{recordId:saved.id,name:customer?.name||'상담 기록',draft:savedDraft(saved)}}));
    setTransferSource({id:saved.id,version:saved.version,name:customer?.name||'상담 기록',liveWork:true,kind:item.type==='call'&&!item.callEnded?'CALL':'WORK'});
  }).catch(()=>{});};
  const openTransferRecord=(task:WorkTransfer)=>{void run(async()=>{
    const scoped=task.liveWork&&can('queue:read')?(await apiJson<ServerQueue[]>('/api/queue')).map(queueItem):queueRef.current;
    const live=task.queueCode?scoped.find(q=>q.id===task.queueCode&&q.status==='PROCESSING'&&q.assignedSubject===identity?.subject):undefined;
    if(live){setQueue(scoped);queueRef.current=scoped;setDraftReady(prev=>({...prev,[live.id]:false}));selectQueue(live.id);}
    else{setRecordFocus({id:task.consultationId,revision:++transferRevision.current});setCurrentTab('customers');}
  }).catch(()=>{});};
  if (!identity || authError || !organizationId) return <main className="min-h-screen bg-slate-950 text-slate-200 grid place-content-center gap-4 p-6">
    <h1 className="text-xl font-semibold">상담 워크스페이스</h1><p role="status" className="max-w-xl">{authError || '서버에서 로그인·조직 권한을 확인하고 있습니다.'}</p>
    {authError && <a href="/login" className="text-indigo-300 underline">로그인으로 돌아가기</a>}
    {identity&&<button disabled={checkingIdentity} onClick={refreshIdentity} className="text-left text-indigo-300 underline">{checkingIdentity?'권한 확인 중…':'조직 권한 다시 확인'}</button>}
    {identity?.platformAdmin && <a href="/admin/platform" className="text-indigo-300 underline">최고관리자 화면으로 이동</a>}
  </main>;
  return <>{currentTab==='settings'&&<WorkspaceSettings organizations={identity.organizations} organizationId={organizationId} platformAdmin={Boolean(identity.platformAdmin)}
    blockedReason={receivingBlocked} busy={busy} onSwitch={switchOrganization} onBack={()=>{setCurrentTab('workspace');refreshIdentity();}}/>}
  <div className={`crm-shell flex h-dvh overflow-hidden bg-slate-950 text-slate-100 ${currentTab==='settings'?'workspace-settings-hidden':''}`}>
    <SidebarGNB agentName={identity.name} currentTab={currentTab} showSettings showFollowups={can('followup:read')} showTransfers={can('transfer:read')}
      supportLink={identity.organizations.find(o=>o.id===organizationId)?.publicCode?`/support?org=${encodeURIComponent(identity.organizations.find(o=>o.id===organizationId)!.publicCode!)}`:undefined}
      onTabChange={tab=>{if(tab==='stats')notify('info','준비 중','통계 화면을 연결하고 있습니다.');else setCurrentTab(tab);}}
      agentStatus={sidebarStatus} statusLabel={effectiveAgentState?agentStateLabels[effectiveAgentState]:'상태 확인 중'} />
    <div className="flex flex-1 flex-col min-w-0">
      <div className="workspace-heading px-4 py-2 border-b border-slate-800 flex items-center justify-between text-sm"><span>{identity.organizations.find(o => o.id === organizationId)?.name} · {identity.name}</span>
        <span>{busy ? '서버 처리 중' : activeCall ? `통화 진행 중 · ${call.status === 'connected' ? '음성 연결됨' : call.status === 'error' ? '음성 연결 실패' : '연결 확인 중'}` : unfinishedCall?.callEnded ? '후처리 중 · 새 통화 수신 차단' : effectiveAgentState==='FOLLOW_UP'?'후속 업무 처리 중 · 새 상담 수신 차단':'진행 중인 통화 없음'}</span>
        {(activeFollowUp?.id||agentView?.followUpId)&&can('followup:read')&&<button className="text-indigo-300 underline" onClick={()=>openFollowUp((activeFollowUp?.id||agentView?.followUpId)!)}>처리 중인 예약으로 돌아가기</button>}
        {agentView?.workTransferId&&can('transfer:read')&&<button className="text-indigo-300 underline" onClick={()=>openTransfer(agentView.workTransferId!,'RECEIVED')}>응답 대기 이관 확인</button>}
        {unfinishedCall && (showRecords || unfinishedCall.id !== selected) && <button className="text-indigo-300 underline" onClick={() => selectQueue(unfinishedCall.id)}>현재 상담으로 돌아가기</button>}</div>
      {can('queue:read')&&can('queue:accept')&&<AgentStatusControl view={agentView} state={effectiveAgentState} organizationId={organizationId} busy={busy} error={agentError} onChange={changeAgent} onRetry={()=>setRefresh(v=>v+1)}/>}
      {callTransfer?.status==='CONNECTING'&&<div className="transfer-record-header" role="status"><p>통화 이관 · {call.status==='connected'?'음성 연결의 서버 확인 중':'마이크와 음성 연결 준비 중'} · 확인 전까지 기존 상담사가 맡습니다.</p><button onClick={()=>openTransfer(callTransfer.id,'RECEIVED')}>이관 상태·거절 확인</button></div>}
      {call.error&&<div role="alert" className="transfer-record-header text-amber-200"><p>{call.error}</p>{mediaCode&&<button onClick={call.retry}>음성 연결 다시 시도</button>}</div>}
      {followUpStateError&&<p role="alert" className="p-3 text-amber-200">{followUpStateError}<button className="ml-2 underline" onClick={()=>setRefresh(v=>v+1)}>후속 업무 상태 다시 조회</button></p>}
      {transferStateError&&<p role="alert" className="p-3 text-amber-200">이관 요청을 확인하지 못했습니다. {transferStateError}<button className="ml-2 underline" onClick={()=>setRefresh(v=>v+1)}>이관 요청 다시 조회</button></p>}
      <nav className="workspace-mobile-tabs flex gap-2 p-2 border-b border-slate-800" aria-label="상담 화면 전환">
        <button onClick={()=>{setCurrentTab('workspace');setMobilePanel('queue');}}>대기열 {queue.length}</button>
        <button onClick={()=>{setCurrentTab('workspace');setMobilePanel('editor');}}>편집기</button>
        <button onClick={()=>{setCurrentTab('workspace');setMobilePanel('history');}}>이력·후속 요청</button>
        <button onClick={()=>setCurrentTab('customers')}>고객·기록</button>
        {can('followup:read')&&<button onClick={()=>setCurrentTab('followups')}>예약</button>}
        {can('transfer:read')&&<button onClick={()=>setCurrentTab('transfers')}>상담 이관</button>}
        <button onClick={()=>setCurrentTab('settings')}>설정</button>
      </nav>
      {queueError && <div role="alert" className="p-3 text-amber-200 bg-amber-950"><span>{queueError}</span><button className="ml-3 underline" onClick={() => setRefresh(v => v + 1)}>다시 조회</button></div>}
      <FollowUpWorkspace key={`${organizationId}:${identity.subject}`} active={showFollowUps} organizationId={organizationId} identityKey={identity.subject} accessKey={accessKey}
        canRead={can('followup:read')} canWrite={can('followup:write')} focus={followUpFocus} source={followUpSource} onCreated={followUpCreated}
        onChanged={followUpChanged} onSourceClosed={()=>setFollowUpSource(null)}/>
      <WorkTransferWorkspace key={`${organizationId}:${identity.subject}`} active={showTransfers} organizationId={organizationId} accessKey={accessKey} canRead={can('transfer:read')} focus={transferFocus} onChanged={transferChanged} onOpenRecord={openTransferRecord}
        localInputs={Object.entries(handoffBaselines).filter(([code,base])=>drafts[code]&&!sameConsultationDraft(drafts[code],base.draft)&&!queue.some(q=>q.id===code&&q.assignedSubject===identity.subject)).map(([code,base])=>({code,recordId:base.recordId,name:base.name,text:documentText(drafts[code].memo)}))}/>
      <div className={`workspace-layout flex flex-1 min-h-0 ${showFollowUps||showTransfers?'workspace-main-hidden':''}`}>
        <div className={`queue-pane ${mobilePanel==='queue'&&!showRecords?'mobile-visible':''} ${showRecords?'records-active':''}`}>
          <QueuePanel queueItems={queue} selectedQueueId={selected} onSelectQueueItem={selectQueue} callBlocked={Boolean(receivingBlocked)||Boolean(agentError)} onAcceptCall={can('queue:accept') && !busy && !queueError ? accept : undefined}
            onReject={can('queue:accept')&&!busy&&!agentError?reject:undefined}
            assignmentHistory={item&&can('queue:read')?<AssignmentHistory key={item.id} item={item} busy={busy} canRestart={can('queue:accept')&&!queueError&&!agentError} onRestart={()=>restartRouting(item)}/>:undefined}/>
        </div>
        <CustomerRecordsWorkspace key={organizationId} active={showRecords} customers={Object.values(customers)} organizationId={organizationId} contentRefresh={identityRefresh} recordRefresh={timelineRefresh} accessKey={accessKey} canRead={canReadConsultation} canWrite={can('consultation:write')&&!queueError} canEditCustomer={can('customer:write')&&!queueError}
          canRequestFollowUp={can('followup:read')&&can('followup:write')} onRequestFollowUp={(code,name)=>{setFollowUpSource({code,name});setCurrentTab('followups');}}
          focus={recordFocus} canTransfer={can('consultation:transfer')&&can('transfer:read')} onRequestTransfer={setTransferSource}
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
              disabled={busy || Boolean(queueError) || Boolean(agentError) || Boolean(receivingBlocked) || item.canAccept!==true} onClick={() => accept(item)}>
              {busy ? '수락 중…' : item.type === 'call' ? '수신 후 기록 작성' : '상담 수락 후 기록 작성'}
            </button>}
          </div>}
          {writable && !can('consultation:write') && <p role="status" className="px-4 py-3 text-sm bg-slate-800">상담 기록 작성 권한이 없습니다. 조직 관리자에게 권한을 요청해 주세요.</p>}
          {draftError && <p role="alert" className="p-3 text-amber-300">{draftError}<button className="ml-2 underline" onClick={() => {setDraftReady({});setRefresh(v=>v+1);}}>초안 다시 조회</button></p>}
          {draftConflicts[item.id]&&writable&&<div className="p-3 bg-slate-900 text-sm" role="status"><p>저장된 기록이 변경되었습니다. 내 입력은 유지됩니다.</p><details><summary className="py-2">최신 서버 본문 확인</summary><p className="whitespace-pre-wrap">{documentText(draftConflicts[item.id].editorDocument||draftConflicts[item.id].memo)}</p></details><button disabled={busy} className="underline py-2" onClick={()=>{versions.current[item.id]=draftConflicts[item.id].version;setDraftConflicts(prev=>{const copy={...prev};delete copy[item.id];return copy;});}}>최신 버전에 내 입력 다시 적용 준비</button></div>}
          {writable&&can('consultation:transfer')&&can('transfer:read')&&<div className="transfer-record-header"><button disabled={busy||!draftReady[item.id]||Boolean(queueError)} onClick={requestQueueTransfer}>{item.type==='call'&&!item.callEnded?'통화 이관 요청':'업무 이관 요청'}</button><span className="text-sm text-slate-300">{item.type==='call'&&!item.callEnded?'음성 연결 확인까지 현재 통화를 유지합니다.':'변경한 내용은 먼저 저장해 주세요.'}</span></div>}
          {writable && !draftReady[item.id] ? <p role="status" className="p-5">저장된 초안을 확인하고 있습니다.</p> : <ActiveWorkspace key={`${item.id}:${writable}`} customer={customer} queueCode={item.id} organizationId={organizationId} contentRefresh={identityRefresh}
            initialDraft={drafts[item.id]} onDraftChange={draft => setDrafts(prev => ({ ...prev, [item.id]: draft }))} readOnly={!writable || !can('consultation:write') || Boolean(queueError)} customerReadOnly={!can('customer:write')||customer.canEdit===false||Boolean(queueError)} busy={busy}
            callDuration={activeCall === item.id ? call.duration : 0} isCallActive={activeCall === item.id} mediaStatus={call.status} onMute={call.setMuted} onEndCall={endCall}
            onStartCall={() => notify('info', '발신 미지원', '현재는 고객이 요청한 웹 음성 상담을 수락할 수 있습니다.')} onOpenTransfer={requestQueueTransfer} canTransfer={can('consultation:transfer')&&can('transfer:read')&&Boolean(draftReady[item.id])}
            onSaveConsultation={save} onRegisterCustomer={data => changeCustomer(data, true)} onUpdateCustomer={data => changeCustomer(data, false)} quotedText={quotedText} onClearQuotedText={() => setQuotedText('')} />}
        </div><div className={`interaction-history flex flex-col w-96 shrink-0 min-h-0 ${mobilePanel==='history'?'mobile-visible':''}`}>
          {timelineError && <p role="alert" className="p-2 text-amber-300">{timelineError}<button className="ml-2 underline" onClick={() => setTimelineRefresh(v=>v+1)}>이력 다시 조회</button></p>}
          <ContextActionPanel key={item.id} organizationId={organizationId} identityKey={identity.subject} queueCode={item.id} onFollowUpCreated={followUpCreated} onOpenFollowUps={()=>setCurrentTab('followups')} timeline={timeline} customerName={customer.name} customerPhone={customer.phoneNumber} readOnly={!writable || !can('followup:read') || !can('followup:write') || busy || Boolean(queueError)}
            onQuoteTimeline={setQuotedText} onAddFollowUpAction={()=>notify('info','준비 중','메시지 발송은 후속 작업입니다.')} activeFollowUpTab={followupTab}
            onRequestTransfer={requestQueueTransfer} transferDisabled={!writable||!can('consultation:transfer')||!can('transfer:read')||busy||Boolean(queueError)||!draftReady[item.id]} transferIsCall={item.type==='call'&&!item.callEnded}/>
        </div></div> : null}
        {loading&&<p className="sr-only" role="status">업무 데이터를 불러오고 있습니다.</p>}
      </div>
    </div>
  </div><ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    <WorkTransferRequestDialog key={`${organizationId}:${identity.issuer}:${identity.subject}`} source={transferSource} organizationId={organizationId} issuer={identity.issuer||''} subject={identity.subject} accessKey={accessKey} allowed={can('consultation:transfer')&&can('transfer:read')&&Boolean(identity.issuer)} onClose={()=>setTransferSource(null)} onCreated={transferCreated}/>
    {incomingTransfer&&can('transfer:read')&&<IncomingWorkTransfer key={incomingTransfer.id} task={incomingTransfer} onOpen={()=>openTransfer(incomingTransfer.id,'RECEIVED')} onDismiss={()=>setDismissedTransfers(prev=>[...prev,incomingTransfer.id])}/>}
    {!transferSource&&incoming&&can('queue:accept')&&<IncomingRequestModal key={incoming.offer!.id} item={incoming} busy={busy} blocked={queueError||agentError||receivingBlocked} onAccept={()=>accept(incoming)} onReject={()=>reject(incoming)} onReceived={markReceived}
      onDismiss={()=>{setDismissedOffers(prev=>[...prev,incoming.offer!.id]);setCurrentTab('workspace');setMobilePanel('queue');}}/>}
  </>;
}
