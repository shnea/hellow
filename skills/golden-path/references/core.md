# 현재 핵심 기준

- F02 신규 공개 CHAT의 양방향 메시지·고객 JPG/PNG 이미지 첨부·저장·복원·종료·이관/이력은 [고객 채팅 계약](../../../docs/customer-chat.md)을 따른다. 이미지 PRIVATE 저장·현재 대화 범위/뷰 티켓·원본 Blob/UUID 복원을 유지한다. 채팅 종료와 상담 기록 완료를 구분하고 기존 단건 문의를 소급 변환하지 않는다. 실제 반영 상태는 [인계](../../../docs/handoff.md)에 둔다.

- 콜백·방문 예약, 상담이관, 상담 현황·기본 통계는 My 상담 이력의 목록 디자인을 공유하고 조회 조건은 최대240px로 제한한다. [목록·현황 디자인](../../../docs/workspace-list-design.md).

- F01 상담 현황·기본 통계의 권한·집계·차트·검증 재현은 [상담 보고 계약](../../../docs/consultation-reporting.md)에 둔다. 기존 직원에게 새 권한을 자동 부여하지 않는다. 서비스 배포·실기기 수락은 최신 [인계](../../../docs/handoff.md)와 구분한다.

- 기반 템플릿: Bonfire v1. 항목과 참조 구조를 보존하고 프로젝트 기준을 채웠다.
- 프로젝트 이름: hellow.
- 목적: 특정 업종에 종속되지 않는 범용 B2B 멀티테넌트 상담·컨택센터 CRM SaaS.
- 요구사항 원문: [요구사항정의서](../../../요구사항정의서.md). 본문 1~85장의 원칙·필수 범위와 예시·후속 후보를 구분한다.
- 현재 상태: 초기 구현의 인증·조직 격리·상담 저장·파일·폴링 문제를 수정했다. [리뷰 수정 결과](../../../docs/review-repair.md)가 상세 근거이며 MVP 전체 완료 또는 운영 배포 완료는 아니다.
- 제품 첫 구현 범위: 원문 60장 MVP와 28장 최소 웹 상담 진입점. [단계별 범위](domains/02-scope.md)를 따른다.
- 추가 확정 기준: 최고관리자·조직관리자 화면, 공통 기본값과 조직 오버라이드, 최대 3단계 상담 분류, 조직/개인 템플릿, 상담 상태 모니터링을 단계적으로 구현한다. 상세와 구현 순서는 [범위](domains/02-scope.md), 상속·기록 보존은 [데이터](domains/06-data.md), 접근 경계는 [보안](domains/07-security.md)을 따른다. 지식관리·AI·조직 내부 채팅은 후반 작업이다.
- 기본 구성: workflow는 작업 절차, golden-path는 프로젝트 기준 관리. Impeccable은 [등록된 적용 조건](skills.md)에 맞는 UI 작업에 사용한다.
- 핵심 경계: Organization 격리 + Permission + Data Scope를 서버에서 검증한다. 직원 OIDC Identity, Membership, 고객 상담 세션을 구분한다. [보안](domains/07-security.md).
- 아키텍처: CRM Core / Contact Center / Async Worker / External Integration의 책임을 나누되 Entity별 MSA를 만들지 않는다. 실시간 업무 상태와 Media도 분리한다. [구조](domains/05-structure.md).
- 기술: 현재 코드는 Java 21, Gradle 8.12 계열, Spring Boot 3.4.4, Spring Security, JPA, PostgreSQL 17 계열, Next.js 16.3.8 App Router, React 19.2.8, TypeScript 5를 사용한다. 실제 빌드/의존 버전은 Dockerfile과 lockfile을 확인한다. SHNEA OIDC·File·Editor와 WebRTC/LiveKit을 사용한다. 개발 로그인·사용자의 LTE 통화·녹음 저장 확인 이후에도 실기기 회귀와 운영 수락은 구분한다. QueryDSL·Job 등 후속 범위는 [기술](domains/04-technology.md)를 확인한다.
- 운영: 개발·운영 Docker Compose, Nginx 30160, linux/amd64 NAS, SHA 이미지 태그, SOPS + age. 구체 주소·사양은 [환경 기준](../../../docs/infrastructure.md).
- 협업: 사람 친화적 소스 구조. 큰 작업 단위 완료·검증 통과 후 인계 갱신, 커밋·push. [개발 원칙](../../../docs/development.md).
- 실행·검증 명령: [검증 영역](domains/11-validation.md#실제-실행-명령). 설치 확인을 UI·제품·운영 검증 완료로 취급하지 않는다.
- 다음 시작점·남은 일: [작업 인계](../../../docs/handoff.md).
- 다른 AI의 전체 서비스 후속 개발 시작점: [AI 개발 인계서](../../../docs/ai-development-handoff.md), [기능별 상세 명세](../../../docs/remaining-feature-specs.md), [검증·운영·배포](../../../docs/development-acceptance-runbook.md). 확정 요구·현재 구현·설계 제안·미정 정책을 구분한다. 태블릿 가운데 패널 스크롤은 2026-10-04 사용자 실기기 미해결 확인으로 보류다.
- 상담 이력은 권한 범위 전체/My 목록과 공통 상세 팝업으로 구분한다. SELF는 전체 메뉴를 숨기고 타임라인은 읽기 전용 상세·명시적 인용을 제공한다. 설정·후속 요청·호전환은 작업 화면의 연결을 유지한다. 녹음은 플랫폼 PRIVATE 저장과 독립 재생 권한, 워크스페이스 아이콘을 사용한다. [상담 이력·녹음 계약](../../../docs/consultation-history-recordings.md), [이관 참여자 조회·팝업 계약](../../../docs/work-transfer.md).
- 사용자 제보 복구: 로그인·1시간 유지·초안·문의 이력·예약 반복·반응형·설정·상태 칩·실통화/플랫폼 녹음을 [복구 범위](../../../docs/workspace-repair.md)에 따라 진행한다. 모의 검사·뷰포트 검수와 실기기/실음성 수락을 구분한다.
- 남은 수락 조건: 실제 계정·파일 첨부·갱신/절전 복귀, 실제 기기 통화/호전환/종료·녹음 회귀, 운영 DB 이관·복구·NAS 배포. 과거 PUBLIC 파일 정리 항목은 실제 잔존 여부를 조사한 뒤 조치한다. 첫 조직 이관·개발 로그인·LTE 연결 등 이미 확인한 경로를 미구현으로 되돌리지 않는다. 최신 상태는 위 AI 인계와 작업 인계를 따른다. NFR 수치·요금 등 미정 사항은 근거를 확인해 정한다.
