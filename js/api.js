/* =============================================
   My Portfolio v5.5.0 — API Integration
   Cycle B compatible
   Naver world stock, Promise.any parallel CORS
   ============================================= */

// ── Cache ──
let cachedRate = null;
let cachedUsdt = null;
let cachedBenchmark = null;
let updateLogs = [];
let autoUpdateProgress = { total: 0, done: 0, running: false };

// ── Fetch with Timeout ──
function fetchWithTimeout(url, ms = API_TIMEOUT, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── CORS Proxy Fetch (Promise.any parallel race) ──
async function corsFetch(url, timeout = API_TIMEOUT) {
  // 1. Direct fetch
  try {
    const r = await fetchWithTimeout(url, timeout);
    if (r.ok) return r;
  } catch (e) {
    console.warn('corsFetch direct failed:', url.split('?')[0], e.message);
  }

  // 2. Custom proxy (power-user setting)
  try {
    const customProxy = localStorage.getItem(CUSTOM_PROXY_KEY);
    if (customProxy) {
      const base = customProxy.endsWith('/') ? customProxy : customProxy + '/';
      const r = await fetchWithTimeout(base + encodeURIComponent(url), timeout);
      if (r.ok) return r;
    }
  } catch (e) {
    console.warn('corsFetch custom proxy failed:', e.message);
  }

  // 3. Public proxies — parallel race (fastest wins)
  try {
    return await Promise.any(
      CORS_PROXIES.map(proxy =>
        fetchWithTimeout(proxy(url), timeout).then(r => {
          if (r.ok) return r;
          throw new Error('not ok: ' + r.status);
        })
      )
    );
  } catch (e) {
    throw new Error(`네트워크 요청 실패: ${url.split('?')[0]}`);
  }
}

// ── Exchange Rate (USD -> KRW) ──
async function fetchExchangeRate(force = false) {
  if (!force && cachedRate && Date.now() - cachedRate.time < CACHE_TTL_RATE) {
    return cachedRate.rate;
  }
  try {
    const r = await fetchWithTimeout(API.openER, 5000);
    const d = await r.json();
    if (d.rates?.KRW) {
      cachedRate = { rate: d.rates.KRW, time: Date.now(), source: 'open.er-api' };
      return cachedRate.rate;
    }
  } catch (e) {
    console.warn('fetchExchangeRate open.er-api failed:', e.message);
  }
  try {
    const r = await corsFetch(API.floatRates, 5000);
    const d = await r.json();
    if (d.krw?.rate) {
      cachedRate = { rate: d.krw.rate, time: Date.now(), source: 'floatrates' };
      return cachedRate.rate;
    }
  } catch (e) {
    console.warn('fetchExchangeRate floatrates failed:', e.message);
  }
  if (cachedRate?.rate) return cachedRate.rate;
  console.warn('Exchange rate: using fallback', FALLBACK_USD_KRW);
  showToast(`환율 정보 불러오기 실패. 기본값(${FALLBACK_USD_KRW}원) 사용 중`, 'info');
  return FALLBACK_USD_KRW;
}

// ── USDT Rate (KRW) ──
async function fetchUsdtRate() {
  if (cachedUsdt && Date.now() - cachedUsdt.time < CACHE_TTL_RATE) {
    return cachedUsdt.rate;
  }
  try {
    const r = await fetchWithTimeout(`${API.upbit}?markets=KRW-USDT`, 5000);
    const d = await r.json();
    if (d[0]?.trade_price) {
      cachedUsdt = { rate: d[0].trade_price, time: Date.now(), source: 'Upbit' };
      return cachedUsdt.rate;
    }
  } catch (e) {
    console.warn('fetchUsdtRate upbit failed:', e.message);
  }
  try {
    const r = await corsFetch(`${API.bithumb}/USDT_KRW`, 5000);
    const d = await r.json();
    if (d.data?.closing_price) {
      cachedUsdt = { rate: Number(d.data.closing_price), time: Date.now(), source: 'Bithumb' };
      return cachedUsdt.rate;
    }
  } catch (e) {
    console.warn('fetchUsdtRate bithumb failed:', e.message);
  }
  try {
    const rate = await fetchExchangeRate();
    cachedUsdt = { rate, time: Date.now(), source: 'Exchange' };
    return rate;
  } catch (e) {
    console.warn('fetchUsdtRate exchange fallback failed:', e.message);
  }
  if (cachedUsdt?.rate) return cachedUsdt.rate;
  console.warn('USDT rate: using fallback', FALLBACK_USD_KRW);
  return FALLBACK_USD_KRW;
}

// ── Coin Prices (CoinGecko) ──
async function fetchCoinPrices(coinIds) {
  if (!coinIds || !coinIds.length) return {};
  const ids = coinIds.join(',');
  const url = `${API.coingecko}/simple/price?ids=${ids}&vs_currencies=krw`;
  try {
    const r = await fetchWithTimeout(url, API_TIMEOUT);
    if (r.ok) {
      const d = await r.json();
      return extractCoinPrices(d);
    }
  } catch (e) {
    console.warn('fetchCoinPrices direct failed:', e.message);
  }
  try {
    const r = await corsFetch(url, 10000);
    const d = await r.json();
    return extractCoinPrices(d);
  } catch (e) {
    console.warn('CoinGecko fetch failed:', e.message);
    return {};
  }
}

function extractCoinPrices(data) {
  const result = {};
  if (data && typeof data === 'object') {
    for (const [id, v] of Object.entries(data)) {
      if (v?.krw && isFinite(v.krw)) result[id] = v.krw;
    }
  }
  return result;
}

// ── Stock Price ──
async function fetchStockPrice(asset) {
  const { stockCode, market, name } = asset;
  if (!stockCode && !(name && ETF_PREFIXES.some(p => name.toUpperCase().startsWith(p)))) {
    return null;
  }
  if (stockCode && !['KOSPI', 'KOSDAQ'].includes(market)) {
    return fetchForeignStockPrice(stockCode, market);
  }
  if (stockCode) {
    return fetchKoreanStockPrice(stockCode);
  }
  return null;
}

async function fetchKoreanStockPrice(code) {
  try {
    const r = await corsFetch(`${API.naver}/${code}/basic`, API_TIMEOUT);
    const d = await r.json();
    const price = d.closePrice || d.currentPrice;
    if (price) return safeNum(String(price).replace(/,/g, ''));
  } catch (e) {
    console.warn('fetchKoreanStockPrice naver failed:', code, e.message);
  }
  for (const suffix of ['.KS', '.KQ']) {
    try {
      const r = await corsFetch(`${API.yahoo}/v8/finance/chart/${code}${suffix}?interval=1d&range=1d`, API_TIMEOUT);
      const d = await r.json();
      const price = d.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && isFinite(price)) return Math.round(price);
    } catch (e) {
      console.warn(`fetchKoreanStockPrice yahoo ${suffix} failed:`, code, e.message);
    }
  }
  return null;
}

