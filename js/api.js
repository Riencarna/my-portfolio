/* =============================================
   My Portfolio v5.37.1 — API Integration
   Cycle C compatible
   Naver world stock, Promise.any parallel CORS
   국내주식: polling 1순위 (Worker 차단된 m.stock 우회)
   stale 가격 감지 (사일런트 실패 방지)
   ============================================= */

// ── Cache ──
let cachedRate = null;
let cachedUsdt = null;
let cachedBenchmark = null;
let updateLogs = [];
let autoUpdateProgress = { total: 0, done: 0, running: false };

const MP_FALLBACK_HEADER = 'X-MP-Cache-Fallback';
const MP_FALLBACK_REASON_HEADER = 'X-MP-Fallback-Reason';
const MP_ORIGIN_STATUS_HEADER = 'X-MP-Origin-Status';
const MP_CACHED_AT_HEADER = 'X-MP-Cache-Stored-At';
const MP_FALLBACK_HEADERS = [
  MP_FALLBACK_HEADER,
  MP_FALLBACK_REASON_HEADER,
  MP_ORIGIN_STATUS_HEADER,
  MP_CACHED_AT_HEADER,
];

function createPriceFetchMeta() {
  return { cacheFallback: false, reasons: [], originStatuses: [], cachedAt: '' };
}

function readCacheFallbackInfo(resp) {
  if (!resp?.headers || resp.headers.get(MP_FALLBACK_HEADER) !== '1') return null;
  return {
    reason: resp.headers.get(MP_FALLBACK_REASON_HEADER) || 'server-error',
    originStatus: resp.headers.get(MP_ORIGIN_STATUS_HEADER) || '',
    cachedAt: resp.headers.get(MP_CACHED_AT_HEADER) || '',
  };
}

function mergeCacheFallbackMeta(meta, info) {
  if (!meta || !info) return false;
  meta.cacheFallback = true;
  if (info.reason && !meta.reasons.includes(info.reason)) meta.reasons.push(info.reason);
  if (info.originStatus && !meta.originStatuses.includes(info.originStatus)) meta.originStatuses.push(info.originStatus);
  if (info.cachedAt) {
    const currentMs = new Date(meta.cachedAt).getTime();
    const incomingMs = new Date(info.cachedAt).getTime();
    if (!meta.cachedAt || (Number.isFinite(incomingMs) && (!Number.isFinite(currentMs) || incomingMs < currentMs))) {
      meta.cachedAt = info.cachedAt;
    }
  }
  return true;
}

function noteCacheFallbackResponse(resp, meta) {
  return mergeCacheFallbackMeta(meta, readCacheFallbackInfo(resp));
}

function fallbackInfoTime(info) {
  const time = new Date(info?.cachedAt || '').getTime();
  return Number.isFinite(time) && time > 0 ? time : 0;
}

function createAllOriginsContentResponse(data, wrapperResp) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const name of MP_FALLBACK_HEADERS) {
    const value = wrapperResp?.headers?.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(data.contents, { status: 200, headers });
}

// ── Last-Known Rate Snapshot (localStorage) ──
// 모든 라이브 시세 소스가 실패했을 때 1350원 하드코딩 폴백 대신 사용.
// 키: 'usdkrw' (환율), 'usdt' (테더 KRW 시세). 키 이름은 상수가 아닌 문자열로 두어
// 스냅샷 JSON 구조가 단순하게 유지되도록 했음.
function saveLastRate(kind, rate, source) {
  if (!Number.isFinite(rate) || rate <= 0) return;
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const snap = raw ? JSON.parse(raw) : {};
    snap[kind] = { rate, time: Date.now(), source };
    localStorage.setItem(RATE_KEY, JSON.stringify(snap));
  } catch (e) {
    console.warn('saveLastRate failed:', e.message);
  }
}

function getLastRate(kind) {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    const entry = snap?.[kind];
    if (!entry || !Number.isFinite(entry.rate) || entry.rate <= 0) return null;
    return entry;
  } catch (e) {
    return null;
  }
}

