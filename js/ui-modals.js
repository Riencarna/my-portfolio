/* ui-modals.js - 모달, 거래, 자산 CRUD */

// --- 모달 열기/닫기 ---

function openModal(title, bodyHtml) {
  document.getElementById("mTi").textContent = title;
  document.getElementById("mBd").innerHTML = bodyHtml;
  document.getElementById("mBg").classList.remove("hidden");
  document.addEventListener("keydown", _modalEscHandler);
}

function closeModal() {
  document.getElementById("mBg").classList.add("hidden");
  document.removeEventListener("keydown", _modalEscHandler);
}

function _modalEscHandler(e) {
  if (e.key === "Escape") closeModal();
}

// --- 거래 기록 모달 ---

function openTransaction(assetId, type) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === assetId) a = x; });
  if (!a) return;

  var accs = {};
  (a.txns || []).forEach(function(t) { if (t.account) accs[t.account] = 1; });
  var al = Object.keys(accs);

  var isF = a.category === "해외주식" || a.category === "코인";
  var isCL = isCashLike(a.category);
  var isU = a.isUsdt;
  var lbl = getTransactionLabel(a.category, type);

  var h = "";

  // 통화 선택 (해외주식/코인)
  if (isF) {
    h += "<div class=\"fld\"><label>통화 선택</label>"
      + "<div class=\"mkt-sel\">"
      + "<button class=\"mkt-opt sel\" id=\"cur-krw\" onclick=\"selectCurrency(" + QUOTE + "KRW" + QUOTE + ")\">🇰🇷 원화(KRW)</button>"
      + "<button class=\"mkt-opt\" id=\"cur-usd\" onclick=\"selectCurrency(" + QUOTE + "USD" + QUOTE + ")\">🇺🇸 달러(USD)</button>"
      + "</div>"
      + "<input type=\"hidden\" id=\"tx-cur\" value=\"KRW\">"
      + "<div id=\"tx-rate\" style=\"font-size:10.5px;color:var(--t5);margin-top:4px\">"
      + "💱 현재 환율: "
      + (cachedExchangeRate && cachedExchangeRate.r
        ? Math.round(cachedExchangeRate.r).toLocaleString() + "원/$ ✓"
        : "조회 중...")
      + "</div></div>";
  }

  // USDT 수량 입력
  if (isU) {
    h += "<div class=\"fld\"><label>💲 " + lbl + " USDT 수량</label>"
      + "<input type=\"number\" id=\"tx-uq\" step=\"any\" placeholder=\"예: 500\" oninput=\"updateUsdtConversion()\">"
      + "<div id=\"tx-usdt-rate\" style=\"font-size:10.5px;color:var(--t5);margin-top:4px\">"
      + "💱 USDT 시세 조회 중... (업비트/빗썸 김프 반영)</div>"
      + "<div id=\"tx-usdt-cv\" style=\"font-size:12px;color:var(--t2);margin-top:4px;font-weight:600\"></div>"
      + "</div>"
      + "<input type=\"hidden\" id=\"tx-p\" value=\"0\">";
  } else {
    h += "<div class=\"fld\"><label>"
      + (isCL ? lbl + " 금액" : lbl + " 단가") + " "
      + (isF ? "" : "(원)")
      + "</label>"
      + "<input type=\"number\" id=\"tx-p\" oninput=\"updateConversion()\" placeholder=\""
      + (isCL ? "금액" : "1주당 가격") + "\""
      + (a.amount && !isCL ? " value=\"" + a.amount + "\"" : "")
      + ">"
      + "<div id=\"tx-kp\" style=\"font-size:12px;color:var(--green);font-weight:600;margin-top:3px;min-height:16px\">"
      + (a.amount && !isCL ? "→ " + formatCurrency(a.amount) : "")
      + "</div>"
      + (isF ? "<div id=\"tx-cv\" style=\"font-size:10.5px;color:var(--t4);margin-top:1px\"></div>" : "")
      + "</div>";
  }

  // 수량 입력 (현금/USDT 제외)
  if (!isCL && !isU) {
    h += "<div class=\"fld\"><label>수량</label>"
      + "<input type=\"number\" id=\"tx-q\" placeholder=\"수량\" value=\"1\" step=\"any\">"
      + "</div>";
  }

  // 계좌명
  h += "<div class=\"fld\"><label>"
    + (isCL ? "계좌명" : "계좌명 (선택)")
    + "</label>"
    + "<input id=\"tx-a\" maxlength=\"50\" placeholder=\""
    + (isU ? "예: 업비트, 빗썸" : isCL ? "예: 농협은행, 카카오뱅크" : "예: 키움증권, 삼성증권")
    + "\">";
  if (al.length > 0) {
    h += "<div style=\"margin-top:5px;display:flex;gap:4px;flex-wrap:wrap\">";
    al.forEach(function(ac) {
      h += "<button class=\"cchip\" style=\"padding:3px 8px\" onclick=\"document.getElementById("
        + QUOTE + "tx-a" + QUOTE + ").value=" + QUOTE + escapeHtml(ac) + QUOTE + "\">"
        + escapeHtml(ac) + "</button>";
    });
    h += "</div>";
  }
  h += "</div>";

  // 날짜
  h += "<div class=\"fld\"><label>날짜</label>"
    + "<input type=\"date\" id=\"tx-d\" value=\"" + getTodayString() + "\">"
    + "</div>";

  // 메모
  h += "<div class=\"fld\"><label>메모 (선택)</label>"
    + "<input id=\"tx-m\" maxlength=\"200\" placeholder=\"메모\">"
    + "</div>";

  // 버튼
  h += "<div class=\"mbtn\">"
    + "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>"
    + "<button class=\"btn " + (type === "buy" ? "btn-p" : "btn-d") + "\" style=\"flex:2\" onclick=\"doTransaction("
    + assetId + "," + QUOTE + type + QUOTE + ")\">기록하기</button>"
    + "</div>";

  openModal(a.name + " " + lbl, h);

  // 환율 비동기 조회
  if (isF && (!cachedExchangeRate || !cachedExchangeRate.r)) {
    getExchangeRate().then(function(rt) {
      var re = document.getElementById("tx-rate");
      if (re) re.innerHTML = "💱 현재 환율: " + Math.round(rt).toLocaleString() + "원/$ ✓";
    });
  }

  // USDT 시세 비동기 조회
  if (isU) {
    getUsdtExchangeRate().then(function(rt) {
      var src = cachedUsdtRate && cachedUsdtRate.src ? cachedUsdtRate.src : "";
      var re = document.getElementById("tx-usdt-rate");
      if (re) re.innerHTML = "💱 1 USDT ≈ " + Math.round(rt) + "원" + (src ? " (" + src + " 실시간)" : "");
    });
  }
}

