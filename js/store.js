/* =============================================
   My Portfolio v5.19.0 — State Management
   Cycle C compatible
   All IDs from uid() are STRINGS — never use Number() on them
   ============================================= */

// ── Default State ──
function defaultState() {
  return {
    assets: [],
    history: [],
    saved: null,
    categoryOrder: [...CAT_IDS],
    goal: null,
    income: [],
    allocation: null,
  };
}

// ── Global State ──
let appState = defaultState();
let activePortfolioId = 'default';

// ── Debounced Save ──
let _saveTimer = null;

function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { _saveTimer = null; _doSave(); }, SAVE_DEBOUNCE_MS);
}

function saveDataNow() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  return _doSave();
}

function saveData() {
  scheduleSave();
  return true;
}

function _doSave() {
  try {
    appState.saved = new Date().toISOString();
    const json = JSON.stringify(appState);
    if (json.length > LIMITS.storage) {
      showToast(`저장 공간 부족! (${(json.length / 1024).toFixed(0)}KB / ${(LIMITS.storage / 1024).toFixed(0)}KB)`, 'error');
      return false;
    }
    localStorage.setItem(getStorageKey(activePortfolioId), json);
    _invalidateStorageCache();
    EventBus.emit('dataSaved');
    tryAutoBackup('daily');
    return true;
  } catch (e) {
    console.error('Failed to save data:', e);
    if (e.name === 'QuotaExceededError') {
      showToast('브라우저 저장 공간이 가득 찼습니다. 불필요한 데이터를 삭제하세요.', 'error');
    } else {
      showToast('데이터 저장 실패', 'error');
    }
    return false;
  }
}

// ── Auto Backup (v5.19.0) ──
let _autoBackupCache = null;

function loadAutoBackups() {
  if (_autoBackupCache) return _autoBackupCache;
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        _autoBackupCache = parsed.filter(b => b && b.id && typeof b.json === 'string');
        return _autoBackupCache;
      }
    }
  } catch (e) {
    console.warn('loadAutoBackups failed:', e);
  }
  _autoBackupCache = [];
  return _autoBackupCache;
}

function _saveAutoBackups(list) {
  _autoBackupCache = list;
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(list));
    _invalidateStorageCache();
    return true;
  } catch (e) {
    console.warn('_saveAutoBackups failed:', e);
    if (e.name === 'QuotaExceededError' && list.length > 1) {
      return _saveAutoBackups(list.slice(1));
    }
    return false;
  }
}

function _pruneAutoBackups(list) {
  let result = list.slice();
  if (result.length > LIMITS.autoBackup) {
    result = result.slice(-LIMITS.autoBackup);
  }
  let totalSize = result.reduce((s, b) => s + (b.json ? b.json.length : 0), 0);
  while (result.length > 1 && totalSize > LIMITS.autoBackupBytes) {
    const removed = result.shift();
    totalSize -= (removed.json ? removed.json.length : 0);
  }
  return result;
}

function tryAutoBackup(trigger, label) {
  try {
    let list = loadAutoBackups().slice();
    if (trigger === 'daily') {
      const todayStr = today();
      if (list.some(b => b.trigger === 'daily' && typeof b.savedAt === 'string' && b.savedAt.startsWith(todayStr))) {
        return false;
      }
    }
    const json = JSON.stringify(appState);
    if (json.length > LIMITS.autoBackupBytes) {
      console.warn('tryAutoBackup: state too large for auto-backup', json.length);
      return false;
    }
    const entry = {
      id: 'ab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      savedAt: new Date().toISOString(),
      trigger: trigger || 'manual',
      label: label || (trigger === 'daily' ? '매일 자동 백업' : '주요 변경'),
      assetCount: appState.assets.length,
      total: calcTotal(appState.assets),
      json,
    };
    list.push(entry);
    list = _pruneAutoBackups(list);
    _saveAutoBackups(list);
    EventBus.emit('autoBackupChanged');
    return true;
  } catch (e) {
    console.warn('tryAutoBackup failed:', e);
    return false;
  }
}

