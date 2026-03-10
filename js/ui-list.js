/**
 * ui-list.js
 * Asset list tab rendering, category/asset reordering, and edit mode.
 * Extracted from index.html lines 104, 138-229, 462-465 with variable/function renames.
 */

/* === List Category Toggle === */

function toggleListCategory(cat) {
  listCategoryOpen[cat] = listCategoryOpen[cat] === false
    ? true
    : listCategoryOpen[cat] === true
      ? false
      : false;
  render();
}

/* === Edit Mode === */

function toggleEditMode() {
  isEditMode = !isEditMode;
  render();
}

/* === Category / Asset Reordering === */
/* NOTE: getOrderedCategories() is defined in state.js — do NOT redefine here. */

function moveCategory(cat, dir) {
  var ord = getOrderedCategories();
  var idx = ord.indexOf(cat);
  if (idx < 0) return;
  var ni = idx + dir;
  if (ni < 0 || ni >= ord.length) return;
  var tmp = ord[idx];
  ord[idx] = ord[ni];
  ord[ni] = tmp;
  appState.categoryOrder = ord;
  saveData();
  render();
}

function moveAsset(id, dir) {
  var a = null, idx = -1;
  appState.assets.forEach(function (x, i) {
    if (x.id === id) { a = x; idx = i; }
  });
  if (!a || idx < 0) return;
  var cat = a.category;
  var sameIdx = [];
  appState.assets.forEach(function (x, i) {
    if (x.category === cat) sameIdx.push(i);
  });
  var posInCat = sameIdx.indexOf(idx);
  var newPos = posInCat + dir;
  if (newPos < 0 || newPos >= sameIdx.length) return;
  var gi = sameIdx[posInCat], gj = sameIdx[newPos];
  var tmp = appState.assets[gi];
  appState.assets[gi] = appState.assets[gj];
  appState.assets[gj] = tmp;
  saveData();
  render();
}

/* === Drag & Drop === */

var _dragAssetId = null;
var _dragCatName = null;
var _touchDragEl = null;
var _touchClone = null;
var _touchStartY = 0;

function _setupDragAndDrop() {
  var container = document.getElementById("assetListContent");
  if (!container || !isEditMode) return;

  // Asset drag & drop
  var rows = container.querySelectorAll(".ar[draggable]");
  rows.forEach(function(row) {
    row.addEventListener("dragstart", function(e) {
      _dragAssetId = Number(row.dataset.aid);
      _dragCatName = null;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "asset:" + _dragAssetId);
    });
    row.addEventListener("dragend", function() {
      row.classList.remove("dragging");
      _clearDragOver();
      _dragAssetId = null;
    });
    row.addEventListener("dragover", function(e) {
      if (_dragAssetId === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      _clearDragOver();
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", function() {
      row.classList.remove("drag-over");
    });
    row.addEventListener("drop", function(e) {
      e.preventDefault();
      row.classList.remove("drag-over");
      var targetId = Number(row.dataset.aid);
      if (_dragAssetId && targetId && _dragAssetId !== targetId) {
        _reorderAsset(_dragAssetId, targetId);
      }
    });

    // Touch drag support
    var handle = row.querySelector(".drag-handle");
    if (handle) {
      handle.addEventListener("touchstart", function(e) {
        e.preventDefault();
        _dragAssetId = Number(row.dataset.aid);
        _dragCatName = null;
        _touchDragEl = row;
        _touchStartY = e.touches[0].clientY;
        row.classList.add("dragging");

        _touchClone = row.cloneNode(true);
        _touchClone.style.cssText = "position:fixed;left:0;right:0;z-index:999;pointer-events:none;" +
          "opacity:0.85;box-shadow:0 8px 24px rgba(0,0,0,0.3);background:var(--card);transform:scale(1.02);" +
          "top:" + row.getBoundingClientRect().top + "px;width:" + row.offsetWidth + "px;";
        document.body.appendChild(_touchClone);
      }, { passive: false });
    }
  });

  // Category drag & drop
  var cats = container.querySelectorAll(".cg[draggable]");
  cats.forEach(function(cg) {
    cg.addEventListener("dragstart", function(e) {
      _dragCatName = cg.dataset.cat;
      _dragAssetId = null;
      cg.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "cat:" + _dragCatName);
    });
    cg.addEventListener("dragend", function() {
      cg.classList.remove("dragging");
      _clearDragOver();
      _dragCatName = null;
    });
    cg.addEventListener("dragover", function(e) {
      if (_dragCatName === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      _clearDragOver();
      cg.classList.add("drag-over-cat");
    });
    cg.addEventListener("dragleave", function() {
      cg.classList.remove("drag-over-cat");
    });
    cg.addEventListener("drop", function(e) {
      e.preventDefault();
      cg.classList.remove("drag-over-cat");
      var targetCat = cg.dataset.cat;
      if (_dragCatName && targetCat && _dragCatName !== targetCat) {
        _reorderCategory(_dragCatName, targetCat);
      }
    });
  });
}

