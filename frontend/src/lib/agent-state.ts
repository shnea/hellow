export type Availability='AVAILABLE'|'AWAY'|'OFFLINE';
export type AgentState=Availability|'RESERVED'|'RINGING'|'CALLING'|'AFTER_CALL'|'FOLLOW_UP';
export interface AgentView {
  state:AgentState;availability:Availability;version:number;activeOrganizationId:string;
  heartbeatExpiresAt:string|null;availableSince:string|null;queueCode:string|null;
  attemptId:string|null;offerExpiresAt:string|null;followUpId?:number|null;
}
export const agentStateLabels:Record<AgentState,string>={
  AVAILABLE:'상담 대기',AWAY:'자리비움',OFFLINE:'오프라인',RESERVED:'수신 배정 중',RINGING:'응답 대기',CALLING:'상담 중',AFTER_CALL:'후처리 중',FOLLOW_UP:'후속 업무 처리 중',
};
export const attemptLabels:Record<string,string>={
  OFFERED:'수신 제안',RINGING:'화면 수신 확인',ACCEPTED:'상담 수락',REJECTED:'상담 거절',MISSED:'미수신',TIMED_OUT:'응답 시간 초과',
  OFFLINE:'수신 중지·부재',REVOKED:'권한 회수',ORGANIZATION_CHANGED:'작업 조직 변경',CANCELLED:'고객 취소·접수 종료',
};
