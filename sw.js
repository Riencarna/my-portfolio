/* Service Worker - My Portfolio v2.4.0 */

var CACHE_NAME = "myportfolio-v2.4";
var STATIC_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/constants.js",
  "./js/utils.js",
  "./js/state.js",
  "./js/api.js",
  "./js/charts.js",
  "./js/ui-modals.js",
  "./js/ui-dashboard.js",
  "./js/ui-list.js",
  "./js/ui-history.js",
  "./js/ui-income.js",
  "./js/ui-ai.js",
  "./js/wallet.js",
  "./js/app.js",
  "./icon.svg",
  "./manifest.json"
];

/* Install: 정적 자산 캐시 */
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* Activate: 이전 캐시 정리 */
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* Fetch: API는 네트워크 우선, 정적 자산은 캐시 우선 */
self.addEventListener("fetch", function(event) {
  var url = event.request.url;

  /* API 요청: 네트워크 우선 */
  if (url.indexOf("api.") > -1 || url.indexOf("query1.") > -1 ||
      url.indexOf("corsproxy") > -1 || url.indexOf("allorigins") > -1 ||
      url.indexOf("codetabs") > -1 || url.indexOf("generativelanguage") > -1 ||
      url.indexOf("upbit") > -1 || url.indexOf("bithumb") > -1 ||
      url.indexOf("floatrates") > -1 || url.indexOf("publicnode") > -1 ||
      url.indexOf("binance") > -1 || url.indexOf("polygon-rpc") > -1 ||
      url.indexOf("arbitrum") > -1 || url.indexOf("optimism") > -1 ||
      url.indexOf("avax") > -1) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  /* CDN 리소스: 캐시 우선, 없으면 네트워크 */
  if (url.indexOf("cdn.jsdelivr.net") > -1) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  /* 정적 자산: 캐시 우선, 없으면 네트워크 후 캐시 저장 */
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
