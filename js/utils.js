/* =============================================
   My Portfolio v5.4.1 — Utilities
   Planner-Creator-Evaluator Cycle 2
   uid() returns crypto.randomUUID string
   Scoped Cleanup for modular listener management
   ============================================= */

// ── HTML Security ──
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(s) { return escHtml(s); }

function stripHtml(s, max = 200) {
  if (s == null) return '';
  return String(s).trim().slice(0, max).replace(/[<>]/g, '');
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// ── Formatting ──
function fmtKRW(n) {
  n = safeNum(n);
  const sign = n < 0 ? '-' : '';
  return sign + '₩' + Math.abs(Math.round(n)).toLocaleString('ko-KR');
}

function fmtAmountHint(n) {
  n = safeNum(n);
  if (n <= 0) return '';
  const abs = Math.abs(n);
  if (abs >= 1e12) return '= ' + (n / 1e12).toFixed(2) + '조원';
  if (abs >= 1e8) return '= ' + (n / 1e8).toFixed(2) + '억원';
  if (abs >= 1e4) return '= ' + (n / 1e4).toFixed(0) + '만원';
  return '= ' + Math.round(n).toLocaleString('ko-KR') + '원';
}

function fmtAmountHintUSD(n) {
  n = safeNum(n);
  if (n <= 0) return '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return '= $' + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '= $' + (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '= $' + (n / 1e3).toFixed(1) + 'K';
  return '= $' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n, dec = 0) {
  n = safeNum(n);
  return n.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(n, dec = 2) {
  n = safeNum(n);
  return (n >= 0 ? '+' : '') + n.toFixed(dec) + '%';
}

function fmtPrice(n) {
  n = safeNum(n);
  const abs = Math.abs(n);
  if (abs < 1) return n.toFixed(4);
  if (abs < 100) return n.toFixed(2);
  return Math.round(n).toLocaleString('ko-KR');
}

function fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
}

function fmtDateTime(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${fmtDate(dt)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}

function fmtRelTime(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return Math.floor(diff / 60000) + '분 전';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '시간 전';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '일 전';
  return fmtDate(dateStr);
}

function profitClass(value) { return value >= 0 ? 'positive' : 'negative'; }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isValidDate(str) {
  if (!str || typeof str !== 'string') return false;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && d.getDate() === Number(m[3]);
}

function clampDay(year, month, day) {
  const maxDay = new Date(year, month, 0).getDate();
  return Math.min(day, maxDay);
}

// ── Calculations (NaN-safe, cached per render cycle) ──
let _calcCache = null;
let _calcCacheKey = 0;

function invalidateCalcCache() { _calcCacheKey++; _calcCache = null; }

function calcAssetValue(asset) {
  const txns = asset.txns || [];
  let qty = 0, cost = 0;
  for (const t of txns) {
    const tPrice = safeNum(t.price);
    const tQty = safeNum(t.qty);
    if (t.type === 'buy') {
      qty += tQty;
      cost += tPrice * tQty;
    } else {
      if (qty > 0) {
        const sellQty = Math.min(tQty, qty);
        const avgCost = cost / qty;
        cost -= avgCost * sellQty;
        qty -= sellQty;
      }
    }
    qty = Math.max(0, qty);
    cost = Math.max(0, cost);
  }
  const price = safeNum(asset.amount);
  const value = safeNum(price * qty);
  const profit = safeNum(value - cost);
  const profitPct = cost > 0 ? safeNum((profit / cost) * 100) : 0;
  const avgPrice = qty > 0 ? safeNum(cost / qty) : 0;
  return { qty, cost, value, profit, profitPct, avgPrice, price };
}

function _buildCalcCache(assets) {
  const key = _calcCacheKey;
  if (_calcCache && _calcCache._key === key) return _calcCache;
  const byAsset = new Map();
  const byCat = {};
  let total = 0;
  for (const cat of CATEGORIES) byCat[cat.id] = 0;
  for (const a of assets) {
    const v = calcAssetValue(a);
    byAsset.set(a.id, v);
    byCat[a.category] = safeNum(byCat[a.category]) + safeNum(v.value);
    total += safeNum(v.value);
  }
  _calcCache = { _key: key, byAsset, byCat, total: safeNum(total) };
  return _calcCache;
}

function calcCategoryTotal(assets, catId) {
  return _buildCalcCache(assets).byCat[catId] || 0;
}

function calcTotal(assets) {
  return _buildCalcCache(assets).total;
}

function calcCategoryTotals(assets) {
  return { ..._buildCalcCache(assets).byCat };
}

// ── Validation ──
function isValidAsset(a) {
  return a && typeof a.name === 'string' && a.name.trim().length > 0 &&
    CAT_IDS.includes(a.category) && Array.isArray(a.txns);
}

// sanitizeAsset: coerces ID to String for backward compatibility with v2.x numeric IDs
function sanitizeAsset(a) {
  return {
    id: a.id != null ? String(a.id) : uid(),
    name: stripHtml(a.name, 100) || '이름 없음',
    category: CAT_IDS.includes(a.category) ? a.category : '기타',
    amount: safeNum(a.amount),
    note: a.note ? stripHtml(a.note, 500) : null,
    stockCode: a.stockCode ? stripHtml(a.stockCode, 20) : '',
    market: ['KOSPI','KOSDAQ','NYSE','NASDAQ',''].includes(a.market) ? a.market : '',
    coinId: a.coinId ? stripHtml(a.coinId, 100) : '',
    krxEtf: !!a.krxEtf,
    isUsdt: !!a.isUsdt,
    usdtQty: a.usdtQty != null ? safeNum(a.usdtQty) : undefined,
    usdtDetails: Array.isArray(a.usdtDetails) ? a.usdtDetails.slice(0, 50).map(d => ({ name: stripHtml(d.name, 50), qty: safeNum(d.qty) })) : undefined,
    walletCoinId: a.walletCoinId ? stripHtml(String(a.walletCoinId), 100) : undefined,
    lpu: (a.lpu && typeof a.lpu === 'string') ? stripHtml(a.lpu, 50) : null,
    txns: Array.isArray(a.txns) ? a.txns.slice(0, LIMITS.txns).map(sanitizeTxn) : [],
  };
}

// sanitizeTxn: coerces ID to String
function sanitizeTxn(t) {
  return {
    id: t.id != null ? String(t.id) : uid(),
    type: t.type === 'sell' ? 'sell' : 'buy',
    price: safeNum(t.price),
    qty: Math.max(0, safeNum(t.qty)),
    account: t.account ? stripHtml(t.account, 50) : null,
    date: isValidDate(t.date) ? t.date : today(),
    memo: t.memo ? stripHtml(t.memo, 200) : null,
  };
}

// sanitizeIncome: coerces ID to String, validates category
function sanitizeIncome(i) {
  return {
    id: i.id != null ? String(i.id) : uid(),
    date: isValidDate(i.date) ? i.date : today(),
    amount: safeNum(i.amount),
    cat: INCOME_MAP[i.cat] ? i.cat : 'other',
    source: i.source ? stripHtml(i.source, 100) : '',
    memo: i.memo ? stripHtml(i.memo, 200) : '',
    recurring: !!i.recurring,
  };
}

// ── DOM Helpers ──
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k.startsWith('on')) continue;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c instanceof Node) e.appendChild(c);
  }
  return e;
}

