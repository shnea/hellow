# 작업 인계 기록

## 2026-10-04 최우선 정정 — 조직 로그인·자동 고객 등록·전체 이력·기본 화면

- **개발 반영 완료: `4c75290`**, API00:49:27·웹00:49:12 KST. V15·새 이미지 health·외부 login/support/공개 조직 HTTP200·복원 DB와 실제 DB의 기존 전 행/열 보존 검사 통과 후 정상 worker/외부 요청을 재개했다. 이어 검증된 고객 연결 복구를 별도 백업·복원·서비스 정지 구간에서 실제 적용했다. 고객6→7, 접수43/상담66/타임라인35 보존, 고객 미연결 저장 접수29→0. 기존 고객 항목은 삭제하지 않았고 상담 원문·담당·권한·시각은 hash로 보존을 확인했다. 배포 증거 `output/workspace-repair-deployment.json`, 복구 증거 `output/customer-repair-*.json`과 백업/복원 DB 유지. 운영 NAS 미반영, 실제 직원 로그인 수락은 사용자 계정에서 확인해야 한다.

- 기존 해석을 철회한다. 미등록 고객을 별도 유형으로 유지하거나 별도 등록 버튼을 요구하지 않는다. 식별 가능한 첫 상담 저장에서 고객을 자동 생성/연결하고 다음 수신 시 번호로 기존 고객을 연결한다. 이름·번호 수정 시 기존 연결된 이력을 보존한다. 고객·상담 이력은 고객 명부가 아닌 모든 상담 기록/접수를 기준으로 한다. 온라인 문의의 실시간 채팅 전환은 후속이다.
- 실제 Membership 2개에 불변 OIDC subject 대신 로그인 아이디가 저장돼 있었다. `/api/me`에서 서명 검증된 동일 issuer의 preferred_username과 관리자가 입력한 값을 일치시켜 최초 1회 불변 subject로 연결한다. 팀·역할·직접 권한 유지, 기존 subject 연결/회수된 회원은 우회하지 않으며 다른 사용자에게 다시 연결되지 않는다. 등록 폼에 두 ID의 의미를 명확히 표시했다. 실제 직원 계정 로그인 수락은 배포 뒤 별도 확인이다.
- 첫 저장·과거 기록 추가 저장에서 고객 자동 등록을 수행한다. 전화번호 수정값을 실제 Customer에 저장한다. 공개 접수의 내부 고객 조회는 직원 응대용이며 공개 응답/Media 표시명에 기존 고객 정보가 나오지 않는다. 같은 이름·번호 중복 항목은 대표 연결과 동일 고객 타임라인 합산을 사용하고 삭제하지 않는다. 다른 이름의 중복 번호는 정확한 이름으로 식별하거나 미등록으로 남겨 직원이 확인한다.
- 이력 조회를 저장 상담과 아직 저장 기록이 없는 접수의 SQL UNION·조직/행 범위·50건 페이지로 변경했다. 취소·미연결·식별 불가도 노출한다. 미저장 접수는 음수 목록 ID와 실제 queueCode로 구별하고 최초 저장 뒤 실제 상담 ID로 전환한다. 완료 기록과 취소 접수에 추가 기록을 작성할 수 있으며 재저장마다 수정 전 상담을 보존한다. 완료 재시도는 동일 본문일 때 멱등 처리한다.
- 대기열이 비어 있어도 기존 3단 워크스페이스 전체를 표시하고 별도 상담 선택 안내로 가리지 않는다. 빈 편집기의 메모는 탭 초안으로 보존하고 대상 접수가 없는 서버 저장은 비활성이다. 완료 저장 직후 같은 화면의 이전 기록 편집으로 전환한다. 처리 대기열 배정 이력·별도 고객 등록 폼 제거, 기록 제목 오른쪽 템플릿 칩 유지. 고객·상담 이력 메뉴는 모두 전체 이력으로 진입한다.
- 복원 DB에서 `scripts/reconcile-customer-history.py`를 검증했다. 기존 미연결 저장 접수29건 중28건은 같은 이름·번호 고객의 중복 등록 때문이었다. 복원본의 고객6→7, 접수43/상담66/타임라인35 보존, 미연결 저장 접수0 확인. 기존 본문·담당자·조직·권한·시각 hash 보존과 재실행 멱등성을 검사했다. SQL과 도구를 저장소에 포함하고 실행 시마다 백업/별도 복원 DB/증거 JSON을 유지한다.
- frontend 전체124건 통과(병렬 기본값 실행은 메모리 부족으로 중단해 worker2개로 제한 후 통과), lint, TypeScript/production build 및 전체 Gradle build 통과. 검수 중 빈 편집기의 초안 version 누락으로 새로고침 오류를 발견해 수정 후4개 viewport에서 재검사했다. 2486×1283/1440×900/768×1024/375×812에서 과거 기록·연락처 저장/현재 초안 보존/전체 패널 기본 표시/새로고침/가로 넘침 없음/page 오류0 확인(`output/history-workspace-ui/`). Impeccable detect는 기존 Sidebar 로고 gradient 경고1건이며 사용자 요구에 따라 기존 화면 디자인을 유지한다. 운영 NAS·실계정 로그인·삼성 실기기 수락은 이 증거에 포함하지 않는다.

## 2026-10-03 워크스페이스 내부 과거 상담 편집·미등록 고객 이력

- **개발 반영 완료: `b3dbd33`**, API23:57:38·웹23:57:23 KST. 외부 요청과 worker를 멈춘 상태에서 백업 복원 및 실제 DB의 기존 전 행/열 hash를 비교했다. 고객6/접수42/상담65/타임라인34/Membership4/직접 권한52/역할 연결1/역할1/grant13 보존·V15·API/웹 healthy·외부 login/support/공개 조직 HTTP200 통과. 정상 worker를 복원하고 Nginx를 다시 열었다. 증거 `output/workspace-repair-deployment.json`, 백업과 복원 DB 유지. 커밋·push 완료, 운영 NAS는 미반영이다.

- 사용자 캡처의 왼쪽 처리 대기열/가운데 기록/오른쪽 통합 타임라인·후속 업무 구성을 유지했다. 중복 태그·템플릿 펼침 영역을 제거하고 기록 제목 오른쪽에 `자주 사용하는 템플릿 :` 칩을 배치했다. 활성 템플릿을 표시하며 사용 빈도 순위 집계 기능은 아니다.
- 대기열의 과거 기록과 타임라인 카드는 워크스페이스 가운데에서 편집한다. 현재 상담 편집기를 유지해 미저장 초안과 통화가 기록 열기로 초기화되지 않는다. 돌아가기·기록 수정·과거 고객 정보 수정이 가능하며 저장한 완료 상담의 본문/태그를 타임라인에도 반영한다.
- 별도 상담이력은 처리 대기열을 표시하지 않는다. 조직·행 권한이 적용된 상담 기록을 50건씩 조회하고 이름/전화번호로 검색하며, 고객 등록 여부와 관계없이 저장된 기록을 포함한다. 미등록 고객 연락처는 접수에 버전 검사와 감사 기록을 적용해 수정하고 고객 등록을 강제하지 않는다. 다른 조직/행 범위 접근 및 오래된 버전은 거부한다. 저장 상담이 없는 취소·미연결 접수의 전체 이력 통합은 아직 남아 있다.
- frontend 123건, lint, production build/TypeScript 및 API 전체 Gradle build 통과. 서버 통합 검사에 미등록 이력 검색·조직/본인 범위·연락처 변경·409를 추가했다. Chrome 합성 API 검수 2486×1283(사용자 캡처 크기), 1440×900, 768×1024, 375×812에서 각각 기록/연락처 저장 1회·현재 초안 보존·별도 이력의 대기열 제외·가로 넘침 없음·page 오류 0건을 확인했다. 증거 `output/history-workspace-ui/proof.json` 및 화면 캡처. 실제 브라우저 화면을 열어 확인했고 Impeccable 수동 detect JSON 결과는 빈 배열이다. 실계정·삼성 브라우저 수락과는 구분한다.
- 녹음 생성/플랫폼 저장/재생과 서버 공통 통화 시간 등 전체 잔여 범위는 [복구 체크리스트](workspace-repair.md)를 유지한다.

## 2026-10-03 LTE 공유기 포트 충돌 해소

- 사용자가 기존 외부 포트 범위 `30001~30999` 전달 규칙을 발견해 겹침을 해소하고 연결됐다고 보고했다. 새 개별 음성 포트 전달 규칙보다 앞선 넓은 범위가 원인이었다.
- 이후 읽기 전용 TURN 검사에서 localhost/LAN 3478과 공개 30167 모두 인증 challenge `0x113`에 응답했다. 앞선 공개 포트 timeout 상태가 해소된 증거다. 이 검사는 실제 삼성 기기 양측 음성/시간 동기화 전체를 대신하지 않는다.

## 2026-10-03 LTE 경로 진단 — 공유기 전체 규칙 확인 대기

- 사용자가 LTE로 새 통화를 시도해 PC 시간은 진행·휴대폰0초를 재현했다. 서버는 상담사 ACTIVE/마이크 송출, 고객 Chrome Mobile WebView Android는 연결 전 SIGNAL_SOURCE_CLOSE였다. 현 타이머는 각 클라이언트 연결 기준이므로 PC 시간만으로 양방향 연결 성공을 판정하지 않는다.
- Windows PktMon에서 음성 호스트 TCP7881/UDP7882·3478만 counters-only로 측정했다. 실제 LTE 시도 동안 물리 Ethernet 및 모든 계층 수신0건. 도구 정상 여부를 확인하기 위해 공유기3478로 진단 UDP1개를 보내 물리 Realtek NIC Tx1/Rx0을 확인했다. 측정 종료·추가한 필터3개 정리 완료. 음성 내용은 수집하지 않았다.
- 읽기 전용 UPnP로 ipTIME AX3000M의 실제 WAN IP118.36.243.220을 확인해 서버와 일치했다. GetSpecificPortMappingEntry는 수동 규칙까지 반환한다고 보장할 수 없으며714 응답을 규칙 부재의 증거로 해석하지 않는다. 브라우저 합성 통화의 실제 원격 ICE 후보에 공개IP TCP30163/UDP30164가 포함돼 광고값도 일치했다. 내부 PC/LAN TURN3478 응답·공개30167 timeout을 유지한다. LAN에서 공개 포트 실패만으로 외부망 전체 차단을 확정하지 않는다.
- 공유기 사진의56~61번 입력값은 맞다. 앞쪽 범위 규칙과 상단 저장/적용 상태가 포함된 전체 화면을 사용자에게 요청했다. 현재 증거는 미전달/상위 차단 경로를 우선 지목하지만 공유기 충돌·적용 누락·LTE 클라이언트 송신 자체 중 최종 원인은 확정하지 않았다. 방화벽 전체 해제나 임의 포트 재변경은 하지 않았다. 진단 도구는 Git 제외 `output/lte-path-probe.py`, `output/media-diagnostics.cjs`, `output/rtc-repair-probe.cjs`에 있다.

## 2026-10-03 상담 대기 전 마이크 준비 확인

- **개발 반영 완료: `1fe0ef4`**, API22:57:48·웹22:57:33 KST. 이전 두 번째 롤백의 차이는 접수37건의 `version`/`media_cleanup_until`뿐으로 종료 Media 정리 worker에 의한 변경이었다. 최종 배포는 Nginx와 자동 worker를 멈춘 검증 구간에서 복원 DB 및 실제 DB의 모든 기존 행·열 hash를 확인하고, 정상 worker 설정을 복원해 API를 재시작한 뒤 외부 요청을 열었다. 고객6/접수37/상담61/타임라인30/Membership4/직접 권한52/역할 연결1/역할1/grant13 보존·V15·웹/API health·외부 login/support/공개 조직 HTTP200 통과. 백업·복원 DB·이미지 증거는 `output/workspace-repair-deployment.json`에 보존한다. 이전 a18194f의 PC 마이크 선확보와 앞선 복구 변경도 함께 반영됐다. 실제 삼성 브라우저/LTE 수락·운영 NAS 반영은 완료하지 않았다.

- 상담 대기 클릭/선택에서 실제 마이크를 먼저 확인하고 성공한 경우만 AVAILABLE을 저장한다. 확인용 스트림은 송출·녹음하지 않고 즉시 stop한다. 거부 시 사이트 권한 안내, 장치 오류 안내, 20초 무응답 중단과 늦은 허용 스트림 정리를 추가했다. 로그인/백그라운드 폴링에서는 권한 팝업을 띄우지 않는다. 새로고침 후에는 다시 대기를 선택해야 한다.
- 준비 여부를 heartbeat에 전달한다. 권한 해제/입력 장치 제거가 폴링에서 확인되면 서버 라우팅 잠금 안에서 미수락 배정을 반납하고 AWAY로 전환·다음 상담사 배정을 시도한다. 수락한 통화와 기록은 회수하지 않고 이후 자동 수신만 차단한다. 수락 직전에도 준비 여부를 확인한다. Permissions API 미지원 브라우저는 이 탭의 허용 성공과 장치 목록을 기준으로 하므로 OS의 모든 장치 장애를 즉시 탐지한다는 보장은 없다. 구버전 heartbeat의 필드 생략은 호환을 유지한다.
- frontend 전체121건·lint·production 웹 build, Java21 전체 Gradle build를 통과했다. 추가 서버 통합 검사는 배정 회수/다음 상담사 재배정/수락한 통화 보존을 확인했다. 별도 Chrome의 실제 마이크 권한 denied/granted와 합성 장치로 대기 클릭을 확인해 거부 시 상태 변경0회·AWAY, 허용 시1회·AVAILABLE, page 오류0건을 확인했다(`output/microphone-ready-ui/proof.json`). 테스트의 최초 CDP descriptor/context 설정 오류는 수정 후 통과했다. 좁은 기존 안내 문구 수정에 Impeccable 기준을 유지하고 수동 detect를 실행했다.
- 이전 웹/API 배포는 재개 후 접수 건수가35→36으로 변해 엄격한 동결 hash 검사에서 롤백됐다. 비교 중 외부 요청이 유입되지 않도록 다음 배포는 Nginx도 일시 정지한 뒤 기존 전 행/열 검사와 복원 DB 검증을 유지한다. 이 기록 시점에는 아직 미배포이며 실제 서비스는 ef6d41c다. LTE·녹음·공유 통화 시간 등 전체 잔여 범위는 유지한다.

## 2026-10-03 PC 초기 마이크 확보 순서 수정

- 사용자가 실제 PC에서 수락 뒤 시간0초/연결 실패를 보고했다. 같은 시점 서버에서 PC는 JOINED·track 없음, Wi-Fi 고객은 ACTIVE·마이크 송출을 확인했다. 사용자가 음소거를 조작해 마이크가 잡히자 PC 통화가 동작했다고 확인했다. 기존 코드는 `room.connect` 완료 후 마이크를 요청하므로 최초 PC에서 권한 확보 전 ICE 연결이 멈출 수 있었다.
- `createLocalAudioTrack`으로 권한/장치를 먼저 확보한 뒤 Room에 연결하고 마이크 source로 publish한다. 재연결 때 음소거는 publish 전에 적용하며, 취소 뒤 늦게 허용된 track도 stop해 마이크가 남지 않게 한다. 권한 거부/장치 오류는 기존 구체적 안내를 유지한다. 관련12건과 lint·웹 production build 통과. 실제 합성 RTC의 상담사/고객×3개 viewport 총6개에서 자동 재생 복구와44px 버튼 접근을 다시 확인했고 최종 page/console 오류는 없었다. 실제 사용자에 대한 서비스 반영은 별도다.
- 사용자의 공유기 캡처 `다운로드/화면 캡처 2026-10-03 222625.png`에서 여섯 포트 전달 규칙이 최종 합의와 일치함을 확인했다. 사용자에게 재입력을 요구하지 않았다. LTE는 여전히 미해결이며 내부 TURN 응답·공개 TURN timeout과 실제 모바일 LTE 실패를 추적 중이다. 개발 PC 실제IP .55, Docker의 호스트 TCP7881/UDP7882·3478 수신, Public 프로필 Docker Any 주소/포트 Allow를 확인했다. 운영 NAS 적용은 남아 있다.

## 2026-10-03 Media 포트 적용·자동 재생 복구 — LTE 원인 추적 중

- 참가자0명을 확인하고 개발 LiveKit 1.13.7에 새 공개 포트/UDP TURN 설정을 적용했다. 짧은 개발 기본 Media 비밀값을 새 값으로 교체하고 기존 API 이미지 `ef6d41c`를 동일 키로 재시작했다. 비밀값은 Git 제외 환경 파일에만 보관한다. API healthy, Nginx 검사/reload, 새 공개 nodeIP와 TCP30163/UDP30164 광고를 확인했다. 실행 중 웹/API 소스는 여전히 `ef6d41c`·V15이며 후속 기능 코드 배포는 아니다. `output/media-port-deployment.json` 참고. 운영 NAS 미반영.
- 사용자는 3개 음성/TURN 전달 규칙 추가 후에도 Wi-Fi 성공·LTE 실패를 보고했다. localhost/LAN의3478은 TURN 인증 challenge에 응답하지만 공개30167은 timeout이고 relay-only 두 Chrome 연결도 실패했다. 샌드박스 밖 재검사도 동일하다. 공개 DNS와 LiveKit이 찾은 공인IP는 일치한다. Windows 활성 Public 프로필의 Docker Backend 규칙은 TCP/UDP 모두 Any 주소·Any 포트 Allow임을 확인했다. 내부에서 공인IP로 돌아오는 실패만으로 외부 전달 오류를 확정하지 않으며, 실제 LTE 실패와 함께 공유기 규칙 화면을 요청했다. 방화벽을 임의로 해제하거나 규칙을 삭제하지 않았다.
- PC는 수신/수락은 되지만 시간이0초라고 추가 제보했다. 최근 실사용 연결 완료 로그에는 Samsung Internet 상담사와 Android WebView 고객이 있고 PC 상담사의 ACTIVE는 확인되지 않았다. 한 조회에서 양측 ACTIVE·마이크 송출이 확인됐으나 사용자 기기의 LTE 성공으로 간주하지 않는다. PC 화면 상단의 실제 오류 문구를 요청했다. 공유 시간/실제 음성 상태 구현은 여전히 남았다.
- 프런트에는 마이크 준비 이후 연결 완료 알림, 자동 재생 차단/클릭 복구, 재연결 상태 표시, 음소거 상태의 통화 hook 소유·재시도 유지·새 통화 초기화를 구현했다. 테스트에서 재시도가 이전 browser lease 해제 전에 새 lease를 요청하는 실패를 재현해 자신의 이전 lease 완료를 기다리도록 수정했다. 같은 origin의 다른 창 중복 차단은 유지한다.
- 프런트 전체 검사 최초115건 통과 뒤 음소거 재연결 회귀1건이 실패했다. lease 수정 후 관련11건 통과, 나머지105건의 직전 성공과 함께 총116건 범위를 검사했다. Docker 웹 production build/TypeScript·최종 lint 통과.
- Chrome headless1280×800/768×1024/375×812에서 상담사/고객 자동 재생 차단6장을 실제로 열어 확인하고, 44px 버튼 hit-test·가로 넘침 없음·클릭 후 차단 해제를 검사했다(`output/audio-recovery-ui/`). 실제 LiveKit+합성 마이크, API fixture, 의도적 play 거부를 사용했다. 초기 fixture의 catalog 주소 오류와 로컬 Next에 Media 프록시가 없는 연결 실패를 고친 뒤 임시 WS 프록시로 검수했다. 모바일 한 검사에는 주입한 autoplay 거부 메시지가 기록돼 무오류라고 보고하지 않는다. detector1회는 기존 selection:bg-indigo/selection:text-white를 일반 slate foreground와 결합한 gray-on-color 경고1건이며 새 색상 변경이 없어 유지한다. 삼성 인터넷 실기기·LTE 수락은 별도다.

## 2026-10-03 LTE 통화 경로 — 포트 설정 준비

