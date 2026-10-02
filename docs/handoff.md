# 작업 인계 기록

## 2026-10-03 Bonfire 갱신·골든패스 이전

- [bonfire_skill 최신 커밋](https://github.com/shnea/bonfire_skill/commit/a7c841015353025d8e4aef73b9ac24a46960e621)을 내려받아 전역 Bonfire 설치본을 갱신했다. 새 구조에 맞춰 프로젝트의 workflow·golden-path·Impeccable을 `skills/`로 이전하고 시작 안내·스킬 연결·검증 스크립트 경로를 갱신했다. 프로젝트별 기준을 보존했고 Impeccable의 실행 경로 표기만 새 위치로 바꿔 원본·프로젝트 수정본 해시를 각각 보관했다.
- [핵심 기준](../skills/golden-path/references/core.md), [범위](../skills/golden-path/references/domains/02-scope.md), [검증](../skills/golden-path/references/domains/11-validation.md)에 [리뷰 수정 결과](review-repair.md)의 부분 구현, 실행한 검사, 실제 OIDC·조직 배정·파일 정책·2인 통화·NAS 검증의 남은 조건을 반영했다.
- 문서 검증: `python scripts/verify-docs.py`로 Markdown 77개·로컬 링크 230개·영역 14개·요구사항 85장·Impeccable 수정본 해시와 원본 대조 64개 통과. 제품 테스트는 이번 문서·스킬 이전에서 재실행하지 않았다.

## 2026-10-03 리뷰 수정 인계

현재 상태의 정본은 [f65216d 리뷰 수정 결과](review-repair.md)다. 아래 과거 완료 기록 중 공개 API·개발 로그인·PUBLIC 파일·목업 성공·독립 Queue complete 및 실제 연동 완료 표현은 이번 수정으로 대체한다.

- 서버 Bearer JWT 검증, 명시적 API audience, Organization/Membership/Permission/ORG 범위, 담당 상담·파일 권한을 도입했다. 누락된 운영 계약은 거부한다.
- Queue 행 잠금과 담당자 동시 CALL 제약, 상담별 초안 upsert/version, 저장·이력·완료 단일 트랜잭션을 구현했다. 미등록 고객은 실제 등록/연결 이후 Customer code를 사용한다.
- Editor JSON과 작성 중 초안 보존, 실제 타임라인 재조회, 선택 맥락과 활성 미디어 분리, 순차 폴링/오래된 응답 폐기, 실패 표시를 적용했다. 미연동 액션은 성공 처리하지 않는다.
- PRIVATE 소유 파일과 스트리밍 청크, 짧은 LiveKit 참가 토큰·서버 제거 재시도를 구현했다. 기존 조직 미지정 데이터와 PUBLIC 파일은 임의 이관하지 않았다.
- 검증: Java 21/Gradle 8.12.1 서버 테스트 12개 PostgreSQL 17.11에서 통과. Frontend 테스트 8개·lint·production build 통과. 격리된 합성 조직/고객/JWT로 초안 저장·새로고침 복구·우측 이력과 편집기 동시 표시 확인. Nginx 설정 검증 통과.
- 문서 검사: Markdown 77개·로컬 링크 213개·영역 14개·요구사항 85장·스킬 해시 64개 통과. Git diff whitespace 검사 통과.
- Impeccable detector의 기존 스타일 경고 12개는 유지. 이번 변경은 안전한 기능 복구에 한정하며 시각 스타일 전면 개선을 완료했다고 보지 않는다.
- 당시 `.agents` 기준 문서 쓰기 권한 문제로 core/scope/validation 갱신을 보류했다. 이후 위 Bonfire 갱신에서 쓰기 가능한 `skills/`로 기준을 이전하고 해당 문서를 갱신했다.
- 남은 일: 실제 OIDC API audience·첫 조직 Membership·파일 보존 정책 계약, 관리자 UI/TEAM·SELF·ACD, 미등록 상담 과거 이력의 고객 소급 연결, 기존 PUBLIC 파일 정리, 운영 DB migration/restore, HTTPS/2인 통화·실제 권한 회수 후 참가자 제거 검증.
- 운영 및 원래 개발 스택은 재배포하지 않았다. 분리된 검증 서버·DB만 사용했다.

## 완료한 작업

- 요구사항정의서 1~85장을 검토해 골든패스 원본의 core.md, 14개 영역, skills.md, decisions.md, 영역 색인을 작성했다. [핵심 기준](../skills/golden-path/references/core.md)부터 읽는다. 원문 요구사항은 수정하지 않았다.
- MVP와 Phase 2~4, 확정 기술과 검토 후보, 구현 시 수락 기준과 미검증 상태를 구분했다. Bonfire 항목·내보내기/가져오기 참조는 보존했다.
- Impeccable 4.5.0을 설치하고 reference/agents/scripts, LICENSE/NOTICE, 파일 해시를 보관했다. UI 작업 조건으로 골든패스에 등록했다. [출처](../skills/impeccable/SOURCE.md).
- 개발·운영 환경: 도메인, 포트, 레지스트리, 커밋 SHA 태그, Compose, SOPS + age, 운영 최소 배포물과 NAS 사양 기록. 상세는 [환경 기준](infrastructure.md)을 따른다.
- [개발·협업 원칙](development.md): 큰 작업 단위별 검증·커밋·push·인계 절차와 사람 친화적 소스 구조 기준 기록.
- AGENTS.md에서 환경 기준, 개발 원칙, 인계 기록을 연결.
- CI/CD는 특정 서비스 선택 배포와 전체 배포를 지원해야 한다는 요구를 반영했다.
- 상담사 작업 화면 UI 방향 확정 및 정의서 작성 완료:
  - B안(대기열/작업 흐름 중심) 기반 + C안(좌측 슬림 글로벌 내비게이션 바) 결합 구조.
  - 상담 이력 탐색 중 후속 조치 즉시 연계 및 넓은 실시간 메모 공간 확보 요구 반영. [상담사 화면 UI 정의서](ui-direction.md).
- **Next.js App Router + TypeScript 기반 상담사 작업 화면 인터랙티브 프로토타입 구현 완료 (`frontend/`)**:
  - **슬림 GNB (`SidebarGNB.tsx`)**: 64px 폭, 메뉴 탭 탐색 및 상담사 근무 상태(온라인/통화중/자리비움/퇴근) 모달 선택기 구현.
  - **처리 대기열 패널 (`QueuePanel.tsx`)**: 탭 필터(전체/콜/콜백/티켓), 실시간 인바운드 콜 강조 애니메이션, 콜백 예약 및 할당 티켓, 대기열 선택 시 고객 워크스페이스 맥락 전환 연동. 미등록 고객 및 컴플레인 고객 뱃지 추가.
  - **중앙 활성 워크스페이스 (`ActiveWorkspace.tsx`)**:
    - 실시간 통화 경과 시간 카운트업 타이머, 음소거, 통화 보류(Hold 시 대기음 안내 상태 뱃지), 호전환 연계, 통화 종료 제어기.
    - **고객 정보 상세 조회 / 인라인 수정 / 상담 중 신규 고객 등록 기능**:
      - **기업 고객(B2B) vs 개인 고객(B2C/일반 소비자) 구분 지원**: 기업 담당자뿐만 아니라 회사 소속이 없는 일반 개인 및 컴플레인 민원 제기자 정보 완벽 대응.
      - **컴플레인 / 주의 고객 관리**: `[⚠️ 컴플레인 주의 고객]` 강조 뱃지 및 특이사항 경고 박스, 상담 메모 템플릿에 `[⚠️ 컴플레인 접수]` 원클릭 템플릿 탑재.
      - 등록 고객: 고객명, 직책/부서, 회사, 연락처, 이메일, 등급, 최근상담, 고객메모 상세 조회 및 `[정보 수정]` 인라인 폼 지원.
      - 미등록 고객: `[미등록 고객 (신규 인입)]` 안내 배너와 함께 통화 중 확인된 정보를 기업 또는 개인으로 즉시 분류하여 `[신규 고객으로 등록]`할 수 있는 인라인 등록 폼 지원.
      - 접기/펼치기 토글을 제공하여 고객 정보 확인과 하단 상담 메모 작성 공간의 균형 확보.
    - 연동형 대분류·중분류 드롭다운(컴플레인 민원, 제품 문의, 계약/정산, 기술 지원), 처리 상태 선택, 빠른 태그 칩 토글.
    - 서식 에디터 툴바 및 4종 템플릿(컴플레인 접수, 견적 협의, 기술 장애, 부재 콜백) 원클릭 삽입.
    - 넉넉한 높이의 대형 실시간 메모장 및 하단 임시저장/관리자 에스컬레이션/상담 종료 및 완료 액션 바.
  - **우측 고객 맥락 및 후속 조치 패널 (`ContextActionPanel.tsx`)**:
    - 채널별(전체/전화/이메일/채팅/티켓) 과거 상담 이력 타임라인.
    - 타임라인 내 "인용" 클릭 시 중앙 실시간 상담 메모장에 과거 이력 자동 인용문 삽입.
    - 4가지 즉시 연계 후속 조치 패널: ① 엔지니어 방문/서비스 예약 접수, ② 콜백 일정 등록, ③ 실시간 가용 상담사 원클릭 호전환, ④ 고객 안내 알림톡/SMS 발송.
    - 후속 조치 접수 시 타임라인 실시간 추가 반영.
  - **전역 피드백 시스템 개선 (`Toast.tsx`)**: 단순 클릭 알림 남발을 제거하고, 최대 5개까지만 깔끔하게 표시되며 3.5초 후 자동 소멸되도록 최적화.
  - **한국어 실무 목업 데이터 세트 (`mockData.ts`)**: 기업 고객 외에 개인 컴플레인 고객(`queue-complainant`: 환불 지연 항의 건), 미등록 고객 인입 콜(`queue-unregistered`)을 포함한 실무 데이터 내장.
- **Java 21 / Spring Boot 3.4.4 백엔드(`backend/`) 및 PostgreSQL 17 데이터베이스 구축 및 프론트엔드 연동 완료**:
  - 사람 친화적 도메인 중심 구조 (`customer`, `queue`, `consultation`, `timeline`, `followup`).
  - Spring Data JPA 엔티티 및 REST API 엔드포인트 구현:
    - `Customer`: 기업(B2B) 및 개인(B2C) 고객 조회, 신규 등록, 정보 수정
    - `QueueItem`: 대기열 조회 및 처리 완료
    - `Consultation`: 상담 메모 임시저장 및 완료 저장
    - `TimelineItem`: 고객별 채널 상담 이력 조회 및 추가
    - `FollowUpAction`: 방문 예약, 콜백 일정, 호전환 등 후속 조치 저장
  - `DataInitializer`: 초기 CRM 데이터베이스 자동 시딩 (기업 VIP, 개인 컴플레인, 미등록 인입 콜 등)
  - `frontend/src/app/page.tsx`:
    - 브라우저 마운트 시 `/api/queue`, `/api/customers`, `/api/timeline`에서 실제 DB 데이터를 조회하여 렌더링.
    - 신규 고객 등록, 정보 수정, 상담 저장 완료, 후속조치 접수 시 실제 Spring Boot API를 호출하여 PostgreSQL에 영속화.
- **Docker Compose + Nginx (포트 `30160`) 전체 스택 연동 환경 구성 및 기동 완료**:
  - `compose.yaml`: `db` (PostgreSQL 17, 외부 포트 `30161`), `api` (Spring Boot), `web` (Next.js), `nginx` (호스트 포트 `30160`).
  - `infra/nginx/default.conf`: 외부 인입 호스트 포트 `30160` -> Nginx `8080` -> `/api/`는 `api:8080`, `/`는 `web:3000`으로 리버스 프록시 연동.
- **고객용 외부 웹 상담 진입 화면 구축 (`frontend/src/app/support/page.tsx`, MVP-04)**:
  - 모바일·PC 반응형 웹 상담 접수 폼: 고객 구분(개인 B2C vs 기업 B2B), 5가지 문의 분류(제품 문의, 장애 지원, 계약/정산, 환불/컴플레인, 기타), 성함, 회사명, 연락처, 문의 요약, 연결 방식(실시간 음성 vs 온라인 티켓).
  - 실시간 대기 인터페이스: 펄스 애니메이션, 실시간 대기 순번 및 예상 대기 시간, 백엔드 세션 상태 2초 주기 폴링, 대기 취소 버튼.
  - 상담 연결 인터페이스: 담당 상담사명 안내, 실시간 통화 경과 시간 타이머, 마이크 음소거 토글, 문의 요약 카드, 통화 종료 버튼.
  - 상담 종료 피드백 화면: 서비스 만족도 5단계 별점 평가 및 신규 상담 재접수 지원.
- **백엔드 고객 상담 세션 수명 주기 및 대기열 연동 API 구현 (`SupportController.java`, `QueueController.java`, `QueueItem.java`)**:
  - `POST /api/support/request`: 외부 고객 상담 접수 -> 전화번호 기반 기존 고객 매핑, 컴플레인 키워드 자동 감지(긴급 우선순위 지정), 미등록 고객 판정, 고유 대기열 코드(`queue-web-XXXX`) 및 세션 ID 발급.
  - `GET /api/support/session/{sessionId}`: 고객 화면 세션 상태 실시간 조회 (`WAITING` -> `PROCESSING` -> `COMPLETED` / `CANCELLED`).
  - `POST /api/support/session/{sessionId}/cancel`: 고객의 대기 중 취소 처리.
  - `POST /api/queue/{code}/accept`: 상담사의 대기열 아이템 수락 및 상담사 배정(`PROCESSING`).
  - `POST /api/queue/{code}/complete`: 상담사의 상담 완료 처리(`COMPLETED`).
- **상담사 CRM 화면 실시간 연동 강화 (`frontend/src/app/page.tsx`, `SidebarGNB.tsx`)**:
  - 3초 주기 자동 대기열 폴링 및 신규 인입 발생 시 즉각 토스트 알림(`🔔 신규 고객 상담 인입`).
  - 대기열 카드 [수신] 클릭 시 백엔드 `accept` 호출 및 통화 워크스페이스 활성화.
- **SHNEA 플랫폼(Platform) 핵심 연동 모듈 및 파일/인증 계약 구현 (`PlatformClient`, `PlatformController`, MVP-01)**:
  - `PlatformProperties` & `compose.yaml`: `.env.dev` 환경 변수(`PLATFORM_API_KEY`, `PLATFORM_PROJECT_ID`, `PLATFORM_ENVIRONMENT_ID`, `PLATFORM_OIDC_ISSUER`)를 컨테이너 내부로 주입 및 자동 매핑.
  - **환경 컨텍스트 검증 (`PlatformClient.fetchContext`)**:
    - `GET /api/v1/integration/context` (헤더: `X-Platform-Key`) 호출로 프로젝트 UUID(`14dd20e4...`) 및 환경 UUID(`06c8d669...`) 대조 검증 수행 (`verified: true`).
    - 10개 활성 스코프(`integration:read`, `files:*`, `jobs:*`, `logs:*`) 정상 확인.
  - **플랫폼 파일 API (`X-Platform-Key`) 업로드 프로토콜 구현 (`PlatformClient.uploadFile`)**:
    - 1단계: 업로드 세션 생성 (`POST /api/v1/files/uploads`, SHA-256 계산)
    - 2단계: 8MB 청크 분할 전송 (`PATCH /api/v1/files/uploads/{id}`, `Upload-Offset`, `X-Chunk-SHA256`)
    - 3단계: 업로드 완료 확정 (`POST /api/v1/files/uploads/{id}/complete`)
    - 4단계: 영구 File ID 및 뷰어 URL(`.../content/original`) 획득 및 클라이언트에 안전하게 전달.
- **SHNEA Keycloak OIDC 통합 로그인 화면 및 PKCE 콜백 구현 (`/login`, `/auth/callback`, `lib/pkce.ts`)**:
  - **Keycloak 유효 콜백 URL 확정 및 설정**:
    - 개발 도메인: `https://dev-hellow.shnea.kr/auth/callback`
    - 로컬 개발 테스트: `http://localhost:30160/auth/callback`
    - `.env.dev`의 `PLATFORM_OIDC_REDIRECT_URI`를 `https://dev-hellow.shnea.kr/auth/callback`으로 확정 갱신.
  - 로그인 화면([`/login`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/app/login/page.tsx)):
    - SHNEA 플랫폼 계정 로그인(Code + PKCE S256, `openid profile email`), Keycloak 등록용 콜백 URL 원클릭 복사 도구, 개발 모드 즉시 접속 바이패스 지원.
  - 콜백 처리 페이지([`/auth/callback`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/app/auth/callback/page.tsx)):
    - 인가 코드(Code) 및 세션 verifier를 이용한 토큰 교환, ID 토큰 디코딩(`given_name`, `email`), 상담사 세션 활성화 및 메인 워크스페이스 자동 이동.
  - 슬림 GNB 프로필 메뉴에 `[로그인 / 계정 변경]` 바로가기 링크 탑재.
- **SHNEA 공식 에디터(`@shnea/editor@0.1.0-alpha.11`) 패키지 설치 및 첨부 어댑터 연동 (`editor.md` 표준 준수)**:
  - `shnea-editor-0.1.0-alpha.11.tgz` 다운로드 및 SHA-256 체크섬(`b0f9e9c283346046a62526349d89f696b76e17ce40dac0e33312f56f08d0ca56`) 무결성 검증 후 설치.
  - `Dockerfile`: `web-deps` 단계에 `shnea-editor-0.1.0-alpha.11.tgz` 포함하여 `npm ci` 멀티스테이지 빌드 지원.
  - 백엔드 첨부 API ([`EditorAttachmentController.java`](file:///E:/JetBrains/IntelliJ/hellow/backend/src/main/java/kr/shnea/hellow/platform/EditorAttachmentController.java)):
    - `POST /api/editor/files`: 플랫폼 File API 연동 후 에디터 첨부 스펙(`{ fileId, scope, kind, name, size }`) 반환.
    - `GET /api/editor/files/{fileId}/views`: 플랫폼 `POST /api/v1/files/{fileId}/view-ticket` 호출 후 응답 JSON 변경 없이 `no-store` 반환.
  - 프론트엔드 에디터 컴포넌트 ([`ShneaConsultationEditor.tsx`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/components/ShneaConsultationEditor.tsx), [`ActiveWorkspace.tsx`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/components/ActiveWorkspace.tsx)):
    - `@shnea/editor/react`의 `ShneaEditor` 및 `style.css` 연동, 클라이언트 SSR 마운트 제어.
    - 상담 메모장 상단에 `[SHNEA 에디터]` vs `[빠른 메모]` 탭 전환 지원.

- **미인증 접근 차단 및 무조건 로그인 리다이렉트 체계 구축 (`frontend/src/middleware.ts`, `frontend/src/app/page.tsx`)**:
  - Next.js 미들웨어(`middleware.ts`): 서버 사이드에서 `hellow_logged_in` 인증 쿠키 검사, 비로그인 시 `/` 등 보호된 상담사 라우트 접근을 즉시 `HTTP 307`로 `/login` 리다이렉트.
  - 외부 고객용 웹 상담 접수 화면(`/support`), 인증 콜백(`/auth/callback`), 로그인 화면(`/login`), 백엔드 API(`/api/*`)는 비로그인 접근 정상 허용.
  - 메인 워크스페이스(`page.tsx`): 클라이언트 마운트 시 세션/쿠키 이중 검사 및 미인증 플리커링 방지 가드 적용.
- **로그인 화면 정돈 및 단순화 (`frontend/src/app/login/page.tsx`)**:
  - 불필요한 플랫폼 수식어와 복잡한 라벨을 모두 제거하고 간결하고 직관적인 **[로그인]** 단일 액션으로 통일.
  - 하단 Keycloak 리다이렉트/콜백 경로 안내 박스 완전 제거.
  - **[개발자 모드 즉시 접속]**: 프로덕션 환경에서는 숨기고 개발/로컬 환경(`localhost`, `dev-*`, non-production)에서만 조건부 렌더링.
  - **OIDC 로그인 트리거 안정화 및 prompt=login 강제 적용**: 페이지 진입 직후 클릭 시 비동기 설정 미완료로 발생하던 오류를 해결하고 플랫폼 확정 Issuer 자동 fallback을 탑재함. 또한 `prompt: 'login'` 파라미터를 전달하여 Keycloak 세션 잔류로 인한 자동 로그인을 방지하고 항상 Keycloak 로그인 화면이 뜨도록 강제.
  - **로그인 한글 닉네임 UTF-8 디코딩 복원 (`auth/callback/page.tsx`)**: JWT ID 토큰 디코딩 시 단순 `atob` 사용으로 한글 닉네임 깨짐 현상을 `TextDecoder('utf-8')` 파싱으로 전면 교체하여 한글 닉네임("이소연", "홍길동" 등)이 100% 정상 표시되도록 수정.
- **상담 메모장 SHNEA 공식 에디터 단독 연동 및 다크 테마·높이 최적화 (`ActiveWorkspace.tsx`, `ShneaConsultationEditor.tsx`)**:
  - 기존의 [빠른 메모] 탭, 모드 선택 토글 버튼, 우측 별도 첨부파일 버튼 및 textarea를 완전히 제거하고 **SHNEA 공식 에디터를 단독이자 기본 에디터로 상시 적용**.
  - **다크 테마 일체화**: `@shnea/editor`의 CSS 변수(`--se-bg: #0b1120`, `--se-text: #f8fafc`, `--se-line: #334155`, `--se-raised: #1e293b` 등) 및 툴바·팝오버 스타일을 CRM 다크 슬레이트 톤과 100% 일치시켜 라이트 테마 부조화 완전 해결.
  - **높이 최적화**: 기존 제한 높이를 해제하고 부모 flex 컨테이너에 맞춘 `flex-1 h-full min-h-[380px]`를 적용하여 하단 액션 바까지 시원하게 꽉 채우도록 개선.
  - **에디터 JSON 문자열 노출 및 줄바꿈 불가 무한루프 버그 완전 해결 (`ShneaConsultationEditor.tsx`)**:
    - `onChange`에서 `JSON.stringify(document)`를 문자열로 올려보내고, `initialText` 변경 감지로 다시 `fromMarkdown`에 들어가는 역방향 무한 루프 때문에 에디터 본문에 `{"format":"shnea-editor",...}` JSON 원문이 찍히고 줄바꿈이 먹통이 되던 문제를 근본적으로 해결.
    - `extractPlainText`를 구현하여 실제 사용자가 작성한 문장과 줄바꿈만 추출해 상위 상태와 동기화하고, `lastEmittedTextRef`를 이용해 타이핑 시 발생하는 에코 재렌더링을 완벽 차단함.
    - 이제 사용자가 자유롭게 줄바꿈, 띄어쓰기, 한글 입력을 자연스럽게 진행할 수 있으며 템플릿 클릭 시에만 정상적으로 문서가 갱신됨.
- **슬림 GNB 실제 Keycloak OIDC 로그아웃(RP-Initiated Logout) 연동 및 불필요한 플랫폼 연동 모달 완전 제거 (`SidebarGNB.tsx`, `pkce.ts`, `auth/callback/page.tsx`)**:
  - GNB [로그아웃] 클릭 시 Keycloak OIDC 로그아웃 엔드포인트(`.../protocol/openid-connect/logout`, `id_token_hint`)를 호출하여 플랫폼 인증 서버의 세션 쿠키까지 완전히 파기.
  - Keycloak 리다이렉트 URI 검증 규칙(`auth.md`: "로그아웃 복귀는 등록 콜백 또는 그 origin의 홈(`/`)을 사용한다")에 맞추어 `post_logout_redirect_uri`를 `${window.location.origin}/`로 설정. Keycloak이 허용된 홈(`/`)으로 정상 복귀시킨 후, 애플리케이션 미들웨어가 `/login`으로 깨끗하게 자동 리다이렉트 처리.
  - 일반 실무 사용자 및 상담사에게 노출될 필요가 없는 내부 개발용 **[SHNEA 플랫폼 연동 관리]** 방패 아이콘 및 팝업 모달(`PlatformIntegrationModal.tsx`)을 완전히 삭제하여 실무 중심의 깔끔한 워크스페이스 확보.

- **에디터 가로 너비(Width) 75ch 제한 해제 및 100% 꽉 채움 적용 (`ShneaConsultationEditor.tsx`)**:
  - `@shnea/editor` 기본 스타일에 내장된 `:is(.shnea-editor .tiptap) p { max-width: 75ch; }` 때문에 긴 텍스트 입력 시 에디터 너비의 절반 지점에서 아래 줄로 뚝 떨어지던 현상을 완벽히 해결.
  - `.shnea-editor .tiptap`의 `p`, `h1`~`h6`, `blockquote`, `pre`, `ul`, `ol`, `div`, `section` 전역에 `max-width: 100% !important;`를 부여하여 화면 가로 너비 끝까지 시원하게 채워지도록 확장.
- **에디터 수직 높이(Height) 극대화 및 내부 컨테이너(`.se-body`) 100% 확장 (`ActiveWorkspace.tsx`, `ShneaConsultationEditor.tsx`)**:
  - **고객 정보 카드 기본 접힘(`isInfoExpanded: false`)**: 상단 헤더 바(36px)에 고객명, 등급, 전화번호, 기업/개인 배지가 이미 모두 노출되므로 평소에는 닫아두어 약 200px 이상의 수직 공간을 즉시 확보.
  - **상담 분류·태그·상태 1행 통합 바**: 기존에 세로 110px 이상을 차지하던 3열 그리드와 태그 칩 영역을 단일 슬림 행(36px)으로 통합 재설계하여 추가 70px 이상 확보.
  - **에디터 내부 `.se-body` flex-1 100% 확장**: `@shnea/editor` 내부의 `.se-body` 컨테이너에 `flex: 1 1 0%; height: 100%;`를 부여하고 `.tiptap`의 min-height를 해제하여 부모 높이를 100% 꽉 채우도록 수정.
- **최대 업로드 데이터 1GB(1024MB) 설정 및 첨부 어댑터 정상화 (`default.conf`, `application.yml`, `EditorAttachmentController.java`)**:
  - **1GB(1024MB) 대용량 지원**: `infra/nginx/default.conf`의 `client_max_body_size 1024M;`, `application.yml`의 `spring.servlet.multipart.max-file-size: 1024MB`, `server.tomcat.max-swallow-size: 1024MB`로 설정하여 대용량 파일도 차단 없이 안전하게 전송.
  - **외부 첨부 버튼/뱃지 완전 제거**: 에디터 상단에 별도로 두었던 첨부 버튼을 완전히 삭제하고, 에디터 자체 내부 기능(드래그 앤 드롭, `/` 슬래시 명령어의 `파일 업로드`, `이미지 업로드`)으로 깔끔하게 일원화.
  - **`@shnea/editor` 첨부 어댑터 규격 일치**: 백엔드 `uploadEditorFile`에 `scope` 및 `kind` 파라미터 매핑을 추가하고 클라이언트가 넘긴 `task.ref.scope`, `task.ref.kind`를 그대로 돌려주어 어댑터 검증 오류를 완벽 해결.
- **자주 쓰는 템플릿 문구 복원 및 템플릿 추가 시 독립 블록 개행(`\n\n`) 분리 (`ActiveWorkspace.tsx`)**:
  - 툴바 템플릿 앞의 레이블을 원래대로 **`자주 쓰는 템플릿:`**으로 복원하고 버튼명을 `⚠️ 컴플레인 접수`, `+ 견적 협의`, `+ 기술 장애`, `+ 부재 콜백`으로 유지.
  - `insertTemplate` 함수에서 이전 텍스트가 있을 때 확실하게 `\n\n`을 두어, 여러 템플릿을 연속 추가하더라도 이전 템플릿과 한 블록으로 합쳐지지 않고 별도의 독립된 마크다운 단락(블록)으로 깔끔하게 삽입되도록 개선.
- **상담 통합 타임라인 카드 최대 높이 제한 및 더블클릭 상세 보기 모달 구현 (`ContextActionPanel.tsx`)**:
  - **카드 높이 제한 및 텍스트 클램핑**: 타임라인 내 상담 내용이 길어져도 카드가 무한정 길어지지 않도록 `max-h-20`, `line-clamp-3`, `overflow-hidden` 및 `break-words`를 적용. 내용이 긴 경우(`> 70자`) 하단에 부드러운 그라데이션 페이드아웃과 "더블클릭 상세" 시각적 힌트를 배치.
  - **더블클릭 상세 보기 모달 (`selectedDetailItem`)**: 타임라인 카드를 더블클릭(`onDoubleClick`)하면 전체 전문을 확인할 수 있는 다크 테마 모달 다이얼로그 오픈.
  - **상세 모달 편의 기능**: 채널 아이콘 배지, 상담사, 작성 일시, 고객 이력, 제목, 녹취 오디오 재생 시간, 태그 목록 및 전체 상담 기록 전문(`whitespace-pre-wrap`, 스크롤 지원) 표시. 하단에 [메모장에 인용 후 닫기] 및 [닫기] 액션 버튼 탑재.
  - **접근성 및 인터랙션 방어**: 모달 오픈 시 `Esc` 키 또는 배경 오버레이 클릭 시 닫히도록 키보드 접근성 지원, 타임라인 카드 내 [인용] 버튼 클릭 시 `e.stopPropagation()`을 적용하여 모달이 불필요하게 함께 열리지 않도록 분리.
- **LiveKit 기반 WebRTC 1:1 실시간 양방향 음성 통화 연동 완료 (`MVP-03`, 요구사항 28장·29장 준수)**:
  - **미디어 인프라 구성 (`compose.yaml`, `infra/nginx/default.conf`)**:
    - 검증된 SFU 미디어 서버인 `livekit/livekit-server:latest` 컨테이너 추가 (`hellow-dev-livekit-1`).
    - 네트워크 포트 배정: WebRTC 시그널링/HTTP 직접 포트 `30162:7880`, WebRTC 미디어 `7881:7881/tcp`, `7882:7882/udp` 매핑.
    - Nginx 리버스 프록시 연동: `infra/nginx/default.conf`에 `/livekit/` WebSocket 프록시 라우팅을 추가하여 단일 `30160` 포트로도 클라이언트 시그널링 통신 가능하도록 지원.
  - **백엔드 LiveKit 토큰 발급 체계 (`LiveKitService.java`, `SupportController.java`, `QueueController.java`)**:
    - `com.auth0:java-jwt` 라이브러리를 적용하여 LiveKit 공식 사양의 Room Access JWT 토큰 발급 메서드 구현 (`video` grant: `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`, 상담사용 `roomAdmin`).
    - 고객용 엔드포인트: `POST /api/support/session/{sessionId}/token`
    - 상담사용 엔드포인트: `POST /api/queue/{code}/token`
  - **고객 웹 상담 화면 연동 (`frontend/src/app/support/page.tsx`, `lib/livekit.ts`)**:
    - 상담사 수락 후 `IN_CALL` 진입 시 LiveKit 방에 자동 입장하여 고객 마이크 오디오를 실시간 송출.
    - 상담사 음성 수신 오디오 엘리먼트 자동 연결 및 재생, 마이크 음소거(Mute) 토글, 통화 종료 시 자동 룸 퇴장 및 오디오 세션 정리.
    - 화면 상단에 실시간 음성 연결 상태 인디케이터(`LiveKit WebRTC 연결됨` / `마이크 및 음성 서버 연결 중...` / `음성 연결 확인 필요`) 배지 표시.
  - **상담사 워크스페이스 연동 (`frontend/src/components/ActiveWorkspace.tsx`)**:
    - 대기열 카드 [수신] 클릭 시 해당 룸으로 자동 입장하여 고객 음성 청취 및 상담사 마이크 오디오 송출.
    - 마이크 음소거(Mute) 및 통화 보류(Hold) 시 실시간 오디오 트랙 제어 연동.
    - 상단 통화 컨트롤 바에 `LiveKit 음성 연결됨` 실시간 인디케이터 배지 표시.
- **상담사 워크스페이스 실시간 대기열 동기화 버그 해결 (`frontend/src/app/page.tsx`)**:
  - `page.tsx`의 큐 동기화 `useEffect` 의존성 배열이 `[]`로 고정되어 있어, 초기 비인증(`isAuthenticated=false`) 상태에서 조기 리턴된 후 인증 완료(`isAuthenticated=true`) 시점에 큐 조회 및 2.5초 주기 폴링 인터벌이 가동되지 않던 문제를 해결.
  - 의존성을 `[isAuthenticated]`로 수정하여 로그인 완료 즉시 백엔드 DB의 최신 대기열 목록을 조회하고 2.5초 주기로 실시간 신규 인입을 화면에 즉각 반영하도록 복원.

## 검증 및 Git 상태

- `frontend`: Turbopack 빌드 성공, TypeScript 5 컴파일 오류 0건, `livekit-client` 의존성 패키징 완료.
- `backend`: Gradle 8.12 / Java 21 컴파일 및 bootJar 빌드 성공 (`hellow-dev-api`).
- Docker Compose 5개 컨테이너 정상 가동 및 헬스체크 통과:
  - `hellow-dev-db-1` (Up, healthy, `0.0.0.0:30161->5432/tcp`)
  - `hellow-dev-api-1` (Up, healthy, `8080/tcp`)
  - `hellow-dev-web-1` (Up, healthy, `3000/tcp`)
  - `hellow-dev-livekit-1` (Up, `0.0.0.0:30162->7880/tcp`, `7881/tcp`, `7882/udp`)
  - `hellow-dev-nginx-1` (Up, `0.0.0.0:30160->8080/tcp`)
- LiveKit 및 WebRTC 라이브 통신 검증:
  - LiveKit 직접 포트 `curl.exe -s -i http://localhost:30162/` -> `HTTP/1.1 200 OK` ("OK") 확인.
  - Nginx 프록시 `curl.exe -s -i http://localhost:30160/livekit/` -> `HTTP/1.1 200 OK` ("OK") 확인.
  - 백엔드 고객 세션 생성 및 고객 토큰 발급 (`POST /api/support/request` -> `POST /api/support/session/{id}/token`) -> `HTTP 200 OK`, JWT 발급 완료 확인.
  - 백엔드 대기열 상담사 토큰 발급 (`POST /api/queue/{code}/token`) -> `HTTP 200 OK`, JWT 발급 완료 확인.
- `python scripts/verify-docs.py`: Markdown 문서, 로컬 링크, 요구사항 대응, 스킬 메타데이터, 원본 해시 검증 통과.

## 남은 일과 다음 시작점

- 플랫폼 관리자 화면에 등록된 Keycloak OIDC 실제 브라우저 로그인 및 세션 워크스페이스 진입 테스트.
- 콜백 예약 / 방문 예약 / 호전환 실무 흐름 연계 (`MVP-05`).
- 멀티테넌트 조직(Organization) 및 팀/권한 격리 (`MVP-01`).
- 실시간 상담 현황 대시보드 및 관측성 (`MVP-06`).
- 운영 NAS 컨테이너 실행 및 도메인 연결은 후속 단계에서 검증한다.



