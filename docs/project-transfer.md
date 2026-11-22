# Hellow 프로젝트 이관 안내

작성 기준일: 2026-11-22, Asia/Seoul. 대상은 현재 프로젝트를 이어받는 개발자·운영자다. 문서 이관이며 서버 이전·데이터 복사·서비스 재배포 작업이 아니다.

## 먼저 확인할 자료

1. 이 문서의 최신 현황과 남은 일을 읽는다.
2. [요구사항정의서](../요구사항정의서.md)와 [핵심 기준](../skills/golden-path/references/core.md)에서 제품 의도·조직 경계를 확인한다.
3. 맡은 기능의 계약 문서와 [작업 인계 기록](handoff.md)의 해당 최신 항목을 대조한다.
4. 저장소의 실제 코드·운영 실행 버전·현재 사용자 지시를 확인한다. 과거 진행표만으로 기능을 재작성하지 않는다.

NAS 문서 전달 위치는 **\\shpark_NAS\homes\이관문서\hellow**다. 기존 파일이 있으면 새 날짜 폴더에 별도로 정리한다. 평문 환경 파일·개인키·DB dump·고객 데이터·소스 코드·스킬 실행 자원은 문서 묶음에 넣지 않는다. 소스와 실행 명령 원문은 아래 저장소에서 인수한다.

## 1. 현재 확인한 사실과 과거 검증의 구분

| 구분 | 확인한 내용 | 근거·제약 |
| --- | --- | --- |
| 소스 저장소 | https://github.com/shnea/hellow | main; 작업 시작 로컬·원격 HEAD는 8de638f641fcc65c957ca1d415307dc703c8b78e, 미커밋 변경 없음 |
| 운영 API·웹 | registry.shnea.kr의 hellow-api·hellow-web, 태그0c0b712 | 2026-11-22 NAS에서 두 실행 이미지 태그를 직접 확인 |
| 운영 DB | PostgreSQL17.11, Flyway25 / SQL_BASELINE / 성공 | 현재 migration 이력 조회. 이번 작업에서 데이터 내용·회원·상담 원문은 조회하지 않음 |
| 서비스 | API·웹·DB·Redis healthy, LiveKit·Egress·Nginx running | 2026-11-22 NAS 조회. running만으로 실제 통화 성공을 판단하지 않음 |
| HTTPS | 로그인·공개 상담 페이지200, 공개 OIDC 설정200, 비인증 직원 API401 | 2026-11-22 PC에서 확인. 실제 계정 로그인·조직 업무 수락은 다시 실행하지 않음 |
| 원본 운영 설정 | 실행 폴더의 Compose·평문/암호문 환경 파일, 데이터 루트의 운영 age 키·최초 설치 dump 존재 | 파일 존재·권한만 확인. 환경 비밀·키 원문은 수집하지 않음 |
| 백업·복원·PRIVATE 저장·WebSocket | 2026-10-05에 검증 완료한 이력이 있음 | 당시 증거와 작업 인계가 근거. 2026-11-22에 복원·업로드·실통화 검사를 재수행한 것으로 읽지 않음 |
| 제품 테스트 | 과거 API 전체194건 중185건 통과/9건 opt-in skip, 프런트170건과 후속 B25 API build 기록 | 당시 변경의 결과. 이번 문서 이관에서 앱 테스트·빌드를 다시 수행하지 않음 |

운영 컨테이너의 현재 시작 시각은 2026-10-19 UTC로 확인됐다. 10월5일 최초 배포 시각은 배포 이력이며 현재 uptime으로 사용하지 않는다. 운영 API·웹의 실행 태그와 문서 기록 커밋은 서로 다를 수 있다.

## 2. 제품과 구현 범위

Hellow는 조직 단위로 사용하는 범용 상담·컨택센터 CRM이다. 고객의 웹 요청부터 대기열·한 상담사에게 배정·고객 식별·상담과 기록·콜백/예약/이관·이력/통계를 연결한다. 직원과 외부 고객의 진입점을 구분한다.