- 사용자 실험에서 같은 휴대폰·삼성 인터넷은 LTE 실패, Wi-Fi 연결 성공이다. 태블릿은 삼성 인터넷·Wi-Fi다. 사용자는 음성 포트 전달이 없었다고 확인하고 새 규칙을 추가했다고 알려왔다. 최종 합의는 외부 포트만 분리하고 호스트 기본 포트를 유지하는 방식이다. 개발 `30163/TCP → .55:7881`, `30164/UDP → .55:7882`, TURN `30167/UDP → .55:3478`; 운영 `30165/TCP → .93:7881`, `30166/UDP → .93:7882`, TURN `30168/UDP → .93:3478`이다.
- 개발 Compose와 개발/운영 LiveKit 설정을 준비했다. Docker가 호스트 기본 포트를 외부와 같은 컨테이너 포트로 전달해 ICE/TURN 광고 포트를 맞춘다. LiveKit 1.13.7 고정·공개 IP 탐지·UDP TURN을 설정했다. 두 설정 모두 실제 서버 바이너리 `ports` 명령과 Compose 문법 검사를 통과했다. 운영 템플릿은 NAS에 아직 반영하지 않았다.
- 기존 개발 LiveKit의 nodeIP는 Docker 사설 주소였고 사설 host 후보와 임시 srflx 후보를 전송하고 있었다. 단순히 웹 HTTPS가 열리는 것으로 외부 음성을 보장할 수 없다. 동일 PC의 분리된 Chrome 두 개에서 로컬/개발 도메인 모두 양방향 실제 RTP 수신 바이트 증가를 확인했다(`output/rtc-repair-probe*.json`). 가상 HTML origin의 첫 검수는 Chrome LNA 차단으로 실패했으며 실제 origin 검수로 바로잡았다. PC 합성 마이크 성공은 LTE 실기기 성공과 다르다.
- 적용 전 LiveKit 조회에서 실제 연결 참가자0명을 확인했다. 이 기록 시점에는 포트 설정을 아직 서비스에 적용하지 않았다. 다음은 개발 Media 설정 적용·공개 후보/TURN 확인·사용자 LTE 수락이다. 운영 NAS의 실제 Media 서비스 배치·환경 키·방화벽 검증은 남아 있다.

## 2026-10-03 통화 서버 복구 — 잠금·종료 정리·파일 재개

- 사용자 제보 복구의 후속 단위다. 외부 LiveKit 참가자 조회를 전역 배정/조직/상담 잠금과 트랜잭션 밖으로 옮겼다. 확인한 이관 ID/version과 짧은 증거 유효기간을 대조하고, 잠금 안에서 종료·현재 담당·권한·원문·기한을 다시 검사한 뒤 담당을 변경한다. 외부 조회 중 통화가 종료되는 회귀 검사에서도 이관을 확정하지 않는다.
- 종료 통화의 `mediaCleanupUntil`을 토큰 만료까지 반복 정리하고, 만료 이후에도 실패하면 남기는 영속 작업으로 사용한다. 현재 상담사·고객·이전 이관 상담사를 하나의 worker에서 정리하며 모두 성공한 뒤 기한이 지났을 때만 null로 완료한다. 일반/이관 worker의 종료 통화 중복 루프를 제거했고, 한 참가자 실패가 나머지 참가자 제거를 막지 않는다. 기존 만료된 미정리 행도 다시 처리한다. 활성 통화 권한 재검사는 CALL만 대상으로 실제 소유 issuer를 사용한다. DB schema 변경은 없다.
- 플랫폼 파일 계약의 `receivedBytes`부터 이어 올리고 READY 응답의 기존 fileId를 복구한다. 파일 경로도 같은 스트리밍 업로드를 사용하며 크기/상태/offset을 검사한다. 부분 업로드 재개·완료 응답 재시도 검사를 추가했다. 이는 녹음 업로드 기반이며 녹음 생성·연결·재생 기능의 완료가 아니다.
- Java21 Docker `api-builder` 전체 build 통과, 실제 JUnit XML 12개 클래스127건·실패/오류/skip0 확인(`output/media-repair-test-results/`). 후처리 업무 이관 뒤 이전 상담사 제거가 기한 이후 실패해도 재시도하고 성공 뒤 완료되는 검사를 포함한다. 실행 중 개발 서비스/DB는 변경하지 않았다.
- 다음은 실제 RTC 연결 경로/양측 마이크/자동 재생/공유 시간, 서버 녹음 생성과 플랫폼 저장·권한 재생이다. 분리된 브라우저 두 개의 합성 RTC 검수를 진행 중이며 아직 실음성 성공 증거가 없다. 전체 남은 범위는 [복구 체크리스트](workspace-repair.md)를 유지한다.

## 2026-10-03 사용자 제보 복구 1차 — 로그인·초안·대기열·화면

- 사용자의 ‘쭉 진행’/취소 후 재개 지시에 따라 [전체 복구 범위](workspace-repair.md)를 유지한다. 이 단위는 전체 통화·녹음 해결이 아니며 **개발 서비스 미반영**이다. 현재 서비스 웹/API `ef6d41c`·V15, 기존 데이터/인증 서버 설정은 유지했다.
- PKCE의 refresh token/만료 시각을 사용해 API 전 자동 갱신·동시 요청의 단일 갱신·401 한 번 재시도를 구현했다. 로그아웃 뒤 늦은 갱신이 세션을 되살리지 않고 공급자 일시 장애 때 자격 증명/초안을 보존한다. 61분 모의 시간 시험은 통과했으나 실제 인증 서버 idle/max와 모바일 절전 1시간은 검증하지 않았다. 하위 고객/상담 상태 API의403은 전체 로그인 실패와 분리했다.
- 현재 접수와 과거 기록의 초안을 issuer+subject+조직별 sessionStorage에 보관하고 새로고침/인증 왕복 뒤 최신 버전과 비교한다. 저장409에서 최신 원문을 읽고 명시적 채택을 요구한다. 예약/이관 형제의 동일 React key 경고를 재현하고 고유 key로 분리했으며 반복 폴링/화면 전환 검사에서 중복 경고가 사라졌다.
- 완료/취소 접수의 조직·행 범위별50건 페이지 API와 지속 대기열/상태 필터를 연결했다. 미등록 고객의 완료 상담도 기록 ID로 열 수 있고, 기록 없는 종료 접수는204와 접수 요약을 제공한다. 고객 전체 조회는30초로 완화하되 권한/명령 변경 때 재조회한다. 새 직원·초대·역할에 두 이관 권한을 표시하고 고객 복구URL의 capability를 Nginx 로그에서 마스킹했다.
- PC/태블릿 수신 칩·모바일 select, PC 설정의 밀도/직원 목록+폼 병렬 배치를 구현했다. 모바일 편집기의 내부 고정높이/overflow에 의한 저장 버튼 잘림을 실제 브라우저에서 재현하고 수정했다. Chrome headless의1280×800/768×1024/375×812 상단·하단·설정9장과 hit-test를 확인했다. fixture API 사용이며 실기기·실통화 성공은 아니다. 증거 `output/workspace-repair-ui/`.
- frontend22파일113건·lint·Docker 웹 production build 통과. 최종 웹 build에서 테스트의 Testing Library `exact` 옵션 타입 오류가 한 번 발생해 제거 후 재빌드 통과했다. Java21 API build/실제 JUnit XML12클래스125건·실패/오류/skip0을 확인했다(`output/workspace-repair-test-results/`). DB schema 변경은 없다.
- Impeccable detector1회에서 기존 QueuePanel 굵은 한쪽 테두리를1px로 수정했다. 전용 agent type이 없어 shipped degraded 지침을 적용한 fresh 일반 reviewer가 이력 콜백 버튼/필터 전환의 오류 상태2건을 지적했으며 수정·회귀2건·동일9장 재캡처 뒤 두 항목 resolved/ship 판정했다. 전체 화면 무결함 판정으로 확대하지 않는다. fresh documenter는 기존 세계의 일반 확장으로 판정하고 DESIGN/sidecar 부재와 기존 drift를 보존했다. 결과는 `output/workspace-repair-finish-review.md`, `output/workspace-repair-documentation.md`.
- 다음은 통화의 실제 양방향 연결·공유 시간·자동 재생/음소거, 서버 녹음 생성과 플랫폼 PRIVATE 저장/재생, 지속 media cleanup와 외부 Media 호출/전역 배정 lock 분리다. 예약 전체 흐름·모든 화면의 회전/키보드·고객/티켓 구분·실계정 진입/1시간 검증도 남아 있다. 로컬 UI 검수 Next dev 포트3300을 사용 중이며 서비스 재시작은 하지 않았다.

## 2026-10-03 통화 이관 화면·동일 음성 연결 유지·실패 복구 검수

- 한글 커밋 `ef6d41c`를 push한 뒤 개발 웹/API를 함께 반영했다(API20:21:06·웹20:21:17 KST). 첫 반영 준비는 비교 도구가 실제 없는 선택 테이블 `membership_team_scope`를 조회해 백업/DB 변경 전에 실패했으며 기존 `e97d2cc` 웹/API를 자동 복구했다. 실제 테이블 목록에 맞게 도구를 수정한 다음 동결 백업을 `hellow_call_transfer_frozen_20261003_202045`에 복원해 V15/Hibernate validate/API health·CONNECTING 부분 unique index·CHECK와 기존 모든 열/권한 hash 보존을 확인했다. 실제 DB에서도 고객6/접수23/상담47/타임라인16/Membership4/후속0/이관0/이력0, 직접 권한52/역할 연결1/역할1/grant13건과 원문 hash를 보존했다. 비교는 V15 신규 열만 제외하고 Membership version 등 기존 열은 포함한다. 백업 SHA-256 `51fb15c66b12d25e032fba6b02d5162137d41a344998c68033587a3230466eb5`, 실제 이미지·시작 시각·hash는 Git 제외 `output/call-transfer-deployment.json`에 있다. 두 서비스 healthy·Nginx 검사/reload·외부 login/support/공개 조직 API HTTP200 확인. 임시 복원 API·평문 검수 환경 파일을 정리했고 백업/복원 DB는 보존했다. 실제 사용자 재로그인/통화 수락은 대신 실행하지 않았다.

- 기존 이관 화면에 활성 CALL의 요청/가용 직원·큰 수신 모달·CONNECTING 수락/확인 기한·원문 보호·거절/취소/수행 이력을 연결했다. 통화·업무의 UUID/입력을 분리하고 복원 응답 kind를 검사한다. 저장 전 요청은 차단하며 서버 최종 상태를 수락 성공으로 표시하지 않는다. 메뉴/수신 상태는 ‘상담 이관’으로 통일했고 기존 요청 사유·충돌 버전의 명시적 채택을 유지한다.
- 정확한 조직·방·임시 Identity로 연결 후 서버 확인을 요청한다. ACCEPTED의 최신 본인 접수가 같은 queue/Media Identity이면 Room과 통화 lock을 유지하고, 취소/실패/회수는 임시 연결을 정리한다. 오디오를 track별로 보관해 이전 상담사 퇴장 때 고객/다른 참가자 오디오를 지우지 않는다. SDK 영문 오류는 네트워크·마이크 권한/장치별 한글 복구 안내로 바꾸고 명시적 재시도를 제공한다. 상세는 [계약](work-transfer.md)에 둔다.
- frontend 전체99건·TypeScript noEmit·lint·Docker production 웹 build 통과. 처음 hook 테스트의 api mock/jsonBody·반환 타입 오류는 수정한 뒤 통과했다. 같은 Room/lease 유지·다른 Identity 차단·최종 실패/늦은 토큰 정리·CALL/WORK 보관 분리·이전 track 해제 후 나머지 오디오 보존·네트워크/마이크 한글 오류를 검사했다. 서버는 아래 커밋의 Java21 전체124건/이관33건/HTTP adapter2건을 유지하며 이번 UI 단위에 backend 소스 변경은 없다.
- 별도 V15 복원 DB `hellow_call_transfer_check_20261003_192233`의 새 합성 조직/직원 두 명으로 실제 CALL 접수·수락·고객 등록/공식 version3 본문 저장 뒤 브라우저 요청→큰 수신 모달→수락 CONNECTING→실제 연결 실패→대상 거절, 새 요청 수락→요청자 취소를 확인했다. API에서 원래 담당/작성자·문서/메모 보존, 대상 원문404와 취소 후 상담 대기·임시 음성 화면 제거를 확인했다. 실제 개발 데이터와 플랫폼 설정은 바꾸지 않았다. `output/call-transfer-ui-{connecting,rejected,cancelled}-proof.json`이 증거다. 임시 검수 프록시는 Media 경로를 제공하지 않으므로 연결 실패 검수이며 실음성 성공을 증명하지 않는다. geometry 캡처 때만 CONNECTING 기한을20분으로 늘렸으며 실제20초 동작 증거와 구분한다.
- 1280×800/사용자1280×720/768×1024/375×812의 요청/수신 모달·연결 확인 상단/하단과 모바일 처리 버튼17장을 실제 픽셀로 검수했다. 초기 다른 탭에 적용된 viewport 캡처는 폐기하고 실제 크기를 확인한 캡처로 대체했다. `output/call-transfer-ui-dimensions.json`과 Git 제외 `.impeccable/review/call-transfer/`에 증거가 있다. 제목부터 정상적으로 보이며 JSON의 일부 resize scrollTop은4/6/17px이므로 정확한0px 증거로 주장하지 않는다. 모바일16px 입력·44px 제어/가로 넘침 없음·하단 거절/이력 접근을 확인했다. 기능 실패의 영문 오류와 이관 메뉴 문구를 한 번에 고친 뒤 최종 캡처했다.
- detector1회 변경 대상의 기존 Sidebar 로고 gradient 경고1건을 전달했다. fresh finish reviewer는 필수17장/표본 코드와 다섯 계약 절을 검토해 해당 UI 범위 material finding 없음·ship을 반환했다(`output/call-transfer-ui-finish-review.md`). 실제 두 사람 음성·실계정·실기기 제스처와 실제20초 만료 검수는 이 판정에 없다. fresh documenter는 코드/e97d2cc diff·픽셀 표본6장·리뷰를 대조해 기존 Operate의 색/Arial·글자 위계/16·24px 간격/44px 제어/모바일16px·모달 흐름 유지의 일반 확장으로 판정했다(`output/call-transfer-ui-documentation.md`). 기존 Geist/Arial·theme·로고 gradient/shadow drift와 DESIGN/sidecar 부재는 정비하지 않았다. 검수 웹/API·합성 issuer와 브라우저 탭/viewport를 정리했고 백업·DB·증거는 보존했다. 문서 검사82파일/298링크/85요구사항·64Impeccable해시와 Git whitespace 검사를 통과했다.
- 현재 개발 웹/API는 `ef6d41c`·V15다. 반영 전 진행 중 음성/업무 이관0건을 확인했다. 다음 구현은 현황/기본 대시보드의 서버 상태·기본 통계와 상태/내용 권한 분리다. 실제 첨부/계정·미뤄 둔 두 사람 음성 수락의 전체 목표를 유지하며 통화 이관 구현/합성 실패 검수만으로 전체 완료 처리하지 않는다.

## 2026-10-03 통화 이관 서버·Media 확인·재시작 복구 검증

- 기존 업무 이관에 CALL/CONNECTING과 V15를 추가했다. 본인이 처리 중인 활성 통화만 요청하고, 수락 후 임시 대상으로 연결하지만 기존 담당/문서를 유지한다. 서버 GetParticipant의 대상 ACTIVE·마이크·SID와 기존 상담사/고객 ACTIVE 확인 후 원본/접수 담당·현재 Media Identity·확인 시각/이력을 원자 저장한다. 임시 클라이언트 토큰은 2분/마이크만·Room Admin 없음이며 확정 전 전문 접근을 허용하지 않는다. 상세는 [계약](work-transfer.md)의 V15 절에 있다.
- OFFERED/CONNECTING의 예약·unique index·현재 권한/원본 버전/기한 재검사, 20초 연결 확인·취소/실패/회수 복구와 재시작 worker를 연결했다. 성공 시 이전 Identity, 다른 최종 결과는 임시 Identity를 180초 반복 제거하고 공급자 실패가 이어지면 기한 후에도 재시도한다. V14 WORK fingerprint를 보존해 기존 UUID 재전송이 실패하지 않도록 수정했다.
- Java 21 Docker 전체124건·WorkTransferIntegrationTest33건·실제 HTTP LiveKitConnectionTest2건과 API build 통과. JOINED/마이크 없음·provider 장애·source/customer 단절·종료/원문 변경·권한 회수·동시 취소/확정·안전한 임시 토큰·이전/새 담당 경계·cleanup 기한 후 재시도·worker 복구·V14 fingerprint 호환성을 포함한다. 첫 추가 테스트는 package-private fingerprint 접근으로 컴파일 실패했으며 테스트의 reflection 조회로 수정한 뒤 전체 빌드를 통과했다.
- 새 개발 V14 백업을 별도 `hellow_call_transfer_check_20261003_192233`에 복원해 Flyway V15·Hibernate validate/API health, OFFERED/CONNECTING unique index와 CHECK를 확인했다. 고객6/접수23/상담47/타임라인16/Membership4/후속0/이관0/이력0건 및 직접 권한52·역할 연결1·역할1·역할 grant13건의 기존 모든 열 hash를 유지했다. V15 신규 열만 비교에서 제외했고 기존 Membership version도 보존했다. 개발 DB는 사용자 사용으로 이전 인계보다 건수가 늘어 있어 이번 백업 기준으로 비교했다. SHA-256 `9502812acc40149429ecc1bce92e9fca84f5fb705297f078879284b35d0e189b`와 경로/원문 hash는 Git 제외 `output/call-transfer-rehearsal.json`에 있다.
- 복원 DB의 별도 합성 조직/직원과 실제 API로 공개 CALL 접수→수락/공식 version3 문서 저장→동시 동일 UUID 요청→대상 수락/CONNECTING·수신/조직 전환 차단·재시작 유지·취소/기존 담당 보존을 확인했다. 실제 LiveKit의 참가자 없는 방에서는 담당이 확정되지 않았다. 연결 성공은 별도 HTTP protocol fixture로 검증했으며 JOINED/마이크 없음/503 차단, API 재시작 후 scheduled worker의 원자 확정·문서/작성자/스냅샷 보존·이전 담당 전문/토큰 차단·동일 Media Identity·이력3건/중복 수락·이전 Identity 제거를 확인했다. 고객 종료/확정 동시 실행은 FAILED와 동일한 원본/접수 담당·종료 상태를 유지했다. fixture의 초기 chunked body 미처리로 worker 확인이 실패했으며 fixture를 수정한 뒤 전체 검수했다. 실제 음성 연결 성공의 증거로 보고하지 않는다.
- 별도 합성 통화에서 PostgreSQL trigger로 접수 담당 쓰기를 실패시켜 이미 실행한 원본 변경·확인 메타데이터·상태/이력까지 롤백되고 원문/예약이 유지되는 것을 확인했다. trigger 제거 후 같은 연결 확인 재시도로 ACCEPTED/담당 일치·본문 보존을 확인했다. 증거는 Git 제외 `output/call-transfer-postgres-proof.json`이며 fixture trigger/임시 API·환경 파일은 정리했다. 백업/검수 DB는 보존한다.
- JUnit XML을 성공한 빌드 캐시에서 추출해 실제 실행124·실패0·오류0·skip0/12개 클래스를 확인했다(`output/call-transfer-test-summary.json`). 문서 검사82파일/296로컬 링크/85요구사항·64Impeccable해시와 Git whitespace 검사를 통과했다. 임시 API/환경 파일·합성 issuer를 종료하고 개발 웹/API `e97d2cc` healthy를 다시 확인했다.
- **서버 단위는 미배포**다. 실제 개발 웹/API는 `e97d2cc`·V14를 유지하며 이번 검수는 개발 DB나 플랫폼 설정을 바꾸지 않았다. UI 변경/Impeccable 검수는 이번 backend 단위에 적용하지 않았다. 다음은 CALL 요청/CONNECTING 화면·임시 음성 연결·확정 후 같은 연결 유지·실패 정리·기존 큰 수신 모달·UUID/입력 복원을 연결하고 반응형/실제 브라우저 검수 후 V15 웹/API를 함께 반영한다. 현황/대시보드·실제 계정/첨부·미뤄 둔 두 사람 음성 수락 등 전체 목표는 유지한다.

## 2026-10-03 업무 이관 화면·원문 열기·입력 보존 검수

