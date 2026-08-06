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

function createHarness({ fetchImpl, cachedResponse }) {
  const listeners = {};
  const calls = [];
  const puts = [];
  const cache = {
    addAll: async () => {},
    put: async (request, response) => {
      calls.push('cache.put');
      puts.push({ request, response });
    },
  };
  const caches = {
    open: async () => {
      calls.push('cache.open');
      return cache;
    },
    match: async request => {
      calls.push('cache.match');
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

  vm.runInContext(swSource, vm.createContext({
    console,
    URL,
    Response: global.Response,
    Promise,
    self,
    caches,
    fetch,
  }), { filename: 'sw.js' });

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

  return { calls, puts, dispatchFetch };
}

(async () => {
  console.log('\n[Service Worker 런타임 캐시 전략]');

  const cached = { source: 'cache' };
  const networkClone = { source: 'network-clone' };
  const network = { ok: true, source: 'network', clone: () => networkClone };
  const online = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const onlineResult = await online.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('AllOrigins 온라인 요청은 stale 캐시보다 네트워크 응답을 우선', onlineResult.response === network);
  assert('온라인 API 요청은 cache.match 전에 fetch 실행', online.calls[0] === 'fetch' && !online.calls.includes('cache.match'), online.calls.join(' → '));
  assert('성공 응답 clone을 현재 캐시에 저장', online.puts.length === 1 && online.puts[0].response === networkClone);
  assert('API 응답 Promise 안에서 캐시 쓰기까지 완료', online.calls.at(-1) === 'cache.put');

  const offline = createHarness({
    fetchImpl: async () => { throw new TypeError('offline'); },
    cachedResponse: cached,
  });
  const offlineResult = await offline.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('AllOrigins 네트워크 reject 시 캐시 응답으로 폴백', offlineResult.response === cached);
  assert('오프라인 API 요청도 fetch 후 cache.match 순서', offline.calls.join(',') === 'fetch,cache.match', offline.calls.join(' → '));

  const codetabs = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const codetabsResult = await codetabs.dispatchFetch({ url: 'https://api.codetabs.com/v1/proxy?quest=test' });
  assert('Codetabs도 API network-first 분기로 처리', codetabsResult.response === network && codetabs.calls[0] === 'fetch');

  const local = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const localResult = await local.dispatchFetch({ url: 'https://example.test/js/app.js' });
  assert('로컬 정적 파일은 cache-first 유지', localResult.response === cached && local.calls.join(',') === 'cache.match');

  const post = createHarness({ fetchImpl: async () => network, cachedResponse: cached });
  const postResult = await post.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test', method: 'POST' });
  assert('GET이 아닌 요청은 Service Worker가 가로채지 않음', !postResult.responded && post.calls.length === 0);

  const serverError = { ok: false, status: 500, source: 'network-500', clone: () => ({}) };
  const http500 = createHarness({ fetchImpl: async () => serverError, cachedResponse: cached });
  const http500Result = await http500.dispatchFetch({ url: 'https://api.allorigins.win/raw?url=test' });
  assert('HTTP 500은 reject와 구분해 현재 정책대로 네트워크 응답 반환', http500Result.response === serverError);
  assert('HTTP 500에서는 캐시 폴백·갱신을 수행하지 않음', !http500.calls.includes('cache.match') && http500.puts.length === 0);

  if (!process.exitCode) console.log('\n✅ Service Worker 런타임 캐시 테스트 통과');
})().catch(error => {
  console.error('✗ Service Worker 런타임 테스트 실행 실패:', error);
  process.exitCode = 1;
});
