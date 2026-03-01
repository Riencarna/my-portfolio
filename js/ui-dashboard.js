/**
 * ui-dashboard.js
 * Dashboard tab rendering and inline editing functionality.
 * Extracted from index.html lines 99-103, 108-136 with variable/function renames.
 */

/* === Toggle & Inline Editing Helpers === */

function toggleAssetDetail(id) {
  expandedAssets[id] = !expandedAssets[id];
  render();
}

function toggleDashboardCategory(cat) {
  dashboardCategoryOpen[cat] = !dashboardCategoryOpen[cat];
  renderDashboard();
}

function startInlineEdit(cat, curVal) {
  var el = document.getElementById("diq_" + cat);
  if (!el) return;
  el.innerHTML =
    "<div style=\"display:flex;align-items:center;gap:4px\">" +
      "<input type=\"number\" id=\"dii_" + cat + "\" value=\"\" " +
        "placeholder=\"" + Math.round(curVal) + "\" " +
        "style=\"width:110px;padding:5px 8px;border-radius:7px;" +
          "border:1px solid rgba(59,130,246,.3);background:var(--card2);" +
          "color:var(--t1);font-size:13px;font-weight:700;outline:none;" +
          "font-family:inherit;text-align:right\" " +
        "onkeydown=\"if(event.key==='Enter')saveInlineEdit(" + QUOTE + cat + QUOTE + "," + curVal + ");" +
          "if(event.key==='Escape'){renderDashboard()}\" " +
        "oninput=\"previewInlineChange(" + QUOTE + cat + QUOTE + ",this.value," + curVal + ")\">" +
      "<button style=\"border:none;background:rgba(16,185,129,.1);color:var(--green);" +
        "width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:13px;" +
        "display:flex;align-items:center;justify-content:center\" " +
        "onclick=\"saveInlineEdit(" + QUOTE + cat + QUOTE + "," + curVal + ")\">✓</button>" +
    "</div>" +
    "<div id=\"dip_" + cat + "\" style=\"font-size:10.5px;margin-top:3px;min-height:16px\"></div>";
  el.onclick = null;
  setTimeout(function () {
    var inp = document.getElementById("dii_" + cat);
    if (inp) inp.focus();
  }, 30);
}

function previewInlineChange(cat, val, cur) {
  var el = document.getElementById("dip_" + cat);
  if (!el) return;
  var n = Number(val);
  if (!n) { el.textContent = ""; return; }
  var diff = n - cur;
  if (diff === 0) {
    el.innerHTML = "<span style=\"color:var(--t4)\">변동 없음</span>";
  } else if (diff > 0) {
    el.innerHTML = "<span style=\"color:var(--red)\">▲ +" + formatShortCurrency(diff) + "</span>";
  } else {
    el.innerHTML = "<span style=\"color:#60A5FA\">▼ " + formatShortCurrency(diff) + "</span>";
  }
}

function saveInlineEdit(cat, curVal) {
  var inp = document.getElementById("dii_" + cat);
  if (!inp) return;
  var newVal = Number(inp.value);
  if (!isFinite(newVal) || newVal < 0) {
    showToast("❌ 올바른 금액을 입력하세요");
    return;
  }
  var diff = Math.round(newVal) - Math.round(curVal);
  if (diff === 0) { renderDashboard(); return; }

  var targets = appState.assets.filter(function (a) { return a.category === cat; });
  if (!targets.length) {
    showToast("❌ " + cat + " 자산이 없습니다");
    return;
  }
  var a = targets[0];
  if (!a.txns) a.txns = [];
  if (a.txns.length >= 5000) {
    showToast("⚠️ 거래 내역이 너무 많습니다");
    return;
  }

  captureUndo();
  var type = diff > 0 ? "buy" : "sell";
  a.txns.push({
    id: generateId(),
    type: type,
    price: Math.abs(diff),
    qty: 1,
    account: null,
    date: getTodayString(),
    memo: "대시보드 빠른 업데이트 (" +
      formatCurrency(Math.round(curVal)) + " → " +
      formatCurrency(Math.round(newVal)) + ")"
  });
  appState.history = makeSnapshot(appState.assets, appState.history);
  saveData();
  showToast(
    "✅ " + CATEGORY_CONFIG[cat].icon + " " + cat + " → " +
    formatCurrency(Math.round(newVal)),
    true
  );
  renderDashboard();
}

