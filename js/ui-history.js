/* ===================================================
   ui-history.js - 히스토리 탭 렌더링 및 데이터 관리
   (기록 저장, 초기화, 백업/복원)
   =================================================== */

/**
 * 히스토리 탭 렌더링
 * - 최근 30일 자산 변동 차트
 * - 기록 목록 (날짜별 총자산, 변동액)
 * - 데이터 관리 (초기화, 백업, 복원)
 */
function renderHistory() {
  var el = document.getElementById("pgHist");

  var sliced = historyChartDays === 0 ? appState.history : appState.history.slice(-historyChartDays);
  var cht = sliced.map(function(h) {
    return { d: h.date.slice(5), v: h.total };
  });

  var h = "<div style=\"animation:fadeUp .4s ease\">";

  // 오늘 기록 저장 버튼
  h += "<div style=\"display:flex;gap:8px;margin-bottom:14px\">";
  h += "<button class=\"btn btn-p\" style=\"flex:1;font-size:13px\" onclick=\"saveSnapshot()\">📸 오늘 기록 저장</button>";
  h += "</div>";

  if (cht.length < 2) {
    // 기록이 부족할 때 안내
    h += "<div class=\"card\" style=\"text-align:center;padding:40px 20px\">";
    h += "<div style=\"font-size:44px;margin-bottom:12px\">📈</div>";

    if (cht.length === 0) {
      h += "<div style=\"font-size:15px;font-weight:600;color:var(--t2);margin-bottom:5px\">아직 기록이 없습니다</div>";
      h += "<div style=\"font-size:12.5px;color:var(--t4)\">위 버튼을 눌러 오늘의 자산을 기록하세요</div>";
    } else {
      h += "<div style=\"font-size:15px;font-weight:600;color:var(--t2);margin-bottom:5px\">첫 기록이 저장되었습니다!</div>";
      h += "<div style=\"font-size:12.5px;color:var(--t4);margin-bottom:14px\">내일 다시 기록하면 변동 그래프가 나타납니다</div>";
      h += "<div style=\"padding:14px;border-radius:12px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.1)\">";
      h += "<div style=\"font-size:12px;color:var(--t3)\">" + appState.history[0].date + "</div>";
      h += "<div style=\"font-size:22px;font-weight:800;color:var(--t1);margin-top:4px\">" + formatCurrency(appState.history[0].total) + "</div>";
      h += "</div>";
    }

    h += "</div>";
  } else {
    // 자산 변동 추이 차트
    h += "<div class=\"card\">";
    h += "<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:16px\">";
    h += "<div style=\"font-size:14px;font-weight:700;color:var(--t1)\">자산 변동 추이</div>";
    h += "<div style=\"display:flex;gap:4px\">";
    [{ d: 7, l: "7일" }, { d: 30, l: "30일" }, { d: 90, l: "90일" }, { d: 0, l: "전체" }].forEach(function(o) {
      var sel = historyChartDays === o.d;
      h += "<button style=\"padding:4px 9px;border-radius:7px;font-size:11.5px;font-family:inherit;" +
        "border:1px solid " + (sel ? "rgba(59,130,246,.3)" : "rgba(255,255,255,.06)") + ";" +
        "background:" + (sel ? "rgba(59,130,246,.12)" : "rgba(255,255,255,.03)") + ";" +
        "color:" + (sel ? "#60A5FA" : "var(--t4)") + ";cursor:pointer;font-weight:" + (sel ? "600" : "400") +
        "\" onclick=\"historyChartDays=" + o.d + ";renderHistory()\">" + o.l + "</button>";
    });
    h += "</div></div>";
    h += "<div style=\"position:relative;height:230px\"><canvas id=\"cL2\"></canvas></div>";
    h += "</div>";

    // 기록 목록
    h += "<div class=\"card\">";
    h += "<div style=\"font-size:14px;font-weight:700;color:var(--t1);margin-bottom:12px\">기록 목록</div>";

    appState.history.slice().reverse().forEach(function(r) {
      var idx = appState.history.indexOf(r);
      var p = idx > 0 ? appState.history[idx - 1] : null;
      var d = p ? r.total - p.total : null;

      h += "<div class=\"hrow\">";
      h += "<div><div style=\"font-size:13px;font-weight:600;color:var(--t2)\">" + r.date + "</div></div>";
      h += "<div style=\"text-align:right\">";
      h += "<div style=\"font-size:13px;font-weight:700;color:var(--t1)\">" + formatCurrency(r.total) + "</div>";
      if (d !== null) {
        h += "<div style=\"font-size:11px;color:" + (d >= 0 ? "var(--red)" : "#60A5FA") + ";font-weight:600\">";
        h += (d >= 0 ? "▲" : "▼") + " " + formatCurrency(Math.abs(d));
        h += "</div>";
      }
      h += "</div></div>";
    });

    h += "</div>";
  }

  // === 데이터 관리 섹션 ===
  h += "<div style=\"margin-top:18px;padding:16px;background:rgba(255,255,255,.015);border-radius:13px;border:1px solid var(--bd)\">";

  // 헤더: 데이터 요약 + 초기화 버튼
  h += "<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:12px\">";
  h += "<div>";
  h += "<div style=\"font-size:12.5px;font-weight:600;color:var(--t3)\">데이터 관리</div>";
  h += "<div style=\"font-size:11.5px;color:var(--t5);margin-top:1px\">";
  h += "기록 " + appState.history.length + "일 / 자산 " + appState.assets.length + "건";
  if (appState.income.length > 0) {
    h += " / 수입 " + appState.income.length + "건";
  }
  h += "</div>";
  h += "</div>";
  h += "<button class=\"btn btn-d\" style=\"font-size:11.5px;padding:7px 12px\" onclick=\"openReset()\">🗑 초기화</button>";
  h += "</div>";

  // 백업/복원 버튼
  h += "<div style=\"display:flex;gap:8px;flex-wrap:wrap\">";
  h += "<button style=\"flex:1;min-width:120px;padding:10px 14px;border-radius:10px;border:1px solid rgba(16,185,129,.15);background:rgba(16,185,129,.05);color:var(--green);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px\" onclick=\"exportData()\">💾 백업 파일 저장</button>";
  h += "<button style=\"flex:1;min-width:120px;padding:10px 14px;border-radius:10px;border:1px solid rgba(59,130,246,.15);background:rgba(59,130,246,.05);color:#60A5FA;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px\" onclick=\"document.getElementById('impFile').click()\">📂 백업 파일 복원</button>";
  h += "<input type=\"file\" id=\"impFile\" accept=\".json\" style=\"display:none\" onchange=\"importData(this)\">";
  h += "</div>";

  // 내보내기 버튼 (CSV / PDF)
  h += "<div style=\"margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.04)\">";
  h += "<div style=\"font-size:11.5px;color:var(--t4);margin-bottom:6px;font-weight:500\">📊 내보내기</div>";
  h += "<div style=\"display:flex;gap:8px;flex-wrap:wrap\">";
  h += "<button style=\"flex:1;min-width:90px;padding:9px 12px;border-radius:10px;border:1px solid rgba(245,158,11,.15);background:rgba(245,158,11,.05);color:var(--amber);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px\" onclick=\"exportAssetCSV()\">📋 자산 CSV</button>";
  h += "<button style=\"flex:1;min-width:90px;padding:9px 12px;border-radius:10px;border:1px solid rgba(139,92,246,.15);background:rgba(139,92,246,.05);color:var(--purple);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px\" onclick=\"exportTransactionCSV()\">📝 거래 CSV</button>";
  h += "<button style=\"flex:1;min-width:90px;padding:9px 12px;border-radius:10px;border:1px solid rgba(236,72,153,.15);background:rgba(236,72,153,.05);color:var(--pink);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px\" onclick=\"exportPDFReport()\">📄 PDF 리포트</button>";
  h += "</div></div>";

  // 안내 문구
  h += "<div style=\"font-size:11px;color:var(--t5);margin-top:8px;line-height:1.5\">";
  h += "💡 백업 파일에는 자산, 거래 내역, 히스토리, 목표, 수입 기록이 모두 포함됩니다.<br>";
  h += "CSV는 엑셀/구글 시트에서, PDF 리포트는 인쇄하거나 저장할 수 있습니다.";
  h += "</div>";

  h += "</div></div>";

  el.innerHTML = h;

  // 차트 렌더링 (2개 이상 기록이 있을 때)
  if (cht.length >= 2) {
    setTimeout(function() { drawLine("cL2", cht, 230); }, 30);
  }
}