function deleteAutoBackup(id) {
  const list = loadAutoBackups().filter(b => b.id !== id);
  _saveAutoBackups(list);
  EventBus.emit('autoBackupChanged');
}

function clearAutoBackups() {
  _saveAutoBackups([]);
  EventBus.emit('autoBackupChanged');
}

function restoreAutoBackup(id) {
  const list = loadAutoBackups();
  const entry = list.find(b => b.id === id);
  if (!entry) {
    showToast('백업을 찾을 수 없습니다', 'error');
    return false;
  }
  try {
    tryAutoBackup('major', '복원 직전 자동 저장');
    const data = JSON.parse(entry.json);
    appState = { ...defaultState(), ...data };
    if (!Array.isArray(appState.assets)) appState.assets = [];
    if (!Array.isArray(appState.history)) appState.history = [];
    if (!Array.isArray(appState.income)) appState.income = [];
    if (!Array.isArray(appState.categoryOrder)) appState.categoryOrder = [...CAT_IDS];
    appState.assets = appState.assets.slice(0, LIMITS.assets).map(sanitizeAsset);
    invalidateCalcCache();
    saveDataNow();
    EventBus.emit('dataImported');
    return true;
  } catch (e) {
    console.error('restoreAutoBackup failed:', e);
    showToast('복원 실패: 백업 데이터 손상', 'error');
    return false;
  }
}

// ── Portfolio Meta ──
function loadPortfolioMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.list) && parsed.list.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load portfolio meta:', e);
  }
  return { active: 'default', list: [{ id: 'default', name: '기본 포트폴리오' }] };
}

function savePortfolioMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error('Failed to save portfolio meta:', e);
    showToast('포트폴리오 메타 저장 실패', 'error');
  }
}

function getStorageKey(pid) {
  return pid === 'default' ? STORAGE_KEY : `${STORAGE_KEY}_${pid}`;
}

function initPortfolio() {
  const meta = loadPortfolioMeta();
  activePortfolioId = meta.active || 'default';
  if (!meta.list.find(p => p.id === activePortfolioId)) {
    activePortfolioId = meta.list[0]?.id || 'default';
    meta.active = activePortfolioId;
    savePortfolioMeta(meta);
  }
}

function switchPortfolio(pid) {
  const meta = loadPortfolioMeta();
  if (!meta.list.find(p => p.id === pid)) return false;
  saveDataNow();
  activePortfolioId = pid;
  meta.active = pid;
  savePortfolioMeta(meta);
  loadData();
  EventBus.emit('portfolioChanged', pid);
  return true;
}

function createPortfolio(name) {
  const meta = loadPortfolioMeta();
  if (meta.list.length >= LIMITS.portfolios) {
    showToast(`포트폴리오는 최대 ${LIMITS.portfolios}개까지`, 'error');
    return null;
  }
  const cleanName = stripHtml(name, 50);
  if (!cleanName) { showToast('이름을 입력하세요', 'error'); return null; }
  const id = 'pf_' + uid();
  meta.list.push({ id, name: cleanName });
  savePortfolioMeta(meta);
  try {
    localStorage.setItem(getStorageKey(id), JSON.stringify(defaultState()));
  } catch (e) {
    console.error('Failed to create portfolio:', e);
    showToast('포트폴리오 생성 실패', 'error');
    return null;
  }
  return id;
}

function renamePortfolio(pid, name) {
  const meta = loadPortfolioMeta();
  const pf = meta.list.find(p => p.id === pid);
  if (!pf) return;
  const cleanName = stripHtml(name, 50);
  if (!cleanName) return;
  pf.name = cleanName;
  savePortfolioMeta(meta);
}

