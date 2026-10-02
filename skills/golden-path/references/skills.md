# 추가 스킬 연결

프로젝트 상대 경로 기준이다. workflow는 작업 절차, golden-path는 기준을 관리하며 전문 스킬이 이를 대체하지 않는다.

### 등록된 스킬

| 실제 이름·별칭 | 상태 | 프로젝트 상대 경로 | 출처·버전 식별 |
| --- | --- | --- | --- |
| impeccable / Impeccable | 사용 | `skills/impeccable/SKILL.md` | pbakaus/impeccable, 4.5.0, engine 0.1.11; [출처·라이선스·해시](../../impeccable/SOURCE.md) |

상태: 준비 중 / 사용 / 중지. 상태 ‘사용’은 설치 및 문맥 로딩 준비 확인이며 UI 구현·검수 완료를 뜻하지 않는다.

### 항상 참고해야 하는 부분

| 등록된 스킬 | 참고할 파일·절 | 기본 역할·적용 범위 | 제외·협업 기준 |
| --- | --- | --- | --- |

전체 본문을 모든 작업에 강제하지 않는다. 아래 UI 조건이 맞을 때 필수 선행 절을 함께 읽는다.

### 필요시 적용되는 부분

| 등록된 스킬 | 참고할 파일·절 | 방식 | 상황·특별 지시 | 역할 | 제외·협업 기준 |
| --- | --- | --- | --- | --- | --- |
| impeccable | [SKILL.md](../../impeccable/SKILL.md)의 Setup, How to design, Modes, Commands 및 해당 reference | 조건 일치 | 화면 신설·수정·디자인·접근성·문구·반응형·UI 검수 | 문맥 로딩, 작업 유형 선택, 디자인·품질 검증 | Backend 전용·환경 문서 작업에는 미적용. 기존 SHNEA Component와 확정 UX/권한 유지 |
| impeccable | [reference/init.md](../../impeccable/reference/init.md), [reference/new-work.md](../../impeccable/reference/new-work.md), [reference/craft-floor.md](../../impeccable/reference/craft-floor.md) | 조건 일치 | 새 화면/재설계: 제품 문맥 필요 시 init, 방향 결정 후 UI 수정 직전 craft-floor | PRODUCT.md 문맥과 화면 설계·편집 기준 | 요구사항에 있는 답을 반복 질문하지 않음. 현재 설치 요청을 제품/UI 구현으로 확대하지 않음 |
| impeccable | SKILL.md Commands 표의 해당 참조; [reference/routing.md](../../impeccable/reference/routing.md) | 명시 요청 | audit/polish/shape 등 명령, 인자 없는 호출은 메뉴 | 요청한 UI 절차 | hooks/live/doctor는 관련 요청 때만. 설치만으로 자동 hook·계정·배포를 실행하지 않음 |

### 의존성·확인 결과·프로젝트 예외

- 스킬과 reference/agents/scripts 자원, 공식 LICENSE/NOTICE를 프로젝트 안에 보관하고 SHA256SUMS.json으로 식별한다.
- Windows는 `scripts/impeccable.cmd`, 다른 지원 환경은 `scripts/impeccable` launcher 사용. 엔진은 사용자 캐시로 준비하며 프로젝트의 필수 개인 PC 절대 경로를 두지 않는다.
- Impeccable context·harden·craft-floor를 적용했고 PRODUCT.md와 UI 구현이 있다. [리뷰 수정 결과](../../../docs/review-repair.md)에 이번 기능 복구의 브라우저 확인 범위를 기록했다.
- detector의 기존 색상·gradient·border·animation 경고 12개가 남아 있다. 이를 통과나 시각 개선 완료로 기록하지 않는다. 자동 hook 미설치이므로 웹 UI 변경 완료 시 원본 안내의 수동 detector를 사용한다.
- 적용 예: 상담사 작업 화면·고객 웹 상담 진입점 설계, 접근성·문구 검수. 비적용 예: DB 마이그레이션만 수정, Compose 문서 작성.
- 업무 화면은 원본 Modes의 Operate 원칙에 따라 업무 흐름·일관성·가독성을 우선한다. 브랜드·제품 문맥과 확정 범위가 스킬의 표현 지향보다 우선한다.
- Impeccable의 실행 경로 표기만 프로젝트 이전 위치에 맞췄다. 원본 해시와 수정본 해시는 [출처 기록](../../impeccable/SOURCE.md)에서 구분한다. 제품 기준의 정본은 요구사항·골든패스이며 PRODUCT.md의 문맥도 이 기준과 맞춘다. DESIGN.md가 생성되면 필요한 문맥을 연결한다.
- 추가·변경 절차: [skill-management.md](skill-management.md).