/**
 * 오늘 기록 스냅샷 저장
 */
function saveSnapshot() {
  var today = getTodayString();
  var existing = appState.history.some(function(h) { return h.date === today; });
  if (existing) {
    if (!confirm("오늘(" + today + ") 기록이 이미 있습니다. 덮어쓰시겠습니까?")) return;
  }

  appState.history = makeSnapshot(appState.assets, appState.history);
  saveData();
  render();

  var b = document.getElementById("btnSnap");
  if (b) {
    b.style.animation = "flash .6s ease";
    setTimeout(function() { b.style.animation = ""; }, 700);
  }

  showToast("✅ " + today + " 기록이 저장되었습니다");
}

/**
 * 전체 초기화 모달 열기
 */
function openReset() {
  openModal("전체 초기화",
    "<div style=\"font-size:13.5px;color:var(--t3);margin-bottom:16px\">" +
    "모든 데이터가 <strong style=\"color:var(--red)\">영구 삭제</strong>됩니다.</div>" +
    "<div class=\"mbtn\">" +
    "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>" +
    "<button class=\"btn btn-d\" onclick=\"doReset()\">초기화</button>" +
    "</div>"
  );
}

/**
 * 전체 초기화 실행
 */
function doReset() {
  appState.assets = [];
  appState.history = [];
  appState.saved = null;
  appState.categoryOrder = null;
  appState.coinShowProfitLoss = true;
  appState.goal = null;
  appState.income = [];

  updateLogs = [];
  loadingAssets = {};
  isAllLoading = false;
  expandedAssets = {};
  isEditMode = false;
  dashboardCategoryOpen = {};
  listCategoryOpen = {};
  geminiResult = null;
  selectedIncomeMonth = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}

  closeModal();
  render();
}

