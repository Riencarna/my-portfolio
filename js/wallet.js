/* wallet.js - EVM 지갑 연동 */

var isWalletScanning = false;
var walletScanResults = [];

// EVM_CHAINS, EVM_TOKENS 는 constants.js 에 정의

function isValidEvmAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

function rpcJsonCall(rpcUrl, method, params) {
  return fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params })
  }).then(function (r) {
    return r.json();
  }).then(function (d) {
    return d.result;
  });
}

function getNativeBalance(chain, addr) {
  return rpcJsonCall(chain.rpc, "eth_getBalance", [addr, "latest"]).then(function (hex) {
    if (!hex) return 0;
    return parseInt(hex, 16) / Math.pow(10, chain.decimals);
  }).catch(function () {
    return 0;
  });
}

function getTokenBalance(rpcUrl, contractAddr, walletAddr, decimals) {
  var data = "0x70a08231000000000000000000000000" + walletAddr.slice(2).toLowerCase();
  return rpcJsonCall(rpcUrl, "eth_call", [{ to: contractAddr, data: data }, "latest"]).then(function (hex) {
    if (!hex || hex === "0x") return 0;
    return parseInt(hex, 16) / Math.pow(10, decimals);
  }).catch(function () {
    return 0;
  });
}

function fetchWalletPrices(ids) {
  var u = ids.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  }).join(",");
  return fetch("https://api.coingecko.com/api/v3/simple/price?ids=" + u + "&vs_currencies=krw,usd").then(function (r) {
    return r.json();
  }).catch(function () {
    return {};
  });
}

function openWalletModal() {
  var savedAddr = localStorage.getItem("wl_addr") || "";
  var h = "<div style=\"padding:2px 0 10px\">";
  h += "<div style=\"font-size:12px;color:var(--t3);margin-bottom:12px\">";
  h += "EVM 지갑 주소를 입력하면 <strong style=\"color:var(--t1)\">6개 체인</strong>의 네이티브 코인과 주요 토큰 잔고를 자동으로 스캔합니다.</div>";
  h += "<div style=\"display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px\">";
  EVM_CHAINS.forEach(function (c) {
    h += "<span style=\"font-size:10.5px;padding:3px 8px;background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:6px;color:var(--t3)\">";
    h += c.icon + " " + c.name + "</span>";
  });
  h += "</div>";
  h += "<div class=\"fld\"><label>지갑 주소 (0x...)</label>";
  h += "<input id=\"wl-addr\" maxlength=\"42\" value=\"" + escapeHtml(savedAddr) + "\" placeholder=\"0x1234...abcd\" style=\"font-size:13px;font-family:monospace\"></div>";
  h += "<div id=\"wl-result\"></div>";
  h += "<div class=\"mbtn\" id=\"wl-outer-btns\">";
  h += "<button class=\"btn btn-g\" onclick=\"closeModal()\">닫기</button>";
  h += "<button class=\"btn btn-p\" style=\"flex:2\" id=\"wl-scan-btn\" onclick=\"scanWallet()\">🔍 스캔 시작</button>";
  h += "</div>";
  h += "</div>";
  openModal("🔗 지갑 연동", h);
}

