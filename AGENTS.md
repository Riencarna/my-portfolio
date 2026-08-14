# My Portfolio — 프로젝트 작업 가이드

> 이 파일은 Codex가 매 세션 시작 시 자동으로 읽는 프로젝트 규칙 문서입니다.
> 사용자도 수정 작업 직전에 한 번 훑어보면 됩니다.

## 작업 규칙 (요약)

- **한국어로 대화**. 사용자는 코딩 초보라 쉬운 설명 우선.
- **Creator → Evaluator → Creator** 사이클로 작업 (메모리 `feedback_team_mode.md`).
- **Evaluator는 사용자 관점**에서 실제 클릭/흐름/z-index를 시뮬레이션 (메모리 `feedback_evaluator_role.md`).
- 코드 수정 시 **버전 넘버 함께 bump**. 버그 수정은 patch(5.12.0 → 5.12.1), 기능 추가는 minor(5.12.0 → 5.13.0).

## 🔌 캐시/API 파이프라인 체크리스트 (⚠️ 중요)

이 체크리스트는 **v5.11.1에서 터진 stale 가격 회귀**를 반복하지 않기 위해 존재합니다. 가격 수집 관련 수정은 거의 모두 "한 군데 고쳤는데 다른 곳이 어긋남"에서 문제가 생겼습니다.

### 새 외부 API 도메인 추가 시 (예: 새 주식 가격 소스)

4곳 모두 건드려야 함. 하나라도 빼먹으면 회귀.

| # | 파일 | 무엇을 |
|---|---|---|
| 1 | `js/config.js` | `API` 객체에 엔드포인트 추가 |
| 2 | `index.html` | CSP `connect-src`에 도메인 추가 (안 하면 브라우저가 요청 차단) |
| 3 | `sw.js` | `API_HOSTS`에 호스트 추가 (안 하면 **cache-first로 빠져 stale 데이터 영구 고정**) |
| 4 | Cloudflare Worker | 프록시 경유 시 허용 도메인에 추가 (`reference_cloudflare_worker.md` 참조) |

### CORS 프록시 추가/변경 시 (v5.11.1의 원흉)

| # | 파일 | 무엇을 |
|---|---|---|
| 1 | `js/config.js` | `MY_PROXY_URL` 또는 `CORS_PROXIES` 갱신 |
| 2 | `index.html` | CSP `connect-src`에 프록시 도메인 |
| 3 | `sw.js` | `API_HOSTS`에 프록시 도메인 ← **v5.11.1 회귀 지점** |
| 4 | `js/api.js` | `corsFetch()` 사용처 점검 |

### 캐시 레이어 지도 (전체 4개)

가격 데이터가 지나가는 저장소입니다. 하나를 수정하면 **나머지에 어떤 영향이 있는지 반드시 질문**.

1. **Service Worker 캐시** (`sw.js`)
   - 위치: 브라우저 디스크
   - 전략: `API_HOSTS` 매칭되면 **network-first**, 아니면 **cache-first**
   - 함정: `API_HOSTS` 누락 = 영구 cache-first = stale

2. **인메모리 캐시** (`js/api.js`의 `cachedRate`, `cachedUsdt`, `cachedBenchmark`)
   - 위치: 앱 실행 중인 JS 힙
   - TTL: `CACHE_TTL_RATE` (10분), `CACHE_TTL_BENCH` (1시간) — `js/config.js`

3. **Cloudflare Edge 캐시**
   - 위치: Cloudflare Worker 서버 쪽
   - 제어: Worker 코드의 `Cache-Control` 헤더 설정
   - 함정: 우리가 직접 제어 안 하면 Cloudflare 기본 동작에 맡겨짐

4. **localStorage** (`amount`, `lpu`)
   - 위치: 브라우저 디스크 (도메인별 5MB 한도)
   - 역할: 가격 스냅샷과 마지막 업데이트 시각
   - 연관: v5.12.0 stale 감지 로직이 `lpu`를 읽음

## 🧪 Silent Fallback 방지 (v5.12.0)

`autoUpdateAll`이 "성공"으로 집계한 것이 실제로는 stale 가격일 수 있음. v5.12.0부터 **이전 가격 == 새 가격 AND lpu > 18시간 전**이면 `stale: true`로 마킹.

- 설정: `STALE_DETECT_MS` (`js/config.js`)
- 표시 위치: 업데이트 로그 ⚠️ 배지, 완료 토스트
- 새 가격 fetch 로직을 추가/변경할 때 **반드시 prev/new 비교 경로가 깨지지 않는지 확인**.

## 📝 버전 Bump — `bump.js` 자동화 스크립트 사용 (v5.12.0+)

**수동으로 17곳 고치지 말 것.** 프로젝트 루트의 `bump.js`가 대신 처리합니다.

```bash
node bump.js patch     # 5.12.0 -> 5.12.1 (버그 수정)
node bump.js minor     # 5.12.0 -> 5.13.0 (기능 추가)
node bump.js major     # 5.12.0 -> 6.0.0  (큰 변화)
node bump.js 5.12.5    # 명시 버전
node bump.js --dry patch   # 미리보기 (파일 수정 안 함)
```