// --- 통화 선택 ---

function selectCurrency(c) {
  var a = document.getElementById("cur-krw");
  var b = document.getElementById("cur-usd");
  var h = document.getElementById("tx-cur");
  if (a) a.classList.toggle("sel", c === "KRW");
  if (b) b.classList.toggle("sel", c === "USD");
  if (h) h.value = c;
  updateConversion();
}

// --- 환산 미리보기 ---

function updateConversion() {
  var cv = document.getElementById("tx-cv");
  var cur = document.getElementById("tx-cur");
  var pi = document.getElementById("tx-p");
  var kp = document.getElementById("tx-kp");

  if (pi) {
    var pv = Number(pi.value);
    if (kp) {
      kp.textContent = pv > 0 ? "→ " + formatCurrency(pv) : "";
    }
  }

  if (!cv || !cur || !pi) return;
  var p = Number(pi.value);

  if (cur.value === "USD" && p > 0) {
    getExchangeRate().then(function(rt) {
      var krw = Math.round(p * rt);
      cv.innerHTML = "≈ " + formatNumber(krw)
        + " <span style=\"color:var(--t5)\">(1$ ≈ " + Math.round(rt).toLocaleString() + "원"
        + (cachedExchangeRate && cachedExchangeRate.r ? " ✓" : "") + ")</span>";
    });
  } else {
    cv.textContent = "";
  }
}

// --- USDT 환산 미리보기 ---

function updateUsdtConversion() {
  var uq = document.getElementById("tx-uq");
  var cv = document.getElementById("tx-usdt-cv");
  var hp = document.getElementById("tx-p");

  if (!uq || !cv) return;
  var q = Number(uq.value);

  if (q > 0) {
    getUsdtExchangeRate().then(function(rt) {
      var krw = Math.round(q * rt);
      var src = cachedUsdtRate && cachedUsdtRate.src ? cachedUsdtRate.src : "";
      cv.innerHTML = "≈ " + formatNumber(krw) + " 원화 환산" + (src ? " (" + src + ")" : "");
      if (hp) hp.value = krw;
    });
  } else {
    cv.textContent = "";
    if (hp) hp.value = "0";
  }
}

// --- 거래 기록 실행 ---

function doTransaction(assetId, type) {
  if (type !== "buy" && type !== "sell") return;

  var a = null;
  appState.assets.forEach(function(x) { if (x.id === assetId) a = x; });
  if (!a) return;

  if ((a.txns || []).length >= 5000) {
    showToast("⚠️ 거래 내역이 너무 많습니다 (최대 5000건)");
    return;
  }

  var isU = a.isUsdt;
  var uqe = document.getElementById("tx-uq");
  var p = Number(document.getElementById("tx-p").value);
  var qe = document.getElementById("tx-q");
  var q = qe ? Number(qe.value) : 1;
  if (!isFinite(p) || !isFinite(q)) return;

  var acctVal = (document.getElementById("tx-a").value || "").trim().slice(0, 50) || null;
  var memoVal = (document.getElementById("tx-m").value || "").trim().slice(0, 200);
  var dateVal = document.getElementById("tx-d").value || getTodayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) dateVal = getTodayString();

  // USDT 거래
  if (isU) {
    var uq = uqe ? Number(uqe.value) : 0;
    if (!uq || !isFinite(uq)) return;
    captureUndo();

    getUsdtExchangeRate().then(function(rt) {
      var krw = Math.round(uq * rt);
      if (!a.txns) a.txns = [];
      var src = cachedUsdtRate && cachedUsdtRate.src ? cachedUsdtRate.src : "";
      a.txns.push({
        id: generateId(),
        type: type,
        price: krw,
        qty: 1,
        account: acctVal,
        date: dateVal,
        memo: memoVal || (uq + " USDT (1USDT=" + Math.round(rt) + "원" + (src ? " " + src : "") + ")")
      });
      appState.history = makeSnapshot(appState.assets, appState.history);
      saveData();
      closeModal();
      render();
      showToast("✅ " + a.name + " " + getTransactionLabel(a.category, type) + " 기록 완료", true);
    });
    return;
  }

  // 일반 거래
  if (!p || (qe && !q)) return;
  captureUndo();

  var cur = document.getElementById("tx-cur");
  var isUSD = cur && cur.value === "USD";

  function saveTxn(finalP, rate) {
    if (!a.txns) a.txns = [];
    a.txns.push({
      id: generateId(),
      type: type,
      price: finalP,
      qty: q,
      account: acctVal,
      date: dateVal,
      memo: memoVal || (isUSD ? "$" + p + " (" + Math.round(rate) + "원/달러)" : null)
    });
    appState.history = makeSnapshot(appState.assets, appState.history);
    saveData();
    closeModal();
    render();
    showToast("✅ " + a.name + " " + getTransactionLabel(a.category, type) + " 기록 완료", true);
  }

  if (isUSD) {
    getExchangeRate().then(function(rt) {
      saveTxn(Math.round(p * rt), rt);
    });
  } else {
    saveTxn(p, 0);
  }
}

// --- 거래 내역 목록 모달 ---

