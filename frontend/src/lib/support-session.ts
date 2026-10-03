export interface SupportRequest {
  organizationCode: string;
  requestId: string;
  customerName: string;
  companyName?: string;
  phoneNumber: string;
  customerType: 'INDIVIDUAL' | 'CORPORATE';
  inquiryType: string;
  message: string;
  channel: 'CALL' | 'CHAT';
}

export interface SupportSession {
  sessionId: string;
  queueCode: string;
  status: 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'CALL_ENDED';
  channel: 'CALL' | 'CHAT';
  assignedAgent: string;
  waitingCount: number;
  expiresAt: string;
}

export class SupportHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const supportStorageKey = (code: string) => `hellow_support_request:${code}`;

// Store before sending: an unknown POST result must retain its exact original body.
export function storeSupportRequest(request: SupportRequest) {
  sessionStorage.setItem(supportStorageKey(request.organizationCode), JSON.stringify(request));
}

export function loadSupportRequest(code: string): SupportRequest | null {
  const raw = sessionStorage.getItem(supportStorageKey(code));
  if (!raw) return null;
  let data:Partial<SupportRequest>;
  try {data = JSON.parse(raw) as Partial<SupportRequest>;}
  catch {throw new Error('보관된 접수 정보가 손상되었습니다. 기존 접수 여부를 확인한 뒤 브라우저의 이 사이트 세션 정보를 정리해 주세요.');}
  if (!data || typeof data !== 'object') throw new Error('보관된 접수 정보를 읽지 못했습니다.');
  if (data.organizationCode !== code || typeof data.requestId !== 'string' || !uuid.test(data.requestId)
    || !['CALL', 'CHAT'].includes(data.channel || '') || !['INDIVIDUAL', 'CORPORATE'].includes(data.customerType || '')
    || ['customerName', 'phoneNumber', 'inquiryType', 'message'].some(key => typeof data[key as keyof SupportRequest] !== 'string')
    || (data.companyName !== undefined && typeof data.companyName !== 'string')) {
    throw new Error('보관된 접수 정보를 읽지 못했습니다. 기존 접수 여부를 확인한 뒤 브라우저의 이 사이트 세션 정보를 정리해 주세요.');
  }
  return data as SupportRequest;
}

export async function supportJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {cache: 'no-store', ...options});
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: '접수 내용을 확인해 주세요.',
      404: '상담 접수 정보를 찾을 수 없습니다.',
      409: '상담 상태가 변경되었습니다. 현재 요청을 다시 확인해 주세요.',
      410: '접수 화면의 이용 시간이 만료되었습니다. 새 요청을 접수해 주세요.',
      429: '대기 요청이 많습니다. 잠시 후 같은 요청으로 다시 시도해 주세요.',
    };
    throw new SupportHttpError(response.status, messages[response.status] || '서버에 연결하지 못했습니다. 같은 요청으로 다시 시도해 주세요.');
  }
  try { return await response.json() as T; }
  catch { throw new Error('서버 응답을 확인하지 못했습니다. 같은 요청을 다시 확인해 주세요.'); }
}

export function validateSupportSession(value: SupportSession): SupportSession {
  if (!value || typeof value.sessionId !== 'string' || !value.sessionId || typeof value.queueCode !== 'string'
    || !['WAITING','PROCESSING','COMPLETED','CANCELLED','CALL_ENDED'].includes(value.status)
    || !['CALL','CHAT'].includes(value.channel) || !Number.isFinite(value.waitingCount)
    || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) {
    throw new Error('접수 상태 응답을 확인하지 못했습니다. 기존 요청을 다시 확인해 주세요.');
  }
  return value;
}

export async function prepareSupportMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('음성 상담은 HTTPS와 마이크 지원 브라우저가 필요합니다. 온라인 티켓을 선택할 수 있습니다.');
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  stream.getTracks().forEach(track => track.stop());
}