function showToast(msg, type = 'info') {
  const existing = $('.toast');
  if (existing) existing.remove();
  const t = el('div', { class: `toast toast-${type}`, text: msg, role: 'status' });
  const container = $('#toastContainer') || document.body;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), TOAST_FADE_MS);
  }, TOAST_DURATION_MS);
}

// ── Chart.js Safety ──
function isChartReady() {
  return typeof Chart !== 'undefined';
}

// ── Misc ──
function debounce(fn, ms = DEBOUNCE_MS) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// uid() uses crypto.randomUUID() — returns a STRING.
// NEVER wrap uid() results in Number() — they are not numeric.
function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function groupBy(arr, key) {
  return arr.reduce((g, item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    (g[k] = g[k] || []).push(item);
    return g;
  }, {});
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Scoped Cleanup Registry ──
const Cleanup = (() => {
  const _scopes = {};

  function _getScope(name) {
    if (!_scopes[name]) _scopes[name] = [];
    return _scopes[name];
  }

  return {
    scope(name) {
      return {
        add(element, event, handler, options) {
          element.addEventListener(event, handler, options);
          _getScope(name).push({ element, event, handler, options });
        },
        removeAll() {
          const listeners = _getScope(name);
          for (const { element, event, handler, options } of listeners) {
            try { element.removeEventListener(event, handler, options); } catch (e) {
              console.warn(`Cleanup.scope(${name}).removeAll: failed`, event, e);
            }
          }
          _scopes[name] = [];
        },
        removeForElement(el) {
          const scope = _getScope(name);
          _scopes[name] = scope.filter(l => {
            if (l.element === el) {
              try { l.element.removeEventListener(l.event, l.handler, l.options); } catch (e) {
                console.warn(`Cleanup.scope(${name}).removeForElement: failed`, l.event, e);
              }
              return false;
            }
            return true;
          });
        },
      };
    },

    add(element, event, handler, options) {
      element.addEventListener(event, handler, options);
      _getScope('global').push({ element, event, handler, options });
    },

    removeAll() {
      for (const name of Object.keys(_scopes)) {
        for (const { element, event, handler, options } of _scopes[name]) {
          try { element.removeEventListener(event, handler, options); } catch (e) {
            console.warn('Cleanup.removeAll: failed', event, e);
          }
        }
        _scopes[name] = [];
      }
    },

    removeForElement(targetEl) {
      for (const name of Object.keys(_scopes)) {
        _scopes[name] = _scopes[name].filter(l => {
          if (l.element === targetEl) {
            try { l.element.removeEventListener(l.event, l.handler, l.options); } catch (e) {
              console.warn('Cleanup.removeForElement: failed', l.event, e);
            }
            return false;
          }
          return true;
        });
      }
    },
  };
})();