function openTransactionList(assetId) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === assetId) a = x; });
  if (!a) return;

  var txns = (a.txns || []).slice().reverse();
  var isCL = isCashLike(a.category);

  var h = "<div style=\"margin-bottom:12px;display:flex;gap:6px\">";
  if (isCL) {
    h += "<button class=\"btn-buy\" onclick=\"closeModal();setTimeout(function(){openBalanceUpdate("
      + a.id + ")},100)\">💰 잔액 업데이트</button>";
  } else {
    h += "<button class=\"btn-buy\" onclick=\"closeModal();setTimeout(function(){openTransaction("
      + a.id + "," + QUOTE + "buy" + QUOTE + ")},100)\">+ "
      + getTransactionLabel(a.category, "buy") + "</button>"
      + "<button class=\"btn-sell\" onclick=\"closeModal();setTimeout(function(){openTransaction("
      + a.id + "," + QUOTE + "sell" + QUOTE + ")},100)\">+ "
      + getTransactionLabel(a.category, "sell") + "</button>";
  }
  h += "</div>";

  if (!txns.length) {
    h += "<div style=\"text-align:center;color:var(--t4);padding:20px;font-size:13px\">거래 내역이 없습니다</div>";
  } else {
    txns.forEach(function(t) {
      h += "<div class=\"txr\" style=\"padding:9px 0\">"
        + "<span class=\"txt " + (t.type === "buy" ? "txb" : "txs") + "\">"
        + getTransactionLabel(a.category, t.type) + "</span>"
        + "<div style=\"flex:1\"><div>"
        + "<span style=\"color:var(--t1);font-weight:600\">" + formatNumber(t.price) + "</span>"
        + (isCL ? "" : " × " + t.qty + " = <span style=\"color:var(--t1);font-weight:600\">"
          + formatNumber(t.price * t.qty) + "</span>")
        + "</div>"
        + "<div style=\"font-size:10px;color:var(--t5);margin-top:2px\">"
        + (t.date || "")
        + (t.account ? " · " + escapeHtml(t.account) : "")
        + (t.memo ? " · " + escapeHtml(t.memo) : "")
        + "</div></div>"
        + "<button class=\"ibtn\" style=\"background:rgba(239,68,68,.05);color:var(--red);width:28px;height:28px;font-size:11px\" onclick=\"deleteTransaction("
        + a.id + "," + t.id + ")\">✕</button>"
        + "</div>";
    });
  }

  h += "<div class=\"mbtn\" style=\"margin-top:14px\">"
    + "<button class=\"btn btn-g btn-w\" onclick=\"closeModal()\">닫기</button>"
    + "</div>";

  openModal(a.name + " 거래 내역", h);
}

// --- 거래 삭제 ---

function deleteTransaction(assetId, transactionId) {
  if (!confirm("이 거래 내역을 삭제하시겠습니까?")) return;

  var a = null;
  appState.assets.forEach(function(x) { if (x.id === assetId) a = x; });
  if (!a) return;

  captureUndo();
  a.txns = a.txns.filter(function(t) { return t.id !== transactionId; });
  appState.history = makeSnapshot(appState.assets, appState.history);
  saveData();
  closeModal();
  openTransactionList(assetId);
}

// --- 잔액 업데이트 모달 ---

function openBalanceUpdate(assetId) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === assetId) a = x; });
  if (!a) return;

  var c = calcAsset(a);
  var curBal = c.evalAmt || 0;

  var accs = {};
  (a.txns || []).forEach(function(t) { if (t.account) accs[t.account] = 1; });
  var al = Object.keys(accs);
  var isU = a.isUsdt;

  var h = "";

  if (isU) {
    // USDT 잔액 표시
    h += "<div style=\"padding:14px 16px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.12);border-radius:12px;margin-bottom:14px\">"
      + "<div style=\"font-size:11px;color:var(--t4);margin-bottom:4px\">현재 기록된 잔액 (원화)</div>"
      + "<div style=\"font-size:22px;font-weight:800;color:var(--t1)\">" + formatCurrency(curBal) + "</div>"
      + "<div style=\"font-size:11px;color:var(--t5);margin-top:2px\">" + formatShortCurrency(curBal) + "</div>"
      + "<div id=\"bal-usdt-est\" style=\"font-size:11px;color:var(--t4);margin-top:6px\">💲 USDT 환산 조회 중...</div>"
      + "</div>";

    h += "<div class=\"fld\"><label>💲 현재 보유 USDT 수량</label>"
      + "<input type=\"number\" id=\"bal-uq\" step=\"any\" placeholder=\"예: 500\" data-cur=\"" + curBal + "\" oninput=\"previewUsdtDiff()\">"
      + "<div id=\"bal-usdt-rate\" style=\"font-size:10.5px;color:var(--t5);margin-top:4px\">💱 USDT 시세 조회 중...</div>"
      + "<div id=\"bal-usdt-cv\" style=\"font-size:12px;color:var(--green);font-weight:600;margin-top:4px;min-height:18px\"></div>"
      + "<div id=\"bal-diff\" style=\"font-size:12.5px;font-weight:600;margin-top:6px;min-height:20px\"></div>"
      + "</div>";
  } else {
    // 일반 잔액 표시
    h += "<div style=\"padding:14px 16px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.12);border-radius:12px;margin-bottom:14px\">"
      + "<div style=\"font-size:11px;color:var(--t4);margin-bottom:4px\">현재 기록된 잔액</div>"
      + "<div style=\"font-size:22px;font-weight:800;color:var(--t1)\">" + formatCurrency(curBal) + "</div>"
      + "<div style=\"font-size:11px;color:var(--t5);margin-top:2px\">" + formatShortCurrency(curBal) + "</div>"
      + "</div>";

    h += "<div class=\"fld\"><label>새 잔액 입력 (원)</label>"
      + "<input type=\"number\" id=\"bal-new\" placeholder=\"현재 통장 잔액을 입력하세요\" oninput=\"previewBalanceDiff(this.value," + curBal + ")\">"
      + "<div id=\"bal-prev\" style=\"font-size:12px;color:var(--green);font-weight:600;margin-top:4px;min-height:18px\"></div>"
      + "<div id=\"bal-diff\" style=\"font-size:12.5px;font-weight:600;margin-top:6px;min-height:20px\"></div>"
      + "</div>";
  }

  // 계좌명
  h += "<div class=\"fld\"><label>"
    + (a.category === "예적금" ? "계좌명" : "계좌명 (선택)")
    + "</label>"
    + "<input id=\"bal-a\" maxlength=\"50\" placeholder=\""
    + (isU ? "예: 업비트, 빗썸" : a.category === "예적금" ? "예: 공제회, 청년도약계좌" : "예: 농협은행, 카카오뱅크")
    + "\">";
  if (al.length > 0) {
    h += "<div style=\"margin-top:5px;display:flex;gap:4px;flex-wrap:wrap\">";
    al.forEach(function(ac) {
      h += "<button class=\"cchip\" style=\"padding:3px 8px\" onclick=\"document.getElementById("
        + QUOTE + "bal-a" + QUOTE + ").value=" + QUOTE + escapeHtml(ac) + QUOTE + "\">"
        + escapeHtml(ac) + "</button>";
    });
    h += "</div>";
  }
  h += "</div>";

  // 날짜
  h += "<div class=\"fld\"><label>날짜</label>"
    + "<input type=\"date\" id=\"bal-d\" value=\"" + getTodayString() + "\">"
    + "</div>";

  // 메모
  h += "<div class=\"fld\"><label>메모 (선택)</label>"
    + "<input id=\"bal-m\" maxlength=\"200\" placeholder=\"메모\">"
    + "</div>";

  // 버튼
  h += "<div class=\"mbtn\">"
    + "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>"
    + "<button class=\"btn btn-p\" style=\"flex:2\" onclick=\""
    + (isU ? "doUsdtBalanceUpdate(" + assetId + "," + curBal + ")" : "doBalanceUpdate(" + assetId + "," + curBal + ")")
    + "\">💰 잔액 업데이트</button>"
    + "</div>";

  openModal(a.name + " 잔액 업데이트", h);

  // USDT 시세 비동기 조회
  if (isU) {
    getUsdtExchangeRate().then(function(rt) {
      var src = cachedUsdtRate && cachedUsdtRate.src ? cachedUsdtRate.src : "";
      var estEl = document.getElementById("bal-usdt-est");
      if (estEl) {
        var estQty = curBal > 0 ? (curBal / rt).toFixed(2) : "0";
        estEl.innerHTML = "💲 약 " + estQty + " USDT <span style=\"color:var(--t5)\">(1 USDT ≈ "
          + Math.round(rt).toLocaleString() + "원" + (src ? " " + src : "") + ")</span>";
      }
      var rEl = document.getElementById("bal-usdt-rate");
      if (rEl) {
        rEl.innerHTML = "💱 1 USDT ≈ " + Math.round(rt).toLocaleString() + "원"
          + (src ? " (" + src + " 실시간)" : "");
      }
    });
  }
}