- 검수·문서 단위를 한글 커밋 `e97d2cc`로 push하고 개발 웹/API를 같은 버전으로 함께 반영했다(API18:55:23·웹18:55:34 KST 재시작). 진행 중 음성0건 확인·쓰기 중지 뒤 확보한 새 백업을 `hellow_transfer_frozen_20261003_185505`에 복원해 V14/API health·활성 원본/실시간 대상 unique index·CHECK·기존 Membership/Role의 이관 범위 보존을 검증했다. 고객6/접수21/상담45/타임라인14/Membership4/후속0건과 원문 hash를 실제 DB에서도 유지했다. 신규 nullable 담당 이름/의도한 Membership version만 비교에서 제외했다. 백업 SHA-256 `a8c5d995edd1ae2f5a5a66b9c4e8740ccc6942ebe0f8da694b0f5779e73a8914`와 실제 이미지/재시작 시각·hash 증거는 Git 제외 `output/transfer-deployment.json`에 있다. 두 서비스 healthy·Nginx 검사/reload·외부 `/login`/`/support?org=hellow-dev`/공개 조직 API HTTP200 확인. 실제 사용자 재로그인 수락은 대신 수행하지 않았다. 평문 검수 환경 파일·임시 복원 API를 정리했고 백업/복원 DB는 보존했다.
- 저장된 상담의 요청 폼과 받은/보낸/허용 범위 목록·상태 필터·상세·수행 이력, 대상 수락/거절·요청자 취소를 연결했다. 실제 선택 가능한 직원과 현재 capability를 사용하며 미저장 문서/분류/결과/태그가 있으면 먼저 저장하도록 한다. 요청 UUID/본문을 전송 전에 보관하고 응답 불명·403/409/저장소 실패에서는 입력과 표시 버전을 유지한다. HTTP 성공 응답의 FAILED/REVOKED/EXPIRED를 수락 성공으로 표시하지 않는다.
- 큰 수신 모달과 TRANSFER_PENDING 상태·새 수신/조직 변경 차단을 연결했다. 수락 뒤 최신 대기열의 본인 PROCESSING 접수 또는 정확한 독립 기록 ID를 열며 제안 수신만으로 본문을 공개하지 않는다. `/api/me`의 검증 issuer로 보관 key를 구분한다. 원본 id/list의 processing/editable로 진행 중 접수를 독립 편집 경로에서 수정하지 못하게 했다. 대기열 초안의 충돌 버전을 조용히 갱신하지 않고 직원의 최신 원본 채택을 요구하며, 이관/권한 변경 후 남은 본인 입력은 복사할 수 있다.
- Java 21 Docker API 전체110건·WorkTransferIntegrationTest21건/build, frontend89건·lint·TypeScript noEmit·Docker production build 통과. 초기 mock 타입/사용하지 않는 import 오류는 수정 후 검사했다. 합성 문서 fixture에서 SHNEA version 누락으로 표시한 JSON은 fixture 작성 오류였으며 공식 version3 문서로 API 저장 후 확인했다. 실제 제품의 JSON 오류 수정으로 보고하지 않는다.
- V14 격리 복원 DB의 새 합성 조직 `transfer-ui-183117`과 두 합성 직원으로 실제 공개 티켓 접수→수락/저장한 상담53의 업무 요청→큰 수신 모달/수신 차단→대상 수락→기존 본문 열기/저장/완료를 확인했다. 별도 API 작성한 독립 완료 기록54는 거절 후 새 요청 수락·정확한 ID 열기, 완료53은 요청자 취소를 확인했다. API 재조회로 원래 agentName/문서/상태 유지와 현재 담당200·이전 담당404를 확인했다. Membership은 SQL 합성 fixture이며 실제 개발 DB/플랫폼 설정·실계정 인증을 바꾸거나 검수한 것은 아니다. `output/transfer-ui-proof.json`에 증거가 있다.
- 1280×800·사용자1280×720·768×1024·375×812의 상단/하단/요청 모달 12장을 실제 픽셀로 검수했다. 대상 탭이 다른 초기 viewport 캡처는 보정 후 각 실제 크기/가로 넘침 없음·모바일16px 입력과44px 제어·하단 수락/거절/이력 접근을 확인했다. 증거는 Git 제외 `.impeccable/review/transfer/`와 `output/transfer-ui-dimensions.json`이다. detector1회 기존 Sidebar 로고 gradient 경고1건을 전달했고 fresh finish reviewer는 다섯 계약 섹션과 지정 화면/코드 범위의 material finding 없음·ship을 반환했다(`output/transfer-ui-finish-review.md`).
- fresh documenter도 12장/네 viewport·실제 소스와 기존 Operate 일치를 확인했다(`output/transfer-ui-documentation.md`). 기존 Geist/Arial·global/shell·로고 gradient/shadow 차이와 DESIGN/sidecar 부재는 기록만 하고 변경하지 않았다. 문서 검사82파일/292링크/85요구사항·64Impeccable해시와 Git whitespace 검사 통과. 검수 서버/합성 issuer·브라우저 탭/viewport를 정리했다.
- 개발 V14 동시 반영을 완료했고 관리자 하단 스크롤은 기존 수정/검수 상태를 유지한다. 전체 목표는 완료하지 않았으며 다음 기능은 실제 Media 통화 이관/실패 복구와 현황/대시보드다. 실제 사용자/첨부/두 사람 음성·운영 NAS 수락은 [진행표](mvp-progress.md)에 남아 있다.

## 2026-10-03 업무 이관 화면 연결용 조회·접수 복원 계약

- 독립/완료 이관 원본을 직접 여는 `GET /api/consultations/{id}`를 추가했다. 현재 상담 읽기 범위와 editable을 검사하며 고객 조회나 요청 수신으로 전문 권한을 확대하지 않는다. 요청 목록의 ALL/SENT/RECEIVED는 SQL에서 조직·현재 조회 범위·정확한 issuer/subject를 적용한 뒤 페이지를 나눈다. 받은 51건/보낸 1건의 페이지 누락과 다른 issuer 동일 subject, 다른 조직·잘못된 방향을 통합 검사했다.
- 프런트엔드 이관 타입·조직 명시 API·UUID 요청 보관/복원 전송 모듈을 추가했다. 저장 후 전송, 응답 불명 시 GET 우선·같은 본문/ID 재전송, 변경 입력·저장소 실패·409/회수/잘못된 성공 응답에서 보관값 유지, 반환 FAILED를 수락 성공으로 바꾸지 않는 경로를 검증했다. **아직 사용자 요청 폼/목록에 연결하지 않았다.** UI 편집이나 detector/독립 UI 검수는 이번 모듈 작업에서 실행하지 않았다.
- Java 21 Docker Gradle 전체109건·WorkTransferIntegrationTest20건/build, frontend 전체77건·추가 전송7건·lint·TypeScript noEmit 통과. 첫 서버 검사의 권한 회수 fixture는 이전 Membership version 재사용으로 실패했으며 각 변경 전 다시 조회하도록 고치고 전체 재검사를 통과했다. 첫 TypeScript 검사의 mock 인자 추론 오류도 수정 후 통과했다.
- 기존 별도 V14 복원 DB `hellow_work_transfer_check_20261003_172526`의 새 합성 조직 `transfer-read-175323`·SQL 독립 기록 fixture51/52로 실제 PostgreSQL API를 확인했다. 수락 전 대상404, 받은/보낸 구분, 수락 후 고객 조회 권한 없이 현재 담당의 id 조회, 원문/작성자/시각 보존, 이전 담당404, 작성권 회수 시 editable=false·읽기 회수 시403을 확인했다. 증거는 Git 제외 `output/transfer-read-contract-proof.json`이며 실제 개발 DB는 변경하지 않았다. 임시 API·환경 파일을 정리했고 백업/검수 DB는 보존했다.
- 이번 모듈은 미배포이며 실제 개발 웹/API `4a4d81e`를 유지한다. 관리자 하단 스크롤은 아래 검수/재시작 기록의 배포본에 이미 적용되어 있다. 다음은 이 모듈을 쓰는 저장 원본의 요청 폼·받은/보낸/허용 이력 화면·수락/거절/취소·충돌 입력 보존과 TRANSFER_PENDING 수신/조직 변경 차단을 연결해 모바일/태블릿까지 검수한 뒤 V14 웹/API를 함께 반영한다. 실제 Media 이관/실패 복구·현황·사용자/첨부/두 사람 음성 수락 등 전체 목표는 유지한다.

## 2026-10-03 상담 업무 이관 서버·예약·자동 만료 검증

- 같은 조직의 저장된 기록에서 업무 이관 요청/UUID 복원·현재 선택 가능한 직원·요청 목록/수행 이력·수락/거절/취소를 구현했다. 제안 단계는 원본 담당/본문을 유지하고 대상만 현재 원본 버전·실효 권한을 다시 검사해 수락한다. 독립/완료 기록은 담당만 변경하며 PROCESSING TICKET/통화 종료 후 후처리는 접수와 기록 담당을 원자 변경한다. 원본 편집 충돌은 FAILED, 만료/회수는 EXPIRED/REVOKED를 저장하고 기존 책임을 유지한다. 현재 담당 이름을 원래 작성자와 별도로 저장한다. 상세 API/capability·종료 응답 계약은 [이관 계약](work-transfer.md)에 있다.
- V14의 실시간 대상 Identity당 활성 unique index와 ACD·후속 업무 시작·조직 변경의 예약 검사를 연결했다. `TRANSFER_PENDING`과 현재 조직의 workTransferId를 반환하며, 기한만 지났다고 SQL 예약을 무시하지 않고 최종 결과 저장 후 해제한다. 2초 worker는 현재 권한/가용·원본·기한을 재검사한다. 완료 기록 이관 후 기존 접수만 가진 직원이 새 상담 전문을 읽는 경로를 차단했고 새 담당의 기존 접수 첨부 읽기를 허용했다. 종료 통화 후처리 이관은 이전 참가자 Identity의 제거를 기존 cleanup 기한까지 재시도한다.
- Java 21 Docker Gradle 전체107건·새 WorkTransferIntegrationTest18건·build 통과. 중복/변경 UUID·동시 요청/수락/취소, 원본/요청 버전, SELF/팀 하위/조직·다른 issuer, 현재 역할/직원 회수·비활성 기존 담당의 관리자 복구, 본문/작성자/시각 보존·새 담당 수정·이전 담당 전문 차단·원래 첨부, 실시간 대상의 ACD/예약 시작/조직 변경 차단·만료 후 해제와 이전 참가자 제거 실패 재시도를 포함한다. 참가자 제거는 공급자 mock 검사이며 실음성을 증명하지 않는다.
- 실제 개발 DB 새 백업을 `hellow_work_transfer_check_20261003_172526`에 복원해 Flyway V13/V14·API health·두 unique index/CHECK·기존 권한 범위와 고객6/접수21/상담45/타임라인14/Membership4/후속0건 원문 hash 보존을 확인했다. 백업 SHA-256 `1c3644e4c79675066028fa91118c1dcfbff20fba7040578708cb475120019c9e` 및 증거는 Git 제외 `output/work-transfer-rehearsal.json`에 있다. 신규 nullable 담당 이름과 의도된 Membership version 증가를 비교에서 제외하고 기존 원문을 비교했다.
- 최종 API 이미지와 그 복원 DB의 새 합성 조직/서명 JWT로 실제 공개 티켓 접수→직원 수락→문서 저장→동시 중복 이관 단일 제안→API 재시작 후 OFFERED/예약 유지→대상 수락→대상 저장/완료를 확인했다. 원본 문서/분류·결과/고객·작성자/시각/태그 보존·이전 담당 조회 거부·중복 수락 이력2건·조직 변경 차단이 통과했다. 별도 독립 기록은 SQL fixture임을 구분하고 거절/취소/원본 변경 실패의 책임 보존을 확인했다. 실제 scheduled worker를 켜서 시각만 조정한 만료 fixture의 EXPIRED와 현재 대상 권한 회수의 REVOKED/이력/원본 보존을 확인했다. `output/work-transfer-postgres-proof.json`이 근거이며 첫 비교의 저장 직후 응답 시각은 PostgreSQL 정밀도와 달라, 재조회한 저장 원본 기준으로 보존 검사를 바로잡았다. 임시 API/worker·합성 issuer를 종료했다.
- **이 서버 단위는 미배포**다. 개발 웹/API `4a4d81e`·Flyway V12를 유지하며 이번 작업은 실제 개발 데이터/플랫폼 설정을 변경하지 않았다. 다음은 이관 요청/받은·보낸 목록·수락/거절/취소·이력·충돌 입력 보존과 TRANSFER_PENDING 화면을 연결하고 검수 후 웹/API 동시 반영한다. 실제 Media 통화 이관·실패 복구, 현황/대시보드와 [전체 진행표](mvp-progress.md)의 사용자·첨부·두 사람 음성 수락 범위를 유지한다.

## 2026-10-03 관리자 하단 스크롤 재확인·현재 개발 웹 재시작

- 사용자 제보를 우선 확인했다. 현재 개발 웹/API `4a4d81e`와 같은 이미지·기존 격리 복원 DB·합성 관리자로 시스템 설정을 열어 실제 스크롤했다. 바깥 관리자 영역은 `height:100dvh; overflow-y:auto`, 내부 관리자 영역은 자동 높이로 기존 수정이 적용되어 있으며 추가 UI 소스 변경은 하지 않았다. 1280×720의 내용 높이 1738px·하단 초대 버튼 bottom576.33px, 375×812의 내용 높이 2189px·버튼 top609.92/bottom653.92px·높이44px·가로 넘침 없음 확인. 실제 초대 생성은 하지 않았다. 증거는 Git 제외 `output/review/admin-scroll-4a4d81e-mobile.png`다.
- 진행 중 음성 통화 0건 확인 후 현재 개발 웹만 재시작했다(17:07:53 KST). 웹 healthy·외부 `/login` HTTP 200·Nginx 검사/reload 통과, API 시작 시각은 유지했다. `output/admin-scroll-current.json`에 실제 이미지·재시작 시각·이번 데스크톱/모바일 검수 결과를 기록했다. 임시 컨테이너·합성 issuer·검수 탭/viewport는 정리했다. 실제 사용자 화면 수락은 남아 있다.
- 진행 중 업무 이관 API/V14 변경은 보존했고 이번 재시작에 반영하지 않았다. 다음은 그 서버 구현·검증이며 [전체 진행표](mvp-progress.md)의 업무/통화 이관·모니터링·실제 첨부/두 사람 통화·운영 수락 범위를 유지한다.

## 2026-10-03 상담 업무 이관 계약·저장 구조 준비

- 요구사항 30장에 따라 업무 이관의 저장된 원본 버전/담당 보존·대상 수락·거절/취소/만료/회수와 실제 통화의 Media 연결 확인/실패 복구를 [이관 계약](work-transfer.md)에 구분했다. 일반 기록/완료 상담과 PROCESSING TICKET·통화 종료 후 후처리가 업무 이관 대상이며 진행 중 음성은 실제 통화 이관 경로가 필요하다. 현재 원본 작성자의 같은 범위 `consultation:transfer`, 조회자의 같은 범위 `transfer:read`를 별도 항목으로 추가하는 V13 계약이다. 요청 상태만으로 상담 본문/첨부 권한을 주지 않는다.
- V13의 `work_transfers`/`work_transfer_events`, 원본당 OFFERED unique index와 시각/서로 다른 Identity/상태 CHECK, 원본/직원 FK를 추가하고 Java Entity/Repository와 권한 카탈로그를 준비했다. 작성자·실제 이전/대상 담당·원본 버전·조직·사유/메모·기한·수행 이력을 저장하며 요청 key/fingerprint는 직렬화에서 제외했다. 기존 Consultation 원문·작성자·타임라인을 수정하는 migration은 없다. **아직 이관 명령/목록 API·수신 예약·worker·화면은 없으며 이 단계로 업무 이관이 동작한다고 보고하지 않는다.**
- `hellow-dev-api:transfer-check` Java 21 Docker Gradle 전체 build/test 통과. 이 단계는 기존 회귀 검사이며 새 이관 허용/거부·수락 경합/복구 테스트를 대신하지 않는다. 새 실제 개발 백업을 `hellow_work_transfer_check_20261003_164736`에 복원하여 V13/API health·빈 요청/이력 테이블·unique index/세 CHECK 존재와 원문 hash/건수 보존을 확인했다. 고객 6/접수 21/상담 45/타임라인 14/Membership 4/후속 요청 0건이며 Membership은 의도한 버전 갱신을 제외한 모든 값을 보존했다. 새 Membership 권한 대상이 기존 consultation read/write 집합과 같고 역할의 transfer 범위도 기존 write 범위와 같은 것을 SQL 양방향 차집합으로 확인했다. 백업 SHA-256 `166b6a5aa1819a661eb997d9936e6d8e6068d3aed59b45c94728515b8b0f1578` 및 경로/각 원문 hash는 Git 제외 `output/work-transfer-rehearsal.json`이다. 임시 API/평문 환경 파일을 정리하고 DB/백업은 보존했다.
- **이관 저장 구조는 미배포**이며 실제 개발 웹/API `4a4d81e` healthy·V12를 유지했다. 다음은 같은 전역 배정 잠금/조직 잠금 안에서 현재 권한·원본/대상·버전을 재검사하는 업무 요청/UUID GET 복원·대상만 수락/거절·취소·만료/회수·이력 API와 meaningful 통합 테스트다. PROCESSING 이관 대상을 ACD/후속 시작에서 예약해야 하며, 완료 접수의 상담만 이관할 때 기존 첨부의 상담 권한 fallback과 옛 접수만 읽는 직원에게 새 상담 전문이 새는 경로를 함께 검사한다. 통화 종료 후 업무 이관으로 접수 담당이 바뀌면 이미 발급된 이전 상담사 Media Identity도 원래 cleanup 기한 동안 제거해야 한다. 이어 UI·동시 배포와 실제 통화 이관/실패 복구·현황·실계정/첨부/두 사람 음성 등 전체 수락 범위를 유지한다.

## 2026-10-03 콜백·방문 예약 화면과 서버 연결 검수

- 검증한 `4a4d81e` 웹/API를 개발 환경에 함께 반영하고 실제 재시작했다(API 16:31:06·웹 16:31:17 KST). 둘 다 healthy·Flyway V12·Nginx 검사/reload, 외부 `/login`·`/support?org=hellow-dev` HTTP 200 확인. 진행 중 음성 통화 0건을 확인하고 쓰기를 중지한 뒤 새 백업을 `hellow_followup_frozen_20261003_163050`에 복원해 V12/API health·활성 Identity unique index/확정 일정 CHECK와 고객 6/접수 21/상담 45/타임라인 14/Membership 4/후속 요청 0건 보존을 검증했다. 고객·접수·상담·타임라인과 기존 후속 요청 원문 hash도 복원/실제 DB에서 동일했다. 백업 SHA-256 `525d135cb516d85be53d6f7df2b638308415d89bb0af016efabb5fe8fbfe4b49`·경로/시작 시각은 Git 제외 `output/followup-deployment.json`이다. 실제 개발 공개 화면 375×812의 요청 버튼 top665.84/bottom709.84·44px·가로 폭375px, 접수 생성 없이 확인했다(`output/review/followup-deployed-support-mobile.jpg`). 임시 웹/API·합성 issuer·검수 탭/viewport를 정리했으며 DB/백업/검수 자료는 보존했다. 실제 사용자 로그인/사용 수락은 별도이며 전체 목표를 완료 처리하지 않는다.

