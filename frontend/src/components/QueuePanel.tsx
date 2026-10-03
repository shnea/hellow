'use client';

import React, { useState } from 'react';
import { PhoneIncoming, CalendarClock, TicketCheck, PhoneCall, Filter } from 'lucide-react';
import { QueueItem, QueueItemType } from '../types';

interface QueuePanelProps {
  queueItems: QueueItem[];
  selectedQueueId: string;
  onSelectQueueItem: (id: string) => void;
  onAcceptCall?: (item: QueueItem) => void;
  callBlocked?: boolean;
  onReject?:(item:QueueItem)=>void;
  assignmentHistory?:React.ReactNode;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queueItems,
  selectedQueueId,
  onSelectQueueItem,
  onAcceptCall,
  callBlocked=false,
  onReject,assignmentHistory,
}) => {
  const [filterType, setFilterType] = useState<'all' | QueueItemType>('all');

  const filteredItems = queueItems.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const liveCallCount = queueItems.filter((i) => i.type === 'call').length;
  const callbackCount = queueItems.filter((i) => i.type === 'callback').length;
  const ticketCount = queueItems.filter((i) => i.type === 'ticket').length;

  return (
    <section className="queue-panel w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <span>처리 대기열</span>
            <span className="px-1.5 py-0.5 text-[11px] rounded-full bg-indigo-500/20 text-indigo-400 font-semibold">
              {queueItems.length}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>필터</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-4 gap-1 text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={`py-1.5 px-2 rounded-lg text-center font-medium transition-all ${
            filterType === 'all'
              ? 'bg-slate-800 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          전체 <span className="text-[10px] text-slate-400">({queueItems.length})</span>
        </button>
        <button
          onClick={() => setFilterType('call')}
          className={`py-1.5 px-1 rounded-lg text-center font-medium transition-all relative ${
            filterType === 'call'
              ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          {liveCallCount > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          )}
          콜 <span className="text-[10px] text-rose-400">({liveCallCount})</span>
        </button>
        <button
          onClick={() => setFilterType('callback')}
          className={`py-1.5 px-1 rounded-lg text-center font-medium transition-all ${
            filterType === 'callback'
              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          콜백 <span className="text-[10px] text-amber-400">({callbackCount})</span>
        </button>
        <button
          onClick={() => setFilterType('ticket')}
          className={`py-1.5 px-1 rounded-lg text-center font-medium transition-all ${
            filterType === 'ticket'
              ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          티켓 <span className="text-[10px] text-indigo-400">({ticketCount})</span>
        </button>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
        {filteredItems.map((item) => {
          const isSelected = selectedQueueId === item.id;
          const isLiveCall = item.type === 'call';

          return (
            <div
              key={item.id}
              onClick={() => onSelectQueueItem(item.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative text-left group ${
                isSelected
                  ? 'bg-slate-800/90 border-indigo-500/80 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              } ${isLiveCall ? 'border-l-4 border-l-rose-500' : ''}`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-1.5">
                  {item.type === 'call' && item.status === 'WAITING' && onAcceptCall && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800/40 animate-pulse">
                      <PhoneIncoming className="w-3 h-3 text-rose-400" />
                      실시간 콜
                    </span>
                  )}
                  {item.type === 'callback' && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-800/40">
                      <CalendarClock className="w-3 h-3 text-amber-400" />
                      콜백 예약
                    </span>
                  )}
                  {item.type === 'ticket' && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-800/40">
                      <TicketCheck className="w-3 h-3 text-indigo-400" />
                      할당 티켓
                    </span>
                  )}

                  {item.priority === 'urgent' && (
                    <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded font-bold border border-rose-500/30">
                      긴급
                    </span>
                  )}

                  {item.isComplainant && (
                    <span className="text-[10px] bg-rose-950/70 text-rose-300 px-1.5 py-0.5 rounded font-bold border border-rose-700/60 animate-pulse">
                      컴플레인
                    </span>
                  )}

                  {item.customerType === 'individual' && (
                    <span className="text-[10px] bg-cyan-950/50 text-cyan-300 px-1.5 py-0.5 rounded font-medium border border-cyan-800/40">
                      개인
                    </span>
                  )}

                  {item.isRegistered === false && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-semibold border border-amber-500/40">
                      미등록
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  {item.waitTimeOrSchedule}
                </span>
              </div>

              {/* Customer Info */}
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-100 text-sm">{item.customerName}</span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                    {item.companyName}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{item.phoneNumber}</span>
              </div>

              {/* Summary */}
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {item.summary}
              </p>

              {/* Action Buttons */}
              {item.status === 'PROCESSING' && <p className="mt-2 text-xs text-slate-300">{item.assignedAgent || '담당 상담사'} · {item.callEnded ? '후처리 중' : '처리 중'}</p>}
              {item.status==='WAITING'&&<p className="queue-routing-status">{item.offer?`${item.offer.name}에게 수신 배정 · ${item.offer.received?'화면 확인됨':'수신 확인 중'}`:item.routingPaused?'배정 시도 한도에 도달했습니다. 이력에서 배정을 다시 시작할 수 있습니다.':'상담 가능한 직원을 기다리고 있습니다.'}</p>}
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-indigo-400 font-medium group-hover:underline">
                  {isSelected ? '현재 워크스페이스 활성' : '클릭하여 상담 열기 →'}
                </span>

                {item.status === 'WAITING' && onAcceptCall && (
                  <button
                    disabled={item.canAccept!==true||callBlocked}
                    title={callBlocked?'현재 상담과 후처리를 완료해 주세요.':item.canAccept!==true?'대기 상태와 현재 수신 배정을 확인해 주세요.':undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectQueueItem(item.id);
                      if (onAcceptCall) onAcceptCall(item);
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm shadow-rose-950 active:scale-95 transition-all"
                  >
                    <PhoneCall className="w-3 h-3" />
                    {item.type === 'call' ? '수신' : '상담 수락'}
                  </button>
                )}
                {item.status==='WAITING'&&item.offer&&item.canAccept&&onReject&&<button className="queue-reject" onClick={event=>{event.stopPropagation();onReject(item);}}>거절</button>}
                {item.type === 'callback' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectQueueItem(item.id);
                    }}
                    className="px-2 py-0.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-600/50 rounded text-[11px] font-medium transition-colors"
                  >
                    요청 보기
                  </button>
                )}
              </div>
              {isSelected&&assignmentHistory&&<div onClick={event=>event.stopPropagation()}>{assignmentHistory}</div>}
            </div>
          );
        })}
      </div>

      {/* Queue Footer status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>대기열 주기 조회</span>
        </div>
        <span className="text-slate-400">{queueItems.length}건</span>
      </div>
    </section>
  );
};