// --- 잔액 변동 미리보기 ---

function previewBalanceDiff(v, cur) {
  var el = document.getElementById("bal-prev");
  var df = document.getElementById("bal-diff");
  var n = Number(v);

  if (el) {
    el.textContent = n > 0 ? "→ " + formatCurrency(n) : "";
  }
  if (!df) return;

  if (!n && n !== 0) {
    df.textContent = "";
    return;
  }

  var diff = n - cur;
  if (diff === 0) {
    df.innerHTML = "<span style=\"color:var(--t4)\">변동 없음</span>";
  } else if (diff > 0) {
    df.innerHTML = "<span style=\"color:var(--red)\">📈 +" + formatCurrency(diff) + " "
      + getTransactionLabel("현금", "buy") + "</span>";
  } else {
    df.innerHTML = "<span style=\"color:var(--blue)\">📉 " + formatCurrency(diff) + " "
      + getTransactionLabel("현금", "sell") + "</span>";
  }
}

// --- USDT 잔액 변동 미리보기 ---

function previewUsdtDiff() {
  var uq = document.getElementById("bal-uq");
  var cv = document.getElementById("bal-usdt-cv");
  var df = document.getElementById("bal-diff");

  if (!uq) return;
  var q = Number(uq.value);

  if (!q || q < 0) {
    if (cv) cv.textContent = "";
    if (df) df.textContent = "";
    return;
  }

  getUsdtExchangeRate().then(function(rt) {
    var newKrw = Math.round(q * rt);
    var curBal = Number(uq.getAttribute("data-cur") || 0);

    if (cv) {
      var src = cachedUsdtRate && cachedUsdtRate.src ? cachedUsdtRate.src : "";
      cv.innerHTML = "≈ " + formatCurrency(newKrw) + " (" + formatShortCurrency(newKrw) + ")"
        + (src ? " · " + src : "");
    }

    if (df) {
      var diff = newKrw - curBal;
      if (diff === 0) {
        df.innerHTML = "<span style=\"color:var(--t4)\">변동 없음</span>";
      } else if (diff > 0) {
        df.innerHTML = "<span style=\"color:var(--red)\">📈 +" + formatCurrency(diff) + " 입금</span>";
      } else {
        df.innerHTML = "<span style=\"color:var(--blue)\">📉 " + formatCurrency(diff) + " 출금</span>";
      }
    }
  });
}

// --- 잔액 업데이트 실행 ---

