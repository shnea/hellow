'use client';

import React, { useState, useEffect } from 'react';
import { SidebarGNB } from '@/components/SidebarGNB';
import { QueuePanel } from '@/components/QueuePanel';
import { ActiveWorkspace } from '@/components/ActiveWorkspace';
import { ContextActionPanel } from '@/components/ContextActionPanel';
import { ToastContainer, ToastMessage } from '@/components/Toast';
import {
  mockQueueItems,
  mockCustomers,
  mockTimelines,
} from '@/data/mockData';
import { AgentStatus, QueueItem, TimelineItem } from '@/types';

export default function ConsultationWorkspacePage() {
  // Global GNB state
  const [currentTab, setCurrentTab] = useState<string>('workspace');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('busy');

  // Queue and Customer state
  const [queueItems, setQueueItems] = useState<QueueItem[]>(mockQueueItems);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('queue-1');

  // Call status
  const [isCallActive, setIsCallActive] = useState<boolean>(true);
  const [callDuration, setCallDuration] = useState<number>(252); // Starts at 04:12

  // Timeline and Context state
  const [timelines, setTimelines] = useState<Record<string, TimelineItem[]>>(mockTimelines);
  const [quotedText, setQuotedText] = useState<string>('');
  const [activeFollowUpTab, setActiveFollowUpTab] = useState<'visit' | 'callback' | 'transfer' | 'notification'>('visit');

  // Toast feedback state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Add toast helper
  const addToast = (type: 'success' | 'info' | 'warning', title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Live timer for active call
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Current customer profile
  const currentCustomer = mockCustomers[selectedQueueId] || mockCustomers['queue-1'];
  const currentTimeline = timelines[selectedQueueId] || [];

  // Handlers
  const handleSelectQueueItem = (id: string) => {
    setSelectedQueueId(id);
    const targetItem = queueItems.find((i) => i.id === id);
    if (targetItem) {
      if (targetItem.type === 'call') {
        setIsCallActive(true);
        setCallDuration(14);
        setAgentStatus('busy');
        addToast('info', '통화 연결', `${targetItem.customerName} 고객과의 인바운드 통화 세션이 활성화되었습니다.`);
      } else {
        setIsCallActive(false);
        setAgentStatus('online');
        addToast('info', '고객 맥락 전환', `${targetItem.customerName} 고객의 대기 작업 정보로 전환되었습니다.`);
      }
    }
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    setAgentStatus('online');
    addToast('warning', '통화 종료', '통화가 종료되었습니다. 상담 내용 정리 후 완료 처리를 진행해 주세요.');
  };

  const handleStartCall = () => {
    setIsCallActive(true);
    setCallDuration(0);
    setAgentStatus('busy');
    addToast('success', '통화 발신', `${currentCustomer.name} (${currentCustomer.phoneNumber}) 고객에게 재발신 연결되었습니다.`);
  };

  const handleOpenTransfer = () => {
    setActiveFollowUpTab('transfer');
    addToast('info', '호전환 패널 활성화', '우측 패널에서 실시간 가용 상담사를 선택하여 호전환할 수 있습니다.');
  };

  const handleQuoteTimeline = (content: string) => {
    setQuotedText(content);
    addToast('info', '이력 인용 완료', '과거 상담 이력이 중앙 실시간 메모장에 추가되었습니다.');
  };

  const handleAddFollowUpAction = (actionType: string, details: string) => {
    // Add new timeline record
    const newRecord: TimelineItem = {
      id: 'time-new-' + Date.now(),
      date: '오늘 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      channel: actionType.includes('호전환') ? 'call' : actionType.includes('알림톡') ? 'chat' : 'ticket',
      agentName: '이소연 선임 (본인)',
      title: `[후속조치] ${actionType}`,
      content: details,
      tags: ['후속연계', actionType.split(' ')[0]],
    };

    setTimelines((prev) => ({
      ...prev,
      [selectedQueueId]: [newRecord, ...(prev[selectedQueueId] || [])],
    }));

    addToast('success', `${actionType} 접수 완료`, details);
  };

  const handleSaveConsultation = (data: {
    categoryMain: string;
    categorySub: string;
    status: string;
    selectedTags: string[];
    memo: string;
    isComplete: boolean;
  }) => {
    if (data.isComplete) {
      // Record completed consultation in timeline
      const completeRecord: TimelineItem = {
        id: 'time-complete-' + Date.now(),
        date: '오늘 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        channel: 'call',
        agentName: '이소연 선임 (본인)',
        title: `상담 완료: ${data.categorySub}`,
        content: `[분류: ${data.categoryMain} > ${data.categorySub}]\n${data.memo}`,
        tags: data.selectedTags.map((t) => t.replace('#', '')),
      };

      setTimelines((prev) => ({
        ...prev,
        [selectedQueueId]: [completeRecord, ...(prev[selectedQueueId] || [])],
      }));

      // Remove or mark queue item
      setQueueItems((prev) => prev.filter((item) => item.id !== selectedQueueId));
      setIsCallActive(false);
      setAgentStatus('online');

      addToast(
        'success',
        '상담 저장 및 완료',
        `${currentCustomer.name} 고객 상담 기록이 완료되고 대기열에서 처리 완료되었습니다.`
      );
    } else {
      addToast(
        'info',
        '임시 저장 완료',
        '작성 중인 상담 메모 및 분류 정보가 로컬 세션에 안전하게 저장되었습니다.'
      );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased select-none">
      {/* 1. 최좌측 글로벌 내비게이션 바 (64px) */}
      <SidebarGNB
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        agentStatus={agentStatus}
        onAgentStatusChange={setAgentStatus}
      />

      {/* 2. 대기열 패널 (Queue, 320px) */}
      <QueuePanel
        queueItems={queueItems}
        selectedQueueId={selectedQueueId}
        onSelectQueueItem={handleSelectQueueItem}
      />

      {/* 3. 중앙 활성 상담 워크스페이스 (유연 확장, ~48%) */}
      <ActiveWorkspace
        customer={currentCustomer}
        callDuration={callDuration}
        isCallActive={isCallActive}
        onEndCall={handleEndCall}
        onStartCall={handleStartCall}
        onOpenTransfer={handleOpenTransfer}
        onSaveConsultation={handleSaveConsultation}
        quotedText={quotedText}
        onClearQuotedText={() => setQuotedText('')}
      />

      {/* 4. 우측 고객 맥락 및 후속 조치 패널 (384px) */}
      <ContextActionPanel
        timeline={currentTimeline}
        customerName={currentCustomer.name}
        customerPhone={currentCustomer.phoneNumber}
        onQuoteTimeline={handleQuoteTimeline}
        onAddFollowUpAction={handleAddFollowUpAction}
        activeFollowUpTab={activeFollowUpTab}
      />

      {/* 전역 피드백 토스트 컨테이너 */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
