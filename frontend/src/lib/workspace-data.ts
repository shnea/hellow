import type { CustomerProfile, QueueItem, TimelineItem } from '@/types';

export interface ServerQueue { assignedDisplayName?:string;
  code: string; customerCode: string | null; type: string; customerType: string;
  customerName: string; companyName: string | null; phoneNumber: string;
  waitTimeOrSchedule: string; priority: QueueItem['priority']; summary: string;
  unread: boolean; registered: boolean; complainant: boolean;
  status: QueueItem['status']; assignedSubject: string | null; assignedAgent: string | null;
  callStartedAt?:string|null;callEndedAt?:string|null;mediaMissingSince?:string|null;
  callEnded: boolean; version: number;mediaAgentIdentity?:string|null;
  chatEnabled?:boolean;chatEndedAt?:string|null;
  offer?:QueueItem['offer'];canAccept?:boolean;routingPaused?:boolean;attemptCount?:number;
}
export interface ServerCustomer {
  code: string; registered: boolean; customerType: string; name: string; title: string;
  company: string; department: string; tier: CustomerProfile['tier']; phoneNumber: string;
  email: string; lastContactAt: string | null; totalCalls: number; managerName: string;
  customerNotes: string; complainant: boolean;
  editable?:boolean;
  consultationVersion?:number;
}
export function queueItem(q: ServerQueue): QueueItem {
  return { id: q.code, customerCode: q.customerCode, type: q.type.toLowerCase() as QueueItem['type'],
    customerType: q.customerType === 'CORPORATE' ? 'corporate' : 'individual', customerName: q.customerName,
    companyName: q.companyName || '', phoneNumber: q.phoneNumber, waitTimeOrSchedule: q.waitTimeOrSchedule,
    priority: q.priority, summary: q.summary, unread: q.unread, isRegistered: q.registered,
    isComplainant: q.complainant, status: q.status, assignedSubject: q.assignedSubject,
    assignedAgent: q.assignedDisplayName||q.assignedAgent, callEnded: q.callEnded,callStartedAt:q.callStartedAt,callEndedAt:q.callEndedAt,mediaMissingSince:q.mediaMissingSince, version: q.version,mediaAgentIdentity:q.mediaAgentIdentity,
    chatEnabled:q.chatEnabled,chatEndedAt:q.chatEndedAt,
    offer:q.offer,canAccept:q.canAccept,routingPaused:q.routingPaused,attemptCount:q.attemptCount };
}
export function customerProfile(c: ServerCustomer): CustomerProfile {
  return { id: c.code, isRegistered: c.registered, customerType: c.customerType === 'CORPORATE' ? 'corporate' : 'individual',
    name: c.name, title: c.title, company: c.company, department: c.department, tier: c.tier,
    phoneNumber: c.phoneNumber, email: c.email || '', lastContactDate: c.lastContactAt?.slice(0, 10) || '이력 없음',
    totalCalls: c.totalCalls, managerName: c.managerName, customerNotes: c.customerNotes, isComplainant: c.complainant,canEdit:c.editable };
}
export function requestProfile(q: QueueItem): CustomerProfile {
  return { id: `request:${q.id}`, isRegistered: false, customerType: q.customerType || 'individual', name: q.customerName,
    company: q.companyName, phoneNumber: q.phoneNumber, email: '', tier: 'Standard', lastContactDate: '첫 접수',
    totalCalls: 0, managerName: q.assignedAgent || '미배정', customerNotes: q.summary, isComplainant: q.isComplainant };
}
export interface ServerTimeline { recordId?:number;recordingStatus?:string; queueCode?:string|null; id: number; createdAt: string; channel: string; agentName: string; title: string; content: string; hasAudio: boolean; audioDuration: string; tags: string | null; }
export function timelineItem(t: ServerTimeline): TimelineItem {
  return { id: String(t.id),recordId:t.recordId,recordingStatus:t.recordingStatus, queueCode:t.queueCode, date: new Date(t.createdAt).toLocaleString('ko-KR'), channel: t.channel.toLowerCase() as TimelineItem['channel'],
    agentName: t.agentName, title: t.title, content: t.content, hasAudio: t.hasAudio, audioDuration: t.audioDuration, tags: t.tags?.split(',') || [] };
}
export interface ConsultationDraft {
  categoryMain: string; categorySub: string; categoryId?:string|null; categoryPath?:string[]; resultId?:string|null; resultName?:string; status: string; selectedTags: string[]; memo: string;
}
