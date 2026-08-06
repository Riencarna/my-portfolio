const fs = require('fs');
const vm = require('vm');

const swSource = fs.readFileSync('sw.js', 'utf8');

function assert(name, condition, detail = '') {
  if (!condition) {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${name}`);
}

function createHarness({ fetchImpl, cachedResponse, cacheMatchImpl }) {
  const listeners = {};
  const calls = [];
  const puts = [];
  const matches = [];
  const opens = [];
  const cache = {
    addAll: async () => {},
    match: async request => {
      calls.push('cache.match');
      matches.push(request);
      if (cacheMatchImpl) return cacheMatchImpl(request);
      return typeof cachedResponse === 'function' ? cachedResponse(request) : cachedResponse;
    },
    put: async (request, response) => {
      calls.push('cache.put');
      puts.push({ request, response });
    },
  };
  const caches = {
    open: async name => {
      calls.push('cache.open');
      opens.push(name);
      return cache;
    },
    match: async request => {
      calls.push('caches.match');
      return typeof cachedResponse === 'function' ? cachedResponse(request) : cachedResponse;
    },
    keys: async () => [],
    delete: async () => true,
  };
  const self = {
    addEventListener: (type, handler) => { listeners[type] = handler; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const fetch = request => {
    calls.push('fetch');
    return fetchImpl(request);
  };

  const context = vm.createContext({
    console,
    URL,
    Response: global.Response,
    Headers: global.Headers,
    Date,
    Promise,
    self,
    caches,
    fetch,
  });
  vm.runInContext(swSource, context, { filename: 'sw.js' });

  async function dispatchFetch({ url, method = 'GET', mode = 'cors' }) {
    const request = { url, method, mode };
    const lifetime = [];
    let responded = false;
    let responsePromise;
    listeners.fetch({
      request,
      respondWith(promise) {
        responded = true;
        responsePromise = Promise.resolve(promise);
      },
      waitUntil(promise) {
        lifetime.push(Promise.resolve(promise));
      },
    });
    const response = responded ? await responsePromise : undefined;
    await Promise.all(lifetime);
    await Promise.resolve();
    return { request, responded, response, lifetimeCount: lifetime.length };
  }

  return { calls, puts, matches, opens, cacheName: context.CACHE_NAME, dispatchFetch };
}

(async () => {
  console.log('\n[Service Worker 런타임 캐시 전략]');

  const storedAt = '2026-08-06T01:02:03.000Z';
  const cachedBody = JSON.stringify({ price: 1234 });
  const cached = new Response(cachedBody, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-MP-Cache-Stored-At': storedAt },
  });
  const network = new Response(JSON.stringify({ price: 2345 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const online = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const onlineResult = await online.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('AllOrigins 온라인 요청은 stale 캐시보다 네트워크 응답을 우선', onlineResult.response === network);
  assert('온라인 API 요청은 cache.match 전에 fetch 실행', online.calls[0] === 'fetch' && !online.calls.includes('cache.match'), online.calls.join(' → '));
  assert('성공 응답을 현재 캐시에 저장', online.puts.length === 1 && online.puts[0].response.ok);
  assert('정상 응답 캐시에 최초 저장 시각 기록', !!online.puts[0].response.headers.get('X-MP-Cache-Stored-At'));
  assert('정상 네트워크 응답에는 fallback marker 없음', onlineResult.response.headers.get('X-MP-Cache-Fallback') === null);
  assert('API 응답 Promise 안에서 캐시 쓰기까지 완료', online.calls.at(-1) === 'cache.put');

  const offline = createHarness({
    fetchImpl: async () => { throw new TypeError('offline'); },
    cachedResponse: cached,
  });
  const offlineResult = await offline.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('AllOrigins 네트워크 reject 시 캐시 응답으로 폴백', offlineResult.response?.headers.get('X-MP-Cache-Fallback') === '1');
  assert('네트워크 reject 폴백 이유 표시', offlineResult.response.headers.get('X-MP-Fallback-Reason') === 'network-error');
  assert('네트워크 reject 폴백도 저장 시각 보존', offlineResult.response.headers.get('X-MP-Cache-Stored-At') === storedAt);
  assert('오프라인 API 요청은 현재 버전 캐시만 조회', offline.calls.join(',') === 'fetch,cache.open,cache.match', offline.calls.join(' → '));

  const codetabs = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const codetabsResult = await codetabs.dispatchFetch({ url: 'https://api.codetabs.com/v1/proxy?quest=test' });
  assert('Codetabs도 API network-first 분기로 처리', codetabsResult.response === network && codetabs.calls[0] === 'fetch');

  const local = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const localResult = await local.dispatchFetch({ url: 'https://example.test/js/app.js' });
  assert('로컬 정적 파일은 cache-first 유지', localResult.response === cached && local.calls.join(',') === 'caches.match');

  const post = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const postResult = await post.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test', method: 'POST' });
  assert('GET이 아닌 요청은 Service Worker가 가로채지 않음', !postResult.responded && post.calls.length === 0);

  for (const status of [500, 502, 503, 599]) {
    const serverError = new Response(`server-${status}`, { status });
    const serverFailure = createHarness({ fetchImpl: async () => serverError, cachedResponse: cached });
    const serverFailureResult = await serverFailure.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
    assert(`HTTP ${status} + cache hit이면 마지막 정상 응답으로 폴백`, serverFailureResult.response?.headers.get('X-MP-Cache-Fallback') === '1');
    assert(`HTTP ${status} 폴백은 원 서버 상태 표시`, serverFailureResult.response.headers.get('X-MP-Origin-Status') === String(status));
    assert(`HTTP ${status} 폴백은 server-error 이유 표시`, serverFailureResult.response.headers.get('X-MP-Fallback-Reason') === 'server-error');
    assert(`HTTP ${status} 폴백은 저장 시각 불변`, serverFailureResult.response.headers.get('X-MP-Cache-Stored-At') === storedAt);
    assert(`HTTP ${status} 폴백은 저장 본문 보존`, await serverFailureResult.response.clone().text() === cachedBody);
    assert(`HTTP ${status}은 원래 요청과 같은 키로 현재 캐시 조회`, serverFailure.matches.length === 1 && serverFailure.matches[0] === serverFailureResult.request);
    assert(`HTTP ${status}은 현재 CACHE_NAME만 조회`, serverFailure.opens.length === 1 && serverFailure.opens[0] === serverFailure.cacheName);
    assert(`HTTP ${status} 폴백은 캐시를 새 오류 응답으로 덮지 않음`, serverFailure.puts.length === 0);
    if (status === 503) {
      const secondResult = await serverFailure.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
      assert('연속 HTTP 503에도 저장 시각 불변', secondResult.response.headers.get('X-MP-Cache-Stored-At') === storedAt);
      assert('연속 HTTP 503에도 캐시 put 없음', serverFailure.puts.length === 0);
    }
  }

  const unavailable = new Response('network-503', { status: 503 });
  const cacheMiss = createHarness({ fetchImpl: async () => unavailable, cachedResponse: undefined });
  const cacheMissResult = await cacheMiss.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('HTTP 503 + cache miss이면 원래 서버 오류를 반환', cacheMissResult.response === unavailable);

  const cacheReadFailure = createHarness({
    fetchImpl: async () => unavailable,
    cachedResponse: cached,
    cacheMatchImpl: async () => { throw new Error('cache read failed'); },
  });
  const cacheReadFailureResult = await cacheReadFailure.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('HTTP 503 + 캐시 조회 실패여도 원래 서버 오류를 보존', cacheReadFailureResult.response === unavailable);

  const invalidCached = new Response('bad-cache', { status: 500 });
  const invalidCache = createHarness({ fetchImpl: async () => unavailable, cachedResponse: invalidCached });
  const invalidCacheResult = await invalidCache.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('HTTP 503 + 비정상 캐시는 사용하지 않음', invalidCacheResult.response === unavailable);

  for (const status of [401, 403, 404, 429]) {
    const clientError = new Response(`network-${status}`, { status });
    const clientFailure = createHarness({ fetchImpl: async () => clientError, cachedResponse: cached });
    const clientFailureResult = await clientFailure.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
    assert(`HTTP ${status}는 인증·제한 오류를 숨기지 않고 그대로 반환`, clientFailureResult.response === clientError);
    assert(`HTTP ${status}는 cache fallback 분기로 들어가지 않음`, !clientFailure.calls.includes('cache.open') && !clientFailure.calls.includes('cache.match'));
  }

  for (const status of [0, 302]) {
    const passThrough = status === 0
      ? { ok: false, status: 0, headers: new Headers(), clone() { return this; } }
      : new Response('redirect', { status });
    const passThroughHarness = createHarness({ fetchImpl: async () => passThrough, cachedResponse: cached });
    const passThroughResult = await passThroughHarness.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
    assert(`HTTP status ${status}은 기존 정책대로 원 응답 통과`, passThroughResult.response === passThrough);
    assert(`HTTP status ${status}은 캐시를 읽거나 쓰지 않음`, !passThroughHarness.calls.includes('cache.match') && passThroughHarness.puts.length === 0);
  }

  const coingeckoFailure = createHarness({ fetchImpl: async () => unavailable, cachedResponse: cached });
  const coingeckoResult = await coingeckoFailure.dispatchFetch({ url: 'https://api.coingecko.com/api/v3/simple/price' });
  assert('기존 API 호스트도 동일한 5xx 캐시 정책 적용', coingeckoResult.response?.headers.get('X-MP-Cache-Fallback') === '1');

  const offlineMiss = createHarness({
    fetchImpl: async () => { throw new TypeError('offline'); },
    cachedResponse: undefined,
  });
  const offlineMissResult = await offlineMiss.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('네트워크 reject + cache miss 기존 동작 유지', offlineMissResult.response === undefined);

  const totalStorageFailure = createHarness({
    fetchImpl: async () => { throw new TypeError('offline'); },
    cachedResponse: cached,
    cacheMatchImpl: async () => { throw new Error('cache read failed'); },
  });
  let storageFailureError;
  try {
    await totalStorageFailure.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  } catch (error) {
    storageFailureError = error;
  }
  assert('네트워크 reject + 캐시 조회 실패는 최종 오류로 유지', storageFailureError?.message === 'cache read failed');

  for (const status of [200, 204]) {
    const success = new Response(status === 204 ? null : `network-${status}`, { status });
    const successHarness = createHarness({ fetchImpl: async () => success, cachedResponse: cached });
    const successResult = await successHarness.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
    assert(`HTTP ${status}은 네트워크 응답을 반환`, successResult.response === success);
    assert(`HTTP ${status}은 캐시 갱신`, successHarness.puts.length === 1);
    assert(`HTTP ${status} 캐시에는 저장 시각 기록`, !!successHarness.puts[0].response.headers.get('X-MP-Cache-Stored-At'));
    assert(`HTTP ${status}은 stale 캐시를 읽지 않음`, !successHarness.calls.includes('cache.match'));
  }

  const forged = new Response('live', {
    status: 200,
    headers: {
      'X-MP-Cache-Fallback': '1',
      'X-MP-Fallback-Reason': 'forged',
      'X-MP-Origin-Status': '599',
      'X-MP-Cache-Stored-At': storedAt,
    },
  });
  const forgedHarness = createHarness({ fetchImpl: async () => forged, cachedResponse: cached });
  const forgedResult = await forgedHarness.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('정상 upstream 응답의 예약 fallback marker 제거', forgedResult.response.headers.get('X-MP-Cache-Fallback') === null);
  assert('정상 upstream 응답의 위조 status/reason 제거', forgedResult.response.headers.get('X-MP-Origin-Status') === null && forgedResult.response.headers.get('X-MP-Fallback-Reason') === null);

  if (!process.exitCode) console.log('\n✅ Service Worker 런타임 캐시 테스트 통과');
})().catch(error => {
  console.error('✗ Service Worker 런타임 테스트 실행 실패:', error);
  process.exitCode = 1;
});
