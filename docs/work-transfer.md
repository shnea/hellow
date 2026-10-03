# 상담 업무·통화 이관 계약

요구사항 30장의 두 이관 책임을 구분한다. 예약 업무의 담당 재배정은 [예약 계약](followup-scheduling.md)을 유지한다. 이 문서는 구현할 계약이며 실제 구현·검수·배포 여부는 [인계](handoff.md)와 [진행표](mvp-progress.md)에 기록한다.

## 상담 업무 이관

- 같은 조직의 활성 직원에게 저장된 Consultation의 처리 책임을 요청한다. 독립 고객 기록·완료 접수의 기록·처리 중 TICKET/통화 종료 후 후처리가 대상이다. 진행 중 음성 연결은 아래 통화 이관 계약을 거쳐야 한다.
- 별도 `consultation:transfer`와 현재 원본의 조회/작성 범위를 검사한다. 본인 업무의 직원 요청을 기본으로 하고, 조직 전체 관리자는 같은 기능의 범위 안에서 다른 직원의 업무를 요청할 수 있다. 최고관리자 지위만으로 내용을 읽거나 이관하지 못한다. `transfer:read`로 본인이 보낸/받은 요청과 허용된 팀/조직의 이관 이력을 조회한다.
- 대상은 수락 뒤 해당 원본을 조회·작성할 현재 실효 권한이 있는 같은 조직의 활성 Membership이다. 담당자가 달라질 때 SELF 권한을 가진 직원도 자신에게 배정된 기록을 처리할 수 있으며, 이관 제안만으로 상담 본문이나 첨부 권한을 부여하지 않는다. 진행 중 접수의 이관 대상은 같은 조직에서 현재 대기 중이고 수신/후속 업무/다른 이관 예약이 없는 직원이다. 비실시간 기록은 로그인/대기 상태를 수락 조건으로 강제하지 않는다.
- UUID v4와 원본/대상/사유/메모/표시한 원본 버전을 전송 전에 보관한다. 조직·요청 Identity·UUID 기준 동일 본문은 같은 요청으로 복원하고 변경 본문은 409다. 원본당 활성 요청은 하나이며 동시 생성·수락·취소는 기존 전역 배정 잠금 → 조직 → 원본 순서로 직렬화한다.
- `OFFERED` 동안 원본 담당과 저장 문서가 유지된다. 대상만 명시적으로 `ACCEPTED` 처리하며, 성공 시 현재 담당/팀과 필요한 PROCESSING 접수 담당을 원자적으로 갱신한다. 원본 문서/분류/결과/고객/작성자 표시값·생성 시각과 기존 타임라인은 바꾸지 않는다. 담당자 변경 전후를 별도 이관 이력에 남긴다. 대기열 업무의 현재 담당 변경은 전체 Conversation 내 새 작업 권한과 파일 경계를 함께 검사한다.
- 거절/요청자 취소/기한 만료·권한 회수/원본 종료/변경은 기존 담당자를 유지한다. 원본 버전이 달라졌으면 새 값을 조용히 채택하지 않고 `FAILED` 결과를 기록해 새 요청을 요구한다. 표시 버전이 오래된 직원 명령은 409이고 입력을 보존한다. 재시작 후에도 미결/종료 상태와 책임이 남는다.
- 비실시간 요청의 수락 기한은 10분, PROCESSING 접수의 요청은 30초다. 만료/회수 worker와 명령 시점 재검사를 함께 사용한다. 이관 요청/처리 사유·전후 담당·요청자·수행자·시각을 보존하며 일반 관리자 감사에는 상담 본문·메모를 넣지 않는다.
- 완료 접수의 기록만 이관할 때 원래 접수/타임라인의 작성 당시 소유권을 바꾸지 않는다. 원본 접수 첨부는 현재 해당 상담 기록의 읽기 권한으로도 접근할 수 있어야 하며, 원래 접수만 읽을 수 있다는 이유로 새 담당자가 수정한 상담 전문을 노출하지 않는다.

## 실시간 통화 이관