function scanWallet() {
  var addr = (document.getElementById("wl-addr").value || "").trim();
  if (!isValidEvmAddress(addr)) {
    showToast("❌ 올바른 EVM 주소를 입력하세요 (0x...)");
    return;
  }
  localStorage.setItem("wl_addr", addr);
  isWalletScanning = true;
  walletScanResults = [];

  var el = document.getElementById("wl-result");
  var btn = document.getElementById("wl-scan-btn");
  var ob = document.getElementById("wl-outer-btns");
  if (ob) ob.style.display = "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "<span class=\"spinner sm\"></span> 스캔 중...";
  }

  el.innerHTML = "<div class=\"wl-prog\"><div class=\"wl-prog-bar\" id=\"wl-bar\" style=\"width:0%\"></div></div>"
    + "<div id=\"wl-items\" style=\"margin-top:8px\"></div>"
    + "<div style=\"font-size:11px;color:var(--t4);text-align:center;margin-top:4px\" id=\"wl-status\">체인 스캔 준비 중...</div>";

  var totalTasks = 0, doneTasks = 0;
  EVM_CHAINS.forEach(function (ch) {
    totalTasks++;
    EVM_TOKENS.forEach(function (tk) {
      if (tk.contracts[ch.id]) totalTasks++;
    });
  });

  var allIds = EVM_CHAINS.map(function (c) { return c.coingeckoId; });
  EVM_TOKENS.forEach(function (tk) { allIds.push(tk.coingeckoId); });

  fetchWalletPrices(allIds).then(function (prices) {
    var chainPromises = EVM_CHAINS.map(function (ch) {
      return getNativeBalance(ch, addr).then(function (bal) {
        doneTasks++;
        updateWalletProgressBar(doneTasks, totalTasks);

        var p = prices[ch.coingeckoId];
        var krw = p ? p.krw : 0;
        var usd = p ? p.usd : 0;

        if (bal > 0.0001) {
          walletScanResults.push({
            type: "native", chain: ch.id, chainName: ch.name, chainIc: ch.icon,
            symbol: ch.symbol, name: ch.name + " (" + ch.symbol + ")",
            balance: bal, priceKrw: krw, priceUsd: usd,
            valueKrw: bal * krw, coingeckoId: ch.coingeckoId, checked: true
          });
        }

        var tokenPromises = EVM_TOKENS.filter(function (tk) {
          return tk.contracts[ch.id];
        }).map(function (tk) {
          return getTokenBalance(ch.rpc, tk.contracts[ch.id], addr, tk.decimals).then(function (tbal) {
            doneTasks++;
            updateWalletProgressBar(doneTasks, totalTasks);
            if (tbal > 0.01) {
              var tp = prices[tk.coingeckoId];
              var tkrw = tp ? tp.krw : 0;
              var tusd = tp ? tp.usd : 0;
              walletScanResults.push({
                type: "token", chain: ch.id, chainName: ch.name, chainIc: ch.icon,
                symbol: tk.symbol, name: tk.name + " (" + ch.name + ")",
                balance: tbal, priceKrw: tkrw, priceUsd: tusd,
                valueKrw: tbal * tkrw, coingeckoId: tk.coingeckoId,
                checked: tbal * tusd >= 1
              });
            }
          }).catch(function () {
            doneTasks++;
            updateWalletProgressBar(doneTasks, totalTasks);
          });
        });

        return Promise.all(tokenPromises);
      }).catch(function () {
        doneTasks++;
        updateWalletProgressBar(doneTasks, totalTasks);
      });
    });

    return Promise.all(chainPromises);
  }).then(function () {
    isWalletScanning = false;
    renderWalletResults(addr);
  }).catch(function (e) {
    isWalletScanning = false;
    el.innerHTML = "<div style=\"color:var(--red);font-size:13px;padding:12px;text-align:center\">❌ 스캔 실패: " + escapeHtml(e.message) + "</div>";
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "🔍 다시 스캔";
    }
  });
}

function updateWalletProgressBar(done, total) {
  var pct = Math.round(done / total * 100);
  var bar = document.getElementById("wl-bar");
  var st = document.getElementById("wl-status");
  if (bar) bar.style.width = pct + "%";
  if (st) st.textContent = "스캔 중... " + done + "/" + total + " (" + pct + "%)";
}

function renderWalletResults(addr) {
  var el = document.getElementById("wl-result");
  var btn = document.getElementById("wl-scan-btn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = "🔍 다시 스캔";
  }

  if (!walletScanResults.length) {
    el.innerHTML = "<div style=\"text-align:center;padding:20px;color:var(--t4);font-size:13px\">😅 잔고가 발견되지 않았습니다</div>";
    return;
  }

  walletScanResults.sort(function (a, b) { return b.valueKrw - a.valueKrw; });

  var totalKrw = 0;
  walletScanResults.forEach(function (r) {
    if (r.checked) totalKrw += r.valueKrw;
  });

  var h = "<div style=\"margin:10px 0 8px;padding:10px 12px;background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.12);border-radius:10px;display:flex;justify-content:space-between;align-items:center\">";
  h += "<div><div style=\"font-size:11px;color:var(--green);font-weight:600\">✅ " + walletScanResults.length + "개 자산 발견</div>";
  h += "<div style=\"font-size:10px;color:var(--t4);margin-top:2px\">" + addr.slice(0, 8) + "..." + addr.slice(-6) + "</div></div>";
  h += "<div style=\"text-align:right\"><div style=\"font-size:14px;font-weight:700;color:var(--t1)\" id=\"wl-total\">" + formatShortCurrency(Math.round(totalKrw)) + "</div>";
  h += "<div style=\"font-size:10px;color:var(--t4)\">선택 자산 합계</div></div></div>";

  h += "<div style=\"display:flex;justify-content:flex-end;gap:8px;margin-bottom:6px\">";
  h += "<button style=\"border:none;background:none;color:#60A5FA;font-size:11px;cursor:pointer;font-family:inherit\" onclick=\"toggleAllWalletAssets(true)\">전체 선택</button>";
  h += "<button style=\"border:none;background:none;color:var(--t4);font-size:11px;cursor:pointer;font-family:inherit\" onclick=\"toggleAllWalletAssets(false)\">전체 해제</button></div>";

  walletScanResults.forEach(function (r, i) {
    var balStr = r.balance >= 1 ? r.balance.toFixed(4) : r.balance.toFixed(8);
    h += "<div class=\"wl-chain" + (r.balance > 0 ? " found" : "") + "\">";
    h += "<input type=\"checkbox\" class=\"wl-cb\" " + (r.checked ? "checked" : "") + " onchange=\"toggleWalletAsset(" + i + ",this.checked)\">";
    h += "<div class=\"wl-ic\">" + r.chainIc + "</div>";
    h += "<div class=\"wl-info\"><div class=\"wl-nm\">" + r.symbol + "<span style=\"font-size:10px;color:var(--t5);margin-left:5px\">" + r.chainName + "</span></div>";
    h += "<div class=\"wl-bal\">" + balStr + " " + r.symbol + "</div></div>";
    h += "<div style=\"text-align:right\"><div class=\"wl-val\">" + formatShortCurrency(Math.round(r.valueKrw)) + "</div>";
    h += "<div class=\"wl-st\">$" + (r.balance * r.priceUsd >= 1 ? (r.balance * r.priceUsd).toFixed(2) : (r.balance * r.priceUsd).toFixed(4)) + "</div></div>";
    h += "</div>";
  });

  h += "<div class=\"mbtn\" style=\"margin-top:12px\">";
  h += "<button class=\"btn btn-g\" onclick=\"closeModal()\">닫기</button>";
  h += "<button class=\"btn btn-p\" style=\"flex:2\" onclick=\"importWalletAssets()\">📥 선택 자산 가져오기</button>";
  h += "</div>";

  el.innerHTML = h;
  var ob = document.getElementById("wl-outer-btns");
  if (ob) ob.style.display = "none";
}

