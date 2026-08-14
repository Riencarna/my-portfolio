const fs = require('fs');
const vm = require('vm');

const configSource = fs.readFileSync('js/config.js', 'utf8');
const storeSource = fs.readFileSync('js/store.js', 'utf8');
let failures = 0;

function assert(label, condition) {
  if (condition) console.log(`✓ ${label}`);
  else {
    console.error(`✗ ${label}`);
    failures += 1;
  }
}

function tick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function createLocalStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); },
    _data: data,
  };
}

function createHarness(timerHarness = null) {
  const localStorage = createLocalStorage();
  localStorage.setItem('mp_storage_backend', 'indexeddb');
  const ctx = vm.createContext({
    console,
    Date,
    Math,
    JSON,
    Promise,
    localStorage,
    indexedDB: {},
    setTimeout: timerHarness?.setTimeout || setTimeout,
    clearTimeout: timerHarness?.clearTimeout || clearTimeout,
    showToast: (message, type) => ctx.__toasts.push({ message, type }),
    calcTotal: () => 0,
    calcCategoryTotals: () => ({}),
    invalidateCalcCache: () => {},
    sanitizeAsset: value => value,
    sanitizeIncome: value => value,
    safeNum: value => Number(value) || 0,
    stripHtml: value => String(value || ''),
    today: () => '2026-08-14',
    uid: () => 'test-id',
  });
  ctx.__toasts = [];
  ctx.__savedEvents = [];
  vm.runInContext(configSource, ctx, { filename: 'js/config.js' });
  vm.runInContext(storeSource, ctx, { filename: 'js/store.js' });
  vm.runInContext(`
    _idbAvailable = true;
    tryAutoBackup = () => false;
    EventBus.on('dataSaved', payload => globalThis.__savedEvents.push(payload));
  `, ctx);
  return ctx;
}

async function testSequentialQueue() {
  console.log('\n[IndexedDB 저장 순서]');
  const ctx = createHarness();
  ctx.__writes = [];
  ctx.__resolvers = [];
  ctx.__idbSet = (key, value) => new Promise(resolve => {
    ctx.__writes.push({ key, value });
    ctx.__resolvers.push(resolve);
  });
  vm.runInContext('_idbSet = (key, value) => globalThis.__idbSet(key, value)', ctx);

  const pA = vm.runInContext(`appState.assets = [{ name: 'A' }]; saveDataNow()`, ctx);
  const pB = vm.runInContext(`appState.assets = [{ name: 'B' }]; saveDataNow()`, ctx);
  const pC = vm.runInContext(`appState.assets = [{ name: 'C' }]; saveDataNow()`, ctx);

  await tick();
  assert('첫 저장이 끝나기 전에는 다음 저장을 시작하지 않음', ctx.__writes.length === 1);
  assert('실제 완료 전 appState.saved를 바꾸지 않음', vm.runInContext('appState.saved === null', ctx));

  ctx.__resolvers.shift()(true);
  await tick();
  assert('A 완료 후 B 저장 시작', ctx.__writes.length === 2);
  ctx.__resolvers.shift()(true);
  await tick();
  assert('B 완료 후 C 저장 시작', ctx.__writes.length === 3);
  ctx.__resolvers.shift()(true);
  const results = await Promise.all([pA, pB, pC]);

  const names = ctx.__writes.map(write => JSON.parse(write.value).assets[0].name);
  assert('저장 시작 순서가 A → B → C', names.join(',') === 'A,B,C');
  assert('마지막 저장 데이터가 최신 C', names.at(-1) === 'C');
  assert('세 작업 모두 실제 완료 후 성공', results.every(Boolean));
  assert('완료된 작업만 dataSaved 발행', ctx.__savedEvents.length === 3);
  assert('최종 전역 상태가 저장됨', vm.runInContext(`getSaveStatus().state === 'saved'`, ctx));
}