async function fetchForeignStockPrice(symbol, market) {
  // 1. Naver world stock API (api.stock.naver.com)
  //    NASDAQ → symbol.O, NYSE → symbol (no suffix), unknown → try both
  const suffixes = market === 'NASDAQ' ? ['.O']
                 : market === 'NYSE'   ? ['']
                 : ['', '.O'];
  for (const suffix of suffixes) {
    try {
      const r = await corsFetch(`${API.naverWorld}/${symbol}${suffix}/basic`, API_TIMEOUT);
      const d = await r.json();
      if (d.code) continue;
      const price = d.closePrice || d.currentPrice;
      if (price) {
        const usdPrice = safeNum(String(price).replace(/,/g, ''));
        if (usdPrice > 0) {
          const rate = await fetchExchangeRate();
          return Math.round(usdPrice * rate);
        }
      }
    } catch (e) {
      console.warn(`fetchForeignStockPrice naver (${symbol}${suffix}) failed:`, e.message);
    }
  }

  // 2. Yahoo Finance fallback
  try {
    const r = await corsFetch(`${API.yahoo}/v8/finance/chart/${symbol}?interval=1d&range=1d`, API_TIMEOUT);
    const d = await r.json();
    const meta = d.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice && isFinite(meta.regularMarketPrice)) {
      const price = meta.regularMarketPrice;
      if (meta.currency === 'KRW') return Math.round(price);
      const rate = await fetchExchangeRate();
      return Math.round(price * rate);
    }
  } catch (e) {
    console.warn('fetchForeignStockPrice yahoo failed:', symbol, e.message);
  }

  // 3. Stooq fallback
  try {
    const r = await corsFetch(`${API.stooq}?s=${symbol.toLowerCase()}&f=sd2t2ohlcvn&h&e=csv`, API_TIMEOUT);
    const text = await r.text();
    const lines = text.trim().split('\n');
    if (lines.length >= 2) {
      const close = parseFloat(lines[1].split(',')[6]);
      if (isFinite(close) && close > 0) {
        const rate = await fetchExchangeRate();
        return Math.round(close * rate);
      }
    }
  } catch (e) {
    console.warn('fetchForeignStockPrice stooq failed:', symbol, e.message);
  }
  return null;
}

// ── Benchmark Returns ──
async function fetchBenchmarkReturns() {
  if (cachedBenchmark && Date.now() - cachedBenchmark.time < CACHE_TTL_BENCH) {
    return cachedBenchmark.data;
  }
  const result = {};
  for (const [name, symbol] of Object.entries(BENCHMARKS)) {
    try {
      const r = await corsFetch(`${API.yahoo}/v8/finance/chart/${symbol}?interval=1d&range=1y`, 10000);
      const d = await r.json();
      const closes = d.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      if (closes?.length > 1) {
        const validCloses = closes.filter(c => c != null && isFinite(c));
        const first = validCloses[0];
        const last = validCloses[validCloses.length - 1];
        if (first && last && first > 0) {
          result[name] = { ytd: ((last - first) / first) * 100, prices: validCloses };
        }
      }
    } catch (e) {
      console.warn(`Benchmark ${name} fetch failed:`, e.message);
    }
  }
  cachedBenchmark = { data: result, time: Date.now() };
  return result;
}

