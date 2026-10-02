# 작업 인계 기록

## 완료한 작업

- 요구사항정의서 1~85장을 검토해 골든패스 원본의 core.md, 14개 영역, skills.md, decisions.md, 영역 색인을 작성했다. [핵심 기준](../.agents/skills/golden-path/references/core.md)부터 읽는다. 원문 요구사항은 수정하지 않았다.
- MVP와 Phase 2~4, 확정 기술과 검토 후보, 구현 시 수락 기준과 미검증 상태를 구분했다. Bonfire 항목·내보내기/가져오기 참조는 보존했다.
- Impeccable 4.5.0을 설치하고 reference/agents/scripts, LICENSE/NOTICE, 파일 해시를 보관했다. UI 작업 조건으로 골든패스에 등록했다. [출처](../.agents/skills/impeccable/SOURCE.md).
- 개발·운영 환경: 도메인, 포트, 레지스트리, 커밋 SHA 태그, Compose, SOPS + age, 운영 최소 배포물과 NAS 사양 기록. 상세는 [환경 기준](infrastructure.md)을 따른다.
- [개발·협업 원칙](development.md): 큰 작업 단위별 검증·커밋·push·인계 절차와 사람 친화적 소스 구조 기준 기록.
- AGENTS.md에서 환경 기준, 개발 원칙, 인계 기록을 연결.
- CI/CD는 특정 서비스 선택 배포와 전체 배포를 지원해야 한다는 요구를 반영했다.
- **상담사 작업 화면 UI 방향 확정 및 정의서 작성**:
  - 상담사가 한 화면에서 고객정보·이력·통화 제어·상담 메모를 모두 처리하는 고밀도 워크스페이스 요구를 구체화했다.
  - Impeccable 및 이미지 생성을 통해 3가지 구도의 시안(A안: 3분할 맥락형, B안: 대기열/작업흐름형, C안: 표준 CRM형)을 도출하고 [독립 HTML 미리보기](mocks/preview.html)를 제공했다.
  - 사용자 피드백을 반영하여 **B안(대기열/작업 흐름 중심) 기반 + C안(좌측 슬림 글로벌 내비게이션 바) 결합**으로 방향을 최종 확정했다.
  - 사용자 추가 요구인 **"상담 이력을 보며 후속 서비스 예약/콜백/호전환 즉시 연계"**와 **"실시간 상담 메모 영역의 충분한 확장 공간 확보"**를 [상담사 화면 UI 정의서](ui-direction.md)에 상세히 반영했다.
  - `PRODUCT.md`와 `.impeccable/mocks/decision/b.png.json` 승인 메타데이터를 동기화했다.

## 검증 및 Git 상태

- `python scripts/verify-docs.py`: Markdown 문서, 로컬 링크, 요구사항 대응, 스킬 메타데이터, 원본 해시 검증 통과.
- `preview.html`: Base64 내장형 자립 파일로 브라우저 렌더링 및 시안 이미지(a.png, b.png, c.png) 정상 표시 확인.
- 프로젝트 작성 파일의 공백·형식 검사 통과.
- 이번 커밋 대상: `PRODUCT.md`, `docs/ui-direction.md`, `docs/handoff.md`, `docs/mocks/`, `.impeccable/`, `scripts/make_preview.py`.
- 사용자 요청에 따라 이번 턴에서는 실제 제품 코드 구현을 진행하지 않고 **화면 정의 정리 및 Git 커밋·push까지 완료**한다.

## 남은 일과 다음 시작점

- 다음 작업은 확정된 화면 정의([ui-direction.md](ui-direction.md))를 바탕으로 **Next.js App Router + TypeScript 프로토타입 구현**에 착수하는 것이다.
- 프로토타입 범위: 슬림 GNB, 좌측 대기열(인바운드 콜/콜백/티켓), 중앙 통화 컨트롤러 및 확장형 메모 에디터, 우측 통합 타임라인 및 연계 후속 조치(서비스 예약/콜백/호전환). 가상 한국어 데이터를 내장하여 실제 클릭 및 전환 흐름을 검증할 수 있게 한다.
- SHNEA 공식 SERVICE_INTEGRATION.md와 필요한 하위 명세를 확인해 OIDC·File·Editor·Job 계약을 설계한다. 원문 기능 목록만으로 API를 추정하지 않는다.
- 제품 백엔드(Java/Spring Boot) 구현, Compose·Nginx 설정, 이미지 빌드, 환경 암호화와 배포 자동화는 아직 수행하지 않았다.
- LiveKit 연동, SOPS + age 키 관리, 운영 NAS 컨테이너 실행 및 도메인 연결은 후속 단계에서 검증한다.