function formatRateAge(time) {
  const diffMin = Math.floor((Date.now() - time) / 60_000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  return `${Math.floor(diffH / 24)}일 전`;
}

// 동기 USDT 환율 조회 — UI 입력 폼에서 즉시 환산값 표시용.
// 폴백: 라이브 캐시 → 마지막 USDT → 마지막 환율 → 1350원.
// `1350원이 silently 박히는 것`을 방지하기 위해 source/age도 같이 반환.
function getUsdtRateSync() {
  if (cachedUsdt && Number.isFinite(cachedUsdt.rate) && cachedUsdt.rate > 0) {
    return { rate: cachedUsdt.rate, source: cachedUsdt.source || 'live', time: cachedUsdt.time, fallback: !!cachedUsdt.fallbackInfo };
  }
  const lastUsdt = getLastRate('usdt');
  if (lastUsdt) {
    return { rate: lastUsdt.rate, source: lastUsdt.source || 'last-known', time: lastUsdt.time, fallback: 'last-usdt' };
  }
  const lastUsdkrw = getLastRate('usdkrw');
  if (lastUsdkrw) {
    return { rate: lastUsdkrw.rate, source: lastUsdkrw.source || 'last-known', time: lastUsdkrw.time, fallback: 'last-rate' };
  }
  return { rate: FALLBACK_USD_KRW, source: 'default', time: null, fallback: 'hardcoded' };
}

function getRateDisplayInfo(kind) {
  const live = kind === 'usdkrw' ? cachedRate : cachedUsdt;
  if (live && Number.isFinite(live.rate) && live.rate > 0) {
    return { rate: live.rate, source: live.source || 'live', time: live.time, fallback: !!live.fallbackInfo };
  }
  const last = getLastRate(kind);
  if (last) {
    return { rate: last.rate, source: last.source || 'last-known', time: last.time, fallback: true };
  }
  return null;
}

function getKimchiPremiumInfo() {
  const usd = getRateDisplayInfo('usdkrw');
  const usdt = getRateDisplayInfo('usdt');
  if (!usd || !usdt || usd.rate <= 0 || usdt.rate <= 0) {
    return null;
  }
  const premium = ((usdt.rate / usd.rate) - 1) * 100;
  return {
    premium,
    usdRate: usd.rate,
    usdtRate: usdt.rate,
    usdSource: usd.source,
    usdtSource: usdt.source,
    fallback: !!(usd.fallback || usdt.fallback),
    time: Math.max(safeNum(usd.time), safeNum(usdt.time)),
  };
}

// 환율 출처를 한국어 라벨로 — UI hint 표시용
function describeRateSource(info) {
  if (!info) return '';
  if (info.fallback === false) return '현재 시세';
  if (info.fallback === 'last-usdt') return `마지막 저장 (${formatRateAge(info.time)})`;
  if (info.fallback === 'last-rate') return `마지막 환율 (${formatRateAge(info.time)})`;
  if (info.fallback === 'hardcoded') return '⚠️ 기본값 (시세 없음)';
  return '';
}

// ── Fetch with Timeout ──
function fetchWithTimeout(url, ms = API_TIMEOUT, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── Gemini API ──
function getGeminiApiKey() {
  try { return localStorage.getItem(GEMINI_API_KEY_KEY) || ''; } catch (_) { return ''; }
}

function saveGeminiApiKey(key) {
  const clean = stripHtml(key, 200).trim();
  if (!clean) return false;
  localStorage.setItem(GEMINI_API_KEY_KEY, clean);
  return true;
}

function clearGeminiApiKey() {
  try { localStorage.removeItem(GEMINI_API_KEY_KEY); } catch (_) {}
}

async function _readGeminiError(resp) {
  try {
    const data = await resp.json();
    return data?.error?.message || data?.message || `${resp.status} ${resp.statusText}`;
  } catch (_) {
    try { return await resp.text(); } catch (e) { return `${resp.status} ${resp.statusText}`; }
  }
}

function _extractGeminiText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const oldText = data.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
  if (oldText) return oldText;
  const outputs = data.output || data.outputs;
  if (Array.isArray(outputs)) {
    const text = outputs.map(o => o.text || o.output_text || '').filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  if (Array.isArray(data.steps)) {
    const chunks = [];
    const walk = (node) => {
      if (!node || chunks.length > 40) return;
      if (typeof node === 'string') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node === 'object') {
        if (typeof node.text === 'string') chunks.push(node.text);
        if (typeof node.output_text === 'string') chunks.push(node.output_text);
        Object.entries(node).forEach(([key, val]) => {
          if (!['input', 'prompt', 'system_instruction'].includes(key)) walk(val);
        });
      }
    };
    walk(data.steps);
    const text = chunks.filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  return '';
}

async function generateGeminiPortfolioAnalysis(prompt) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API 키가 없습니다.');

  const system = [
    '당신은 한국어로 답하는 개인 포트폴리오 분석 도우미입니다.',
    '사용자의 입력 데이터 안에서만 판단하고, 확실하지 않은 내용은 추정이라고 표시하세요.',
    '투자 매수/매도 지시가 아니라 리스크, 분산, 점검 포인트 중심으로 간결하게 답하세요.',
  ].join(' ');

  const interactionsPayload = {
    model: GEMINI_MODEL,
    system_instruction: system,
    input: prompt,
    generation_config: { temperature: 0.35, thinking_level: 'low' },
  };

  try {
    const resp = await fetchWithTimeout(`${API.gemini}/interactions`, 30000, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(interactionsPayload),
    });
    if (!resp.ok) throw new Error(await _readGeminiError(resp));
    const data = await resp.json();
    const text = _extractGeminiText(data);
    if (text) return text;
    throw new Error('Gemini 응답에서 텍스트를 찾지 못했습니다.');
  } catch (primaryErr) {
    console.warn('Gemini Interactions API failed, trying generateContent:', primaryErr.message);
    const fallbackPayload = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35 },
    };
    const resp = await fetchWithTimeout(`${API.gemini}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, 30000, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(fallbackPayload),
    });
    if (!resp.ok) throw new Error(await _readGeminiError(resp));
    const data = await resp.json();
    const text = _extractGeminiText(data);
    if (!text) throw new Error('Gemini 응답에서 텍스트를 찾지 못했습니다.');
    return text;
  }
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

  // 2. My proxy (Cloudflare Worker) — primary
  try {
    const r = await fetchWithTimeout(`${MY_PROXY_URL}/?url=${encodeURIComponent(url)}`, timeout);
    if (r.ok) return r;
  } catch (e) {
    console.warn('corsFetch my proxy failed:', e.message);
  }

  // 3. Custom proxy (power-user setting)
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

  // 4. Public proxies — fallback race (fastest wins)
  try {
    const proxyPromises = CORS_PROXIES.map(proxy =>
      fetchWithTimeout(proxy(url), timeout).then(r => {
        if (r.ok) return r;
        throw new Error('not ok: ' + r.status);
      })
    );
    proxyPromises.push(
      fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, timeout)
        .then(async r => {
          if (!r.ok) throw new Error('allorigins not ok: ' + r.status);
          const d = await r.json();
          if (!d.contents) throw new Error('allorigins empty');
          return createAllOriginsContentResponse(d, r);
        })
    );
    return await Promise.any(proxyPromises);
  } catch (e) {
    throw new Error(`네트워크 요청 실패: ${url.split('?')[0]}`);
  }
}

// ── Exchange Rate (USD -> KRW) ──
// 우선순위: Yahoo KRW=X → Daum FRX.KRWUSD → open.er-api → floatrates.
// 앞 두 곳은 실시간 외환시세, 뒤 두 곳은 하루 1~2회 갱신되는 reference rate라 폴백 전용.
// Upbit USDC/USDT는 김치프리미엄이 끼어 환율 지표로 부적합 → 제외.
async function fetchExchangeRate(force = false, meta = null) {
  if (!force && cachedRate && Date.now() - cachedRate.time < CACHE_TTL_RATE) {
    mergeCacheFallbackMeta(meta, cachedRate.fallbackInfo);
    return cachedRate.rate;
  }
  try {
    const r = await corsFetch(`${API.yahoo}/v8/finance/chart/KRW=X?interval=1m&range=1d`, 5000);
    const d = await r.json();
    const price = d.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (Number.isFinite(price) && price > 0) {
      const fallbackInfo = readCacheFallbackInfo(r);
      mergeCacheFallbackMeta(meta, fallbackInfo);
      cachedRate = { rate: price, time: fallbackInfoTime(fallbackInfo) || Date.now(), source: fallbackInfo ? 'sw-cache' : 'yahoo', fallbackInfo };
      if (!fallbackInfo) saveLastRate('usdkrw', cachedRate.rate, 'yahoo');
      return cachedRate.rate;
    }
  } catch (e) {
    console.warn('fetchExchangeRate yahoo failed:', e.message);
  }
  try {
    const r = await corsFetch(`${API.daum}/FRX.KRWUSD`, 5000);
    const d = await r.json();
    if (Number.isFinite(d.basePrice) && d.basePrice > 0) {
      const fallbackInfo = readCacheFallbackInfo(r);
      mergeCacheFallbackMeta(meta, fallbackInfo);
      cachedRate = { rate: d.basePrice, time: fallbackInfoTime(fallbackInfo) || Date.now(), source: fallbackInfo ? 'sw-cache' : 'daum', fallbackInfo };
      if (!fallbackInfo) saveLastRate('usdkrw', cachedRate.rate, 'daum');
      return cachedRate.rate;
    }
  } catch (e) {
    console.warn('fetchExchangeRate daum failed:', e.message);
  }
  try {
    const r = await fetchWithTimeout(API.openER, 5000);
    const d = await r.json();
    if (d.rates?.KRW) {
      const fallbackInfo = readCacheFallbackInfo(r);
      mergeCacheFallbackMeta(meta, fallbackInfo);
      cachedRate = { rate: d.rates.KRW, time: fallbackInfoTime(fallbackInfo) || Date.now(), source: fallbackInfo ? 'sw-cache' : 'open.er-api', fallbackInfo };
      if (!fallbackInfo) saveLastRate('usdkrw', cachedRate.rate, 'open.er-api');
      return cachedRate.rate;
    }
  } catch (e) {
    console.warn('fetchExchangeRate open.er-api failed:', e.message);
  }
  try {
    const r = await corsFetch(API.floatRates, 5000);
    const d = await r.json();
    if (d.krw?.rate) {
      const fallbackInfo = readCacheFallbackInfo(r);
      mergeCacheFallbackMeta(meta, fallbackInfo);
      cachedRate = { rate: d.krw.rate, time: fallbackInfoTime(fallbackInfo) || Date.now(), source: fallbackInfo ? 'sw-cache' : 'floatrates', fallbackInfo };
      if (!fallbackInfo) saveLastRate('usdkrw', cachedRate.rate, 'floatrates');
      return cachedRate.rate;
    }
  } catch (e) {
    console.warn('fetchExchangeRate floatrates failed:', e.message);
  }
  if (cachedRate?.rate) {
    mergeCacheFallbackMeta(meta, cachedRate.fallbackInfo);
    return cachedRate.rate;
  }
  const last = getLastRate('usdkrw');
  if (last) {
    console.warn('Exchange rate: using last-known snapshot', last);
    showToast(`환율 API 실패. 마지막 저장 환율(${Math.round(last.rate)}원, ${formatRateAge(last.time)}) 사용 중`, 'info');
    const fallbackInfo = { reason: 'app-cache', originStatus: '', cachedAt: new Date(last.time).toISOString() };
    mergeCacheFallbackMeta(meta, fallbackInfo);
    cachedRate = { rate: last.rate, time: last.time, source: 'last-known', fallbackInfo };
    return last.rate;
  }
  console.warn('Exchange rate: using fallback', FALLBACK_USD_KRW);
  showToast(`환율 정보 불러오기 실패. 기본값(${FALLBACK_USD_KRW}원) 사용 중`, 'warning');
  return FALLBACK_USD_KRW;
}

// 금융 입력 저장용 환율. 출처가 없는 하드코딩 기본값은 반환하지 않는다.
// 호출부는 null일 때 사용자가 환율을 직접 입력하도록 안내해야 한다.
async function fetchReliableExchangeRate() {
  const rate = await fetchExchangeRate();
  const info = getRateDisplayInfo('usdkrw');
  if (!info || !Number.isFinite(info.rate) || info.rate <= 0) return null;
  return Number.isFinite(rate) && rate > 0 ? rate : info.rate;
}

// ── USDT Rate (KRW) ──
async function fetchUsdtRate(meta = null) {
  if (cachedUsdt && Date.now() - cachedUsdt.time < CACHE_TTL_RATE) {
    mergeCacheFallbackMeta(meta, cachedUsdt.fallbackInfo);
    return cachedUsdt.rate;
  }
  try {
    const r = await fetchWithTimeout(`${API.upbit}?markets=KRW-USDT`, 5000);
    const d = await r.json();
    if (d[0]?.trade_price) {
      const fallbackInfo = readCacheFallbackInfo(r);
      mergeCacheFallbackMeta(meta, fallbackInfo);
      cachedUsdt = { rate: d[0].trade_price, time: fallbackInfoTime(fallbackInfo) || Date.now(), source: fallbackInfo ? 'sw-cache' : 'Upbit', fallbackInfo };
      if (!fallbackInfo) saveLastRate('usdt', cachedUsdt.rate, 'Upbit');
      return cachedUsdt.rate;
    }
  } catch (e) {
    console.warn('fetchUsdtRate upbit failed:', e.message);
  }
  try {
    const r = await corsFetch(`${API.bithumb}/USDT_KRW`, 5000);
    const d = await r.json();
    if (d.data?.closing_price) {
      const fallbackInfo = readCacheFallbackInfo(r);
      mergeCacheFallbackMeta(meta, fallbackInfo);
      cachedUsdt = { rate: Number(d.data.closing_price), time: fallbackInfoTime(fallbackInfo) || Date.now(), source: fallbackInfo ? 'sw-cache' : 'Bithumb', fallbackInfo };
      if (!fallbackInfo) saveLastRate('usdt', cachedUsdt.rate, 'Bithumb');
      return cachedUsdt.rate;
    }
  } catch (e) {
    console.warn('fetchUsdtRate bithumb failed:', e.message);
  }
  // 직거래 시세 두 곳 모두 실패. 라이브 환율(USD/KRW)이 캐시에 살아있으면 그걸 프록시로 사용.
  // 없으면 마지막에 봤던 USDT 시세 → 마지막 환율 → 1350원 순으로 폴백.
  if (cachedRate && Date.now() - cachedRate.time < CACHE_TTL_RATE && cachedRate.source !== 'last-known') {
    mergeCacheFallbackMeta(meta, cachedRate.fallbackInfo);
    cachedUsdt = { rate: cachedRate.rate, time: cachedRate.time, source: 'Exchange', fallbackInfo: cachedRate.fallbackInfo || null };
    return cachedRate.rate;
  }
  const lastUsdt = getLastRate('usdt');
  if (lastUsdt) {
    console.warn('USDT rate: using last-known USDT snapshot', lastUsdt);
    showToast(`USDT 시세 API 실패. 마지막 저장 시세(${Math.round(lastUsdt.rate)}원, ${formatRateAge(lastUsdt.time)}) 사용 중`, 'info');
    const fallbackInfo = { reason: 'app-cache', originStatus: '', cachedAt: new Date(lastUsdt.time).toISOString() };
    mergeCacheFallbackMeta(meta, fallbackInfo);
    cachedUsdt = { rate: lastUsdt.rate, time: lastUsdt.time, source: 'last-known', fallbackInfo };
    return lastUsdt.rate;
  }
  // 마지막 카드: fetchExchangeRate가 자체 last-known/fallback 처리 후 토스트도 띄움
  try {
    const rate = await fetchExchangeRate(false, meta);
    const fallbackInfo = meta?.cacheFallback ? {
      reason: meta.reasons[0] || 'server-error',
      originStatus: meta.originStatuses[0] || '',
      cachedAt: meta.cachedAt || '',
    } : null;
    cachedUsdt = { rate, time: fallbackInfoTime(fallbackInfo) || Date.now(), source: 'Exchange', fallbackInfo };
    return rate;
  } catch (e) {
    console.warn('fetchUsdtRate exchange fallback failed:', e.message);
  }
  if (cachedUsdt?.rate) {
    mergeCacheFallbackMeta(meta, cachedUsdt.fallbackInfo);
    return cachedUsdt.rate;
  }
  console.warn('USDT rate: using hardcoded fallback', FALLBACK_USD_KRW);
  showToast(`USDT 시세를 불러올 수 없습니다. 기본값(${FALLBACK_USD_KRW}원) 사용 중`, 'warning');
  return FALLBACK_USD_KRW;
}

// ── Coin Prices (CoinGecko) ──
async function fetchCoinPrices(coinIds, meta = null) {
  if (!coinIds || !coinIds.length) return {};
  const ids = coinIds.join(',');
  const url = `${API.coingecko}/simple/price?ids=${ids}&vs_currencies=krw`;
  try {
    const r = await fetchWithTimeout(url, API_TIMEOUT);
    if (r.ok) {
      const d = await r.json();
      const prices = extractCoinPrices(d);
      if (Object.keys(prices).length > 0) noteCacheFallbackResponse(r, meta);
      return prices;
    }
  } catch (e) {
    console.warn('fetchCoinPrices direct failed:', e.message);
  }
  try {
    const r = await corsFetch(url, 10000);
    const d = await r.json();
    const prices = extractCoinPrices(d);
    if (Object.keys(prices).length > 0) noteCacheFallbackResponse(r, meta);
    return prices;
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
async function fetchStockPrice(asset, meta = null) {
  const { stockCode, market, name } = asset;
  if (!stockCode && !(name && ETF_PREFIXES.some(p => name.toUpperCase().startsWith(p)))) {
    return null;
  }
  if (stockCode && !['KOSPI', 'KOSDAQ'].includes(market)) {
    return fetchForeignStockPrice(stockCode, market, meta);
  }
  if (stockCode) {
    return fetchKoreanStockPrice(stockCode, meta);
  }
  return null;
}

async function fetchKoreanStockPrice(code, meta = null) {
  // 1. Naver polling API (실시간) — Worker 화이트리스트 통과, 1순위로 승격(v5.11.1)
  try {
    const r = await corsFetch(`${API.naverPolling}/${code}`, API_TIMEOUT);
    const d = await r.json();
    const item = d.datas?.[0];
    if (item) {
      const price = item.closePriceRaw ?? safeNum(String(item.closePrice).replace(/,/g, ''));
      if (price && isFinite(price)) {
        noteCacheFallbackResponse(r, meta);
        return Math.round(price);
      }
    }
  } catch (e) {
    console.warn('fetchKoreanStockPrice naver polling failed:', code, e.message);
  }
  // 2. Naver mobile API (보조)
  try {
    const r = await corsFetch(`${API.naver}/${code}/basic`, API_TIMEOUT);
    const d = await r.json();
    const price = d.closePrice || d.currentPrice;
    const numericPrice = safeNum(String(price || '').replace(/,/g, ''));
    if (numericPrice > 0) {
      noteCacheFallbackResponse(r, meta);
      return numericPrice;
    }
  } catch (e) {
    console.warn('fetchKoreanStockPrice naver failed:', code, e.message);
  }
  // 3. Yahoo Finance fallback
  for (const suffix of ['.KS', '.KQ']) {
    try {
      const r = await corsFetch(`${API.yahoo}/v8/finance/chart/${code}${suffix}?interval=1d&range=1d`, API_TIMEOUT);
      const d = await r.json();
      const price = d.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && isFinite(price)) {
        noteCacheFallbackResponse(r, meta);
        return Math.round(price);
      }
    } catch (e) {
      console.warn(`fetchKoreanStockPrice yahoo ${suffix} failed:`, code, e.message);
    }
  }
  return null;
}

async function fetchForeignStockPrice(symbol, market, meta = null) {
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
          noteCacheFallbackResponse(r, meta);
          const rate = await fetchExchangeRate(false, meta);
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
    const quoteMeta = d.chart?.result?.[0]?.meta;
    if (quoteMeta?.regularMarketPrice && isFinite(quoteMeta.regularMarketPrice)) {
      const price = quoteMeta.regularMarketPrice;
      noteCacheFallbackResponse(r, meta);
      if (quoteMeta.currency === 'KRW') return Math.round(price);
      const rate = await fetchExchangeRate(false, meta);
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
        noteCacheFallbackResponse(r, meta);
        const rate = await fetchExchangeRate(false, meta);
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

async function autoUpdateAll(onProgress, options = {}) {
  const { silent = false } = options;
  if (_updatePromise) {
    if (!silent) showToast('업데이트가 이미 진행 중입니다', 'info');
    return { success: 0, fallback: 0, failed: 0, stale: 0, total: 0, skipped: true };
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
  let fallbackCount = 0;
  let failCount = 0;
  let staleCount = 0;

  for (const a of assets) {
    if (a.category === '코인' && a.coinId) coinAssets.push(a);
    else if (a.category === '현금' && a.isUsdt) updatable.push({ asset: a, type: 'usdt' });
    else if (a.stockCode) updatable.push({ asset: a, type: 'stock' });
  }

  const totalAssets = updatable.length + coinAssets.length;
  autoUpdateProgress.total = updatable.length + (coinAssets.length > 0 ? 1 : 0);
  autoUpdateProgress.done = 0;

  // 직전 상태 스냅샷. stale 판정(사일런트 실패 방지)
  const prevMap = new Map(assets.map(a => [a.id, { amount: a.amount, lpu: a.lpu }]));
  const isStale = (asset, newPrice) => {
    if (newPrice == null || !isFinite(newPrice)) return false;
    const prev = prevMap.get(asset.id);
    if (!prev || prev.amount !== newPrice) return false;
    if (!prev.lpu) return false;
    const prevLpuMs = new Date(prev.lpu).getTime();
    if (!isFinite(prevLpuMs) || prevLpuMs <= 0) return false;
    return (Date.now() - prevLpuMs) > STALE_DETECT_MS;
  };

  const log = (asset, status, price, stale = false, meta = null, suffix = '') => {
    const cacheFallback = status === 'fallback';
    updateLogs.push({
      assetId: asset?.id || '',
      name: (asset?.name || '') + suffix,
      status,
      ok: status !== 'failed',
      price,
      stale,
      cacheFallback,
      fallbackReason: meta?.reasons?.[0] || '',
      originStatus: meta?.originStatuses?.[0] || '',
      cacheStoredAt: meta?.cachedAt || '',
      time: new Date().toISOString(),
    });
    if (updateLogs.length > LIMITS.logs) updateLogs.shift();
    if (status === 'live') successCount++;
    else if (cacheFallback) fallbackCount++;
    else failCount++;
    if (stale) staleCount++;
  };

  const addPendingUpdate = (asset, amount, meta) => {
    const update = { id: asset.id, amount };
    if (!meta?.cacheFallback) update.lpu = now;
    pendingUpdates.push(update);
  };

  const removeFailedLog = (asset) => {
    const idx = updateLogs.findIndex(entry => entry.assetId === asset.id && entry.status === 'failed');
    if (idx >= 0) updateLogs.splice(idx, 1);
    failCount = Math.max(0, failCount - 1);
  };

  const now = new Date().toLocaleString('ko-KR');

  // 1. USDT
  for (const item of updatable.filter(u => u.type === 'usdt')) {
    try {
      const meta = createPriceFetchMeta();
      const rate = await fetchUsdtRate(meta);
      if (rate && isFinite(rate)) {
        const qty = item.asset.usdtQty;
        const amt = (qty != null && qty > 0) ? Math.round(rate * qty) : rate;
        addPendingUpdate(item.asset, amt, meta);
        log(item.asset, meta.cacheFallback ? 'fallback' : 'live', amt, isStale(item.asset, amt), meta);
      } else {
        log(item.asset, 'failed');
        failed.push(item);
      }
    } catch (e) {
      console.warn('autoUpdate USDT failed:', item.asset.name, e.message);
      log(item.asset, 'failed');
      failed.push(item);
    }
    autoUpdateProgress.done++;
    onProgress?.(autoUpdateProgress);
  }

  // 2. Coins batch
  if (coinAssets.length > 0) {
    const ids = [...new Set(coinAssets.map(a => a.coinId))];
    try {
      const meta = createPriceFetchMeta();
      const prices = await fetchCoinPrices(ids, meta);
      for (const a of coinAssets) {
        if (prices[a.coinId] && isFinite(prices[a.coinId])) {
          addPendingUpdate(a, prices[a.coinId], meta);
          log(a, meta.cacheFallback ? 'fallback' : 'live', prices[a.coinId], isStale(a, prices[a.coinId]), meta);
        } else {
          log(a, 'failed');
          failed.push({ asset: a, type: 'coin' });
        }
      }
    } catch (e) {
      console.warn('autoUpdate coins batch failed:', e.message);
      coinAssets.forEach(a => { log(a, 'failed'); failed.push({ asset: a, type: 'coin' }); });
    }
    autoUpdateProgress.done++;
    onProgress?.(autoUpdateProgress);
  }

  // 3. Stocks sequential
  for (const item of updatable.filter(u => u.type === 'stock')) {
    try {
      const meta = createPriceFetchMeta();
      const price = await fetchStockPrice(item.asset, meta);
      if (price != null && isFinite(price)) {
        addPendingUpdate(item.asset, price, meta);
        log(item.asset, meta.cacheFallback ? 'fallback' : 'live', price, isStale(item.asset, price), meta);
      } else {
        log(item.asset, 'failed');
        failed.push(item);
      }
    } catch (e) {
      console.warn('autoUpdate stock failed:', item.asset.name, e.message);
      log(item.asset, 'failed');
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
        const meta = createPriceFetchMeta();
        if (item.type === 'usdt') {
          const rate = await fetchUsdtRate(meta);
          const qty = item.asset.usdtQty;
          price = (qty != null && qty > 0) ? Math.round(rate * qty) : rate;
        } else if (item.type === 'coin') {
          const prices = await fetchCoinPrices([item.asset.coinId], meta);
          price = prices[item.asset.coinId];
        } else {
          price = await fetchStockPrice(item.asset, meta);
        }
        if (price != null && isFinite(price)) {
          addPendingUpdate(item.asset, price, meta);
          removeFailedLog(item.asset);
          log(item.asset, meta.cacheFallback ? 'fallback' : 'live', price, isStale(item.asset, price), meta, ' (재시도)');
        }
      } catch (e) {
        console.warn('autoUpdate retry failed:', item.asset?.name, e.message);
      }
    }
  }

  batchUpdatePrices(pendingUpdates);

  autoUpdateProgress.running = false;
  onProgress?.({ ...autoUpdateProgress, done: autoUpdateProgress.total });

  const summary = { success: successCount, fallback: fallbackCount, failed: failCount, stale: staleCount, total: totalAssets };
  EventBus.emit('updateComplete', { logs: updateLogs, summary });
  return summary;
}