// Touch move/end (global)
document.addEventListener("touchmove", function(e) {
  if (!_touchDragEl || !_touchClone) return;
  var y = e.touches[0].clientY;
  _touchClone.style.top = y - 20 + "px";

  _clearDragOver();
  var elBelow = document.elementFromPoint(e.touches[0].clientX, y);
  if (elBelow) {
    var row = elBelow.closest(".ar[draggable]");
    if (row && row !== _touchDragEl) row.classList.add("drag-over");
  }
}, { passive: true });

document.addEventListener("touchend", function() {
  if (!_touchDragEl || !_touchClone) return;

  var overEl = document.querySelector(".ar.drag-over");
  if (overEl) {
    var targetId = Number(overEl.dataset.aid);
    if (_dragAssetId && targetId && _dragAssetId !== targetId) {
      _reorderAsset(_dragAssetId, targetId);
    }
  }

  _touchDragEl.classList.remove("dragging");
  if (_touchClone && _touchClone.parentNode) _touchClone.parentNode.removeChild(_touchClone);
  _touchDragEl = null;
  _touchClone = null;
  _dragAssetId = null;
  _clearDragOver();
}, { passive: true });

function _clearDragOver() {
  document.querySelectorAll(".drag-over,.drag-over-cat").forEach(function(el) {
    el.classList.remove("drag-over", "drag-over-cat");
  });
}

function _reorderAsset(fromId, toId) {
  var fromIdx = -1, toIdx = -1;
  appState.assets.forEach(function(a, i) {
    if (a.id === fromId) fromIdx = i;
    if (a.id === toId) toIdx = i;
  });
  if (fromIdx < 0 || toIdx < 0) return;
  // Check same category
  if (appState.assets[fromIdx].category !== appState.assets[toIdx].category) return;
  var item = appState.assets.splice(fromIdx, 1)[0];
  // Recalculate toIdx after splice
  toIdx = -1;
  appState.assets.forEach(function(a, i) { if (a.id === toId) toIdx = i; });
  if (toIdx < 0) { appState.assets.push(item); } else {
    appState.assets.splice(toIdx, 0, item);
  }
  saveData();
  render();
}

function _reorderCategory(fromCat, toCat) {
  var ord = getOrderedCategories();
  var fi = ord.indexOf(fromCat), ti = ord.indexOf(toCat);
  if (fi < 0 || ti < 0) return;
  ord.splice(fi, 1);
  ti = ord.indexOf(toCat);
  ord.splice(ti, 0, fromCat);
  appState.categoryOrder = ord;
  saveData();
  render();
}

/* === Main List Render === */

var _searchDebounceTimer = null;

function _setupSearchInput() {
  var wrap = document.getElementById("assetSearchWrap");
  if (!wrap) return;
  if (appState.assets.length >= 5) {
    if (!document.getElementById("assetSearch")) {
      wrap.innerHTML = "<input type=\"text\" id=\"assetSearch\" placeholder=\"자산명 검색...\" " +
        "style=\"width:100%;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);" +
        "background:var(--card);color:var(--t1);font-size:13px;outline:none;font-family:inherit\">";
      var inp = document.getElementById("assetSearch");
      inp.addEventListener("input", function() {
        var self = this;
        if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
        _searchDebounceTimer = setTimeout(function() {
          assetSearchQuery = self.value;
          _renderAssetListContent();
        }, 300);
      });
    }
  } else {
    wrap.innerHTML = "";
  }
}

