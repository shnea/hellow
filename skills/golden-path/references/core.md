# 현재 핵심 기준

- 기반 템플릿: Bonfire v1. 항목과 참조 구조를 보존하고 프로젝트 기준을 채웠다.
- 프로젝트 이름: hellow.
- 목적: 특정 업종에 종속되지 않는 범용 B2B 멀티테넌트 상담·컨택센터 CRM SaaS.
- 요구사항 원문: [요구사항정의서](../../../요구사항정의서.md). 본문 1~85장의 원칙·필수 범위와 예시·후속 후보를 구분한다.
- 현재 상태: 초기 구현의 인증·조직 격리·상담 저장·파일·폴링 문제를 수정했다. [리뷰 수정 결과](../../../docs/review-repair.md)가 상세 근거이며 MVP 전체 완료 또는 운영 배포 완료는 아니다.
- 제품 첫 구현 범위: 원문 60장 MVP와 28장 최소 웹 상담 진입점. [단계별 범위](domains/02-scope.md)를 따른다.
- 기본 구성: workflow는 작업 절차, golden-path는 프로젝트 기준 관리. Impeccable은 [등록된 적용 조건](skills.md)에 맞는 UI 작업에 사용한다.
- 핵심 경계: Organization 격리 + Permission + Data Scope를 서버에서 검증한다. 직원 OIDC Identity, Membership, 고객 상담 세션을 구분한다. [보안](domains/07-security.md).
- 아키텍처: CRM Core / Contact Center / Async Worker / External Integration의 책임을 나누되 Entity별 MSA를 만들지 않는다. 실시간 업무 상태와 Media도 분리한다. [구조](domains/05-structure.md).
- 기술: 현재 코드는 Java 21, Gradle 8.12.1, Spring Boot 3.4.4, Spring Security, JPA, PostgreSQL 17.11, Next.js 16.3.8 App Router, React 19.2.8, TypeScript 5를 사용한다. SHNEA OIDC·File·Editor 계약과 WebRTC/LiveKit을 사용하며 실제 OIDC 설정·2인 통화 검증은 남았다. QueryDSL·Job 도입 여부 등 전체 기술 범위는 [기술](domains/04-technology.md)의 후속 기준을 확인한다.
- 운영: 개발·운영 Docker Compose, Nginx 30160, linux/amd64 NAS, SHA 이미지 태그, SOPS + age. 구체 주소·사양은 [환경 기준](../../../docs/infrastructure.md).
- 협업: 사람 친화적 소스 구조. 큰 작업 단위 완료·검증 통과 후 인계 갱신, 커밋·push. [개발 원칙](../../../docs/development.md).
- 실행·검증 명령: [검증 영역](domains/11-validation.md#실제-실행-명령). 설치 확인을 UI·제품·운영 검증 완료로 취급하지 않는다.
- 다음 시작점·남은 일: [작업 인계](../../../docs/handoff.md).
- 남은 수락 조건: 실제 OIDC API audience, 첫 조직 Membership, 파일 보존 정책, 기존 PUBLIC 파일 정리, 운영 DB 이관·복구, HTTPS/2인 통화와 NAS 배포 검증. [범위](domains/02-scope.md)와 [검증](domains/11-validation.md)에 구현 상태와 미실행 항목을 나눈다. NFR 수치·요금 등 미정 사항은 근거를 확인해 정한다.
