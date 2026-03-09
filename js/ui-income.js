/* ===================================================
   ui-income.js - 수입 탭 렌더링 및 수입 관리
   (수입 기록 추가/삭제, 월별 탐색, 반복 수입 복사)
   =================================================== */

/**
 * 현재 선택된 수입 월 가져오기 (없으면 이번 달로 초기화)
 * @returns {string} "YYYY-MM" 형식
 */
function getSelectedIncomeMonth() {
  if (!selectedIncomeMonth) {
    var d = new Date();
    selectedIncomeMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  return selectedIncomeMonth;
}

/**
 * 월 문자열을 한국어 라벨로 변환
 * @param {string} ym - "YYYY-MM" 형식
 * @returns {string} 예: "2026년 2월"
 */
function formatIncomeMonthLabel(ym) {
  var p = ym.split("-");
  return p[0] + "년 " + Number(p[1]) + "월";
}

/**
 * 수입 월 탐색 (이전/다음)
 * @param {number} dir - -1(이전) 또는 1(다음)
 */
function navigateIncomeMonth(dir) {
  var ym = getSelectedIncomeMonth().split("-");
  var y = Number(ym[0]), m = Number(ym[1]) + dir;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  selectedIncomeMonth = y + "-" + String(m).padStart(2, "0");
  renderIncome();
}

/**
 * 수입 탭 전체 렌더링
 */
function renderIncome() {
  var el = document.getElementById("pgInc");
  var ym = getSelectedIncomeMonth();

  // 해당 월 수입 항목 필터링 및 정렬
  var items = appState.income.filter(function(x) {
    return x.date && x.date.slice(0, 7) === ym;
  }).sort(function(a, b) {
    return (b.date || "").localeCompare(a.date || "");
  });

  // 카테고리별 합계 계산
  var total = 0, byC = {};
  INCOME_CATEGORIES.forEach(function(c) { byC[c.id] = 0; });
  items.forEach(function(x) {
    total += x.amount;
    if (byC[x.cat] !== undefined) byC[x.cat] += x.amount;
    else byC["etc"] += x.amount;
  });

  var h = "<div class=\"card\" style=\"margin-bottom:10px\">";

  // 월 네비게이션 헤더
  h += "<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:16px\">";
  h += "<button class=\"ibtn\" style=\"background:rgba(255,255,255,.04);color:var(--t3);width:36px;height:36px;font-size:16px\" onclick=\"navigateIncomeMonth(-1)\">◀</button>";
  h += "<div style=\"text-align:center\">";
  h += "<div style=\"font-size:16px;font-weight:800;color:var(--t1)\">" + formatIncomeMonthLabel(ym) + "</div>";
  h += "<div style=\"font-size:11px;color:var(--t5);margin-top:2px\">수입 기록</div>";
  h += "</div>";
  h += "<button class=\"ibtn\" style=\"background:rgba(255,255,255,.04);color:var(--t3);width:36px;height:36px;font-size:16px\" onclick=\"navigateIncomeMonth(1)\">▶</button>";
  h += "</div>";

  // 이번 달 총 수입 표시
  h += "<div style=\"text-align:center;padding:12px 0;margin-bottom:12px;background:rgba(16,185,129,.04);border-radius:12px;border:1px solid rgba(16,185,129,.08)\">";
  h += "<div style=\"font-size:11px;color:var(--t4)\">이번 달 총 수입</div>";
  h += "<div style=\"font-size:26px;font-weight:900;color:var(--green);margin-top:4px\">" + (total > 0 ? formatCurrency(total) : "—") + "</div>";
  if (total > 0) {
    h += "<div style=\"font-size:11px;color:var(--t5);margin-top:2px\">" + formatShortCurrency(total) + "</div>";
  }
  h += "</div>";

  // 전월 반복 수입 가져오기 안내
  var prevP = ym.split("-");
  var ppy = Number(prevP[0]), ppm = Number(prevP[1]) - 1;
  if (ppm < 1) { ppm = 12; ppy--; }
  var prevYmR = ppy + "-" + String(ppm).padStart(2, "0");

  var prevRec = appState.income.filter(function(x) {
    return x.recurring && x.date && x.date.slice(0, 7) === prevYmR;
  });
  var curRec = items.filter(function(x) { return x.recurring; });

  if (prevRec.length > 0 && curRec.length === 0) {
    var recTotal = 0;
    prevRec.forEach(function(x) { recTotal += x.amount; });

    h += "<div style=\"padding:12px;background:rgba(139,92,246,.05);border:1px solid rgba(139,92,246,.12);border-radius:10px;margin-bottom:12px\">";
    h += "<div style=\"display:flex;justify-content:space-between;align-items:center;gap:8px\">";
    h += "<div>";
    h += "<div style=\"font-size:12px;font-weight:600;color:var(--t2)\">🔄 전월 반복 수입 " + prevRec.length + "건</div>";
    h += "<div style=\"font-size:11px;color:var(--t4);margin-top:2px\">" + formatShortCurrency(recTotal) + " · " + formatIncomeMonthLabel(prevYmR) + "에서 가져오기</div>";
    h += "</div>";
    h += "<button style=\"border:1px solid rgba(139,92,246,.2);background:rgba(139,92,246,.1);color:#A78BFA;padding:7px 14px;border-radius:8px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap\" onclick=\"copyRecurring(" + QUOTE + prevYmR + QUOTE + "," + QUOTE + ym + QUOTE + ")\">가져오기</button>";
    h += "</div></div>";
  }

  // 카테고리별 도넛 차트 + 분류 목록
  if (total > 0) {
    var cd = [];
    INCOME_CATEGORIES.forEach(function(c) {
      if (byC[c.id] > 0) cd.push({ id: c.id, nm: c.label, c: c.color, v: byC[c.id] });
    });

    h += "<div style=\"display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:14px\">";
    h += "<div style=\"flex:0 0 140px;display:flex;justify-content:center\"><canvas id=\"incPie\" width=\"140\" height=\"140\"></canvas></div>";
    h += "<div style=\"flex:1;min-width:140px\">";

    cd.forEach(function(d, i) {
      h += "<div style=\"display:flex;align-items:center;gap:8px;padding:5px 0;";
      if (i < cd.length - 1) h += "border-bottom:1px solid rgba(255,255,255,.03);";
      h += "\">";
      h += "<div style=\"width:8px;height:8px;border-radius:3px;background:" + d.c + "\"></div>";
      h += "<div style=\"flex:1;font-size:12px;color:var(--t3)\">" + d.nm + "</div>";
      h += "<div style=\"text-align:right\">";
      h += "<div style=\"font-size:12.5px;font-weight:700;color:var(--t1)\">" + formatShortCurrency(d.v) + "</div>";
      h += "<div style=\"font-size:11px;color:var(--t4)\">" + ((d.v / total) * 100).toFixed(1) + "%</div>";
      h += "</div></div>";
    });

    h += "</div></div>";
  }

  // 전월 대비 변동
  var prev = ym.split("-");
  var py = Number(prev[0]), pm = Number(prev[1]) - 1;
  if (pm < 1) { pm = 12; py--; }
  var prevYm = py + "-" + String(pm).padStart(2, "0");
  var prevTotal = 0;
  appState.income.forEach(function(x) {
    if (x.date && x.date.slice(0, 7) === prevYm) prevTotal += x.amount;
  });

  if (prevTotal > 0 && total > 0) {
    var chg = total - prevTotal;
    var chgPct = ((chg / prevTotal) * 100).toFixed(1);
    h += "<div style=\"padding:10px 12px;background:rgba(255,255,255,.02);border-radius:10px;border:1px solid var(--bd);margin-bottom:14px;font-size:11.5px;color:var(--t3)\">";
    h += "전월 대비 <strong style=\"color:" + (chg >= 0 ? "var(--red)" : "var(--blue)") + "\">";
    h += (chg >= 0 ? "+" : "") + formatCurrency(chg) + " (" + chgPct + "%)";
    h += "</strong> · 전월 " + formatShortCurrency(prevTotal);
    h += "</div>";
  }

  // 수입 기록 추가 버튼
  h += "<button class=\"btn btn-p\" style=\"width:100%;padding:12px;font-size:13.5px;margin-bottom:6px\" onclick=\"openIncomeAdd()\">➕ 수입 기록 추가</button>";
  h += "</div>";

  // 최근 6개월 수입 추이 막대 차트
  var months = [];
  for (var mi = 5; mi >= 0; mi--) {
    var md = new Date();
    md.setMonth(md.getMonth() - mi);
    var mk = md.getFullYear() + "-" + String(md.getMonth() + 1).padStart(2, "0");
    var mt = 0;
    appState.income.forEach(function(x) {
      if (x.date && x.date.slice(0, 7) === mk) mt += x.amount;
    });
    months.push({ m: String(md.getMonth() + 1) + "월", v: mt });
  }
  var maxM = Math.max.apply(null, months.map(function(x) { return x.v; })) || 1;

  if (appState.income.length > 0) {
    h += "<div class=\"card\">";
    h += "<div style=\"font-size:13px;font-weight:700;color:var(--t1);margin-bottom:12px\">📊 최근 6개월 수입 추이</div>";

    months.forEach(function(x) {
      var pct = Math.round((x.v / maxM) * 100);
      h += "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:6px\">";
      h += "<span style=\"font-size:11px;color:var(--t4);min-width:32px\">" + x.m + "</span>";
      h += "<div style=\"flex:1;height:22px;background:rgba(255,255,255,.03);border-radius:6px;overflow:hidden\">";
      h += "<div style=\"height:100%;width:" + pct + "%;background:linear-gradient(90deg,#10B981,#3B82F6);border-radius:6px;min-width:" + (x.v > 0 ? "2px" : "0") + "\"></div>";
      h += "</div>";
      h += "<span style=\"font-size:11px;color:var(--t2);min-width:60px;text-align:right;font-weight:600\">" + (x.v > 0 ? formatShortCurrency(x.v) : "—") + "</span>";
      h += "</div>";
    });

    h += "</div>";
  }

  // 수입 내역 목록
  if (items.length > 0) {
    h += "<div class=\"card\">";
    h += "<div style=\"font-size:13px;font-weight:700;color:var(--t1);margin-bottom:12px\">📋 " + formatIncomeMonthLabel(ym) + " 수입 내역</div>";

    items.forEach(function(x) {
      var catObj = INCOME_CATEGORIES.find(function(c) { return c.id === x.cat; }) || INCOME_CATEGORIES[6];

      h += "<div style=\"display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.03)\">";

      // 카테고리 아이콘
      h += "<div style=\"width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.03);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0\">";
      h += catObj.label.slice(0, 2);
      h += "</div>";

      // 수입 정보
      h += "<div style=\"flex:1;min-width:0\">";
      h += "<div style=\"font-size:13px;font-weight:600;color:var(--t1);display:flex;align-items:center;gap:4px\">";
      h += (x.source ? escapeHtml(x.source) : catObj.label);
      if (x.recurring) {
        h += "<span style=\"font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(139,92,246,.1);color:#A78BFA;font-weight:600\">반복</span>";
      }
      h += "</div>";
      h += "<div style=\"font-size:11.5px;color:var(--t5);margin-top:2px\">";
      h += (x.date || "");
      if (x.memo) h += " · " + escapeHtml(x.memo);
      h += "</div></div>";

      // 금액
      h += "<div style=\"text-align:right;flex-shrink:0\">";
      h += "<div style=\"font-size:14px;font-weight:700;color:var(--green)\">+" + formatCurrency(x.amount) + "</div>";
      h += "<div style=\"font-size:11px;color:var(--t4)\">" + catObj.label + "</div>";
      h += "</div>";

      // 삭제 버튼
      h += "<button class=\"ibtn\" style=\"background:rgba(239,68,68,.05);color:var(--red);width:28px;height:28px;font-size:11px;flex-shrink:0\" onclick=\"deleteIncome(" + x.id + ")\">✕</button>";
      h += "</div>";
    });

    h += "</div>";
  } else {
    h += "<div class=\"card\" style=\"text-align:center;padding:28px;color:var(--t4);font-size:13px\">";
    h += "이번 달 수입 기록이 없습니다<br>";
    h += "<span style=\"font-size:11.5px;color:var(--t5)\">위 버튼으로 추가해보세요</span>";
    h += "</div>";
  }

  el.innerHTML = h;

  // 도넛 차트 렌더링
  if (total > 0) {
    var cd2 = [];
    INCOME_CATEGORIES.forEach(function(c) {
      if (byC[c.id] > 0) cd2.push({ nm: c.label, c: c.color, v: byC[c.id] });
    });

    setTimeout(function() {
      var ctx = document.getElementById("incPie");
      if (!ctx) return;
      try { if (charts.incPie) charts.incPie.destroy(); } catch (e) {}
      charts.incPie = null;

      charts.incPie = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: cd2.map(function(d) { return d.nm; }),
          datasets: [{
            data: cd2.map(function(d) { return d.v; }),
            backgroundColor: cd2.map(function(d) { return d.c; }),
            borderWidth: 0,
            spacing: 2
          }]
        },
        options: {
          cutout: "58%",
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
                label: function(c) {
                  return c.label + ": " + formatShortCurrency(c.raw) + " (" + ((c.raw / total) * 100).toFixed(1) + "%)";
                }
              }
            }
          }
        }
      });
    }, 30);
  }
}

