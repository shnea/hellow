export interface ReportOptions {
  members:{id:number;name:string;teamId:string|null}[];teams:{id:string;name:string}[];
  categories?:{id:string;name:string}[];results?:{id:string;name:string}[];hasMore:boolean;scope:string;
}
export type Metrics=Record<string,number>;
export interface ReportSection {totals:Metrics;items:{[column:string]:number|string|null;label:string;key:string|number|null}[];hasMore:boolean;page:number;}
export interface ConsultationReport {asOf:string;from:string;until:string;timeZone:string;scope:string;definitionVersion:number;report:{queues:ReportSection;records:ReportSection;trends?:ReportSection;channels?:ReportSection;attempts:{label:string;count:number}[];transfers:{accepted:number}};}
export interface FollowUpReport {asOf:string;report:ReportSection;}
export interface AgentReport {asOf:string;scope:string;items:{memberId:number;name:string;teamId:string|null;state:string;heartbeatAt:string|null;heartbeatExpiresAt:string|null;leaseExpired:boolean}[];hasMore:boolean;page:number;}
export interface MonitoringSummary {asOf:string;scope:string;queues:{status:string;count:number}[];callbacks:{status:string;count:number}[];}
export const reportLabels:Record<string,string>={
  received:'접수',waiting:'대기',processing:'처리 중',completed:'완료',cancelled:'취소',accepted:'수락',connected:'음성 연결',
  unconnected:'미연결 종료',automatic_callbacks:'자동 콜백',unregistered:'미등록',ongoing_calls:'진행 통화',records:'상담 문서',
  in_progress:'진행 중',escalated:'이관 상태',callbacks:'콜백',pending:'미배정',assigned:'담당 지정',scheduled:'예약',failed:'실패',
  CALL:'음성',TICKET:'온라인 문의',CALLBACK:'콜백',RECORD:'독립 기록',WAITING:'대기',PROCESSING:'처리 중',COMPLETED:'완료',CANCELLED:'취소',
  PENDING:'미배정',ASSIGNED:'담당 지정',SCHEDULED:'예약',IN_PROGRESS:'진행 중',FAILED:'실패',ESCALATED:'이관 상태',
};
export function reportingLabel(value:string){
  if(reportLabels[value])return reportLabels[value];
  try {const path=JSON.parse(value);if(Array.isArray(path))return path.join(' / ');}catch{/* Plain labels and dates. */}
  return value;
}
export function reportingDate(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function nextReportingDay(day:string){const d=new Date(`${day}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
export function seconds(value:number){return `${Math.round(value).toLocaleString('ko-KR')}초`;}
