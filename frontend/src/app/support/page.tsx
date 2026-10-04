'use client';

import React, {useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import {Headphones, PhoneCall, PhoneOff, Mic, MicOff, CheckCircle2, AlertCircle, Building2, User, MessageSquare, ChevronRight, RefreshCw} from 'lucide-react';
import {LiveKitCallSession} from '@/lib/livekit';
import {useSupportSession} from '@/hooks/use-support-session';
import {supportJson,rememberSupportResume} from '@/lib/support-session';
import {CallReconnectNotice} from '@/components/CallReconnectNotice';
import {ChatPanel} from '@/components/chat/ChatPanel';
import {useCallClock} from '@/hooks/use-call-clock';
import './support.css';

const defaultBranding = {title:'상담 문의를 접수해 주세요',description:'문의 내용을 남겨주시면 담당 상담사가 확인합니다.',buttonLabel:'상담 연결 요청하기',primaryColor:'#4f46e5',logoUrl:''};
export default function CustomerSupportPage() {
  const [organizationCode,setOrganizationCode]=useState('');
  const [organizationName,setOrganizationName]=useState('');
  const [branding,setBranding]=useState(defaultBranding);
  const [organizationError,setOrganizationError]=useState('');
  const [customerName,setCustomerName]=useState('');
  const [companyName,setCompanyName]=useState('');
  const [phoneNumber,setPhoneNumber]=useState('');
  const [customerType,setCustomerType]=useState<'B2C'|'B2B'>('B2C');
  const [inquiryType,setInquiryType]=useState('제품 문의 / 도입 상담');
  const [message,setMessage]=useState('');
  const [channel,setChannel]=useState<'CALL'|'CHAT'>('CALL');
  const flow=useSupportSession(organizationCode);
  const {step,session,request,busy:submitting}=flow;
  const [mediaStatus,setMediaStatus]=useState<'idle'|'connecting'|'connected'|'error'>('idle');
  const [mediaError,setMediaError]=useState('');
  const [mediaRetry,setMediaRetry]=useState(0);
  const [audioBlocked,setAudioBlocked]=useState(false);
  const [audioError,setAudioError]=useState('');
  const mutePreference=useRef({sessionId:'',muted:false});
  const [isMuted,setIsMuted]=useState(false);
  const [muting,setMuting]=useState(false);
  const callDuration=useCallClock(session?.callStartedAt,session?.callEndedAt);
  const livekitRef=useRef<LiveKitCallSession|null>(null);
  const isVoice=step==='PROCESSING' && session?.channel==='CALL';
  const sessionId=session?.sessionId;
  const errorMessage=organizationError || flow.error || (isVoice?mediaError:'');

  useEffect(()=>{
    const abort=new AbortController();
    void Promise.resolve().then(async()=>{
      const code=new URLSearchParams(window.location.search).get('org') || '';
      if(abort.signal.aborted)return;
      setOrganizationCode(code);
      if(!code){setOrganizationError('조직의 상담 접수 링크로 접속해 주세요.');return;}
      try {
        const data=await supportJson<{name:string;branding:typeof defaultBranding}>(`/api/support/organization/${encodeURIComponent(code)}`,{signal:abort.signal});
        if(!abort.signal.aborted){setOrganizationName(data.name);setBranding(data.branding);setOrganizationError('');}
      }catch(e){if(!abort.signal.aborted)setOrganizationError((e as Error).message);}
    });
    return()=>abort.abort();
  },[]);

  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    if(!organizationName)return;
    void flow.submit({customerName,companyName:customerType==='B2B'?companyName:undefined,phoneNumber,
      customerType:customerType==='B2B'?'CORPORATE':'INDIVIDUAL',inquiryType,message,channel});
  };

  useEffect(()=>{
    if(!isVoice || !sessionId)return;
    const abort=new AbortController();
    const manager=new LiveKitCallSession({
      onConnected:()=>{if(!abort.signal.aborted){setMediaStatus('connected');setMediaError('');}},
      onConnectionStateChanged:state=>{if(!abort.signal.aborted&&state==='reconnecting')setMediaStatus('connecting');},
      onAudioPlaybackChanged:allowed=>{if(!abort.signal.aborted){setAudioBlocked(!allowed);if(allowed)setAudioError('');}},
      onDisconnected:()=>{if(!abort.signal.aborted){setMediaStatus('error');setMediaError('음성 연결이 끊겼습니다. 접수는 유지됩니다. 음성 다시 연결을 눌러 주세요.');}},
      onError:()=>{if(!abort.signal.aborted){setMediaStatus('error');setMediaError('음성 연결에 실패했습니다. 마이크 권한과 네트워크를 확인한 뒤 다시 연결해 주세요.');}},
    });
    livekitRef.current=manager;

    const leave=()=>{rememberSupportResume(organizationCode,sessionId);manager.disconnect();};
    const resume=(event:PageTransitionEvent)=>{if(event.persisted)setMediaRetry(v=>v+1);};
    window.addEventListener('pageshow',resume);
    window.addEventListener('pagehide',leave);
    void Promise.resolve().then(async()=>{
      if(abort.signal.aborted)return;
      setMediaStatus('connecting');setMediaError('');setAudioBlocked(false);setAudioError('');
      if(mutePreference.current.sessionId!==sessionId)mutePreference.current={sessionId,muted:false};
      setIsMuted(mutePreference.current.muted);
      try{
        const data=await supportJson<{url:string;token:string}>(`/api/support/session/${sessionId}/token`,{method:'POST',signal:abort.signal});
        if(!abort.signal.aborted){await manager.connect(data.url,data.token,mutePreference.current.muted);}
      }catch{if(!abort.signal.aborted){setMediaStatus('error');setMediaError('음성 연결을 확인하지 못했습니다. 마이크 권한과 네트워크를 확인한 뒤 다시 연결해 주세요.');}}
    });
    return()=>{window.removeEventListener('pageshow',resume);window.removeEventListener('pagehide',leave);abort.abort();manager.disconnect();if(livekitRef.current===manager)livekitRef.current=null;};
  },[isVoice,sessionId,mediaRetry,organizationCode]);

  const handleToggleMute=async()=>{
    if(!livekitRef.current || mediaStatus!=='connected' || muting)return;
    setMuting(true);
    const manager=livekitRef.current;
    try{await manager.setMuted(!isMuted);if(livekitRef.current===manager){mutePreference.current.muted=!isMuted;setIsMuted(!isMuted);setMediaError('');}}
    catch{setMediaError('마이크 상태를 변경하지 못했습니다. 다시 시도해 주세요.');}
    finally{setMuting(false);}
  };
  const startAudio=async()=>{
    const manager=livekitRef.current;if(!manager)return;
    try{await manager.startAudio();if(livekitRef.current===manager)setAudioError('');}
    catch{if(livekitRef.current===manager)setAudioError('소리를 재생하지 못했습니다. 브라우저의 소리 권한을 확인한 뒤 다시 눌러 주세요.');}
  };
  const newRequest=()=>{flow.newRequest();setMessage('');setMediaError('');};
  const buttonClass='min-h-12 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50';
  const panelClass='bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center';
  return <div className="support-shell h-dvh overflow-y-auto overscroll-y-contain bg-slate-900 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
    <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-30 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{backgroundColor:branding.primaryColor}}>
          {branding.logoUrl?<Image src={branding.logoUrl} alt={`${organizationName} 로고`} width={36} height={36} unoptimized className="rounded-xl object-contain"/>:<Headphones className="w-5 h-5 text-white"/>}
        </div>
        <div className="min-w-0 break-words"><span className="font-bold text-lg text-white">{organizationName||'hellow'}</span><p className="text-xs text-slate-400">고객지원 · 온라인 문의 접수</p></div>
      </div>
      <span className="text-xs text-slate-300">{organizationName?'상담 접수 가능':'접수 조직 확인 중'}</span>
    </header>
    <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 shrink-0">
      <div className="w-full max-w-xl">
        <CallReconnectNotice since={session?.mediaMissingSince} ended={!isVoice}/>
        {errorMessage&&<p role="alert" className="mb-4 p-4 bg-amber-950 text-amber-200 rounded-xl break-words">{errorMessage}</p>}
        {organizationError&&<button onClick={()=>window.location.reload()} className={`${buttonClass} mb-4`}>접수 조직 다시 확인</button>}
          {/* STEP 1: 접수 폼 */}
          {step === 'FORM' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-white tracking-tight">{branding.title}</h1>
                <p className="text-sm text-slate-400 mt-1">{branding.description}</p>
              </div>

              <form onSubmit={handleSubmit}><fieldset disabled={submitting || !organizationName} className="space-y-5">
                {/* 고객 분류 (개인 / 기업) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">고객 구분</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      aria-pressed={customerType === 'B2C'} onClick={() => setCustomerType('B2C')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                        customerType === 'B2C'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      개인 고객
                    </button>
                    <button
                      type="button"
                      aria-pressed={customerType === 'B2B'} onClick={() => setCustomerType('B2B')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                        customerType === 'B2B'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      기업 고객
                    </button>
                  </div>
                </div>

                {/* 문의 유형 */}
                <div>
                  <label htmlFor="support-inquiry" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">문의 유형</label>
                  <select
                    id="support-inquiry" value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="제품 문의 / 도입 상담">제품 문의 / 도입 상담</option>
                    <option value="이용 장애 / 기술 지원">이용 장애 / 기술 지원</option>
                    <option value="계약 / 요금 / 정산">계약 / 요금 / 정산</option>
                    <option value="환불 / 불편 접수 (컴플레인)">환불 / 불편 접수 (컴플레인)</option>
                    <option value="기타 문의">기타 일반 문의</option>
                  </select>
                </div>

                {/* 성함 & 소속 회사명 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="support-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">성함 / 담당자명 <span className="text-rose-400">*</span></label>
                    <input
                      type="text"
                      placeholder="예: 홍길동"
                      id="support-name" maxLength={100} value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  {customerType === 'B2B' && (
                    <div>
                      <label htmlFor="support-company" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">소속 회사명 <span className="text-slate-400">(선택)</span></label>
                      <input
                        type="text"
                        placeholder="예: (주)테크솔루션"
                        id="support-company" maxLength={150} value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
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
                  <label htmlFor="support-phone" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">연락처 <span className="text-rose-400">*</span></label>
                  <input
                    type="tel"
                    placeholder="예: 010-1234-5678"
                    id="support-phone" maxLength={50} value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">상담 연결이 끊기거나 콜백 시 안내받으실 번호입니다.</p>
                </div>

                {/* 문의 내용 */}
                <div>
                  <label htmlFor="support-message" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">문의 요약 및 요청 사항</label>
                  <textarea
                    rows={3}
                    placeholder="상담사에게 전달할 문의 내용을 간단히 적어주시면 더 신속한 안내가 가능합니다."
                    id="support-message" required maxLength={10000} value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-base sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* 연결 방식 선택 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">연결 방식</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      aria-pressed={channel === 'CALL'} onClick={() => setChannel('CALL')}
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
                      aria-pressed={channel === 'CHAT'} onClick={() => setChannel('CHAT')}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-semibold transition ${
                        channel === 'CHAT'
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      실시간 채팅
                    </button>
                  </div>
                </div>

                {/* 제출 버튼 */}
                <div className="sticky bottom-0 z-20 -mx-6 bg-slate-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:static sm:mx-0 sm:bg-transparent sm:p-0">
                  <button
                    type="submit"
                    disabled={submitting || !organizationName}
                    className="w-full min-h-12 py-3 px-4 rounded-xl text-white font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110"
                    style={{backgroundColor:branding.primaryColor}}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        접수 확인 중…
                      </>
                    ) : (
                      <>
                        {branding.buttonLabel}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </fieldset></form>
            </div>
          )}


        {step==='RESTORING'&&<div className={panelClass}><h1 className="text-xl font-semibold">접수 정보를 확인하고 있습니다</h1><p role="status" className="mt-3 text-slate-300">이 창에서 이전에 접수한 요청을 먼저 확인합니다.</p></div>}
        {step==='PENDING'&&<div className={panelClass}>
          <h1 className="text-xl font-semibold">기존 접수 결과 확인</h1>
          <p className="mt-3 text-slate-300">응답을 받지 못한 요청이 보관되어 있습니다. 동일한 내용으로 접수 결과를 확인하고, 아직 접수되지 않았다면 다시 전송합니다.</p>
          <p className="my-4 text-sm text-slate-300 break-words">{request?.customerName} · {request?.inquiryType}</p>
          <button disabled={submitting||!organizationName} onClick={()=>void flow.submit()} className={buttonClass}>{submitting?'확인 중…':'기존 요청 확인·재시도'}</button>
        </div>}
        {session?.chatEnabled&&['WAITING','PROCESSING','FINISHED','CANCELLED'].includes(step)&&<div className="support-chat">
          <p className="px-4 pt-4 text-sm text-slate-300">{session.assignedAgent?`담당자 · ${session.assignedAgent}`:'상담사 연결을 기다리고 있습니다.'}</p>
          <ChatPanel key={session.sessionId} target={{kind:'customer',sessionId:session.sessionId,storageKey:`hellow_chat_customer:${organizationCode}:${session.sessionId}`}}/>
          {step==='WAITING'&&<div className="px-4 pb-4"><button disabled={submitting} onClick={()=>void flow.cancel()} className={buttonClass}>상담 요청 취소</button></div>}
        </div>}
        {step==='WAITING'&&!session?.chatEnabled&&<div className={panelClass}>
          <Headphones className="w-12 h-12 text-indigo-400 mx-auto mb-4"/>
          <h1 className="text-2xl font-bold">{session?.channel==='CALL'?'상담사 연결을 기다리고 있습니다':'문의가 접수되었습니다'}</h1>
          <p className="mt-3 text-slate-300">{session?.channel==='CALL'?'상담사가 요청을 수락하면 음성 연결을 준비합니다. 이 화면을 유지해 주세요.':'담당자가 문의 내용을 확인할 때까지 기다려 주세요. 이 화면에서 처리 상태를 확인할 수 있습니다.'}</p>
          <p className="my-6 text-sm text-slate-300">현재 조직의 대기 요청 <strong className="text-white">{session?.waitingCount}건</strong></p>
          <p className="mb-6 text-sm text-slate-300 break-words">{request?.customerName} · {request?.inquiryType}</p>
          <button disabled={submitting} onClick={()=>void flow.cancel()} className={buttonClass}>{submitting?'취소 확인 중…':'상담 요청 취소'}</button>
        </div>}
        {step==='PROCESSING'&&!session?.chatEnabled&&<div className={panelClass}>
          {isVoice?<PhoneCall className="w-12 h-12 text-emerald-400 mx-auto mb-4"/>:<MessageSquare className="w-12 h-12 text-indigo-400 mx-auto mb-4"/>}
          <h1 className="text-2xl font-bold">{isVoice?'음성 상담':'문의 처리 중'}</h1>
          <p className="my-3 text-slate-300 break-words">{session?.assignedAgent?`담당자 · ${session.assignedAgent}`:'담당자가 요청을 확인하고 있습니다.'}</p>
          {isVoice?<>
            <p role="status" className="mb-4 text-slate-300">{mediaStatus==='connected'?'음성 서버에 연결되었습니다':mediaStatus==='connecting'?'마이크와 음성 서버에 연결하고 있습니다':'음성 연결을 확인해 주세요'}</p>
            <p className="mb-6 text-3xl font-semibold tabular-nums">{Math.floor(callDuration/60).toString().padStart(2,'0')}:{(callDuration%60).toString().padStart(2,'0')}</p>
            {mediaStatus==='error'&&<button onClick={()=>setMediaRetry(value=>value+1)} disabled={submitting} className={`${buttonClass} mb-4`}>음성 다시 연결</button>}
            {audioBlocked&&<div className="mb-4"><p role="status" className="mb-3 text-amber-200">{audioError||'브라우저가 상담사 소리의 자동 재생을 차단했습니다.'}</p><button onClick={()=>void startAudio()} className={buttonClass}>상담사 소리 켜기</button></div>}
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={()=>void handleToggleMute()} disabled={submitting||muting||mediaStatus!=='connected'} className={buttonClass}>{isMuted?<MicOff className="w-4 h-4 inline mr-2"/>:<Mic className="w-4 h-4 inline mr-2"/>}{isMuted?'음소거 해제':'음소거'}</button>
              <button onClick={()=>void flow.endCall()} disabled={submitting} className={`${buttonClass} bg-rose-600 hover:bg-rose-500`}><PhoneOff className="w-4 h-4 inline mr-2"/>{submitting?'종료 확인 중…':'통화 종료'}</button>
            </div>
          </>:<p className="mt-4 text-slate-300">담당자가 문의를 확인했습니다. 처리 결과가 저장되면 이 화면에 완료 상태가 표시됩니다.</p>}
        </div>}
        {step==='CALLBACK_REQUESTED'&&<div className={panelClass} role="status">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4"/>
          <h1 className="text-2xl font-bold">현재 바로 연결할 수 있는 상담사가 없습니다.</h1>
          <p className="mt-4 text-slate-200">남겨주신 연락처로 연락드릴 수 있도록 콜백 요청을 접수했습니다.</p>
          <p className="mt-3 text-sm text-slate-300">작성하신 문의 내용도 함께 전달되었습니다. 이 화면을 닫으셔도 됩니다.</p>
        </div>}
        {['FINISHED','CANCELLED','EXPIRED'].includes(step)&&<div className={panelClass}>
          {step==='FINISHED'?<CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4"/>:<AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4"/>}
          <h1 className="text-2xl font-bold">{step==='EXPIRED'?'접수 화면의 이용 시간이 만료되었습니다':step==='CANCELLED'?'상담 요청이 취소되었습니다':session?.chatEndedAt?'채팅 대화가 종료되었습니다':session?.status==='CALL_ENDED'?'통화가 종료되었습니다':'상담이 완료되었습니다'}</h1>
          <p className="my-6 text-slate-300">{step==='EXPIRED'?'접수 기록은 보존됩니다. 추가 문의가 필요하면 새 요청을 접수해 주세요.':session?.status==='CALL_ENDED'?'담당자는 통화 후 상담 기록을 정리합니다. 추가 문의가 필요하면 새 요청을 접수해 주세요.':'추가 문의가 필요하면 새 요청을 접수해 주세요.'}</p>
          <button onClick={newRequest} disabled={submitting} className={buttonClass}>새로운 상담 문의하기</button>
        </div>}
        {step==='UNAVAILABLE'&&<div className={panelClass}><h1 className="text-xl font-semibold">접수 정보를 확인할 수 없습니다</h1><p className="my-4 text-slate-300">조직의 상담 접수 링크와 브라우저 저장소 설정을 확인한 뒤 다시 열어 주세요.</p><button onClick={()=>window.location.reload()} className={buttonClass}>다시 확인</button></div>}
      </div>
    </main>
    <footer className="border-t border-slate-800 bg-slate-950 py-4 px-6 text-center text-xs text-slate-400 shrink-0">온라인 문의 접수 · 음성 상담 · © 2026 hellow CRM</footer>
  </div>;
}
