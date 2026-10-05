# 운영 배포

사용자가 2026-10-05 현재 기능의 운영 반영을 요청했다. 운영은 개발과 별도 DB·파일 설정을 사용하며 개발 DB를 자동 복사하지 않는다. 실제 진행 결과와 이미지 SHA는 [작업 인계](handoff.md)를 따른다.

## 경로와 파일

- 접속: `shpark@192.168.0.93:9022`, 운영 도메인 `https://hellow.shnea.kr`.
- 실행 구성: `/volume1/docker/prod/hellow/`. [운영 Compose](../compose.production.yaml), [Nginx](../infra/nginx/production.conf), [LiveKit](../infra/livekit/production.yaml)와 평문 `.env.prod`를 둔다. 전체 소스·node_modules를 복사하지 않는다.
- 데이터: `/volume2/homes/hellow/postgres`, `/volume2/homes/hellow/recordings`, `/volume2/homes/hellow/redis`. 백업은 같은 데이터 루트의 `backups`에 두며 배포 도중 기존 내용을 삭제하지 않는다.
- API·웹: `registry.shnea.kr/hellow-api:<SHA>`, `registry.shnea.kr/hellow-web:<SHA>`, `linux/amd64`.
- [환경 예시](../.env.prod.example)는 비밀이 없는 양식이다. 실제 DB/LiveKit 비밀과 플랫폼 운영 환경·키·보존 코드, OIDC 관리자 Identity를 설정한다. 개발 비밀값을 복사하지 않는다.
- 첫 관리자 등록은 실제 운영 회원가입 후 `ADMIN_OIDC_ISSUER`와 `ADMIN_OIDC_SUB`를 설정하고 API를 다시 반영한다. 코드의 subject 변수명은 `ADMIN_OIDC_SUB`다. 비어 있으면 최고관리자 접근을 부여하지 않는다.
- 파일 보존 기간이 정해지기 전에는 플랫폼의 활성 `영구` 보존 코드를 사용한다. NAS `recordings`는 녹음 중/업로드 대기 파일용이며 최종 저장소는 플랫폼 PRIVATE다. 업로드 확인 후 로컬 파일을 제거한다.

## 신규 DB 초기 스키마

기존 V2~V25는 Hibernate로 만들어진 초기 개발 테이블을 전제로 하므로 빈 DB에 곧바로 적용할 수 없었다. [B25](../backend/src/main/resources/db/migration/B25__initial_production_schema.sql)는 검증된 V25의 전체35개 테이블·시퀀스·인덱스·CHECK/외래키를 신규 DB에 생성한다. 고객·조직·회원·권한·파일 데이터는 포함하지 않으며 `routing_lock` 조정 행1개만 초기화한다.

[Flyway baseline migration](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/baseline-migrations)은 migration 이력이 없는 새 DB에만 적용된다. 기존 V25 DB에서는 B25를 무시하고 V2~V25의 checksum과 이력을 유지한다. 실패했던 신규 설치 DB도 자동 삭제하지 않고 별도 이름과 dump로 보존한 뒤 새 빈 DB에 설치한다.

## 환경 파일 암호화

- 암호문: 저장소의 `.env.dev.enc`, `.env.prod.enc`; 수신자 규칙은 `.sops.yaml`이다. SOPS3.9.0과 age1.2.0의 공식 릴리스를 사용하며 SOPS 바이너리는 공식 릴리스 체크섬으로 검사한다.
- PC 개인키: 사용자 홈의 `.config/hellow/age/dev.agekey`, `prod.agekey`. 상속 ACL을 제거하고 해당 사용자만 접근하도록 설정한다. Git 밖에 보관한다.
- NAS 운영 개인키: `/volume2/homes/hellow/secrets/age/prod.agekey`, root 소유600/부모700. 운영 실행 폴더의 `tools/sops`로 복호화한다. 개발 개인키는 NAS에 올리지 않는다.
- NAS `.env.prod`와 `.env.prod.enc`는600으로 저장한다. 설정을 변경하면 암호문을 함께 갱신하고 복호화 결과의 모든 값을 비교한다. 평문이나 개인키를 커밋하거나 명령 출력에 포함시키지 않는다.

NAS 복원 시에는 실행 폴더에서 다음을 사용한다. 입력 키와 암호문이 해당 운영 환경의 것인지 먼저 확인한다.

```sh
umask 077
SOPS_AGE_KEY_FILE=/volume2/homes/hellow/secrets/age/prod.agekey \
  tools/sops --decrypt --input-type dotenv --output-type dotenv .env.prod.enc > .env.prod
docker-compose --env-file .env.prod -f compose.production.yaml config -q
```

## 확인과 반영

1. NAS의 실제 컨테이너·포트·구성·DB 버전·마운트를 읽어 기존 배포와 데이터 유무를 확인한다. 기존 경로/Compose project를 추측해 교체하지 않는다.
2. 플랫폼의 운영 프로젝트/환경·PRIVATE 보존 정책과 운영 redirect/logout URI를 확인한다. 운영 관리자의 issuer/subject는 실제 검증된 값을 사용한다.
3. SOPS+age의 기존 수신자/키 보관 위치를 확인하고 평문 `.env.prod`는 Git 밖에600 권한으로 둔다. 암호문만 저장소에 기록한다. 설정 출력에 비밀을 포함시키지 않는다.
4. `docker-compose --env-file .env.prod -f compose.production.yaml config -q`로 검증하고 SHA 이미지를 pull한다. API가 schema를 바꾸는 기존 운영 환경에서는 실제 버전을 기준으로 migration 영향을 먼저 검토한다.
5. 기존 운영 DB·구성·녹음을 백업하고 체크섬을 기록한다. 별도 복원 DB에서 Flyway/validate·원문·권한 보존을 확인한다. 신규 설치이면 격리된 빈 DB에서 V25와 관리자/조직 진입을 확인한다. 개발 DB 복사는 별도 사용자 지정이 있을 때만 한다.
6. 진행 통화·고객 채팅·미결 이관을 확인하고 Nginx 입구와 관련 worker를 동결한 뒤 동일 보존 검사를 수행한다. 다른 프로젝트의 서비스는 중지하지 않는다.
7. API·웹·필요한 새 Media 구성을 반영하고 health·로그인/OIDC·조직 경계·PRIVATE 파일·공개 상담·WebSocket을 확인한다. 작업이 끝나면 정상 worker를 복구한다.
8. TLS reverse proxy가 `192.168.0.93:30160`으로 연결되는지 확인한다. 공유기 외부30165/TCP→NAS7881,30166/UDP→NAS7882,30168/UDP→NAS3478 및 방화벽을 확인한다. 실제 LTE 통화/녹음 수락과 단순 HTTP200을 구분한다.
9. 실패 시 기존 호환 이미지·구성으로 복구하고 신규 데이터가 생긴 실제 DB를 과거 dump로 덮어쓰지 않는다. 백업/검증 DB·버전·서비스 시각·남은 수락을 인계에 기록한다.

## 현재 검증 경계

운영 파일을 준비한 것, 이미지 게시, 실제 NAS 반영, 실기기 통화 수락은 각각 별도 결과다. 준비 검사를 실제 운영 완료라고 보고하지 않는다. 사용자가 지정한 배포 범위는 현재 기능이며 STT/AI/외부 발송 등 후속 개발을 포함하지 않는다.
