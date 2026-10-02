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
import { AgentStatus, CustomerProfile, QueueItem, TimelineItem } from '@/types';

export default function ConsultationWorkspacePage() {
  // Global GNB state
  const [currentTab, setCurrentTab] = useState<string>('workspace');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('busy');

  // Queue and Customer state
  const [queueItems, setQueueItems] = useState<QueueItem[]>(mockQueueItems);
  const [customers, setCustomers] = useState<Record<string, CustomerProfile>>(mockCustomers);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('queue-1');

  // Call status
  const [isCallActive, setIsCallActive] = useState<boolean>(true);
  const [callDuration, setCallDuration] = useState<number>(252); // Starts at 04:12

  // Timeline and Context state
  const [timelines, setTimelines] = useState<Record<string, TimelineItem[]>>(mockTimelines);
  const [quotedText, setQuotedText] = useState<string>('');
  const [activeFollowUpTab, setActiveFollowUpTab] = useState<'visit' | 'callback' | 'transfer' | 'notification'>('visit');

  // Toast feedback state (up to 5 toasts)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Add toast helper - retains up to 5 recent toasts
  const addToast = (type: 'success' | 'info' | 'warning', title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
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
  const currentCustomer = customers[selectedQueueId] || {
    id: 'unknown',
    isRegistered: false,
    name: '미등록 고객',
    company: '알 수 없음',
    title: '',
    tier: 'Standard',
    phoneNumber: '010-0000-0000',
    email: '',
    lastContactDate: '이력 없음',
    totalCalls: 1,
    managerName: '이소연 선임',
  };
  const currentTimeline = timelines[selectedQueueId] || [];

  // Handlers
  const handleSelectQueueItem = (id: string) => {
    setSelectedQueueId(id);
    const targetItem = queueItems.find((i) => i.id === id);
    if (targetItem) {
      if (targetItem.type === 'call') {
        setIsCallActive(true);
        setCallDuration(targetItem.id === 'queue-unregistered' ? 45 : 14);
        setAgentStatus('busy');
      } else {
        setIsCallActive(false);
        setAgentStatus('online');
      }
    }
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    setAgentStatus('online');
    addToast('warning', '통화 종료', '통화가 종료되었습니다. 상담 내용을 저장해 주세요.');
  };

  const handleStartCall = () => {
    setIsCallActive(true);
    setCallDuration(0);
    setAgentStatus('busy');
    addToast('success', '통화 연결', `${currentCustomer.phoneNumber} 고객에게 재발신 연결되었습니다.`);
  };

  const handleOpenTransfer = () => {
    setActiveFollowUpTab('transfer');
  };

  const handleQuoteTimeline = (content: string) => {
    setQuotedText(content);
    addToast('info', '이력 인용', '과거 상담 내용이 실시간 메모장에 인용되었습니다.');
  };

  // 신규 고객 등록 처리 핸들러
  const handleRegisterCustomer = (data: {
    name: string;
    company: string;
    title: string;
    department: string;
    email: string;
    tier: 'VIP' | 'Gold' | 'Standard';
    customerNotes: string;
  }) => {
    const updatedCustomer: CustomerProfile = {
      ...currentCustomer,
      isRegistered: true,
      name: data.name,
      company: data.company,
      title: data.title,
      department: data.department,
      email: data.email,
      tier: data.tier,
      customerNotes: data.customerNotes,
      lastContactDate: '오늘 등록됨',
    };

    // Update customer store
    setCustomers((prev) => ({
      ...prev,
      [selectedQueueId]: updatedCustomer,
    }));

    // Update queue item
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === selectedQueueId
          ? {
              ...item,
              customerName: data.name,
              companyName: data.company,
              isRegistered: true,
            }
          : item
      )
    );

    // Add registration event to timeline
    const registrationRecord: TimelineItem = {
      id: 'time-reg-' + Date.now(),
      date: '오늘 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      channel: 'ticket',
      agentName: '이소연 선임 (본인)',
      title: '신규 고객 정보 등록 완료',
      content: `고객명: ${data.name} / 소속: ${data.company} (${data.department} ${data.title}) / 등급: ${data.tier} / 이메일: ${data.email || '미입력'}`,
      tags: ['신규고객', '등록완료'],
    };

    setTimelines((prev) => ({
      ...prev,
      [selectedQueueId]: [registrationRecord, ...(prev[selectedQueueId] || [])],
    }));

    addToast('success', '고객 등록 완료', `${data.name} (${data.company}) 고객 정보가 정상 등록되었습니다.`);
  };

  // 기존 고객 정보 수정 핸들러
  const handleUpdateCustomer = (data: Partial<CustomerProfile>) => {
    const updatedCustomer: CustomerProfile = {
      ...currentCustomer,
      ...data,
    };

    setCustomers((prev) => ({
      ...prev,
      [selectedQueueId]: updatedCustomer,
    }));

    // Update queue item if name or company changed
    if (data.name || data.company) {
      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === selectedQueueId
            ? {
                ...item,
                customerName: data.name || item.customerName,
                companyName: data.company || item.companyName,
              }
            : item
        )
      );
    }

    addToast('success', '고객 정보 수정', `${updatedCustomer.name} 고객 정보가 성공적으로 업데이트되었습니다.`);
  };

  const handleAddFollowUpAction = (actionType: string, details: string) => {
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

      setQueueItems((prev) => prev.filter((item) => item.id !== selectedQueueId));
      setIsCallActive(false);
      setAgentStatus('online');

      addToast(
        'success',
        '상담 저장 완료',
        `${currentCustomer.name || '고객'} 상담 기록이 저장되고 대기열에서 완료 처리되었습니다.`
      );
    } else {
      addToast('info', '임시 저장 완료', '작성 중인 상담 메모가 안전하게 임시 저장되었습니다.');
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
        onRegisterCustomer={handleRegisterCustomer}
        onUpdateCustomer={handleUpdateCustomer}
        quotedText={quotedText}
        onClearQuotedText={() => setQuotedText('')}
      />

      {/* 4. 우측 고객 맥락 및 후속 조치 패널 (384px) */}
      <ContextActionPanel
        timeline={currentTimeline}
        customerName={currentCustomer.name || '미등록 고객'}
        customerPhone={currentCustomer.phoneNumber}
        onQuoteTimeline={handleQuoteTimeline}
        onAddFollowUpAction={handleAddFollowUpAction}
        activeFollowUpTab={activeFollowUpTab}
      />

      {/* 전역 피드백 토스트 컨테이너 (최대 1개 깔끔하게 표시) */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