- 업무 담당자 ID 변경을 성공 증거로 사용하지 않는다. 동일 조직에서 가능한 상담사에게 제안하고, 대상의 명시적 수락과 Media 서버의 실제 연결 확인 후 책임을 확정한다.
- 제안/연결 단계에서는 기존 상담사와 고객의 통화 및 업무 책임을 유지하고, 대상을 다른 ACD/예약 업무에서 예약한다. 연결 실패·거절·시간 초과·현재 권한 회수 시 대상의 임시 연결/예약을 정리하고 기존 통화로 복구한다.
- Media 공급자 호출과 DB 상태 변경 사이의 실패·재시작을 처리할 지속 상태/재시도와 전후 이력이 필요하다. 완료 후 이전 상담사의 토큰 갱신을 거부하고 실제 참가자를 제거한다. 기존 발급 토큰의 재접속 가능 기간에도 제거를 재시도한다.
- 고객 종료와 이관 수락/확정의 경합, 대상 연결 확인 전에 원본을 끝내는 경로, 연결 확인 후 DB 확정 실패, 기존 참가자 제거 실패를 검증해야 한다. 실제 두 사람 음성 수락은 사용자가 미뤄 둔 [진행표](mvp-progress.md)의 WebRTC 검수에 남아 있다.

### V15 서버 연결 확인과 복구

