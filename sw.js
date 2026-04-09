/* Service Worker - My Portfolio v4.4.1
   Planner-Creator-Evaluator Cycle 2
   Drag&Drop reorder 수정 (삽입선 피드백, 히트영역 44px, 스와이프 bail) */

var CACHE_NAME = "myportfolio-v4.4.1";

var STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./css/styles.css",
  "./js/config.js",
  "./js/utils.js",
  "./js/store.js",
  "./js/api.js",
  "./js/charts.js",
  "./js/wallet.js",
  "./js/ui-dashboard.js",
  "./js/ui-list.js",
  "./js/ui-modals.js",
  "./js/ui-history.js",
  "./js/ui-income.js",
  "./js/ui-ai.js",
  "./js/app.js"
];

var API_HOSTS = [
  "api.coingecko.com", "query1.finance.yahoo.com",
  "m.stock.naver.com", "stooq.com",
  "open.er-api.com", "www.floatrates.com",
  "api.upbit.com", "api.bithumb.com",
  "ethereum-rpc.publicnode.com", "bsc-dataseed.binance.org",
  "polygon-rpc.com", "arb1.arbitrum.io",
  "mainnet.optimism.io", "api.avax.network"
];

var CDN_HOSTS = ["cdn.jsdelivr.net"];

var OFFLINE_HTML = '<!DOCTYPE html>'
  + '<html lang="ko"><head><meta charset="UTF-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>오프라인 - My Portfolio</title>'
  + '<style>'
  + 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
  + 'background:#0a0a0f;color:#E2E8F0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
  + 'text-align:center;padding:20px;box-sizing:border-box;}'
  + '.offline-box{max-width:400px;}'
  + '.offline-icon{font-size:64px;margin-bottom:16px;}'
  + 'h1{font-size:20px;margin:0 0 12px;}'
  + 'p{font-size:14px;color:#94A3B8;margin:0 0 24px;line-height:1.6;}'
  + 'button{background:#6366F1;color:#fff;border:none;padding:12px 24px;border-radius:8px;'
  + 'font-size:14px;cursor:pointer;}'
  + 'button:hover{background:#4F46E5;}'
  + '</style></head><body>'
  + '<div class="offline-box">'
  + '<div class="offline-icon" aria-hidden="true">📡</div>'
  + '<h1>인터넷에 연결할 수 없습니다</h1>'
  + '<p>네트워크 연결을 확인한 후 다시 시도해 주세요.<br>'
  + '이전에 캐시된 데이터가 있다면 자동으로 복원됩니다.</p>'
  + '<button onclick="location.reload()">다시 시도</button>'
  + '</div></body></html>';

// Install: pre-cache static assets
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Message: handle SKIP_WAITING from client for click-to-refresh
self.addEventListener("message", function(e) {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch: strategy based on request type
self.addEventListener("fetch", function(e) {
  var url;
  try { url = new URL(e.request.url); } catch (_) { return; }

  if (e.request.method !== "GET") return;

  // API requests: network-first with cache fallback
  if (API_HOSTS.some(function(h) { return url.hostname.includes(h); })) {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        if (resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return resp;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // CDN: stale-while-revalidate
  if (CDN_HOSTS.some(function(h) { return url.hostname.includes(h); })) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        var fetchPromise = fetch(e.request).then(function(resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
          }
          return resp;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Local: cache-first with network fallback + offline page for navigation
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        if (resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return resp;
      }).catch(function() {
        if (e.request.mode === "navigate") {
          return new Response(OFFLINE_HTML, {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/html; charset=UTF-8" }
          });
        }
      });
    })
  );
});
