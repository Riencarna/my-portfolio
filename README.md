# My Portfolio

자산 관리 대시보드 (순수 HTML/CSS/JS, PWA 지원).
- 배포 주소: https://riencarna.github.io/my-portfolio/
- 기술: 프레임워크 없음, 정적 사이트

---

## 🖥️ 로컬에서 미리보기 (push 전 테스트)

GitHub에 push하기 **전에** 내 컴퓨터에서 먼저 확인하는 방법입니다.
주요 기능(API 호출, Service Worker, PWA)은 `file://`로 열면 작동하지 않기 때문에 **반드시 로컬 서버**가 필요합니다.

### 1단계 — 터미널을 프로젝트 폴더에서 열기

가장 쉬운 방법: 프로젝트 폴더 창의 **주소창에 `cmd` 입력 후 Enter**.

### 2단계 — 서버 실행

```bash
python -m http.server 8000
```

> **파이썬이 없다고 나오면?** 터미널에 `python --version` 입력해서 확인.
> 없으면 https://www.python.org/downloads/ 에서 설치 (설치 시 **Add Python to PATH** 체크 필수).

> 실행 중인 창은 그대로 두세요. 닫으면 서버가 꺼집니다.
> 종료할 때는 터미널에서 **Ctrl+C**.

### 3단계 — 브라우저에서 열기

```
http://localhost:8000
```

### 4단계 — 수정 후 확인

파일 저장 → 브라우저에서 **Ctrl+Shift+R** (강제 새로고침).

---

## ⚠️ Service Worker 캐시 함정

"분명히 고쳤는데 반영 안 됨" 현상이 나오면 대부분 Service Worker 캐시 때문입니다.

**해결 순서:**
1. F12 눌러서 개발자도구 열기
2. **Application** 탭 → 왼쪽 **Service Workers** → **Unregister** 클릭
3. 왼쪽 **Storage** → **Clear site data** 클릭
4. 페이지 새로고침

개발 중에는 **Application → Service Workers → "Update on reload" 체크**해두면 매번 자동 갱신됩니다.

---

## ✅ push 전 체크리스트

- [ ] 주식/코인/USDT 가격 업데이트 동작
- [ ] 자산 추가/수정/삭제 동작
- [ ] 브라우저 콘솔(F12 → Console)에 빨간 에러 없음
- [ ] 라이트/다크 테마 둘 다 확인
- [ ] 바텀 네비 / 사이드바 이동 정상

---

## 🔢 버전 올리기

수동으로 17곳 고치지 말 것. 자동화 스크립트 사용:

```bash
node bump.js patch     # 버그 수정 (5.13.1 → 5.13.2)
node bump.js minor     # 기능 추가 (5.13.1 → 5.14.0)
node bump.js --dry patch   # 미리보기만
```

자세한 규칙은 `CLAUDE.md` 참조.
