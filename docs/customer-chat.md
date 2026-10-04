# 고객 실시간 채팅 계약

2026-10-04 F02. 기존 공개 온라인 문의의 새 CHAT 접수를 고객과 상담사 간 텍스트 대화로 확장한다. 실제 검증·배포 상태는 [인계](handoff.md)에 둔다.

## 업무·데이터

- 공개 접수와 ACD의 한 Identity 한 업무 배정을 재사용한다. 접수 Queue가 1:1 대화 aggregate다. 신규 공개 CHAT만 `chatEnabled=true`와 최초 문의 메시지를 같은 트랜잭션으로 생성한다. 기존 단건 문의의 대화를 소급 생성하지 않는다.
- 메시지는 별도 `chat_messages`에 원문·서버 sequence·발신 종류·발신 표시명·clientMessageId·시각을 보존한다. 접수 잠금으로 전송·종료·이관을 직렬화한다. `(queue,senderKey,clientMessageId)` 중복 제거와 `(queue,sequence)` 순서를 DB가 보장한다. 같은 ID의 다른 본문은409다.
- 종료 후 같은 메시지 재시도는 저장된 원문이 같을 때 기존 ACK를 반환한다. 신규 전송은 거부한다. 채팅 종료는 PROCESSING을 완료로 바꾸지 않으며 상담 문서 저장·후처리 완료를 별도로 수행한다. 미종료 채팅의 상담 완료는409다.
- 대기 중에는 최초 문의와 상태를 볼 수 있고, 양방향 전송은 수락 후 가능하다. 음성의30초 콜백 정책을 적용하지 않는다. 기존24시간 고객 세션 만료를 유지하고 만료 대화는 닫되 직원 후처리·문서·메시지를 삭제하지 않는다. 종료 후 재개는 없으며 명시적 새 문의는 새 접수다.
- 텍스트는1~10000자이며 고객 이미지 첨부는 아래 계약을 따른다. 일반 파일·상담사 이미지 전송·읽음·입력 중·수정/삭제·동시 여러 채팅은 후속 범위다. 메시지를 상담 문서에 자동 덮어쓰지 않는다. 기존 음성·마이크·자동 콜백과 보류된 고객 피드백/태블릿 패널은 유지한다.

## API·전달·권한

- HTTP POST 명령과 fetch로 읽는 SSE를 사용한다. WebSocket 기반을 추가하지 않고 기존 OIDC/HTTP 인증과 메시지 저장 서비스를 공유하기 위해 선택했다. SSE는1초 주기 committed DB 조회이며 Redis 등 일시 전달을 원본으로 사용하지 않는다. `afterSequence` 이후 최대100건을 순서대로 복원하고 추가 페이지를 읽는다.
- 고객은 `/api/support/chat/{messages,events,end}`에 `X-Support-Session`으로 기존 capability를 보낸다. 직원은 `/api/chat/{queueCode}/{messages,events,end}`의 Authorization와 X-Organization-ID를 사용한다. 토큰/capability를 URL query에 넣지 않는다. 응답은no-store, SSE는프록시 buffering을 끈다.
- 직원 읽기는 `queue:read`와 현재 조직·소유 범위/이관 참여를 확인한다. 이력의 `history=true` 조회는 `consultation:read` 범위를 사용한다. 쓰기/종료는 `queue:accept` 범위와 현재 담당 issuer/subject, 상태를 확인한다. 이전 담당은 허용된 참여 읽기만 유지한다. 고객 DTO에 내부 메모·상담 문서·직원 Identity key를 포함하지 않는다.
- 모든 SSE 전달 때 활성 조직·Membership·실효 권한/범위를 재확인한다. 고객 만료/조직 중지 또는 직원 권한 회수/토큰 만료 때 구독을 닫는다. 연결은60초마다 갱신해 직원 토큰을 새로 얻으며 재접속은 DB cursor에서 복원한다. 연결당100건 배치, 동일 고객/직원4개·전체2000개 상한은 자원 보호 한도이며 성능 수락 수치가 아니다.

## 화면·복구