function _renderAssetListContent() {
  var el = document.getElementById("assetListContent");
  if (!el) return;
  var ac = appState.assets.filter(canAutoUpdate).length;
  var totalL = 0, cdL = [];
  var h = "";

  /* Toolbar: auto-update + edit toggle */
    h += "<div style=\"display:flex;gap:8px;margin-bottom:12px\">";

    if (ac > 0) {
      h += "<button class=\"ai-btn\" style=\"flex:1;justify-content:center;" +
        "background:linear-gradient(135deg,rgba(16,185,129,.07),rgba(59,130,246,.07));" +
        "border:1px solid rgba(16,185,129,.1);color:var(--green);padding:12px;" +
        "border-radius:13px\" onclick=\"autoAll()\"" +
        (isAllLoading ? " disabled" : "") + ">" +
        (isAllLoading
          ? "<span class=\"spinner\"></span> " +
            (autoUpdateProgress.total > 0
              ? autoUpdateProgress.done + "/" + autoUpdateProgress.total + " 업데이트 중..."
              : "업데이트 중...")
          : "⚡ 전체 가격 최신화 (" + ac + ")") +
        "</button>";
    }

    h += "<button style=\"padding:12px 16px;border-radius:13px;border:1px solid " +
      (isEditMode ? "rgba(59,130,246,.3)" : "rgba(255,255,255,.08)") + ";background:" +
      (isEditMode ? "rgba(59,130,246,.1)" : "rgba(255,255,255,.03)") + ";color:" +
      (isEditMode ? "#60A5FA" : "var(--t3)") +
      ";font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap\" " +
      "onclick=\"toggleEditMode()\">" +
      (isEditMode ? "✓ 완료" : "↕ 순서 편집") + "</button></div>";

    /* Sort options */
    if (appState.assets.length >= 3) {
      var sorts = [
        { id: "default", label: "기본순" },
        { id: "value_desc", label: "금액 높은순" },
        { id: "value_asc", label: "금액 낮은순" },
        { id: "name", label: "이름순" }
      ];
      h += "<div style=\"display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap\">";
      sorts.forEach(function(s) {
        var sel = assetSortMode === s.id;
        h += "<button style=\"padding:5px 10px;border-radius:8px;font-size:11px;font-family:inherit;" +
          "border:1px solid " + (sel ? "rgba(59,130,246,.3)" : "rgba(255,255,255,.06)") + ";" +
          "background:" + (sel ? "rgba(59,130,246,.1)" : "rgba(255,255,255,.03)") + ";" +
          "color:" + (sel ? "#60A5FA" : "var(--t4)") + ";cursor:pointer;font-weight:" + (sel ? "600" : "400") +
          "\" onclick=\"assetSortMode=" + QUOTE + s.id + QUOTE + ";renderAssetList()\">" + s.label + "</button>";
      });
      h += "</div>";
    }

    /* Ordered categories */
    var ordCats = getOrderedCategories();
    var usedCats = ordCats.filter(function (cat) {
      return appState.assets.filter(function (a) { return a.category === cat; }).length > 0;
    });

    /* Category summary for pie */
    cdL = CATEGORY_LIST.map(function (c) {
      var v = 0;
      appState.assets.filter(function (a) { return a.category === c; })
        .forEach(function (a) { v += getAssetValue(a); });
      return { n: c, v: v, c: CATEGORY_CONFIG[c].color, ic: CATEGORY_CONFIG[c].icon };
    }).filter(function (d) {
      return d.v > 0;
    }).sort(function (a, b) {
      return b.v - a.v;
    });
    cdL.forEach(function (d) { totalL += d.v; });

    /* Overall composition card */
    if (cdL.length > 0 && totalL > 0) {
      h += "<div class=\"card\" style=\"margin-bottom:12px\">" +
        "<div style=\"font-size:13px;font-weight:700;color:var(--t1);margin-bottom:12px\">" +
          "전체 자산 구성</div>" +
        "<div style=\"display:flex;flex-wrap:wrap;gap:14px;align-items:center\">" +
          "<div style=\"flex:0 0 150px;display:flex;justify-content:center\">" +
            "<canvas id=\"cPieList\" width=\"150\" height=\"150\"></canvas></div>" +
          "<div style=\"flex:1;min-width:140px\">";

      cdL.forEach(function (d, i) {
        h += "<div style=\"display:flex;align-items:center;gap:8px;padding:5px 0;" +
          (i < cdL.length - 1 ? "border-bottom:1px solid rgba(255,255,255,.03);" : "") + "\">" +
          "<div style=\"width:8px;height:8px;border-radius:3px;background:" + d.c + "\"></div>" +
          "<div style=\"flex:1;font-size:12px;color:var(--t2);font-weight:500\">" +
            d.ic + " " + d.n + "</div>" +
          "<div style=\"text-align:right\">" +
            "<div style=\"font-size:12.5px;font-weight:700;color:var(--t1)\">" +
              formatShortCurrency(d.v) + "</div>" +
            "<div style=\"font-size:11px;color:var(--t4)\">" +
              ((d.v / totalL) * 100).toFixed(1) + "%</div></div></div>";
      });

      h += "</div></div></div>";
    }

    /* Per-category asset groups */
    var sq = assetSearchQuery.trim().toLowerCase();
    usedCats.forEach(function (cat, catIdx) {
      var ca = appState.assets.filter(function (a) { return a.category === cat; });
      if (sq) {
        ca = ca.filter(function (a) { return a.name.toLowerCase().indexOf(sq) >= 0; });
      }
      if (!ca.length) return;

      if (assetSortMode !== "default") {
        ca = ca.slice().sort(function (a, b) {
          if (assetSortMode === "name") return a.name.localeCompare(b.name);
          var va = calcAsset(a).evalAmt, vb = calcAsset(b).evalAmt;
          if (assetSortMode === "value_desc") return vb - va;
          if (assetSortMode === "value_asc") return va - vb;
          return 0;
        });
      }
      var ct = 0;
      ca.forEach(function (a) { ct += getAssetValue(a); });

      if (isEditMode) {
        /* --- Edit-mode category header (draggable) --- */
        h += "<div class=\"cg\" draggable=\"true\" data-cat=\"" + cat + "\"><div class=\"cg-h\" style=\"background:linear-gradient(90deg," +
          CATEGORY_CONFIG[cat].color + "06,transparent)\">";
        h += "<div style=\"display:flex;align-items:center;gap:8px\">";
        h += "<span class=\"drag-handle\">☰</span>";
        h += "<span style=\"font-size:16px\">" + CATEGORY_CONFIG[cat].icon + "</span>" +
          "<span style=\"font-size:13px;font-weight:700;color:var(--t1)\">" + cat + "</span>" +
          "<span style=\"font-size:11px;padding:2px 6px;border-radius:5px;font-weight:600;color:" +
            CATEGORY_CONFIG[cat].color + ";background:" + CATEGORY_CONFIG[cat].color + "12\">" +
            ca.length + "개</span>";
        h += "</div>" +
          "<span style=\"font-size:11px;color:var(--t5);background:rgba(255,255,255,.03);" +
            "padding:3px 8px;border-radius:5px\">" + (catIdx + 1) + "/" + usedCats.length + "</span></div>";

      } else {
        /* --- Normal category header --- */
        var isCatOpen = listCategoryOpen[cat] !== false;
        h += "<div class=\"cg\"><div class=\"cg-h\" style=\"background:linear-gradient(90deg," +
          CATEGORY_CONFIG[cat].color + "06,transparent);cursor:pointer\" " +
          "onclick=\"toggleListCategory(" + QUOTE + cat + QUOTE + ")\">" +
          "<div style=\"display:flex;align-items:center;gap:6px\">" +
            "<span style=\"font-size:11px;color:var(--t4);transition:transform .2s;" +
              "display:inline-block;transform:rotate(" + (isCatOpen ? "90" : "0") + "deg)\">▶</span>" +
            "<span style=\"font-size:16px\">" + CATEGORY_CONFIG[cat].icon + "</span>" +
            "<span style=\"font-size:13px;font-weight:700;color:var(--t1)\">" + cat + "</span>" +
            "<span style=\"font-size:11px;padding:2px 6px;border-radius:5px;font-weight:600;color:" +
              CATEGORY_CONFIG[cat].color + ";background:" + CATEGORY_CONFIG[cat].color + "12\">" +
              ca.length + "개</span>" +
          "</div>" +
          "<span style=\"font-size:13px;font-weight:700;color:var(--t1)\">" +
            formatShortCurrency(ct) + "</span></div>";

        if (!isCatOpen) { h += "</div>"; return; }

        /* Coin PL toggle */
        if (cat === "코인") {
          h += "<div style=\"padding:6px 16px 2px;display:flex;justify-content:flex-end\">" +
            "<button style=\"border:none;background:rgba(255,255,255,.04);color:" +
              (appState.coinShowProfitLoss ? "var(--t3)" : "var(--t4)") +
              ";padding:4px 10px;border-radius:6px;font-size:11.5px;cursor:pointer;" +
              "font-family:inherit;display:flex;align-items:center;gap:4px\" " +
              "onclick=\"event.stopPropagation();appState.coinShowProfitLoss=!appState.coinShowProfitLoss;" +
                "saveData();render()\">" +
              (appState.coinShowProfitLoss ? "👁 손익 표시 중" : "👁‍🗨 손익 숨김") +
            "</button></div>";
        }
      }

      /* --- Individual assets --- */
      ca.forEach(function (a, ai) {
        var c = calcAsset(a),
            has = hasTransactions(a),
            canA = canAutoUpdate(a),
            ld = loadingAssets[a.id],
            isE = expandedAssets[a.id];

        h += "<div class=\"ar\" " + (isEditMode ? "draggable=\"true\" data-aid=\"" + a.id + "\"" : "") +
          "><div style=\"width:100%\">";

        if (isEditMode) {
          /* Edit-mode asset row (draggable) */
          h += "<div style=\"display:flex;justify-content:space-between;align-items:center\">";
          h += "<div style=\"display:flex;align-items:center;gap:10px\">" +
            "<span class=\"drag-handle\">☰</span>" +
            "<div>" +
            "<span style=\"font-size:13.5px;font-weight:600;color:var(--t2)\">" +
              escapeHtml(a.name) + "</span>";
          if (has && c.qty > 0) {
            h += "<div style=\"font-size:11px;color:var(--t4);margin-top:1px\">" +
              formatCurrency(c.evalAmt) + "</div>";
          }
          h += "</div></div>";
          h += "<span style=\"font-size:11px;color:var(--t5);background:rgba(255,255,255,.03);" +
            "padding:3px 8px;border-radius:5px\">" + (ai + 1) + "/" + ca.length + "</span></div>";

        } else {
          /* Normal asset row */
          var isCL = isCashLike(a.category);
          var hidePL = a.category === "코인" && !appState.coinShowProfitLoss;

          h += "<div style=\"display:flex;justify-content:space-between;align-items:center\">" +
            "<div style=\"flex:1;min-width:0\">";

          h += "<div style=\"display:flex;align-items:center;flex-wrap:wrap;gap:3px\">" +
            "<span style=\"font-size:13.5px;font-weight:600;color:var(--t2)\">" +
              escapeHtml(a.name) + "</span>" +
            (canA
              ? "<span class=\"tag\" style=\"color:var(--green);background:rgba(16,185,129,.08)\">자동</span>"
              : "") +
            (a.krxEtf
              ? "<span class=\"tag\" style=\"color:#8B5CF6;background:rgba(139,92,246,.08)\">🇰🇷 KRX</span>"
              : "") +
            (a.isUsdt
              ? "<span class=\"tag\" style=\"color:#10B981;background:rgba(16,185,129,.08)\">💲 USDT</span>"
              : "") +
            "</div>";

          if (!has) {
            h += "<div style=\"margin-top:4px;padding:8px 12px;background:rgba(59,130,246,.04);" +
              "border:1px solid rgba(59,130,246,.08);border-radius:8px\">" +
              "<div style=\"font-size:11.5px;color:#60A5FA;font-weight:600\">" +
                (isCashLike(a.category)
                  ? "💰 잔액을 입력해주세요"
                  : "📋 첫 " + getTransactionLabel(a.category, "buy") + " 기록을 추가해주세요") +
              "</div>" +
              "<div style=\"font-size:11.5px;color:var(--t5);margin-top:2px\">" +
                (isCashLike(a.category)
                  ? "현재 잔액을 입력하면 총 자산에 반영됩니다"
                  : "거래 기록이 있어야 평가금액과 수익률을 계산합니다") +
              "</div></div>";
          }

          if (ld) {
            h += "<div style=\"margin-top:4px\">" +
              "<div class=\"skeleton sk-bar\" style=\"width:70%\"></div>" +
              "<div style=\"font-size:11px;color:var(--amber);margin-top:4px;" +
              "display:flex;align-items:center;gap:4px\">" +
              "<span class=\"spinner sm\"></span> 가격 검색 중...</div></div>";
          }

          h += "</div>";

          if (has && c.qty > 0) {
            h += "<div style=\"text-align:right;flex-shrink:0;margin-left:8px\">" +
              "<div style=\"font-size:14px;font-weight:700;color:var(--t1)\">" +
                formatCurrency(c.evalAmt) + "</div>";
            if (!isCL && !hidePL) {
              h += "<div style=\"font-size:11.5px;font-weight:600;color:" +
                (c.profit >= 0 ? "var(--red)" : "var(--blue)") + "\">" +
                (c.profit >= 0 ? "+" : "") + formatCurrency(c.profit) +
                " (" + (c.profit >= 0 ? "+" : "") + c.profitPct + "%)</div>";
            }
            h += "</div>";
          } else {
            h += "<div style=\"display:flex;gap:4px;align-items:center;flex-shrink:0;margin-left:8px\">" +
              "<button class=\"" + (isCL ? "btn-dep" : "btn-buy") + "\" onclick=\"" +
                (isCL
                  ? "openBalanceUpdate(" + a.id + ")"
                  : "openTransaction(" + a.id + "," + QUOTE + "buy" + QUOTE + ")") +
              "\">" + (isCL ? "💰 잔액 입력" : getTransactionLabel(a.category, "buy")) + "</button>" +
              "<button class=\"ibtn\" style=\"background:rgba(255,255,255,.04);color:var(--t3)\" " +
                "onclick=\"openEditAsset(" + a.id + ")\">✏️</button>" +
              "<button class=\"ibtn\" style=\"background:rgba(239,68,68,.05);color:var(--red)\" " +
                "onclick=\"openDeleteAsset(" + a.id + ")\">🗑</button></div>";
          }

          h += "</div>";

          /* Expandable detail section */
          if (has && c.qty > 0) {
            h += "<button class=\"dtgl\" onclick=\"toggleAssetDetail(" + a.id + ")\">" +
              (isE ? "▲ 접기" : "▼ 상세 정보") + "</button>";

            if (isE) {
              h += "<div class=\"dsec\">";

              /* Action buttons */
              h += "<div style=\"display:flex;gap:6px;margin-bottom:12px\">";
              if (isCL) {
                h += "<button class=\"btn-dep\" style=\"flex:1;text-align:center;padding:9px\" " +
                  "onclick=\"openBalanceUpdate(" + a.id + ")\">💰 잔액 업데이트</button>";
              } else {
                h += "<button class=\"btn-buy\" style=\"flex:1;text-align:center;padding:9px\" " +
                  "onclick=\"openTransaction(" + a.id + "," + QUOTE + "buy" + QUOTE + ")\">" +
                  "+ " + getTransactionLabel(a.category, "buy") + "</button>" +
                  "<button class=\"btn-sell\" style=\"flex:1;text-align:center;padding:9px\" " +
                  "onclick=\"openTransaction(" + a.id + "," + QUOTE + "sell" + QUOTE + ")\">" +
                  "+ " + getTransactionLabel(a.category, "sell") + "</button>";
              }
              h += "<button class=\"ibtn\" style=\"background:rgba(255,255,255,.04);color:var(--t3)\" " +
                "onclick=\"openEditAsset(" + a.id + ")\">✏️</button>" +
                "<button class=\"ibtn\" style=\"background:rgba(239,68,68,.05);color:var(--red)\" " +
                "onclick=\"openDeleteAsset(" + a.id + ")\">🗑</button></div>";

              if (isCL) {
                /* Cash-like detail grid */
                h += "<div class=\"dgrid\">";
                h += "<div class=\"ditem\"><div class=\"dl\">잔액</div>" +
                  "<div class=\"dv\">" + formatCurrency(c.evalAmt) + "</div></div>";
                h += "<div class=\"ditem\"><div class=\"dl\">입출금 내역</div>" +
                  "<div class=\"dv\">" + (c.inCnt || 0) + "건 " +
                    getTransactionLabel(a.category, "buy") + " / " +
                    (c.outCnt || 0) + "건 " +
                    getTransactionLabel(a.category, "sell") + "</div></div>";
                h += "</div>";

                /* USDT 거래소별 세부 잔고 */
                if (a.isUsdt && a.usdtDetails && a.usdtDetails.length > 0) {
                  h += "<div style=\"margin-top:12px;font-size:11.5px;color:var(--t3);" +
                    "font-weight:600;margin-bottom:6px\">💲 거래소/지갑별 USDT</div>";
                  var udTotal = 0;
                  a.usdtDetails.forEach(function(d) {
                    udTotal += d.qty;
                    h += "<div class=\"acr\"><div>" +
                      "<span style=\"font-weight:600;color:var(--t2)\">" +
                        escapeHtml(d.name) + "</span></div>" +
                      "<div style=\"font-weight:600;color:var(--t1)\">" +
                        (d.qty > 0 ? d.qty.toLocaleString(undefined, {maximumFractionDigits:2}) : "0") +
                        " <span style=\"color:var(--t4);font-weight:400;font-size:11px\">USDT</span>" +
                      "</div></div>";
                  });
                  h += "<div style=\"display:flex;justify-content:space-between;padding:6px 0;" +
                    "border-top:1px solid rgba(255,255,255,.06);margin-top:4px\">" +
                    "<span style=\"font-size:11.5px;color:var(--t3);font-weight:600\">합계</span>" +
                    "<span style=\"font-size:12px;font-weight:700;color:var(--green)\">" +
                      udTotal.toLocaleString(undefined, {maximumFractionDigits:2}) + " USDT</span></div>";
                }
              } else {
                /* Investment detail grid */
                h += "<div class=\"dgrid\">";
                h += "<div class=\"ditem\"><div class=\"dl\">현재가</div>" +
                  "<div class=\"dv\">" + formatNumber(a.amount) + "</div></div>";
                h += "<div class=\"ditem\"><div class=\"dl\">보유수량</div>" +
                  "<div class=\"dv\">" + c.qty.toLocaleString() +
                    getTransactionUnit(a.category) + "</div></div>";
                if (!hidePL) {
                  h += "<div class=\"ditem\"><div class=\"dl\">평균매수단가</div>" +
                    "<div class=\"dv\">" + formatNumber(c.avgPrice) + "</div></div>";
                  h += "<div class=\"ditem\"><div class=\"dl\">총 투자금액</div>" +
                    "<div class=\"dv\">" + formatCurrency(c.totalCost) + "</div></div>";
                }
                h += "<div class=\"ditem\"><div class=\"dl\">평가금액</div>" +
                  "<div class=\"dv\">" + formatCurrency(c.evalAmt) + "</div></div>";
                if (!hidePL) {
                  h += "<div class=\"ditem\"><div class=\"dl\">수익/손실</div>" +
                    "<div class=\"dv\" style=\"color:" +
                      (c.profit >= 0 ? "var(--red)" : "var(--blue)") + "\">" +
                      (c.profit >= 0 ? "+" : "") + formatCurrency(c.profit) +
                      " (" + (c.profit >= 0 ? "+" : "") + c.profitPct + "%)</div></div>";
                }
                h += "</div>";
              }

              /* Per-account breakdown */
              if (!isCL && !hidePL && c.accounts.length > 1) {
                h += "<div style=\"margin-top:12px;font-size:11.5px;color:var(--t3);" +
                  "font-weight:600;margin-bottom:6px\">📊 계좌별 현황</div>";
                c.accounts.forEach(function (ac) {
                  h += "<div class=\"acr\"><div>" +
                    "<span style=\"font-weight:600;color:var(--t2)\">" +
                      escapeHtml(ac.name) + "</span> " +
                    "<span style=\"color:var(--t4)\">" + ac.qty +
                      getTransactionUnit(a.category) + " · 평단 " +
                      formatNumber(ac.avgP) + "</span></div>" +
                    "<div style=\"font-weight:600;color:" +
                      (ac.profit >= 0 ? "var(--red)" : "var(--blue)") + "\">" +
                      (ac.profit >= 0 ? "+" : "") + formatCurrency(ac.profit) +
                    "</div></div>";
                });
              }

              /* Note */
              if (a.note) {
                h += "<div style=\"margin-top:10px;padding:8px 12px;" +
                  "background:rgba(245,158,11,.04);border:1px solid rgba(245,158,11,.08);" +
                  "border-radius:8px;font-size:11.5px;color:var(--t3);line-height:1.5\">" +
                  "📝 " + escapeHtml(a.note) + "</div>";
              }

              /* Last price update */
              if (a.lpu) {
                h += "<div style=\"font-size:11px;color:var(--t5);margin-top:8px\">" +
                  "⚡ " + a.lpu + "</div>";
              }

              /* Recent transactions */
              h += "<div style=\"margin-top:12px\">" +
                "<div style=\"display:flex;justify-content:space-between;align-items:center;" +
                  "margin-bottom:6px\">" +
                  "<span style=\"font-size:11.5px;color:var(--t3);font-weight:600\">" +
                    "📋 최근 거래</span>" +
                  "<button style=\"background:none;border:none;color:#60A5FA;font-size:11px;" +
                    "cursor:pointer;font-family:inherit\" " +
                    "onclick=\"openTransactionList(" + a.id + ")\">전체 보기 →</button></div>";

              (a.txns || []).slice().reverse().slice(0, 3).forEach(function (t) {
                var _txCls = t.type === "buy" ? (isCL ? "txd" : "txb") : "txs";
                h += "<div class=\"txr\">" +
                  "<span class=\"txt " + _txCls + "\">" +
                    getTransactionLabel(a.category, t.type) + "</span>" +
                  "<span style=\"color:var(--t2)\">" + formatNumber(t.price) + "</span>" +
                  (isCL ? "" : "<span style=\"color:var(--t4)\">×" + t.qty + "</span>") +
                  (t.account
                    ? "<span class=\"txa\">" + escapeHtml(t.account) + "</span>"
                    : "") +
                  "<span style=\"color:var(--t5);margin-left:auto;font-size:11px\">" +
                    (t.date || "") + "</span></div>";
              });

              h += "</div></div>";
            }
          }
        }

        h += "</div></div>";
      });

      h += "</div>";
    });

    /* Add asset button */
    h += "<div style=\"margin-top:14px\">" +
      "<button class=\"btn btn-p btn-w\" onclick=\"openAddAsset()\">+ 새 자산 추가</button></div>";

  el.innerHTML = h;

  /* Setup drag & drop in edit mode */
  if (isEditMode) {
    setTimeout(_setupDragAndDrop, 30);
  }

  /* Draw / update list pie chart */
  if (cdL && cdL.length > 0 && totalL > 0) {
    setTimeout(function () {
      var ctx = document.getElementById("cPieList");
      if (!ctx) return;

      if (charts.listPie && charts.listPie.canvas === ctx) {
        try {
          charts.listPie.data.labels = cdL.map(function (d) { return d.ic + " " + d.n; });
          charts.listPie.data.datasets[0].data = cdL.map(function (d) { return d.v; });
          charts.listPie.data.datasets[0].backgroundColor = cdL.map(function (d) { return d.c; });
          charts.listPie.update("none");
          return;
        } catch (e) {}
      }

      if (charts.listPie) charts.listPie.destroy();

      charts.listPie = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: cdL.map(function (d) { return d.ic + " " + d.n; }),
          datasets: [{
            data: cdL.map(function (d) { return d.v; }),
            backgroundColor: cdL.map(function (d) { return d.c; }),
            borderWidth: 0,
            spacing: 2
          }]
        },
        options: {
          cutout: "60%",
          responsive: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#1A1D23",
              borderColor: "rgba(255,255,255,.1)",
              borderWidth: 1,
              titleFont: { family: "Pretendard Variable", size: 11 },
              bodyFont: { family: "Pretendard Variable", size: 11 },
              callbacks: {
                label: function (c) {
                  return c.label + ": " + formatShortCurrency(c.raw) +
                    " (" + ((c.raw / totalL) * 100).toFixed(1) + "%)";
                }
              }
            }
          }
        },
        plugins: [{
          id: "ct3",
          afterDraw: function (ch) {
            var c = ch.ctx, w = ch.width, hh = ch.height;
            c.save();
            c.textAlign = "center";
            c.fillStyle = "#94A3B8";
            c.font = "9px Pretendard Variable";
            c.fillText("총 자산", w / 2, hh / 2 - 4);
            c.fillStyle = "#F1F5F9";
            c.font = "bold 12px Pretendard Variable";
            c.fillText(formatShortCurrency(totalL), w / 2, hh / 2 + 10);
            c.restore();
          }
        }]
      });
    }, 30);
  }
}

