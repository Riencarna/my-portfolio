const fs = require('fs');
const vm = require('vm');

function assert(name, condition, detail = '') {
  if (!condition) {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${name}`);
}

const storage = new Map();
const ctx = vm.createContext({
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  Boolean,
  Map,
  Set,
  JSON,
  Intl,
  URL,
  Headers,
  Response,
  AbortController,
  Promise,
  isFinite,
  isNaN,
  parseInt,
  parseFloat,
  setTimeout,
  clearTimeout,
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  showToast: () => {},
  fetch: async () => { throw new Error('unexpected fetch'); },
  appState: { assets: [] },
  EventBus: { emit: () => {} },
  batchUpdatePrices: () => {},
});

for (const file of ['js/config.js', 'js/utils.js', 'js/api.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}

function fallbackResponse(body, { reason = 'server-error', status = '503', cachedAt = '2026-08-05T00:00:00.000Z' } = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-MP-Cache-Fallback': '1',
      'X-MP-Fallback-Reason': reason,
      'X-MP-Origin-Status': status,
      'X-MP-Cache-Stored-At': cachedAt,
    },
  });
}

(async () => {
  console.log('\n[캐시 폴백 메타데이터 전파]');

  const direct = fallbackResponse({ price: 100 });
  const directInfo = ctx.readCacheFallbackInfo(direct);
  assert('직접 응답에서 cache fallback marker 판독', directInfo?.reason === 'server-error');
  assert('직접 응답에서 원 서버 상태 판독', directInfo?.originStatus === '503');
  assert('직접 응답에서 캐시 저장 시각 판독', directInfo?.cachedAt === '2026-08-05T00:00:00.000Z');

  const allOrigins = ctx.createAllOriginsContentResponse({ contents: '{"ok":true}' }, direct);
  assert('AllOrigins 변환 후 fallback marker 보존', allOrigins.headers.get('X-MP-Cache-Fallback') === '1');
  assert('AllOrigins 변환 후 reason/status/cachedAt 보존',
    allOrigins.headers.get('X-MP-Fallback-Reason') === 'server-error'
      && allOrigins.headers.get('X-MP-Origin-Status') === '503'
      && allOrigins.headers.get('X-MP-Cache-Stored-At') === '2026-08-05T00:00:00.000Z');

  const coinMeta = ctx.createPriceFetchMeta();
  ctx.fetchWithTimeout = async () => fallbackResponse({ bitcoin: { krw: 100 }, ethereum: { krw: 200 } });
  const coinPrices = await ctx.fetchCoinPrices(['bitcoin', 'ethereum'], coinMeta);
  assert('코인 묶음 가격 파싱 정상', coinPrices.bitcoin === 100 && coinPrices.ethereum === 200);
  assert('코인 묶음 전체에 fallback 메타 귀속', coinMeta.cacheFallback && coinMeta.originStatuses[0] === '503');

  const domesticMeta = ctx.createPriceFetchMeta();
  ctx.corsFetch = async () => fallbackResponse({ datas: [{ closePriceRaw: 70000 }] });
  const domesticPrice = await ctx.fetchKoreanStockPrice('005930', domesticMeta);
  assert('국내주식 저장 가격 파싱 정상', domesticPrice === 70000);
  assert('국내주식 단일 요청에 fallback 메타 귀속', domesticMeta.cacheFallback);

  const foreignPriceMeta = ctx.createPriceFetchMeta();
  ctx.corsFetch = async () => fallbackResponse({ closePrice: '10' });
  ctx.fetchExchangeRate = async () => 1400;
  const foreignFromCachedPrice = await ctx.fetchForeignStockPrice('TEST', 'NASDAQ', foreignPriceMeta);
  assert('해외주식 fallback 가격 + live 환율 계산', foreignFromCachedPrice === 14000 && foreignPriceMeta.cacheFallback);

  const foreignFxMeta = ctx.createPriceFetchMeta();
  ctx.corsFetch = async () => new Response(JSON.stringify({ closePrice: '10' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  ctx.fetchExchangeRate = async (_force, meta) => {
    ctx.mergeCacheFallbackMeta(meta, { reason: 'server-error', originStatus: '502', cachedAt: '2026-08-04T00:00:00.000Z' });
    return 1400;
  };
  const foreignFromCachedFx = await ctx.fetchForeignStockPrice('TEST', 'NASDAQ', foreignFxMeta);
  assert('해외주식 live 가격 + fallback 환율 계산', foreignFromCachedFx === 14000 && foreignFxMeta.cacheFallback);

  console.log('\n[자동 업데이트 집계와 마지막 정상 시각]');
  const oldLpu = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  ctx.appState.assets = [
    { id: 'live-1', name: '최신1', category: '국내주식', stockCode: '1', market: 'KOSPI', amount: 100, lpu: oldLpu },
    { id: 'live-2', name: '최신2', category: '국내주식', stockCode: '2', market: 'KOSPI', amount: 200, lpu: oldLpu },
    { id: 'fallback-same', name: '저장동일', category: '국내주식', stockCode: '3', market: 'KOSPI', amount: 300, lpu: oldLpu },
    { id: 'fallback-changed', name: '저장변경', category: '국내주식', stockCode: '4', market: 'KOSPI', amount: 400, lpu: oldLpu },
    { id: 'failed', name: '실패', category: '국내주식', stockCode: '5', market: 'KOSPI', amount: 500, lpu: oldLpu },
  ];
  ctx.sleep = async () => {};
  ctx.fetchStockPrice = async (asset, meta) => {
    if (asset.id === 'live-1') return 110;
    if (asset.id === 'live-2') return 210;
    if (asset.id === 'fallback-same' || asset.id === 'fallback-changed') {
      ctx.mergeCacheFallbackMeta(meta, {
        reason: 'server-error',
        originStatus: '503',
        cachedAt: '2026-08-05T00:00:00.000Z',
      });
      return asset.id === 'fallback-same' ? 300 : 450;
    }
    return null;
  };
  let capturedUpdates = [];
  let emitted;
  ctx.batchUpdatePrices = updates => { capturedUpdates = updates.map(update => ({ ...update })); };
  ctx.captureUpdateEvent = payload => { emitted = payload; };
  vm.runInContext('EventBus.emit = (_name, payload) => captureUpdateEvent(payload)', ctx);

  const summary = await ctx._doAutoUpdate();
  assert('혼합 결과 집계: live 2 / fallback 2 / failed 1',
    summary.success === 2 && summary.fallback === 2 && summary.failed === 1 && summary.total === 5,
    JSON.stringify(summary));
  assert('집계 합이 전체 자산 수와 일치', summary.success + summary.fallback + summary.failed === summary.total);
  assert('fallback + 같은 오래된 가격은 stale에도 동시 집계', summary.stale === 1);

  const liveUpdates = capturedUpdates.filter(update => update.id.startsWith('live-'));
  const fallbackUpdates = capturedUpdates.filter(update => update.id.startsWith('fallback-'));
  assert('live 자산만 마지막 정상 업데이트 시각 갱신', liveUpdates.length === 2 && liveUpdates.every(update => typeof update.lpu === 'string' && update.lpu.length > 0));
  assert('fallback 자산의 기존 lpu 보존', fallbackUpdates.length === 2 && fallbackUpdates.every(update => !Object.prototype.hasOwnProperty.call(update, 'lpu')));
  assert('fallback 가격 변화는 stale로 오인하지 않음', emitted.logs.find(log => log.assetId === 'fallback-changed')?.stale === false);
  assert('fallback 로그에 서버 오류와 저장 시각 메타 포함', emitted.logs.filter(log => log.cacheFallback).every(log => log.originStatus === '503' && !!log.cacheStoredAt));
  assert('재시도 실패 로그가 중복되지 않음', emitted.logs.filter(log => log.assetId === 'failed').length === 1);

  const dashboardSource = fs.readFileSync('js/ui-dashboard.js', 'utf8');
  const appSource = fs.readFileSync('js/app.js', 'utf8');
  assert('개별 로그에 서버 오류 — 저장된 가격 사용 문구 포함', dashboardSource.includes('서버 오류') && dashboardSource.includes('저장된 가격 사용'));
  assert('수동 완료 토스트가 저장 가격 건수를 별도 표시', dashboardSource.includes('summary.fallback') && dashboardSource.includes('저장 가격'));
  assert('백그라운드 토스트는 원인을 단정하지 않고 저장 가격 사용을 표시',
    appSource.includes('⚠️ 저장 가격 ${summary.fallback}건 사용') &&
    !appSource.includes('서버 오류 — 저장 가격'));
  assert('fallback 실행은 5분 성공 중복 방지 시각을 갱신하지 않음', appSource.includes('if (!summary.fallback)'));

  const cssSource = fs.readFileSync('css/styles.css', 'utf8');
  assert('짧은 토스트는 내용 너비에 맞고 긴 토스트는 화면 안에서 줄바꿈',
    cssSource.includes('width:max-content') &&
    cssSource.includes('max-width:min(calc(100vw - 28px),520px)') &&
    cssSource.includes('max-width:100%'));

  vm.runInContext(dashboardSource, ctx, { filename: 'js/ui-dashboard.js' });
  const updateHtml = ctx.renderAutoUpdateSection();
  assert('실제 로그 HTML에 서버 오류 — 저장된 가격 사용 문구 렌더링', updateHtml.includes('서버 오류 503 — 저장된 가격 사용'));
  assert('실제 로그 HTML의 aria-label에도 fallback 경고 포함', updateHtml.includes('aria-label="저장동일, 서버 오류 503 — 저장된 가격 사용'));

  if (!process.exitCode) console.log('\n✅ 캐시 폴백 사용자 알림 테스트 통과');
})().catch(error => {
  console.error('✗ 캐시 폴백 사용자 알림 테스트 실행 실패:', error);
  process.exitCode = 1;
});
