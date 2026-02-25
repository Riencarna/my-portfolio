/* ===================================================
   utils.js - 포맷팅, 검증, 유틸리티 함수
   =================================================== */

// --- 통화 포맷팅 ---

// 전체 한글 단위 포맷 (예: 1억 2345만 6789원)
function formatCurrency(n) {
  if (!n) return "0원";
  var abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 1e8) {
    var eok = Math.floor(abs / 1e8), rem = abs - eok * 1e8;
    var man = Math.floor(rem / 1e4), won = Math.round(rem % 1e4);
    if (man > 0 && won > 0) return sign + eok + "억 " + man + "만 " + won + "원";
    if (man > 0) return sign + eok + "억 " + man + "만원";
    if (won > 0) return sign + eok + "억 " + won + "원";
    return sign + eok + "억원";
  }
  if (abs >= 1e4) {
    var man2 = Math.floor(abs / 1e4), won2 = Math.round(abs % 1e4);
    if (won2 > 0) return sign + man2 + "만 " + won2 + "원";
    return sign + man2 + "만원";
  }
  return sign + abs + "원";
}

// 축약 포맷 (예: 1억 2345만원)
function formatShortCurrency(n) {
  if (!n) return "0원";
  var abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 1e8) {
    var eok = Math.floor(abs / 1e8), rem = abs - eok * 1e8;
    var man = Math.floor(rem / 1e4);
    if (man > 0) return sign + eok + "억 " + man + "만원";
    return sign + eok + "억원";
  }
  if (abs >= 1e4) return sign + Math.floor(abs / 1e4) + "만원";
  return sign + abs + "원";
}

// 숫자 포맷 (예: 75,000원)
function formatNumber(n) {
  return Math.round(n).toLocaleString() + "원";
}

// --- 날짜 유틸 ---

function getTodayString() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getNowString() {
  return new Date().toLocaleString("ko-KR");
}

// --- 보안: HTML 이스케이프 ---

