# 작업 인계 기록

## 완료한 작업

- 요구사항정의서 1~85장을 검토해 골든패스 원본의 core.md, 14개 영역, skills.md, decisions.md, 영역 색인을 작성했다. [핵심 기준](../.agents/skills/golden-path/references/core.md)부터 읽는다. 원문 요구사항은 수정하지 않았다.
- MVP와 Phase 2~4, 확정 기술과 검토 후보, 구현 시 수락 기준과 미검증 상태를 구분했다. Bonfire 항목·내보내기/가져오기 참조는 보존했다.
- Impeccable 4.5.0을 설치하고 reference/agents/scripts, LICENSE/NOTICE, 파일 해시를 보관했다. UI 작업 조건으로 골든패스에 등록했다. [출처](../.agents/skills/impeccable/SOURCE.md).
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
  - **템플릿 연동**: `@shnea/editor`의 `fromMarkdown`을 활용하여 '자주 쓰는 템플릿' 클릭 시 에디터에 마크다운 서식이 즉시 동기화되도록 연동.
- **슬림 GNB 실제 Keycloak OIDC 로그아웃(RP-Initiated Logout) 연동 및 불필요한 플랫폼 연동 모달 완전 제거 (`SidebarGNB.tsx`, `pkce.ts`, `auth/callback/page.tsx`)**:
  - GNB [로그아웃] 클릭 시 Keycloak OIDC 로그아웃 엔드포인트(`.../protocol/openid-connect/logout`, `id_token_hint`)를 호출하여 플랫폼 인증 서버의 세션 쿠키까지 완전히 파기.
  - Keycloak 리다이렉트 URI 검증 규칙(`auth.md`: "로그아웃 복귀는 등록 콜백 또는 그 origin의 홈(`/`)을 사용한다")에 맞추어 `post_logout_redirect_uri`를 `${window.location.origin}/`로 설정. Keycloak이 허용된 홈(`/`)으로 정상 복귀시킨 후, 애플리케이션 미들웨어가 `/login`으로 깨끗하게 자동 리다이렉트 처리.
  - 일반 실무 사용자 및 상담사에게 노출될 필요가 없는 내부 개발용 **[SHNEA 플랫폼 연동 관리]** 방패 아이콘 및 팝업 모달(`PlatformIntegrationModal.tsx`)을 완전히 삭제하여 실무 중심의 깔끔한 워크스페이스 확보.

## 검증 및 Git 상태

- `frontend`: Turbopack 빌드 성공, TypeScript 5 컴파일 오류 0건, 라우트 5종(`○ /`, `○ /_not-found`, `○ /auth/callback`, `○ /login`, `○ /support`) 및 `Proxy (Middleware)` 생성 완료.
- `backend`: Gradle 8.12 / Java 21 컴파일 및 bootJar 빌드 성공 (`hellow-dev-api`).
- Docker Compose 4개 컨테이너 정상 가동 및 헬스체크 통과:
  - `hellow-dev-db-1` (Up, healthy, `0.0.0.0:30161->5432/tcp`)
  - `hellow-dev-api-1` (Up, healthy, `8080/tcp`)
  - `hellow-dev-web-1` (Up, healthy, `3000/tcp`)
  - `hellow-dev-nginx-1` (Up, `0.0.0.0:30160->8080/tcp`)
- 인증 가드 및 화면 라이브 검증:
  - 비로그인 `curl.exe -s -i http://localhost:30160/` -> `HTTP/1.1 307 Temporary Redirect` (Location: `/login`) 즉시 리다이렉트 확인.
  - 인증 쿠키 첨부 `curl.exe -s -i -H "Cookie: hellow_logged_in=true" http://localhost:30160/` -> `HTTP/1.1 200 OK` 정상 렌더링 확인.
  - 외부 고객용 화면 `curl.exe -s -i http://localhost:30160/support` -> `HTTP/1.1 200 OK` 비로그인 정상 접근 확인.
  - 로그인 화면 `http://localhost:30160/login` -> "로그인" 단일 액션 정돈, Keycloak 리다이렉트 박스 완전 제거, 개발 환경 조건부 버튼 확인.
- `python scripts/verify-docs.py`: Markdown 문서, 로컬 링크, 요구사항 대응, 스킬 메타데이터, 원본 해시 검증 통과.

## 남은 일과 다음 시작점

- 플랫폼 관리자 화면에 등록된 Keycloak OIDC 실제 브라우저 로그인 및 세션 워크스페이스 진입 테스트.
- LiveKit 실시간 음성 통신 연동 (`MVP-03`), SOPS + age 환경 변수 암호화와 배포 자동화를 진행한다.
- 운영 NAS 컨테이너 실행 및 도메인 연결은 후속 단계에서 검증한다.



