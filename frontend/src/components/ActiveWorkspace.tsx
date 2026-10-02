'use client';

import React, { useState, useEffect } from 'react';
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
  Mail,
  Calendar,
  UserCheck,
  Tag,
  Bold,
  Italic,
  List,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { CustomerProfile, ConsultationCategory } from '../types';
import { consultationCategories, quickTags } from '../data/mockData';

interface ActiveWorkspaceProps {
  customer: CustomerProfile;
  callDuration: number;
  isCallActive: boolean;
  onEndCall: () => void;
  onStartCall: () => void;
  onOpenTransfer: () => void;
  onSaveConsultation: (data: {
    categoryMain: string;
    categorySub: string;
    status: string;
    selectedTags: string[];
    memo: string;
    isComplete: boolean;
  }) => void;
  quotedText?: string;
  onClearQuotedText?: () => void;
}

export const ActiveWorkspace: React.FC<ActiveWorkspaceProps> = ({
  customer,
  callDuration,
  isCallActive,
  onEndCall,
  onStartCall,
  onOpenTransfer,
  onSaveConsultation,
  quotedText,
  onClearQuotedText,
}) => {
  // Call controls state
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  // Consultation memo form state
  const [mainCategory, setMainCategory] = useState(consultationCategories[0].main);
  const [subCategory, setSubCategory] = useState(consultationCategories[0].subs[0]);
  const [status, setStatus] = useState<'in_progress' | 'completed' | 'escalated'>('in_progress');
  const [selectedTags, setSelectedTags] = useState<string[]>(['#견적_재검토', '#방문요청']);
  const [memoText, setMemoText] = useState<string>(
    '• 고객 요청사항: 엔터프라이즈 라이선스 갱신 시 분기 납부 조건 및 추가 50계정 할인율 문의\n• WebRTC 환경: 사내 방화벽 30160 포트 예외 처리 완료 여부 재검토 요청함\n• 차주 월요일 오후 엔지니어 방문 기술 미팅 희망'
  );
  const [lastSavedTime, setLastSavedTime] = useState<string>('방금 전');

  // Sync subcategories when main category changes
  useEffect(() => {
    const currentCat = consultationCategories.find((c) => c.main === mainCategory);
    if (currentCat && currentCat.subs.length > 0) {
      setSubCategory(currentCat.subs[0]);
    }
  }, [mainCategory]);

  // Handle quoted text insertion from timeline
  useEffect(() => {
    if (quotedText) {
      setMemoText((prev) => `${prev}\n\n[인용된 과거 상담 이력]\n> ${quotedText}\n`);
      if (onClearQuotedText) onClearQuotedText();
    }
  }, [quotedText, onClearQuotedText]);

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

  const insertTemplate = (templateName: string) => {
    let tpl = '';
    if (templateName === '견적') {
      tpl = '\n[도입 견적 협의 내용]\n- 도입 규모: 50계정\n- 결제 주기: 연간 일괄/분기 분납\n- 특별 할인율 요청: 15% 검토\n- 전달 마감일: 이번 주 금요일까지';
    } else if (templateName === '기술') {
      tpl = '\n[기술 지원 및 장애 분석]\n- 발생 환경: 내부망 Linux 환경\n- 증상: 웹소켓 세션 10분 후 간헐적 타임아웃\n- 조치 계획: 패킷 덤프 수집 후 엔지니어 파견 분석';
    } else if (templateName === '콜백') {
      tpl = '\n[부재중 콜백 약속]\n- 고객 부재로 통화 미연결\n- 재통화 희망 일시: 당일 17:00 이후\n- 주요 문의: 정기 점검 일정 확인';
    }
    setMemoText((prev) => prev + tpl);
  };

  const handleSave = (isComplete: boolean) => {
    onSaveConsultation({
      categoryMain: mainCategory,
      categorySub: subCategory,
      status: isComplete ? 'completed' : status,
      selectedTags,
      memo: memoText,
      isComplete,
    });
    setLastSavedTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-900 min-w-0 select-none overflow-hidden">
      {/* 1. 상단 통화 컨트롤러 바 */}
      <div
        className={`px-5 py-3 border-b flex items-center justify-between transition-colors ${
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
            <span className="text-sm font-semibold text-slate-200">{customer.name}</span>
            <span className="text-xs text-slate-400 font-mono">{customer.phoneNumber}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
              WebRTC 음성
            </span>
          </div>

          {isOnHold && (
            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-semibold animate-pulse">
              통화 보류 중 (대기음 송출 중)
            </span>
          )}
          {isMuted && (
            <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-xs font-semibold">
              마이크 음소거 상태
            </span>
          )}
        </div>

        {/* Call Action Buttons */}
        <div className="flex items-center space-x-2">
          {isCallActive ? (
            <>
              {/* Mute Button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isMuted
                    ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title={isMuted ? '음소거 해제' : '마이크 음소거'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? '음소거됨' : '음소거'}</span>
              </button>

              {/* Hold Button */}
              <button
                onClick={() => setIsOnHold(!isOnHold)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isOnHold
                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title={isOnHold ? '보류 해제' : '통화 보류 (대기음)'}
              >
                {isOnHold ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                <span>{isOnHold ? '보류 해제' : '통화 보류'}</span>
              </button>

              {/* Transfer Forward Button */}
              <button
                onClick={onOpenTransfer}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="호전환 또는 타 부서 이관"
              >
                <PhoneForwarded className="w-4 h-4 text-indigo-400" />
                <span>호전환</span>
              </button>

              {/* End Call Button */}
              <button
                onClick={onEndCall}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950 transition-all"
              >
                <PhoneOff className="w-4 h-4" />
                <span>통화 종료</span>
              </button>
            </>
          ) : (
            <button
              onClick={onStartCall}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>통화 연결 (재발신)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 고객 요약 카드 */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/30">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-100">{customer.name}</h1>
              <span className="text-xs text-slate-400 font-medium">{customer.title}</span>
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
            </div>

            <div className="flex items-center space-x-4 text-xs text-slate-300">
              <div className="flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-200">{customer.company}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-slate-300">{customer.email}</span>
              </div>
              <div className="flex items-center space-x-1 text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>최근 상담: {customer.lastContactDate}</span>
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400">
            <div className="flex items-center space-x-1 justify-end">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>전담: {customer.managerName}</span>
            </div>
            <span className="text-[11px] text-slate-400">누적 상담 {customer.totalCalls}건</span>
          </div>
        </div>
      </div>

      {/* 3. 확장형 실시간 상담 메모 작성기 (핵심 워크스페이스) */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
        {/* Category & Status Selectors */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* 대분류 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              상담 대분류 <span className="text-rose-400">*</span>
            </label>
            <select
              value={mainCategory}
              onChange={(e) => setMainCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {consultationCategories.map((c) => (
                <option key={c.main} value={c.main}>
                  {c.main}
                </option>
              ))}
            </select>
          </div>

          {/* 중분류 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              상담 중분류 <span className="text-rose-400">*</span>
            </label>
            <select
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {consultationCategories
                .find((c) => c.main === mainCategory)
                ?.subs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* 처리 상태 */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              처리 상태 <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setStatus('in_progress')}
                className={`flex-1 py-1 rounded text-xs font-medium transition-all ${
                  status === 'in_progress'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                진행 중
              </button>
              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={`flex-1 py-1 rounded text-xs font-medium transition-all ${
                  status === 'completed'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                상담 완료
              </button>
              <button
                type="button"
                onClick={() => setStatus('escalated')}
                className={`flex-1 py-1 rounded text-xs font-medium transition-all ${
                  status === 'escalated'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                이관/에스컬
              </button>
            </div>
          </div>
        </div>

        {/* Quick Tag Chips */}
        <div className="mb-2.5 flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0 mr-1">
            <Tag className="w-3 h-3 text-slate-400" />
            빠른 태그:
          </span>
          {quickTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-0.5 rounded-full text-xs transition-all flex-shrink-0 ${
                  isSelected
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 font-medium'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:border-slate-600'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* Rich Editor Toolbar */}
        <div className="flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-t-xl px-3 py-1.5 text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              실시간 상담 기록
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <button
              type="button"
              onClick={() => setMemoText((prev) => prev + '\n- ')}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="글머리 기호 삽입"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMemoText((prev) => prev + ' **강조** ')}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="굵게 표시"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Template Inserts */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-slate-400">자주 쓰는 템플릿:</span>
            <button
              type="button"
              onClick={() => insertTemplate('견적')}
              className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] text-slate-200 transition-colors"
            >
              + 견적 협의
            </button>
            <button
              type="button"
              onClick={() => insertTemplate('기술')}
              className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] text-slate-200 transition-colors"
            >
              + 기술 장애
            </button>
            <button
              type="button"
              onClick={() => insertTemplate('콜백')}
              className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] text-slate-200 transition-colors"
            >
              + 부재 콜백
            </button>
          </div>
        </div>

        {/* Large Scrollable Textarea */}
        <div className="flex-1 relative border-x border-b border-slate-700 rounded-b-xl overflow-hidden bg-slate-950/80 focus-within:border-indigo-500 transition-colors">
          <textarea
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="통화 중 상담 내용, 고객 요구사항, 합의된 조치 사항을 상세히 기록하세요..."
            className="w-full h-full p-3.5 text-xs text-slate-200 bg-transparent resize-none focus:outline-none font-mono leading-relaxed select-text"
          />
        </div>
      </div>

      {/* 4. 하단 고정 액션 바 */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
          <Clock className="w-3.5 h-3.5" />
          <span>마지막 저장: {lastSavedTime}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">입력 글자 수: {memoText.length}자</span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Temporary Save */}
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Save className="w-3.5 h-3.5" />
            <span>임시 저장</span>
          </button>

          {/* Admin Escalation */}
          <button
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
            type="button"
            onClick={() => handleSave(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>상담 종료 및 완료</span>
          </button>
        </div>
      </div>
    </main>
  );
};
