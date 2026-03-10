/* ===================================================
   state.js - 애플리케이션 상태 관리
   =================================================== */

// 메인 상태 객체
var appState = {
  assets: [],
  history: [],
  saved: null,
  categoryOrder: null,
  coinShowProfitLoss: true,
  goal: null,
  income: []
};

// UI 상태
var updateLogs = [];
var loadingAssets = {};
var isAllLoading = false;
var currentTab = "dash";
var charts = { pie: null, l1: null, l2: null, catPies: {}, incPie: null, listPie: null, growth: null };
var cachedExchangeRate = null;
var cachedUsdtRate = null;
var selectedMarket = "KOSPI";
var expandedAssets = {};
var isEditMode = false;
var dashboardCategoryOpen = {};
var listCategoryOpen = {};
var geminiResult = null;
var isGeminiLoading = false;
var selectedIncomeMonth = null;
var isLogOpen = false;
var assetSearchQuery = "";
var assetSortMode = "default";
var historyChartDays = 30;
var undoSnapshot = null;
var undoTimerHandle = null;
var isSandbox = false;
var autoUpdateProgress = { total: 0, done: 0 };
var cachedBenchmark = null;
var growthChartDays = 0;
var growthShowCategories = false;
var currentPortfolioId = "default";

// --- 데이터 로드 ---

function loadData() {
  try {
    var raw = localStorage.getItem(_currentStorageKey);
    if (!raw || raw.length > 10 * 1024 * 1024) return;
    var d = JSON.parse(raw);
    if (!d || typeof d !== "object") return;

    appState.assets = Array.isArray(d.a) ? d.a.map(sanitizeAsset).filter(Boolean).slice(0, 500) : [];

    appState.history = Array.isArray(d.h) ? d.h.filter(function(x) {
      return x && typeof x === "object" && typeof (x.date || x.d) === "string" && isFinite(x.total);
    }).map(function(x) {
      if (x.d && !x.date) { x.date = x.d; }
      return x;
    }).slice(0, 3650) : [];

    appState.saved = typeof d.s === "string" ? d.s.slice(0, 50) : null;

    appState.categoryOrder = Array.isArray(d.co) ? d.co.filter(function(c) {
      return CATEGORY_LIST.indexOf(c) >= 0;
    }).slice(0, CATEGORY_LIST.length) : null;

    if (d.cpl !== undefined) appState.coinShowProfitLoss = !!d.cpl;

    if (d.goal && typeof d.goal === "object") {
      var g = d.goal;
      appState.goal = {
        amount: sanitizeNum(g.amount),
        date: g.date ? sanitizeStr(g.date, 10) : null,
        setDate: g.setDate ? sanitizeStr(g.setDate, 10) : null
      };
    }

    appState.income = Array.isArray(d.inc) ? d.inc.filter(function(x) {
      return x && typeof x === "object" && isFinite(x.amount);
    }).map(function(x) {
      return {
        id: sanitizeNum(x.id),
        date: sanitizeStr(x.date, 10),
        amount: sanitizeNum(x.amount),
        cat: sanitizeStr(x.cat, 20),
        source: sanitizeStr(x.source, 100),
        memo: x.memo ? sanitizeStr(x.memo, 200) : null,
        recurring: !!x.recurring
      };
    }).slice(0, 5000) : [];
  } catch (e) {
    console.warn("Data load error");
  }
}

// --- 데이터 저장 ---

function saveData() {
  appState.saved = getNowString();
  try {
    var data = JSON.stringify({
      a: appState.assets,
      h: appState.history,
      s: appState.saved,
      co: appState.categoryOrder,
      cpl: appState.coinShowProfitLoss,
      goal: appState.goal || null,
      inc: appState.income || []
    });
    if (data.length > 8 * 1024 * 1024) {
      showToast("⚠️ 데이터가 너무 큽니다. 오래된 기록을 정리해주세요.");
      return;
    }
    localStorage.setItem(_currentStorageKey, data);
  } catch (e) {
    if (e.name === "QuotaExceededError") showToast("⚠️ 저장 공간이 부족합니다");
  }
}

// --- Undo ---

function captureUndo() {
  try {
    undoSnapshot = JSON.stringify({
      a: appState.assets,
      h: appState.history,
      s: appState.saved,
      co: appState.categoryOrder,
      cpl: appState.coinShowProfitLoss,
      goal: appState.goal,
      inc: appState.income
    });
  } catch (e) {
    undoSnapshot = null;
  }
}

