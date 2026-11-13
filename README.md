# Taskbar Office for Orca

> A pixel-art office that lives on your Windows taskbar. Every [Orca](https://orca.dev) agent session is a little worker: they sit at a desk while working, wave when they need you, and stand with a green check until you look at the result. Then they head to the lounge for coffee.

Orca에서 돌아가는 에이전트 세션을 Windows 작업표시줄 위의 작은 픽셀아트 사무실로 보여주는 위젯입니다.

> **Orca 공식 프로젝트가 아닙니다.** Orca CLI(`orca worktree ps --json`)의 출력을 읽어 동작하는 개인 프로젝트라, Orca 업데이트로 출력 형식이 바뀌면 동작하지 않을 수 있습니다.

Orca 안의 패널로 사무실을 보여주는 플러그인([Office Tycoon](https://orca.dev/plugins/palulabs/orca-tycoon))도 있습니다. Taskbar Office는 Orca 창을 보고 있지 않을 때도 작업표시줄 위에서 곁눈질로 상태를 확인하는 독립 위젯입니다.

세션 하나가 캐릭터 한 명입니다. 작업을 시작하면 왼쪽 오피스의 자리에 앉아 일하고, 끝나면 자리에서 결과 표시를 띄우고 기다리다가, 확인하면 오른쪽 라운지로 가서 커피를 마시거나 수다를 떨거나 운동을 합니다.

## 필요한 것

- Windows 10/11
- Orca 데스크톱 앱 (실행 중이어야 세션이 보입니다). Orca 1.4.255에서 확인했습니다.
- 소스에서 실행하려면 Node.js. Node 24에서 개발하고 확인했습니다.

## 실행

### 설치 파일로

[Releases](https://github.com/syjeon121/orca-taskbar-office/releases)에서 받은 `Taskbar Office Setup <버전>.exe`를 실행하면 설치되고 바로 뜹니다. 서명이 없어서 Windows가 "알 수 없는 게시자" 경고를 띄울 수 있습니다.

직접 만들려면 아래 "설치 파일 만들기"를 참고하세요.

### 소스에서

```powershell
npm install
npm start
```

`npm start`는 빌드한 뒤 앱을 띄웁니다. 터미널을 닫으면 앱도 꺼집니다.

설치본과 소스 실행은 같은 설정을 쓰고, 동시에 하나만 실행됩니다. 이미 떠 있으면 새로 실행해도 창이 생기지 않습니다.

## 화면 읽는 법

```
│ 공용테이블 화이트보드 빈백 스탠딩 책상 │문│ 커피 수다테이블 소파 화분 헬스장 │
│        오피스 (일하는 세션)               │  │      라운지 (쉬는 세션)          │
```

| 세션 상태 | 캐릭터 | 말풍선 |
|---|---|---|
| 작업 중 | 오피스 자리에서 타이핑. 화면이 켜짐 | 사용 중인 도구 아이콘과 `...`이 번갈아 |
| 내 응답을 기다림 (권한 요청, 질문) | 자리에서 손 흔들기 | 빨간 `!` |
| 방금 완료 | 만세 후 자리에 서서 기다림. 확인하면 라운지로 | 초록 바탕의 흰 체크 |
| 실패 | 머리를 긁적인 뒤 자리에서 기다림. 확인하면 라운지로 | 빨간 `X` |
| 중단 | 머리를 긁적인 뒤 자리에서 기다림. 확인하면 라운지로 | 회색 일시정지 |
| 쉬는 중 | 라운지에서 커피, 수다, 소파, 운동, 서성이기 | 수다 중일 때만 줄글 말풍선 |

- **외형**(피부색, 머리 모양과 색, 옷 색과 무늬, 모자, 수염)은 세션마다 다르고, 같은 세션은 항상 같습니다. 에이전트 종류는 툴팁의 배지 색으로 구분합니다.
- **결과 표시**는 확인할 때까지 사라지지 않습니다. 캐릭터를 클릭하거나 Orca에서 그 세션을 읽으면 내려가고, 캐릭터는 라운지로 갑니다.
- **끝났지만 Orca에서 아직 확인하지 않은 세션**은 퇴근하지 않습니다.
- **끝난 세션**은 퇴근 기준 시간이 지나면 문으로 나가 사라집니다. 새 세션은 문으로 들어옵니다.
- 도구 아이콘은 터미널, 편집, 읽기, 검색, 웹, 에이전트 여섯 종류입니다.

## 조작

| 동작 | 결과 |
|---|---|
| 캐릭터에 커서 올리기 | 외곽선이 노랗게 바뀌고, 워크스페이스·대화 제목·상태·마지막 응답이 담긴 툴팁이 뜸 |
| 캐릭터 클릭 | Orca 창이 앞으로 오면서 그 세션의 워크스페이스가 열림 |
| 띠의 왼쪽/오른쪽 끝 끌기 | 폭 조절. 놓으면 저장됨 |
| 트레이 아이콘 좌클릭 | 띠 보이기/숨기기 |
| 트레이 아이콘 우클릭 | 메뉴 |

띠의 빈 공간은 클릭이 뒤 창으로 그대로 통과합니다. 클릭을 받는 곳은 캐릭터와 양 끝 8px뿐입니다.

클릭으로 열리는 것은 워크스페이스까지입니다. Orca에 세션 탭을 직접 여는 명령이 없어서, 한 워크스페이스에 세션이 여러 개면 탭은 직접 골라야 합니다.

## 트레이 메뉴

| 항목 | 설명 |
|---|---|
| 오피스 보이기 | 띠 표시 여부 |
| 크기 | 픽셀 확대 배율 2~6배. 띠 높이는 35px × 배율 |
| 폭 | 전체, 3/4, 절반, 1/3 |
| 위치 | 왼쪽, 가운데, 오른쪽. 끝을 끌어 정한 위치는 "직접 조절"로 표시 |
| 모니터 | 띠를 띄울 모니터. 그 모니터가 분리되면 주 모니터로 돌아옴 |
| 퇴근 기준 | 작업이 끝난 뒤 사라지기까지의 시간: 10분, 30분, 1시간, 3시간, 하루, 퇴근시키지 않음 |
| 최대 인원 | 쉬는 세션까지 포함한 상한: 6, 12, 20, 30명. 일하거나 확인을 기다리는 세션은 상한을 넘어도 표시 |
| Windows 시작 시 실행 | 로그인할 때 자동 실행 |
| (상태 줄) | Orca 연결 상태, 원격 수, 작업 중 수, 표시/전체 수 |
| 원격 환경 | Orca에 저장된 원격 환경별 표시 여부 |
| 데모 모드 | Orca 대신 가짜 세션으로 동작 |
| 데모 조작 | 데모 모드에서 출근, 작업 시작, 응답 대기, 완료, 실패, 중단, 퇴근을 하나씩 실행 |
| 종료 | 앱 종료 |

설정은 `%APPDATA%\orca-taskbar-office\settings.json`에 저장됩니다. 예전 이름(Agent Office)의 설정 `%APPDATA%\agent-office\settings.json`이 있으면 처음 한 번 그대로 읽어 옵니다.

## 원격 환경

Orca에 저장된 원격 환경(`orca environment list`)의 세션도 같은 사무실에 나옵니다. 환경 목록은 1분마다 다시 읽습니다. 툴팁의 워크스페이스 옆에 "원격 92"처럼 환경 이름이 붙습니다.

원격 캐릭터를 클릭하면 그 워크스페이스에 "Taskbar Office"라는 임시 터미널이 1~2초 떴다가 닫힙니다. Orca CLI에서 이 PC의 화면을 원격 워크스페이스로 옮기는 방법이 터미널 전환뿐이기 때문입니다.

## 개발

```powershell
npm run typecheck   # 타입 검사
npm run build       # dist/ 로 빌드
npm start           # 빌드 후 실행
```

### 구조

```
src/
├─ main/                 Electron 메인 프로세스
│  ├─ main.ts              시작점
│  ├─ window.ts            띠 창: 배치, 클릭 통과, 드래그 폭 조절
│  ├─ tooltip.ts           툴팁 창
│  ├─ tray.ts              트레이 아이콘과 메뉴
│  ├─ settings.ts          설정 저장/불러오기
│  ├─ orca-cli.ts          orca 명령 호출
│  ├─ orca-poller.ts       3초마다 세션 목록 조회 (로컬 + 원격)
│  ├─ orca-actions.ts      클릭 시 Orca에서 워크스페이스 열기
│  ├─ demo.ts              가짜 세션 공급원
│  ├─ source.ts            폴러와 데모 전환
│  ├─ session-hub.ts       현재 세션 목록 보관과 전달
│  └─ icon.ts              트레이 아이콘
├─ preload/              렌더러에 노출하는 API
├─ shared/types.ts       메인과 렌더러가 함께 쓰는 타입
└─ renderer/             Canvas 장면
   ├─ renderer.ts          프레임 루프, 마우스 입력
   ├─ office.ts            캐릭터 상태와 이동, 그리는 순서
   ├─ scene.ts             가구 배치 계산
   ├─ scene-art.ts         가구와 바닥 그리기
   ├─ sprites.ts           캐릭터와 말풍선 그리기
   ├─ pixel.ts             외곽선, 색 조절
   └─ tooltip.ts           툴팁 내용
assets/icon-pixels.json  아이콘 픽셀 데이터
scripts/make-icon.mjs    설치 파일용 아이콘 생성
docs/PLAN.md             계획, 결정 사항, 검증 기록
```

그림은 이미지 파일 없이 모두 코드로 그립니다. 가구 순서는 `scene.ts`의 `OFFICE_PATTERN`(오피스)과 `LOUNGE_PATTERN`(라운지)에서 바꿉니다.

세션 데이터는 `orca worktree ps --json`에서 옵니다. 상태 값과 필드 대응은 `docs/PLAN.md` 4장에 있습니다.

### 개발용 환경 변수

| 변수 | 동작 |
|---|---|
| `TASKBAR_OFFICE_DEMO=busy` | 가짜 세션 12명이 모두 작업 중인 상태로 고정 |
| `TASKBAR_OFFICE_DEMO=idle` | 가짜 세션 10명이 모두 쉬는 상태로 고정 |
| `TASKBAR_OFFICE_SNAPSHOT=<png 경로>` | 시작 몇 초 뒤 장면을 PNG로 저장. 화면을 직접 볼 수 없을 때 사용 |
| `TASKBAR_OFFICE_SNAPSHOT_DELAY=<ms>` | 스냅샷까지 기다릴 시간. 기본 7000 |

```powershell
$env:TASKBAR_OFFICE_DEMO = 'busy'; npm start
```

### 설치 파일 만들기

```powershell
npm run dist
```

`release\Taskbar Office Setup 0.1.0.exe`가 만들어집니다(약 115MB). 코드 서명은 하지 않습니다.

## 알려진 제약

- Windows 전용입니다.
- 상태 변화는 최대 3초 늦게 반영됩니다.
- 세션 탭까지는 이동하지 못하고 워크스페이스까지만 엽니다.
- 원격 환경은 세션별 읽음 정보가 없어, 읽지 않은 워크스페이스에서 가장 최근에 끝난 세션 하나를 읽지 않은 것으로 봅니다.
- 띠 양 끝 8px은 폭 조절 손잡이라 클릭이 뒤 창으로 통과하지 않습니다.
- 전체 화면 앱을 쓸 때 띠를 자동으로 숨기는 기능이 없습니다. 트레이 아이콘을 좌클릭해 직접 숨겨야 합니다.

## 라이선스

[MIT](LICENSE)
