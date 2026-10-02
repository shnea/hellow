export type AgentStatus = 'online' | 'busy' | 'away' | 'offline';

export type QueueItemType = 'call' | 'callback' | 'ticket';

export interface QueueItem {
  id: string;
  type: QueueItemType;
  customerName: string;
  companyName: string;
  phoneNumber: string;
  waitTimeOrSchedule: string;
  priority: 'urgent' | 'normal' | 'low';
  summary: string;
  unread?: boolean;
  isRegistered?: boolean;
}

export interface CustomerProfile {
  id: string;
  isRegistered: boolean;
  name: string;
  title: string;
  company: string;
  department?: string;
  tier: 'VIP' | 'Gold' | 'Standard';
  phoneNumber: string;
  email: string;
  lastContactDate: string;
  totalCalls: number;
  managerName: string;
  customerNotes?: string;
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