async function testFailureAndRecovery() {
  console.log('\n[저장 실패와 복구]');
  const ctx = createHarness();
  let attempt = 0;
  ctx.__idbSet = () => {
    attempt += 1;
    return attempt === 1 ? Promise.reject(new Error('disk unavailable')) : Promise.resolve(true);
  };
  vm.runInContext(`
    _idbSet = (key, value) => globalThis.__idbSet(key, value);
    appState.saved = '2026-08-01T00:00:00.000Z';
    appState.assets = [{ name: '실패 데이터' }];
  `, ctx);

  const failed = await vm.runInContext('saveDataNow()', ctx);
  assert('IndexedDB 실패 결과는 false', failed === false);
  assert('실패 시 dataSaved 미발행', ctx.__savedEvents.length === 0);
  assert('실패 시 이전 정상 저장 시각 유지', vm.runInContext(`appState.saved === '2026-08-01T00:00:00.000Z'`, ctx));
  assert('저장 실패 상태를 유지', vm.runInContext(`getSaveStatus().state === 'error'`, ctx));
  assert('실패 안내에서 JSON 백업을 안내', ctx.__toasts.some(item => item.message.includes('JSON 백업')));

  vm.runInContext(`appState.assets = [{ name: '복구 데이터' }]`, ctx);
  const recovered = await vm.runInContext('saveDataNow()', ctx);
  assert('다음 저장 성공', recovered === true);
  assert('성공 후 저장됨 상태로 복구', vm.runInContext(`getSaveStatus().state === 'saved'`, ctx));
  assert('복구 성공 후 dataSaved 1회 발행', ctx.__savedEvents.length === 1);
}

