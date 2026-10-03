# 상담 현황·기본 통계 계약 (F01)

이번 기능은 기존 접수·상담·배정·콜백을 읽는 현황과 보고서다. 원문, 소유권, 고객 연결, 상담 초안과 통화 처리는 기존 기능을 사용한다. 실제 기기 수락과 서비스 배포는 코드 검증과 별도로 기록한다.

## 접근 범위

- `agent:monitor`: 활성 Membership의 현재 직원 상태. SELF는 issuer+subject가 같은 본인, TEAM은 본인과 소속 팀·하위 팀, ORGANIZATION은 현재 조직이다. 고객·접수 식별자·본문·녹음·다른 조직의 업무 상태를 응답하지 않는다.
- `report:read`: 수치만 조회한다. SELF는 각 원천의 현재 owner issuer+subject, TEAM은 본인 또는 허용 팀, ORGANIZATION은 현재 조직이다. 팀 없는 미배정은 조직 범위에서만 보인다. 이관 참여자 원문 읽기 관계를 보고서의 소유 범위로 확대하지 않는다.
- 두 권한의 범위는 독립적이다. 상담 목록·상세 이동은 `consultation:read`를 다시 검사하며 녹음은 `recording:read`를 유지한다.
- 기존 직원·역할에 새 권한을 자동 추가하지 않는다. 조직관리자가 기존 권한 편집기로 부여한다. 새 조직의 최초 관리자는 기존 전체 기능 권한 생성 계약을 따른다.

## 집계 사전 v1

조회 기간은 `[from, until)` 날짜 경계다. 입력 시간대의 자정을 Instant로 바꾸고, 기존 `created_at`은 개발·운영의 Asia/Seoul 벽시계 저장 의미로 비교한다. 기본 시간대는 Asia/Seoul이며 시간대와 실제 경계를 응답한다. 최대 조회 기간은 366일이다. 진행 중 시간은 응답의 기준 시각으로 계산한다.

| 원천 | 기간 기준 | 지표 |
| --- | --- | --- |
| QueueItem | 최초 접수 createdAt | 접수, 현재 대기/처리 중/완료/취소, 수락, 실제 음성 연결, 미연결 종료, 미수락 자동 콜백, 미등록 |
| QueueItem | 같은 접수 cohort | 최초 수락까지 평균 대기: V21 firstAcceptedAt이 있는 건만. 과거 수락 건의 시각은 NULL 유지하고 측정 불가 건수를 표시. 대기 중은 서버 기준 시각까지 현재 대기 |
| QueueItem | 같은 접수 cohort | 실제 연결 통화 시간: callStartedAt→callEndedAt; 진행 중은 기준 시각까지. 미연결은 분모 제외. 이관되어도 원본 접수 1건. 담당자별 값은 현재 담당 접수의 전체 통화 시간이며 개인 참여 시간으로 표현하지 않음 |
| Consultation | 최초 문서 생성 createdAt | 문서 수·현재 완료/작성 중/이관 상태. 수정 버전은 새 문서로 세지 않음. 접수 없는 독립 기록도 포함 |
| FollowUpAction | 최초 후속 요청 생성 createdAt | CALLBACK의 현재 미배정/배정/예약/진행/완료/실패/취소. 실패 후 재예약은 원본 1건의 현재 상태 |
| AssignmentAttempt | 해당 기간 접수 cohort | 모든 수신 시도별 현재 결과. 접수 수·수락 접수 수와 구분 |
| WorkTransfer | 해당 기간 상담 문서 cohort | 현재 ACCEPTED인 이관 요청 수. 통화 연결·접수 건수에 가산하지 않음 |

필터는 현재 팀·담당자 Membership ID, 채널, 상담 분류 ID·결과 ID다. 담당자 ID는 조직 안에서 issuer+subject로 해석한다. 접수의 분류·결과는 접근 가능한 연결 상담이 있을 때만 적용한다. 문서 채널은 연결 접수 또는 독립 기록이다. 콜백의 채널·분류·결과 조건은 접근 가능한 원본 접수/상담에 적용한다. 원천이 없으면 필터에 일치하지 않는다. 팀·담당 그룹은 현재 소유 기준이다. 누락된 팀·직원은 미배정/이름 미확인으로 표시한다.

## 화면·실패·복구

기존 앱 메뉴에서 현황/보고서를 연다. 작성 워크스페이스를 계속 마운트하여 초안·통화를 유지한다. 한 번에 하나의 갱신 루프만 사용하고 숨겨진 화면에서는 중지한다. 마지막 성공 시각을 표시하며 일시 조회 실패를 0건이나 오프라인으로 바꾸지 않는다. 권한 거부·조직/권한 변경 때는 이전 결과를 즉시 지운다. 표는 제한된 페이지로 조회하고 필터의 빈/로딩/오류/재시도를 제공한다.

