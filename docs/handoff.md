# 작업 인계 기록

## 완료한 작업

- 요구사항정의서 1~85장을 검토해 골든패스 원본의 core.md, 14개 영역, skills.md, decisions.md, 영역 색인을 작성했다. [핵심 기준](../.agents/skills/golden-path/references/core.md)부터 읽는다. 원문 요구사항은 수정하지 않았다.
- MVP와 Phase 2~4, 확정 기술과 검토 후보, 구현 시 수락 기준과 미검증 상태를 구분했다. Bonfire 항목·내보내기/가져오기 참조는 보존했다.
- Impeccable 4.5.0을 설치하고 reference/agents/scripts, LICENSE/NOTICE, 파일 해시를 보관했다. UI 작업 조건으로 골든패스에 등록했다. [출처](../.agents/skills/impeccable/SOURCE.md).
- 개발·운영 환경: 도메인, 포트, 레지스트리, 커밋 SHA 태그, Compose, SOPS + age, 운영 최소 배포물과 NAS 사양 기록. 상세는 [환경 기준](infrastructure.md)을 따른다.
- [개발·협업 원칙](development.md): 큰 작업 단위별 검증·커밋·push·인계 절차와 사람 친화적 소스 구조 기준 기록.
- AGENTS.md에서 환경 기준, 개발 원칙, 인계 기록을 연결.
- CI/CD는 특정 서비스 선택 배포와 전체 배포를 지원해야 한다는 요구를 반영했다. 호출 방식·태그 문법은 미정이고 `user`는 서비스 이름 예시다.

## 검증 및 Git 상태

- Bonfire 배치 시 Markdown 23개, 영역 파일 14개, 스킬 메타데이터와 로컬 연결 경로 확인 통과.
- 환경 기준의 지정 값과 AGENTS.md 연결 확인 통과.
- `python scripts/verify-docs.py`: Markdown 75개, 로컬 링크 207개, 영역 14개, 요구사항 85장 대응, 스킬 메타데이터 3개, Impeccable 파일 해시 64개 검증 통과.
- Impeccable `context` 실행 성공. PRODUCT.md·DESIGN.md·시각 구현이 없음을 확인했다. 엔진 준비·문맥 로딩 확인이며 화면 검수·detector 실행 결과가 아니다.
- 전체 `git diff --cached --check`에서 Impeccable 원본 extract.md의 끝 빈 줄과 harden.md/optimize.md의 줄 끝 공백이 확인됐다. 원본 바이트·해시 보존을 위해 수정하지 않는다. 프로젝트 작성 파일은 `git diff --cached --check -- . ':(exclude).agents/skills/impeccable'`로 별도 검사한다. 제품 코드가 없어 빌드·타입·런타임 테스트는 미실행이다.
- 원격 저장소는 `https://github.com/shnea/hellow.git`. 초기 조회 시 원격 ref가 없었으며 로컬 `main` 저장소를 초기화했다.
- 첫 커밋 대상은 요구사항·골든패스·개발/운영 문서·Impeccable·문서 검증 도구다. 실제 첫 커밋 SHA와 원격 반영 여부는 `git log -1` 및 `git ls-remote origin refs/heads/main`으로 확인한다.

## 남은 일과 다음 시작점

- 다음 작업은 MVP의 첫 구현 단위를 정하는 것이다. Java/Spring/PostgreSQL·Next.js/TypeScript는 확정됐고 구체 버전·빌드 도구·모듈 경로는 미정이다.
- SHNEA 공식 SERVICE_INTEGRATION.md와 필요한 하위 명세를 확인해 OIDC·File·Editor·Job 계약을 설계한다. 원문 기능 목록만으로 API를 추정하지 않는다.
- 제품 구현, Compose·Nginx 설정, 이미지 빌드, 환경 암호화와 배포 자동화는 아직 수행하지 않았다.
- SOPS + age의 수신자 공개키·키 주입 방식·암호문 파일명, TLS 종료 위치, CI/CD 조건을 구성 시 확정한다.
- 새 UI 시작 시 Impeccable init으로 PRODUCT.md 문맥을 준비한다. 요구사항·골든패스에서 확인된 답을 반복 질문하지 않고 필요한 디자인 정보만 확인한다. UI 구현·브라우저·detector 검증은 미실행이다.
- LiveKit은 우선 검토 후보이며 선정·버전·미디어 연결 검증이 필요하다. Routing, Timeout/재Queue/재접속·이관 정책은 상세설계에서 결정한다.
- 규모·SLO·RPO/RTO·보존기간·Quota·유료 AI 예산·지원 브라우저는 해당 기능 도입 전에 정한다. 운영 데이터 발생 전 Backup/Restore를 검증한다.
- 운영 NAS의 컨테이너 실행 및 도메인 연결은 미검증이다. Docker Engine 버전도 아직 확인하지 않았다.
- `.agents` 수정 권한 승인 후 원래 골든패스 문서에 기준을 직접 입력했다. 별도의 docs/golden-path 보완본은 만들지 않았다.