async function testDebounceAndFlush() {
  console.log('\n[연속 수정과 백그라운드 직전 저장]');
  let timerId = 0;
  const timers = new Map();
  const timerHarness = {
    setTimeout(fn) { timerId += 1; timers.set(timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const ctx = createHarness(timerHarness);
  ctx.__writes = [];
  ctx.__idbSet = (key, value) => {
    ctx.__writes.push({ key, value });
    return Promise.resolve(true);
  };
  vm.runInContext('_idbSet = (key, value) => globalThis.__idbSet(key, value)', ctx);

  for (let i = 1; i <= 20; i += 1) {
    vm.runInContext(`appState.assets = [{ name: '수정 ${i}' }]; saveData()`, ctx);
  }
  assert('20회 연속 수정이 타이머 1개로 합쳐짐', timers.size === 1);
  assert('대기 중 상태 표시', vm.runInContext(`getSaveStatus().state === 'pending'`, ctx));

  await vm.runInContext('flushPendingSave()', ctx);
  assert('백그라운드 전환용 flush가 즉시 1회 저장', ctx.__writes.length === 1);
  assert('flush 저장값이 마지막 수정 20', JSON.parse(ctx.__writes[0].value).assets[0].name === '수정 20');
  assert('flush 뒤 예약 타이머 제거', timers.size === 0);
}

async function testPortfolioIsolation() {
  console.log('\n[포트폴리오별 스냅샷 분리]');
  const ctx = createHarness();
  ctx.__writes = [];
  ctx.__idbSet = (key, value) => {
    ctx.__writes.push({ key, value });
    return Promise.resolve(true);
  };
  vm.runInContext('_idbSet = (key, value) => globalThis.__idbSet(key, value)', ctx);

  const pA = vm.runInContext(`activePortfolioId = 'A'; appState.assets = [{ name: '자산 A' }]; saveDataNow()`, ctx);
  const pB = vm.runInContext(`activePortfolioId = 'B'; appState.assets = [{ name: '자산 B' }]; saveDataNow()`, ctx);
  await Promise.all([pA, pB]);

  assert('A와 B 저장 키가 분리됨', ctx.__writes[0].key.endsWith('_A') && ctx.__writes[1].key.endsWith('_B'));
  assert('A 스냅샷에 A 데이터만 포함', JSON.parse(ctx.__writes[0].value).assets[0].name === '자산 A');
  assert('B 스냅샷에 B 데이터만 포함', JSON.parse(ctx.__writes[1].value).assets[0].name === '자산 B');
}

async function testPortfolioDeleteAndReset() {
  console.log('\n[삭제·초기화와 예약 저장]');
  let timerId = 0;
  const timers = new Map();
  const ctx = createHarness({
    setTimeout(fn) { timerId += 1; timers.set(timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  ctx.__ops = [];
  ctx.__idbSet = (key, value) => { ctx.__ops.push(`set:${key}`); return Promise.resolve(true); };
  ctx.__idbRemove = key => { ctx.__ops.push(`remove:${key}`); return Promise.resolve(true); };
  ctx.localStorage.setItem('mp_portfolio_meta', JSON.stringify({
    active: 'A',
    list: [{ id: 'default', name: '기본' }, { id: 'A', name: 'A' }],
  }));
  vm.runInContext(`
    _idbSet = (key, value) => globalThis.__idbSet(key, value);
    _idbRemove = key => globalThis.__idbRemove(key);
    activePortfolioId = 'A';
    appState.assets = [{ name: '삭제 전 최신값' }];
    saveData();
  `, ctx);

  const deleted = await vm.runInContext(`deletePortfolio('A')`, ctx);
  assert('활성 포트폴리오 삭제 성공', deleted === true);
  assert('예약 저장 완료 뒤 포트폴리오 키 삭제', ctx.__ops.join(',') === 'set:myportfolio_v9_A,remove:myportfolio_v9_A');
  assert('삭제 뒤 예약 타이머가 남지 않음', timers.size === 0);

  vm.runInContext(`appState.assets = [{ name: '초기화 전' }]; saveData()`, ctx);
  await vm.runInContext(`resetAllData({ skipSave: true })`, ctx);
  assert('전체 초기화는 예약 저장을 취소', timers.size === 0);
  assert('전체 초기화 후 메모리 데이터가 비어 있음', vm.runInContext('appState.assets.length === 0', ctx));
  assert('취소된 예약 저장이 IndexedDB에 다시 쓰지 않음', ctx.__ops.length === 2);
}

async function testLocalStorageCompletion() {
  console.log('\n[localStorage 기존 경로]');
  const ctx = createHarness();
  vm.runInContext(`
    _idbAvailable = false;
    appState.assets = [{ name: '로컬 저장' }];
  `, ctx);
  const saved = await vm.runInContext('saveDataNow()', ctx);
  const raw = ctx.localStorage.getItem('myportfolio_v9');
  assert('localStorage 저장도 Promise 완료 결과 true', saved === true);
  assert('localStorage에 최신 스냅샷 저장', JSON.parse(raw).assets[0].name === '로컬 저장');
  assert('localStorage 완료 후 dataSaved 발행', ctx.__savedEvents.length === 1);
}

function testUiContract() {
  console.log('\n[전역 저장 상태 UI 계약]');
  const appSource = fs.readFileSync('js/app.js', 'utf8');
  const cssSource = fs.readFileSync('css/styles.css', 'utf8');
  const historySource = fs.readFileSync('js/ui-history.js', 'utf8');
  const modalSource = fs.readFileSync('js/ui-modals.js', 'utf8');

  assert('저장 상태에 aria-live 적용', appSource.includes('aria-live="polite"') && appSource.includes('id="saveStatus"'));
  assert('저장 대기·저장 중·저장됨·저장 실패 문구 제공',
    ['저장 대기', '저장 중…', '저장됨', '저장 실패'].every(label => appSource.includes(label)));
  assert('저장 실패 상태에서 JSON 백업 화면으로 이동 가능', appSource.includes("action === 'open-save-backup'") && appSource.includes('backup-json'));
  assert('visibilitychange와 pagehide에서 flush', appSource.includes('visibilitychange') && appSource.includes('pagehide') && appSource.includes('flushPendingSave'));
  assert('모바일 헤더에서 저장 상태를 별도 줄에 배치', cssSource.includes('.save-status{grid-column:1/-1'));
  assert('JSON 복원은 실제 저장 완료를 기다림', historySource.includes('if (await importData(data))'));
  assert('자동 백업 복원도 실제 저장 완료를 기다림', modalSource.includes('if (await restoreAutoBackup(id))'));
}

(async () => {
  await testSequentialQueue();
  await testFailureAndRecovery();
  await testDebounceAndFlush();
  await testPortfolioIsolation();
  await testPortfolioDeleteAndReset();
  await testLocalStorageCompletion();
  testUiContract();

  if (failures) {
    console.error(`\n❌ 저장 안전성 테스트 ${failures}개 실패`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ 저장 안전성 테스트 통과');
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
