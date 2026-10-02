# f65216d 리뷰 수정 결과

2026-10-03. 사용자 제공 `hellow_review_f65216d_update_ko.md`의 지적을 현재 코드와 플랫폼 공개 계약에 대조해 수정했다. 이번 결과는 보안·저장·업무 상태의 기반 복구이며 MVP 전체 또는 운영 배포 완료가 아니다.

## 지적별 처리

| 항목 | 변경과 검증 |
| --- | --- |
| F01 인증·LiveKit | Spring Security Bearer JWT 서명·issuer·만료·명시적 API audience 검증. boolean 쿠키·개발 로그인 우회 제거. 담당 상담만 방 토큰 발급, 마이크만 publish, roomAdmin 미부여. 2분 토큰과 영속 종료 상태 기반 참가자 제거 재시도. 서명·issuer·audience·만료·익명 요청 거부 테스트. |
| F02 조직 격리 | Organization, `(issuer, sub)` Membership, Permission, ORG Data Scope 서버 검증. 고객·Queue·상담·이력·후속 조치·파일을 조직별 조회. 타 조직 403/404·권한 회수·권한 부족 테스트. TEAM/SELF는 허용하지 않으며 향후 구현 대상. |
| F03 파일 | PRIVATE 업로드, 서버의 조직·상담 소유 관계 저장, URL 발급 전 권한 확인. 보존 정책은 운영자가 설정해야 하며 누락 시 503. 다른 상담 파일을 문서에 참조하면 거부. 이전 PUBLIC 파일은 별도 정리 대상. |
| F04 초기 조회 | 서버 `/api/me` 확인 후 조회. 오류를 화면에 표시하며 목업으로 대체하지 않음. 조회 실패·권한 부족 때 쓰기 차단. |
| F05 식별자 | Queue code와 실제 Customer code 분리. 신규 등록·기존 고객 연결을 담당 상담의 트랜잭션으로 처리. 같은 전화번호만으로 외부 요청을 기존 고객에 자동 연결하지 않음. |
| F06 초안 소유 | 상담별 초안, 담당자 권한, 편집 상태와 optimistic version을 유지. 고객/대기열을 전환해도 작성 중 문서 보존. |
| F07 완료 무결성 | 저장 성공 후에만 성공 알림. 상담 저장·이력 생성·Queue 완료를 하나의 트랜잭션으로 묶고 독립 complete API 제거. 저장 실패·버전 충돌은 입력과 Queue를 유지. |
| F08 문서 구조 | SHNEA Editor JSON을 원본으로 저장·재조회. 템플릿·인용은 기존 노드 뒤에 추가. 본문 요약만 별도 추출. 서식·파일 참조 보존 테스트. |
| F09 수락 경쟁 | Membership/Queue 행 잠금, 이미 수락된 요청 충돌, 상담사당 활성 CALL 하나. 동시 수락 결과 200/409 및 반복 명령 테스트. |
| F10 중복 초안 | 조직·Queue unique, upsert+expectedVersion. 동일 완료 재시도는 결과를 재사용하고 변경된 재시도는 409. |
| F11 이력 복구 | 고객 또는 미등록 상담별 실제 이력 조회. 저장·후속 요청 뒤 재조회. 임의 이력 POST 제거. |
| F12 화면·통화 | 선택한 상담과 활성 통화 ID 분리. 다른 요청 조회가 기존 미디어 연결을 끊지 않음. CALL 종료와 상담 기록 완료 분리. |
| F13 큰 파일 | 디스크 multipart, 두 번의 스트림 읽기로 SHA-256과 8MiB 청크 전송. `getBytes()` 없이 9MiB 파일을 8+1MiB로 전송하는 테스트. PATCH 지원 JDK HTTP client 사용. |
| F14 가짜 성공 | 호전환·알림 발송·보류·에스컬레이션·재발신 실행 차단. 방문/콜백은 PENDING 요청 접수이며 일정·가용 인력 확정 아님을 표시. |
| F15 상세 탐색 | 이력 상세를 우측 패널 안에 표시해 중앙 편집기 보존. 키보드 열기/Esc 닫기. 실제 브라우저에서 저장 후 새로고침·이력 상세와 메모 동시 표시 확인. |
| D01–D05 표시·폴링 | PROCESSING·담당자·후처리 상태 유지, 등록 고객 연결 선택 제공, 이전 요청 완료 후 다음 조회, abort/generation으로 오래된 응답 폐기. 첫 빈 동기화 후 신규 요청 알림 및 조회 오류 표시. |