/**
 * 데이터 백업 파일 내보내기 (JSON)
 */
function exportData() {
  try {
    var data = {
      _ver: APP_VERSION,
      _date: getNowString(),
      _type: "myportfolio_backup",
      a: appState.assets,
      h: appState.history,
      s: appState.saved,
      co: appState.categoryOrder,
      cpl: appState.coinShowProfitLoss,
      goal: appState.goal || null,
      inc: appState.income || []
    };

    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");

    var d = new Date();
    var fn = "MyPortfolio_backup_" +
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0") + "_" +
      String(d.getHours()).padStart(2, "0") +
      String(d.getMinutes()).padStart(2, "0") + ".json";

    a.href = url;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    try { localStorage.setItem("mp_last_backup", Date.now().toString()); } catch (ex) {}
    showToast("✅ 백업 파일이 저장되었습니다: " + fn);
  } catch (e) {
    showToast("❌ 백업 실패: " + e.message);
  }
}

/**
 * 백업 파일 불러오기 (파일 읽기 + 확인 모달)
 * @param {HTMLInputElement} input - 파일 input 요소
 */
function importData(input) {
  if (!input.files || !input.files[0]) return;

  var file = input.files[0];
  if (file.size > 10 * 1024 * 1024) {
    showToast("❌ 파일이 너무 큽니다 (최대 10MB)");
    input.value = "";
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var raw = e.target.result;
      var d = JSON.parse(raw);

      if (!d || typeof d !== "object") {
        showToast("❌ 올바른 백업 파일이 아닙니다");
        return;
      }

      var assetCnt = Array.isArray(d.a) ? d.a.length : 0;
      var histCnt = Array.isArray(d.h) ? d.h.length : 0;
      var incCnt = Array.isArray(d.inc) ? d.inc.length : 0;
      var hasGoal = d.goal ? true : false;
      var ver = d._ver || "알 수 없음";
      var bDate = d._date || "알 수 없음";

      var info = "<div style=\"padding:14px;background:rgba(59,130,246,.05);border:1px solid rgba(59,130,246,.1);border-radius:12px;margin-bottom:14px\">";
      info += "<div style=\"font-size:11px;color:var(--t4);margin-bottom:6px\">백업 파일 정보</div>";
      info += "<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:6px\">";
      info += "<div style=\"font-size:12px;color:var(--t3)\">📦 버전</div>";
      info += "<div style=\"font-size:12px;color:var(--t1);font-weight:600;text-align:right\">" + escapeHtml(String(ver)) + "</div>";
      info += "<div style=\"font-size:12px;color:var(--t3)\">📅 백업 일시</div>";
      info += "<div style=\"font-size:12px;color:var(--t1);font-weight:600;text-align:right\">" + escapeHtml(String(bDate).slice(0, 20)) + "</div>";
      info += "<div style=\"font-size:12px;color:var(--t3)\">💼 자산</div>";
      info += "<div style=\"font-size:12px;color:var(--t1);font-weight:600;text-align:right\">" + assetCnt + "개</div>";
      info += "<div style=\"font-size:12px;color:var(--t3)\">📈 히스토리</div>";
      info += "<div style=\"font-size:12px;color:var(--t1);font-weight:600;text-align:right\">" + histCnt + "일</div>";
      info += "<div style=\"font-size:12px;color:var(--t3)\">💵 수입 기록</div>";
      info += "<div style=\"font-size:12px;color:var(--t1);font-weight:600;text-align:right\">" + incCnt + "건</div>";
      info += "<div style=\"font-size:12px;color:var(--t3)\">🎯 목표</div>";
      info += "<div style=\"font-size:12px;color:var(--t1);font-weight:600;text-align:right\">" + (hasGoal ? "설정됨" : "없음") + "</div>";
      info += "</div></div>";

      info += "<div style=\"font-size:12px;color:var(--red);font-weight:600;margin-bottom:8px\">⚠️ 현재 데이터가 모두 덮어씌워집니다.</div>";
      info += "<div style=\"font-size:11px;color:var(--t4);margin-bottom:14px\">복원 전 현재 데이터를 백업해두는 것을 권장합니다.</div>";

      info += "<div class=\"mbtn\">";
      info += "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>";
      info += "<button class=\"btn btn-p\" style=\"flex:2\" onclick=\"doImport()\">📂 복원하기</button>";
      info += "</div>";

      window._pendingImport = d;
      openModal("📂 백업 복원", info);
    } catch (ex) {
      showToast("❌ 파일 읽기 실패: " + ex.message);
    }
  };

  reader.readAsText(file);
  input.value = "";
}

