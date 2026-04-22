# My Portfolio — 프로젝트 작업 가이드

> 이 파일은 Claude가 매 세션 시작 시 자동으로 읽는 프로젝트 규칙 문서입니다.
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

## 재발 방지 로드맵

메모리 `project_recurring_patterns.md` 참조. 진행 상태:
- [x] #1 Silent Fallback 감지 (v5.12.0)
- [x] #2 캐시 배관도 체크리스트 (이 문서)
- [x] #3 버전 bump 자동화 스크립트 (`bump.js`, v5.12.0)
- [x] #4 로컬 dev server 명령 README화 (`README.md`)