/**
 * 수입 추가 모달 열기
 */
function openIncomeAdd() {
  var ym = getSelectedIncomeMonth();

  var h = "<div class=\"fld\"><label>수입 분류</label>";
  h += "<div style=\"display:flex;flex-wrap:wrap;gap:5px\">";

  INCOME_CATEGORIES.forEach(function(c, i) {
    h += "<button class=\"cchip" + (i === 0 ? " sel" : "") + "\" data-ic=\"" + c.id + "\" onclick=\"selectIncomeCategory(" + QUOTE + c.id + QUOTE + ")\" style=\"padding:5px 10px\">" + c.label + "</button>";
  });

  h += "</div>";
  h += "<input type=\"hidden\" id=\"inc-cat\" value=\"salary\">";
  h += "</div>";

  // 금액 입력
  h += "<div class=\"fld\"><label>금액 (원)</label>";
  h += "<input type=\"number\" id=\"inc-amt\" placeholder=\"예: 3500000\" oninput=\"previewAmount(this.value)\">";
  h += "<div id=\"amt-prev\" style=\"font-size:12px;color:var(--green);font-weight:600;margin-top:4px;min-height:18px\"></div>";

  // 빠른 금액 버튼
  h += "<div style=\"display:flex;gap:4px;flex-wrap:wrap;margin-top:6px\">";
  ["100만", "200만", "300만", "500만", "1000만"].forEach(function(lb) {
    var vals = { "100만": 1e6, "200만": 2e6, "300만": 3e6, "500만": 5e6, "1000만": 1e7 };
    h += "<button style=\"border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--t3);padding:4px 10px;border-radius:7px;font-size:11px;cursor:pointer;font-family:inherit\" onclick=\"document.getElementById(" + QUOTE + "inc-amt" + QUOTE + ").value=" + vals[lb] + ";previewAmount(" + vals[lb] + ")\">" + lb + "</button>";
  });
  h += "</div></div>";

  // 수입처
  h += "<div class=\"fld\"><label>수입처 (선택)</label>";
  h += "<input id=\"inc-src\" maxlength=\"100\" placeholder=\"예: 회사명, 클라이언트명\">";

  // 최근 수입처 추천
  var srcs = {};
  appState.income.forEach(function(x) { if (x.source) srcs[x.source] = 1; });
  var sl = Object.keys(srcs);
  if (sl.length > 0) {
    h += "<div style=\"margin-top:5px;display:flex;gap:4px;flex-wrap:wrap\">";
    sl.slice(0, 8).forEach(function(s) {
      h += "<button class=\"cchip\" style=\"padding:3px 8px\" onclick=\"document.getElementById(" + QUOTE + "inc-src" + QUOTE + ").value=" + QUOTE + escapeHtml(s) + QUOTE + "\">" + escapeHtml(s) + "</button>";
    });
    h += "</div>";
  }
  h += "</div>";

  // 날짜
  h += "<div class=\"fld\"><label>날짜</label>";
  h += "<input type=\"date\" id=\"inc-date\" value=\"" + ym + "-15\">";
  h += "</div>";

  // 메모
  h += "<div class=\"fld\"><label>메모 (선택)</label>";
  h += "<input id=\"inc-memo\" maxlength=\"200\" placeholder=\"메모\">";
  h += "</div>";

  // 반복 수입 체크박스
  h += "<div style=\"padding:10px 12px;background:rgba(59,130,246,.04);border-radius:10px;border:1px solid rgba(59,130,246,.08);margin-bottom:10px\">";
  h += "<label style=\"display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--t3)\">";
  h += "<input type=\"checkbox\" id=\"inc-rec\" style=\"accent-color:var(--blue)\"> 매월 반복 수입 (고정 수입)";
  h += "</label></div>";

  // 버튼
  h += "<div class=\"mbtn\">";
  h += "<button class=\"btn btn-g\" onclick=\"closeModal()\">취소</button>";
  h += "<button class=\"btn btn-p\" style=\"flex:2\" onclick=\"doIncomeAdd()\">💵 수입 기록</button>";
  h += "</div>";

  openModal(formatIncomeMonthLabel(ym) + " 수입 추가", h);
}