차트는 일별 접수·수락·음성 연결 추이, 전체 기간의 채널별 접수, 콜백 현재 상태를 표시한다. 일별/채널 집계는 표 페이지와 독립적으로 같은 권한·필터를 적용한다. 최대 366일 안의 접수 없는 날짜만 0건으로 채운다. 날짜 선택으로 정확한 수치를 확인하며 선 모양·범례·표를 함께 제공한다. 팀/담당자/분류/결과/상태 비교는 현재 표 페이지의 처음 20행이며 비중의 분모를 명시한다. 조회 실패는 차트에서도 마지막 성공 결과를 보존한다.

### 화면 방향 기록

- THESIS: 기존 상담 앱에서 허용 범위의 현황과 기간 추이를 한 화면에서 비교한다. 수치의 원천·분모를 확인할 수 있어야 한다.
- OWN-WORLD: 기존 slate 바탕 `#0f172a`, 중립 표면 `#1e293b`, indigo 선택 상태와 앱 글꼴을 유지한다. 별도 디자인 체계나 장식용 이미지를 도입하지 않는다.
- STORY: 조건 선택 → 성공 시각·범위 확인 → 추이·분포 비교 → 표의 정확한 값 확인 → 권한이 있으면 기존 이력 목록을 연다.
- FIRST VIEWPORT: 기존 헤더·메뉴 아래 제목/이력 버튼, 현황·기간 전환, 작은 필터와 조건 적용, 갱신 시각을 배치한다. 작은 화면에서는 필터를 두 열로 줄바꿈한다.
- FORM: F01 명세가 지정한 기존 화면 확장이다. 구조·시각 체계가 고정된 범위이므로 새 콘셉트 추첨이나 승인 comp는 적용하지 않는다. 수치 범례·키보드 날짜 선택·넓은 표로 업무 조작을 돕는다.
- FINISH: 현행 화면 검수, 독립 finish review와 documenter 확인, 실제 검증/미검증 기록 후 인계한다. 기존 DESIGN.md 부재나 이전 Impeccable 설정을 이번 기능에서 임의 복구하지 않는다.

## API·검증 재현

조회 API는 `/api/monitoring/agents`, `/api/monitoring/summary`, `/api/monitoring/options`, `/api/reports/options`, `/api/reports/consultations`, `/api/reports/followups`다. 옵션 조회에도 해당 독립 권한을 적용한다. 모든 응답은 `no-store`, 보고서는 읽기 전용 repeatable-read snapshot이다. 목록 기본 50행/최대 100행, 옵션 최대 500개로 제한한다.

- 서버 전체: `docker build --target api -t hellow-dev-api:reporting-check .` (Java21/Gradle).
- 웹: `npm test`, `npm run lint`, `npm run build` (`frontend`에서 실행).
- 합성 API Chrome: 별도 웹 서버를 실행한 뒤 `node scripts/verify-reporting-ui.cjs`. `HELLOW_REVIEW_URL`로 URL을 지정하고 필요한 경우 `NODE_PATH`로 Playwright 위치를 지정한다. 결과는 Git 제외 `output/reporting-ui/`다.
- PostgreSQL 기존 데이터 보존: **격리 복원 DB** `hellow-reporting-db`/`reporting`에서만 `python scripts/verify-reporting-postgres.py --out output/reporting-v20.json`; V21 적용 후 `--compare output/reporting-v20.json --out output/reporting-v21.json`. 모든 기존 행·열의 hash를 비교하고 과거 최초 수락 NULL과 인덱스 3개를 확인한다.
- 실제 PostgreSQL API fixture: V21의 **빈 schema만 복제한 별도 DB** `reporting_fixture`에서 `HELLOW_REPORTING_POSTGRES_TEST=true`, `HELLOW_REPORTING_TEST_URL=jdbc:postgresql://hellow-reporting-db:5432/reporting_fixture`로 `ReportingPostgresIntegrationTest`를 실행한다. 이 fixture는 데이터를 지우므로 서비스 DB에서 실행하지 않는다. 보존 검사 복원본과 분리한다.

사용자가 자는 동안 필요한 선택을 위임했고 차트를 적극 이용하라고 요청했다. 이에 코드 기반 SVG·막대 차트를 사용해 추가 유료 공급자·의존성 없이 기존 원천을 집계했다. 기간 귀속·과거 미측정·현재 소유 범위는 위 사전으로 고정했으며 운영 배포·개인 통화 참여시간·보류 사항을 확장하지 않았다.

완료 증거는 [작업 인계](handoff.md)에 갱신한다. 태블릿 작성 패널과 고객 피드백은 기존 보류 상태를 유지한다.