/**
 * 백업 복원 실행
 */
/**
 * CSV 다운로드 헬퍼
 */
function _downloadCSV(filename, csvContent) {
  var bom = "\uFEFF";
  var blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _csvEscape(val) {
  var s = String(val == null ? "" : val);
  if (s.indexOf(",") >= 0 || s.indexOf('"') >= 0 || s.indexOf("\n") >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * 자산 현황 CSV 내보내기
 */
function exportAssetCSV() {
  if (!appState.assets.length) {
    showToast("❌ 내보낼 자산이 없습니다");
    return;
  }

  var headers = ["자산명", "카테고리", "현재가", "보유수량", "평가금액", "총투자금액", "수익/손실", "수익률(%)", "메모"];
  var rows = [headers.join(",")];

  appState.assets.forEach(function(a) {
    var c = calcAsset(a);
    var isCL = isCashLike(a.category);
    rows.push([
      _csvEscape(a.name),
      _csvEscape(a.category),
      isCL ? "" : a.amount,
      isCL ? "" : c.qty,
      c.evalAmt,
      isCL ? "" : c.totalCost,
      isCL ? "" : c.profit,
      isCL ? "" : c.profitPct,
      _csvEscape(a.note || "")
    ].join(","));
  });

  var d = new Date();
  var fn = "MyPortfolio_자산현황_" + d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") + ".csv";

  _downloadCSV(fn, rows.join("\n"));
  showToast("✅ 자산 현황 CSV가 저장되었습니다");
}

/**
 * 거래 내역 CSV 내보내기
 */
function exportTransactionCSV() {
  var allTxns = [];
  appState.assets.forEach(function(a) {
    if (!a.txns || !a.txns.length) return;
    a.txns.forEach(function(t) {
      allTxns.push({
        date: t.date || "",
        name: a.name,
        category: a.category,
        type: t.type === "buy"
          ? getTransactionLabel(a.category, "buy")
          : getTransactionLabel(a.category, "sell"),
        price: t.price,
        qty: t.qty,
        account: t.account || "",
        memo: t.memo || ""
      });
    });
  });

  if (!allTxns.length) {
    showToast("❌ 내보낼 거래 내역이 없습니다");
    return;
  }

  allTxns.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  var headers = ["날짜", "자산명", "카테고리", "유형", "금액", "수량", "계좌", "메모"];
  var rows = [headers.join(",")];

  allTxns.forEach(function(t) {
    rows.push([
      _csvEscape(t.date),
      _csvEscape(t.name),
      _csvEscape(t.category),
      _csvEscape(t.type),
      t.price,
      t.qty,
      _csvEscape(t.account),
      _csvEscape(t.memo)
    ].join(","));
  });

  var d = new Date();
  var fn = "MyPortfolio_거래내역_" + d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") + ".csv";

  _downloadCSV(fn, rows.join("\n"));
  showToast("✅ 거래 내역 CSV가 저장되었습니다 (" + allTxns.length + "건)");
}

/**
 * PDF 리포트 생성 (인쇄 가능한 새 창)
 */
function exportPDFReport() {
  if (!appState.assets.length) {
    showToast("❌ 내보낼 자산이 없습니다");
    return;
  }

  var total = 0, inv = 0, pf = 0;
  appState.assets.forEach(function(a) {
    if (!hasTransactions(a)) return;
    var c = calcAsset(a);
    total += c.evalAmt;
    inv += c.totalCost;
    pf += c.profit;
  });

  var catData = CATEGORY_LIST.map(function(cat) {
    var v = 0;
    appState.assets.filter(function(a) { return a.category === cat; })
      .forEach(function(a) { v += getAssetValue(a); });
    return { n: cat, v: v, ic: CATEGORY_CONFIG[cat].icon };
  }).filter(function(d) { return d.v > 0; }).sort(function(a, b) { return b.v - a.v; });

  var today = getTodayString();
  var pp = inv > 0 ? ((pf / inv) * 100).toFixed(2) : "0.00";

  var html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">" +
    "<title>My Portfolio 자산 리포트 - " + today + "</title>" +
    "<style>" +
    "* { margin:0; padding:0; box-sizing:border-box; }" +
    "body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#1a1a2e; padding:40px; max-width:800px; margin:0 auto; }" +
    "h1 { font-size:22px; margin-bottom:4px; }" +
    ".sub { color:#666; font-size:12px; margin-bottom:24px; }" +
    ".summary { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:24px; }" +
    ".summary-card { padding:16px; background:#f8f9fa; border-radius:10px; border:1px solid #e9ecef; }" +
    ".summary-card .label { font-size:11px; color:#868e96; margin-bottom:4px; }" +
    ".summary-card .value { font-size:18px; font-weight:700; }" +
    ".profit { color:#e03131; }" +
    ".loss { color:#1971c2; }" +
    "table { width:100%; border-collapse:collapse; margin-bottom:20px; font-size:12px; }" +
    "th { background:#f1f3f5; padding:8px 10px; text-align:left; font-weight:600; color:#495057; border-bottom:2px solid #dee2e6; }" +
    "td { padding:8px 10px; border-bottom:1px solid #e9ecef; }" +
    "tr:hover { background:#f8f9fa; }" +
    ".text-right { text-align:right; }" +
    ".section-title { font-size:14px; font-weight:700; margin:20px 0 10px; padding-bottom:6px; border-bottom:2px solid #228be6; }" +
    ".footer { margin-top:30px; padding-top:14px; border-top:1px solid #e9ecef; font-size:11px; color:#adb5bd; text-align:center; }" +
    "@media print { body { padding:20px; } .no-print { display:none; } }" +
    "</style></head><body>";

  // Header
  html += "<h1>My Portfolio 자산 리포트</h1>";
  html += "<div class=\"sub\">생성일: " + today + " | " + APP_VERSION + "</div>";

  // Print button
  html += "<div class=\"no-print\" style=\"margin-bottom:16px\">" +
    "<button onclick=\"window.print()\" style=\"padding:8px 20px;background:#228be6;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600\">🖨 인쇄 / PDF 저장</button>" +
    " <button onclick=\"window.close()\" style=\"padding:8px 20px;background:#e9ecef;color:#495057;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600\">닫기</button></div>";

  // Summary
  html += "<div class=\"summary\">";
  html += "<div class=\"summary-card\"><div class=\"label\">총 자산</div><div class=\"value\">" + formatCurrency(total) + "</div></div>";
  html += "<div class=\"summary-card\"><div class=\"label\">총 투자금액</div><div class=\"value\">" + formatCurrency(inv) + "</div></div>";
  html += "<div class=\"summary-card\"><div class=\"label\">총 수익/손실</div><div class=\"value " + (pf >= 0 ? "profit" : "loss") + "\">" +
    (pf >= 0 ? "+" : "") + formatCurrency(pf) + " (" + (pf >= 0 ? "+" : "") + pp + "%)</div></div>";
  html += "</div>";

  // Category breakdown
  if (catData.length > 0) {
    html += "<div class=\"section-title\">카테고리별 자산 구성</div>";
    html += "<table><tr><th>카테고리</th><th class=\"text-right\">평가금액</th><th class=\"text-right\">비중</th></tr>";
    catData.forEach(function(d) {
      html += "<tr><td>" + d.ic + " " + d.n + "</td>" +
        "<td class=\"text-right\">" + formatCurrency(d.v) + "</td>" +
        "<td class=\"text-right\">" + (total > 0 ? ((d.v / total) * 100).toFixed(1) : "0.0") + "%</td></tr>";
    });
    html += "</table>";
  }

  // Asset detail table
  html += "<div class=\"section-title\">자산 상세 현황</div>";
  html += "<table><tr><th>자산명</th><th>카테고리</th><th class=\"text-right\">평가금액</th><th class=\"text-right\">투자금액</th><th class=\"text-right\">수익/손실</th><th class=\"text-right\">수익률</th></tr>";

  var ordCats = getOrderedCategories();
  ordCats.forEach(function(cat) {
    appState.assets.filter(function(a) { return a.category === cat; }).forEach(function(a) {
      var c = calcAsset(a);
      var isCL = isCashLike(a.category);
      html += "<tr><td>" + escapeHtml(a.name) + "</td><td>" + a.category + "</td>" +
        "<td class=\"text-right\">" + formatCurrency(c.evalAmt) + "</td>" +
        "<td class=\"text-right\">" + (isCL ? "-" : formatCurrency(c.totalCost)) + "</td>" +
        "<td class=\"text-right " + (!isCL && c.profit >= 0 ? "profit" : !isCL ? "loss" : "") + "\">" +
          (isCL ? "-" : (c.profit >= 0 ? "+" : "") + formatCurrency(c.profit)) + "</td>" +
        "<td class=\"text-right " + (!isCL && c.profit >= 0 ? "profit" : !isCL ? "loss" : "") + "\">" +
          (isCL ? "-" : (c.profit >= 0 ? "+" : "") + c.profitPct + "%") + "</td></tr>";
    });
  });
  html += "</table>";

  // Recent history
  if (appState.history.length > 0) {
    var recent = appState.history.slice(-10).reverse();
    html += "<div class=\"section-title\">최근 자산 변동 (최대 10일)</div>";
    html += "<table><tr><th>날짜</th><th class=\"text-right\">총 자산</th><th class=\"text-right\">변동</th></tr>";
    recent.forEach(function(r) {
      var idx = appState.history.indexOf(r);
      var prev = idx > 0 ? appState.history[idx - 1] : null;
      var diff = prev ? r.total - prev.total : null;
      html += "<tr><td>" + r.date + "</td>" +
        "<td class=\"text-right\">" + formatCurrency(r.total) + "</td>" +
        "<td class=\"text-right " + (diff !== null ? (diff >= 0 ? "profit" : "loss") : "") + "\">" +
          (diff !== null ? (diff >= 0 ? "+" : "") + formatCurrency(diff) : "-") + "</td></tr>";
    });
    html += "</table>";
  }

  // Footer
  html += "<div class=\"footer\">My Portfolio " + APP_VERSION + " | 생성: " + getNowString() + "</div>";
  html += "</body></html>";

  var w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    showToast("✅ PDF 리포트가 새 탭에서 열렸습니다. 인쇄 버튼을 눌러 PDF로 저장하세요.");
  } else {
    showToast("❌ 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
  }
}

function doImport() {
  var d = window._pendingImport;
  if (!d) {
    showToast("❌ 복원할 데이터가 없습니다");
    closeModal();
    return;
  }

  try {
    appState.assets = Array.isArray(d.a)
      ? d.a.map(sanitizeAsset).filter(Boolean).slice(0, 500)
      : [];

    appState.history = Array.isArray(d.h)
      ? d.h.filter(function(x) {
          return x && typeof x === "object" && typeof (x.date || x.d) === "string" && isFinite(x.total);
        }).map(function(x) {
          if (x.d && !x.date) { x.date = x.d; }
          return x;
        }).slice(0, 3650)
      : [];

    appState.saved = typeof d.s === "string" ? d.s.slice(0, 50) : null;

    appState.categoryOrder = Array.isArray(d.co)
      ? d.co.filter(function(c) {
          return CATEGORY_LIST.indexOf(c) >= 0;
        }).slice(0, CATEGORY_LIST.length)
      : null;

    if (d.cpl !== undefined) {
      appState.coinShowProfitLoss = !!d.cpl;
    }

    if (d.goal && typeof d.goal === "object") {
      appState.goal = {
        amount: sanitizeNum(d.goal.amount),
        date: d.goal.date ? sanitizeStr(d.goal.date, 10) : null,
        setDate: d.goal.setDate ? sanitizeStr(d.goal.setDate, 10) : null
      };
    } else {
      appState.goal = null;
    }

    appState.income = Array.isArray(d.inc)
      ? d.inc.filter(function(x) {
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
        }).slice(0, 5000)
      : [];

    saveData();
    window._pendingImport = null;
    closeModal();
    render();
    showToast("✅ 백업 복원 완료! (자산 " + appState.assets.length + "개, 히스토리 " + appState.history.length + "일)");
  } catch (ex) {
    showToast("❌ 복원 실패: " + ex.message);
  }
}
