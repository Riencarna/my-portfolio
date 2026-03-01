/* ===================================================
   app.js - 애플리케이션 진입점, 탭 전환, 자동 업데이트
   =================================================== */

// --- 탭 전환 ---

var VALID_TABS = ["dash", "list", "inc", "hist", "ai"];

function goTab(tabId) {
  destroyAllCharts();
  currentTab = tabId;
  try { localStorage.setItem("mp_last_tab", tabId); } catch (e) {}
  document.querySelectorAll(".tab").forEach(function(el) {
    el.classList.toggle("on", el.dataset.t === tabId);
  });
  document.getElementById("pgDash").classList.toggle("hidden", tabId !== "dash");
  document.getElementById("pgList").classList.toggle("hidden", tabId !== "list");
  document.getElementById("pgInc").classList.toggle("hidden", tabId !== "inc");
  document.getElementById("pgHist").classList.toggle("hidden", tabId !== "hist");
  document.getElementById("pgAi").classList.toggle("hidden", tabId !== "ai");
  render();
}

function restoreLastTab() {
  try {
    var saved = localStorage.getItem("mp_last_tab");
    if (saved && VALID_TABS.indexOf(saved) >= 0) {
      goTab(saved);
      return;
    }
  } catch (e) {}
}

// --- 메인 렌더 디스패처 ---

function render(opts) {
  document.getElementById("elSaved").textContent = appState.saved ? "마지막 저장: " + appState.saved : "";
  // 자동 최신화 중간 렌더: 대시보드/리스트 탭에서만 업데이트
  if (opts && opts.priceUpdateOnly && currentTab !== "dash" && currentTab !== "list") return;
  if (currentTab === "dash") renderDashboard();
  else if (currentTab === "list") renderAssetList();
  else if (currentTab === "inc") renderIncome();
  else if (currentTab === "hist") renderHistory();
  else if (currentTab === "ai") renderAI();
}

// --- 전체 가격 자동 업데이트 ---

function autoAll() {
  var targets = appState.assets.filter(canAutoUpdate);
  if (!targets.length) return;

  if (isSandbox) {
    updateLogs = [];
    targets.forEach(function(a) {
      updateLogs.push({ name: a.name, ok: false, msg: "미리보기 모드 - 다운로드 후 사용" });
    });
    render();
    return;
  }

  isAllLoading = true;
  updateLogs = [];
  render();

  var coins = targets.filter(function(a) { return a.category === "코인" && a.coinId; });
  var stocks = targets.filter(function(a) {
    return (a.category === "국내주식" || a.category === "해외주식") && a.stockCode;
  });

  fetchCoinPrices(coins.map(function(a) { return a.coinId; })).then(function(prices) {
    coins.forEach(function(a) {
      var d = prices[a.coinId];
      if (d && d.krw) {
        var old = a.amount;
        a.amount = d.krw;
        a.lpu = getNowString();
        updateLogs.push({ name: a.name, old: old, nu: d.krw, ok: true, aid: a.id });
      } else {
        updateLogs.push({ name: a.name, ok: false, msg: "응답 없음", aid: a.id });
      }
    });
    render({ priceUpdateOnly: true });

    var i = 0;
    function processNextStock() {
      if (i >= stocks.length) {
        var failed = updateLogs.filter(function(l) { return !l.ok && l.aid; });
        if (failed.length > 0 && !autoAll._retried) {
          autoAll._retried = true;
          retryFailed();
          return;
        }
        autoAll._retried = false;
        appState.history = makeSnapshot(appState.assets, appState.history);
        saveData();
        isAllLoading = false;
        // 로그 배열 크기 제한 (성능 최적화)
        if (updateLogs.length > 200) updateLogs = updateLogs.slice(-200);
        render();
        return;
      }

      var a = stocks[i++];
      loadingAssets[a.id] = true;
      render({ priceUpdateOnly: true });

      fetchStockPrice(a).then(function(p) {
        loadingAssets[a.id] = false;
        if (p && p > 0) {
          var old = a.amount;
          a.amount = p;
          a.lpu = getNowString();
          updateLogs.push({ name: a.name, old: old, nu: p, ok: true, aid: a.id });
        } else {
          updateLogs.push({ name: a.name, ok: false, msg: "응답 없음", aid: a.id });
        }
        render({ priceUpdateOnly: true });
        setTimeout(processNextStock, 600);
      });
    }

    processNextStock();
  });
}

// --- 실패 항목 재시도 ---

function retryFailed() {
  var failed = updateLogs.filter(function(l) { return !l.ok && l.aid; });
  if (!failed.length) {
    isAllLoading = false;
    appState.history = makeSnapshot(appState.assets, appState.history);
    saveData();
    render();
    return;
  }

  updateLogs = updateLogs.filter(function(l) { return l.ok; });

  var failedAssets = [];
  failed.forEach(function(f) {
    appState.assets.forEach(function(a) { if (a.id === f.aid) failedAssets.push(a); });
  });

  var coins = failedAssets.filter(function(a) { return a.category === "코인" && a.coinId; });
  var stocks = failedAssets.filter(function(a) {
    return (a.category === "국내주식" || a.category === "해외주식") && a.stockCode;
  });

  fetchCoinPrices(coins.map(function(a) { return a.coinId; })).then(function(prices) {
    coins.forEach(function(a) {
      var d = prices[a.coinId];
      if (d && d.krw) {
        var old = a.amount;
        a.amount = d.krw;
        a.lpu = getNowString();
        updateLogs.push({ name: a.name, old: old, nu: d.krw, ok: true, aid: a.id });
      } else {
        updateLogs.push({ name: a.name, ok: false, msg: "재시도 실패", aid: a.id });
      }
    });

    var i = 0;
    function processNextStock() {
      if (i >= stocks.length) {
        appState.history = makeSnapshot(appState.assets, appState.history);
        saveData();
        isAllLoading = false;
        render();
        return;
      }

      var a = stocks[i++];
      loadingAssets[a.id] = true;
      render({ priceUpdateOnly: true });

      fetchStockPrice(a).then(function(p) {
        loadingAssets[a.id] = false;
        if (p && p > 0) {
          var old = a.amount;
          a.amount = p;
          a.lpu = getNowString();
          updateLogs.push({ name: a.name, old: old, nu: p, ok: true, aid: a.id });
        } else {
          updateLogs.push({ name: a.name, ok: false, msg: "재시도 실패", aid: a.id });
        }
        render({ priceUpdateOnly: true });
        setTimeout(processNextStock, 600);
      });
    }

    processNextStock();
  });
}

// --- 초기화 ---

loadData();
restoreLastTab();
render();
checkSandbox().then(function() {
  render();
  fetchExchangeRate().then(function() { render(); });
});