/**
 * 수입 카테고리 칩 선택
 * @param {string} id - 카테고리 ID
 */
function selectIncomeCategory(id) {
  document.getElementById("inc-cat").value = id;
  document.querySelectorAll("[data-ic]").forEach(function(el) {
    el.classList.toggle("sel", el.dataset.ic === id);
  });
}

/**
 * 수입 추가 실행
 */
function doIncomeAdd() {
  var amt = Number((document.getElementById("inc-amt") || {}).value);
  if (!amt || !isFinite(amt) || amt <= 0) {
    showToast("❌ 금액을 입력하세요");
    return;
  }

  var cat = (document.getElementById("inc-cat") || {}).value || "etc";
  var src = ((document.getElementById("inc-src") || {}).value || "").trim().slice(0, 100);
  var date = (document.getElementById("inc-date") || {}).value || getTodayString();
  var memo = ((document.getElementById("inc-memo") || {}).value || "").trim().slice(0, 200);
  var rec = document.getElementById("inc-rec") && document.getElementById("inc-rec").checked;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = getTodayString();

  if (appState.income.length >= 5000) {
    showToast("⚠️ 수입 기록이 너무 많습니다");
    return;
  }

  captureUndo();

  appState.income.push({
    id: generateId(),
    date: date,
    amount: Math.round(amt),
    cat: cat,
    source: src || null,
    memo: memo || null,
    recurring: rec
  });

  saveData();
  closeModal();
  showToast("✅ " + formatCurrency(Math.round(amt)) + " 수입이 기록되었습니다", true);
  renderIncome();
}