function deletePortfolio(pid) {
  if (pid === 'default') { showToast('기본 포트폴리오는 삭제 불가', 'error'); return false; }
  const meta = loadPortfolioMeta();
  meta.list = meta.list.filter(p => p.id !== pid);
  try { localStorage.removeItem(getStorageKey(pid)); } catch (e) {
    console.warn('deletePortfolio: failed to remove storage key', e);
  }
  if (meta.active === pid) {
    meta.active = meta.list[0]?.id || 'default';
    activePortfolioId = meta.active;
  }
  savePortfolioMeta(meta);
  return true;
}

// ── Migration: v2.6.x short keys → v3.x+ full keys ──
function _migrateOldFormat(d) {
  if (d.a && !d.assets) d.assets = d.a;
  if (d.h && !d.history) d.history = d.h;
  if (d.s && !d.saved) d.saved = d.s;
  if (d.co && !d.categoryOrder) d.categoryOrder = d.co;
  if (d.inc && !d.income) d.income = d.inc;
  return d;
}

// ── Data Persistence ──
function loadData() {
  try {
    const raw = localStorage.getItem(getStorageKey(activePortfolioId));
    if (raw) {
      const parsed = _migrateOldFormat(JSON.parse(raw));
      appState = { ...defaultState(), ...parsed };
      if (!Array.isArray(appState.assets)) appState.assets = [];
      if (!Array.isArray(appState.history)) appState.history = [];
      if (!Array.isArray(appState.income)) appState.income = [];
      if (!Array.isArray(appState.categoryOrder)) appState.categoryOrder = [...CAT_IDS];
      for (const cid of CAT_IDS) {
        if (!appState.categoryOrder.includes(cid)) appState.categoryOrder.push(cid);
      }
      appState.categoryOrder = appState.categoryOrder.filter(c => CAT_IDS.includes(c));
      appState.assets = appState.assets.slice(0, LIMITS.assets).map(sanitizeAsset);
      appState.history = appState.history.slice(-LIMITS.history);
      appState.income = appState.income.map(sanitizeIncome);
    } else {
      appState = defaultState();
    }
  } catch (e) {
    console.error('Failed to load data:', e);
    appState = defaultState();
    showToast('데이터 로드 실패. 기본값으로 초기화됩니다.', 'error');
  }
  invalidateCalcCache();
  makeSnapshot();
  EventBus.emit('dataLoaded');
  tryAutoBackup('daily');
}

// ── Snapshots ──
function makeSnapshot() {
  const dateStr = today();
  const total = calcTotal(appState.assets);
  const byCategory = calcCategoryTotals(appState.assets);
  const byAsset = {};
  for (const a of appState.assets) {
    byAsset[a.id] = safeNum(calcAssetValue(a).value, 0);
  }
  const idx = appState.history.findIndex(h => h.date === dateStr);
  const snap = { date: dateStr, total, byCategory, byAsset };
  if (idx >= 0) appState.history[idx] = snap;
  else appState.history.push(snap);
  if (appState.history.length > LIMITS.history) {
    appState.history = appState.history.slice(-LIMITS.history);
  }
}

// ── History Delete ──
function deleteHistoryRecord(date) {
  const idx = appState.history.findIndex(h => h.date === date);
  if (idx < 0) return null;
  const snap = appState.history[idx];
  appState.history.splice(idx, 1);
  saveData();
  EventBus.emit('historyChanged', { type: 'delete', date });
  return () => {
    appState.history.splice(idx, 0, snap);
    saveData();
    EventBus.emit('historyChanged', { type: 'restore', date });
  };
}

// ── Asset CRUD ──
function addAsset(asset) {
  if (appState.assets.length >= LIMITS.assets) {
    showToast(`자산 최대 ${LIMITS.assets}개까지 추가 가능`, 'error');
    return null;
  }
  tryAutoBackup('major', `자산 추가 직전: ${stripHtml(asset && asset.name || '', 30) || '(이름없음)'}`);
  const a = sanitizeAsset({ ...asset, id: uid() });
  appState.assets.push(a);
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'add', asset: a });
  return a;
}

