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
}

export interface CustomerProfile {
  id: string;
  name: string;
  title: string;
  company: string;
  tier: 'VIP' | 'Gold' | 'Standard';
  phoneNumber: string;
  email: string;
  lastContactDate: string;
  totalCalls: number;
  managerName: string;
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
