# 운영 배포

사용자가 2026-10-05 현재 기능의 운영 반영을 요청했다. 운영은 개발과 별도 DB·파일 설정을 사용하며 개발 DB를 자동 복사하지 않는다. 실제 진행 결과와 이미지 SHA는 [작업 인계](handoff.md)를 따른다.

## 경로와 파일

- 접속: `shpark@192.168.0.93:9022`, 운영 도메인 `https://hellow.shnea.kr`.
- 실행 구성: `/volume1/docker/prod/hellow/`. [운영 Compose](../compose.production.yaml), [Nginx](../infra/nginx/production.conf), [LiveKit](../infra/livekit/production.yaml)와 평문 `.env.prod`를 둔다. 전체 소스·node_modules를 복사하지 않는다.
- 데이터: `/volume2/homes/hellow/postgres`, `/volume2/homes/hellow/recordings`, `/volume2/homes/hellow/redis`. 백업은 같은 데이터 루트의 `backups`에 두며 배포 도중 기존 내용을 삭제하지 않는다.
- API·웹: `registry.shnea.kr/hellow-api:<SHA>`, `registry.shnea.kr/hellow-web:<SHA>`, `linux/amd64`.
- [환경 예시](../.env.prod.example)는 비밀이 없는 양식이다. 실제 DB/LiveKit 비밀과 플랫폼 운영 환경·키·보존 코드, OIDC 관리자 Identity를 설정한다. 개발 비밀값을 복사하지 않는다.

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
