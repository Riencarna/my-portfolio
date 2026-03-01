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
      h += "<button style=\"padding:4px 9px;border-radius:7px;font-size:10.5px;font-family:inherit;" +
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
  h += "<div style=\"font-size:10.5px;color:var(--t5);margin-top:1px\">";
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

  // 안내 문구
  h += "<div style=\"font-size:10px;color:var(--t5);margin-top:8px;line-height:1.5\">";
  h += "💡 백업 파일에는 자산, 거래 내역, 히스토리, 목표, 수입 기록이 모두 포함됩니다.<br>";
  h += "다른 기기나 브라우저로 옮기거나, 만약을 위해 정기적으로 백업하세요.";
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