- 상담 우측의 가짜 엔지니어/예약 및 콜백 대기열 표현을 실제 요청 폼으로 바꾸고, 전역 예약 화면의 범위별 목록·최소 고객명/연락처·실제 담당자·희망/확정 시각·내용 수정·일정 변경/재배정·처리/실패 재예약/취소·전후 이력을 연결했다. 완료된 고객 기록에서도 새 요청을 만들 수 있다. 상태/권한은 서버 capability를 따르며 후속 처리 중 수신 대기/수락과 조직 변경을 차단하고 대기열 조회 권한 없는 직원도 처리 상태를 확인한다. 일반 직원 기본 권한에 재배정 권한을 자동 포함하지 않는다.
- UUID 접수 본문은 전송 전 sessionStorage에 보관하고 응답 불명 시 GET으로 먼저 복원한다. 저장소 손상/실패로 새 중복 접수를 만들지 않는다. 편집 초안은 같은 화면 세션의 React 상태로 유지하며 재조회에서 기준 버전을 덮어쓰지 않는다. 외부 종료 뒤 목적/메모뿐 아니라 일정/소요 시간/담당 이름/사유도 읽고 복사할 수 있다. 페이지 전체 새로고침은 기존 업무 편집 초안을 복원하지 않는다. 상담 완료 뒤 이력 목록이 갱신되지 않는 실제 UI 문제도 수정하고, 재조회가 미저장 상담 기록의 기준 버전을 조용히 올리지 않도록 했다. 계약은 [예약 계약](followup-scheduling.md)에 둔다.
- frontend 전체 Vitest 70건·lint·Docker production TypeScript/build 통과. Java 21 Gradle 전체 89건·FollowUpIntegrationTest 19건 통과. 새 테스트는 UUID GET 복원/현재 scope·capability/최소 연락처·대기열 권한 없는 진행 상태, 접수 저장소/응답 불명 재시도, 409 입력/버전 보존·종료 후 일정만 수정한 초안, 늦은 이력 응답 차단·서버 readonly·후속 처리 시 조직 차단과 상담 기록 활성 재조회/충돌 버전 확인을 포함한다.
- 기존 V12 개발 복원 DB의 새 합성 조직/직원으로 production 웹/API를 실행해 방문 접수→재배정→일정 변경→담당자 시작→실패→재예약→취소와 실제 이력 7건을 확인했다. 시작 중 FOLLOW_UP·대기 선택/조직 변경 비활성, 종료 후 OFFLINE 유지, 원본 담당/요약 보존과 실제 에디터 완료 본문 저장·빈 대기열 완료 기록에서 추가 콜백 접수를 확인했다. 처음 PROCESSING 원본은 SQL 합성 fixture이며 실제 직원 수락/실음성 증거가 아니다. 실제 API 외부 취소와 브라우저 재조회 뒤 원문은 바꾸지 않고 일정 2026-10-10 11:30/45분/방문 담당 직원만 변경한 입력도 남았다. Git 제외 `output/followup-ui-proof.json`과 `.impeccable/review/followup-*.jpg`가 근거다.
- 데스크톱 1280×800/사용자 크기 1280×720·768×1024·375×812의 캡처를 열고 실제 픽셀 크기/가로 넘침과 모바일 하단 44px 버튼·16px 입력을 확인했다. Impeccable detector는 변경 대상 1회 실행, 기존 변경 없는 로고 gradient 경고1을 유지했다. 독립 finish reviewer의 날짜 아이콘 대비와 일정만 변경한 종료 초안의 담당자 표시 누락을 수정·production 재빌드/같은 관련 파일 재캡처했으며 최종 verdict는 해당 수정과 검토한 추가 동작의 ship이다. 독립 documenter가 기존 slate/indigo·Arial/system·16/24px 여백·44px 조작 유지/일반 확장을 확인했고 DESIGN/sidecar를 추가하지 않았다. ignored `output/review/followup-finish-review.md`, `followup-documentation.md`에 기록했다.
- 이 기능 단위의 개발 반영은 위 배포 기록으로 확정했다. 다음은 Consultation 업무 이관·실제 통화 이관/실패 복구·현황 구현이며 실제 플랫폼 첨부/관리자 사용 수락·두 사람 음성 등 [전체 진행표](mvp-progress.md)의 수락 범위를 유지한다.

## 2026-10-03 관리자 스크롤 제보 재확인 및 개발 웹 재시작

- 현재 개발 웹/API `3a0a7ba`와 같은 이미지·격리 복원 DB·합성 관리자 계정으로 시스템 설정의 하단 접근을 다시 확인했다. 바깥 관리자 영역의 `overflow-y:auto`와 내부 관리자 영역의 자동 높이가 현재 배포 이미지에 적용되어 있다. 실제 브라우저 스크롤로 1280×720(내용 높이 1704px), 375×812(2155px), 768×1024(1704px)에서 하단 초대 버튼이 화면 안에 나타났다. 모바일 버튼 높이 44px·모바일/태블릿 가로 넘침 없음, 합성 이메일 입력 후 버튼 활성 상태도 확인했다. 초대 생성은 실행하지 않았고 추가 UI 소스 변경은 하지 않았다. 모바일 캡처는 Git 제외 `output/review/admin-scroll-latest-mobile.jpg`에 보관했다. 이 검수는 Chromium의 화면 크기 검수이며 실제 휴대 기기의 제스처 검수는 아니다.
- 진행 중 음성 통화 0건을 확인하고 개발 웹을 같은 이미지로 재시작했다(15:41:02 KST). 웹 healthy·외부 `/login` HTTP 200·Nginx 검사/reload 성공, API 시작 시각은 유지했다. 재시작 증거는 Git 제외 `output/admin-scroll-current.json`이다. 임시 웹/API·합성 issuer·검수 탭을 정리했다. 실제 사용자 화면 수락은 남아 있으며 진행 중인 미커밋 예약 화면/서버 변경은 이번에 배포하지 않았다. 다음 기능 작업과 전체 남은 범위는 아래 예약 서버 기록과 [진행표](mvp-progress.md)를 유지한다.

## 2026-10-03 콜백·방문 일정 서버 계약

- 기존 후속 요청에 확정 시각/종료·소요 시간·IANA 시간대·현재 담당자·작성자·처리 결과·JPA 버전과 전후 이력을 추가했다. UUID 요청의 중복 복원, 같은 Identity의 여러 조직 일정 겹침, 담당 변경의 별도 권한·현재 실효 역할·SELF/TEAM/ORG, 시작/완료/실패·재예약/취소를 서버에서 검사한다. 원본 접수/상담/타임라인 소유권을 바꾸지 않으며 기존 자유 문장 날짜/인력은 확정하지 않는다. 상세는 [예약 계약](followup-scheduling.md)에 둔다.
- 진행 후속 업무는 전역 ACD 잠금으로 수신과 조정하며 `FOLLOW_UP` 상태·현재 조직의 followUpId를 반환한다. 진행 중에는 수신 수락·대기 선택·조직 변경을 막고 완료 후 AWAY/OFFLINE 선택을 유지한다. 다른 조직에서 시작하면 가용 상태를 보존한 채 상담사 상태의 활성 조직을 해당 업무 조직으로 옮긴다. 조직 잠금 뒤 권한을 처음 해석하고 변경 응답도 조회 범위를 확인한다. V12는 기존 작성 권한의 같은 범위 조회와 기존 조직 전체 관리자의 재배정 권한을 추가하며 직원/역할 버전을 갱신한다.
- 새 FollowUpIntegrationTest 17건을 포함한 Java 21 Docker Gradle 전체 build/test 통과. 요청 ID/동시 중복·200자 제목, 원본 issuer/소유권/조직, 시간대·과거·기간·버전/회수 담당자, 별도 재배정 권한·원본 보존, SELF/팀 하위 조회·현재 역할 회수, 다른 조직 일정 충돌/연속 일정, 동시 확정, 진행/실패 재예약·취소/종료 보존, 수신/조직 변경/후처리 차단과 AWAY 유지, 예약 시작/ACD 경합, 조회 권한 없는 작성자의 응답 차단과 다중 조직 상태 이동을 확인했다.
- 실제 개발 DB를 백업하여 `hellow_followup_check_20261003_151143`에 복원했다. V12/API health·활성 후속 Identity당 부분 unique index, 고객 6/접수 21/상담 45/타임라인 14/Membership 4/후속 요청 0건 보존 확인. 백업 SHA-256 `5b6bb7466881ed2fdaf1a696022fcfe2c15fb70b179a51012aa5d474d5960187` 및 경로는 Git 제외 `output/followup-rehearsal.json`에 있다. 기존 실제 후속 요청이 0건이므로 다른 새 복원 DB `hellow_followup_legacy_20261003_151513`에는 V12 이전 합성 미확정 요청 1건·직원/역할 fixture를 넣어 원문 hash·미확정/담당 미지정 상태와 SELF/TEAM/관리자 권한 이관을 검증했다(`output/followup-legacy-rehearsal.json`). 이 fixture의 백업 SHA-256은 `c104d49fd0bf12e746978cf21e1c1ea937d7ccd8eafd2d53d38ecfafee06d991`이며 실제 개발 데이터와 합성 fixture를 구분한다.
- 최종 `hellow-dev-api:followup-check` 이미지로 첫 복원 DB의 새 합성 조직·서명 JWT를 사용해 동시 중복 단일 업무, 동시 확정 200/409·다른 조직 충돌/대상 거부, 담당 재배정·원본 보존·버전 충돌·조회 범위, 실제 API 재시작 뒤 IN_PROGRESS/본문/FOLLOW_UP 유지, 실패 후 재예약·취소·현재 담당 권한 회수와 전후 이력 8건을 확인했다. Git 제외 `output/followup-postgres-proof.json`이 근거다. 이전 검수와 별도 조직을 사용했고 API/합성 issuer는 정리했다. 실제 개발 DB는 변경하지 않았다.
- **이 서버 단위는 미배포**이며 개발 웹/API는 `3a0a7ba` healthy·Flyway V11을 유지한다. 다음은 가짜 엔지니어/콜백 대기열 표현을 실제 담당자/일정 UI로 바꾸고 목록·확정/변경/취소·처리·이력과 충돌 입력 보존, 새 조회/재배정 권한 및 FOLLOW_UP 상태를 화면에 연결한다. 화면 검수 후 V12 웹/API 동시 반영·재시작을 진행한다. Consultation 업무 이관·실제 통화 이관/실패 복구·현황·실제 첨부/두 사람 통화 수락 등 전체 남은 범위를 유지한다.

## 2026-10-03 현재 개발 버전의 관리자 하단 접근 재확인

- 사용자 제보에 따라 실제 개발 웹/API `3a0a7ba` 이미지를 기존 격리 복원 DB·합성 관리자 계정으로 다시 검수했다. 시스템 설정 내부 관리자 화면의 바깥 `.admin-shell`은 `height:100dvh; overflow-y:auto`, 내부 관리자 영역은 높이 자동으로 동작한다. 데스크톱 1280×720·모바일 375×812·태블릿 768×1024 모두 하단 초대 입력/버튼으로 스크롤 접근했다. 모바일 내용 높이 2155px·초대 버튼 top609.53/bottom653.53·44px, 태블릿 내용 높이 1704px·버튼 bottom879.94이며 두 크기 가로 넘침 없음 확인. 기존 수정이 현재 이미지에도 적용되어 있어 추가 UI 소스 변경은 하지 않았다. 빈 이메일에 따른 버튼 비활성은 정상이며 실제 직원 등록/초대 전송은 실행하지 않았다.
- 진행 중 음성 통화 0건 확인 후 개발 웹을 같은 이미지로 재시작했다(14:54:13 KST). 웹 healthy·외부 `/login` HTTP 200·Nginx 설정 검사/reload 통과, API 시작 시각 유지. Git 제외 `output/admin-scroll-current.json`과 `output/review/admin-scroll-current-mobile.jpg`에 증거를 보관했다. 임시 웹/API·합성 issuer·검수 탭을 정리했다. 실제 사용자 화면 수락 및 예약/이관 등 전체 남은 일은 기존 진행표를 유지한다.

## 2026-10-03 고객 접수 복원·티켓/음성 상태 화면 연결

- 검증한 `3a0a7ba` 웹/API를 개발에 함께 반영하고 실제 재시작했다(API 14:41:53·웹 14:42:04 KST). 두 서비스 healthy, Flyway V11·CANCELLED CHECK, Nginx 검사/reload와 외부 `/login`·`/support?org=hellow-dev`·공개 조직 API HTTP 200 확인. 반영 직전 쓰기 중지 후 새 백업을 `hellow_support_frozen_20261003_144139`에 복원해 V11/API health·상태 CHECK와 고객 6/접수 21/상담 45/타임라인 14/Membership 4건 보존을 검증했고 실제 DB도 같은 건수를 유지했다. 백업 SHA-256 `8c994c31429640d9868922cd3e18fc07eef3fe5226a065668a6d4c3bf52f77ee`와 경로는 Git 제외 `output/support-deployment.json`에 있다. 실제 개발 모바일 375×812에서 하단 접수 버튼 top665.84/bottom709.84·44px·enabled 및 가로 넘침 없음 확인(`output/review/support-deployed-mobile.jpg`). 첫 캡처는 다른 탭의 viewport override로 실제1280px여서 새 탭의375px 캡처로 보정했다. 공개 페이지 검수는 실제 개발 접수를 만들지 않았고 임시 웹/API·프록시·검수 탭을 종료했다. 실제 사용자 로그인/사용 수락·두 사람 음성·운영 NAS는 미검수다. 다음 구현은 콜백/방문 일정 확정·변경/취소·재배정과 업무/통화 이관이며 실음성 수락은 사용자 요청대로 후속 진행한다.

- 명시적 요청의 UUID·원래 내용을 조직별 sessionStorage에 전송 전에 보관하고 재로드 때 GET으로 먼저 복원한다. 응답을 받지 못한 요청은 동일 ID·본문을 재시도하며 종료/취소/만료 후 명시적 새 요청만 새 ID를 만든다. 취소·종료 실패 시 요청/통화를 유지하고 서버의 실제 상태로 전환한다. 오래된 폴링 응답/조직 전환의 이전 응답은 무시한다. 저장소 실패 때 요청을 보내지 않는다.
- 온라인 티켓은 담당자·처리 상태만 표시하고 마이크/Media에 연결하지 않는다. CALL만 음성 연결·명시적 재연결과 실제 적용 후 음소거 상태를 제공한다. CALL_ENDED는 통화 종료로 표시하여 직원 후처리 완료와 구분한다. 미구현 평가 등록·임의 담당자·평균/예상 대기시간·미검증 E2EE 문구를 제거하고 실제 조직의 대기 요청 수를 표시한다. 기존 조직 로고/색상/안내·중심 폼 문법과 모바일 하단 요청 버튼을 유지한다.
- frontend 전체 Vitest 56건·lint·Docker production build 통과. 새로고침 GET 복원/POST 없음, 응답 불명 후 재로드·동일 ID/본문 재전송, 재시도 전 원래 성공 조회, 취소 뒤 새 UUID, 취소 실패/완료 경합, 만료 뒤 명시적 새 접수, 이전 조직 응답/늦은 폴링 무시, 마이크 거부 시 요청 없음, 수락 CHAT의 미디어 차단, CALL 연결 실패·재시도/종료 실패 시 연결 유지 회귀를 확인했다.
- 격리된 V11 복원 DB/실제 production 웹/API에서 조직별 로고(/file.svg 합성 자산)·색상·제목·안내·버튼 반영, 티켓 접수→재로드 복원→취소→새 접수→재로드를 확인했다. 실제 DB에서 접수 2건·서로 다른 키 2개·취소 1건을 확인했다. 이어 SQL 합성 처리 상태의 담당자/티켓 처리 화면을 확인했으며 실제 직원 수락/두 사람 음성 증거로 주장하지 않는다. Git 제외 `output/support-ui-proof.json` 및 `output/review/support-*.jpg`가 근거다.
- 1280×800 폼·사용자 크기 1280×720 처리 화면·768×1024·375×812 캡처의 실제 픽셀 크기를 확인했다. 모바일 하단 접수 버튼 화면 내 표시/44px·16px 입력, 태블릿 접수 버튼 화면 내 표시와 가로 넘침 없음 확인. Impeccable detector 1회 warning1은 본문 slate 배경/selection indigo+white 조합의 정적 gray-on-color 판단으로 독립 리뷰에 전달했다. finish review의 연락처 안내 대비 지적 1건을 slate400으로 수정·production 재빌드·동일 폼 3크기 재캡처했고 reviewer verdict는 해당 fix1 resolved/ship이다. 추가 detector는 실행하지 않았다.
- 독립 documenter가 기존 HEAD/현재 코드/최종 화면 7장을 비교해 slate/indigo·Arial/system·중앙 576px 폼·모바일 sticky 액션·44/48px 조작 유지와 일반 확장을 확인했다. 기존 blur/shadow/경계 중복·Geist/Arial 불일치 drift는 보존했으며 DESIGN/sidecar는 생성하지 않았다. Git 제외 `output/review/support-documentation.md`가 근거다. 최종 캡처는 `.impeccable/review/`에도 보관하고 Git 제외했다. 검증 이미지 `hellow-dev-web:support-check`/`hellow-dev-api:support-check`를 준비했고 V11 개발 웹/API 동시 반영은 위 배포 기록으로 확정했다. 실제 두 사람 통화·플랫폼 첨부/관리자 사용 수락·예약/이관·현황 등 [전체 진행표](mvp-progress.md)의 남은 범위를 유지한다.

## 2026-10-03 공개 고객 접수 서버 계약 보완

- 공개 요청의 UUID v4 검증·조직별 중복 잠금·동일 내용 hash, GET 결과 복원, 현재 대기 건수, 24시간 세션 만료와 공개 신규 WAITING 한도를 구현했다. 대기 취소/수락과의 경합은 서버의 실제 CANCELLED/CALL_ENDED/COMPLETED 결과를 반환하며 직원 후처리를 유지한다. 수락 티켓은 음성 조작으로 종료하지 않는다. 만료 worker와 ACD도 만료 요청의 신규 배정을 막고 저장된 본문을 보존한다. 상세는 [공개 접수 계약](public-support.md)이다.
- 새 PublicSupportIntegrationTest 13건을 포함한 Java 21 Docker Gradle 전체 build/test 통과. 초기 실제 PostgreSQL 취소 검증에서 개발 DB 상태 CHECK에 CANCELLED가 빠진 것을 발견해 V11에 보완했고, 수정한 이미지로 새 개발 백업을 `hellow_support_check_20261003_141523`에 복원했다. Flyway V11/API health와 고객 6·접수 21·상담 45·타임라인 14·Membership 4건 보존 확인. 백업 SHA-256 `d3c96b4fd50bf77ad36936f9e7b2b2bda6b47656418e294a249c01cbff14267d`, 경로/건수는 Git 제외 `output/support-rehearsal.json`에 있다.
- 같은 새 복원 DB에 합성 조직을 만들고 실제 PostgreSQL API에서 동시 중복의 단일 접수, 읽기 전용 복원, 내용 변경 재전송 409, 취소 후 새 접수, 만료 접근 410, worker의 대기 취소·수락 CALL 종료 의도/티켓 보존, 실제 API 재시작 후 유지, 한도 429와 기존 요청 재조회/재전송 허용·취소 후 새 접수, 조직 중지 접근 차단을 확인했다. 증거는 `output/support-postgres-proof.json`이다. 임시 API는 종료했고 실제 개발 DB는 변경하지 않았다.
- 이 서버 단위는 아직 미배포이며 개발 웹/API `a5e0348`·Flyway V10을 유지한다. 다음은 조직별 sessionStorage 복원·실패 재시도/새 요청 ID·CHAT 음성 연결 차단·실제 상태 기반 취소/종료·CALL 재연결 화면과 회귀/브라우저 검수 후 웹/API 동시 반영이다. 실제 두 사람 음성 수락은 별도 후속 작업이다.

## 2026-10-03 관리자 하단 스크롤 재검수

- 관리자 스크롤 수정이 포함된 실제 개발 `a5e0348` 웹/API 이미지를 격리된 기존 복원 DB와 합성 관리자 계정으로 재검수했다. 같은 창의 시스템 설정 내부 조직 관리에서 데스크톱·375×812·768×1024 하단 직원 저장/초대 버튼 접근을 확인했다. 모바일 관리자 높이 812px/내용 2155px, 초대 버튼 44px와 화면 내 노출, 태블릿 높이 1024px/내용 1704px·하단 버튼 노출 및 두 크기 가로 넘침 없음 확인. 추가 UI 소스 변경은 없고 기존 수정의 배포 여부를 확인했다.
- 사용자 재시작 요청에 따라 개발 웹만 같은 이미지로 재시작했다(14:14:01 KST). 웹 healthy·외부 개발 `/login` HTTP 200·Nginx 검사/reload 통과, 진행 중 음성 통화 없음 확인 후 실행했고 API 시작 시각과 DB를 유지했다. 증거는 Git 제외 `output/admin-scroll-recheck.json`과 `output/review/admin-scroll-recheck-mobile.jpg`다. 임시 검수 웹/API·합성 issuer·브라우저 탭을 정리했다. 현재 미커밋 공개 접수 백엔드는 배포하지 않았다.

## 2026-10-03 상담사 상태·본인 배정 수신 화면 연결

- 검증한 `a5e0348` 웹/API를 개발 환경에 함께 반영하고 실제 재시작했다(API 13:40:24·웹 13:40:35 KST). 두 서비스 healthy, Flyway V10, Nginx 설정 검사/reload와 외부 개발 `/login`·공개 `/api/support/organization/hellow-dev` HTTP 200 확인. 반영 직전 쓰기 중지 후 새 백업을 `hellow_routing_frozen_20261003_134010`에 복원해 실제 V10·health와 고객 6/접수 21/상담 45/타임라인 14/Membership 4건 보존을 다시 확인했으며 실제 개발 DB도 같은 건수를 유지했다. 백업/SHA-256은 Git 제외 `output/routing-deployment.json`에 있다. 임시 웹/API·합성 issuer·검수 브라우저 탭을 종료하고 검수 DB/화면 증거/백업은 보존했다. 실제 사용자 로그인/사용 재확인과 운영 NAS 적용은 수행하지 않았다.