function doBalanceUpdate(assetId, currentBalance) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === assetId) a = x; });
  if (!a) return;

  var newBal = Number((document.getElementById("bal-new") || {}).value);
  if (!isFinite(newBal) || newBal < 0) {
    showToast("❌ 올바른 금액을 입력하세요");
    return;
  }

  var diff = Math.round(newBal) - Math.round(currentBalance);
  if (diff === 0) {
    showToast("ℹ️ 잔액이 동일합니다");
    return;
  }

  if ((a.txns || []).length >= 5000) {
    showToast("⚠️ 거래 내역이 너무 많습니다 (최대 5000건)");
    return;
  }

  if (!a.txns) a.txns = [];

  var acctVal = (document.getElementById("bal-a").value || "").trim().slice(0, 50) || null;
  var memoVal = (document.getElementById("bal-m").value || "").trim().slice(0, 200);
  var dateVal = document.getElementById("bal-d").value || getTodayString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) dateVal = getTodayString();

  var type = diff > 0 ? "buy" : "sell";
  var amt = Math.abs(diff);

  a.txns.push({
    id: generateId(),
    type: type,
    price: amt,
    qty: 1,
    account: acctVal,
    date: dateVal,
    memo: memoVal || ("잔액 " + formatCurrency(Math.round(currentBalance)) + " → " + formatCurrency(Math.round(newBal)))
  });

  appState.history = makeSnapshot(appState.assets, appState.history);
  saveData();
  closeModal();
  showToast("✅ 잔액이 " + formatCurrency(Math.round(newBal)) + "으로 업데이트되었습니다");
  render();
}

// --- USDT 잔액 업데이트 실행 ---

function doUsdtBalanceUpdate(assetId, currentBalance) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === assetId) a = x; });
  if (!a) return;

  var uq = Number((document.getElementById("bal-uq") || {}).value);
  if (!isFinite(uq) || uq < 0) {
    showToast("❌ 올바른 USDT 수량을 입력하세요");
    return;
  }

  if ((a.txns || []).length >= 5000) {
    showToast("⚠️ 거래 내역이 너무 많습니다");
    return;
  }

  getUsdtExchangeRate().then(function(rt) {
    var newKrw = Math.round(uq * rt);
    var diff = newKrw - Math.round(currentBalance);

    if (diff === 0) {
      showToast("ℹ️ 잔액이 동일합니다");
      return;
    }

    if (!a.txns) a.txns = [];

    var acctVal = (document.getElementById("bal-a").value || "").trim().slice(0, 50) || null;
    var memoVal = (document.getElementById("bal-m").value || "").trim().slice(0, 200);
    var dateVal = document.getElementById("bal-d").value || getTodayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) dateVal = getTodayString();

    var type = diff > 0 ? "buy" : "sell";
    var amt = Math.abs(diff);
    var src = cachedUsdtRate && cachedUsdtRate.src ? cachedUsdtRate.src : "";

    a.txns.push({
      id: generateId(),
      type: type,
      price: amt,
      qty: 1,
      account: acctVal,
      date: dateVal,
      memo: memoVal || (uq + " USDT (1USDT=" + Math.round(rt) + "원" + (src ? " " + src : "") + ") 잔액→" + formatCurrency(newKrw))
    });

    appState.history = makeSnapshot(appState.assets, appState.history);
    saveData();
    closeModal();
    showToast("✅ USDT 잔액이 " + formatCurrency(newKrw) + "(" + uq + " USDT)으로 업데이트되었습니다");
    render();
  });
}

// --- 새 자산 추가 모달 ---

function openAddAsset() {
  var h = "<div class=\"fld\"><label>자산 분류</label>"
    + "<div class=\"sel-wrap\"><select id=\"f-cat\" onchange=\"onCategoryChange()\">"
    + buildCategoryOptions("국내주식")
    + "</select></div></div>"
    + "<div class=\"fld\"><label>자산명</label>"
    + "<input id=\"f-name\" maxlength=\"100\" placeholder=\"예: 삼성전자, 비트코인, 테슬라\">"
    + "</div>"
    + "<div id=\"f-extra\"></div>"
    + "<div class=\"mbtn\">"
    + "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>"
    + "<button class=\"btn btn-p\" style=\"flex:2\" onclick=\"doAddAsset()\">추가하기</button>"
    + "</div>";

  openModal("새 자산 추가", h);
  onCategoryChange();
}

// --- 카테고리 변경 핸들러 ---