function updateAsset(id, updates) {
  const idx = appState.assets.findIndex(a => a.id === id);
  if (idx < 0) return null;
  appState.assets[idx] = sanitizeAsset({ ...appState.assets[idx], ...updates });
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'update', asset: appState.assets[idx] });
  return appState.assets[idx];
}

function batchUpdatePrices(updates) {
  let count = 0;
  for (const { id, amount, lpu } of updates) {
    const idx = appState.assets.findIndex(a => a.id === id);
    if (idx < 0) continue;
    appState.assets[idx].amount = safeNum(amount);
    if (lpu && typeof lpu === 'string') appState.assets[idx].lpu = stripHtml(lpu, 50);
    count++;
  }
  if (count > 0) {
    invalidateCalcCache();
    makeSnapshot();
    saveDataNow();
    EventBus.emit('assetChanged', { type: 'batchPrice', count });
  }
  return count;
}

function deleteAsset(id) {
  const idx = appState.assets.findIndex(a => a.id === id);
  if (idx < 0) return null;
  const asset = appState.assets[idx];
  tryAutoBackup('major', `자산 삭제 직전: ${asset.name}`);
  appState.assets.splice(idx, 1);
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'delete', asset });
  return () => {
    appState.assets.splice(idx, 0, asset);
    invalidateCalcCache();
    makeSnapshot();
    saveData();
    EventBus.emit('assetChanged', { type: 'restore', asset });
  };
}

function getAsset(id) {
  return appState.assets.find(a => a.id === id) || null;
}

// ── USDT Change History (v5.19.0) ──
function _buildUsdtHistoryEntry(asset) {
  return {
    at: new Date().toISOString(),
    usdtQty: safeNum(asset.usdtQty),
    usdtDetails: Array.isArray(asset.usdtDetails)
      ? asset.usdtDetails.map(d => ({ name: String(d.name || ''), qty: safeNum(d.qty) }))
      : [],
    amount: safeNum(asset.amount),
  };
}

function appendUsdtHistory(asset, prevSnapshot) {
  const existing = Array.isArray(asset.usdtHistory) ? asset.usdtHistory : [];
  const next = [...existing, prevSnapshot];
  return next.slice(-LIMITS.usdtHistory);
}

function restoreUsdtHistoryEntry(assetId, historyIdx) {
  const idx = appState.assets.findIndex(a => a.id === assetId);
  if (idx < 0) return false;
  const asset = appState.assets[idx];
  if (!asset.isUsdt || !Array.isArray(asset.usdtHistory)) return false;
  const entry = asset.usdtHistory[historyIdx];
  if (!entry) return false;
  const currentSnap = _buildUsdtHistoryEntry(asset);
  const newHistory = asset.usdtHistory
    .filter((_, i) => i !== historyIdx)
    .concat([currentSnap])
    .slice(-LIMITS.usdtHistory);
  appState.assets[idx] = sanitizeAsset({
    ...asset,
    usdtQty: safeNum(entry.usdtQty),
    usdtDetails: Array.isArray(entry.usdtDetails) ? entry.usdtDetails : [],
    amount: safeNum(entry.amount),
    usdtHistory: newHistory,
  });
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'restoreUsdtHistory', assetId });
  return true;
}

function deleteUsdtHistoryEntry(assetId, historyIdx) {
  const idx = appState.assets.findIndex(a => a.id === assetId);
  if (idx < 0) return false;
  const asset = appState.assets[idx];
  if (!Array.isArray(asset.usdtHistory)) return false;
  if (historyIdx < 0 || historyIdx >= asset.usdtHistory.length) return false;
  const newHistory = asset.usdtHistory.filter((_, i) => i !== historyIdx);
  appState.assets[idx] = sanitizeAsset({ ...asset, usdtHistory: newHistory });
  saveData();
  EventBus.emit('assetChanged', { type: 'deleteUsdtHistory', assetId });
  return true;
}