### 스크립트가 건드리는 파일
- `index.html`, `css/styles.css`, `manifest.json`, `sw.js`
- `js/` 디렉토리의 모든 `.js` 파일

자기 자신(`bump.js`)은 제외. 기준 버전은 `js/config.js`의 `APP_VERSION`.

### 주의 (컨벤션)

피처 설명 주석에 버전 번호를 박지 말 것 (예: `// v5.12.0 stale 감지 추가`).
bump 시 함께 치환되어 "v5.12.1에 추가됐다"로 의미가 틀어집니다.
**피처가 어느 버전에 들어왔는지는 `git log`로 확인하세요.** 주석은 "무엇을 하는지"에 집중.

## 핵심 인프라 정보

- **저장소**: https://github.com/Riencarna/my-portfolio
- **배포**: GitHub Pages (legacy 모드, master branch, `/` path)
- **공개 URL**: https://riencarna.github.io/my-portfolio/
- **Cloudflare Worker**: `https://asset-manage-alpaca.wnsduf0306.workers.dev` — 주식 가격 CORS 프록시 (Origin/도메인 제한)

## 🚀 Git 커밋·푸시 진단 순서 (Codex Desktop)

이 저장소에서 사용자가 **커밋과 푸시만** 요청하면 PR 생성 절차로 확대하지 말고, 현재 브랜치와 사용자가 지정한 대상에 직접 `git` 작업을 수행합니다. 특히 `gh` CLI 인증과 `git push` 인증은 별개이므로, `gh auth status` 실패만으로 GitHub 로그인이 필요하다고 단정하지 않습니다.

1. `codex_app__load_workspace_dependencies`로 이 세션의 번들 Git 경로를 확인합니다.
2. `git remote get-url --push origin`과 `git branch --show-current`로 원격 저장소와 현재 브랜치를 확인합니다. 브랜치명이 비어 있는 detached HEAD 상태면 중단하고 사용자에게 알립니다.
3. `git status -sb`와 diff를 보고 요청 범위의 파일만 명시적으로 스테이징합니다. 기존 개인 설정·백업·스크린샷·미추적 파일은 자동 포함하지 않으며 `git add -A`를 사용하지 않습니다.
4. 스테이징 전후에 `git diff --cached --name-status`와 `git diff --cached`를 확인합니다. 이전부터 스테이징돼 있던 파일을 포함해 **최종 커밋에 들어갈 전체 범위**가 요청과 일치할 때만 커밋합니다.
5. 원격 연결은 먼저 `git push --dry-run origin <branch>`로 확인합니다.
6. 오류 메시지에 따라 원인을 구분합니다.
   - `gh` 토큰 만료: `gh`만의 문제일 수 있음. `git push` 인증 실패의 증거가 아님.
   - `git: 'remote-https' is not a git command`: 인증 문제가 아니라 Git HTTPS 도우미 경로 문제. 번들 Git 폴더에서 `git-remote-https.exe`를 찾고, 그 파일이 있는 디렉터리를 `git --exec-path=<dir> push ...`에 지정합니다.
   - `Failed to connect ... port 443`: 로그인 문제가 아니라 샌드박스/네트워크 차단 가능성이 큼. 동일한 Git 명령을 네트워크 권한 승인으로 다시 실행합니다.
   - HTTP 401 또는 자격 증명 거부: 실제 Git 인증 갱신이 필요한지 확인합니다.
   - HTTP 403 또는 권한 거부: 인증 만료로 단정하지 않고 저장소 쓰기 권한, 조직 SSO, 브랜치 보호와 ruleset 오류를 구분합니다.
   - non-fast-forward 또는 현재 브랜치 뒤처짐: 인증 문제가 아닙니다. 자동 pull/rebase나 강제 push를 하지 말고 상태와 충돌 가능성을 사용자에게 알립니다.
7. 커밋 후 같은 Git 실행 파일과 `--exec-path` 설정으로 푸시하고, `git status -sb`와 최신 커밋 해시로 완료를 확인합니다.

현재 번들 Git에서 `git --exec-path` 기본 위치에 HTTPS 도우미가 없고 `mingw64/bin`에만 있을 수 있습니다. 경로는 런타임 버전에 따라 달라지므로 절대경로를 문서에 고정하지 말고 매 세션 탐색합니다.

## 재발 방지 로드맵

메모리 `project_recurring_patterns.md` 참조. 진행 상태:
- [x] #1 Silent Fallback 감지 (v5.12.0)
- [x] #2 캐시 배관도 체크리스트 (이 문서)
- [x] #3 버전 bump 자동화 스크립트 (`bump.js`, v5.12.0)
- [x] #4 로컬 dev server 명령 README화 (`README.md`)
- [x] #5 Git 푸시 인증·도우미·네트워크 진단 순서 (이 문서)