function onCategoryChange() {
  var cat = document.getElementById("f-cat").value;
  var ex = document.getElementById("f-extra");
  var ni = document.getElementById("f-name");

  var ph = {
    "국내주식": "예: 삼성전자, SK하이닉스",
    "해외주식": "예: 애플, 테슬라, 엔비디아",
    "코인": "예: 비트코인, 이더리움",
    "현금": "예: 농협 은행 통장, CMA 계좌",
    "예적금": "예: 공제회, 청년도약계좌",
    "부동산": "예: 강남 아파트, 오피스텔",
    "기타": "예: 금, 달러, 연금"
  };
  if (ni) ni.placeholder = ph[cat] || "자산명을 입력하세요";

  if (cat === "국내주식") {
    ex.innerHTML = "<div class=\"fld\"><label>종목코드</label>"
      + "<input id=\"f-code\" maxlength=\"20\" placeholder=\"예: 005930\">"
      + "<div class=\"ht\">종목코드 입력 시 가격 자동 업데이트</div>"
      + "<div class=\"cgrid\">"
      + KR_STOCK_PRESETS.map(function(s) {
          return "<div class=\"cchip\" onclick=\"selectKoreanStock("
            + QUOTE + s.code + QUOTE + "," + QUOTE + s.name + QUOTE + ",this)\">"
            + s.name + "</div>";
        }).join("")
      + "</div></div>"
      + "<div class=\"fld\"><label>시장</label>"
      + "<div class=\"mkt-sel\">"
      + "<button class=\"mkt-opt sel\" id=\"mk-a\" onclick=\"selectMarket(" + QUOTE + "KOSPI" + QUOTE + ")\">KOSPI</button>"
      + "<button class=\"mkt-opt\" id=\"mk-b\" onclick=\"selectMarket(" + QUOTE + "KOSDAQ" + QUOTE + ")\">KOSDAQ</button>"
      + "</div></div>";

  } else if (cat === "해외주식") {
    ex.innerHTML = "<div class=\"fld\"><label>🇰🇷 국내 상장 해외 ETF</label>"
      + "<div class=\"ht\">한국 거래소에 상장된 해외 투자 ETF (원화 거래)</div>"
      + "<div class=\"cgrid\" id=\"kr-etf-grid\">"
      + KR_FOREIGN_ETF_PRESETS.slice(0, 8).map(function(s) {
          return "<div class=\"cchip\" onclick=\"selectKoreanEtf("
            + QUOTE + s.code + QUOTE + "," + QUOTE + s.name + QUOTE + ",this)\">"
            + s.name + "</div>";
        }).join("")
      + "</div>"
      + "<button style=\"border:none;background:none;color:#60A5FA;font-size:11px;cursor:pointer;font-family:inherit;margin-top:4px;padding:0\" id=\"kr-etf-more\" onclick=\"showAllKoreanEtfs()\">+ 더보기 ("
      + KR_FOREIGN_ETF_PRESETS.length + "종목)</button>"
      + "</div>"
      + "<div style=\"border-top:1px solid rgba(255,255,255,.04);margin:10px 0\"></div>"
      + "<div class=\"fld\"><label>🌎 해외 직접투자 종목</label>"
      + "<input id=\"f-code\" maxlength=\"20\" placeholder=\"티커: AAPL, TSLA 또는 ETF 종목코드: 360750\">"
      + "<div class=\"ht\">티커 입력 시 USD→원 자동 변환 / 종목코드 입력 시 원화 직접 조회</div>"
      + "<div class=\"cgrid\">"
      + [["AAPL", "애플"], ["MSFT", "MS"], ["GOOGL", "구글"], ["AMZN", "아마존"],
         ["NVDA", "엔비디아"], ["TSLA", "테슬라"], ["META", "메타"], ["NFLX", "넷플릭스"]
        ].map(function(s) {
          return "<div class=\"cchip\" onclick=\"selectUsStock("
            + QUOTE + s[0] + QUOTE + "," + QUOTE + s[1] + QUOTE + ",this)\">"
            + s[1] + "</div>";
        }).join("")
      + "</div></div>"
      + "<input type=\"hidden\" id=\"f-krxEtf\" value=\"\">";

  } else if (cat === "코인") {
    ex.innerHTML = "<div class=\"fld\"><label>코인 선택</label>"
      + "<div class=\"cgrid\">"
      + TOP_COIN_IDS.map(function(id) {
          return "<div class=\"cchip\" data-id=\"" + id + "\" onclick=\"selectCoin("
            + QUOTE + id + QUOTE + ")\">"
            + (COIN_KOREAN_NAMES[id] || id) + "</div>";
        }).join("")
      + "</div>"
      + "<input id=\"f-coinId\" maxlength=\"80\" placeholder=\"또는 CoinGecko ID 직접 입력\" style=\"width:100%;padding:8px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.06);background:var(--card2);color:var(--t1);font-size:12px;outline:none;font-family:inherit;margin-top:6px\">"
      + "<div class=\"ht\">코인 선택 시 가격 자동 업데이트</div>"
      + "</div>";

  } else if (cat === "현금") {
    ex.innerHTML = "<div class=\"fld\"><label>빠른 선택</label>"
      + "<div class=\"cgrid\">"
      + [["농협 은행 통장", "💚"], ["CMA 계좌", "📊"], ["카카오뱅크 통장", "🟡"], ["토스뱅크 통장", "🔵"]
        ].map(function(s) {
          return "<div class=\"cchip\" onclick=\"selectAssetName("
            + QUOTE + s[0] + QUOTE + ",this)\">" + s[1] + " " + s[0] + "</div>";
        }).join("")
      + "<div class=\"cchip\" onclick=\"selectUsdt(this)\" style=\"border:1px solid rgba(16,185,129,.2)\">💲 USDT 보유분</div>"
      + "</div>"
      + "<div class=\"ht\">선택하거나 위에 직접 입력하세요</div>"
      + "</div>"
      + "<input type=\"hidden\" id=\"f-isUsdt\" value=\"\">";

  } else if (cat === "예적금") {
    ex.innerHTML = "<div class=\"fld\"><label>빠른 선택</label>"
      + "<div class=\"cgrid\">"
      + [["공제회", "🏛️"], ["청년도약계좌", "🌱"], ["정기적금", "🏦"], ["ISA 계좌", "📈"]
        ].map(function(s) {
          return "<div class=\"cchip\" onclick=\"selectAssetName("
            + QUOTE + s[0] + QUOTE + ",this)\">" + s[1] + " " + s[0] + "</div>";
        }).join("")
      + "</div>"
      + "<div class=\"ht\">선택하거나 위에 직접 입력하세요</div>"
      + "</div>";

  } else {
    ex.innerHTML = "";
  }
}

// --- 시장 선택 ---

function selectMarket(m) {
  selectedMarket = m;
  var a = document.getElementById("mk-a");
  var b = document.getElementById("mk-b");
  if (a) a.classList.toggle("sel", m === "KOSPI");
  if (b) b.classList.toggle("sel", m === "KOSDAQ");
}

// --- 국내 종목 선택 ---

function selectKoreanStock(c, n, el) {
  document.getElementById("f-code").value = c;
  var ni = document.getElementById("f-name");
  if (ni && !ni.value) ni.value = n;
  document.querySelectorAll("#f-extra .cchip").forEach(function(e) {
    e.classList.remove("sel");
  });
  if (el) el.classList.add("sel");
}

// --- 해외 종목 선택 ---

function selectUsStock(t, n, el) {
  document.getElementById("f-code").value = t;
  var ni = document.getElementById("f-name");
  if (ni && !ni.value) ni.value = n;
  var ke = document.getElementById("f-krxEtf");
  if (ke) ke.value = "";
  document.querySelectorAll("#f-extra .cchip").forEach(function(e) {
    e.classList.remove("sel");
  });
  if (el) el.classList.add("sel");
}

// --- 국내 상장 해외 ETF 선택 ---

function selectKoreanEtf(c, n, el) {
  document.getElementById("f-code").value = c;
  var ni = document.getElementById("f-name");
  if (ni) ni.value = n;
  var ke = document.getElementById("f-krxEtf");
  if (ke) ke.value = "1";
  document.querySelectorAll("#f-extra .cchip").forEach(function(e) {
    e.classList.remove("sel");
  });
  if (el) el.classList.add("sel");
}