| 영역 | 구현된 내용 | 다음 확인할 경계 |
| --- | --- | --- |
| 인증·조직·관리 | OIDC 로그인/갱신, 조직 선택, 최고·조직 관리자, 직원·초대·팀·역할·SELF/TEAM/ORGANIZATION | 실제 계정 로그인/갱신·절전 복귀·권한 회수·조직 온보딩 수락 |
| 고객·상담·이력 | 번호 식별, 첫 저장 고객 등록, 독립 상담 기록, 전체/My 이력, 버전·초안·수정 이력·인용 | 실제 업무 흐름·첨부·동시 수정 회귀 |
| 설정·분류·템플릿 | 공통/조직 상속·오버라이드, 최대3단계 분류, 공통·조직·개인 템플릿 | 새 기능도 기존 상속·권한·과거 기록 보존 적용 |
| 상태·대기열·배정 | 수신 상태, LONGEST_IDLE 단일 순차 제안, 수락/거절·시간 제한·재시도 | 실제 기기·복귀·재접속·조직 전환 |
| 음성·녹음 | WebRTC/LiveKit, 연결 시간·종료, Egress, 플랫폼 PRIVATE 저장·재시도·권한별 재생 | 운영 LTE·2인/3인 통화·이관·장시간 녹음·업로드 장애 복구 |
| 콜백·방문·이관 | 목록/상세 팝업, 배정·일정·재예약·처리·업무/통화 이관·충돌 복구 | 실제 사용자 수락. WebRTC만으로 일반 전화 발신이 제공되는 것은 아님 |
| 고객 실시간 채팅 | 양방향 저장·재접속·종료·이관/이력, Enter 전송/Shift+Enter 줄바꿈, 상대 왼쪽/내 메시지 오른쪽 | 실제 계정·기기·공급자·권한 변경 회귀 |
| 고객 이미지 | 고객 JPG/PNG, 한 장50MiB·1600만 화소·대화20장, 선택/저장 미리보기·PRIVATE 조회 | HEIC/WebP·일반 파일·상담사 이미지 발신은 별도 범위 |
| 통계 | 상담 현황·기본 통계·차트, 조회 권한 범위·시간 계약 | 고급 통계·Export와 성능 수락은 별도 |
| 지식관리 | 별도 메뉴, 상세 팝업, 검색·게시본/수정 초안·버전·첨부·권한 | 미구현으로 재분류하지 않음. 실제 공급자·권한별 수락 확인 |
| 조직 내부 채팅 | 별도 메뉴, 1:1·그룹·참여/읽음·재접속·PRIVATE 파일·이미지 미리보기·미읽음99+ | 외부 푸시·조직 간 채팅·팀 자동 방은 추가 범위 |

## 3. 문서 시점 차이와 유지할 기준

- ai-development-handoff.md의 V21, remaining-work-summary.md의 지식/내부 채팅 미구현, 일부 golden-path/PRODUCT/진행표의 운영 미완료 문구는 과거 상태다. 현재 상태는 10월5일 최신 인계, 현재 소스와 이번 NAS 조회를 함께 본다.
- F01 통계, F02 고객 채팅, F03 지식관리, F06 내부 채팅은 구현·배포 이력이 있다. 오래된 후속 계획표를 근거로 새로 만들지 않는다.
- 첫 운영 관리자 issuer·subject는 10월5일 사용자 제공 값으로 적용됐다. 실제 변수명은 ADMIN_OIDC_SUB이며, 플랫폼에서 받은 ADMIN_OIDC_SUBJECT는 이 이름에 매핑한다. 이번 작업에서는 현재 관리자 값이나 회원 정보를 추출하지 않는다.
- 플랫폼 회원가입과 CRM 조직 Membership/권한은 별개다. 기능이 추가됐다는 이유로 기존 직원에게 권한을 자동 부여하지 않는다.
- 상담 현황·기본 통계·콜백/방문·상담이관은 My 상담 이력의 목록 디자인을 공유한다. 조회 조건 최대240px, 대화 좌우 배치·한글 조합 Enter 방지·초안 보존·지식 상세 팝업을 유지한다.
- 좌측 하단 이름 칩은 이름만 표시한다. 일반 업무 표시명의 기존 계약과 혼동하지 않는다. 이미지 썸네일 아래의 중복 원본 버튼을 복구하지 않는다.
- 태블릿 가운데 문서 패널 스크롤과 고객 피드백은 사용자 보류 항목이다. 과거 에뮬레이션 통과를 실제 해결 증거로 쓰지 않는다.