/* === Main Dashboard Render === */

function renderDashboard() {
  var el = document.getElementById("pgDash"),
      total = 0,
      inv = 0,
      pf = 0;

  /* Destroy old category pie charts */
  for (var ck in charts.catPies) {
    try { if (charts.catPies[ck]) charts.catPies[ck].destroy(); } catch (e) {}
  }
  charts.catPies = {};

  /* Compute totals */
  appState.assets.forEach(function (a) {
    if (!hasTransactions(a)) return;
    var c = calcAsset(a);
    total += c.evalAmt;
    inv += c.totalCost;
    pf += c.profit;
  });

  /* Category data */
  var cd = CATEGORY_LIST.map(function (c) {
    var v = 0;
    appState.assets.filter(function (a) { return a.category === c; })
      .forEach(function (a) { v += getAssetValue(a); });
    return { n: c, v: v, c: CATEGORY_CONFIG[c].color, ic: CATEGORY_CONFIG[c].icon };
  }).filter(function (d) {
    return d.v > 0;
  }).sort(function (a, b) {
    return b.v - a.v;
  });

  /* Previous-day comparison */
  var prev = appState.history.length >= 2
    ? appState.history[appState.history.length - 2].total
    : null;
  var chg = prev !== null ? total - prev : null;
  var chgP = prev ? ((chg / prev) * 100).toFixed(2) : null;

  /* Chart history (last 30 days) */
  var cht = appState.history.slice(-30).map(function (h) {
    return { d: h.date.slice(5), v: h.total };
  });

  var ac = appState.assets.filter(canAutoUpdate).length;

  /* --- Build HTML --- */
  var h = "<div style=\"animation:fadeUp .4s ease\">";

  /* Sandbox warning */
  if (isSandbox && ac > 0) {
    h += "<div style=\"background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(239,68,68,.08));" +
      "border:1px solid rgba(245,158,11,.2);border-radius:14px;padding:16px;margin-bottom:14px\">" +
      "<div style=\"font-size:13px;font-weight:700;color:var(--amber)\">⚠️ 미리보기 모드</div>" +
      "<div style=\"font-size:12px;color:var(--t3);margin-top:4px;line-height:1.6\">" +
        "Claude 미리보기에서는 외부 API가 차단되어 가격 최신화가 불가합니다.<br>" +
        "<strong style=\"color:var(--t1)\">파일을 다운로드</strong>한 후 " +
        "<strong style=\"color:var(--t1)\">Chrome/Safari에서 직접 열어주세요.</strong></div>" +
      "<div style=\"font-size:11px;color:var(--t4);margin-top:6px\">" +
        "💡 다운로드 → 파일 더블클릭 → 자동 최신화 정상 작동</div></div>";
  }

  /* Backup reminder */
  if (appState.assets.length > 0) {
    var _lastBk = null;
    try { _lastBk = Number(localStorage.getItem("mp_last_backup")); } catch (e) {}
    var _daysSinceBk = _lastBk ? Math.floor((Date.now() - _lastBk) / 86400000) : null;
    if (_daysSinceBk === null || _daysSinceBk >= 7) {
      h += "<div style=\"display:flex;align-items:center;gap:10px;padding:11px 14px;" +
        "background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.12);" +
        "border-radius:12px;margin-bottom:14px\">" +
        "<span style=\"font-size:14px\">💾</span>" +
        "<div style=\"flex:1;font-size:12px;color:var(--t3)\">" +
          (_daysSinceBk === null
            ? "아직 백업한 적이 없습니다. 데이터 보호를 위해 백업하세요."
            : _daysSinceBk + "일 전 마지막 백업. 정기 백업을 권장합니다.") +
        "</div>" +
        "<button style=\"border:none;background:rgba(245,158,11,.1);color:var(--amber);" +
          "padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;" +
          "cursor:pointer;font-family:inherit;white-space:nowrap\" " +
          "onclick=\"goTab(" + QUOTE + "hist" + QUOTE + ")\">백업하기</button></div>";
    }
  }

  /* Exchange rate bar */
  var hasF = appState.assets.some(function (a) {
    return a.category === "해외주식" || a.category === "코인";
  });
  if (hasF) {
    var rr = getCurrentExchangeRate();
    var rOk = cachedExchangeRate && cachedExchangeRate.r;
    var _rCacheT = null;
    if (cachedExchangeRate && cachedExchangeRate.t) {
      _rCacheT = cachedExchangeRate.t;
    } else {
      try { var _s = JSON.parse(localStorage.getItem("mp_ex_rate")); if (_s && _s.t) _rCacheT = _s.t; } catch(e) {}
    }
    var rTime = _rCacheT
      ? new Date(_rCacheT).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : "";
    h += "<div style=\"display:flex;align-items:center;gap:8px;padding:10px 14px;" +
      "background:rgba(255,255,255,.02);border:1px solid var(--bd);border-radius:12px;margin-bottom:14px\">" +
      "<span style=\"font-size:14px\">💱</span>" +
      "<div style=\"flex:1\">" +
        "<span style=\"font-size:12.5px;color:var(--t3)\">USD/KRW</span> " +
        "<span style=\"font-size:14px;font-weight:700;color:var(--t1)\">" +
          Math.round(rr).toLocaleString() + "원</span> " +
        (rOk
          ? "<span style=\"font-size:10px;color:var(--green)\">✓ 실시간</span>"
          : "<span style=\"font-size:10px;color:var(--amber)\">⚠ " + (_rCacheT ? "캐시" : "기본값") + "</span>") +
        (rTime
          ? " <span style=\"font-size:10px;color:var(--t5)\">" + rTime + "</span>"
          : "") +
      "</div>" +
      "<button style=\"border:none;background:rgba(59,130,246,.08);color:#60A5FA;padding:5px 10px;" +
        "border-radius:7px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600\" " +
        "onclick=\"refreshExchangeRate()\">🔄 최신화</button></div>";
  }

  /* Total asset card */
  h += "<div class=\"tot\"><div class=\"glow\"></div>" +
    "<div style=\"font-size:12px;color:var(--t3);margin-bottom:5px;font-weight:500\">총 자산</div>" +
    "<div class=\"tot-n\">" + formatNumber(total) + "</div>";

  if (chg !== null) {
    h += "<div style=\"display:flex;align-items:center;gap:7px;margin-top:7px;flex-wrap:wrap\">" +
      "<span class=\"chg " + (chg >= 0 ? "chg-u" : "chg-d") + "\">" +
        (chg >= 0 ? "▲" : "▼") + " " + formatShortCurrency(Math.abs(chg)) + "</span>" +
      "<span style=\"font-size:12px;color:" + (chg >= 0 ? "var(--red)" : "#60A5FA") + "\">" +
        "(" + (chg >= 0 ? "+" : "") + chgP + "%)</span>" +
      "<span style=\"font-size:10px;color:var(--t5)\">전일 대비</span></div>";
  }

  if (inv > 0) {
    var pp = ((pf / inv) * 100).toFixed(2);
    h += "<div style=\"display:flex;gap:8px;margin-top:10px;flex-wrap:wrap\">" +
      "<div style=\"padding:8px 12px;border-radius:9px;background:rgba(255,255,255,.03);font-size:12px\">" +
        "<span style=\"color:var(--t4)\">총 투자 </span>" +
        "<span style=\"color:var(--t1);font-weight:600\">" + formatShortCurrency(inv) + "</span></div>" +
      "<div style=\"padding:8px 12px;border-radius:9px;background:" +
        (pf >= 0 ? "rgba(239,68,68,.06)" : "rgba(59,130,246,.06)") + ";font-size:12px\">" +
        "<span style=\"color:var(--t4)\">총 수익 </span>" +
        "<span style=\"color:" + (pf >= 0 ? "var(--red)" : "var(--blue)") + ";font-weight:700\">" +
          (pf >= 0 ? "+" : "") + formatShortCurrency(pf) +
          " (" + (pf >= 0 ? "+" : "") + pp + "%)</span></div></div>";
  }

  if (!appState.assets.length) {
    h += "<div style=\"margin-top:12px;padding:11px 14px;background:rgba(255,255,255,.03);" +
      "border-radius:11px;color:var(--t4);font-size:12.5px\">" +
      "자산이 없습니다. <span style=\"color:#60A5FA;cursor:pointer\" " +
      "onclick=\"openAddAsset()\">+ 추가하기</span></div>";
  }
  h += "</div>";

  /* Auto-update section */
  if (ac > 0) {
    h += "<div class=\"ai\"><div style=\"display:flex;justify-content:space-between;align-items:center;" +
      "flex-wrap:wrap;gap:9px\"><div>" +
      "<div style=\"font-size:13px;font-weight:700;color:var(--green)\">⚡ 가격 자동 최신화</div>" +
      "<div style=\"font-size:11px;color:var(--t3);margin-top:2px\">" + ac + "개 종목 현재가 자동 검색</div>" +
      "</div><button class=\"ai-btn\" onclick=\"autoAll()\"" +
      (isAllLoading ? " disabled" : "") + ">" +
      (isAllLoading
        ? "<span class=\"spinner\"></span> 업데이트 중..."
        : "⚡ 전체 최신화") +
      "</button></div>";

    if (updateLogs.length > 0) {
      var okCnt = 0, failCnt = 0;
      updateLogs.forEach(function (l) { if (l.ok) okCnt++; else failCnt++; });

      h += "<div style=\"margin-top:8px;border-top:1px solid rgba(255,255,255,.04);padding-top:7px\">" +
        "<div style=\"display:flex;justify-content:space-between;align-items:center;cursor:pointer\" " +
          "onclick=\"isLogOpen=!isLogOpen;renderDashboard()\">" +
          "<div style=\"display:flex;align-items:center;gap:8px\">" +
            "<span style=\"font-size:11px;color:var(--t3)\">결과: </span>" +
            (okCnt > 0
              ? "<span style=\"font-size:11px;color:var(--green);font-weight:600\">✅ " + okCnt + "개 성공</span>"
              : "") +
            (failCnt > 0
              ? "<span style=\"font-size:11px;color:var(--red);font-weight:600\">❌ " + failCnt + "개 실패</span>"
              : "") +
          "</div>" +
          "<span style=\"font-size:10px;color:var(--t5)\">" +
            (isLogOpen ? "▲ 접기" : "▼ 상세") + "</span></div>";

      if (failCnt > 0 && !isAllLoading) {
        h += "<button style=\"margin-top:6px;border:1px solid rgba(239,68,68,.15);" +
          "background:rgba(239,68,68,.05);color:var(--red);padding:5px 12px;border-radius:7px;" +
          "font-size:11px;cursor:pointer;font-family:inherit;font-weight:600\" " +
          "onclick=\"autoAll._retried=false;retryFailed()\">🔄 실패 " + failCnt + "개 재시도</button>";
      }

      if (isLogOpen) {
        h += "<div class=\"lgbox\" style=\"margin-top:6px\">";
        updateLogs.forEach(function (l) {
          h += "<div class=\"lgi" + (l.ok ? "" : " bad") + "\">" +
            (l.ok ? "✅" : "❌") +
            " <strong style=\"color:var(--t2)\">" + escapeHtml(l.name) + "</strong> " +
            (l.ok
              ? formatNumber(l.old) + " → <span style=\"color:var(--green);font-weight:600\">" +
                formatNumber(l.nu) + "</span>"
              : (l.msg || "실패")) +
            "</div>";
        });
        h += "</div>";
      }
      h += "</div>";
    }
    h += "</div>";
  }

  /* Category breakdown map */
  var catColors = [
    "#60A5FA", "#A78BFA", "#F472B6", "#34D399", "#FBBF24", "#FB923C",
    "#38BDF8", "#E879F9", "#818CF8", "#4ADE80", "#FB7185", "#22D3EE"
  ];

  var catBreakMap = {};
  CATEGORY_LIST.forEach(function (cat) {
    var items = [];
    appState.assets.filter(function (a) {
      return a.category === cat && hasTransactions(a);
    }).forEach(function (a) {
      var v = getAssetValue(a);
      if (v > 0) items.push({ name: a.name, v: v });
    });
    if (items.length >= 2) {
      var ct = 0;
      items.forEach(function (x) { ct += x.v; });
      items.sort(function (a, b) { return b.v - a.v; });
      catBreakMap[cat] = { items: items, total: ct };
    }
  });

  var prevCat = appState.history.length >= 2
    ? appState.history[appState.history.length - 2].byCategory
    : null;

  /* Category composition card */
  if (cd.length > 0) {
    h += "<div class=\"card\">" +
      "<div style=\"font-size:14px;font-weight:700;color:var(--t1);margin-bottom:16px\">자산 구성</div>" +
      "<div style=\"display:flex;flex-wrap:wrap;gap:16px;align-items:center\">" +
        "<div style=\"flex:0 0 180px;display:flex;justify-content:center\">" +
          "<canvas id=\"cPie\" width=\"180\" height=\"180\"></canvas></div>" +
        "<div style=\"flex:1;min-width:160px\">";

    cd.forEach(function (d, i) {
      var hasSub = !!catBreakMap[d.n];
      var isOpen = dashboardCategoryOpen[d.n];
      var catChg = prevCat && prevCat[d.n] !== undefined
        ? d.v - (prevCat[d.n] || 0)
        : null;
      var isCL = d.n === "현금" || d.n === "예적금";

      h += "<div style=\"" +
        (i < cd.length - 1 ? "border-bottom:1px solid rgba(255,255,255,.03);" : "") + "\">";

      h += "<div style=\"display:flex;align-items:center;gap:9px;padding:8px 0;" +
        (hasSub ? "cursor:pointer" : "") + "\" " +
        (hasSub
          ? "onclick=\"toggleDashboardCategory(" + QUOTE + d.n + QUOTE + ")\""
          : "") + ">" +
        "<div style=\"width:9px;height:9px;border-radius:3px;background:" + d.c + "\"></div>" +
        "<div style=\"flex:1;font-size:12.5px;color:var(--t2);font-weight:500\">" +
          d.ic + " " + d.n +
          (hasSub
            ? " <span style=\"font-size:9px;color:var(--t5)\">" + (isOpen ? "▲" : "▼") + "</span>"
            : "") +
        "</div>" +
        "<div style=\"text-align:right\">" +
          (isCL
            ? "<div id=\"diq_" + d.n + "\" style=\"cursor:pointer\" " +
              "onclick=\"event.stopPropagation();startInlineEdit(" + QUOTE + d.n + QUOTE + "," + d.v + ")\">" +
              "<div style=\"font-size:13px;font-weight:700;color:var(--t1);" +
                "display:flex;align-items:center;justify-content:flex-end;gap:4px\">" +
                formatShortCurrency(d.v) +
                " <span style=\"font-size:10px;color:var(--t5)\">✏️</span></div></div>"
            : "<div style=\"font-size:13px;font-weight:700;color:var(--t1)\">" +
              formatShortCurrency(d.v) + "</div>") +
          "<div style=\"font-size:10px;color:var(--t4)\">" +
            ((d.v / total) * 100).toFixed(1) + "%" +
            (catChg !== null && catChg !== 0
              ? " <span style=\"color:" + (catChg > 0 ? "var(--red)" : "#60A5FA") +
                ";font-weight:600\">" + (catChg > 0 ? "▲" : "▼") +
                formatShortCurrency(Math.abs(catChg)) + "</span>"
              : "") +
          "</div></div></div>";

      /* Sub-breakdown (if open) */
      if (hasSub && isOpen) {
        var cb = catBreakMap[d.n];
        h += "<div style=\"padding:0 0 10px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center\">" +
          "<div style=\"flex:0 0 110px;display:flex;justify-content:center\">" +
            "<canvas id=\"cCat_" + i + "\" width=\"110\" height=\"110\"></canvas></div>" +
          "<div style=\"flex:1;min-width:100px\">";
        cb.items.forEach(function (it, ii) {
          var clr = catColors[ii % catColors.length];
          h += "<div style=\"display:flex;align-items:center;gap:6px;padding:4px 0;" +
            (ii < cb.items.length - 1 ? "border-bottom:1px solid rgba(255,255,255,.02)" : "") + "\">" +
            "<div style=\"width:7px;height:7px;border-radius:2px;background:" + clr + "\"></div>" +
            "<div style=\"flex:1;font-size:11px;color:var(--t3);font-weight:500\">" +
              escapeHtml(it.name) + "</div>" +
            "<div style=\"text-align:right;font-size:11px\">" +
              "<span style=\"font-weight:600;color:var(--t2)\">" + formatShortCurrency(it.v) + "</span> " +
              "<span style=\"color:var(--t5)\">" + ((it.v / cb.total) * 100).toFixed(1) + "%</span>" +
            "</div></div>";
        });
        h += "</div></div>";
      }

      h += "</div>";
    });

    h += "</div></div>";

    /* Day-over-day change breakdown */
    if (prevCat && chg !== null && chg !== 0) {
      var chgItems = [];
      cd.forEach(function (d) {
        var cc = d.v - (prevCat[d.n] || 0);
        if (cc !== 0) chgItems.push({ n: d.n, ic: d.ic, c: d.c, v: cc });
      });
      CATEGORY_LIST.forEach(function (cat) {
        if (prevCat[cat] && prevCat[cat] > 0 && !cd.some(function (d) { return d.n === cat; })) {
          chgItems.push({
            n: cat,
            ic: CATEGORY_CONFIG[cat].icon,
            c: CATEGORY_CONFIG[cat].color,
            v: -prevCat[cat]
          });
        }
      });
      chgItems.sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });

      if (chgItems.length > 0) {
        h += "<div style=\"margin-top:14px;padding:12px 14px;background:rgba(255,255,255,.02);" +
          "border:1px solid var(--bd);border-radius:11px\">" +
          "<div style=\"font-size:11.5px;font-weight:600;color:var(--t3);margin-bottom:8px\">" +
            "📋 전일 대비 변동 내역</div>";
        chgItems.forEach(function (ci) {
          h += "<div style=\"display:flex;align-items:center;gap:8px;padding:4px 0\">" +
            "<div style=\"width:7px;height:7px;border-radius:2px;background:" + ci.c + "\"></div>" +
            "<span style=\"flex:1;font-size:11.5px;color:var(--t3)\">" + ci.ic + " " + ci.n + "</span>" +
            "<span style=\"font-size:11.5px;font-weight:600;color:" +
              (ci.v > 0 ? "var(--red)" : "#60A5FA") + "\">" +
              (ci.v > 0 ? "▲ +" : "▼ ") + formatShortCurrency(ci.v) + "</span></div>";
        });
        h += "</div>";
      }
    }

    h += "</div>";
  }

  /* Asset trend chart */
  if (cht.length >= 2) {
    h += "<div class=\"card\">" +
      "<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:12px\">" +
        "<div style=\"font-size:14px;font-weight:700;color:var(--t1)\">자산 추이</div>" +
        "<button style=\"background:none;border:none;color:#60A5FA;font-size:11.5px;" +
          "cursor:pointer;font-weight:500;font-family:inherit\" " +
          "onclick=\"goTab('hist')\">자세히 →</button></div>" +
      "<div style=\"position:relative;height:145px\"><canvas id=\"cL1\"></canvas></div></div>";
  }

  h += "</div>";

  /* Inject HTML and draw charts */
  el.innerHTML = h;
  if (cd.length > 0) drawPie(cd, total);
  if (cht.length >= 2) drawLine("cL1", cht, 145);

  cd.forEach(function (d, i) {
    if (dashboardCategoryOpen[d.n] && catBreakMap[d.n]) {
      setTimeout(function () {
        drawCatPie(
          "cCat_" + i,
          catBreakMap[d.n].items,
          catBreakMap[d.n].total,
          catColors
        );
      }, 40);
    }
  });
}
