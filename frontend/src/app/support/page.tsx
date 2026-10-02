'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Headphones, 
  PhoneCall, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  User, 
  MessageSquare, 
  ChevronRight, 
  Sparkles, 
  ShieldCheck, 
  Star, 
  RefreshCw,
  Radio,
} from 'lucide-react';
import { LiveKitCallSession } from '../../lib/livekit';

interface SessionData {
  sessionId: string;
  queueCode: string;
  status: 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'CALL_ENDED';
  assignedAgent?: string;
  inquiryType?: string;
  customerName?: string;
  message?: string;
}

export default function CustomerSupportPage() {
  const [organizationCode,setOrganizationCode]=useState('');
  const [organizationName,setOrganizationName]=useState('');
  const requestId=useRef<string>('');
  // 폼 입력 상태
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerType, setCustomerType] = useState<'B2C' | 'B2B'>('B2C');
  const [inquiryType, setInquiryType] = useState('제품 문의 / 도입 상담');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'CALL' | 'CHAT'>('CALL');

  // 세션 진행 상태: 'FORM' | 'WAITING' | 'IN_CALL' | 'FINISHED' | 'CANCELLED'
  const [step, setStep] = useState<'FORM' | 'WAITING' | 'IN_CALL' | 'FINISHED' | 'CANCELLED'>('FORM');
  const [session, setSession] = useState<SessionData | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [estimatedWaitSeconds, setEstimatedWaitSeconds] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 실시간 음성 통화 (LiveKit WebRTC) 상태
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const livekitRef = useRef<LiveKitCallSession | null>(null);

  const [rating, setRating] = useState<number>(5);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    const code=new URLSearchParams(window.location.search).get('org') || '';
    // Public URL selects the tenant; the server resolves and validates it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrganizationCode(code);
    if(!code) {setErrorMessage('조직의 상담 접수 링크로 접속해 주세요.');return;}
    fetch(`/api/support/organization/${encodeURIComponent(code)}`).then(async response => {
      if(!response.ok) throw new Error('현재 상담 접수를 지원하는 조직이 아닙니다.');
      const data=await response.json();setOrganizationName(data.name);
    }).catch(error=>setErrorMessage(error.message));
  },[]);
  // 1. 상담 요청 접수
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(submitting || !organizationName) return;
    if (!customerName.trim()) {
      setErrorMessage('성함을 입력해 주세요.');
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMessage('연락처를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      if(channel==='CALL') {
        if(!navigator.mediaDevices?.getUserMedia) throw new Error('음성 상담은 HTTPS와 마이크 지원 브라우저가 필요합니다. 온라인 티켓을 선택할 수 있습니다.');
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(track=>track.stop());
      }
      if(!requestId.current) requestId.current=crypto.randomUUID();
      const res = await fetch('/api/support/request' , {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationCode, requestId:requestId.current,
          customerName,
          companyName: customerType === 'B2B' ? companyName : undefined,
          phoneNumber,
          customerType: customerType === 'B2B' ? 'CORPORATE' : 'INDIVIDUAL',
          inquiryType,
          message,
          channel,
        }),
      });

      if (!res.ok) throw new Error('상담 접수 요청에 실패했습니다.');

      const data = await res.json();
      setSession({
        sessionId: data.sessionId,
        queueCode: data.queueCode,
        status: data.status,
        inquiryType,
        customerName,
        message,
      });
      setQueuePosition(data.waitingPosition || 1);
      setEstimatedWaitSeconds(data.estimatedWaitSeconds || 30);
      setStep('WAITING');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || '네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. 세션 상태 실시간 폴링 (WAITING 또는 IN_CALL 일 때)
  useEffect(() => {
    if (!session?.sessionId || (step !== 'WAITING' && step !== 'IN_CALL')) return;

    const abort=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    const poll=async () => {
      try {
        const res=await fetch(`/api/support/session/${session.sessionId}`,{signal:abort.signal,cache:'no-store'});
        if(!res.ok) throw new Error('상담 상태를 확인하지 못했습니다. 다시 확인 중입니다.');
        const data:SessionData & {waitingPosition:number;estimatedWaitSeconds:number}=await res.json();
        if(abort.signal.aborted) return;
        setErrorMessage('');setSession(prev=>({...prev,...data}));
        setQueuePosition(data.waitingPosition);setEstimatedWaitSeconds(data.estimatedWaitSeconds);
        if(data.status==='PROCESSING' && step==='WAITING') {setStep('IN_CALL');setCallDuration(0);}
        else if(data.status==='COMPLETED'||data.status==='CALL_ENDED') setStep('FINISHED');
        else if(data.status==='CANCELLED') setStep('CANCELLED');
      } catch(error) {if(!abort.signal.aborted) setErrorMessage((error as Error).message);}
      finally {if(!abort.signal.aborted) timer=setTimeout(poll,2000);}
    };
    void poll();return ()=>{abort.abort();clearTimeout(timer);};
  }, [session?.sessionId, step]);

  // 3. 통화 타이머
  useEffect(() => {
    if (step !== 'IN_CALL' || mediaStatus !== 'connected') return;
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [step, mediaStatus]);

  // 통화 시간 포맷 (MM:SS)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 4. LiveKit WebRTC 실시간 음성 통화 연결 (IN_CALL 진입 시 자동 연결)
  useEffect(() => {
    if (step !== 'IN_CALL' || !session?.sessionId) return;

    let isSubscribed = true;
    const sessionManager = new LiveKitCallSession({
      onConnected: () => {
        if (isSubscribed) setMediaStatus('connected');
      },
      onDisconnected: () => {
        if (isSubscribed) setMediaStatus('idle');
      },
      onError: (err) => {
        console.error('Customer LiveKit connection error:', err);
        if (isSubscribed) setMediaStatus('error');
      },
    });
    livekitRef.current = sessionManager;
    // A newly created media session begins in connecting state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMediaStatus('connecting');

    // 백엔드에서 LiveKit 룸 접속 토큰 발급
    fetch(`/api/support/session/${session.sessionId}/token`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error('음성 통화 접속 토큰 발급 실패');
        return res.json();
      })
      .then((data) => {
        if (!isSubscribed) return;
        return sessionManager.connect(data.url, data.token);
      })
      .catch((err) => {
        console.error('Failed to establish LiveKit audio session:', err);
        if (isSubscribed) setMediaStatus('error');
      });

    return () => {
      isSubscribed = false;
      sessionManager.disconnect();
      livekitRef.current = null;
    };
  }, [step, session?.sessionId]);

  // 마이크 음소거 토글
  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (livekitRef.current) {
      await livekitRef.current.setMuted(nextMuted);
    }
  };

  // 상담 취소
  const handleCancel = async () => {
    if (livekitRef.current) {
      livekitRef.current.disconnect();
    }
    if (!session?.sessionId) return;
    try {
      const response=await fetch(`/api/support/session/${session.sessionId}/cancel`, { method: 'POST' });
      if(!response.ok) throw new Error('취소 요청에 실패했습니다. 다시 시도해 주세요.');
      setStep('CANCELLED');
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  };

  // 통화 종료
  const handleEndCall = async () => {
    if (livekitRef.current) {
      livekitRef.current.disconnect();
    }
    if (!session?.queueCode) return;
    try {
      const response=await fetch(`/api/support/session/${session.sessionId}/end-call`, { method: 'POST' });
      if(!response.ok) throw new Error('통화 종료에 실패했습니다. 다시 시도해 주세요.');
      setStep('FINISHED');
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  };

  return (
    <div className="h-dvh overflow-y-auto overscroll-y-contain bg-slate-900 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {errorMessage && <p role="alert" className="p-3 bg-amber-950 text-amber-200">{errorMessage}</p>}
      {/* 헤더 */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">hellow</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">고객지원센터</span>
            </div>
            <p className="text-xs text-slate-400">온라인 실시간 상담 및 문의 접수</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          상담 센터 운영 중 (평균 대기 1분)
        </div>
      </header>

      {/* 메인 컨테이너 */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 shrink-0">
        <div className="w-full max-w-xl">
          {/* STEP 1: 접수 폼 */}
          {step === 'FORM' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  빠른 전문 상담사 연결
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">상담 문의를 접수해 주세요</h1>
                <p className="text-sm text-slate-400 mt-1">문의 내용을 남겨주시면 담당 전문 상담사와 바로 연결해 드립니다.</p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 고객 분류 (개인 / 기업) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">고객 구분</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCustomerType('B2C')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                        customerType === 'B2C'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      개인 고객 (소비자)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerType('B2B')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                        customerType === 'B2B'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      기업 / 단체 고객
                    </button>
                  </div>
                </div>

                {/* 문의 유형 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">문의 유형</label>
                  <select
                    value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="제품 문의 / 도입 상담">제품 문의 / 도입 상담</option>
                    <option value="이용 장애 / 기술 지원">이용 장애 / 기술 지원</option>
                    <option value="계약 / 요금 / 정산">계약 / 요금 / 정산</option>
                    <option value="환불 / 불편 접수 (컴플레인)">⚠️ 환불 / 불편 접수 (컴플레인)</option>
                    <option value="기타 문의">기타 일반 문의</option>
                  </select>
                </div>

                {/* 성함 & 소속 회사명 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">성함 / 담당자명 <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      placeholder="예: 홍길동"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  {customerType === 'B2B' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">소속 회사명 <span className="text-slate-400">(선택)</span></label>
                      <input
                        type="text"
                        placeholder="예: (주)테크솔루션"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                  {customerType === 'B2C' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">소속 구분</label>
                      <input
                        type="text"
                        disabled
                        value="일반 개인"
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-500"
                      />
                    </div>
                  )}
                </div>

                {/* 연락처 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">연락처 <span className="text-rose-400">*</span></label>
                  <input
                    type="tel"
                    placeholder="예: 010-1234-5678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">상담 연결이 끊기거나 콜백 시 안내받으실 번호입니다.</p>
                </div>

                {/* 문의 내용 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">문의 요약 및 요청 사항</label>
                  <textarea
                    rows={3}
                    placeholder="상담사에게 전달할 문의 내용을 간단히 적어주시면 더 신속한 안내가 가능합니다."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* 연결 방식 선택 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">연결 방식</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setChannel('CALL')}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-semibold transition ${
                        channel === 'CALL'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <PhoneCall className="w-4 h-4" />
                      실시간 음성 통화
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannel('CHAT')}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-semibold transition ${
                        channel === 'CHAT'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      온라인 티켓 접수
                    </button>
                  </div>
                </div>

                {/* 제출 버튼 */}
                <div className="sticky bottom-0 z-20 -mx-6 bg-slate-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:static sm:mx-0 sm:bg-transparent sm:p-0">
                  <button
                    type="submit"
                    disabled={submitting || !organizationName}
                    className="w-full min-h-12 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        상담사 연결 준비 중...
                      </>
                    ) : (
                      <>
                        상담 연결 요청하기
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: 대기 중 화면 */}
          {step === 'WAITING' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-2xl backdrop-blur text-center">
              <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping"></div>
                <div className="absolute inset-2 rounded-full border border-indigo-500/60 animate-pulse"></div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                  <PhoneCall className="w-8 h-8 text-white animate-bounce" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">상담사를 연결하고 있습니다</h2>
              <p className="text-sm text-slate-400 mb-6">
                고객님의 요청이 상담사 대기열에 등록되었습니다.<br />
                상담사가 확인 즉시 통화가 시작됩니다. 화면을 유지해 주세요.
              </p>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 max-w-sm mx-auto mb-6 grid grid-cols-2 gap-4 divide-x divide-slate-800">
                <div>
                  <span className="block text-xs text-slate-400 mb-1">현재 대기 순번</span>
                  <span className="text-xl font-bold text-indigo-400">{queuePosition}번째</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 mb-1">예상 대기 시간</span>
                  <span className="text-xl font-bold text-emerald-400">약 {estimatedWaitSeconds}초</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 mb-8 space-y-1">
                <p>접수자: <strong className="text-slate-300">{customerName}</strong> 님 ({phoneNumber})</p>
                <p>문의 유형: <strong className="text-slate-300">{inquiryType}</strong></p>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-400 hover:text-rose-400 hover:border-rose-900 text-sm font-medium transition"
              >
                상담 요청 취소
              </button>
            </div>
          )}

          {/* STEP 3: 통화 중 화면 */}
          {step === 'IN_CALL' && (
            <div className="bg-slate-950/90 border border-emerald-900/40 rounded-2xl p-8 sm:p-10 shadow-2xl backdrop-blur text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <PhoneCall className="w-9 h-9 text-emerald-400" />
              </div>

              {/* 실시간 음성 연결 상태 인디케이터 */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 border transition-all">
                {mediaStatus === 'connected' ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    실시간 음성 연결됨 (LiveKit WebRTC)
                  </span>
                ) : mediaStatus === 'connecting' ? (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    마이크 및 음성 서버 연결 중...
                  </span>
                ) : mediaStatus === 'error' ? (
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    음성 연결 확인 필요
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    통화 준비 중
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-white mb-1">
                {session?.assignedAgent || '홍상담 매니저 (상담1팀)'}
              </h2>
              <p className="text-xs text-slate-400 mb-6">전문 상담사와 실시간 양방향 음성 통화가 진행 중입니다.</p>

              {/* 통화 시간 */}
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-3xl font-mono font-bold text-white mb-8 tracking-wider">
                <Clock className="w-6 h-6 text-emerald-400" />
                {formatTime(callDuration)}
              </div>

              {/* 통화 조작 툴바 */}
              <div className="flex items-center justify-center gap-4 max-w-xs mx-auto mb-6">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition flex items-center justify-center gap-2 ${
                    isMuted
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-slate-400" />}
                  {isMuted ? '음소거 됨' : '음소거'}
                </button>
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  통화 종료
                </button>
              </div>

              <p className="text-xs text-slate-500">
                상담사가 상담을 마무리하면 화면이 자동으로 완료 페이지로 전환됩니다.
              </p>
            </div>
          )}

          {/* STEP 4: 상담 완료 화면 */}
          {step === 'FINISHED' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-2xl backdrop-blur text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">상담이 완료되었습니다</h2>
              <p className="text-sm text-slate-400 mb-6">
                이용해 주셔서 대단히 감사합니다.<br />
                고객님의 소중한 의견은 서비스 개선에 큰 도움이 됩니다.
              </p>

              {/* 만족도 평가 */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 max-w-sm mx-auto mb-8">
                <span className="block text-xs font-semibold text-slate-300 mb-3">상담 서비스 만족도를 평가해 주세요</span>
                <div className="flex justify-center gap-2 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => { setRating(star); setFeedbackSubmitted(true); }}
                      className="p-1.5 transition transform hover:scale-125"
                    >
                      <Star className={`w-7 h-7 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                    </button>
                  ))}
                </div>
                {feedbackSubmitted ? (
                  <p className="text-xs text-emerald-400 font-medium">평가가 등록되었습니다. 감사합니다!</p>
                ) : (
                  <p className="text-xs text-slate-500">별점을 클릭하여 평가해 주세요.</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('FORM');
                  setSession(null);
                  setMessage('');
                  setFeedbackSubmitted(false);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition"
              >
                새로운 상담 문의하기
              </button>
            </div>
          )}

          {/* STEP 5: 상담 취소 화면 */}
          {step === 'CANCELLED' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-2xl backdrop-blur text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">상담 요청이 취소되었습니다</h2>
              <p className="text-sm text-slate-400 mb-8">
                언제든지 다시 문의해 주시면 친절하게 안내해 드리겠습니다.
              </p>

              <button
                type="button"
                onClick={() => {
                  setStep('FORM');
                  setSession(null);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition"
              >
                다시 접수하기
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-slate-800/80 bg-slate-950/50 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <span>안전한 종단간 암호화(WebRTC) 실시간 음성 통신 지원</span>
        </div>
        <span>© 2026 hellow CRM. All rights reserved.</span>
      </footer>
    </div>
  );
}