## 4. 소스 구조와 개발 인수

| 책임 | 저장소 안의 시작점 |
| --- | --- |
| 서버 | backend/src/main/java/kr/shnea/hellow |
| 인증·권한·관리 | security 패키지의 WorkspaceAccess, MembershipAccess, BusinessScope, AdminAccess와 조직/직원/팀/역할 Controller |
| 고객·상담·타임라인 | customer, consultation, queue, timeline 패키지 |
| 공개 접수·배정·콜백·이관 | support, routing, followup, transfer 패키지 |
| 음성·녹음·플랫폼 | livekit, recording, platform 패키지 |
| 통계·협업 | reporting, collaboration, chat 패키지 |
| DB 변경 | backend/src/main/resources/db/migration |
| 직원 화면 | frontend/src/app/page.tsx 및 components의 기능별 Workspace/Dialog |
| 고객 진입·미디어 | frontend/src/app/support, hooks, lib/support-session.ts |
| 실행·검사 정의 | Dockerfile, compose.yaml, compose.production.yaml, frontend/package.json, backend/build.gradle.kts, scripts |

현재 소스의 기술은 Java21·Gradle8.12.1·Spring Boot3.4.4·JPA·Flyway10.20.1·PostgreSQL17.11, Node24 기반 Next.js16.3.8·React19.2.8·TypeScript5다. 정확한 npm 해석 버전은 lockfile로 인수한다. SHNEA Editor의 로컬 tgz 의존성을 함께 인수하며 새 환경에서 npm 의존성 설치 가능 여부를 확인한다.

원격 저장소의 접근 권한을 확보해 지정한 commit과 main의 차이를 확인한다. 앱 소스·lockfile·Dockerfile·마이그레이션·스크립트·프로젝트 지침/스킬은 저장소에서 받는다. NAS의 실행 폴더에는 전체 개발 소스가 없다.

새 환경에서는 기존 프로젝트 지침을 확인하고 프런트 테스트·ESLint·TypeScript/production build, Java21 전체 build와 변경 영향의 실제 PostgreSQL 검사를 수행한다. 문서 검사만 통과했다고 앱 테스트 통과를 주장하지 않는다. 이번 문서 묶음에는 실행 명령을 복사하지 않으며 원문 실행 기준은 저장소의 development-acceptance-runbook.md와 각 빌드 정의에 있다.

## 5. 운영 경로·네트워크·외부 연동

| 대상 | 위치·계약 |
| --- | --- |
| 운영 접속 | https://hellow.shnea.kr, NAS192.168.0.93, SSH9022의 기존 shpark 계정 |
| 실행 구성 | /volume1/docker/prod/hellow: Compose·Nginx·LiveKit·.env.prod·.env.prod.enc·tools/sops |
| PostgreSQL | /volume2/homes/hellow/postgres, DB 외부 포트 미노출 |
| Redis | /volume2/homes/hellow/redis, 내부6379 |
| 녹음 임시 파일 | /volume2/homes/hellow/recordings, API/Egress 공유 group2000 |
| DB 백업 | /volume2/homes/hellow/backups |
| 운영 age 키 | /volume2/homes/hellow/secrets/age/prod.agekey, root600·부모700 |
| 웹/API/WS | NAS30160에서 Nginx, 외부 HTTPS/LiveKit WebSocket 연결 |
| 운영 ICE/TURN | 외부30165/TCP→NAS7881,30166/UDP→NAS7882,30168/UDP→NAS3478 |
| 개발 | PC192.168.0.55, https://dev-hellow.shnea.kr, 개발 ICE30163/TCP·30164/UDP·TURN30167/UDP |
| 이미지 | registry.shnea.kr/hellow-api 및 hellow-web의 SHA 태그, linux/amd64 |
| 플랫폼 | https://platform.shnea.kr의 Hellow PROD 환경. OIDC·PRIVATE 파일·Editor 재사용 |