function renderAssetList() {
  var el = document.getElementById("pgList");

  /* Empty state with onboarding */
  if (!appState.assets.length) {
    el.innerHTML = "<div style=\"animation:fadeUp .4s ease\">" +
      "<div class=\"card\" style=\"text-align:center;padding:40px 20px\">" +
      "<div style=\"font-size:44px;margin-bottom:12px\">💼</div>" +
      "<div style=\"font-size:15px;font-weight:600;color:var(--t2);margin-bottom:5px\">" +
        "등록된 자산이 없습니다</div>" +
      "<div style=\"font-size:12px;color:var(--t4);margin-bottom:16px\">자산을 추가하면 목록이 여기에 표시됩니다</div>" +
      "<div class=\"onboard-wrap\" style=\"text-align:left;margin-top:0\">" +
        "<div class=\"onboard-step\">" +
          "<div class=\"onboard-num\">1</div>" +
          "<div><div style=\"font-size:13px;font-weight:600;color:var(--t2)\">아래 버튼으로 자산 추가</div>" +
          "<div style=\"font-size:11.5px;color:var(--t4);margin-top:2px\">주식, 코인, 현금 등 분류별로 등록하세요</div></div></div>" +
        "<div class=\"onboard-step\">" +
          "<div class=\"onboard-num\">2</div>" +
          "<div><div style=\"font-size:13px;font-weight:600;color:var(--t2)\">거래 기록 입력</div>" +
          "<div style=\"font-size:11.5px;color:var(--t4);margin-top:2px\">매수 가격과 수량을 기록하면 수익률이 자동 계산됩니다</div></div></div>" +
      "</div>" +
      "<button class=\"btn btn-p\" onclick=\"openAddAsset()\" style=\"margin-top:14px;width:100%\">" +
        "+ 자산 추가</button></div></div>";
    return;
  }

  /* Ensure structure: search wrapper + content container */
  if (!document.getElementById("assetListContent")) {
    el.innerHTML = "<div style=\"animation:fadeUp .4s ease\">" +
      "<div id=\"assetSearchWrap\" style=\"margin-bottom:10px\"></div>" +
      "<div id=\"assetListContent\"></div></div>";
  }

  _setupSearchInput();
  _renderAssetListContent();
}