// ── Transactions ──
function addTransaction(assetId, txn) {
  const idx = appState.assets.findIndex(a => a.id === assetId);
  if (idx < 0) { showToast('자산을 찾을 수 없습니다', 'error'); return false; }
  const asset = appState.assets[idx];
  if (asset.txns.length >= LIMITS.txns) {
    showToast(`거래 내역 최대 ${LIMITS.txns}건`, 'error');
    return false;
  }
  const newTxns = [...asset.txns, sanitizeTxn({ ...txn, id: uid() })];
  appState.assets[idx] = sanitizeAsset({ ...asset, txns: newTxns });
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'addTxn', assetId });
  return true;
}

function addTransactionWithPrice(assetId, txn, price) {
  const idx = appState.assets.findIndex(a => a.id === assetId);
  if (idx < 0) { showToast('자산을 찾을 수 없습니다', 'error'); return false; }
  const asset = appState.assets[idx];
  if (asset.txns.length >= LIMITS.txns) {
    showToast(`거래 내역 최대 ${LIMITS.txns}건`, 'error');
    return false;
  }
  const newTxns = [...asset.txns, sanitizeTxn({ ...txn, id: uid() })];
  const hasAutoUpdate = asset.stockCode || asset.coinId || asset.isUsdt;
  const newAmount = (hasAutoUpdate && asset.amount > 0) ? asset.amount : safeNum(price);
  appState.assets[idx] = sanitizeAsset({ ...asset, amount: newAmount, txns: newTxns });
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'update', asset: appState.assets[idx] });
  return true;
}

function updateTransaction(assetId, txnId, updates) {
  const idx = appState.assets.findIndex(a => a.id === assetId);
  if (idx < 0) return false;
  const asset = appState.assets[idx];
  const txnIdx = asset.txns.findIndex(t => t.id === txnId);
  if (txnIdx < 0) return false;
  const newTxns = [...asset.txns];
  newTxns[txnIdx] = sanitizeTxn({ ...newTxns[txnIdx], ...updates, id: txnId });
  appState.assets[idx] = sanitizeAsset({ ...asset, txns: newTxns });
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'updateTxn', assetId, txnId });
  return true;
}

function deleteTransaction(assetId, txnId) {
  const idx = appState.assets.findIndex(a => a.id === assetId);
  if (idx < 0) return null;
  const asset = appState.assets[idx];
  const txnIdx = asset.txns.findIndex(t => t.id === txnId);
  if (txnIdx < 0) return null;
  const deletedTxn = asset.txns[txnIdx];
  const newTxns = [...asset.txns];
  newTxns.splice(txnIdx, 1);
  appState.assets[idx] = sanitizeAsset({ ...asset, txns: newTxns });
  invalidateCalcCache();
  makeSnapshot();
  saveData();
  EventBus.emit('assetChanged', { type: 'deleteTxn', assetId, txnId });
  return () => {
    const curIdx = appState.assets.findIndex(a => a.id === assetId);
    if (curIdx < 0) return;
    const cur = appState.assets[curIdx];
    const restoredTxns = [...cur.txns];
    restoredTxns.splice(txnIdx, 0, deletedTxn);
    appState.assets[curIdx] = sanitizeAsset({ ...cur, txns: restoredTxns });
    invalidateCalcCache();
    makeSnapshot();
    saveData();
    EventBus.emit('assetChanged', { type: 'restoreTxn', assetId, txnId });
  };
}

// ── Income CRUD ──
function addIncome(item) {
  appState.income.push(sanitizeIncome(item));
  saveData();
  EventBus.emit('incomeChanged', { type: 'add' });
}

function updateIncome(id, updates) {
  const idx = appState.income.findIndex(i => i.id === id);
  if (idx < 0) return;
  appState.income[idx] = sanitizeIncome({ ...appState.income[idx], ...updates });
  saveData();
  EventBus.emit('incomeChanged', { type: 'update', id });
}

function deleteIncome(id) {
  const idx = appState.income.findIndex(i => i.id === id);
  if (idx < 0) return null;
  const item = appState.income[idx];
  appState.income.splice(idx, 1);
  saveData();
  EventBus.emit('incomeChanged', { type: 'delete', id });
  return () => {
    appState.income.splice(idx, 0, item);
    saveData();
    EventBus.emit('incomeChanged', { type: 'restore', id });
  };
}