호스트 기본 미디어 포트와 컨테이너 광고 포트가 다르므로 기존 Compose·LiveKit·공유기 매핑을 함께 인수한다. HTTP reverse proxy만으로 ICE/TURN이 전달되지 않는다. TLS/공유기 관리자 접근 권한·인증서 갱신 주체·온콜 담당은 별도 인수 항목이다.

녹음의 최종 저장소는 플랫폼 PRIVATE다. NAS recordings에는 녹음 중이거나 업로드 확인을 기다리는 파일이 남을 수 있으므로 임의 삭제하지 않는다. 업로드 성공 확인 후 앱이 로컬 파일을 정리한다. 현재 보존 코드는 과거 설정의 영구이며 실제 운영 정책 변경 여부는 별도 확인한다.

OIDC는 운영 realm·app 클라이언트·PKCE와 서명/issuer/만료/aud/azp/typ 검사를 사용한다. 브라우저에는 플랫폼 서버 키를 전달하지 않는다. 실제 API audience 계약과 조직+Permission+Data Scope를 함께 유지한다.

## 6. 비밀·데이터·백업 인수

문서만으로 실행 환경이 완전히 복원되는 것은 아니다. 아래 접근 권한과 비밀을 기존 보관 위치에서 별도로 안전하게 인수한다.

| 인수 대상 | 보관·주의 사항 |
| --- | --- |
| 환경 설정 | Git의 .env.dev.enc/.env.prod.enc와 .sops.yaml, NAS의 운영 평문/암호문. 실제 값은 문서 묶음에 없음 |
| age 개인키 | 운영 키는 위 NAS 보호 경로, PC 키는 기존 사용자의 홈 .config/hellow/age. Git·공유 문서에 복사하지 않음 |
| 플랫폼 | PROD 환경·OIDC 로그인 설정·서버 API 키·파일 보존 정책·관리자 접근 권한 |
| 레지스트리 | 이미지 pull/push 권한. 문서에 인증정보를 적지 않음 |
| DB·파일 | 현재 DB와 플랫폼 파일은 별도 데이터 인수. 문서 이관을 DB/파일 복사 완료로 간주하지 않음 |
| 최초 검증 dump | hellow-first-install-20261005_035230.dump, SHA256 eaff2142d3c8253f0515713e8aeab6ae7921c5370b6acc7d471067d55d4d91ba |
| 최초 복원 DB | hellow_restore_20261005_035230. 10월5일 검증 대상이며 현재 서비스 데이터 복구점이 아님 |

운영 .env.prod와 age 키가600으로 존재하는 것은 이번에 확인했다. 공유 폴더 접근자에게는 필요한 문서 권한만 부여하고, 운영 credential·키·고객 데이터 접근은 담당 범위에 따라 별도로 인계한다.

백업 인수 시 현재 시점의 백업 주기·마지막 성공·보관·다른 장애영역 복제·복구 권한을 확인한다. 자동 백업·정기 복원 리허설·RPO/RTO는 기존 인계에서 미완료/미정이며 이번에 새로 설정하지 않는다.

## 7. 재배포·복구 절차의 판단 기준

1. 현재 Compose project·이미지·DB 버전·마운트·활성 상담/채팅/이관을 확인한다. 다른 NAS 프로젝트를 중지하지 않는다.
2. 변경 이미지와 DB의 호환성을 확인하고 현재 DB·필요 설정·업로드 대기 녹음을 보호한다.
3. 별도 복원 DB에서 migration·Hibernate validate·전체 원문/권한/관계 보존을 확인한다. 실제 서비스 DB로 복원 시험하지 않는다.
4. 필요한 입구·worker만 동결하고, 정해진 서비스만 반영한다. 정상 worker 재개를 확인한다.
5. health와 실제 로그인·조직 경계·PRIVATE 파일·채팅·WebSocket·음성 흐름을 확인한다.
6. 실패하면 호환 이미지·설정으로 복구한다. 신규 데이터가 있는 DB를 과거 dump로 덮어쓰는 방식을 기본 rollback으로 삼지 않는다.