// ── Auto Update All ──
let _updatePromise = null;

async function autoUpdateAll(onProgress) {
  if (_updatePromise) {
    showToast('업데이트가 이미 진행 중입니다', 'info');
    return { success: 0, failed: 0, total: 0 };
  }
  _updatePromise = _doAutoUpdate(onProgress);
  try { return await _updatePromise; } finally { _updatePromise = null; }
}

async function _doAutoUpdate(onProgress) {
  autoUpdateProgress.running = true;
  updateLogs = [];
  const assets = appState.assets;
  const updatable = [];
  const coinAssets = [];
  const failed = [];
  const pendingUpdates = [];
  let successCount = 0;
  let failCount = 0;

  for (const a of assets) {
    if (a.category === '코인' && a.coinId) coinAssets.push(a);
    else if (a.category === '현금' && a.isUsdt) updatable.push({ asset: a, type: 'usdt' });
    else if (a.stockCode) updatable.push({ asset: a, type: 'stock' });
  }

  const totalAssets = updatable.length + coinAssets.length;
  autoUpdateProgress.total = updatable.length + (coinAssets.length > 0 ? 1 : 0);
  autoUpdateProgress.done = 0;

  const log = (name, ok, price) => {
    updateLogs.push({ name, ok, price, time: new Date().toISOString() });
    if (updateLogs.length > LIMITS.logs) updateLogs.shift();
    if (ok) successCount++; else failCount++;
  };

  const now = new Date().toLocaleString('ko-KR');

  // 1. USDT
  for (const item of updatable.filter(u => u.type === 'usdt')) {
    try {
      const rate = await fetchUsdtRate();
      if (rate && isFinite(rate)) {
        const qty = item.asset.usdtQty;
        const amt = (qty != null && qty > 0) ? Math.round(rate * qty) : rate;
        pendingUpdates.push({ id: item.asset.id, amount: amt, lpu: now });
        log(item.asset.name, true, amt);
      } else {
        log(item.asset.name, false);
        failed.push(item);
      }
    } catch (e) {
      console.warn('autoUpdate USDT failed:', item.asset.name, e.message);
      log(item.asset.name, false);
      failed.push(item);
    }
    autoUpdateProgress.done++;
    onProgress?.(autoUpdateProgress);
  }

  // 2. Coins batch
  if (coinAssets.length > 0) {
    const ids = [...new Set(coinAssets.map(a => a.coinId))];
    try {
      const prices = await fetchCoinPrices(ids);
      for (const a of coinAssets) {
        if (prices[a.coinId] && isFinite(prices[a.coinId])) {
          pendingUpdates.push({ id: a.id, amount: prices[a.coinId], lpu: now });
          log(a.name, true, prices[a.coinId]);
        } else {
          log(a.name, false);
          failed.push({ asset: a, type: 'coin' });
        }
      }
    } catch (e) {
      console.warn('autoUpdate coins batch failed:', e.message);
      coinAssets.forEach(a => { log(a.name, false); failed.push({ asset: a, type: 'coin' }); });
    }
    autoUpdateProgress.done++;
    onProgress?.(autoUpdateProgress);
  }

  // 3. Stocks sequential
  for (const item of updatable.filter(u => u.type === 'stock')) {
    try {
      const price = await fetchStockPrice(item.asset);
      if (price != null && isFinite(price)) {
        pendingUpdates.push({ id: item.asset.id, amount: price, lpu: now });
        log(item.asset.name, true, price);
      } else {
        log(item.asset.name, false);
        failed.push(item);
      }
    } catch (e) {
      console.warn('autoUpdate stock failed:', item.asset.name, e.message);
      log(item.asset.name, false);
      failed.push(item);
    }
    autoUpdateProgress.done++;
    onProgress?.(autoUpdateProgress);
    await sleep(STOCK_DELAY_MS);
  }

  // 4. Retry failed once
  if (failed.length > 0) {
    await sleep(RETRY_DELAY_MS);
    for (const item of failed) {
      try {
        let price = null;
        if (item.type === 'usdt') {
          const rate = await fetchUsdtRate();
          const qty = item.asset.usdtQty;
          price = (qty != null && qty > 0) ? Math.round(rate * qty) : rate;
        } else if (item.type === 'coin') {
          const prices = await fetchCoinPrices([item.asset.coinId]);
          price = prices[item.asset.coinId];
        } else {
          price = await fetchStockPrice(item.asset);
        }
        if (price != null && isFinite(price)) {
          pendingUpdates.push({ id: item.asset.id, amount: price, lpu: now });
          log(item.asset.name + ' (재시도)', true, price);
          failCount--;
        }
      } catch (e) {
        console.warn('autoUpdate retry failed:', item.asset?.name, e.message);
      }
    }
  }

  batchUpdatePrices(pendingUpdates);

  autoUpdateProgress.running = false;
  onProgress?.({ ...autoUpdateProgress, done: autoUpdateProgress.total });

  const summary = { success: successCount, failed: failCount, total: totalAssets };
  EventBus.emit('updateComplete', { logs: updateLogs, summary });
  return summary;
}