## 실행한 검증

- Java 21 / Gradle 8.12.1: 서버 테스트 12개. PostgreSQL 17.11의 분리된 DB에서도 실행. 정상/거부/동시 수락/반복 저장·완료/구조 문서/파일 범위 및 청크를 검증한다.
- Frontend: `npm --prefix frontend test` 8개, `npm --prefix frontend run lint`, `npm --prefix frontend run build`.
- Nginx 별도 컨테이너의 `nginx -t`. 기존 개발 서비스는 reload하지 않았다.
- 격리된 합성 JWT·조직·고객 DB와 배포 빌드로 브라우저 저장·새로고침·우측 상세 표시 확인. 실제 직원/고객 데이터나 운영 인증을 사용하지 않았다.
- Impeccable context·harden·craft-floor 적용. detector의 기존 색상/gradient/border/animation 지적 12개는 이번 기능 복구에서 시각 스타일 변경으로 확대하지 않았다. detector 통과로 기록하지 않는다.
- 문서 검증과 Git whitespace 검사는 작업 인계 기록에 결과를 기록한다.

## 설정 및 남은 수락 조건

1. `PLATFORM_OIDC_ISSUER`와 **API access token용** `HELLOW_API_AUDIENCE`를 운영자와 확정해야 한다. 공용 웹 client `app`의 ID token은 API 토큰으로 받지 않는다. 누락은 거부로 처리한다. API audience 발급 계약 없이 로그인 성공을 보장하지 않는다.
2. `ADMIN_OIDC_ISSUER`, `ADMIN_OIDC_SUB`는 첫 조직 생성 관리자에만 적용한다. `/api/admin/organizations`에서 조직과 초기 관리자 Membership을 지정하고 `/api/admin/memberships`에서 조직 관리자가 직원을 등록한다. 플랫폼 관리자에게 고객 조회 권한을 자동 부여하지 않는다. 관리자 UI·마지막 관리자 이관·TEAM/SELF·ACD 가용 상담사 상태는 후속 작업이다.
3. `HELLOW_ATTACHMENT_RETENTION_CODE`에 플랫폼의 승인된 보존 정책을 지정한다. 기존 PUBLIC 파일을 자동으로 안전해졌다고 보지 않는다. 기존 소유 관계·공개 URL·보존 상태를 별도 조사·이관한다.
4. 기존 조직 미지정 행은 그대로 격리하며 임의 조직 배정·삭제·데모 재시딩을 하지 않는다. 개발의 Hibernate update와 V2 nullable migration은 운영 스키마 이관 완료가 아니다. 운영 적용 전 백업/복구·마이그레이션·구신 앱 호환 검증이 필요하다.
5. 미등록 상태에 쌓인 후속 이력은 Queue 맥락에 보존된다. 고객 등록 전에 생성된 이력의 고객 맥락 소급 연결은 후속 보완 대상이다. 상담별 초안과 완료 기록은 고객 연결 이후 실제 ID를 저장한다.
6. 실제 OIDC·파일 정책·NAS 배포·HTTPS 마이크·2인 WebRTC·LiveKit 제거 실패/재시작·권한 회수 후 실제 연결 종료는 통합 수락 전이다. PSTN·전환·메시징·엔지니어 가용 상태는 미연동. 로컬 상담사 상태 선택은 서버의 ACD 가용 상태를 바꾸지 않는다.

운영 배포와 원래 개발 DB 변경은 수행하지 않았다. 다음 작업은 위 설정 계약과 실환경 수락을 먼저 확보한 뒤 MVP 범위를 이어간다.