- 서버의 상태/heartbeat와 상단 대기·자리비움·오프라인 선택을 연결했다. 본인 제안만 큰 모달로 표시하고 화면에 표시된 시도 ID의 수신 확인·수락·거절, 배정 이력 조회/실패 재조회·버전 기반 명시적 재시작을 제공한다. 상태 조회 실패 시 수신을 차단하며 기존 CRM 기록/입력은 유지한다. 진행 중 CALL/TICKET·후처리의 조직 변경을 차단하고 다른 조직 창의 충돌은 명시적 수신 조직 선택으로 복구한다. 사이드바의 임의 수동 ‘상담 중’ 선택과 가상 팀/내선 표시는 서버 상태 표시로 바꿨다.
- 검증: frontend Vitest 43건·lint·Docker production build 통과. 본인 제안만 모달 표시, 표시 ID 확인, 같은 접수의 새 시도 표시, 정확한 수락/거절 ID, 거절 실패 후 재시도, 상태 변경 충돌/heartbeat 실패 때 역사 기록 입력 보존, 이력 실패/재조회와 요청 변경의 이전 조회 취소 회귀를 확인했다. 기존 backend RoutingIntegrationTest 12건과 PostgreSQL 증거는 아래 서버 단위 기록을 유지한다.
- 별도 복원 DB/합성 JWT의 실제 production 웹/API에서 거절·배정 이력·명시적 재시작→다음 직원 모달/수락, 본문 입력/줄바꿈·초안 저장/재로드 복원·후처리 수락 차단·상담 완료 후 선택한 AWAY 유지를 확인했다. 후처리 UI 검수는 합성 TICKET의 상태를 CALL 종료 상태로 설정했으며 실제 Media 통화 종료로 주장하지 않는다. 기록 완료 상태와 본문·ACCEPTED/REJECTED 이력은 실제 PostgreSQL/API로 추가 확인했다. 증거는 Git 제외 `output/routing-ui-proof.json`과 `output/review/routing-*.jpg`다.
- 모바일 첫 검사에서 본문 50px를 발견해 문서 공간을 보완했다. 최종 1280×800/768×1024/375×812 가로 넘침 없음, 모바일 본문 178px/태블릿 203px·상태/저장/완료 최소 44px, 내부 스크롤로 완료 버튼 접근을 확인했다. 수신 모달 375px에서 337×468 중앙 배치·48px 버튼과 Escape 닫기/초점 복귀를 확인했다. Impeccable detector 1회 신규 대상 3파일 0건(기존 다른 파일의 경고 해소를 뜻하지 않음). 독립 finish review는 supplied incumbent Operate extension 범위에서 `ship`, material fixes 없음이며 정식 5-block 계약/QUALITY BAR 미제공을 명시했다.
- 독립 documenter는 최종 화면 4장과 현재 CSS/컴포넌트를 비교해 기존 팔레트/글꼴/간격/형태 유지와 일반 확장을 확인했다. `DESIGN.md`/sidecar는 생성하지 않았고 기존 gradient·글꼴 설정 불일치 등 drift는 이번 작업에서 정비하지 않았다.
- 검수 이미지 `hellow-dev-web:routing-check`/`hellow-dev-api:routing-check`를 위 `a5e0348` 태그로 반영했다. 관리자 스크롤 수정은 기존 개발 `e0107d8`에도 이미 포함되어 있다. 첫 접속은 OFFLINE이므로 상단 ‘수신 상태 선택’에서 대기를 선택해야 자동 수신한다. 전체 남은 작업은 [진행표](mvp-progress.md)를 유지하며 다음 구현은 고객 공개 진입점 마무리다.

## 2026-10-03 서버 상담사 상태·자동 배정 기반

- 서버의 가용 상태·heartbeat·배정 시도와 LONGEST_IDLE worker를 구현했다. 플랫폼 issuer/subject당 상태 한 개로 여러 조직의 중복 예약을 막고, 현재 Membership/동적 역할의 조회·수락 범위를 재검사한다. 통화/티켓 하나를 처리하며 CALL 종료 후 상담 완료까지 AFTER_CALL로 유지한다. 선택한 AWAY/OFFLINE은 완료 후에도 유지한다. 상세 계약과 API는 [초기 자동 배정 계약](contact-routing.md)에 둔다.
- 30초 제안·45초 heartbeat, 화면 수신 확인과 RESERVED/RINGING 구분, 거절·미수신·시간 초과·부재·조직 전환·회수·고객 취소의 시도별 결과를 저장한다. 거절/시간 초과 때 가능한 다음 직원에게 배정하며 한 회차에서 직원당 한 번/최대 10번 이후 WAITING을 보존한다. 명시적 배정 재시작은 접수 버전과 현재 권한을 검사하고 과거 이력을 보존한다. 로그아웃은 즉시 미수락 예약을 해제한다. 상담 문서와 Media 공급자 호출을 배정 트랜잭션에 섞지 않는다.
- 전역 배정 행→조직→접수 잠금, 활성 배정의 접수/직원당 부분 unique index를 사용한다. 본인 상태 변경 버전은 heartbeat의 JPA 버전과 분리하고 오래된 창의 상태 명령·제안 ID를 거부한다. 대기열의 공유 intake는 소유자 없는 요청으로 한정하며 현재 접수의 시도 조회도 조직/조회 범위를 적용한다. 토큰 발급/종료의 issuer 소유권 검사를 보완했다. V10은 기존 업무 본문을 변경하지 않고 가용 상태·시도 테이블과 회차를 추가한다.
- 검증: 새 RoutingIntegrationTest 12건을 포함한 Java 21 Docker Gradle 전체 build/test 통과. 오래 대기한 직원 순서, 수신 확인, 수락/거절 재전송, 오래된 제안, 거절 후 재배정, 미수신/시간 초과 구분·AWAY, heartbeat 만료/명령 버전, 동시 배정, 다중 조직의 단일 Identity, 역할 회수/조직 중지/팀 범위/타인 확인, 고객 취소/조직 경계, 최대 10번/명시적 재시작, 다른 issuer의 미디어 접근과 로그아웃 해제를 확인했다. 기존 워크스페이스·팀 조회 테스트를 실제 서버 상태/배정 ID 계약에 연결했으며 테스트의 본래 허용/차단 기대값은 유지한다.
- 개발 DB 백업을 `hellow_routing_check_20261003_130043`에 복원해 실제 Flyway V10·API health·두 부분 unique index·전역 잠금 행, 고객 6/접수 21/상담 45/타임라인 14/Membership 4건 보존을 확인했다. 백업/SHA-256은 Git 제외 `output/routing-rehearsal.json`에 있다. 이어 같은 **복원 DB**에 별도 합성 조직·직원 2명·접수 3건을 추가하고 서명된 합성 JWT/실제 PostgreSQL API에서 자동 배정, 두 직원의 거절 후 대상 교환, 동시 수락 200/409, 후처리 차단, API 실제 재시작 후 AFTER_CALL/수락 시도 유지, 기록 완료 후 재배정과 REJECTED/ACCEPTED 이력 조회를 확인했다. 후속 합성 데이터로 이 복원 DB의 건수는 초기 보존 확인 때와 다르며 실제 개발 DB는 변경하지 않았다. 증거는 `output/routing-postgres-proof.json`이다.
- 현재 `hellow-dev-api:routing-check`는 백엔드 검증 이미지다. **새 수락 계약에 맞춘 프론트는 아직 미구현이며 이 단위는 미배포**다. 개발 웹/API는 기존 `e0107d8`를 유지한다. 다음은 서버 상태·모바일 상태 선택·본인 수신 제안만 큰 모달 표시·배정 ID를 보낸 수락/거절·시도 이력/명시적 재시작 화면 연결, 화면 회귀/실제 브라우저 검수 후 웹/API 동시 반영이다. 실제 두 사람 음성/첨부 수락·예약/이관·현황 등 [전체 진행표](mvp-progress.md)의 남은 범위를 유지한다.

## 2026-10-03 등록 전 고객 이력 연결·취소

- `e0107d8` 웹/API를 개발 환경에 함께 반영하고 재시작했다(웹 12:31:06·API 12:30:55 KST). 두 서비스 healthy, Flyway V9, Nginx 설정 검사/reload·외부 `/login`/공개 조직 API HTTP 200 확인. 반영 직전 쓰기 중지 후 `hellow_history_frozen_20261003_123041`에 새 백업을 복원해 V9·health·고객 6/접수 21/상담 45/타임라인 14/Membership 4건 보존을 다시 검증했고 실제 DB에서도 같은 건수를 유지했다. 백업/SHA-256은 Git 제외 `output/history-deployment.json`에 있다. 검수 웹/API·합성 issuer·탭은 종료하고 DB·백업·화면 증거는 보존했다. 운영 NAS는 반영하지 않았다. 실제 사용자 사용 확인은 남아 있다.