// ── Reorder ──
function reorderAsset(fromId, toId, insertBefore = false) {
  const arr = appState.assets;
  const fromIdx = arr.findIndex(a => a.id === fromId);
  if (fromIdx < 0) return;
  const [item] = arr.splice(fromIdx, 1);
  let toIdx = arr.findIndex(a => a.id === toId);
  if (toIdx < 0) { arr.splice(fromIdx, 0, item); return; }
  if (!insertBefore) toIdx += 1;
  arr.splice(toIdx, 0, item);
  invalidateCalcCache();
  saveData();
}

function reorderCategory(fromCat, toCat, insertBefore = false) {
  const order = appState.categoryOrder;
  const fromIdx = order.indexOf(fromCat);
  if (fromIdx < 0) return;
  order.splice(fromIdx, 1);
  let toIdx = order.indexOf(toCat);
  if (toIdx < 0) { order.splice(fromIdx, 0, fromCat); return; }
  if (!insertBefore) toIdx += 1;
  order.splice(toIdx, 0, fromCat);
  invalidateCalcCache();
  saveData();
}

// ── Goal ──
function setGoal(opts, legacyDate) {
  // Backward compat: setGoal(amount, date) → object form
  const o = (opts && typeof opts === 'object') ? opts : { amount: opts, date: legacyDate };
  const amt = safeNum(o.amount);
  if (amt <= 0) { showToast('유효한 금액을 입력하세요', 'error'); return; }
  if (!isValidDate(o.date)) { showToast('유효한 날짜를 입력하세요', 'error'); return; }
  const prev = appState.goal || {};
  appState.goal = {
    amount: amt,
    date: o.date,
    setDate: today(),
    monthlySaving: safeNum(o.monthlySaving != null ? o.monthlySaving : prev.monthlySaving),
    expectedReturn: safeNum(o.expectedReturn != null ? o.expectedReturn : (prev.expectedReturn != null ? prev.expectedReturn : 7)),
    monthlyExpense: safeNum(o.monthlyExpense != null ? o.monthlyExpense : prev.monthlyExpense),
  };
  saveData();
}

function clearGoal() {
  appState.goal = null;
  saveData();
}

// ── Allocation Targets ──
function setAllocation(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const prev = appState.allocation || {};

  const rawCats = (o.categories && typeof o.categories === 'object') ? o.categories : (prev.categories || {});
  const categories = {};
  for (const cid of CAT_IDS) {
    categories[cid] = Math.max(0, Math.min(100, safeNum(rawCats[cid])));
  }

  const rawAssets = (o.assets && typeof o.assets === 'object') ? o.assets : (prev.assets || {});
  const assets = {};
  const validIds = new Set(appState.assets.map(a => String(a.id)));
  for (const [aid, pct] of Object.entries(rawAssets)) {
    const sid = String(aid);
    if (!validIds.has(sid)) continue;
    const n = safeNum(pct);
    if (n < 0 || n > 100) continue;
    assets[sid] = n;
  }

  appState.allocation = {
    enabled: o.enabled !== undefined ? !!o.enabled : !!prev.enabled,
    assetOverride: o.assetOverride !== undefined ? !!o.assetOverride : !!prev.assetOverride,
    categories,
    assets,
    driftThreshold: Math.max(0, Math.min(100, safeNum(o.driftThreshold != null ? o.driftThreshold : (prev.driftThreshold != null ? prev.driftThreshold : ALLOC_DRIFT_THRESHOLD_DEFAULT)))),
    updatedAt: today(),
  };
  saveData();
}

function clearAllocation() {
  appState.allocation = null;
  saveData();
}

