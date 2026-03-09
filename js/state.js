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
var charts = { pie: null, l1: null, l2: null, catPies: {}, incPie: null, listPie: null };
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

// --- 데이터 로드 ---

function loadData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, data);
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

// --- 카테고리 순서 ---

function getOrderedCategories() {
  if (appState.categoryOrder && appState.categoryOrder.length === CATEGORY_LIST.length) {
    var valid = true;
    CATEGORY_LIST.forEach(function(c) { if (appState.categoryOrder.indexOf(c) < 0) valid = false; });
    if (valid) return appState.categoryOrder;
  }
  return CATEGORY_LIST.slice();
}
