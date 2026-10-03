export type AgentStatus = 'online' | 'busy' | 'away' | 'offline';

export type QueueItemType = 'call' | 'callback' | 'ticket';
export type CustomerType = 'corporate' | 'individual';

export interface QueueItem {
  id: string;
  customerCode?: string | null;
  status?: 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  assignedSubject?: string | null;
  assignedAgent?: string | null;
  callEnded?: boolean;
  version?: number;
  type: QueueItemType;
  customerType?: CustomerType;
  customerName: string;
  companyName: string;
  phoneNumber: string;
  waitTimeOrSchedule: string;
  priority: 'urgent' | 'normal' | 'low';
  summary: string;
  unread?: boolean;
  isRegistered?: boolean;
  isComplainant?: boolean;
}

export interface CustomerProfile {
  canEdit?:boolean;
  id: string;
  isRegistered: boolean;
  customerType: CustomerType; // 'corporate': 기업 고객, 'individual': 일반/개인 고객
  name: string;
  title?: string;
  company?: string;
  department?: string;
  tier: 'VIP' | 'Gold' | 'Standard';
  phoneNumber: string;
  email: string;
  lastContactDate: string;
  totalCalls: number;
  managerName: string;
  customerNotes?: string;
  isComplainant?: boolean; // 불만/컴플레인 주의 고객 플래그
}

export type TimelineChannel = 'all' | 'call' | 'email' | 'chat' | 'ticket';

export interface TimelineItem {
  id: string;
  date: string;
  channel: 'call' | 'email' | 'chat' | 'ticket';
  agentName: string;
  title: string;
  content: string;
  hasAudio?: boolean;
  audioDuration?: string;
  tags?: string[];
}

export interface ConsultationCategory {
  main: string;
  subs: string[];
}

export interface FollowUpActionForm {
  type: 'visit' | 'callback' | 'transfer' | 'notification';
  title: string;
  status: 'pending' | 'completed';
  timestamp: string;
}