빈 PostgreSQL은 B25 신규 설치 baseline으로35개 업무 테이블을 만든다. 기존 migration 이력이 있는 DB는 B25를 무시한다. 기존 V2~V25 checksum을 바꾸거나 새 빈 DB에서 V3부터 바로 실행하지 않는다. 이번 인계 시점의 다음 번호는 실제 소스/DB를 대조해 정하며, 현재 소스 다음 변경은 V26 후보다.

## 8. 남은 작업과 보류

| 구분 | 대상 | 인수 후 할 일 |
| --- | --- | --- |
| 실사용 수락 | 실제 계정·조직/권한·공개 접수·콜백·이관·고객/내부 채팅·지식·이미지 | 재현 확인 후 결함만 수정. 기존 기능 전체를 재작성하지 않음 |
| 음성 수락 | LTE/외부망·실기기·통화 이관·재접속/종료·Egress 녹음/재생 | WebSocket101·단순 포트 연결과 실제 음성을 구분 |
| 운영 준비 | 관측/추적/지표/알림, 자동 백업/DR, 부하·장애 수락, 선택 배포 자동화 | 현재 운영과 비용/담당/목표를 확인한 뒤 사용자 지정 단위로 진행 |
| 신규 기능 | F04 STT/요약, F05 AI 정책·도우미, F07 사용자 필드, F08 외부 메시지 | 공급자·과금·개인정보 전송·서버 한도를 먼저 합의 |
| 후속 범위 | F09 전문 분야 배정, F10 ARS/시나리오, F11 고급 통계, F12 공지/커뮤니티, F13 위젯/외부 채널, F14 SIP/CTI | 요구·우선순위 확정 후 진행 |
| 데이터 운영 | D01 고객 병합, D02 조직 수명주기, D03 보존/삭제/익명화, D04 Export, D05 감사/운영 접근 | 보존·삭제 승인·대상·감사·복구를 먼저 정함 |
| 보류 | H01 태블릿 가운데 패널 스크롤, H02 고객 피드백 | 사용자 재개 지시 전 보류 유지 |

각 ID의 상세 설계는 [남은 기능 명세](remaining-feature-specs.md)를 참고하되 F01/F02/F03/F06의 오래된 구현 상태는 이 문서와 최신 인계로 보정한다. 미정인 SLO·유료 예산·보존기간·지원 기기 행렬을 확정값으로 만들지 않는다.

## 9. 인수 완료 체크리스트

- 소스 저장소·지정 커밋·현재 운영 이미지의 관계와 문서 시점 차이를 설명할 수 있다.
- 제품 요구·기능 계약·14개 기준 영역·의사결정·보류 항목을 찾을 수 있다.
- 개발 빌드·검사 환경과 Editor tgz/lockfile 의존성을 확보했다.
- NAS/공유 폴더·플랫폼·레지스트리·TLS/공유기·DB/파일 접근 담당을 구분했다.
- 운영 비밀/age 키와 최신 DB·플랫폼 파일을 문서와 별도로 안전하게 인수했다.
- 실제 관리자/조직/권한·핵심 업무·실기기 음성/녹음을 검수했다.
- 최신 백업의 복원·데이터/권한 보존과 장애 복구 절차를 별도 환경에서 확인했다.
- 다음 개발 한 단위·완료 조건·정책 결정자·비용 주체를 합의했다.

이번 요청에서 완료하는 것은 이관 문서 정리·공유 폴더 전달·문서 무결성 확인이다. 위 인수자가 수행할 제품 수락·권한 이전·데이터 이전은 체크리스트로 전달한다.