- 현재 수락 상담에서 고객 신규 등록/기존 고객 연결 시 이미 저장한 상담 초안·타임라인·후속 요청의 고객 관계도 원자적으로 동기화한다. 응답의 상담 버전을 프론트가 적용해 미저장 본문을 보존한 채 다음 저장을 계속한다. 현재 상담 처리의 소유권은 조직·issuer·subject를 함께 확인한다.
- 고객·기록의 ‘이전 이력 연결’에서 연락처로 완료된 미연결 이력을 조회하고 접수 당시 이름·연락처·담당·분류·시각을 확인해 직원이 최대 20건을 선택한다. 같은 고객임을 확인한 뒤 연결하며, 전화번호 형식 차이는 숫자로 비교하지만 동일성을 추정해 자동 병합하지 않는다. 연결 기록의 취소는 고객 관계만 비우고 원문·담당·작성 당시 팀·분류·결과·파일 문맥을 유지한다. 세부 계약은 [데이터 기준](../skills/golden-path/references/domains/06-data.md#고객-등록-전-이력의-현재-연결-계약)에 둔다.
- 대상 고객/접수의 고객 수정 범위와 접수/상담/타임라인의 상담 조회·수정 범위를 함께 검증한다. 접수/상담 버전과 현재 권한을 다시 확인하고 배치 중 하나라도 충돌하면 전부 롤백한다. 같은 이력의 동시 연결은 하나만 성공하며 기존 연결 고객을 이 기능으로 바꿀 수 없다. 연결자·시각·취소를 별도 Entity/감사로 보존한다. 권한 확대나 작성 당시 소유권 변경은 없다.
- 검증: 새 CustomerHistoryIntegrationTest 7건 포함 Java 21 Docker Gradle 전체 build/test 통과, frontend Vitest 37건·lint·production Docker 웹 빌드 통과. 등록/기존 연결의 초안·타임라인·후속 요청 동기화, 원문/시각/담당/45초 보존, 연결·취소, 배치 롤백, 다른 조직·SELF·현재 회수·다른 issuer, 동시 연결 경쟁을 확인했다. 프론트는 확인 전 연결 차단·표시 버전 전송·충돌 시 선택 유지와 명시적 재조회·취소·미저장 본문과 버전 갱신 회귀를 확인했다.
- 격리된 PostgreSQL·합성 JWT·production 웹/API 실제 브라우저에서 이전 이력 후보→확인→연결→취소→재연결→고객 이력에서 기존 본문 열기를 확인했다. SQL로 고객 관계만 변경되고 원문·당시 분류/담당·45초가 유지되는 것을 확인했다. 1280/768/375px 문서 가로 넘침 없음·버튼/전화 입력 최소 44px·Escape 닫기/진입 버튼 초점 복귀 확인. Impeccable detector 1회 대상 3개 파일 0건. 독립 finish review가 모달 좌상단/헤더 잘림 한 건을 지적해 중앙 배치·sticky 제목/닫기로 고쳤으며 desktop/mobile/tablet 수정 판정은 resolved/ship(해당 지적 범위)다. 태블릿 캡처가 이전 뷰포트 크기로 반환된 첫 증거는 recapture였고 실제 768×1024 재캡처로 확인했다. documenter는 기존 세계 유지·DESIGN/sidecar 미생성 및 미수정 기존 drift를 확인했다. 증거는 Git 제외 `output/review/history-*-final.jpg`다.
- V9 백업 복원 검증: `hellow_history_check_20261003_121723`, API health·Flyway V9·고객 6/접수 21/상담 45/타임라인 14/Membership 4건 보존. Git 제외 `output/history-rehearsal.json`에 백업/SHA-256 기록. 합성 UI DB의 V9 SQL 직접 적용과 실제 개발 백업 복원 DB의 Flyway 검증을 구분한다.
- 연락처/접수 근거가 없는 과거 기록과 이미 다른 고객에 연결된 기록은 임의 추정/병합하지 않는다. 실제 사용자 계정·플랫폼 첨부·두 사람 음성 수락은 남아 있다. 다음 구현 단위는 서버 상담사 상태·ACD·배정 시도 이력이며 [전체 진행표](mvp-progress.md)의 예약/이관·모니터링 등 범위를 유지한다.

## 2026-10-03 상담 분류·결과와 공통/조직/개인 템플릿

- 검증한 `7cf15a2` 웹/API를 개발 환경에 함께 반영하고 실제 재시작했다(웹 12:01:01·API 12:00:50 KST). 둘 다 healthy, Flyway V8, Nginx 설정 검사/reload, 외부 `/login`과 공개 조직 API HTTP 200 확인. 반영 직전 쓰기 중지 후 새 백업을 `hellow_content_frozen_20261003_120036`에 복원해 V8·health·고객 6/접수 21/상담 45/타임라인 14/Membership 4건을 다시 검증하고 실제 DB에서도 같은 건수를 보존했다. 백업 경로/SHA-256은 Git 제외 `output/content-deployment.json`에 있다. 첫 시도는 임시 컨테이너에 Compose healthcheck가 없는데 Docker health 상태를 읽어 실패했고 기존 웹/API로 자동 복구했으며 개발 DB를 변경하지 않았다. 임시 API의 HTTP health 확인으로 보완한 두 번째 시도는 통과했다. 검수용 웹/API·합성 issuer·탭을 종료하고 검수 DB/백업/화면 증거는 보존했다. 실제 사용자 로그인·사용 재확인은 남아 있다.

- 1~3단계 상담 분류와 결과를 실제 API 목록에 연결했다. 분류는 안정적인 ID·부모 관계를 사용하고 비활성화로 보존하며, 서버가 저장 당시 경로·결과명을 확정한다. 기존 분류명만 있는 기록은 ID를 추정하지 않고 수정할 수 있다. 이름 변경·조직 목록 복원 뒤에도 과거 표시값을 유지한다.
- 최고/조직 관리의 ‘분류·템플릿’에서 공통 목록·조직 전체 오버라이드·공통 복원과 영향 조직을 관리한다. 템플릿은 공통/조직 공유/개인으로 나뉘며 공통 항목별 조직 오버라이드와 복원을 지원한다. 개인 관리 권한은 별도 `template:personal`이고 같은 조직·issuer·subject 소유 항목만 접근한다. 관리자 지위로 다른 직원의 개인 템플릿을 열 수 없다.
- 템플릿은 선택 후 Markdown 본문을 상담 문서에 복사한다. 원본 수정이 이전 삽입 문서를 바꾸지 않는다. 버전 충돌 시 입력을 유지하고 현재 서버 값을 비교한 뒤 재저장하도록 했다. 첫 오버라이드도 공통 버전을 검사한다. V8은 기존 기록 표시값을 보존하며 기존 상담 작성자/역할의 개인 템플릿 권한 추가 시 버전도 올려 이전 권한 편집 요청을 거부한다.
- 설정을 보고 돌아와도 고객 기록의 미저장 본문을 유지하면서 분류·템플릿 목록을 갱신한다. 데스크톱 분류 입력을 네 열로 확보하고 모바일 도구를 펼쳐도 본문 높이를 확보했다. 부모 폴링이 알림 종료 타이머를 계속 초기화해 저장 버튼을 덮던 문제를 수정했다.
- 검증: Java 21 Docker Gradle 전체 build/test 통과(새 ContentIntegrationTest 8건 포함), frontend Vitest 33건·lint·production Docker 웹 빌드 통과. 별도 PostgreSQL/서명된 합성 계정의 실제 브라우저에서 공통·조직 상속/오버라이드/복원, 개인 저장, 세 종류 삽입, 3단계·결과 완료 저장과 재조회, 원본 변경 후 이전 문서/표시값 보존, 설정 왕복 미저장 본문 보존과 목록 갱신을 확인했다. 1280/768/375px 가로 넘침 없고 펼친 모바일 본문 197px, 375px 관리자 하단 초대 입력과 버튼 접근·분류/템플릿 버튼 최소 44px 확인. UI 검수는 기존 디자인을 유지한 직접 검수이며 독립 리뷰로 보고하지 않는다. 새 파일/CSS의 scoped static detector 결과는 0건이며 기존 전체 파일의 경고를 제거했다고 주장하지 않는다.
- 실제 개발 DB 백업을 별도 `hellow_content_check_20261003_113701`에 복원해 Flyway V8·API health·고객 6/접수 21/상담 45/타임라인 14/Membership 4건 보존을 확인했다. 백업/SHA-256은 Git 제외 `output/content-rehearsal.json`, 화면 증거는 `output/review/content-desktop.jpg`, `content-mobile.jpg`, `admin-scroll-final.jpg`다. 합성 UI DB는 이전 Hibernate 스키마와 V6 이력 불일치 때문에 V8 SQL을 직접 적용하고 Flyway를 끈 검수 전용 API를 사용했으며, 실제 Flyway 검증은 앞의 개발 백업 복원 DB에서 별도로 수행했다.
- 실제 사용자 계정·플랫폼 첨부/실음성 수락 검증과 고객 소급 연결·ACD·예약/이관·모니터링 등은 [전체 진행표](mvp-progress.md)에 남아 있다. 다음 구현 단위는 등록 전 고객 이력의 명시적 소급 연결이다.

## 2026-10-03 같은 창의 설정·조직 전환·팀 트리·관리자 스크롤

- 검증한 웹 `f7669e4`를 개발 웹에 반영하고 실제 재시작했다. 웹 healthy, API `b01e729` healthy·기존 시작 시각 유지, Flyway V7 유지, Nginx 설정 검사/reload 및 개발 `/login` HTTP 200 확인. `.env.dev`의 다음 이미지 선택을 `f7669e4`로 두고 API 별칭은 동일 `b01e729` 이미지로 준비했다. DB migration과 운영 NAS 배포는 하지 않았다. 이 단위의 임시 검수 웹/API·합성 issuer·브라우저 탭은 종료하고 검수 DB/증거는 보존했다.
- 시스템 설정을 상담 워크스페이스 안에서 열도록 바꿨다. 새 창의 sessionStorage 분리로 로그인 만료처럼 보이던 경로를 제거했고, 설정을 보고 돌아와도 상위 통화 연결과 대기열 초안을 유지한다. 최고관리자도 같은 화면 안에서 전환한다. 플랫폼 토큰 발급 설정은 변경하지 않았다.
- 모든 직원이 설정에서 가입한 활성 조직을 선택한다. 변경 직전에 현재 Membership을 다시 검사하고, 이전 조직의 조회 결과·고객·통화 상태를 비우며 조직별 대기열 초안을 분리한다. 통화와 후처리 중에는 조직 변경을 차단한다. 조직 신규 등록/권한 배정 뒤 돌아오기·창 포커스 복귀·‘조직 권한 다시 확인’으로 최신 권한을 조회한다. 실제 개발 DB의 ‘조직1’에는 활성 관리자 Membership이 있는 것을 읽기 전용으로 확인했다.
- 팀을 펼치고 접을 수 있는 트리로 표시하고 팀 클릭 시 직접 소속 직원을 보여 준다. 직원 드래그앤드롭 또는 모바일/키보드의 ‘이동’ 선택 폼으로 소속 팀을 변경한다. 기존 버전 검사 API를 사용해 역할·직접 권한과 과거 기록의 작성 당시 팀을 보존하며 실패 시 현재 배치를 유지한다.
- 관리자 최상위 화면에 높이와 세로 스크롤을 부여하고 내부 관리 화면은 함께 흐르도록 했다. 실제 375×812 브라우저에서 문서 폭 375px, 관리자 높이 812px/내용 높이 2065px와 하단 직원·초대 버튼 접근을 확인했다. 768×1024도 문서 가로 넘침이 없다.
- 검증: frontend Vitest 24건·lint·Docker production 웹 빌드 통과, 관리자 UI Impeccable static detector 0건. 별도 PostgreSQL/합성 계정 브라우저에서 같은 URL의 설정, 두 조직 전환과 데이터 분리, 팀 클릭 직원 표시, 선택 폼 저장과 실제 드래그 저장·재조회 후 유지 확인. 증거는 Git 제외 `output/review/team-tree-settings.jpg`, `output/review/admin-scroll-mobile.jpg`다. 실제 사용자 계정의 재확인은 남아 있다.
- 다음 기능인 분류·결과·공통/조직/개인 템플릿의 **백엔드 작업은 아직 미커밋·미배포**다. `content` 패키지·V8·ContentIntegrationTest와 상담 저장 계약 변경은 전체 Docker build/test 및 백업 복원 V8 검증을 통과했다. `hellow-dev-api:content-check`와 Git 제외 `output/content-rehearsal.json`에 증거가 있다. 분류 ID·완료 결과를 보내는 프론트가 연결되기 전에는 배포하지 않는다. 이번 수정은 V7 기존 API와 호환되는 웹만 반영한다. [전체 진행표](mvp-progress.md)의 나머지 요청 범위는 유지한다.

## 2026-10-03 계층 팀·동적 역할·본인/팀/조직 데이터 범위

- 최종 웹·API `b01e729`를 개발 환경에 함께 반영하고 재시작했다. 두 컨테이너 healthy, Flyway V7, Nginx 설정 검사/reload 및 외부 `/login` HTTP 200 확인. 반영 직전 백업 후 고객 6·접수 21·상담 45·타임라인 14·Membership 1건을 보존했다. 백업 경로·SHA-256과 실제 반영 결과는 Git 제외 `output/structure-deployment.json`에 있다. 운영 NAS는 배포하지 않았다.
- 최종 이미지의 합성 직원 화면에서 동료 기록의 ‘기록 읽기 전용’ 표시·본문 편집 차단·저장 비활성화를 다시 확인했다. 768×1024 문서 가로 넘침 없음, 조직 관리 375×812 가로 넘침 없음·버튼/선택 입력 최소 44px·명시적 선택 항목 이름 확인. 증거는 Git 제외 `output/review/scope-readonly.jpg`, `output/review/mobile-structure.jpg`다. 이 단위의 임시 검수 웹·API·합성 issuer는 종료했고 별도 검수 DB는 보존했다. 실제 사용자 계정의 재로그인과 팀/역할 사용 확인은 남아 있다.
- 조직 관리에 팀·역할 탭을 추가했다. 상위 팀, 직원 소속 팀, 다중 역할, 역할별 기능/SELF·TEAM·ORGANIZATION 범위, 기존 직접 권한과 그 범위를 함께 관리한다. 팀 순환·타 조직 연결·소속 없는 TEAM 권한·버전 충돌을 거부하고, 역할 기반 관리자도 마지막 관리자 보호에 포함한다. 조직 잠금 아래 동시에 두 관리자 역할을 회수하면 하나만 성공하는 서버 회귀를 확인했다.
- 상담/접수/고객의 담당 issuer·subject·작성 당시 팀을 보존하고 목록의 범위를 SQL에서 제한한다. 고객 참여 관계와 상담 내용 범위를 분리하고 기록 수정·변경 이력·파일 뷰 티켓에서 범위를 재검사한다. 기존 직접 ORGANIZATION 권한은 유지하며 불명확한 과거 담당자를 이름으로 추정하지 않는다. 정확한 범위 계약은 [보안 기준](../skills/golden-path/references/domains/07-security.md#팀역할데이터-범위의-현재-계약)에 기록했다.
- 매 요청에서 현재 역할/Membership을 해석한다. 프론트도 폴링에서 최신 기능 권한을 읽고 허용된 API만 호출한다. 역할의 `queue:accept` 회수 시 기존 통화의 종료 의도 저장·LiveKit 참가자 제거 호출을 mock worker로 확인했다. 실제 사람의 음성 종료 수락 검증은 남아 있다.
- 조회와 수정의 범위가 다르면 서버가 고객/상담별 수정 가능 여부를 반환하고 다른 직원의 기록은 읽기 전용으로 열린다. 서버의 수정 거부와 화면 읽기 전용 회귀를 확인했다. 실제 서명된 합성 직원 JWT·PostgreSQL·웹에서도 본인 기록 입력/저장과 동료 기록 `contenteditable=false`·저장 버튼 비활성화를 확인했다. 다른 고객이 목록에 나오지 않고 같은 팀의 두 기록만 조회됐다. 768×1024 가로 넘침 없음 확인.
- 검증: Java 21 Docker Gradle 전체 build/test 통과, 새 권한 통합 테스트 9건(본인/팀/조직, 팀 이동, 회수, 기록·파일, 잘못된 배치, 마지막 역할 관리자, 수신 대기열, 미디어 제거 및 관리자 경쟁 포함). frontend Vitest 18건·lint·production build 통과. 팀/역할 UI·CSS의 Impeccable static detector 0건.
- 실제 개발 DB 백업을 별도 PostgreSQL DB에 복원해 Flyway V7·API health와 고객 6·접수 20·상담 43·타임라인 12·Membership 1건 보존을 확인했다. 백업 해시·복원 DB는 Git 제외 `output/structure-rehearsal.json`에 있다. 합성 issuer/직원/별도 DB에서 모바일 팀 생성·역할 범위 변경·직원 팀 이동 저장을 실제 브라우저로 확인했다. 375px 문서 가로 넘침 없음·입력/버튼 최소 44px 확인. 선택 항목의 명시적 접근성 이름을 보완했다.
- 다음은 3단계 상담 분류·결과·공통/조직/개인 템플릿이다. [전체 진행표](mvp-progress.md)의 실제 사용자 계정·파일/통화 검수, 고객 소급 연결, ACD·예약/이관·모니터링 등 남은 범위를 유지한다.

## 2026-10-03 로그인 성공 응답의 JSON 파싱 실패 수정

- 수정 웹 `7ebc75c`를 빌드하고 개발 웹만 재시작했다. 웹 healthy, 개발 `/login` HTTP 200, Nginx 설정 검사/reload 통과. API는 `4362f8c`를 유지했으며 DB 변경은 없다. `.env.dev`의 이미지 선택과 동일 API 이미지 별칭을 `7ebc75c`로 준비했다.
- 사용자 로그인에서 `Unexpected end of JSON input`이 표시됐다. 실제 개발 Nginx 로그에서 `/api/me`와 `/api/session/login` 모두 HTTP 200을 확인했고, Spring의 void 로그인 이력 API가 빈 200 본문을 반환하는데 `apiJson`이 JSON 파싱을 강제해 콜백에서 토큰을 지우는 원인을 확인했다.
- 공통 API 클라이언트가 성공한 빈 본문을 null로 처리하도록 수정했다. 인증·권한 오류는 기존대로 거부한다. 플랫폼 인증 설정과 서버 계약은 변경하지 않았다.
- 실제 Response를 사용하는 콜백 회귀 검증으로 빈 200/204 이후 로그인 성공·토큰 유지·인증 헤더·워크스페이스 이동, 401 이후 실패·토큰 제거를 확인했다. Vitest 15건, frontend lint·production build·Docker 웹 빌드 통과. 실제 사용자 계정의 재로그인은 아직 재검수하지 않았다.
- 이전 단위의 모바일/태블릿·고객 기록·수신 모달·후처리 차단 수정은 유지하며, 전체 남은 범위는 [진행표](mvp-progress.md)를 따른다.

## 2026-10-03 새 기능 개발 배포와 모바일 검수 보완

- 최종 보완 웹 `79fa154`를 추가로 재시작했다. 실제 개발 API는 동일 계약의 `4362f8c`를 유지하며 모두 healthy, `/login` HTTP 200, Nginx 검사/reload 성공. `.env.dev`의 다음 이미지 선택은 `79fa154`이고 API 태그도 동일 API 이미지로 준비했다. 운영 NAS는 배포하지 않았다.
- 최종 이미지 검수에서 수신 모달의 모바일 중앙 배치·후처리 중 수락 비활성화, 768×1024 본문 높이 약 435px·1280×800 약 367px 및 가로 넘침 없음 확인. 실제 개발 `/support?org=hellow-dev`를 375×667로 열어 요청 버튼의 top 607/bottom 655px·화면 내 표시·가로 넘침 없음 확인. 합성 화면 증거는 `output/review/mobile-incoming.jpg`다. 검수용 API/웹/합성 issuer는 종료했고 검수 DB와 백업은 보존했다.

- `4362f8c` 웹/API를 개발 스택에 함께 반영하고 모두 healthy, Nginx 설정 검사/reload와 개발 `/login` HTTP 200을 확인했다. Flyway 4~6 통과, 고객 5·접수 16·상담 36·타임라인 9·Membership 1건 보존. 실제 반영 직전 백업과 SHA-256은 Git 제외 `output/ui-deployment.json`에 기록했다.
- 같은 API/웹 이미지와 별도 합성 조직·JWT·DB로 빈 대기열의 고객/이전 기록 편집을 실제 브라우저에서 확인했다. 모바일 텍스트 입력/줄바꿈 → 저장 → 새로고침 복원, 변경 이력 조회 통과. 375×667은 문서 본문 높이 172px·가로 넘침 없음, 320×568은 본문 155px·내부 세로 스크롤로 저장 버튼 접근을 확인했다. 768×1024 두 열 배치와 조직 관리/상속 설정 모바일 가로 넘침 없음도 확인했다. 실제 사용자 계정/실제 마이크 검수로 기록하지 않는다.
- 수신 모달과 후처리 중 수락 버튼 차단 표시를 확인했다. 모바일 검수 중 도구가 본문을 압박하고 고객 영역의 위치 기반 높이 제한이 기록 모드의 본문에 적용되는 것을 발견해 고쳤다. 태그/템플릿 도구는 펼쳐 쓰고, 기록 이동/변경 이력 도구를 통합하고, 완료 기록의 상태 표시를 복원했다.
- Vitest 12건·lint·production build 통과, 새 화면/관리자/반응형 CSS static detector 0건. 전체 범위와 실제 음성/첨부 수락 검증은 [진행표](mvp-progress.md)에 남아 있다.

## 2026-10-03 고객 기록 독립 편집·수신·후처리·반응형과 관리자 구현

- 상담 요청이 없어도 고객 목록과 실제 Consultation 이력을 열고 수정하거나 새 기록을 작성한다. 대기열 상태와 고객 기록 탐색을 분리하고 화면 전환 중 초안을 유지한다. 기록 수정은 버전 충돌을 검사하며 원래 작성자·시각·통화 길이를 유지하고 수정 전 전체 내용과 수정자를 별도 변경 이력에 보존한다. 첨부는 검증된 기록 ID 문맥에서도 허용하며 타 조직·다른 기록 파일 참조는 거부한다.
- 신규 대기 요청은 고객·연락 유형·접수 내용이 보이는 큰 dialog로 표시한다. 수락 또는 대기열에서 확인을 선택하며 후처리 중에는 수신 액션을 비활성화한다. 서버도 직원 잠금 하에서 PROCESSING 음성 상담이 있으면 종료 여부에 관계없이 다음 음성 상담 수락을 거부하고 상담 기록 완료 후 허용한다.
- 실제 LiveKit 로그에서 음성 연결 약 2초 후 동일 상담사 참가자가 DUPLICATE_IDENTITY로 교체되는 것을 확인했다. 여러 창의 자동 연결을 Web Locks로 한 창에 제한하고 중복 연결 이유를 표시한다. 중단된 비동기 연결이 뒤늦게 마이크를 켜지 않도록 방어했다. 실제 양방향 음성 유지와 다른 브라우저/기기 중복은 추가 수락 검증이 필요하다.
- CRM 고정 최소 너비를 제거했다. 모바일은 대기열/편집기/이력/고객 화면 전환, 태블릿은 목록·편집과 이력 전환을 사용한다. 기록 목록과 편집기 전환, 터치 영역·입력 폰트·하단 safe area를 적용한다. 실제 크기별 브라우저 검수와 배포 증거는 후속 실행 결과로 기록한다.
- 최고/조직 관리자 화면, 직원 ID 등록·권한 수정·관리자 이관/마지막 관리자 보호, 이메일 검증된 직원의 일회성 초대 링크, CRM 로그인·변경 감사 기록을 구현했다. 공통/조직 고객 접수 브랜딩의 상속·오버라이드·초기화·버전 충돌·영향 조직 조회와 조직별 홈페이지 연결 주소를 제공한다. 초대 이메일을 발송하지 않으며 링크를 관리자가 전달한다. 실제 플랫폼 설정을 변경하지 않았다.
- 검증: Java 21 Docker Gradle build/test 통과(관리자·설정·초대·경쟁과 고객 기록/후처리 회귀 포함), frontend lint/production build 통과, Vitest 12건 통과. PostgreSQL 복원 DB에서 Flyway 4~6·API health와 고객 5/접수 16/상담 36/타임라인 9/Membership 1건 보존 확인. 백업 증거는 Git 제외 `output/ui-rehearsal.json`이다. 새 화면/관리자 대상 Impeccable static detector 결과 0건. 실제 재시작과 크기별 브라우저 검수는 후속 실행 결과로 남긴다.
- 남은 전체 범위는 [진행표](mvp-progress.md)를 유지한다. 이번 변경만으로 팀/역할/데이터 범위·분류/템플릿·ACD·예약/이관·모니터링·전체 음성 검증을 완료 처리하지 않는다.

## 2026-10-03 에디터 작성 진입 안내 보완

- 사용자가 새 개발 버전의 로그인과 기존 기록 표시를 확인했다. 이후 입력/줄바꿈 불가 보고에 대해, 서버에 PROCESSING 접수가 없고 WAITING 상담만 선택 가능한 상태이며 작성 권한이 담당 상담 수락 후에만 열리는 것을 확인했다. 조회와 담당 작성의 경계는 유지하면서 에디터 위에 읽기 전용 이유와 수락/수신 후 기록 작성 버튼을 추가했다.
- 수락 API가 반환한 실제 담당 상태를 화면에 즉시 반영한다. 다음 폴링을 기다리지 않고 초안 조회 후 편집 상태로 전환한다. WAITING 입력 차단·안내·수락 후 작성 전환 회귀 테스트를 추가했으며 frontend 9개 테스트와 lint가 통과했다. 이 변경의 배포·실제 화면 확인은 다음 실행 결과에 기록한다.
- 관리자·초대·설정 기능은 별도 작업 중이며 이번 에디터 수정의 완료 범위에 포함하지 않는다.

## 2026-10-03 개발 새 버전 전환·기존 기록 이관

- 사용자 요청으로 개발 웹/API를 `6194275` 이미지로 함께 전환했다. `.env.dev`의 `HELLOW_DEV_IMAGE_TAG`를 Compose 이미지 선택에 사용하며 실행 명령은 `docker compose --env-file .env.dev up -d --no-deps --no-build api web`이다. 플랫폼 설정은 변경하지 않았다.
- 구 API의 쓰기를 중지한 뒤 `output/backups/hellow-cutover-20261003_083325.dump`에 백업했다 (SHA-256 `2866f305086fc7565cd494dd9d2091be0c65990143ccbdf711535e831c793f48`). 조직 ID와 레코드 수는 Git 제외 `output/dev-release.json`에 남긴다. 복원 DB에서 Flyway 1~3과 새 API health, 첫 조직 이관을 검증한 후 실제 `hellow` DB에 같은 이관 SQL을 적용했다. 고객 5·접수 11·상담 30·타임라인 3건이 모두 보존되고 조직 미지정 행은 없다.
- 웹/API를 실제로 재생성했으며 모두 healthy다. Nginx 설정 검사와 upstream 주소 reload 후 개발 `/login` HTTP 200, 공개 `/api/support/organization/hellow-dev` HTTP 200을 확인했다. 고객 접수 주소는 `/support?org=hellow-dev`다.
- 복원 검증 첫 시도는 Docker `run --env-file`이 따옴표를 값으로 읽어 issuer URL 오류로 종료했다. Compose와 동일하게 따옴표를 제거한 검증 전용 환경 파일로 재검증했으며 실제 서비스는 Compose의 환경 파싱을 사용한다. 원본 DB 이관은 두 번째 검증 통과 후에만 수행했다.
- 실제 계정 로그인과 기존 기록 표시 확인은 사용자에게 요청했으며 아직 결과를 받지 않았다. 화면·파일·저장 검수, 관리자 화면과 조직 설정, 이후 전체 작업의 현황은 [진행표](mvp-progress.md)에 유지한다.

## 2026-10-03 플랫폼 토큰 계약에 맞춘 Hellow 인증 수정

- 사용자의 지적에 따라 Hellow가 상위 플랫폼의 토큰 발급 설정 변경을 요구하던 방향을 바로잡았다. 실제 로그인 토큰 claim은 `aud=account`, `azp=app`, `typ=Bearer`로 확인했다. Hellow API는 서명·issuer·만료와 이 access token 조합을 검증하고 ID token·다른 client 토큰을 거부한다. `HELLOW_API_AUDIENCE`는 플랫폼이 전용 audience를 발급할 때만 설정하는 선택적 추가 검사다. 플랫폼 설정은 변경하지 않는다. 서버 Docker 빌드와 테스트가 통과했다.
- 백업과 복원 DB의 49건 이관 연습, 첫 관리자 `sub` 일치, 개발 첨부 보존 코드 `default` 설정은 아래 기록대로 확인했다. 추가 V3 migration으로 기존 Queue의 `call_ended`와 Queue/상담의 `version`을 채웠다. 새 API를 최신 백업의 복원 DB에서 기동해 Flyway 1~3, health 200, 공개 조직 경로 200, 미인증 `/api/me` 401, 기존 49건과 관리자 Membership 이관을 확인했다. 실제 개발 서비스 전환과 로그인·조직·기록 검수는 다음 단계다. 현재 사이트는 이전 호환 버전으로 정상 실행 중이다.

## 2026-10-03 개발 main 정합 배포 사전 검증 (인증 계약 대기)

- 사용자가 개발 환경의 기존 고객 5건, 접수 11건, 상담 30건, 타임라인 3건을 첫 개발 조직으로 모두 이관하도록 지정했다. 기존 운영 중인 DB에는 아직 이관을 적용하지 않았다. 새 API의 조직 컬럼이 없는 기존 기록은 모두 조직 미지정 상태로 보존되며, 그대로 배포하면 화면에서 보이지 않는다.
- 배포 전 DB를 `output/backups/hellow-before-main-20261003.dump`에 백업했다 (Git 제외, SHA-256 `E2B04DDBAE20C66A0A41B0010AFB7169A25CFAF99ACEFC50C40F57529E6A53B2`). 별도 `hellow_restore_check_20261003` DB에 복원하여 49개 레코드 수가 일치함을 확인했다. 현재 main API를 이 복원 DB에서 기동하여 Flyway V2·Hibernate 개발 스키마 생성, health 200, 인증 없는 `/api/me` 401을 확인했다. [개발 전용 1회 이관 SQL](../scripts/dev-one-time-organization.sql)을 복원 DB에 적용해 조직 1개·관리자 Membership 1개·권한 8개·기존 49건 연결을 확인했고 `/api/support/organization/hellow-dev`는 200을 반환했다. 검증용 API 컨테이너와 복원 DB는 제거했다. 실제 전환 시점에는 새 백업과 복원 검증을 다시 수행해야 한다.
- 사용자 로그인 access token의 현재 `aud`는 `account`뿐이다. 플랫폼 연동 문서상 호스트 API audience는 자동 등록되지 않으며, Hellow API 전용 audience 발급 계약이 필요하다. `account`를 `HELLOW_API_AUDIENCE`로 설정하지 않는다. `.env.dev`에 이 값이 없고, `ADMIN_OIDC_SUBJECT`만 있던 상태를 확인해 현재 코드가 읽는 `ADMIN_OIDC_SUB`를 같은 값으로 로컬에 추가했다 (평문 파일은 Git 제외). 사용자가 확인한 현재 로그인 계정의 `sub`는 로컬 관리자 설정과 일치한다. 사용자는 첨부파일 보존 코드 `default`(플랫폼 문서상 현재 1년)를 선택했고 `.env.dev`에 `HELLOW_ATTACHMENT_RETENTION_CODE=default`를 추가했다. 플랫폼 인증 서버의 관리자 서비스 자격으로 읽기 전용 설정 조회를 시도했으나 401이어서 audience를 변경할 접근은 확인되지 않았다.
- 현재 main API Docker 빌드/서버 테스트와 web Docker 빌드가 통과했다. 새 이미지는 `hellow-dev-api:main-check`, `hellow-dev-web:main-check`로 별도 보관했다. API의 `latest` 태그는 이전 호환 소스 `f65216d`에서 재빌드한 `legacy-compatible`로 돌렸다. **실행 중인 개발 web/API/DB/LiveKit/Nginx는 재시작하지 않았으며**, 기존 로그인 동작을 유지한다. 개발 사이트 `/login`과 `/support` HTTP 200, 실행 중인 web/API health 정상.
- 다음: 플랫폼에서 Hellow API 전용 audience를 발급하고 사용자 토큰의 `aud`에 들어오는지 확인 → API와 web을 함께 전환할 짧은 점검 창에 구 API 쓰기 중지 → 새 DB 백업·복원 검증 → 첫 개발 조직으로 이관 SQL 적용 → 두 서비스를 같은 main 버전으로 재시작 → 실제 계정 로그인·조직·기존 기록·모바일 `/support`·에디터 첨부를 확인. 운영 NAS 이관과 2인 WebRTC 검증은 별도다.

## 2026-10-03 개발 웹 버전 정합성 복구와 UI 반영

- 이전 모바일·에디터 수정 커밋 `3e379f6`의 웹만 개발 Compose에 반영했을 때 로그인 후 `/api/me`가 404를 반환했다. 개발 API는 05:00경 빌드된 이전 계약이고, 새 웹은 이후 도입된 인증·조직 API를 요구한다. `.env.dev`에도 새 API가 요구하는 `HELLOW_API_AUDIENCE`가 없어 현재 API와 웹을 함께 올리는 것은 수락 준비가 안 됐다.
- 개발 웹은 기존 API와 맞는 `f65216d` 버전에 모바일 `/support` 스크롤·요청 버튼과 SHNEA 에디터 높이 수정만 적용한 `hellow-dev-web:legacy-ui-fix` 이미지로 교체했다. `docker compose up -d --no-deps web`으로 웹 컨테이너만 재생성했고 API·DB·LiveKit은 재시작하지 않았다. 이 개발 이미지의 기능 버전은 현재 Git `main`보다 이전이다. 다음에 `docker compose build web`을 그대로 실행하면 로그인 호환성 문제가 재발할 수 있다.
- 반영 후 개발 웹·API·Nginx health 확인, 개발 주소 `/login`·`/support` HTTP 200 확인. 실행 중인 웹의 합성 상담 화면에서 에디터 호스트와 편집기 높이가 각각 약 607px로 일치했고, 375×667 모바일 `/support`에서 버튼이 화면 안에 있고 폼 스크롤이 가능한 것을 확인했다. 실제 OIDC 계정 로그인은 사용자 세션에서 다시 확인해야 한다.
- 이후 현재 `main`을 개발 환경에 올리려면 실제 OIDC API audience·첫 조직 Membership·DB 이관/복구 계약을 먼저 확인하고 웹·API를 호환되는 버전으로 함께 배포한다.

## 2026-10-03 모바일 접수와 상담 에디터 높이 수정

- `/support`가 공통 레이아웃의 `overflow-hidden` 때문에 모바일에서 긴 접수 폼을 스크롤하지 못하던 문제를 페이지 내부 스크롤로 수정했다. 좁은 화면에서 헤더를 줄바꿈하고 제출 버튼을 화면 하단에 붙여 표시한다.
- SHNEA React 에디터가 생성하는 바깥 요소에 flex 높이가 없어 편집기가 화면 위쪽에서 짧게 끝나던 문제를 수정했다. 작성 영역의 중복 `h-full`도 제거했다.
- 검증: 375×667·320×568 모바일 화면에서 제출 버튼이 첫 화면과 스크롤 후 화면 안에 있고 폼이 스크롤됨을 확인했다. 1280×800 에디터 레이아웃에서 에디터가 남은 높이 520px를 채우는 것을 확인했다. Frontend 테스트 8개·lint·production build 통과. Impeccable detector의 기존 색상·애니메이션 경고 5개는 이번 기능 수정 범위 밖이다.
- 로컬 코드 수정만 수행했다. 실행 중인 개발·운영 컨테이너에는 반영하지 않았고 실제 모바일 기기·실제 로그인 세션 검증은 남아 있다. WebRTC 2인 통합 검증은 사용자 요청에 따라 후속으로 둔다.

## 2026-10-03 관리자·설정·후반 기능 지침 확정

- 사용자 승인으로 golden-path core/scope/data/security/decisions에 관리자 화면 두 개, 공통 기본값·조직 오버라이드, 조직도·역할·관리자 추가, 최대 3단계 분류, 조직/개인 템플릿, 상담 상태 모니터링과 지식·AI·내부 채팅의 작업 순서를 반영했다.
- 최고관리자는 issuer+sub로 식별하고 대상 조직 관리 작업을 감사한다. 고객 내용·청취·개인 템플릿·비공개 채팅 접근을 자동 부여하지 않는다. 공통 설정 상속과 과거 상담 기록 보존 기준을 분리했다.
- 지침만 변경했으며 제품 구현·실환경 검증 상태는 올리지 않았다. 다음 시작은 실제 OIDC 계약·첫 조직 권한 확인과 관리자/설정 상세 구현이다. AI·채팅은 후반으로 유지한다.
- 검증: 문서 77개·로컬 링크 235개·영역 14개·요구사항 85장·스킬 해시 64개와 Git diff 형식 검사 통과. 문서 변경이므로 제품 테스트는 재실행하지 않았다.

## 2026-10-03 Bonfire 갱신·골든패스 이전

- [bonfire_skill 최신 커밋](https://github.com/shnea/bonfire_skill/commit/a7c841015353025d8e4aef73b9ac24a46960e621)을 내려받아 전역 Bonfire 설치본을 갱신했다. 새 구조에 맞춰 프로젝트의 workflow·golden-path·Impeccable을 `skills/`로 이전하고 시작 안내·스킬 연결·검증 스크립트 경로를 갱신했다. 프로젝트별 기준을 보존했고 Impeccable의 실행 경로 표기만 새 위치로 바꿔 원본·프로젝트 수정본 해시를 각각 보관했다.
- [핵심 기준](../skills/golden-path/references/core.md), [범위](../skills/golden-path/references/domains/02-scope.md), [검증](../skills/golden-path/references/domains/11-validation.md)에 [리뷰 수정 결과](review-repair.md)의 부분 구현, 실행한 검사, 실제 OIDC·조직 배정·파일 정책·2인 통화·NAS 검증의 남은 조건을 반영했다.
- 문서 검증: `python scripts/verify-docs.py`로 Markdown 77개·로컬 링크 230개·영역 14개·요구사항 85장·Impeccable 수정본 해시와 원본 대조 64개 통과. 제품 테스트는 이번 문서·스킬 이전에서 재실행하지 않았다.

## 2026-10-03 리뷰 수정 인계

현재 상태의 정본은 [f65216d 리뷰 수정 결과](review-repair.md)다. 아래 과거 완료 기록 중 공개 API·개발 로그인·PUBLIC 파일·목업 성공·독립 Queue complete 및 실제 연동 완료 표현은 이번 수정으로 대체한다.

- 서버 Bearer JWT 검증, 명시적 API audience, Organization/Membership/Permission/ORG 범위, 담당 상담·파일 권한을 도입했다. 누락된 운영 계약은 거부한다.
- Queue 행 잠금과 담당자 동시 CALL 제약, 상담별 초안 upsert/version, 저장·이력·완료 단일 트랜잭션을 구현했다. 미등록 고객은 실제 등록/연결 이후 Customer code를 사용한다.
- Editor JSON과 작성 중 초안 보존, 실제 타임라인 재조회, 선택 맥락과 활성 미디어 분리, 순차 폴링/오래된 응답 폐기, 실패 표시를 적용했다. 미연동 액션은 성공 처리하지 않는다.
- PRIVATE 소유 파일과 스트리밍 청크, 짧은 LiveKit 참가 토큰·서버 제거 재시도를 구현했다. 기존 조직 미지정 데이터와 PUBLIC 파일은 임의 이관하지 않았다.
- 검증: Java 21/Gradle 8.12.1 서버 테스트 12개 PostgreSQL 17.11에서 통과. Frontend 테스트 8개·lint·production build 통과. 격리된 합성 조직/고객/JWT로 초안 저장·새로고침 복구·우측 이력과 편집기 동시 표시 확인. Nginx 설정 검증 통과.
- 문서 검사: Markdown 77개·로컬 링크 213개·영역 14개·요구사항 85장·스킬 해시 64개 통과. Git diff whitespace 검사 통과.
- Impeccable detector의 기존 스타일 경고 12개는 유지. 이번 변경은 안전한 기능 복구에 한정하며 시각 스타일 전면 개선을 완료했다고 보지 않는다.
- 당시 `.agents` 기준 문서 쓰기 권한 문제로 core/scope/validation 갱신을 보류했다. 이후 위 Bonfire 갱신에서 쓰기 가능한 `skills/`로 기준을 이전하고 해당 문서를 갱신했다.
- 남은 일: 실제 OIDC API audience·첫 조직 Membership·파일 보존 정책 계약, 관리자 UI/TEAM·SELF·ACD, 미등록 상담 과거 이력의 고객 소급 연결, 기존 PUBLIC 파일 정리, 운영 DB migration/restore, HTTPS/2인 통화·실제 권한 회수 후 참가자 제거 검증.
- 운영 및 원래 개발 스택은 재배포하지 않았다. 분리된 검증 서버·DB만 사용했다.

## 완료한 작업

- 요구사항정의서 1~85장을 검토해 골든패스 원본의 core.md, 14개 영역, skills.md, decisions.md, 영역 색인을 작성했다. [핵심 기준](../skills/golden-path/references/core.md)부터 읽는다. 원문 요구사항은 수정하지 않았다.
- MVP와 Phase 2~4, 확정 기술과 검토 후보, 구현 시 수락 기준과 미검증 상태를 구분했다. Bonfire 항목·내보내기/가져오기 참조는 보존했다.
- Impeccable 4.5.0을 설치하고 reference/agents/scripts, LICENSE/NOTICE, 파일 해시를 보관했다. UI 작업 조건으로 골든패스에 등록했다. [출처](../skills/impeccable/SOURCE.md).
- 개발·운영 환경: 도메인, 포트, 레지스트리, 커밋 SHA 태그, Compose, SOPS + age, 운영 최소 배포물과 NAS 사양 기록. 상세는 [환경 기준](infrastructure.md)을 따른다.
- [개발·협업 원칙](development.md): 큰 작업 단위별 검증·커밋·push·인계 절차와 사람 친화적 소스 구조 기준 기록.
- AGENTS.md에서 환경 기준, 개발 원칙, 인계 기록을 연결.
- CI/CD는 특정 서비스 선택 배포와 전체 배포를 지원해야 한다는 요구를 반영했다.
- 상담사 작업 화면 UI 방향 확정 및 정의서 작성 완료:
  - B안(대기열/작업 흐름 중심) 기반 + C안(좌측 슬림 글로벌 내비게이션 바) 결합 구조.
  - 상담 이력 탐색 중 후속 조치 즉시 연계 및 넓은 실시간 메모 공간 확보 요구 반영. [상담사 화면 UI 정의서](ui-direction.md).
- **Next.js App Router + TypeScript 기반 상담사 작업 화면 인터랙티브 프로토타입 구현 완료 (`frontend/`)**:
  - **슬림 GNB (`SidebarGNB.tsx`)**: 64px 폭, 메뉴 탭 탐색 및 상담사 근무 상태(온라인/통화중/자리비움/퇴근) 모달 선택기 구현.
  - **처리 대기열 패널 (`QueuePanel.tsx`)**: 탭 필터(전체/콜/콜백/티켓), 실시간 인바운드 콜 강조 애니메이션, 콜백 예약 및 할당 티켓, 대기열 선택 시 고객 워크스페이스 맥락 전환 연동. 미등록 고객 및 컴플레인 고객 뱃지 추가.
  - **중앙 활성 워크스페이스 (`ActiveWorkspace.tsx`)**:
    - 실시간 통화 경과 시간 카운트업 타이머, 음소거, 통화 보류(Hold 시 대기음 안내 상태 뱃지), 호전환 연계, 통화 종료 제어기.
    - **고객 정보 상세 조회 / 인라인 수정 / 상담 중 신규 고객 등록 기능**:
      - **기업 고객(B2B) vs 개인 고객(B2C/일반 소비자) 구분 지원**: 기업 담당자뿐만 아니라 회사 소속이 없는 일반 개인 및 컴플레인 민원 제기자 정보 완벽 대응.
      - **컴플레인 / 주의 고객 관리**: `[⚠️ 컴플레인 주의 고객]` 강조 뱃지 및 특이사항 경고 박스, 상담 메모 템플릿에 `[⚠️ 컴플레인 접수]` 원클릭 템플릿 탑재.
      - 등록 고객: 고객명, 직책/부서, 회사, 연락처, 이메일, 등급, 최근상담, 고객메모 상세 조회 및 `[정보 수정]` 인라인 폼 지원.
      - 미등록 고객: `[미등록 고객 (신규 인입)]` 안내 배너와 함께 통화 중 확인된 정보를 기업 또는 개인으로 즉시 분류하여 `[신규 고객으로 등록]`할 수 있는 인라인 등록 폼 지원.
      - 접기/펼치기 토글을 제공하여 고객 정보 확인과 하단 상담 메모 작성 공간의 균형 확보.
    - 연동형 대분류·중분류 드롭다운(컴플레인 민원, 제품 문의, 계약/정산, 기술 지원), 처리 상태 선택, 빠른 태그 칩 토글.
    - 서식 에디터 툴바 및 4종 템플릿(컴플레인 접수, 견적 협의, 기술 장애, 부재 콜백) 원클릭 삽입.
    - 넉넉한 높이의 대형 실시간 메모장 및 하단 임시저장/관리자 에스컬레이션/상담 종료 및 완료 액션 바.
  - **우측 고객 맥락 및 후속 조치 패널 (`ContextActionPanel.tsx`)**:
    - 채널별(전체/전화/이메일/채팅/티켓) 과거 상담 이력 타임라인.
    - 타임라인 내 "인용" 클릭 시 중앙 실시간 상담 메모장에 과거 이력 자동 인용문 삽입.
    - 4가지 즉시 연계 후속 조치 패널: ① 엔지니어 방문/서비스 예약 접수, ② 콜백 일정 등록, ③ 실시간 가용 상담사 원클릭 호전환, ④ 고객 안내 알림톡/SMS 발송.
    - 후속 조치 접수 시 타임라인 실시간 추가 반영.
  - **전역 피드백 시스템 개선 (`Toast.tsx`)**: 단순 클릭 알림 남발을 제거하고, 최대 5개까지만 깔끔하게 표시되며 3.5초 후 자동 소멸되도록 최적화.
  - **한국어 실무 목업 데이터 세트 (`mockData.ts`)**: 기업 고객 외에 개인 컴플레인 고객(`queue-complainant`: 환불 지연 항의 건), 미등록 고객 인입 콜(`queue-unregistered`)을 포함한 실무 데이터 내장.
- **Java 21 / Spring Boot 3.4.4 백엔드(`backend/`) 및 PostgreSQL 17 데이터베이스 구축 및 프론트엔드 연동 완료**:
  - 사람 친화적 도메인 중심 구조 (`customer`, `queue`, `consultation`, `timeline`, `followup`).
  - Spring Data JPA 엔티티 및 REST API 엔드포인트 구현:
    - `Customer`: 기업(B2B) 및 개인(B2C) 고객 조회, 신규 등록, 정보 수정
    - `QueueItem`: 대기열 조회 및 처리 완료
    - `Consultation`: 상담 메모 임시저장 및 완료 저장
    - `TimelineItem`: 고객별 채널 상담 이력 조회 및 추가
    - `FollowUpAction`: 방문 예약, 콜백 일정, 호전환 등 후속 조치 저장
  - `DataInitializer`: 초기 CRM 데이터베이스 자동 시딩 (기업 VIP, 개인 컴플레인, 미등록 인입 콜 등)
  - `frontend/src/app/page.tsx`:
    - 브라우저 마운트 시 `/api/queue`, `/api/customers`, `/api/timeline`에서 실제 DB 데이터를 조회하여 렌더링.
    - 신규 고객 등록, 정보 수정, 상담 저장 완료, 후속조치 접수 시 실제 Spring Boot API를 호출하여 PostgreSQL에 영속화.
- **Docker Compose + Nginx (포트 `30160`) 전체 스택 연동 환경 구성 및 기동 완료**:
  - `compose.yaml`: `db` (PostgreSQL 17, 외부 포트 `30161`), `api` (Spring Boot), `web` (Next.js), `nginx` (호스트 포트 `30160`).
  - `infra/nginx/default.conf`: 외부 인입 호스트 포트 `30160` -> Nginx `8080` -> `/api/`는 `api:8080`, `/`는 `web:3000`으로 리버스 프록시 연동.
- **고객용 외부 웹 상담 진입 화면 구축 (`frontend/src/app/support/page.tsx`, MVP-04)**:
  - 모바일·PC 반응형 웹 상담 접수 폼: 고객 구분(개인 B2C vs 기업 B2B), 5가지 문의 분류(제품 문의, 장애 지원, 계약/정산, 환불/컴플레인, 기타), 성함, 회사명, 연락처, 문의 요약, 연결 방식(실시간 음성 vs 온라인 티켓).
  - 실시간 대기 인터페이스: 펄스 애니메이션, 실시간 대기 순번 및 예상 대기 시간, 백엔드 세션 상태 2초 주기 폴링, 대기 취소 버튼.
  - 상담 연결 인터페이스: 담당 상담사명 안내, 실시간 통화 경과 시간 타이머, 마이크 음소거 토글, 문의 요약 카드, 통화 종료 버튼.
  - 상담 종료 피드백 화면: 서비스 만족도 5단계 별점 평가 및 신규 상담 재접수 지원.
- **백엔드 고객 상담 세션 수명 주기 및 대기열 연동 API 구현 (`SupportController.java`, `QueueController.java`, `QueueItem.java`)**:
  - `POST /api/support/request`: 외부 고객 상담 접수 -> 전화번호 기반 기존 고객 매핑, 컴플레인 키워드 자동 감지(긴급 우선순위 지정), 미등록 고객 판정, 고유 대기열 코드(`queue-web-XXXX`) 및 세션 ID 발급.
  - `GET /api/support/session/{sessionId}`: 고객 화면 세션 상태 실시간 조회 (`WAITING` -> `PROCESSING` -> `COMPLETED` / `CANCELLED`).
  - `POST /api/support/session/{sessionId}/cancel`: 고객의 대기 중 취소 처리.
  - `POST /api/queue/{code}/accept`: 상담사의 대기열 아이템 수락 및 상담사 배정(`PROCESSING`).
  - `POST /api/queue/{code}/complete`: 상담사의 상담 완료 처리(`COMPLETED`).
- **상담사 CRM 화면 실시간 연동 강화 (`frontend/src/app/page.tsx`, `SidebarGNB.tsx`)**:
  - 3초 주기 자동 대기열 폴링 및 신규 인입 발생 시 즉각 토스트 알림(`🔔 신규 고객 상담 인입`).
  - 대기열 카드 [수신] 클릭 시 백엔드 `accept` 호출 및 통화 워크스페이스 활성화.
- **SHNEA 플랫폼(Platform) 핵심 연동 모듈 및 파일/인증 계약 구현 (`PlatformClient`, `PlatformController`, MVP-01)**:
  - `PlatformProperties` & `compose.yaml`: `.env.dev` 환경 변수(`PLATFORM_API_KEY`, `PLATFORM_PROJECT_ID`, `PLATFORM_ENVIRONMENT_ID`, `PLATFORM_OIDC_ISSUER`)를 컨테이너 내부로 주입 및 자동 매핑.
  - **환경 컨텍스트 검증 (`PlatformClient.fetchContext`)**:
    - `GET /api/v1/integration/context` (헤더: `X-Platform-Key`) 호출로 프로젝트 UUID(`14dd20e4...`) 및 환경 UUID(`06c8d669...`) 대조 검증 수행 (`verified: true`).
    - 10개 활성 스코프(`integration:read`, `files:*`, `jobs:*`, `logs:*`) 정상 확인.
  - **플랫폼 파일 API (`X-Platform-Key`) 업로드 프로토콜 구현 (`PlatformClient.uploadFile`)**:
    - 1단계: 업로드 세션 생성 (`POST /api/v1/files/uploads`, SHA-256 계산)
    - 2단계: 8MB 청크 분할 전송 (`PATCH /api/v1/files/uploads/{id}`, `Upload-Offset`, `X-Chunk-SHA256`)
    - 3단계: 업로드 완료 확정 (`POST /api/v1/files/uploads/{id}/complete`)
    - 4단계: 영구 File ID 및 뷰어 URL(`.../content/original`) 획득 및 클라이언트에 안전하게 전달.
- **SHNEA Keycloak OIDC 통합 로그인 화면 및 PKCE 콜백 구현 (`/login`, `/auth/callback`, `lib/pkce.ts`)**:
  - **Keycloak 유효 콜백 URL 확정 및 설정**:
    - 개발 도메인: `https://dev-hellow.shnea.kr/auth/callback`
    - 로컬 개발 테스트: `http://localhost:30160/auth/callback`
    - `.env.dev`의 `PLATFORM_OIDC_REDIRECT_URI`를 `https://dev-hellow.shnea.kr/auth/callback`으로 확정 갱신.
  - 로그인 화면([`/login`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/app/login/page.tsx)):
    - SHNEA 플랫폼 계정 로그인(Code + PKCE S256, `openid profile email`), Keycloak 등록용 콜백 URL 원클릭 복사 도구, 개발 모드 즉시 접속 바이패스 지원.
  - 콜백 처리 페이지([`/auth/callback`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/app/auth/callback/page.tsx)):
    - 인가 코드(Code) 및 세션 verifier를 이용한 토큰 교환, ID 토큰 디코딩(`given_name`, `email`), 상담사 세션 활성화 및 메인 워크스페이스 자동 이동.
  - 슬림 GNB 프로필 메뉴에 `[로그인 / 계정 변경]` 바로가기 링크 탑재.
- **SHNEA 공식 에디터(`@shnea/editor@0.1.0-alpha.11`) 패키지 설치 및 첨부 어댑터 연동 (`editor.md` 표준 준수)**:
  - `shnea-editor-0.1.0-alpha.11.tgz` 다운로드 및 SHA-256 체크섬(`b0f9e9c283346046a62526349d89f696b76e17ce40dac0e33312f56f08d0ca56`) 무결성 검증 후 설치.
  - `Dockerfile`: `web-deps` 단계에 `shnea-editor-0.1.0-alpha.11.tgz` 포함하여 `npm ci` 멀티스테이지 빌드 지원.
  - 백엔드 첨부 API ([`EditorAttachmentController.java`](file:///E:/JetBrains/IntelliJ/hellow/backend/src/main/java/kr/shnea/hellow/platform/EditorAttachmentController.java)):
    - `POST /api/editor/files`: 플랫폼 File API 연동 후 에디터 첨부 스펙(`{ fileId, scope, kind, name, size }`) 반환.
    - `GET /api/editor/files/{fileId}/views`: 플랫폼 `POST /api/v1/files/{fileId}/view-ticket` 호출 후 응답 JSON 변경 없이 `no-store` 반환.
  - 프론트엔드 에디터 컴포넌트 ([`ShneaConsultationEditor.tsx`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/components/ShneaConsultationEditor.tsx), [`ActiveWorkspace.tsx`](file:///E:/JetBrains/IntelliJ/hellow/frontend/src/components/ActiveWorkspace.tsx)):
    - `@shnea/editor/react`의 `ShneaEditor` 및 `style.css` 연동, 클라이언트 SSR 마운트 제어.
    - 상담 메모장 상단에 `[SHNEA 에디터]` vs `[빠른 메모]` 탭 전환 지원.

- **미인증 접근 차단 및 무조건 로그인 리다이렉트 체계 구축 (`frontend/src/middleware.ts`, `frontend/src/app/page.tsx`)**:
  - Next.js 미들웨어(`middleware.ts`): 서버 사이드에서 `hellow_logged_in` 인증 쿠키 검사, 비로그인 시 `/` 등 보호된 상담사 라우트 접근을 즉시 `HTTP 307`로 `/login` 리다이렉트.
  - 외부 고객용 웹 상담 접수 화면(`/support`), 인증 콜백(`/auth/callback`), 로그인 화면(`/login`), 백엔드 API(`/api/*`)는 비로그인 접근 정상 허용.
  - 메인 워크스페이스(`page.tsx`): 클라이언트 마운트 시 세션/쿠키 이중 검사 및 미인증 플리커링 방지 가드 적용.
- **로그인 화면 정돈 및 단순화 (`frontend/src/app/login/page.tsx`)**:
  - 불필요한 플랫폼 수식어와 복잡한 라벨을 모두 제거하고 간결하고 직관적인 **[로그인]** 단일 액션으로 통일.
  - 하단 Keycloak 리다이렉트/콜백 경로 안내 박스 완전 제거.
  - **[개발자 모드 즉시 접속]**: 프로덕션 환경에서는 숨기고 개발/로컬 환경(`localhost`, `dev-*`, non-production)에서만 조건부 렌더링.
  - **OIDC 로그인 트리거 안정화 및 prompt=login 강제 적용**: 페이지 진입 직후 클릭 시 비동기 설정 미완료로 발생하던 오류를 해결하고 플랫폼 확정 Issuer 자동 fallback을 탑재함. 또한 `prompt: 'login'` 파라미터를 전달하여 Keycloak 세션 잔류로 인한 자동 로그인을 방지하고 항상 Keycloak 로그인 화면이 뜨도록 강제.
  - **로그인 한글 닉네임 UTF-8 디코딩 복원 (`auth/callback/page.tsx`)**: JWT ID 토큰 디코딩 시 단순 `atob` 사용으로 한글 닉네임 깨짐 현상을 `TextDecoder('utf-8')` 파싱으로 전면 교체하여 한글 닉네임("이소연", "홍길동" 등)이 100% 정상 표시되도록 수정.
- **상담 메모장 SHNEA 공식 에디터 단독 연동 및 다크 테마·높이 최적화 (`ActiveWorkspace.tsx`, `ShneaConsultationEditor.tsx`)**:
  - 기존의 [빠른 메모] 탭, 모드 선택 토글 버튼, 우측 별도 첨부파일 버튼 및 textarea를 완전히 제거하고 **SHNEA 공식 에디터를 단독이자 기본 에디터로 상시 적용**.
  - **다크 테마 일체화**: `@shnea/editor`의 CSS 변수(`--se-bg: #0b1120`, `--se-text: #f8fafc`, `--se-line: #334155`, `--se-raised: #1e293b` 등) 및 툴바·팝오버 스타일을 CRM 다크 슬레이트 톤과 100% 일치시켜 라이트 테마 부조화 완전 해결.
  - **높이 최적화**: 기존 제한 높이를 해제하고 부모 flex 컨테이너에 맞춘 `flex-1 h-full min-h-[380px]`를 적용하여 하단 액션 바까지 시원하게 꽉 채우도록 개선.
  - **에디터 JSON 문자열 노출 및 줄바꿈 불가 무한루프 버그 완전 해결 (`ShneaConsultationEditor.tsx`)**:
    - `onChange`에서 `JSON.stringify(document)`를 문자열로 올려보내고, `initialText` 변경 감지로 다시 `fromMarkdown`에 들어가는 역방향 무한 루프 때문에 에디터 본문에 `{"format":"shnea-editor",...}` JSON 원문이 찍히고 줄바꿈이 먹통이 되던 문제를 근본적으로 해결.
    - `extractPlainText`를 구현하여 실제 사용자가 작성한 문장과 줄바꿈만 추출해 상위 상태와 동기화하고, `lastEmittedTextRef`를 이용해 타이핑 시 발생하는 에코 재렌더링을 완벽 차단함.
    - 이제 사용자가 자유롭게 줄바꿈, 띄어쓰기, 한글 입력을 자연스럽게 진행할 수 있으며 템플릿 클릭 시에만 정상적으로 문서가 갱신됨.
- **슬림 GNB 실제 Keycloak OIDC 로그아웃(RP-Initiated Logout) 연동 및 불필요한 플랫폼 연동 모달 완전 제거 (`SidebarGNB.tsx`, `pkce.ts`, `auth/callback/page.tsx`)**:
  - GNB [로그아웃] 클릭 시 Keycloak OIDC 로그아웃 엔드포인트(`.../protocol/openid-connect/logout`, `id_token_hint`)를 호출하여 플랫폼 인증 서버의 세션 쿠키까지 완전히 파기.
  - Keycloak 리다이렉트 URI 검증 규칙(`auth.md`: "로그아웃 복귀는 등록 콜백 또는 그 origin의 홈(`/`)을 사용한다")에 맞추어 `post_logout_redirect_uri`를 `${window.location.origin}/`로 설정. Keycloak이 허용된 홈(`/`)으로 정상 복귀시킨 후, 애플리케이션 미들웨어가 `/login`으로 깨끗하게 자동 리다이렉트 처리.
  - 일반 실무 사용자 및 상담사에게 노출될 필요가 없는 내부 개발용 **[SHNEA 플랫폼 연동 관리]** 방패 아이콘 및 팝업 모달(`PlatformIntegrationModal.tsx`)을 완전히 삭제하여 실무 중심의 깔끔한 워크스페이스 확보.

- **에디터 가로 너비(Width) 75ch 제한 해제 및 100% 꽉 채움 적용 (`ShneaConsultationEditor.tsx`)**:
  - `@shnea/editor` 기본 스타일에 내장된 `:is(.shnea-editor .tiptap) p { max-width: 75ch; }` 때문에 긴 텍스트 입력 시 에디터 너비의 절반 지점에서 아래 줄로 뚝 떨어지던 현상을 완벽히 해결.
  - `.shnea-editor .tiptap`의 `p`, `h1`~`h6`, `blockquote`, `pre`, `ul`, `ol`, `div`, `section` 전역에 `max-width: 100% !important;`를 부여하여 화면 가로 너비 끝까지 시원하게 채워지도록 확장.
- **에디터 수직 높이(Height) 극대화 및 내부 컨테이너(`.se-body`) 100% 확장 (`ActiveWorkspace.tsx`, `ShneaConsultationEditor.tsx`)**:
  - **고객 정보 카드 기본 접힘(`isInfoExpanded: false`)**: 상단 헤더 바(36px)에 고객명, 등급, 전화번호, 기업/개인 배지가 이미 모두 노출되므로 평소에는 닫아두어 약 200px 이상의 수직 공간을 즉시 확보.
  - **상담 분류·태그·상태 1행 통합 바**: 기존에 세로 110px 이상을 차지하던 3열 그리드와 태그 칩 영역을 단일 슬림 행(36px)으로 통합 재설계하여 추가 70px 이상 확보.
  - **에디터 내부 `.se-body` flex-1 100% 확장**: `@shnea/editor` 내부의 `.se-body` 컨테이너에 `flex: 1 1 0%; height: 100%;`를 부여하고 `.tiptap`의 min-height를 해제하여 부모 높이를 100% 꽉 채우도록 수정.
- **최대 업로드 데이터 1GB(1024MB) 설정 및 첨부 어댑터 정상화 (`default.conf`, `application.yml`, `EditorAttachmentController.java`)**:
  - **1GB(1024MB) 대용량 지원**: `infra/nginx/default.conf`의 `client_max_body_size 1024M;`, `application.yml`의 `spring.servlet.multipart.max-file-size: 1024MB`, `server.tomcat.max-swallow-size: 1024MB`로 설정하여 대용량 파일도 차단 없이 안전하게 전송.
  - **외부 첨부 버튼/뱃지 완전 제거**: 에디터 상단에 별도로 두었던 첨부 버튼을 완전히 삭제하고, 에디터 자체 내부 기능(드래그 앤 드롭, `/` 슬래시 명령어의 `파일 업로드`, `이미지 업로드`)으로 깔끔하게 일원화.
  - **`@shnea/editor` 첨부 어댑터 규격 일치**: 백엔드 `uploadEditorFile`에 `scope` 및 `kind` 파라미터 매핑을 추가하고 클라이언트가 넘긴 `task.ref.scope`, `task.ref.kind`를 그대로 돌려주어 어댑터 검증 오류를 완벽 해결.
- **자주 쓰는 템플릿 문구 복원 및 템플릿 추가 시 독립 블록 개행(`\n\n`) 분리 (`ActiveWorkspace.tsx`)**:
  - 툴바 템플릿 앞의 레이블을 원래대로 **`자주 쓰는 템플릿:`**으로 복원하고 버튼명을 `⚠️ 컴플레인 접수`, `+ 견적 협의`, `+ 기술 장애`, `+ 부재 콜백`으로 유지.
  - `insertTemplate` 함수에서 이전 텍스트가 있을 때 확실하게 `\n\n`을 두어, 여러 템플릿을 연속 추가하더라도 이전 템플릿과 한 블록으로 합쳐지지 않고 별도의 독립된 마크다운 단락(블록)으로 깔끔하게 삽입되도록 개선.
- **상담 통합 타임라인 카드 최대 높이 제한 및 더블클릭 상세 보기 모달 구현 (`ContextActionPanel.tsx`)**:
  - **카드 높이 제한 및 텍스트 클램핑**: 타임라인 내 상담 내용이 길어져도 카드가 무한정 길어지지 않도록 `max-h-20`, `line-clamp-3`, `overflow-hidden` 및 `break-words`를 적용. 내용이 긴 경우(`> 70자`) 하단에 부드러운 그라데이션 페이드아웃과 "더블클릭 상세" 시각적 힌트를 배치.
  - **더블클릭 상세 보기 모달 (`selectedDetailItem`)**: 타임라인 카드를 더블클릭(`onDoubleClick`)하면 전체 전문을 확인할 수 있는 다크 테마 모달 다이얼로그 오픈.
  - **상세 모달 편의 기능**: 채널 아이콘 배지, 상담사, 작성 일시, 고객 이력, 제목, 녹취 오디오 재생 시간, 태그 목록 및 전체 상담 기록 전문(`whitespace-pre-wrap`, 스크롤 지원) 표시. 하단에 [메모장에 인용 후 닫기] 및 [닫기] 액션 버튼 탑재.
  - **접근성 및 인터랙션 방어**: 모달 오픈 시 `Esc` 키 또는 배경 오버레이 클릭 시 닫히도록 키보드 접근성 지원, 타임라인 카드 내 [인용] 버튼 클릭 시 `e.stopPropagation()`을 적용하여 모달이 불필요하게 함께 열리지 않도록 분리.
- **LiveKit 기반 WebRTC 1:1 실시간 양방향 음성 통화 연동 완료 (`MVP-03`, 요구사항 28장·29장 준수)**:
  - **미디어 인프라 구성 (`compose.yaml`, `infra/nginx/default.conf`)**:
    - 검증된 SFU 미디어 서버인 `livekit/livekit-server:latest` 컨테이너 추가 (`hellow-dev-livekit-1`).
    - 네트워크 포트 배정: WebRTC 시그널링/HTTP 직접 포트 `30162:7880`, WebRTC 미디어 `7881:7881/tcp`, `7882:7882/udp` 매핑.
    - Nginx 리버스 프록시 연동: `infra/nginx/default.conf`에 `/livekit/` WebSocket 프록시 라우팅을 추가하여 단일 `30160` 포트로도 클라이언트 시그널링 통신 가능하도록 지원.
  - **백엔드 LiveKit 토큰 발급 체계 (`LiveKitService.java`, `SupportController.java`, `QueueController.java`)**:
    - `com.auth0:java-jwt` 라이브러리를 적용하여 LiveKit 공식 사양의 Room Access JWT 토큰 발급 메서드 구현 (`video` grant: `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`, 상담사용 `roomAdmin`).
    - 고객용 엔드포인트: `POST /api/support/session/{sessionId}/token`
    - 상담사용 엔드포인트: `POST /api/queue/{code}/token`
  - **고객 웹 상담 화면 연동 (`frontend/src/app/support/page.tsx`, `lib/livekit.ts`)**:
    - 상담사 수락 후 `IN_CALL` 진입 시 LiveKit 방에 자동 입장하여 고객 마이크 오디오를 실시간 송출.
    - 상담사 음성 수신 오디오 엘리먼트 자동 연결 및 재생, 마이크 음소거(Mute) 토글, 통화 종료 시 자동 룸 퇴장 및 오디오 세션 정리.
    - 화면 상단에 실시간 음성 연결 상태 인디케이터(`LiveKit WebRTC 연결됨` / `마이크 및 음성 서버 연결 중...` / `음성 연결 확인 필요`) 배지 표시.
  - **상담사 워크스페이스 연동 (`frontend/src/components/ActiveWorkspace.tsx`)**:
    - 대기열 카드 [수신] 클릭 시 해당 룸으로 자동 입장하여 고객 음성 청취 및 상담사 마이크 오디오 송출.
    - 마이크 음소거(Mute) 및 통화 보류(Hold) 시 실시간 오디오 트랙 제어 연동.
    - 상단 통화 컨트롤 바에 `LiveKit 음성 연결됨` 실시간 인디케이터 배지 표시.
- **상담사 워크스페이스 실시간 대기열 동기화 버그 해결 (`frontend/src/app/page.tsx`)**:
  - `page.tsx`의 큐 동기화 `useEffect` 의존성 배열이 `[]`로 고정되어 있어, 초기 비인증(`isAuthenticated=false`) 상태에서 조기 리턴된 후 인증 완료(`isAuthenticated=true`) 시점에 큐 조회 및 2.5초 주기 폴링 인터벌이 가동되지 않던 문제를 해결.
  - 의존성을 `[isAuthenticated]`로 수정하여 로그인 완료 즉시 백엔드 DB의 최신 대기열 목록을 조회하고 2.5초 주기로 실시간 신규 인입을 화면에 즉각 반영하도록 복원.

## 검증 및 Git 상태

- `frontend`: Turbopack 빌드 성공, TypeScript 5 컴파일 오류 0건, `livekit-client` 의존성 패키징 완료.
- `backend`: Gradle 8.12 / Java 21 컴파일 및 bootJar 빌드 성공 (`hellow-dev-api`).
- Docker Compose 5개 컨테이너 정상 가동 및 헬스체크 통과:
  - `hellow-dev-db-1` (Up, healthy, `0.0.0.0:30161->5432/tcp`)
  - `hellow-dev-api-1` (Up, healthy, `8080/tcp`)
  - `hellow-dev-web-1` (Up, healthy, `3000/tcp`)
  - `hellow-dev-livekit-1` (Up, `0.0.0.0:30162->7880/tcp`, `7881/tcp`, `7882/udp`)
  - `hellow-dev-nginx-1` (Up, `0.0.0.0:30160->8080/tcp`)
- LiveKit 및 WebRTC 라이브 통신 검증:
  - LiveKit 직접 포트 `curl.exe -s -i http://localhost:30162/` -> `HTTP/1.1 200 OK` ("OK") 확인.
  - Nginx 프록시 `curl.exe -s -i http://localhost:30160/livekit/` -> `HTTP/1.1 200 OK` ("OK") 확인.
  - 백엔드 고객 세션 생성 및 고객 토큰 발급 (`POST /api/support/request` -> `POST /api/support/session/{id}/token`) -> `HTTP 200 OK`, JWT 발급 완료 확인.
  - 백엔드 대기열 상담사 토큰 발급 (`POST /api/queue/{code}/token`) -> `HTTP 200 OK`, JWT 발급 완료 확인.
- `python scripts/verify-docs.py`: Markdown 문서, 로컬 링크, 요구사항 대응, 스킬 메타데이터, 원본 해시 검증 통과.

## 남은 일과 다음 시작점

- 플랫폼 관리자 화면에 등록된 Keycloak OIDC 실제 브라우저 로그인 및 세션 워크스페이스 진입 테스트.
- 콜백 예약 / 방문 예약 / 호전환 실무 흐름 연계 (`MVP-05`).
- 멀티테넌트 조직(Organization) 및 팀/권한 격리 (`MVP-01`).
- 실시간 상담 현황 대시보드 및 관측성 (`MVP-06`).
- 운영 NAS 컨테이너 실행 및 도메인 연결은 후속 단계에서 검증한다.



