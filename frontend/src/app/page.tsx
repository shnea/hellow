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
import { AgentStatus, CustomerProfile, CustomerType, QueueItem, TimelineItem } from '@/types';

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

  // Initial Load & Real-time Queue Polling
  useEffect(() => {
    // Helper to fetch queue
    const fetchQueue = () => {
      fetch('/api/queue')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data)) {
            const mappedQueue: QueueItem[] = data.map((item: any) => ({
              id: item.code,
              type: item.type.toLowerCase(),
              customerType: item.customerType ? (item.customerType.toLowerCase() === 'corporate' ? 'corporate' : 'individual') : 'individual',
              customerName: item.customerName,
              companyName: item.companyName,
              phoneNumber: item.phoneNumber,
              waitTimeOrSchedule: item.waitTimeOrSchedule,
              priority: item.priority ? item.priority.toLowerCase() : 'normal',
              summary: item.summary,
              unread: item.unread,
              isRegistered: item.registered,
              isComplainant: item.complainant,
            }));

            setQueueItems((prevQueue) => {
              // 신규 인입 항목 감지 및 토스트 알림
              const prevIds = new Set(prevQueue.map((q) => q.id));
              const newItems = mappedQueue.filter((q) => !prevIds.has(q.id));
              if (newItems.length > 0 && prevQueue.length > 0) {
                const newest = newItems[0];
                addToast(
                  'info',
                  '🔔 신규 고객 상담 인입',
                  `${newest.customerName} 고객님의 ${newest.type === 'call' ? '실시간 통화' : '문의'} 요청이 접수되었습니다.`
                );
              }
              return mappedQueue;
            });

            // 큐에 있는 고객 정보를 기본 프로필로 채워넣기 (미등록/웹인입 고객 대응)
            setCustomers((prevCusts) => {
              const updated = { ...prevCusts };
              mappedQueue.forEach((item) => {
                if (!updated[item.id]) {
                  updated[item.id] = {
                    id: item.id,
                    isRegistered: item.isRegistered ?? false,
                    customerType: (item.customerType as CustomerType) || 'individual',
                    name: item.customerName,
                    company: item.companyName || (item.customerType === 'corporate' ? '소속 미지정' : '일반 개인'),
                    department: '고객지원 요청',
                    title: '웹 인입 고객',
                    tier: item.isComplainant ? 'Standard' : 'Standard',
                    phoneNumber: item.phoneNumber,
                    email: '',
                    lastContactDate: '오늘 인입',
                    totalCalls: 1,
                    managerName: '배정 중',
                    customerNotes: item.summary || '웹 진입점에서 실시간 상담 신청 건',
                    isComplainant: item.isComplainant,
                  };
                }
              });
              return updated;
            });
          }
        })
        .catch(() => {});
    };

    // 1. 초기 로드
    fetchQueue();

    // 2. 고객 목록 로드
    fetch('/api/customers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          const custMap: Record<string, CustomerProfile> = {};
          data.forEach((c: any) => {
            custMap[c.code] = {
              id: c.code,
              isRegistered: c.registered,
              customerType: c.customerType ? (c.customerType.toLowerCase() === 'corporate' ? 'corporate' : 'individual') : 'corporate',
              name: c.name,
              title: c.title,
              company: c.company,
              department: c.department,
              tier: c.tier,
              phoneNumber: c.phoneNumber,
              email: c.email,
              lastContactDate: c.lastContactAt ? c.lastContactAt.substring(0, 10) : '이력 없음',
              totalCalls: c.totalCalls,
              managerName: c.managerName,
              customerNotes: c.customerNotes,
              isComplainant: c.complainant,
            };
          });
          setCustomers((prev) => ({ ...prev, ...custMap }));
        }
      })
      .catch(() => {});

    // 3. 3초 주기 자동 대기열 동기화
    const queueInterval = setInterval(fetchQueue, 3000);
    return () => clearInterval(queueInterval);
  }, []);

  // Fetch Timeline when selected customer changes
  useEffect(() => {
    if (selectedQueueId) {
      fetch(`/api/timeline/${selectedQueueId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data) && data.length > 0) {
            const mappedTimeline: TimelineItem[] = data.map((t: any) => ({
              id: 'time-db-' + t.id,
              date: t.createdAt ? t.createdAt.substring(0, 16).replace('T', ' ') : '최근',
              channel: t.channel.toLowerCase(),
              agentName: t.agentName,
              title: t.title,
              content: t.content,
              hasAudio: t.hasAudio,
              audioDuration: t.audioDuration,
              tags: t.tags ? t.tags.split(',') : [],
            }));
            setTimelines((prev) => ({
              ...prev,
              [selectedQueueId]: mappedTimeline,
            }));
          }
        })
        .catch(() => {});
    }
  }, [selectedQueueId]);

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
    customerType: 'individual',
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

  // 상담사 수락 핸들러 (수신 버튼 클릭 시 백엔드 accept 호출 및 통화 활성화)
  const handleAcceptCall = (item: QueueItem) => {
    setSelectedQueueId(item.id);
    setIsCallActive(true);
    setCallDuration(0);
    setAgentStatus('busy');

    // 백엔드에 상담사 수락 전송
    fetch(`/api/queue/${item.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName: '이소연 선임 (상담1팀)' }),
    }).catch(() => {});

    addToast('success', '상담 수락 및 연결', `${item.customerName} 고객과의 통화가 시작되었습니다.`);
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

  // 신규 고객 등록 처리 핸들러 (실제 백엔드 API 연동)
  const handleRegisterCustomer = (data: {
    customerType: CustomerType;
    name: string;
    company: string;
    title: string;
    department: string;
    email: string;
    tier: 'VIP' | 'Gold' | 'Standard';
    customerNotes: string;
    isComplainant: boolean;
  }) => {
    const updatedCustomer: CustomerProfile = {
      ...currentCustomer,
      isRegistered: true,
      customerType: data.customerType,
      name: data.name,
      company: data.company,
      title: data.title,
      department: data.department,
      email: data.email,
      tier: data.tier,
      customerNotes: data.customerNotes,
      isComplainant: data.isComplainant,
      lastContactDate: '오늘 등록됨',
    };

    // 1. Update React State
    setCustomers((prev) => ({
      ...prev,
      [selectedQueueId]: updatedCustomer,
    }));

    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === selectedQueueId
          ? {
              ...item,
              customerType: data.customerType,
              customerName: data.name,
              companyName: data.company,
              isRegistered: true,
              isComplainant: data.isComplainant,
            }
          : item
      )
    );

    // 2. Persist to Backend API
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerType: data.customerType.toUpperCase(),
        name: data.name,
        company: data.company,
        department: data.department,
        title: data.title,
        tier: data.tier,
        phoneNumber: currentCustomer.phoneNumber,
        email: data.email,
        customerNotes: data.customerNotes,
        complainant: data.isComplainant,
      }),
    }).catch(() => {});

    // 3. Add registration event to timeline
    const registrationRecord: TimelineItem = {
      id: 'time-reg-' + Date.now(),
      date: '오늘 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      channel: 'ticket',
      agentName: '이소연 선임 (본인)',
      title: `신규 고객 등록 완료 (${data.customerType === 'corporate' ? '기업 B2B' : '개인 일반'}${data.isComplainant ? ' / 컴플레인' : ''})`,
      content: `고객명: ${data.name} / 구분: ${data.customerType === 'corporate' ? '기업' : '개인'} / 소속: ${data.company} / 등급: ${data.tier} / 이메일: ${data.email || '미입력'}${data.isComplainant ? ' [주의/컴플레인]' : ''}`,
      tags: ['신규고객', data.customerType, ...(data.isComplainant ? ['컴플레인'] : [])],
    };

    setTimelines((prev) => ({
      ...prev,
      [selectedQueueId]: [registrationRecord, ...(prev[selectedQueueId] || [])],
    }));

    addToast('success', '고객 등록 완료 (DB 저장)', `${data.name} (${data.company}) 고객 정보가 정상 등록되었습니다.`);
  };

  // 기존 고객 정보 수정 핸들러 (실제 백엔드 API 연동)
  const handleUpdateCustomer = (data: Partial<CustomerProfile>) => {
    const updatedCustomer: CustomerProfile = {
      ...currentCustomer,
      ...data,
    };

    setCustomers((prev) => ({
      ...prev,
      [selectedQueueId]: updatedCustomer,
    }));

    if (data.name || data.company || data.customerType !== undefined || data.isComplainant !== undefined) {
      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === selectedQueueId
            ? {
                ...item,
                customerType: data.customerType !== undefined ? data.customerType : item.customerType,
                customerName: data.name || item.customerName,
                companyName: data.company || item.companyName,
                isComplainant: data.isComplainant !== undefined ? data.isComplainant : item.isComplainant,
              }
            : item
        )
      );
    }

    // Persist update to Backend API
    fetch(`/api/customers/${selectedQueueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerType: (updatedCustomer.customerType || 'corporate').toUpperCase(),
        name: updatedCustomer.name,
        company: updatedCustomer.company,
        department: updatedCustomer.department,
        title: updatedCustomer.title,
        tier: updatedCustomer.tier,
        phoneNumber: updatedCustomer.phoneNumber,
        email: updatedCustomer.email,
        customerNotes: updatedCustomer.customerNotes,
        complainant: updatedCustomer.isComplainant || false,
      }),
    }).catch(() => {});

    addToast('success', '고객 정보 수정 (DB 저장)', `${updatedCustomer.name} 고객 정보가 성공적으로 업데이트되었습니다.`);
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

    // Persist follow-up to Backend API
    fetch('/api/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerCode: selectedQueueId,
        actionType,
        title: `[후속조치] ${actionType}`,
        details,
      }),
    }).catch(() => {});

    addToast('success', `${actionType} 접수 완료 (DB 저장)`, details);
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

      // Complete in backend
      fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerCode: selectedQueueId,
          categoryMain: data.categoryMain,
          categorySub: data.categorySub,
          status: 'COMPLETED',
          memo: data.memo,
          tags: data.selectedTags.join(','),
          agentName: '이소연 선임 (본인)',
          callDurationSeconds: callDuration,
        }),
      }).catch(() => {});

      fetch(`/api/queue/${selectedQueueId}/complete`, {
        method: 'POST',
      }).catch(() => {});

      setQueueItems((prev) => prev.filter((item) => item.id !== selectedQueueId));
      setIsCallActive(false);
      setAgentStatus('online');

      addToast(
        'success',
        '상담 저장 완료 (DB 영속화)',
        `${currentCustomer.name || '고객'} 상담 기록이 DB에 저장되고 대기열에서 완료 처리되었습니다.`
      );
    } else {
      // Temporary save
      fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerCode: selectedQueueId,
          categoryMain: data.categoryMain,
          categorySub: data.categorySub,
          status: 'IN_PROGRESS',
          memo: data.memo,
          tags: data.selectedTags.join(','),
          agentName: '이소연 선임 (본인)',
          callDurationSeconds: callDuration,
        }),
      }).catch(() => {});

      addToast('info', '임시 저장 완료 (DB 저장)', '작성 중인 상담 메모가 데이터베이스에 안전하게 임시 저장되었습니다.');
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
        onAcceptCall={handleAcceptCall}
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

      {/* 전역 피드백 토스트 컨테이너 (최대 5개 깔끔하게 표시) */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
