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

## 검증 및 Git 상태

- `frontend`: `npm run build` 성공 (Turbopack 빌드, TypeScript 5 컴파일 오류 0건, 정적 라우트 생성 완료).
- `docker compose up -d --build` 전체 4개 컨테이너 기동 및 헬스체크 통과:
  - `hellow-dev-db-1` (Up, healthy, `0.0.0.0:30161->5432/tcp`)
  - `hellow-dev-api-1` (Up, healthy, `8080/tcp`)
  - `hellow-dev-web-1` (Up, healthy, `3000/tcp`)
  - `hellow-dev-nginx-1` (Up, `0.0.0.0:30160->8080/tcp`)
- API 동작 검증:
  - `curl -s http://localhost:30160/api/customers` -> PostgreSQL DB 초기 고객 4건 정상 응답 확인.
  - `curl -s http://localhost:30160/api/queue` -> 대기열 4건 정상 응답 확인.
  - `curl -s http://localhost:30160/api/timeline/queue-1` -> 타임라인 2건 정상 응답 확인.
  - `curl -I http://localhost:30160` -> `HTTP/1.1 200 OK` 확인.
- `python scripts/verify-docs.py`: Markdown 문서, 로컬 링크, 요구사항 대응, 스킬 메타데이터, 원본 해시 검증 통과.
- 이번 커밋 대상: `backend/` 전체, `compose.yaml`, `Dockerfile`, `infra/nginx/default.conf`, `frontend/src/app/page.tsx`, `docs/handoff.md`.

## 남은 일과 다음 시작점

- 도커 컨테이너가 포트 `30160`으로 정상 구동 중이므로 `http://localhost:30160`에서 실제 DB 영속화가 동작하는 상담사 워크스페이스를 확인한다.
- SHNEA 공식 `SERVICE_INTEGRATION.md` 지침에 따라 OIDC 직원 인증(Keycloak discovery, client app, PKCE) 및 플랫폼 파일/Job 연동 계약을 구체화한다.
- LiveKit 실시간 음성 통신 연동, SOPS + age 환경 변수 암호화와 배포 자동화를 진행한다.
- 운영 NAS 컨테이너 실행 및 도메인 연결은 후속 단계에서 검증한다.
