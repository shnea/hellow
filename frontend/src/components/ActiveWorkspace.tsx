'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  PauseCircle,
  PlayCircle,
  PhoneForwarded,
  Save,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Tag,
  FileText,
  Clock,
  UserPlus,
  UserCheck2,
  Edit3,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import { CustomerProfile, CustomerType } from '../types';
import { quickTags } from '../data/mockData';
import { ShneaConsultationEditor } from './ShneaConsultationEditor';
import { appendDocument, documentText } from '../lib/editor-document';
import { useConsultationContent } from '../hooks/use-consultation-content';
import { classify, type Classification } from '../lib/consultation-content';
import { ConsultationClassification } from './ConsultationClassification';
import { TemplatePicker } from './TemplatePicker';
import type { ConsultationDraft } from '../lib/workspace-data';

interface ActiveWorkspaceProps {
  customer: CustomerProfile;
  queueCode: string;
  organizationId: string;
  contentRefresh?:number;
  initialDraft?: ConsultationDraft;
  onDraftChange: (draft: ConsultationDraft) => void;
  readOnly?: boolean;
  customerReadOnly?: boolean;
  recordMode?: boolean;
  busy?: boolean;
  mediaStatus: 'idle' | 'connecting' | 'connected' | 'error';
  isMuted?: boolean;
  onMute: (muted: boolean) => Promise<void> | undefined;
  callDuration: number;
  isCallActive: boolean;
  onEndCall: () => void;
  onStartCall: () => void;
  onOpenTransfer: () => void;
  canTransfer?:boolean;
  onSaveConsultation: (data: ConsultationDraft & {isComplete:boolean}) => Promise<ConsultationDraft|void>;
  onRegisterCustomer: (data: {
    customerType: CustomerType;
    name: string;
    company: string;
    title: string;
    department: string;
    email: string;
    tier: 'VIP' | 'Gold' | 'Standard';
    customerNotes: string;
    isComplainant: boolean;
  }) => Promise<void>;
  onUpdateCustomer: (data: Partial<CustomerProfile>) => Promise<void>;
  quotedText?: string;
  onClearQuotedText?: () => void;
}

