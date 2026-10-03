'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Phone,
  Mail,
  MessageSquare,
  Ticket,
  Quote,
  Send,
  Maximize2,
} from 'lucide-react';
import { TimelineItem, TimelineChannel } from '../types';
import {FollowUpRequestForm} from './followup/FollowUpRequestForm';
import {RecordingIcon} from './RecordingIcon';
import type {FollowUp} from '@/lib/followup';

interface ContextActionPanelProps {
  timeline: TimelineItem[];
  organizationId:string;identityKey:string;queueCode:string;
  onFollowUpCreated:(task:FollowUp)=>void;onOpenFollowUps:()=>void;
  readOnly?: boolean;
  customerName: string;
  customerPhone: string;
  onQuoteTimeline: (item: TimelineItem) => void;
  onOpenDetail?:(item:TimelineItem)=>void;canQuote?:boolean;
  onAddFollowUpAction: (actionType: string, details: string) => void;
  onRequestTransfer?:()=>void;transferDisabled?:boolean;transferIsCall?:boolean;
  activeFollowUpTab?: 'visit' | 'callback' | 'transfer' | 'notification';
}

export const ContextActionPanel: React.FC<ContextActionPanelProps> = ({
  timeline, readOnly=false,organizationId,identityKey,queueCode,onFollowUpCreated,onOpenFollowUps,
  customerName,
  customerPhone,
  onQuoteTimeline,onOpenDetail,canQuote=false,
  onAddFollowUpAction,
  onRequestTransfer,transferDisabled=true,transferIsCall=false,
  activeFollowUpTab = 'visit',
}) => {
  // Timeline channel filter
  const [channelFilter, setChannelFilter] = useState<TimelineChannel>('all');

  // Follow-up sub-tabs
  const [subTab, setSubTab] = useState<'visit' | 'callback' | 'transfer' | 'notification'>(
    activeFollowUpTab
  );

  useEffect(() => {
    // Synchronize the explicit transfer action from the call bar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubTab(activeFollowUpTab);
  },[activeFollowUpTab]);
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



  const handleNotificationSend = () => {
    onAddFollowUpAction(
      '알림톡/SMS 발송',
      `템플릿: [${notificationTpl}] -> ${customerPhone} 발송 미연동`
    );
  };

  return (
    <aside className="relative w-96 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col h-full select-none">
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
            { id: 'ticket', label: '문의' },
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
              onDoubleClick={event=>{if((event.target as HTMLElement).closest('button'))return;onOpenDetail?.(item);}}
                tabIndex={0} role="button" onKeyDown={event => {if(event.target!==event.currentTarget)return;if(event.key === "Enter"||event.key===' '){event.preventDefault();onOpenDetail?.(item);}}}
              className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl relative group hover:border-slate-700 transition-colors cursor-pointer select-none"
              title="더블 클릭으로 상세 보기"
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

              {/* Content with Max Height & Double Click Preview */}
              <div className="relative bg-slate-900/60 p-2 rounded-lg border border-slate-800/70 mb-2 overflow-hidden group/content">
                <p className="text-xs text-slate-300 leading-relaxed max-h-20 overflow-hidden line-clamp-3 break-words whitespace-pre-wrap">
                  {item.content}
                </p>
                {item.content.length > 70 && (
                  <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex items-end justify-center pb-0.5 pointer-events-none">
                    <span className="text-[10px] text-indigo-400 font-medium tracking-tight flex items-center gap-0.5">
                      <Maximize2 className="w-2.5 h-2.5" />
                      더블 클릭으로 상세 보기
                    </span>
                  </div>
                )}
              </div>

              {/* Tags & Action */}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1 overflow-hidden">
                  <RecordingIcon status={item.recordingStatus||(item.hasAudio?'READY':undefined)}/>
                  {item.tags?.map((tg) => (
                    <span key={tg} className="text-slate-400">
                      #{tg}
                    </span>
                  ))}
                </div>

                {/* Quote button */}
                {canQuote&&<button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuoteTimeline(item);
                  }}
                  className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900 text-[11px] font-medium flex items-center gap-1 transition-all"
                  title="중앙 상담 메모장에 인용문으로 추가"
                >
                  <Quote className="w-3 h-3" />
                  <span>인용</span>
                </button>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 2. 하단: 연계 후속 조치 패널 (핵심 차별화 영역) */}
      <div className="followup-context-actions border-t border-slate-800 bg-slate-950/90 flex flex-col">
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

        {(subTab==='visit'||subTab==='callback')&&<FollowUpRequestForm
          key={`${organizationId}:${identityKey}:${queueCode}:${subTab}`}
          organizationId={organizationId} identityKey={identityKey} queueCode={queueCode}
          actionType={subTab==='visit'?'VISIT':'CALLBACK'} disabled={readOnly}
          onCreated={onFollowUpCreated} onOpenList={onOpenFollowUps}/>}

        {subTab === 'transfer' && <div className="p-4 space-y-3 text-sm">
          <p className="text-slate-300">{transferIsCall?'현재 통화를 대기 중인 직원에게 요청합니다. 수락과 음성 연결 확인까지 기존 통화를 유지합니다.':'저장된 상담 업무를 다른 직원에게 요청합니다. 수락 전까지 현재 담당자가 계속 맡습니다.'}</p>
          <button disabled={transferDisabled||!onRequestTransfer} onClick={onRequestTransfer} className="min-h-11 px-3 py-2 bg-indigo-700 text-white rounded-lg disabled:opacity-50">{transferIsCall?'통화 이관 직원 선택':'업무 이관 직원 선택'}</button>
            <p className="text-slate-300">작성 내용은 요청 전에 임시 저장합니다. 상담을 완료할 필요가 없습니다.</p>
        </div>}

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
              disabled title="메시지 발송 미연동" onClick={handleNotificationSend}
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
