/* Service Worker - My Portfolio v5.37.1
   Feature: stale 가격 감지 (사일런트 실패 방지)
   Soft Neutral UI overhaul (lavender/cream/coral) */

var CACHE_NAME = "myportfolio-v5.37.1";

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
  "./js/ui-report.js",
  "./js/app.js"
];

// 네트워크-우선 + 캐시 폴백 대상. Cloudflare Worker 프록시와 polling.finance.naver.com이
// 빠져있어 가격 응답이 영구 캐싱되던 회귀(v5.9.3 이후)를 v5.11.1에서 수정.
var API_HOSTS = [
  "api.coingecko.com", "query1.finance.yahoo.com",
  "m.stock.naver.com", "api.stock.naver.com",
  "polling.finance.naver.com",
  "asset-manage-alpaca.wnsduf0306.workers.dev",
  "api.codetabs.com", "api.allorigins.win",
  "stooq.com",
  "open.er-api.com", "www.floatrates.com",
  "api.upbit.com", "api.bithumb.com", "finance.daum.net",
  "generativelanguage.googleapis.com",
  "ethereum-rpc.publicnode.com", "bsc-dataseed.binance.org",
  "polygon.drpc.org", "arb1.arbitrum.io",
  "mainnet.optimism.io", "api.avax.network"
];

var CDN_HOSTS = ["cdn.jsdelivr.net"];

var MP_FALLBACK_HEADER = "X-MP-Cache-Fallback";
var MP_FALLBACK_REASON_HEADER = "X-MP-Fallback-Reason";
var MP_ORIGIN_STATUS_HEADER = "X-MP-Origin-Status";
var MP_CACHED_AT_HEADER = "X-MP-Cache-Stored-At";
var MP_RESERVED_HEADERS = [
  MP_FALLBACK_HEADER,
  MP_FALLBACK_REASON_HEADER,
  MP_ORIGIN_STATUS_HEADER,
  MP_CACHED_AT_HEADER
];

function cloneResponseWithHeaders(resp, headers) {
  var copy = resp.clone();
  return new Response(copy.body, {
    status: copy.status,
    statusText: copy.statusText,
    headers: headers
  });
}

function cleanNetworkResponse(resp) {
  var hasReserved = MP_RESERVED_HEADERS.some(function(name) { return resp.headers.has(name); });
  if (!hasReserved) return resp;
  var headers = new Headers(resp.headers);
  MP_RESERVED_HEADERS.forEach(function(name) { headers.delete(name); });
  return cloneResponseWithHeaders(resp, headers);
}

function createApiCacheResponse(resp) {
  var headers = new Headers(resp.headers);
  MP_RESERVED_HEADERS.forEach(function(name) { headers.delete(name); });
  headers.set(MP_CACHED_AT_HEADER, new Date().toISOString());
  return cloneResponseWithHeaders(resp, headers);
}

function createFallbackResponse(cached, reason, originStatus) {
  try {
    var headers = new Headers(cached.headers);
    headers.set(MP_FALLBACK_HEADER, "1");
    headers.set(MP_FALLBACK_REASON_HEADER, reason);
    if (originStatus) headers.set(MP_ORIGIN_STATUS_HEADER, String(originStatus));
    else headers.delete(MP_ORIGIN_STATUS_HEADER);
    var exposed = (headers.get("Access-Control-Expose-Headers") || "")
      .split(",").map(function(v) { return v.trim(); }).filter(Boolean);
    MP_RESERVED_HEADERS.forEach(function(name) {
      if (!exposed.some(function(v) { return v.toLowerCase() === name.toLowerCase(); })) exposed.push(name);
    });
    headers.set("Access-Control-Expose-Headers", exposed.join(", "));
    return cloneResponseWithHeaders(cached, headers);
  } catch (_) {
    return null;
  }
}

function matchCurrentCache(request) {
  return caches.open(CACHE_NAME).then(function(cache) { return cache.match(request); });
}

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

// Message: keep manual activation support for older open tabs
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
        var cleanResp = cleanNetworkResponse(resp);
        if (resp.ok) {
          var cacheResponse = createApiCacheResponse(resp);
          return caches.open(CACHE_NAME)
            .then(function(cache) { return cache.put(e.request, cacheResponse); })
            .then(function() { return cleanResp; }, function() { return cleanResp; });
        }
        // 서버 장애(5xx) 때는 마지막 정상 응답이 있으면 화면을 유지한다.
        // 인증·요청 제한을 숨기지 않도록 4xx는 그대로 반환한다.
        if (resp.status >= 500 && resp.status <= 599) {
          return matchCurrentCache(e.request)
            .then(function(cached) {
              return cached && cached.ok
                ? (createFallbackResponse(cached, "server-error", resp.status) || cleanResp)
                : cleanResp;
            }, function() { return cleanResp; });
        }
        return cleanResp;
      }).catch(function() {
        return matchCurrentCache(e.request)
          .then(function(cached) {
            return cached && cached.ok
              ? (createFallbackResponse(cached, "network-error", "") || undefined)
              : undefined;
          });
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
