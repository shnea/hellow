'use client';

import React, { useState } from 'react';
import {
  History,
  Phone,
  Mail,
  MessageSquare,
  Ticket,
  Quote,
  CalendarCheck,
  PhoneForwarded,
  Send,
  CalendarPlus,
  Play,
  User,
  Clock,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { TimelineItem, TimelineChannel } from '../types';
import { transferAgents } from '../data/mockData';

interface ContextActionPanelProps {
  timeline: TimelineItem[];
  customerName: string;
  customerPhone: string;
  onQuoteTimeline: (content: string) => void;
  onAddFollowUpAction: (actionType: string, details: string) => void;
  activeFollowUpTab?: 'visit' | 'callback' | 'transfer' | 'notification';
}

export const ContextActionPanel: React.FC<ContextActionPanelProps> = ({
  timeline,
  customerName,
  customerPhone,
  onQuoteTimeline,
  onAddFollowUpAction,
  activeFollowUpTab = 'visit',
}) => {
  // Timeline channel filter
  const [channelFilter, setChannelFilter] = useState<TimelineChannel>('all');

  // Follow-up sub-tabs
  const [subTab, setSubTab] = useState<'visit' | 'callback' | 'transfer' | 'notification'>(
    activeFollowUpTab
  );

  // Form states for Visit Reservation
  const [visitType, setVisitType] = useState('기술 컨설팅 및 아키텍처 실사');
  const [visitDate, setVisitDate] = useState('2026-04-06');
  const [visitTime, setVisitTime] = useState('14:00');
  const [assignedEngineer, setAssignedEngineer] = useState('박성현 수석 (인프라팀)');

  // Form states for Callback Schedule
  const [callbackDate, setCallbackDate] = useState('2026-04-04');
  const [callbackTime, setCallbackTime] = useState('16:00');
  const [callbackReason, setCallbackReason] = useState('대표이사 최종 견적서 검토 후 콜백 통화');

  // Notification template state
  const [notificationTpl, setNotificationTpl] = useState('상담 요약 및 견적서 열람 링크');

  // Filtered timeline
  const filteredTimeline = timeline.filter((item) => {
    if (channelFilter === 'all') return true;
    return item.channel === channelFilter;
  });

  const getChannelIcon = (ch: TimelineItem['channel']) => {
    switch (ch) {
      case 'call':
        return <Phone className="w-3.5 h-3.5 text-rose-400" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-blue-400" />;
      case 'chat':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ticket':
        return <Ticket className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const handleVisitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddFollowUpAction(
      '엔지니어 방문 예약',
      `일시: ${visitDate} ${visitTime} / 엔지니어: ${assignedEngineer} / 목적: ${visitType}`
    );
  };

  const handleCallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddFollowUpAction(
      '콜백 일정 등록',
      `일시: ${callbackDate} ${callbackTime} / 사유: ${callbackReason}`
    );
  };

  const handleTransfer = (agentName: string, dept: string) => {
    onAddFollowUpAction(
      '실시간 호전환 완료',
      `${dept} ${agentName} 상담사에게 통화 세션 호전환`
    );
  };

  const handleNotificationSend = () => {
    onAddFollowUpAction(
      '알림톡/SMS 발송',
      `템플릿: [${notificationTpl}] -> ${customerPhone} 발송 완료`
    );
  };

  return (
    <aside className="w-96 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col h-full select-none">
      {/* 1. 상단: 고객 상담 통합 타임라인 헤더 & 필터 */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <History className="w-4 h-4 text-indigo-400" />
            <span>상담 통합 타임라인</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
              {timeline.length}건
            </span>
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">{customerName} 이력</span>
        </div>

        {/* Channel Filter Chips */}
        <div className="flex items-center space-x-1 text-xs">
          {[
            { id: 'all', label: '전체' },
            { id: 'call', label: '전화' },
            { id: 'email', label: '메일' },
            { id: 'chat', label: '채팅' },
            { id: 'ticket', label: '티켓' },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannelFilter(ch.id as TimelineChannel)}
              className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                channelFilter === ch.id
                  ? 'bg-slate-700 text-slate-100 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-slate-900/60">
        {filteredTimeline.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            해당 채널의 과거 상담 이력이 없습니다.
          </div>
        ) : (
          filteredTimeline.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl relative group hover:border-slate-700 transition-colors"
            >
              {/* Card Top */}
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center space-x-1.5">
                  <span className="p-1 rounded bg-slate-800">{getChannelIcon(item.channel)}</span>
                  <span className="font-semibold text-slate-200">{item.agentName}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{item.date}</span>
              </div>

              {/* Title */}
              <h4 className="font-semibold text-xs text-slate-100 mb-1 leading-snug">
                {item.title}
              </h4>

              {/* Content */}
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-2 rounded-lg border border-slate-800/60 mb-2">
                {item.content}
              </p>

              {/* Tags & Action */}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1 overflow-hidden">
                  {item.hasAudio && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded border border-rose-500/20 font-mono">
                      <Play className="w-2.5 h-2.5" />
                      {item.audioDuration}
                    </span>
                  )}
                  {item.tags?.map((tg) => (
                    <span key={tg} className="text-slate-400">
                      #{tg}
                    </span>
                  ))}
                </div>

                {/* Quote button */}
                <button
                  onClick={() => onQuoteTimeline(item.content)}
                  className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900 text-[11px] font-medium flex items-center gap-1 transition-all"
                  title="중앙 상담 메모장에 인용문으로 추가"
                >
                  <Quote className="w-3 h-3" />
                  <span>인용</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 2. 하단: 연계 후속 조치 패널 (핵심 차별화 영역) */}
      <div className="border-t border-slate-800 bg-slate-950/90 flex flex-col">
        {/* Follow-up Sub Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-800 text-[11px] font-medium">
          <button
            onClick={() => setSubTab('visit')}
            className={`py-2 px-1 text-center border-b-2 transition-all ${
              subTab === 'visit'
                ? 'border-indigo-500 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            방문 예약
          </button>
          <button
            onClick={() => setSubTab('callback')}
            className={`py-2 px-1 text-center border-b-2 transition-all ${
              subTab === 'callback'
                ? 'border-indigo-500 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            콜백 등록
          </button>
          <button
            onClick={() => setSubTab('transfer')}
            className={`py-2 px-1 text-center border-b-2 transition-all ${
              subTab === 'transfer'
                ? 'border-indigo-500 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            호전환
          </button>
          <button
            onClick={() => setSubTab('notification')}
            className={`py-2 px-1 text-center border-b-2 transition-all ${
              subTab === 'notification'
                ? 'border-indigo-500 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            알림 발송
          </button>
        </div>

        {/* Tab Content 1: 방문/서비스 예약 */}
        {subTab === 'visit' && (
          <form onSubmit={handleVisitSubmit} className="p-3 space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                방문 유형
              </label>
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="기술 컨설팅 및 아키텍처 실사">기술 컨설팅 및 아키텍처 실사</option>
                <option value="현장 시스템 세팅 및 포트 설정">현장 시스템 세팅 및 포트 설정</option>
                <option value="대표이사 최종 라이선스 계약 미팅">대표이사 최종 라이선스 계약 미팅</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  희망 일자
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  희망 시간
                </label>
                <input
                  type="time"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                배정 엔지니어
              </label>
              <select
                value={assignedEngineer}
                onChange={(e) => setAssignedEngineer(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="박성현 수석 (인프라팀)">박성현 수석 (인프라팀 - 실시간 가능)</option>
                <option value="정재원 수석 (네트워크팀)">정재원 수석 (네트워크팀)</option>
                <option value="한도윤 매니저 (기술영업)">한도윤 매니저 (기술영업)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-950 transition-all mt-1"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>방문 예약 접수 및 캘린더 등록</span>
            </button>
          </form>
        )}

        {/* Tab Content 2: 콜백 일정 등록 */}
        {subTab === 'callback' && (
          <form onSubmit={handleCallbackSubmit} className="p-3 space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  재통화 일자
                </label>
                <input
                  type="date"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  재통화 시간
                </label>
                <input
                  type="time"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                콜백 사유 및 안건
              </label>
              <input
                type="text"
                value={callbackReason}
                onChange={(e) => setCallbackReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-amber-950 transition-all mt-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>대기열 콜백 큐 등록</span>
            </button>
          </form>
        )}

        {/* Tab Content 3: 호전환 / 타 부서 이관 */}
        {subTab === 'transfer' && (
          <div className="p-3 space-y-2 text-xs">
            <p className="text-[11px] text-slate-400">
              실시간 가용 상담사를 선택하여 원클릭으로 통화를 호전환합니다.
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {transferAgents.map((ag) => (
                <div
                  key={ag.id}
                  className="p-2 bg-slate-800/80 rounded-lg border border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-slate-200">{ag.name}</span>
                      <span className="text-[11px] text-slate-400">내선 {ag.ext}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          ag.status === 'available'
                            ? 'bg-emerald-400'
                            : ag.status === 'busy'
                            ? 'bg-rose-400'
                            : 'bg-amber-400'
                        }`}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400">{ag.department}</span>
                  </div>

                  <button
                    disabled={ag.status !== 'available'}
                    onClick={() => handleTransfer(ag.name, ag.department)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                      ag.status === 'available'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>호전환</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 4: 고객 안내 발송 */}
        {subTab === 'notification' && (
          <div className="p-3 space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                알림톡 템플릿 선택
              </label>
              <select
                value={notificationTpl}
                onChange={(e) => setNotificationTpl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="상담 요약 및 견적서 열람 링크">상담 요약 및 견적서 열람 링크</option>
                <option value="엔지니어 방문 예약 확정 안내">엔지니어 방문 예약 확정 안내</option>
                <option value="재통화 콜백 예약 접수 확인">재통화 콜백 예약 접수 확인</option>
                <option value="사내 포트 설정 가이드 다운로드 링크">사내 포트 설정 가이드 링크</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                수신 대상
              </label>
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 font-mono text-xs flex justify-between">
                <span>{customerName}</span>
                <span>{customerPhone}</span>
              </div>
            </div>

            <button
              onClick={handleNotificationSend}
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-950 transition-all mt-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>알림톡/SMS 즉시 발송</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