function escapeHtml(s) {
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// --- 디바운스 (성능 최적화) ---

function debounce(fn, delay) {
  var timer = null;
  return function() {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}

// --- 카테고리 select 옵션 생성 ---

function buildCategoryOptions(selected) {
  return CATEGORY_LIST.map(function(c) {
    return "<option value=\"" + c + "\"" + (c === selected ? " selected" : "") + ">" + CATEGORY_CONFIG[c].icon + " " + c + "</option>";
  }).join("");
}

// --- 자산 계산 ---

function calcAsset(asset) {
  var txns = (asset.txns || []).slice().sort(function(x, y) {
    return (x.date || "").localeCompare(y.date || "");
  });

  if (isCashLike(asset.category)) {
    var bal = 0, inCnt = 0, outCnt = 0;
    txns.forEach(function(t) {
      if (t.type === "buy") { bal += t.price * t.qty; inCnt += 1; }
      else { bal -= t.price * t.qty; outCnt += 1; }
    });
    return { qty: inCnt + outCnt, avgPrice: 0, totalCost: 0, evalAmt: Math.round(bal), profit: 0, profitPct: 0, accounts: [], inCnt: inCnt, outCnt: outCnt };
  }

  var totalQty = 0, totalCost = 0;
  txns.forEach(function(t) {
    if (t.type === "buy") { totalQty += t.qty; totalCost += t.price * t.qty; }
    else if (t.type === "sell" && totalQty > 0) {
      var ratio = Math.min(t.qty, totalQty) / totalQty;
      totalCost -= totalCost * ratio;
      totalQty -= Math.min(t.qty, totalQty);
    }
  });

  var avgPrice = totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
  var currentPrice = asset.amount || 0;
  var evalAmt = currentPrice * totalQty;
  var profit = evalAmt - totalCost;
  var profitPct = totalCost > 0 ? ((profit / totalCost) * 100).toFixed(2) : 0;

  var accounts = {};
  txns.forEach(function(t) {
    var acctName = t.account || "기본";
    if (!accounts[acctName]) accounts[acctName] = { qty: 0, cost: 0 };
    if (t.type === "buy") { accounts[acctName].qty += t.qty; accounts[acctName].cost += t.price * t.qty; }
    else {
      var minQty = Math.min(t.qty, accounts[acctName].qty);
      if (accounts[acctName].qty > 0) accounts[acctName].cost -= accounts[acctName].cost * (minQty / accounts[acctName].qty);
      accounts[acctName].qty -= minQty;
    }
  });

  var accountList = [];
  for (var k in accounts) {
    if (accounts[k].qty > 0) {
      var ap = Math.round(accounts[k].cost / accounts[k].qty);
      accountList.push({ name: k, qty: accounts[k].qty, avgP: ap, eval: currentPrice * accounts[k].qty, profit: currentPrice * accounts[k].qty - accounts[k].cost });
    }
  }

  return { qty: totalQty, avgPrice: avgPrice, totalCost: Math.round(totalCost), evalAmt: Math.round(evalAmt), profit: Math.round(profit), profitPct: profitPct, accounts: accountList };
}

// 거래 내역 존재 여부
function hasTransactions(asset) {
  return asset.txns && asset.txns.length > 0;
}

// 자산 평가금액
function getAssetValue(asset) {
  if (!hasTransactions(asset)) return 0;
  return calcAsset(asset).evalAmt;
}

// 자동 업데이트 가능 여부
function canAutoUpdate(asset) {
  return (asset.category === "코인" && asset.coinId) ||
    ((asset.category === "국내주식" || asset.category === "해외주식") && asset.stockCode);
}

// --- 거래 라벨 ---

function getTransactionLabel(category, type) {
  if (category === "현금") return type === "buy" ? "입금" : "출금";
  if (category === "예적금") return type === "buy" ? "납입" : "인출";
  return type === "buy" ? "매수" : "매도";
}

function getTransactionUnit(category) {
  if (category === "현금" || category === "예적금") return "건";
  if (category === "코인") return "개";
  return "주";
}

function isCashLike(category) {
  return category === "현금" || category === "예적금";
}

// --- 히스토리 스냅샷 생성 ---

function makeSnapshot(assets, history) {
  var today = getTodayString(), total = 0, byCategory = {};
  CATEGORY_LIST.forEach(function(c) { byCategory[c] = 0; });
  assets.forEach(function(a) {
    var v = getAssetValue(a);
    total += v;
    byCategory[a.category] += v;
  });
  var newHistory = history.filter(function(h) { return h.date !== today; });
  newHistory.push({ date: today, total: total, byCategory: byCategory });
  newHistory.sort(function(a, b) { return a.date.localeCompare(b.date); });
  return newHistory;
}

// --- 코인 ID 검색 ---

function resolveCoinId(name) {
  var lower = name.toLowerCase().trim();
  if (COIN_ID_MAP[lower]) return COIN_ID_MAP[lower];
  for (var k in COIN_ID_MAP) {
    if (k.indexOf(lower) >= 0 || lower.indexOf(k) >= 0) return COIN_ID_MAP[k];
  }
  return null;
}

// --- 카테고리 인덱스 빌드 (성능 최적화) ---

function buildCategoryIndex(assets) {
  var index = {};
  CATEGORY_LIST.forEach(function(cat) { index[cat] = []; });
  assets.forEach(function(a) {
    if (index[a.category]) index[a.category].push(a);
  });
  return index;
}

// --- 데이터 검증 ---

function sanitizeStr(s, max) {
  if (typeof s !== "string") return "";
  return s.slice(0, max || 200);
}

function sanitizeNum(n) {
  var v = Number(n);
  if (!isFinite(v)) return 0;
  return v;
}

function sanitizeAsset(a) {
  if (!a || typeof a !== "object") return null;
  return {
    id: sanitizeNum(a.id),
    name: sanitizeStr(a.name, 100),
    category: CATEGORY_LIST.indexOf(a.category) >= 0 ? a.category : "기타",
    amount: sanitizeNum(a.amount),
    note: a.note ? sanitizeStr(a.note, 500) : null,
    stockCode: sanitizeStr(a.stockCode, 20),
    market: sanitizeStr(a.market, 10),
    coinId: sanitizeStr(a.coinId, 80),
    krxEtf: !!a.krxEtf,
    isUsdt: !!a.isUsdt,
    walletCoinId: a.walletCoinId ? sanitizeStr(a.walletCoinId, 80) : undefined,
    txns: Array.isArray(a.txns) ? a.txns.map(function(t) {
      return {
        id: sanitizeNum(t.id),
        type: t.type === "buy" || t.type === "sell" ? t.type : "buy",
        price: sanitizeNum(t.price),
        qty: sanitizeNum(t.qty),
        account: t.account ? sanitizeStr(t.account, 50) : null,
        date: sanitizeStr(t.date, 10),
        memo: t.memo ? sanitizeStr(t.memo, 200) : null
      };
    }).slice(0, 5000) : []
  };
}