- 기존 요청·이력에 `kind=WORK/CALL`을 추가한다. WORK의 기존 요청 fingerprint를 유지하므로 V14에서 전송한 UUID의 재시도도 복원한다. 같은 UUID를 다른 kind로 전송하면 409다. 새 CALL 요청도 기존 목록·상세·수행 이력·거절/취소 경로를 사용한다.
- 본인이 처리 중인 미종료 CALL의 저장 원본에서만 제안한다. 같은 조직의 현재 AVAILABLE/heartbeat·조회/작성/수락 권한을 가진 직원을 선택하며 다른 배정·후속 업무·이관 예약을 중복 확보하지 않는다. 조직 관리자라도 다른 직원의 진행 중 통화를 대신 이관하지 못한다.
- 제안 30초 안에 대상이 명시적으로 수락하면 `CONNECTING`으로 바뀌고 연결 확인 기한은 그 시점부터 20초다. 수락 사유를 저장하지만 접수/원본 담당·문서는 유지한다. OFFERED와 CONNECTING 모두 같은 SQL 부분 unique index와 ACD/후속 업무/조직 전환 예약 검사에 포함한다. 기한이 지나도 최종 상태를 저장할 때까지 예약을 유지한다.
- CONNECTING의 정확한 대상·현재 권한·표시 버전만 임시 Media 토큰을 발급받는다. 동일 방의 `transfer-{요청 UUID}` Identity로 2분 유효·마이크만 게시·구독 허용하며 클라이언트에 Room Admin 권한을 주지 않는다. 원본 전문 접근은 담당 확정 전 허용하지 않는다.
- 서버는 LiveKit `GetParticipant`로 임시 대상의 ACTIVE 상태·마이크 트랙·SID, 기존 상담사와 고객의 ACTIVE 상태를 확인한다. JOINED 소켓·클라이언트 성공 표시·업무 담당 변경은 확인 근거가 아니다. [공식 참가자/트랙 정의](https://github.com/livekit/protocol/blob/main/protobufs/livekit_models.proto)와 [Room Service 계약](https://github.com/livekit/protocol/blob/main/protobufs/livekit_room.proto)을 따른다. ACTIVE/트랙 증거는 실제 사람이 음성을 들었음을 증명하지 않는다.
- 확인 뒤 같은 트랜잭션에서 원본/접수 담당·현재 Media Identity·확인 SID/시각과 ACCEPTED/이력을 저장한다. 기존 문서·작성자·생성 시각·분류/결과/고객 스냅샷은 유지한다. 기존 상담사는 새 토큰을 받지 못하고 새 담당은 임시 연결 때의 동일 Identity로 토큰을 갱신한다. 이전 연결을 다른 Identity로 재생성하지 않는 화면 연결이 필요하다.
- provider 조회 장애는 CONNECTING을 유지하며 2초 worker와 대상의 확인 재시도로 복구한다. worker도 저장된 CONNECTING을 재시작 후 확인할 수 있다. 현재 권한/가용·원본 버전·기존 통화 종료를 매번 재검사하며 실패/만료/취소 시 기존 책임을 유지한다. DB 쓰기 실패는 확인 메타데이터와 담당 변경까지 롤백한다.
- 별도 Media cleanup은 ACCEPTED의 이전 Identity, 다른 최종 상태의 임시 대상 Identity를 제거한다. 마지막 발급 가능 시점부터 180초 동안 성공해도 반복 제거하고, 공급자 장애가 이어지면 그 기한 뒤에도 성공할 때까지 재시도한다. 성공 후 완료 플래그를 저장하며 CRM 확정 트랜잭션 안에서 제거하지 않는다. 일반 통화 종료의 기존 cleanup 계약은 별도다.

| 경로 | 입력·동작 |
| --- | --- |
| `POST /api/transfers/call` | 업무 요청과 같은 입력. 본인의 활성 통화에서 CALL/OFFERED 생성 |
| `GET /api/transfers/call-assignees?consultationId=…` | 활성 통화의 현재 선택 가능한 직원 |
| `POST /api/transfers/{id}/accept` | CALL은 expectedVersion/reason으로 CONNECTING 진입. ACCEPTED로 표시하지 않음 |
| `POST /api/transfers/{id}/media-token` | expectedVersion. `{transfer,media}` 응답이며 현재 CONNECTING만 임시 토큰 반환. 최종 상태는 media=null, 제안 상태는 409 |
| `POST /api/transfers/{id}/confirm-media` | expectedVersion. 서버 참가자 증거와 현재 원본/권한 재검사 후 CONNECTING 또는 최종 상태 반환 |

ACCEPTED 이후에는 최신 본인 접수와 기존 임시 Media 연결을 유지하고 일반 접수 토큰을 사용한다. 종료 응답에서 media=null이면 새 임시 토큰을 만들지 않는다. 현재 버전과 terminal 상태를 채택하지 않고 연결을 무조건 재시도하는 화면은 허용하지 않는다. 이 서버 계약의 구현/검수와 미연결 화면·미배포 여부는 [인계](handoff.md)에 구분한다.

## 업무 이관 API

모든 직원 요청은 현재 로그인 Identity와 `X-Organization-ID`를 사용한다. 응답의 capability는 현재 권한과 상태를 반영하며, 제안에 원본 상담 본문은 포함하지 않는다.

| 경로 | 입력·동작 |
| --- | --- |
| `POST /api/transfers/work` | consultationId/expectedRecordVersion/toMemberId/reason/memo/requestId(UUID v4). 원본을 유지한 OFFERED 생성·같은 요청 복원 |
| `GET /api/transfers/request/{requestId}` | 현재 조직·요청 Identity의 기존 요청 또는 빈 성공 응답. 쓰기 없음 |
| `GET /api/transfers?status=OFFERED&direction=RECEIVED&page=0` | direction=ALL(기본)/SENT/RECEIVED. 현재 조회 범위 안에서 요청자/수신자의 issuer·subject로 제한한 뒤 50건 items/page/hasMore 반환 |
| `GET /api/transfers/{id}` | 현재 요청과 version/canAccept/canReject/canCancel/canReadRecord |
| `GET /api/transfers/{id}/history?page=0` | 현재 조회 범위로 제한한 수행 이력, 페이지당 50건 |
| `GET /api/transfers/assignees?consultationId=…` | 현재 원본을 이관할 수 있는 직원만 조회. 실제 선택 가능한 활성 memberId/name/teamId |
| `POST /api/transfers/{id}/accept` | expectedVersion/reason. 대상만 수락, 현재 원본/권한 재검사 후 담당 원자 변경 |
| `POST /api/transfers/{id}/reject` | expectedVersion/reason. 대상만 거절, 원본 담당 유지 |
| `POST /api/transfers/{id}/cancel` | expectedVersion/reason. 현재 원본 이관 권한이 있는 요청자/기존 담당/조직 관리자 취소 |
| `GET /api/consultations/{id}` | 현재 상담 읽기 범위의 원본과 processing/editable 반환. 진행 중 접수는 독립 기록 편집 경로에서 수정할 수 없음. 독립 기록도 직접 열 수 있으며 제안 수신이나 고객 조회 권한으로 본문 접근을 확대하지 않음 |

- 표시한 요청 version이 다르면 409다. 처리 시점에 원본 변경·권한 회수·만료를 발견하면 기존 담당을 유지하며 FAILED/REVOKED/EXPIRED를 저장하고 해당 최종 상태를 성공 응답으로 반환한다. 클라이언트는 HTTP 성공만으로 수락 성공을 표시하지 않고 반환 status를 확인해야 한다.
- 같은 수행자가 이미 성공한 같은 명령을 다시 보내면 기록된 결과를 반환한다. 다른 종료 명령은 409이며 수락 뒤 원본을 다시 넘기는 동작은 새 UUID 요청으로 수행한다.
- V14는 현재 담당 이름과 실시간 업무 예약 플래그·Identity당 활성 실시간 대상 unique index를 추가한다. 진행 중 이관 대상은 `TRANSFER_PENDING`이고 ACD 자동/직접 수신, 후속 업무 시작 및 조직 변경을 차단한다. workTransferId는 현재 조직일 때만 보인다. 자리비움/오프라인은 허용하고 worker가 해당 요청의 권한/가용 변경을 기록한다.
- 2초 worker는 별도 조직별 트랜잭션으로 미결 요청을 재검사한다. 업무 이관으로 종료 통화의 후처리 담당자가 달라져도 원래 참가자 Identity를 이관 이력에서 찾아 기존 통화의 cleanup 기한까지 Media 제거를 재시도한다. 이 경로는 활성 통화의 Media 이관 구현을 뜻하지 않는다.
- 기한이 지났더라도 EXPIRED 등 최종 결과를 저장하기 전까지 실시간 대상 예약을 유지한다. 가용 검사와 SQL unique index의 미결 조건(V14 OFFERED, V15 OFFERED/CONNECTING)을 일치시켜, 다른 조직에서 아직 저장되지 않은 만료를 무시하고 같은 Identity를 중복 확보하지 않는다. worker 또는 직원 명령이 최종 결과를 저장하면 예약이 해제된다.

## 단계별 구현

프런트엔드 전송 모듈과 요청 폼은 조직·issuer·subject·원본별 sessionStorage key로 요청을 전송 전에 보관한다. `/api/me`가 반환한 검증된 issuer를 사용한다. 응답 불명 재시도는 기존 UUID를 GET하고 없을 때만 동일 본문을 재전송한다. 저장소 손상/실패·복원 거부·409·잘못된 성공 응답에서는 보관값을 지우거나 다른 ID를 만들지 않는다. 실제 조직/원본/version/status 확인 후 보관값을 해제하며 FAILED 같은 종료 결과도 그대로 반환한다. 확정 거부 후 입력 수정도 GET으로 미접수를 확인한 뒤 허용한다.

받은/보낸/허용 범위의 목록과 상세·수행 이력에서 현재 서버 capability로 처리한다. 409에서는 처리 사유와 표시 버전을 유지하고 직원이 명시적으로 최신 상태를 채택한다. 종료·회수된 요청은 처리 성공으로 바꾸지 않는다. 원문 열기는 현재 상담 조회 권한을 다시 검사하며 진행 중 업무는 최신 대기열의 본인 접수로, 독립/완료 기록은 정확한 기록 ID로 이동한다. 요청 전 변경한 문서·분류·결과·태그는 먼저 저장해야 한다.

실시간 업무 이관의 받은 요청은 큰 모달로 표시하고 응답 전 새 수신과 조직 변경을 차단한다. 직원이 자리비움/오프라인을 선택하는 경로는 유지한다. 화면을 닫았다 다시 열어도 미전송 입력을 보존하며, 원본 담당 변경 후 남은 본인의 미저장 입력은 읽기/복사할 수 있게 표시한다. 이는 새 담당의 현재 본문 접근 권한을 주는 기능이 아니다. 별도 합성 조직·PostgreSQL 및 실제 브라우저의 검수와 개발 반영 여부는 [인계](handoff.md)에 둔다.

먼저 상담 업무 요청·수락·거절·취소·만료/회수·원본 보존의 서버 계약을 구현·검수한다. 이어 실제 직원·받은/보낸 이관 목록과 충돌 입력 보존 화면을 연결하고 웹/API를 함께 반영한다. 실시간 통화 이관은 Media 확인/복구 계약까지 구현해야 하며 앞의 업무 이관만으로 전체 목표를 완료 처리하지 않는다.
