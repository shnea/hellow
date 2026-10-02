# hellow

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, Java 21/Spring Boot 3.4.4/PostgreSQL 17.11. 상담 화면은 인증된 조직의 실제 API 데이터를 사용한다. 개발·운영 실행은 Docker Compose, Nginx 외부 포트 30160을 따른다. 부분 구현·검증·남은 계약은 docs/review-repair.md에 기록한다.

## Users

회사·팀 단위의 상담사, 상담 관리자, 조직 관리자와 플랫폼 관리자. 외부 고객의 상담 진입점은 직원 업무 화면과 분리한다. 상담 상대방(인입 고객)은 기업 고객(B2B)뿐만 아니라 일반 개인 소비자(B2C) 및 컴플레인·민원 제기 고객을 모두 포함한다. 첫 화면은 상담사가 반복적으로 사용하는 업무 화면이다.

## Product Purpose

범용 멀티테넌트 상담 CRM (B2B 및 일반 개인·컴플레인 민원 응대 지원). 상담 요청·배정·고객 식별(기업/개인)·이전 이력·현재 상담·기록·콜백·예약·이관을 연결한다.

## Operating Context

사용자가 확인한 핵심: 고객정보·이력·통화·기록 등 여러 업무를 한 화면에서 처리하는 것이 중요하다. 화면 이동으로 맥락과 작성 중 내용을 잃지 않도록 한다.

## Capabilities and Constraints

- 직원 Identity는 SHNEA OIDC, 업무 권한은 Organization/Permission/Data Scope로 분리한다.
- 첫 실시간 채널은 WebRTC. 서버 인증·조직별 저장과 LiveKit 토큰 경계를 구현했다. 실제 OIDC 계약·2인 통화·운영 배포 수락은 남았다.
- 통화 종료와 상담 기록 완료, 보류와 음소거, 통화 이관과 담당자 변경은 서로 다르다.
- SHNEA Component·Editor는 공개 연동 계약을 확인하여 재사용한다.
- 전체 범위·MVP·후속 단계는 요구사항정의서와 golden-path가 정본이다.

## Brand Commitments

프로젝트 이름은 hellow. 업무 화면은 한국어로 작성하며 내부 기술 이름 대신 고객·상담·조직 등 사용자 언어를 쓴다. 로고·색상·폰트의 기존 확정 자산은 없다.

## Evidence on Hand

요구사항정의서.md, .agents/skills/golden-path/references/, docs/infrastructure.md. 실제 고객 데이터와 화면 자산은 아직 없다. 시연용 인물·연락처·상담 내용은 가상 데이터로 표시한다.

## Product Principles

- 여러 업무를 한 화면에서 이어가되 정보의 우선순위를 명확히 한다.
- 고객 맥락과 미저장 기록을 보존한다.
- 상태와 다음 행동을 명확하게 안내한다.
- 특정 업종이나 통신 채널에 Core 업무를 종속시키지 않는다.
- 권한·조직 경계를 실제 API 구현에서도 검증한다.

## Accessibility & Inclusion

고지·상태·취소/종료 조작은 디자인 변경으로 숨기지 않는다. 키보드 초점, 레이블, 색 외 상태 표시와 좁은 화면에서의 접근을 지원한다. 실제 지원 브라우저 행렬은 미정이다.