- 기존 slate/indigo·글꼴·버튼·고객 공개 브랜딩을 확장한다. 고객은 대화/연결 상태/접수 취소/종료를 확인한다. 상담사는 기존 워크스페이스의 고객 대화↔상담 기록으로 전환하며 문서 입력과 고객 문맥을 유지한다. 이력 상세에서 고객 대화를 읽기 전용으로 연다.
- 상대방 말풍선은 왼쪽, 내 쪽 말풍선은 오른쪽에 표시한다. 고객 화면에서는 CUSTOMER, 상담사/이력 화면에서는 AGENT가 오른쪽이며 이관 전 상담사 표시명도 유지한다. 내 쪽은 indigo, 상대방은 slate를 사용한다. 말풍선은 내용에 맞는 너비로 표시하고 최대75ch·대화 영역85%로 제한하며 본문은 왼쪽 정렬과 긴 원문 줄바꿈을 유지한다.
- 전송 전에 sessionStorage에 초안과 UUID/원문을 보관한다. 서버 ACK 이전에는 전송 완료로 표시하지 않는다. 응답 불명 때 동일 ID/본문 재시도를 제공하고 새로고침에도 보관한다. 저장소 실패 때 신규 전송을 막는다. 종료 후에도 ACK 확인 재시도를 허용한다.
- 새로고침은 기존 접수 capability를 복원하고0부터 저장 대화를 읽는다. 망 복귀/일시 장애는 마지막 cursor 이후를 복원한다. 권한/세션 회수 때 이전 메시지 표시를 제거한다. 다른 접수·조직·Identity의 요청 결과를 섞지 않는다.
- 과거 메시지를 읽을 때 자동으로 바닥으로 이동하지 않는다. 새 메시지 보기로 사용자가 이동한다. 텍스트 줄바꿈·긴 원문, 모바일16px 입력·44px 조작과 내부 대화 스크롤을 제공한다.
- 대화 로그는 Tab 진입과 초점 표시, 방향키·PageUp/PageDown·Home/End 탐색을 제공한다. 자식 조작의 키를 가로채지 않는다.

## 고객 이미지 첨부

- 고객이 수락된 진행 중 CHAT에서 JPG·PNG를 한 장씩 전송한다. 전송 전 미리보기·선택 취소, 저장 후 대화 안 미리보기·원본 보기, 조회 실패 때 다시 불러오기를 제공한다. 상담사·읽기 전용 이력도 같은 메시지 순서로 이미지를 읽는다. 기존 상대방 왼쪽/내 쪽 오른쪽을 유지한다.
- 사용자 요청으로 한 장50MiB로 늘렸으며 1600만 화소·대화당20장 기준을 유지한다. 기존 JVM ImageIO로 실제 JPEG/PNG를 검사해 추가 유료 서비스/디코더 없이 위장 파일·SVG·큰 픽셀 수를 거부한다. 원본 bytes를 PRIVATE로 저장하며 EXIF 제거·재인코딩을 약속하지 않는다. 모바일 HEIC/WebP·일반 문서는 지원 범위 밖이며 JPG/PNG 변환이 필요하다.
- 고객 `POST /api/support/chat/images`는 기존 capability 헤더와 multipart `file`·`clientMessageId`를 받는다. Queue 잠금 안에서 크기/디코드/정책·quota·현재 상태와 같은 ID의 SHA256/크기/MIME를 확인한다. 텍스트와 같은 sequence를 배정하고 client ID의 텍스트↔이미지 충돌/내용 변경은409다. 중복 ACK는 종료 뒤에도 반환하며 신규 전송은 거부한다.
- 플랫폼의 기존 PRIVATE·보존 정책·재개 가능한 청크 업로드를 사용한다. 서버가 조직/접수/고객/전송 UUID를 플랫폼 request ID로 namespacing한다. 공급자 실패 때 sequence/메시지를 롤백한다. 외부 업로드 완료 후 DB 실패는 같은 플랫폼 ID로 복구한다. 중도 포기한 외부 업로드의 정리는 공급자의 보존 정책에 맡기며 파일 삭제 작업을 새로 약속하지 않는다.
- V23은 기존 chat_messages에 이미지 file ID/이름/MIME/크기/hash 열과 내용 제약만 추가한다. 과거 텍스트·순서·접수·권한을 유지한다. 대화 DTO의 image는 이름/MIME/크기만 담고 플랫폼 ID/hash/영구 URL은 노출하지 않는다. 상담 문서 첨부로 자동 복사하지 않는다.
- `GET /api/support/chat/images/{sequence}/views`와 직원 `/api/chat/{code}/images/{sequence}/views`는 매 발급에 현재 세션/조직/행 범위를 확인한다. 직원은 queue:read, 이력 `history=true`는 consultation:read를 적용한다. 다른 대화의 파일 ID를 지정할 수 없다. 원본/미리보기/썸네일 단기 티켓만 no-store로 반환한다. 공유 URL을 반환하지 않고 같은 이미지 optimizer/cache를 거치지 않는다. 발급된 단기 티켓의 유효 기한까지의 접근은 기존 플랫폼 계약과 같으며 즉시 무효화를 약속하지 않는다.
- 고객은 요청 전에 IndexedDB에 원본 Blob·파일명·UUID를 함께 커밋한다. 응답 불명/새로고침 뒤 같은 bytes/UUID로 재시도하며 ACK 뒤 보관함을 비운다. 로컬 보관 실패면 전송하지 않는다. 확정 거부는 선택 취소/재선택을 제공한다. 이미지 전송 중에는 텍스트 전송/종료를 막고 선택/미확인 이미지가 있으면 종료를 막는다. 다른 기기 복원·브라우저 저장소 수동 삭제 후 원본 복원은 지원하지 않는다.
- Nginx 공개 접수 경로는 multipart 여유를 포함해51MiB까지 받으며 서버의 이미지50MiB 한도를 유지한다. 헤더 capability와 단기 티켓/원문을 일반 로그·Git 문서에 남기지 않는다. 운영 NAS 적용은 개발 반영과 별도다.