// --- 전체 해외 ETF 목록 표시 ---

function showAllKoreanEtfs() {
  var g = document.getElementById("kr-etf-grid");
  var btn = document.getElementById("kr-etf-more");
  if (!g) return;

  g.innerHTML = KR_FOREIGN_ETF_PRESETS.map(function(s) {
    return "<div class=\"cchip\" onclick=\"selectKoreanEtf("
      + QUOTE + s.code + QUOTE + "," + QUOTE + s.name + QUOTE + ",this)\">"
      + s.name + "</div>";
  }).join("");

  if (btn) btn.style.display = "none";
}

// --- 코인 선택 ---

function selectCoin(id) {
  document.querySelectorAll("#f-extra .cchip").forEach(function(el) {
    el.classList.toggle("sel", el.dataset && el.dataset.id === id);
  });
  var inp = document.getElementById("f-coinId");
  if (inp) inp.value = id;
  var ni = document.getElementById("f-name");
  if (ni && !ni.value) ni.value = COIN_KOREAN_NAMES[id] || id;
}

// --- 자산명 빠른 선택 ---

function selectAssetName(n, el) {
  var ni = document.getElementById("f-name");
  if (ni) ni.value = n;
  var uf = document.getElementById("f-isUsdt");
  if (uf) uf.value = "";
  document.querySelectorAll("#f-extra .cchip").forEach(function(e) {
    e.classList.remove("sel");
  });
  if (el) el.classList.add("sel");
}

// --- USDT 선택 ---

function selectUsdt(el) {
  var ni = document.getElementById("f-name");
  if (ni) ni.value = "USDT 보유분";
  var uf = document.getElementById("f-isUsdt");
  if (uf) uf.value = "1";
  document.querySelectorAll("#f-extra .cchip").forEach(function(e) {
    e.classList.remove("sel");
  });
  if (el) el.classList.add("sel");
}

// --- 자산 추가 실행 ---

function doAddAsset() {
  var name = ((document.getElementById("f-name") || {}).value || "").trim().slice(0, 100);
  var cat = (document.getElementById("f-cat") || {}).value;
  if (!name || CATEGORY_LIST.indexOf(cat) < 0) return;

  var item = {
    name: name,
    category: cat,
    amount: 0,
    id: generateId(),
    lpu: null,
    coinId: null,
    stockCode: null,
    market: null,
    krxEtf: false,
    isUsdt: false,
    txns: []
  };

  if (cat === "코인") {
    item.coinId = ((document.getElementById("f-coinId") || {}).value || "").trim().slice(0, 80) || resolveCoinId(name);
  }

  if (cat === "국내주식") {
    item.stockCode = ((document.getElementById("f-code") || {}).value || "").trim().slice(0, 20).replace(/[^A-Za-z0-9]/g, "") || null;
    item.market = selectedMarket;
  }

  if (cat === "해외주식") {
    var code = (((document.getElementById("f-code") || {}).value || "").trim().slice(0, 20)) || null;
    var isKrx = document.getElementById("f-krxEtf");
    if (isKrx && isKrx.value === "1") {
      item.stockCode = code;
      item.krxEtf = true;
      item.market = "KOSPI";
    } else if (code && /^\d{6}$/.test(code)) {
      item.stockCode = code;
      item.krxEtf = true;
      item.market = "KOSPI";
    } else {
      item.stockCode = code ? code.toUpperCase().replace(/[^A-Z0-9\.]/g, "") : null;
    }
  }

  var uf = document.getElementById("f-isUsdt");
  if (cat === "현금" && uf && uf.value === "1") item.isUsdt = true;

  if (appState.assets.length >= 500) {
    showToast("⚠️ 자산은 최대 500개까지 등록 가능합니다");
    return;
  }

  captureUndo();
  appState.assets.push(item);
  saveData();
  closeModal();
  render();
  showToast("✅ " + name + " 자산이 추가되었습니다", true);
}

// --- 자산 수정 모달 ---

function openEditAsset(id) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === id) a = x; });
  if (!a) return;

  var ex = "";

  if (a.category === "국내주식") {
    ex = "<div class=\"fld\"><label>종목코드</label>"
      + "<input id=\"e-code\" maxlength=\"20\" value=\"" + escapeHtml(a.stockCode || "") + "\">"
      + "</div>"
      + "<div class=\"fld\"><label>시장</label>"
      + "<div class=\"mkt-sel\">"
      + "<button class=\"mkt-opt" + (a.market !== "KOSDAQ" ? " sel" : "") + "\" onclick=\"this.classList.add("
        + QUOTE + "sel" + QUOTE + ");this.nextElementSibling.classList.remove("
        + QUOTE + "sel" + QUOTE + ");document.getElementById("
        + QUOTE + "e-mkt" + QUOTE + ").value=" + QUOTE + "KOSPI" + QUOTE + "\">KOSPI</button>"
      + "<button class=\"mkt-opt" + (a.market === "KOSDAQ" ? " sel" : "") + "\" onclick=\"this.classList.add("
        + QUOTE + "sel" + QUOTE + ");this.previousElementSibling.classList.remove("
        + QUOTE + "sel" + QUOTE + ");document.getElementById("
        + QUOTE + "e-mkt" + QUOTE + ").value=" + QUOTE + "KOSDAQ" + QUOTE + "\">KOSDAQ</button>"
      + "</div>"
      + "<input type=\"hidden\" id=\"e-mkt\" value=\"" + (a.market || "KOSPI") + "\">"
      + "</div>";
  }

  if (a.category === "해외주식") {
    ex = "<div class=\"fld\"><label>"
      + (a.krxEtf ? "종목코드 (국내 상장)" : "티커")
      + "</label>"
      + "<input id=\"e-code\" maxlength=\"20\" value=\"" + escapeHtml(a.stockCode || "") + "\">"
      + (a.krxEtf ? "<div class=\"ht\">🇰🇷 국내 상장 해외 ETF · 원화 거래</div>" : "")
      + "</div>";
  }

  if (a.category === "코인") {
    ex = "<div class=\"fld\"><label>CoinGecko ID</label>"
      + "<input id=\"e-coinId\" maxlength=\"80\" value=\"" + escapeHtml(a.coinId || "") + "\">"
      + "</div>";
  }

  openModal("자산 수정",
    "<div class=\"fld\"><label>분류</label>"
    + "<div class=\"sel-wrap\"><select id=\"e-cat\">"
    + buildCategoryOptions(a.category)
    + "</select></div></div>"
    + "<div class=\"fld\"><label>자산명</label>"
    + "<input id=\"e-name\" maxlength=\"100\" value=\"" + escapeHtml(a.name) + "\">"
    + "</div>"
    + ex
    + "<div class=\"fld\"><label>📝 메모 (선택)</label>"
    + "<textarea id=\"e-note\" maxlength=\"500\" rows=\"3\" placeholder=\"매수 이유, 목표 매도가, 전략 등\" style=\"width:100%;padding:11px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:var(--card2);color:var(--t1);font-size:13px;outline:none;font-family:inherit;resize:vertical\">"
    + escapeHtml(a.note || "")
    + "</textarea></div>"
    + "<div class=\"mbtn\">"
    + "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>"
    + "<button class=\"btn btn-p\" style=\"flex:2\" onclick=\"doEditAsset(" + id + ")\">저장</button>"
    + "</div>"
  );
}