export const ActiveWorkspace: React.FC<ActiveWorkspaceProps> = ({
  customer, queueCode, organizationId, contentRefresh=0, initialDraft, onDraftChange, readOnly=false, customerReadOnly=readOnly, recordMode=false, busy=false, mediaStatus, onMute, isMuted=false,
  callDuration,
  isCallActive,
  onEndCall,
  onOpenTransfer,
  canTransfer=false,
  onSaveConsultation,
  onRegisterCustomer,
  onUpdateCustomer,
  quotedText,
  onClearQuotedText,
}) => {
  // Call controls state
  const [muting,setMuting]=useState(false);
  const isOnHold = false;

  const handleToggleMute = async () => {
    if(muting||mediaStatus!=='connected')return;
    setMuting(true);
    try { await onMute(!isMuted); }
    catch { setActionError('마이크 상태를 변경하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setMuting(false); }
  };
  // A media hold requires server signaling and both audio directions; mute is not hold.
  const handleToggleHold = () => setActionError('통화 보류는 아직 지원하지 않습니다. 음소거를 사용할 수 있습니다.');
  const handleEndCallAction = () => onEndCall();
  const [actionError, setActionError] = useState('');
  // Customer Info Card Editing/Registration state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  // Form states for Customer Info
  const [formType, setFormType] = useState<CustomerType>(customer.customerType || 'corporate');
  const [formName, setFormName] = useState(customer.name || '');
  const [formCompany, setFormCompany] = useState(customer.company || '');
  const [formTitle, setFormTitle] = useState(customer.title || '');
  const [formDepartment, setFormDepartment] = useState(customer.department || '');
  const [formEmail, setFormEmail] = useState(customer.email || '');
  const [formTier, setFormTier] = useState<'VIP' | 'Gold' | 'Standard'>(customer.tier || 'Standard');
  const [formNotes, setFormNotes] = useState(customer.customerNotes || '');
  const [formIsComplainant, setFormIsComplainant] = useState(customer.isComplainant || false);

  // Reset form when customer changes
  useEffect(() => {
    if(isEditingInfo) return;
    // Synchronize server profile changes while preserving an open editing form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormType(customer.customerType || 'corporate');
    setFormName(customer.name || '');
    setFormCompany(customer.company || (customer.customerType === 'individual' ? '개인 (일반)' : ''));
    setFormTitle(customer.title || (customer.customerType === 'individual' ? '일반 이용자' : ''));
    setFormDepartment(customer.department || '');
    setFormEmail(customer.email || '');
    setFormTier(customer.tier || 'Standard');
    setFormNotes(customer.customerNotes || '');
    setFormIsComplainant(customer.isComplainant || false);
  }, [customer, isEditingInfo]);

  // Consultation memo form state
  const content=useConsultationContent(organizationId,contentRefresh);
  const [classification,setClassification]=useState<Classification>(initialDraft||{categoryMain:'',categorySub:''});
  const effectiveClassification=useMemo(()=>classification.categoryId===undefined&&content.catalog
    ?classify(content.catalog.effective.categories,content.catalog.effective.categories.find(c=>c.active)!.id):classification,[classification,content.catalog]);
  const [resultId,setResultId]=useState<string|null>(initialDraft?.resultId||null);
  const [resultName,setResultName]=useState(initialDraft?.resultName||'');
  const [status, setStatus] = useState<'in_progress' | 'completed' | 'escalated'>(initialDraft?.status==='completed'?'completed':initialDraft?.status==='escalated'?'escalated':'in_progress');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialDraft?.selectedTags || []);
  const [memoText, setMemoText] = useState<string>(initialDraft?.memo || '');
  const [lastSavedTime, setLastSavedTime] = useState('이번 접속에서 저장하지 않음');
  const draftChangeRef = useRef(onDraftChange);
  useEffect(() => {draftChangeRef.current=onDraftChange;}, [onDraftChange]);
  useEffect(() => {
    if (!readOnly) draftChangeRef.current({...effectiveClassification,resultId,resultName,status,selectedTags,memo:memoText});
  }, [effectiveClassification,resultId,resultName,status,selectedTags,memoText,readOnly]);
  // Handle quoted text insertion from timeline
  useEffect(() => {
    if (quotedText) {
      // The quote is an external action, consumed once by this queue editor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!readOnly) setMemoText(prev => appendDocument(prev, `[인용된 과거 상담 이력]\n> ${quotedText}\n`));
      if (onClearQuotedText) onClearQuotedText();
    }
  }, [quotedText, onClearQuotedText, readOnly]);

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const insertTemplate=(body:string)=>setMemoText(prev=>appendDocument(prev,body));
  const handleSave = async (isComplete: boolean) => {
    if(readOnly || busy) return;
    setActionError('');
    try {
      if(effectiveClassification.categoryId===undefined)throw new Error('상담 분류 목록을 불러온 뒤 다시 저장해 주세요.');
      if(isComplete&&!resultId&&!(recordMode&&status==='completed'&&effectiveClassification.categoryId===null))throw new Error('상담 완료 전에 처리 결과를 선택해 주세요.');
      const confirmed=await onSaveConsultation({...effectiveClassification,resultId,resultName,status,selectedTags,memo:memoText,isComplete});
      setClassification(confirmed||effectiveClassification);
      if(confirmed){setResultId(confirmed.resultId||null);setResultName(confirmed.resultName||'');}
      if(isComplete)setStatus('completed');
      setLastSavedTime(new Date().toLocaleTimeString('ko-KR'));
    } catch(error) { setActionError((error as Error).message); }
  };
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('고객명을 입력해 주세요.');
      return;
    }
    try { await onRegisterCustomer({
      customerType: formType,
      name: formName.trim(),
      company: formType === 'individual' ? (formCompany.trim() || '개인 고객') : (formCompany.trim() || '미지정 회사'),
      title: formType === 'individual' ? (formTitle.trim() || '일반 이용자') : (formTitle.trim() || '담당자'),
      department: formType === 'individual' ? '' : formDepartment.trim(),
      email: formEmail.trim(),
      tier: formTier,
      customerNotes: formNotes.trim(),
      isComplainant: formIsComplainant,
    });
    setIsEditingInfo(false); } catch(error) { setActionError((error as Error).message); }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await onUpdateCustomer({
      customerType: formType,
      name: formName.trim() || customer.name,
      company: formType === 'individual' ? (formCompany.trim() || '개인 고객') : (formCompany.trim() || customer.company),
      title: formTitle.trim() || customer.title,
      department: formType === 'individual' ? '' : (formDepartment.trim() || customer.department),
      email: formEmail.trim() || customer.email,
      tier: formTier,
      customerNotes: formNotes.trim(),
      isComplainant: formIsComplainant,
    });
    setIsEditingInfo(false); } catch(error) { setActionError((error as Error).message); }
  };

  return (
    <main className="active-workspace flex-1 flex flex-col h-full bg-slate-900 min-w-0 min-h-0 select-none overflow-hidden">
      {actionError && <p role="alert" className="p-3 text-amber-200 bg-amber-950">{actionError}</p>}
      {/* 1. 상단 통화 컨트롤러 바 */}
      {!recordMode && <div
        className={`px-5 py-2.5 border-b flex items-center justify-between transition-colors ${
          isOnHold
            ? 'bg-amber-950/60 border-amber-800/80'
            : isCallActive
            ? 'bg-slate-950 border-slate-800'
            : 'bg-slate-950/40 border-slate-800/60'
        }`}
      >
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {isCallActive ? (
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOnHold ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isOnHold ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
            ) : (
              <span className="w-3 h-3 rounded-full bg-slate-600" />
            )}
            <span className="font-mono text-xl font-bold tracking-wider text-slate-100">
              {isCallActive ? formatTime(callDuration) : '대기 상태'}
            </span>
          </div>

          <div className="h-5 w-px bg-slate-800" />

          <div className="flex items-baseline space-x-2">
            <span className="text-sm font-semibold text-slate-200">
              {customer.isRegistered ? customer.name : '미등록 고객'}
            </span>
            <span className="text-xs text-slate-400 font-mono">{customer.phoneNumber}</span>

            {/* Customer Type / Registration / Complaint Badges */}
            {customer.isRegistered ? (
              customer.customerType === 'corporate' ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold">
                  기업 고객 (B2B)
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold">
                  개인 고객 (B2C)
                </span>
              )
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold animate-pulse">
                미등록 발신
              </span>
            )}

            {customer.isComplainant && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1 animate-pulse">
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                컴플레인 주의 고객
              </span>
            )}
          </div>

          {/* WebRTC LiveKit 음성 연결 상태 인디케이터 */}
          {isCallActive && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all">
              {mediaStatus === 'connected' ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  LiveKit 음성 연결됨
                </span>
              ) : mediaStatus === 'connecting' ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  음성 채널 연결 중...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  음성 대기
                </span>
              )}
            </div>
          )}

          {isOnHold && (
            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-semibold animate-pulse">
              통화 보류 중 (대기음 송출)
            </span>
          )}
          {isMuted && (
            <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-xs font-semibold">
              마이크 음소거
            </span>
          )}
        </div>

        {/* Call Action Buttons */}
        <div className="flex items-center space-x-2">
          {isCallActive ? (
            <>
              {/* Mute Button */}
              <button
                disabled={readOnly || busy || muting || mediaStatus!=='connected'}
                onClick={handleToggleMute}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isMuted
                    ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? '음소거됨' : '음소거'}</span>
              </button>

              {/* Hold Button */}
              <button
                disabled title="통화 보류 미지원"
                onClick={handleToggleHold}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isOnHold
                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {isOnHold ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                <span>{isOnHold ? '보류 해제' : '보류'}</span>
              </button>

              {/* Transfer Forward Button */}
              <button
                disabled={readOnly||busy||!canTransfer}
                onClick={onOpenTransfer}
                title="저장한 상담을 이관할 직원을 선택합니다."
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <PhoneForwarded className="w-4 h-4 text-indigo-400" />
                <span>호전환</span>
              </button>

              {/* End Call Button */}
              <button
                disabled={readOnly || busy}
                onClick={handleEndCallAction}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950 transition-all"
              >
                <PhoneOff className="w-4 h-4" />
                <span>통화 종료</span>
              </button>
            </>
          ) : (
            <button
              disabled
              title="전화 재발신은 아직 연동되지 않았습니다."
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>재발신 미연동</span>
            </button>
          )}
        </div>
      </div>}

      {/* 2. 고객 정보 영역 (기업/개인 구분, 등록 조회 / 미등록 표시 / 상담 중 즉시 등록) */}
      <div className="customer-info-section border-b border-slate-800/80 bg-slate-950/40 transition-all">
        {/* Header / Bar */}
        <div className="customer-info-header px-4 py-2 bg-slate-900/90 border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              {customer.isRegistered ? (
                <>
                  <UserCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    고객 정보 ({customer.customerType === 'corporate' ? '기업 B2B' : '개인 일반'})
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-300">미등록 고객 (신규 인입)</span>
                </>
              )}
            </span>

            {customer.isRegistered && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  customer.tier === 'VIP'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : customer.tier === 'Gold'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                ★ {customer.tier} 등급
              </span>
            )}

            {customer.isComplainant && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold">
                불만 민원 이력 있음
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {customer.isRegistered ? (
              !isEditingInfo ? (
                <button
                disabled={customerReadOnly || busy}
                  type="button"
                  onClick={() => {setIsEditingInfo(true);setIsInfoExpanded(true);}}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] flex items-center gap-1 border border-slate-700"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>정보 수정</span>
                </button>
              ) : (
                <button
                disabled={customerReadOnly || busy}
                  type="button"
                  onClick={() => setIsEditingInfo(false)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[11px] flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>수정 취소</span>
                </button>
              )
            ) : null}

            <button
              type="button"
              onClick={() => setIsInfoExpanded(!isInfoExpanded)}
              className="p-1 text-slate-400 hover:text-slate-200"
              title={isInfoExpanded ? '접기' : '펼치기'}
            >
              {isInfoExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Info Content */}
        {isInfoExpanded && (
          <div className="p-3.5 text-xs">
            {/* [케이스 1] 등록된 고객 - 단순 조회 모드 */}
            {customer.isRegistered && !isEditingInfo && (
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-400">고객 구분 / 고객명</span>
                  <p className="font-semibold text-slate-100 mt-0.5 flex items-center gap-1.5">
                    {customer.customerType === 'corporate' ? (
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>{customer.name}</span>
                    <span className="text-slate-400 font-normal">
                      {customer.title && `(${customer.title})`}
                    </span>
                  </p>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400">
                    {customer.customerType === 'corporate' ? '소속 회사 / 부서' : '고객 분류'}
                  </span>
                  <p className="font-semibold text-slate-200 mt-0.5 truncate">
                    {customer.company || (customer.customerType === 'individual' ? '개인 고객 (일반)' : '-')}
                    {customer.department && ` / ${customer.department}`}
                  </p>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400">연락처 / 이메일</span>
                  <p className="font-mono text-slate-200 mt-0.5 truncate">{customer.phoneNumber}</p>
                  <p className="font-mono text-[11px] text-slate-400 truncate">{customer.email || '-'}</p>
                </div>

                <div className="border-l border-slate-800 pl-3">
                  <span className="block text-[11px] text-slate-400">전담 관리 / 상담 이력</span>
                  <p className="text-slate-300 mt-0.5 truncate">{customer.managerName}</p>
                  <p className="text-[11px] text-slate-400">
                    최근 상담: {customer.lastContactDate} ({customer.totalCalls}회)
                  </p>
                </div>

                {customer.customerNotes && (
                  <div
                    className={`col-span-4 mt-1 p-2 rounded-lg border text-[11px] flex items-center gap-2 ${
                      customer.isComplainant
                        ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                        : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    {customer.isComplainant ? (
                      <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    ) : (
                      <span className="font-semibold text-indigo-400 flex-shrink-0">고객 메모:</span>
                    )}
                    <span>{customer.customerNotes}</span>
                  </div>
                )}
              </div>
            )}

            {/* [케이스 2] 등록된 고객 - 정보 수정 모드 */}
            {customer.isRegistered && isEditingInfo && (
              <form onSubmit={handleUpdateSubmit} className="space-y-2.5">
                {/* 고객 유형 선택 라디오 */}
                <div className="flex items-center space-x-4 pb-1 border-b border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">고객 유형:</span>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      disabled={customerReadOnly || busy}
                      type="radio"
                      name="editCustomerType"
                      checked={formType === 'corporate'}
                      onChange={() => setFormType('corporate')}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span className="text-xs text-slate-200">🏢 기업 고객 (B2B)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      disabled={customerReadOnly || busy}
                      type="radio"
                      name="editCustomerType"
                      checked={formType === 'individual'}
                      onChange={() => {
                        setFormType('individual');
                        if (!formCompany || formCompany === '미지정 회사') setFormCompany('개인 고객');
                      }}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span className="text-xs text-slate-200">👤 개인 / 일반 고객 (B2C)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer ml-auto">
                    <input
                      disabled={customerReadOnly || busy}
                      type="checkbox"
                      checked={formIsComplainant}
                      onChange={(e) => setFormIsComplainant(e.target.checked)}
                      className="text-rose-600 rounded focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-rose-400">⚠️ 컴플레인 / 주의 고객 지정</span>
                  </label>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">고객명</label>
                    <input
                      disabled={customerReadOnly || busy}
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {formType === 'corporate' ? '회사명' : '소속/분류'}
                    </label>
                    <input
                      disabled={customerReadOnly || busy}
                      type="text"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      placeholder={formType === 'individual' ? '개인 고객' : '회사명'}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {formType === 'corporate' ? '부서 / 직책' : '직업 / 호칭'}
                    </label>
                    <div className="flex gap-1">
                      {formType === 'corporate' ? (
                        <>
                          <input
                      disabled={customerReadOnly || busy}
                            type="text"
                            placeholder="부서"
                            value={formDepartment}
                            onChange={(e) => setFormDepartment(e.target.value)}
                            className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                          <input
                      disabled={customerReadOnly || busy}
                            type="text"
                            placeholder="직책"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </>
                      ) : (
                        <input
                      disabled={customerReadOnly || busy}
                          type="text"
                          placeholder="예: 일반 이용자"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">고객 등급</label>
                    <select
                      disabled={customerReadOnly || busy}
                      value={formTier}
                      onChange={(e) => setFormTier(e.target.value as 'VIP' | 'Gold' | 'Standard')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Standard">Standard (일반)</option>
                      <option value="Gold">Gold</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">이메일</label>
                    <input
                      disabled={customerReadOnly || busy}
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">고객 특이사항 / 컴플레인 메모</label>
                    <input
                      disabled={customerReadOnly || busy}
                      type="text"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="고객 성향, 민원 안건, 요구사항 등"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                disabled={customerReadOnly || busy}
                    type="button"
                    onClick={() => setIsEditingInfo(false)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    취소
                  </button>
                  <button
                disabled={customerReadOnly || busy}
                    type="submit"
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm shadow-indigo-950"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>고객 정보 저장</span>
                  </button>
                </div>
              </form>
            )}

            {/* [케이스 3] 미등록 고객 - 신규 고객 즉시 등록 폼 */}
            {!customer.isRegistered && (
              <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
                <div className="bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>
                      미등록 번호(<strong className="font-mono text-white">{customer.phoneNumber}</strong>)입니다.
                      기업 담당자 또는 일반 개인(컴플레인 민원 포함) 정보를 입력하여 즉시 등록할 수 있습니다.
                    </span>
                  </div>
                </div>

                {/* 고객 유형 선택 */}
                <div className="flex items-center space-x-4 pb-1 border-b border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-300">신규 등록 유형:</span>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      disabled={customerReadOnly || busy}
                      type="radio"
                      name="registerCustomerType"
                      checked={formType === 'corporate'}
                      onChange={() => setFormType('corporate')}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span className="text-xs text-slate-200">🏢 기업 고객 (B2B)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      disabled={customerReadOnly || busy}
                      type="radio"
                      name="registerCustomerType"
                      checked={formType === 'individual'}
                      onChange={() => {
                        setFormType('individual');
                        if (!formCompany) setFormCompany('개인 고객');
                      }}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span className="text-xs text-slate-200">👤 개인 / 일반 고객 (B2C)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer ml-auto">
                    <input
                      disabled={customerReadOnly || busy}
                      type="checkbox"
                      checked={formIsComplainant}
                      onChange={(e) => setFormIsComplainant(e.target.checked)}
                      className="text-rose-600 rounded focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-rose-400">⚠️ 컴플레인 / 불만 고객으로 등록</span>
                  </label>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      고객명 <span className="text-rose-400">*</span>
                    </label>
                    <input
                      disabled={customerReadOnly || busy}
                      type="text"
                      required
                      placeholder="예: 홍길동"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {formType === 'corporate' ? '회사명 / 조직명' : '소속 / 구분'}
                    </label>
                    <input
                      disabled={customerReadOnly || busy}
                      type="text"
                      placeholder={formType === 'corporate' ? '예: (주)한국소프트' : '개인 고객'}
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {formType === 'corporate' ? '부서 / 직책' : '직업 / 호칭'}
                    </label>
                    {formType === 'corporate' ? (
                      <div className="flex gap-1">
                        <input
                      disabled={customerReadOnly || busy}
                          type="text"
                          placeholder="부서"
                          value={formDepartment}
                          onChange={(e) => setFormDepartment(e.target.value)}
                          className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                        />
                        <input
                      disabled={customerReadOnly || busy}
                          type="text"
                          placeholder="직책"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                        />
                      </div>
                    ) : (
                      <input
                      disabled={customerReadOnly || busy}
                        type="text"
                        placeholder="예: 일반 소비자"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">고객 등급</label>
                    <select
                      disabled={customerReadOnly || busy}
                      value={formTier}
                      onChange={(e) => setFormTier(e.target.value as 'VIP' | 'Gold' | 'Standard')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Standard">Standard (일반)</option>
                      <option value="Gold">Gold</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2.5 items-end">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">이메일 주소</label>
                    <input
                      disabled={customerReadOnly || busy}
                      type="email"
                      placeholder="example@email.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">발신 전화번호</label>
                    <input
                      type="text"
                      disabled
                      value={customer.phoneNumber}
                      className="w-full bg-slate-850 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 font-mono cursor-not-allowed text-xs"
                    />
                  </div>

                  <div>
                    <button
                disabled={customerReadOnly || busy}
                      type="submit"
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>신규 고객으로 등록</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* 3. 확장형 실시간 상담 메모 작성기 (핵심 워크스페이스) */}
      <div className="consultation-editor-area flex-1 flex flex-col p-3 overflow-hidden min-h-0">
        {/* Compact Integrated Category, Tags & Status Bar */}
        <div className="classification-bar flex flex-wrap items-center justify-between gap-2 mb-2 p-1.5 px-3 bg-slate-950/70 border border-slate-800 rounded-xl shrink-0">
          <ConsultationClassification catalog={content.catalog?.effective||null} value={effectiveClassification} resultId={resultId} resultName={resultName} disabled={readOnly||busy}
            onCategory={setClassification} onResult={(id,name)=>{setResultId(id);setResultName(name);}}/>
          {/* 중앙: 빠른 태그 칩 */}
          <div className="quick-tags flex items-center space-x-1 overflow-x-auto text-xs py-0.5">
            <Tag className="w-3 h-3 text-slate-400 shrink-0 mr-0.5" />
            {quickTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                disabled={readOnly || busy}
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 rounded-full text-[11px] transition-all shrink-0 ${
                    isSelected
                      ? tag.includes('컴플레인') || tag.includes('주의고객')
                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 font-bold'
                        : 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/50 font-medium'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {/* 우측: 처리 상태 세그먼트 */}
          <div className="record-status-controls flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
                disabled={readOnly || busy || (recordMode&&status==='completed')}
              type="button"
              onClick={() => setStatus('in_progress')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                status === 'in_progress'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              진행 중
            </button>
            <button
                disabled={readOnly || busy || isCallActive}
              type="button"
              onClick={() => void handleSave(true)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                status === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              상담 완료
            </button>
            <button
                disabled title="이관·에스컬레이션 미연동"
              type="button"
              onClick={() => setStatus('escalated')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                status === 'escalated'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              이관/에스컬
            </button>
          </div>
        </div>

        {/* Rich Editor Toolbar */}
        <div className="flex items-center justify-between bg-slate-800/95 border border-slate-700 rounded-t-xl px-3 py-1.5 text-xs text-slate-300 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              상담 기록 작성
            </span>
          </div>

        </div>
        {content.error&&<p role="alert" className="p-2 text-amber-200 text-sm">분류·템플릿 조회 실패: {content.error}<button className="ml-2 underline" disabled={content.loading} onClick={content.reload}>목록 다시 조회</button></p>}
        {content.loading&&!content.catalog&&<p role="status" className="p-2 text-sm">분류·템플릿 조회 중…</p>}
        <details className="editor-content-tools shrink-0 bg-slate-800 text-sm">
          <summary className="px-3 py-3 cursor-pointer">태그·템플릿 추가</summary>
          <div className="p-2 flex flex-wrap gap-2 max-h-36 overflow-auto">
            <div className="flex flex-wrap gap-2">{quickTags.map(tag=><button key={tag} aria-pressed={selectedTags.includes(tag)} disabled={readOnly||busy} className={`px-3 rounded ${selectedTags.includes(tag)?'bg-indigo-700':'bg-slate-700'}`} onClick={()=>toggleTag(tag)}>{tag}</button>)}</div>
            <button type="button" className="px-3 rounded bg-slate-700" disabled={content.loading} onClick={content.reload}>분류·템플릿 목록 새로고침</button>
            <TemplatePicker templates={content.templates} disabled={readOnly||busy} onInsert={insertTemplate}/>
          </div>
        </details>
        {/* Editor Body: SHNEA 단일 공식 에디터 (다크 테마 & full-height) */}
        <div className="consultation-document-area flex-1 flex flex-col min-h-0 overflow-hidden">
          <ShneaConsultationEditor
            documentKey={queueCode}
            initialText={memoText}
          queueCode={queueCode}
          organizationId={organizationId}
          readOnly={readOnly || busy}
            onChangeText={(txt) => setMemoText(txt)}
          />
        </div>
      </div>

      {/* 4. 하단 고정 액션 바 */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
          <Clock className="w-3.5 h-3.5" />
          <span>마지막 저장: {lastSavedTime}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">입력 글자 수: {documentText(memoText).length}자</span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Temporary Save */}
          <button
                disabled={readOnly || busy}
            type="button"
            onClick={() => handleSave(false)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Save className="w-3.5 h-3.5" />
            <span>임시 저장</span>
          </button>

          {/* Admin Escalation */}
          <button
                disabled title="관리자 에스컬레이션 미연동"
            type="button"
            onClick={() => {
              setStatus('escalated');
              handleSave(false);
            }}
            className="px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>관리자 에스컬레이션</span>
          </button>

          {/* Complete Consultation */}
          <button
                disabled={readOnly || busy || isCallActive}
                title={isCallActive ? '통화를 종료한 뒤 기록을 완료해 주세요.' : '상담 기록 저장 및 완료'}
            type="button"
            onClick={() => handleSave(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>상담 기록 완료</span>
          </button>
        </div>
      </div>
    </main>
  );
};