function performUndo() {
  if (!undoSnapshot) return;
  try {
    var d = JSON.parse(undoSnapshot);
    appState.assets = (d.a || []).map(sanitizeAsset).filter(Boolean);
    appState.history = (d.h || []).filter(function(x) {
      return x && typeof x === "object" && typeof (x.date || x.d) === "string" && isFinite(x.total);
    }).map(function(x) {
      if (x.d && !x.date) { x.date = x.d; }
      return x;
    });
    appState.saved = d.s || null;
    appState.categoryOrder = d.co || null;
    appState.coinShowProfitLoss = d.cpl !== false;
    appState.goal = d.goal || null;
    appState.income = d.inc || [];
    saveData();
    render();
    undoSnapshot = null;
    var old = document.getElementById("toast-el");
    if (old) old.remove();
    showToast("↩ 실행 취소 완료");
  } catch (e) {
    showToast("❌ 실행 취소 실패");
  }
}

// --- 다중 포트폴리오 ---

function _getPortfolioMeta() {
  try {
    var raw = localStorage.getItem("mp_portfolio_meta");
    if (raw) {
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.list)) return d;
    }
  } catch(e) {}
  return { active: "default", list: [{ id: "default", name: "기본 포트폴리오" }] };
}

function _savePortfolioMeta(meta) {
  try { localStorage.setItem("mp_portfolio_meta", JSON.stringify(meta)); } catch(e) {}
}

function _getStorageKeyForPortfolio(id) {
  return id === "default" ? STORAGE_KEY : STORAGE_KEY + "_" + id;
}

function getPortfolioList() {
  return _getPortfolioMeta().list;
}

function getActivePortfolioName() {
  var meta = _getPortfolioMeta();
  var found = null;
  meta.list.forEach(function(p) { if (p.id === currentPortfolioId) found = p; });
  return found ? found.name : "기본 포트폴리오";
}

function switchPortfolio(id) {
  if (id === currentPortfolioId) return;
  // Save current
  saveData();
  // Switch
  currentPortfolioId = id;
  var meta = _getPortfolioMeta();
  meta.active = id;
  _savePortfolioMeta(meta);
  // Update STORAGE_KEY reference for load
  _currentStorageKey = _getStorageKeyForPortfolio(id);
  // Reset UI state
  updateLogs = [];
  loadingAssets = {};
  isAllLoading = false;
  expandedAssets = {};
  isEditMode = false;
  dashboardCategoryOpen = {};
  listCategoryOpen = {};
  cachedBenchmark = null;
  // Load new portfolio
  loadData();
  render();
  showToast("📂 포트폴리오 전환: " + getActivePortfolioName());
}

function createPortfolio(name) {
  var meta = _getPortfolioMeta();
  if (meta.list.length >= 10) {
    showToast("❌ 최대 10개까지 생성 가능합니다");
    return;
  }
  var id = "pf_" + Date.now();
  meta.list.push({ id: id, name: name });
  _savePortfolioMeta(meta);
  // Initialize empty data
  try {
    localStorage.setItem(_getStorageKeyForPortfolio(id), JSON.stringify({
      a: [], h: [], s: null, co: null, cpl: true, goal: null, inc: []
    }));
  } catch(e) {}
  switchPortfolio(id);
}

function renamePortfolio(id, newName) {
  var meta = _getPortfolioMeta();
  meta.list.forEach(function(p) { if (p.id === id) p.name = newName; });
  _savePortfolioMeta(meta);
  render();
}

function deletePortfolio(id) {
  if (id === "default") { showToast("❌ 기본 포트폴리오는 삭제할 수 없습니다"); return; }
  var meta = _getPortfolioMeta();
  meta.list = meta.list.filter(function(p) { return p.id !== id; });
  try { localStorage.removeItem(_getStorageKeyForPortfolio(id)); } catch(e) {}
  if (currentPortfolioId === id) {
    meta.active = "default";
    _savePortfolioMeta(meta);
    switchPortfolio("default");
  } else {
    _savePortfolioMeta(meta);
  }
  showToast("🗑 포트폴리오가 삭제되었습니다");
}

var _currentStorageKey = STORAGE_KEY;

// --- 카테고리 순서 ---

function getOrderedCategories() {
  if (appState.categoryOrder && appState.categoryOrder.length === CATEGORY_LIST.length) {
    var valid = true;
    CATEGORY_LIST.forEach(function(c) { if (appState.categoryOrder.indexOf(c) < 0) valid = false; });
    if (valid) return appState.categoryOrder;
  }
  return CATEGORY_LIST.slice();
}