function toggleWalletAsset(i, checked) {
  walletScanResults[i].checked = checked;
  var totalKrw = 0;
  walletScanResults.forEach(function (r) {
    if (r.checked) totalKrw += r.valueKrw;
  });
  var te = document.getElementById("wl-total");
  if (te) te.textContent = formatShortCurrency(Math.round(totalKrw));
}

function toggleAllWalletAssets(val) {
  walletScanResults.forEach(function (r) { r.checked = val; });
  document.querySelectorAll(".wl-cb").forEach(function (cb) { cb.checked = val; });
  var totalKrw = 0;
  walletScanResults.forEach(function (r) {
    if (r.checked) totalKrw += r.valueKrw;
  });
  var te = document.getElementById("wl-total");
  if (te) te.textContent = formatShortCurrency(Math.round(totalKrw));
}

function importWalletAssets() {
  var selected = walletScanResults.filter(function (r) { return r.checked; });
  if (!selected.length) {
    showToast("⚠️ 가져올 자산을 선택하세요");
    return;
  }

  var merged = {};
  selected.forEach(function (r) {
    var key = r.coingeckoId;
    if (!merged[key]) {
      merged[key] = {
        symbol: r.symbol, name: r.symbol, coingeckoId: r.coingeckoId,
        totalBalance: 0, priceKrw: r.priceKrw, chains: []
      };
    }
    merged[key].totalBalance += r.balance;
    merged[key].chains.push(r.chainName);
  });

  var added = 0, updated = 0;
  for (var k in merged) {
    var m = merged[k];
    var existing = null;
    appState.assets.forEach(function (a) {
      if (a.walletCoinId === k) existing = a;
    });

    if (existing) {
      var oldBal = 0;
      (existing.txns || []).forEach(function (t) {
        if (t.type === "buy") oldBal += t.qty;
        else oldBal -= t.qty;
      });
      var diff = m.totalBalance - oldBal;
      if (Math.abs(diff) > 0.0001) {
        if (!existing.txns) existing.txns = [];
        existing.txns.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          type: diff > 0 ? "buy" : "sell",
          price: Math.round(m.priceKrw),
          qty: Math.abs(diff),
          account: "지갑 연동",
          date: getTodayString(),
          memo: "지갑 동기화 (" + m.chains.join("+") + ")"
        });
        existing.amount = Math.round(m.priceKrw);
        updated++;
      }
    } else {
      var coinName = COIN_KOREAN_NAMES[m.coingeckoId] || m.symbol;
      var item = {
        name: coinName, category: "코인",
        amount: Math.round(m.priceKrw),
        id: Date.now() + Math.floor(Math.random() * 1000),
        lpu: null, coinId: m.coingeckoId, stockCode: null,
        market: null, krxEtf: false, isUsdt: false, walletCoinId: k,
        txns: [{
          id: Date.now() + 1, type: "buy",
          price: Math.round(m.priceKrw), qty: m.totalBalance,
          account: "지갑 연동", date: getTodayString(),
          memo: "지갑 스캔 (" + m.chains.join("+") + ")"
        }]
      };
      appState.assets.push(item);
      added++;
    }
  }

  appState.history = makeSnapshot(appState.assets, appState.history);
  saveData();
  closeModal();
  render();
  showToast("✅ " + added + "개 추가, " + updated + "개 업데이트 완료!");
}