// ── Dashboard Prefs (v5.5.0) ──
function loadDashPrefs() {
  try {
    const raw = localStorage.getItem(DASH_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          hidden: Array.isArray(parsed.hidden) ? parsed.hidden.map(String) : [],
          order: Array.isArray(parsed.order) ? parsed.order.map(String) : [],
        };
      }
    }
  } catch (e) {
    console.warn('loadDashPrefs failed:', e);
  }
  return { hidden: [], order: [] };
}

function saveDashPrefs(prefs) {
  try {
    localStorage.setItem(DASH_PREFS_KEY, JSON.stringify({
      hidden: Array.isArray(prefs.hidden) ? prefs.hidden.slice(0, 50) : [],
      order: Array.isArray(prefs.order) ? prefs.order.slice(0, 50) : [],
    }));
  } catch (e) {
    console.warn('saveDashPrefs failed:', e);
  }
}

function resetDashPrefs() {
  try { localStorage.removeItem(DASH_PREFS_KEY); } catch (e) {
    console.warn('resetDashPrefs failed:', e);
  }
}

// ── Input Presets (v5.5.0) ──
function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          accounts: Array.isArray(parsed.accounts) ? parsed.accounts.map(String).slice(0, PRESET_MAX) : [],
          incomeSources: Array.isArray(parsed.incomeSources) ? parsed.incomeSources.map(String).slice(0, PRESET_MAX) : [],
        };
      }
    }
  } catch (e) {
    console.warn('loadPresets failed:', e);
  }
  return { accounts: [], incomeSources: [] };
}

function addPreset(type, value) {
  const v = stripHtml(value, 50).trim();
  if (!v) return;
  const presets = loadPresets();
  const list = presets[type];
  if (!Array.isArray(list)) return;
  const filtered = list.filter(x => x !== v);
  filtered.unshift(v);
  presets[type] = filtered.slice(0, PRESET_MAX);
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('addPreset failed:', e);
  }
}

// ── Storage Info ──
let _storageUsageCache = null;

function getStorageUsage() {
  if (_storageUsageCache != null) return _storageUsageCache;
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      total += (localStorage.getItem(key) || '').length * 2;
    }
  } catch (e) {
    console.warn('getStorageUsage: unable to measure', e);
  }
  _storageUsageCache = total;
  return total;
}

function _invalidateStorageCache() { _storageUsageCache = null; }

// ── Export / Import ──
function exportData() {
  return {
    version: APP_VERSION,
    exported: new Date().toISOString(),
    portfolioName: loadPortfolioMeta().list.find(p => p.id === activePortfolioId)?.name || '포트폴리오',
    data: { ...appState },
  };
}

function importData(json) {
  const backup = JSON.stringify(appState);
  try {
    const imported = typeof json === 'string' ? JSON.parse(json) : json;
    const data = _migrateOldFormat(imported.data || imported);
    if (!data || (!data.assets && !Array.isArray(data))) {
      showToast('유효하지 않은 백업 파일', 'error');
      return false;
    }
    const newState = { ...defaultState(), ...data };
    newState.assets = (newState.assets || []).slice(0, LIMITS.assets).map(sanitizeAsset);
    newState.income = (newState.income || []).map(sanitizeIncome);
    if (Array.isArray(newState.categoryOrder)) {
      newState.categoryOrder = newState.categoryOrder.filter(c => CAT_IDS.includes(c));
      for (const cid of CAT_IDS) {
        if (!newState.categoryOrder.includes(cid)) newState.categoryOrder.push(cid);
      }
    } else {
      newState.categoryOrder = [...CAT_IDS];
    }
    appState = newState;
    invalidateCalcCache();
    makeSnapshot();
    saveDataNow();
    EventBus.emit('dataImported');
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    try {
      appState = JSON.parse(backup);
      invalidateCalcCache();
    } catch (restoreErr) {
      console.warn('Failed to restore backup after import error:', restoreErr);
    }
    showToast('복원 실패: 파일 형식 오류. 기존 데이터가 유지됩니다.', 'error');
    return false;
  }
}

function resetAllData() {
  appState = defaultState();
  invalidateCalcCache();
  saveDataNow();
  EventBus.emit('dataReset');
}
