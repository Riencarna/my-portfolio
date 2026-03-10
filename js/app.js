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
  var pages = ["pgDash", "pgList", "pgInc", "pgHist", "pgAi"];
  var tabMap = { dash: "pgDash", list: "pgList", inc: "pgInc", hist: "pgHist", ai: "pgAi" };
  pages.forEach(function(pg) {
    var el = document.getElementById(pg);
    if (pg === tabMap[tabId]) {
      el.classList.remove("hidden");
      el.classList.remove("tab-animate");
      void el.offsetWidth;
      el.classList.add("tab-animate");
    } else {
      el.classList.add("hidden");
      el.classList.remove("tab-animate");
    }
  });
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
  autoUpdateProgress = { total: targets.length, done: 0 };
  render();

  var coins = targets.filter(function(a) { return a.category === "코인" && a.coinId; });
  var stocks = targets.filter(function(a) {
    return (a.category === "국내주식" || a.category === "해외주식") && a.stockCode;
  });
  var usdtAssets = targets.filter(function(a) { return a.isUsdt && a.usdtQty > 0; });

  // USDT 자산 시세 업데이트
  var usdtPromise = usdtAssets.length > 0
    ? getUsdtExchangeRate().then(function(rt) {
        usdtAssets.forEach(function(a) {
          var oldEval = calcAsset(a).evalAmt;
          var newKrw = Math.round(a.usdtQty * rt);
          var diff = newKrw - oldEval;
          if (diff !== 0) {
            if (!a.txns) a.txns = [];
            a.txns.push({
              id: generateId(),
              type: diff > 0 ? "buy" : "sell",
              price: Math.abs(diff),
              qty: 1,
              account: null,
              date: getTodayString(),
              memo: a.usdtQty + " USDT × " + Math.round(rt) + "원 (자동 최신화)"
            });
          }
          a.lpu = getNowString();
          updateLogs.push({ name: a.name, old: oldEval, nu: newKrw, ok: true, aid: a.id });
          autoUpdateProgress.done++;
        });
      }).catch(function() {
        usdtAssets.forEach(function(a) {
          updateLogs.push({ name: a.name, ok: false, msg: "USDT 시세 조회 실패", aid: a.id });
          autoUpdateProgress.done++;
        });
      })
    : Promise.resolve();

  usdtPromise.then(function() {
    return fetchCoinPrices(coins.map(function(a) { return a.coinId; }));
  }).then(function(prices) {
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
      autoUpdateProgress.done++;
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
        autoUpdateProgress.done++;
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

// --- 모바일 스와이프 탭 전환 ---

(function() {
  var startX = 0, startY = 0;
  document.addEventListener("touchstart", function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchend", function(e) {
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    // 모달이 열려있으면 무시
    if (!document.getElementById("mBg").classList.contains("hidden")) return;
    var idx = VALID_TABS.indexOf(currentTab);
    if (dx < 0 && idx < VALID_TABS.length - 1) goTab(VALID_TABS[idx + 1]);
    else if (dx > 0 && idx > 0) goTab(VALID_TABS[idx - 1]);
  }, { passive: true });
})();

// --- 테마 토글 ---

function toggleTheme() {
  var root = document.documentElement;
  var current = root.getAttribute("data-theme");
  var next = current === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("mp_theme", next); } catch (e) {}
  var btn = document.getElementById("btnTheme");
  if (btn) btn.textContent = next === "light" ? "🌙" : "☀️";
  var meta = document.querySelector("meta[name=\"theme-color\"]");
  if (meta) meta.content = next === "light" ? "#F8FAFC" : "#0B0D11";
}

function loadTheme() {
  try {
    var saved = localStorage.getItem("mp_theme");
    if (saved === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      var btn = document.getElementById("btnTheme");
      if (btn) btn.textContent = "🌙";
      var meta = document.querySelector("meta[name=\"theme-color\"]");
      if (meta) meta.content = "#F8FAFC";
    }
  } catch (e) {}
}

// --- 스플래시 제거 ---

function removeSplash() {
  var splash = document.getElementById("splash");
  if (splash) {
    splash.style.opacity = "0";
    setTimeout(function() { splash.remove(); }, 400);
  }
}

// --- Service Worker 등록 ---

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function() {});
  }
}

// --- 초기화 ---

loadTheme();
loadData();
restoreLastTab();
render();
removeSplash();
registerSW();
checkSandbox().then(function() {
  render();
  fetchExchangeRate().then(function() { render(); });
});
