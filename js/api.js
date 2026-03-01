/* ===================================================
   api.js - 외부 API 호출 (가격, 환율, 코인)
   =================================================== */

// --- 코인 가격 조회 (CoinGecko) ---

function fetchCoinPrices(ids) {
  if (!ids.length) return Promise.resolve({});
  var unique = ids.filter(function(v, i, a) { return a.indexOf(v) === i; });
  var attempt = 0;
  var maxRetries = 2;

  function doFetch() {
    return fetch("https://api.coingecko.com/api/v3/simple/price?ids=" + unique.join(",") + "&vs_currencies=krw")
      .then(function(r) {
        if (r.status === 429 && attempt < maxRetries) {
          attempt++;
          var delay = attempt * 3000;
          return new Promise(function(resolve) {
            setTimeout(function() { resolve(doFetch()); }, delay);
          });
        }
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .catch(function() { return {}; });
  }

  return doFetch();
}

// --- CORS 프록시 통한 fetch ---

function _shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function tryFetch(url, timeoutMs) {
  var tm = timeoutMs || 8000;
  var round = 0;
  var shuffled = _shuffleArray(CORS_PROXIES);

  function batch() {
    var start = round * 2;
    if (start >= shuffled.length) return Promise.resolve(null);
    var candidates = shuffled.slice(start, start + 2);
    round++;

    var promises = candidates.map(function(proxyFn) {
      return Promise.race([
        fetch(proxyFn(url)).then(function(r) {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        }).then(function(t) {
          try { return JSON.parse(t); } catch (e) { return null; }
        }),
        new Promise(function(resolve) { setTimeout(function() { resolve(null); }, tm); })
      ]).catch(function() { return null; });
    });

    return Promise.race(promises.map(function(p) {
      return p.then(function(v) { if (v) return v; throw new Error("empty"); });
    })).catch(function() {
      return Promise.all(promises).then(function(results) {
        for (var i = 0; i < results.length; i++) {
          if (results[i]) return results[i];
        }
        return batch();
      });
    });
  }

  return batch();
}

// --- Yahoo Finance ---

function fetchYahooFinance(symbol) {
  var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=1d&interval=1d";
  return tryFetch(url, 10000).then(function(d) {
    if (!d) return null;
    var meta = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
    var price = meta && meta.regularMarketPrice;
    var currency = (meta && meta.currency) || "USD";
    if (price && price > 0) return { price: price, currency: currency };
    return null;
  });
}

// --- Naver 주식 ---

function fetchNaver(code) {
  var url = "https://m.stock.naver.com/api/stock/" + code + "/basic";
  return tryFetch(url, 8000).then(function(d) {
    if (!d) return null;
    var cp = d.closePrice || d.currentPrice;
    if (cp) return Number(String(cp).replace(/,/g, ""));
    if (d.stockEndPrice) return Number(String(d.stockEndPrice).replace(/,/g, ""));
    return null;
  }).catch(function() { return null; });
}

// --- 환율 ---

function getExchangeRate() {
  if (cachedExchangeRate && Date.now() - cachedExchangeRate.t < 600000) return Promise.resolve(cachedExchangeRate.r);
  return fetchExchangeRate();
}

function _saveExchangeRateCache(rate) {
  cachedExchangeRate = { r: rate, t: Date.now() };
  try { localStorage.setItem("mp_ex_rate", JSON.stringify(cachedExchangeRate)); } catch (e) {}
  return rate;
}

function _getLastKnownExchangeRate() {
  try {
    var s = localStorage.getItem("mp_ex_rate");
    if (s) {
      var d = JSON.parse(s);
      if (d && d.r > 1000) return d.r;
    }
  } catch (e) {}
  return 1350;
}

function fetchExchangeRate() {
  return fetchYahooFinance("KRW=X").then(function(r) {
    if (r && r.price > 1000) return _saveExchangeRateCache(r.price);
    return null;
  }).then(function(v) {
    if (v) return v;
    return fetch("https://open.er-api.com/v6/latest/USD").then(function(r) { return r.json(); }).then(function(d) {
      if (d && d.rates && d.rates.KRW) return _saveExchangeRateCache(d.rates.KRW);
      return null;
    }).catch(function() { return null; });
  }).then(function(v) {
    if (v) return v;
    return tryFetch("https://www.floatrates.com/daily/usd.json", 8000).then(function(d) {
      if (d && d.krw && d.krw.rate) return _saveExchangeRateCache(Math.round(d.krw.rate));
      return null;
    }).catch(function() { return null; });
  }).then(function(v) { return v || _getLastKnownExchangeRate(); });
}

// --- 주식 가격 조회 ---

function fetchStockPrice(asset) {
  var code = asset.stockCode;
  if (!code) return Promise.resolve(null);

  if (asset.category === "국내주식" || asset.krxEtf) {
    var sym = code + (asset.market === "KOSDAQ" ? ".KQ" : ".KS");
    return fetchYahooFinance(sym).then(function(r) {
      if (r && r.price > 0) return r.price;
      return fetchNaver(code);
    });
  }

  if (asset.category === "해외주식") {
    return fetchYahooFinance(code).then(function(r) {
      if (!r) return null;
      if (r.currency !== "KRW") return getExchangeRate().then(function(rt) { return Math.round(r.price * rt); });
      return r.price;
    });
  }

  return Promise.resolve(null);
}

// --- USDT 환율 ---

function getUsdtExchangeRate() {
  if (cachedUsdtRate && Date.now() - cachedUsdtRate.t < 600000) return Promise.resolve(cachedUsdtRate.r);
  return fetchUsdtExchangeRate();
}

function fetchUsdtExchangeRate() {
  return fetch("https://api.upbit.com/v1/ticker?markets=KRW-USDT")
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(d) {
      if (d && d[0] && d[0].trade_price) { cachedUsdtRate = { r: d[0].trade_price, t: Date.now(), src: "업비트" }; return d[0].trade_price; }
      throw new Error("no data");
    })
    .catch(function() {
      return fetch("https://api.bithumb.com/public/ticker/USDT_KRW").then(function(r) { return r.json(); }).then(function(d) {
        if (d && d.data && d.data.closing_price) { var p = Number(d.data.closing_price); cachedUsdtRate = { r: p, t: Date.now(), src: "빗썸" }; return p; }
        throw new Error("no data");
      });
    })
    .catch(function() {
      return fetchCoinPrices(["tether"]).then(function(d) {
        if (d && d.tether && d.tether.krw) { cachedUsdtRate = { r: d.tether.krw, t: Date.now(), src: "CoinGecko" }; return d.tether.krw; }
        return getExchangeRate().then(function(rt) { cachedUsdtRate = { r: rt, t: Date.now(), src: "환율" }; return rt; });
      });
    });
}

// --- 환율 변환 ---

function usdToKrw(usd) {
  var r = (cachedExchangeRate && cachedExchangeRate.r) ? cachedExchangeRate.r : _getLastKnownExchangeRate();
  return Math.round(usd * r);
}

function getCurrentExchangeRate() {
  return (cachedExchangeRate && cachedExchangeRate.r) ? cachedExchangeRate.r : _getLastKnownExchangeRate();
}

// --- 환율 수동 새로고침 ---

function refreshExchangeRate() {
  cachedExchangeRate = null;
  showToast("🔄 환율 최신화 중...");
  fetchExchangeRate().then(function(r) {
    showToast("💱 환율 업데이트: 1$ = " + Math.round(r).toLocaleString() + "원");
    render();
  });
}

// --- 샌드박스 체크 ---

function checkSandbox() {
  return fetch("https://api.coingecko.com/api/v3/ping")
    .then(function(r) { return r.ok; })
    .catch(function() { isSandbox = true; return false; });
}