## 검증·보존 근거

- 서버 전체 Gradle build에서177건 중168건 통과·실패0, 보고용 PostgreSQL opt-in9건 skip. 채팅 통합10건은 양방향 저장·cursor·중복/종료 경합·만료 worker·표시명·Identity tuple·조직/담당/구독 권한 경계를 검사한다.
- 프런트 전체152건/33파일 통과. 마지막 키보드 수정 뒤 관련11건/3파일, lint·TypeScript 포함 production build 통과. 관련 컴포넌트 검사는 응답 유실 뒤 동일 UUID 재시도·새로고침 보존·저장소 실패 차단·접근 회수·읽기 전용 범위를 포함한다.
- 별도 합성 OIDC/JWKS·PostgreSQL17·실제 API/HTTP/SSE를 사용한 두 브라우저에서 공개 폼→ACD 수락→양방향 전송·새로고침/망 복귀·고객 종료·후처리, 실제 WORK 이관·이전 담당 읽기/새 담당 쓰기,100건 초과 순서 복원을 확인했다. API 재시작 후 전체 대화·UUID 중복 제거·누락 cursor·SSE가 유지됐다. 내부 상담/이관 메모는 공개 대화에 포함되지 않는다.
- 다섯 viewport(2486×1283/1440×900/768×1024/1024×768/375×812)의 대화와 대기·긴 원문/미읽음·전송 중·장애·종료·이력18장, 문서 가로 넘침0·페이지 오류0, 작은 화면 전송·초안·과거 읽기 위치·실제 Tab/PageDown·장애 중 별도 상담 저장·마이크 미요청을 확인했다. 실제 삼성 기기/실사용 OIDC 수락과 구분한다.
- 개발 DB V21 백업을 새 격리 DB로 복원해 최종 V22/Hibernate validate/health와 기존28개 테이블 모든 행·기존 열 hash 일치를 확인했다. 과거 접수의 chatEnabled=false/sequence0/end NULL과 새 메시지0을 확인했다. 실제 서비스 migration은 별도 백업/보존 검사와 [인계](handoff.md)의 배포 증거를 따른다.
- 재현 도구/PNG/JSON/XML은 이 작업 PC의 Git 제외 `output/`에 보존한다. `chat-ui/{proof,final-proof}.json`, `chat-boundary-proof.json`, `chat-restart-proof.json`, `chat-final-migration-proof.json`, `backend-chat-final-tests/`가 격리 증거이며 다른 clone에 있다고 가정하지 않는다. 독립 Impeccable 검토와 문서화 기록도 이곳에 둔다.

Direction contract: THESIS는 대화와 상담 기록을 안전하게 이어가는 것, OWN-WORLD는 기존 업무/공개 진입점의 slate·indigo, STORY는 접수→수락→대화→종료→후처리/이력, FIRST VIEWPORT는 저장 대화·연결 상태·작성/종료, FORM은 기존 표면 안의 확장, FINISH는 실제 HTTP/SSE·재접속·권한/경합·PostgreSQL 보존·화면 검증과 독립 검토다. 새 시각 세계·DESIGN/comp 정비는 이 범위에 포함하지 않는다.