// --- 자산 수정 실행 ---

function doEditAsset(id) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === id) a = x; });
  if (!a) return;

  captureUndo();

  var newName = ((document.getElementById("e-name") || {}).value || "").trim().slice(0, 100);
  a.name = newName || a.name;

  var newCat = (document.getElementById("e-cat") || {}).value;
  if (CATEGORY_LIST.indexOf(newCat) >= 0) a.category = newCat;

  if (document.getElementById("e-coinId")) {
    a.coinId = document.getElementById("e-coinId").value.trim().slice(0, 80) || null;
  }

  if (document.getElementById("e-code")) {
    a.stockCode = document.getElementById("e-code").value.trim().slice(0, 20) || null;
  }

  if (document.getElementById("e-mkt")) {
    var mk = document.getElementById("e-mkt").value;
    a.market = (mk === "KOSPI" || mk === "KOSDAQ") ? mk : "KOSPI";
  }

  if (document.getElementById("e-note")) {
    a.note = document.getElementById("e-note").value.trim().slice(0, 500) || null;
  }

  appState.history = makeSnapshot(appState.assets, appState.history);
  saveData();
  closeModal();
  render();
  showToast("✅ 자산 정보가 수정되었습니다", true);
}

// --- 자산 삭제 모달 ---

function openDeleteAsset(id) {
  var a = null;
  appState.assets.forEach(function(x) { if (x.id === id) a = x; });
  if (!a) return;

  openModal("자산 삭제",
    "<div style=\"font-size:13.5px;color:var(--t3);margin-bottom:16px\">"
    + "<strong style=\"color:var(--red)\">" + escapeHtml(a.name) + "</strong>을(를) 삭제하시겠습니까?<br>"
    + "<span style=\"font-size:12px;color:var(--t4)\">거래 내역 "
    + ((a.txns || []).length) + "건도 함께 삭제됩니다.</span></div>"
    + "<div class=\"mbtn\">"
    + "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>"
    + "<button class=\"btn btn-d\" onclick=\"doDeleteAsset(" + id + ")\">삭제</button>"
    + "</div>"
  );
}

// --- 자산 삭제 실행 ---

function doDeleteAsset(id) {
  captureUndo();
  appState.assets = appState.assets.filter(function(a) { return a.id !== id; });
  appState.history = makeSnapshot(appState.assets, appState.history);
  saveData();
  closeModal();
  render();
  showToast("🗑 자산이 삭제되었습니다", true);
}

// --- openReset, doReset, exportData, importData, doImport, saveSnapshot 은 ui-history.js 에 정의 ---

// --- 토스트 알림 ---

function showToast(msg, canUndo) {
  var old = document.getElementById("toast-el");
  if (old) old.remove();

  var d = document.createElement("div");
  d.id = "toast-el";
  d.style.cssText = "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);"
    + "background:linear-gradient(135deg,#1A1D23,#252830);color:#F1F5F9;"
    + "padding:14px 24px;border-radius:14px;font-size:13.5px;font-weight:600;"
    + "z-index:9999;border:1px solid rgba(16,185,129,.2);"
    + "box-shadow:0 12px 40px rgba(0,0,0,.5);animation:fadeUp .3s ease;"
    + "font-family:Pretendard Variable,sans-serif;display:flex;align-items:center;gap:12px";

  var sp = document.createElement("span");
  sp.textContent = msg;
  d.appendChild(sp);

  if (canUndo && undoSnapshot) {
    var btn = document.createElement("button");
    btn.textContent = "↩ 취소";
    btn.style.cssText = "border:1px solid rgba(245,158,11,.3);background:rgba(245,158,11,.1);"
      + "color:#FBBF24;padding:5px 12px;border-radius:8px;font-size:12px;"
      + "font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap";
    btn.onclick = function() { performUndo(); };
    d.appendChild(btn);

    var bar = document.createElement("div");
    bar.style.cssText = "position:absolute;bottom:0;left:0;height:3px;"
      + "background:linear-gradient(90deg,#FBBF24,#F59E0B);"
      + "border-radius:0 0 14px 14px;width:100%;animation:undoShrink 7s linear forwards";
    d.appendChild(bar);
  }

  document.body.appendChild(d);

  var dur = canUndo ? 7000 : 2200;
  if (undoTimerHandle) clearTimeout(undoTimerHandle);

  undoTimerHandle = setTimeout(function() {
    d.style.opacity = "0";
    d.style.transition = "opacity .3s";
    setTimeout(function() {
      d.remove();
      if (!canUndo) { undoSnapshot = null; }
    }, 300);
    if (canUndo) {
      setTimeout(function() { undoSnapshot = null; }, 400);
    }
  }, dur);
}