/**
 * 수입 기록 삭제
 * @param {number} id - 수입 항목 ID
 */
function deleteIncome(id) {
  if (!confirm("이 수입 기록을 삭제하시겠습니까?")) return;

  captureUndo();
  appState.income = appState.income.filter(function(x) { return x.id !== id; });
  saveData();
  showToast("🗑 수입 기록이 삭제되었습니다", true);
  renderIncome();
}

/**
 * 전월 반복 수입을 현재 월로 복사
 * @param {string} fromYm - 복사 원본 월 ("YYYY-MM")
 * @param {string} toYm   - 복사 대상 월 ("YYYY-MM")
 */
function copyRecurring(fromYm, toYm) {
  var recs = appState.income.filter(function(x) {
    return x.recurring && x.date && x.date.slice(0, 7) === fromYm;
  });
  if (!recs.length) return;

  captureUndo();

  var cnt = 0;
  recs.forEach(function(x) {
    if (appState.income.length >= 5000) return;
    var newDate = toYm + x.date.slice(7);
    appState.income.push({
      id: generateId(),
      date: newDate,
      amount: x.amount,
      cat: x.cat,
      source: x.source,
      memo: x.memo,
      recurring: true
    });
    cnt++;
  });

  saveData();
  showToast("✅ 반복 수입 " + cnt + "건이 복사되었습니다", true);
  renderIncome();
}
