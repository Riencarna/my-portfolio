/* ui-ai.js - AI 분석 및 포트폴리오 진단 */

function renderAI() {
  var el = document.getElementById("pgAi");
  var total = 0, inv = 0, byC = {}, items = [];

  CATEGORY_LIST.forEach(function (c) { byC[c] = 0; });

  appState.assets.forEach(function (a) {
    var v = getAssetValue(a);
    total += v;
    byC[a.category] += v;
    var c = calcAsset(a);
    if (c.totalCost > 0) inv += c.totalCost;
    items.push({
      name: a.name,
      category: a.category,
      eval: v,
      cost: c.totalCost,
      profit: c.profit,
      profitPct: c.profitPct
    });
  });

  items.sort(function (a, b) { return b.eval - a.eval; });

  var g = appState.goal;
  var h = "<div class=\"card\">"
    + "<div style=\"font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px\">🎯 자산 목표 설정</div>"
    + "<div style=\"font-size:11.5px;color:var(--t4);margin-bottom:14px\">목표를 설정하면 달성 시뮬레이션과 전략도 함께 제공됩니다</div>";

  if (g) {
    var pct = g.amount > 0 ? Math.min((total / g.amount) * 100, 100) : 0;
    var remain = g.amount - total;
    var dLeft = g.date ? Math.ceil((new Date(g.date) - new Date()) / 86400000) : null;

    h += "<div style=\"padding:14px;background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.1);border-radius:12px;margin-bottom:12px\">";
    h += "<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:8px\">"
      + "<span style=\"font-size:12.5px;color:var(--t3)\">현재 " + formatShortCurrency(total) + "</span>"
      + "<span style=\"font-size:12.5px;font-weight:700;color:var(--t1)\">목표 " + formatShortCurrency(g.amount) + "</span></div>";
    h += "<div style=\"height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden\">"
      + "<div style=\"height:100%;width:" + pct + "%;background:linear-gradient(90deg,#3B82F6,#8B5CF6);border-radius:4px;transition:width .5s\"></div></div>";
    h += "<div style=\"display:flex;justify-content:space-between;margin-top:6px\">"
      + "<span style=\"font-size:11px;color:var(--t4)\">달성률 " + pct.toFixed(1) + "%</span>";

    if (remain > 0)
      h += "<span style=\"font-size:11px;color:var(--t4)\">남은 금액 " + formatShortCurrency(remain) + "</span>";
    else
      h += "<span style=\"font-size:11px;color:var(--green);font-weight:600\">🎉 목표 달성!</span>";

    h += "</div>";

    if (dLeft !== null)
      h += "<div style=\"font-size:10.5px;color:var(--t5);margin-top:4px\">📅 목표일 " + g.date
        + " (D" + (dLeft > 0 ? "-" + dLeft : dLeft === 0 ? "-Day" : "+" + (0 - dLeft)) + ")</div>";

    if (remain > 0 && dLeft && dLeft > 0) {
      var mLeft = Math.max(1, Math.ceil(dLeft / 30));
      var monthly = Math.ceil(remain / mLeft);
      h += "<div style=\"margin-top:8px;padding:10px 12px;background:rgba(139,92,246,.06);border-radius:8px;font-size:11.5px;color:var(--t3)\">"
        + "💡 목표 달성까지 매월 약 <strong style=\"color:var(--t1)\">" + formatShortCurrency(monthly)
        + "</strong> 추가 필요 (" + mLeft + "개월)</div>";
    }

    h += "</div>"
      + "<button class=\"btn btn-g\" style=\"font-size:11.5px\" onclick=\"appState.goal=null;saveData();renderAI()\">🗑 목표 초기화</button>";

  } else {
    h += "<div style=\"display:flex;gap:8px;flex-wrap:wrap\">"
      + "<div class=\"fld\" style=\"flex:1;min-width:140px\">"
      + "<label>목표 금액</label>"
      + "<input type=\"number\" id=\"ai-goal-amt\" placeholder=\"예: 500000000\" oninput=\"previewAmount(this.value)\">"
      + "<div id=\"amt-prev\" style=\"font-size:12px;color:var(--green);font-weight:600;margin-top:4px;min-height:18px\"></div>"
      + "<div style=\"display:flex;gap:4px;flex-wrap:wrap;margin-top:6px\">";

    ["1억", "3억", "5억", "10억", "20억", "50억"].forEach(function (lb) {
      var vals = { "1억": 1e8, "3억": 3e8, "5억": 5e8, "10억": 1e9, "20억": 2e9, "50억": 5e9 };
      h += "<button style=\"border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--t3);"
        + "padding:4px 10px;border-radius:7px;font-size:11px;cursor:pointer;font-family:inherit\" "
        + "onclick=\"document.getElementById(" + QUOTE + "ai-goal-amt" + QUOTE + ").value="
        + vals[lb] + ";previewAmount(" + vals[lb] + ")\">" + lb + "</button>";
    });

    h += "</div></div>"
      + "<div class=\"fld\" style=\"flex:1;min-width:140px\">"
      + "<label>목표 날짜 (선택)</label>"
      + "<input type=\"date\" id=\"ai-goal-date\"></div></div>";
    h += "<button class=\"btn btn-p\" style=\"margin-top:8px\" onclick=\"setGoal()\">🎯 목표 설정하기</button>";
  }

  h += "</div>";

  /* --- 자산 없으면 조기 종료 --- */
  if (!appState.assets.length) {
    h += "<div class=\"card\" style=\"text-align:center;padding:30px;color:var(--t4);font-size:13px\">자산을 먼저 추가해주세요</div>";
    el.innerHTML = h;
    return;
  }

  /* --- 포트폴리오 분석 카드 --- */
  h += "<div class=\"card\">"
    + "<div style=\"font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px\">📊 포트폴리오 분석</div>"
    + "<div style=\"font-size:11.5px;color:var(--t4);margin-bottom:14px\">자산 배분과 분산투자 수준을 진단합니다</div>";

  var activeCats = 0, hhi = 0;
  CATEGORY_LIST.forEach(function (c) {
    if (byC[c] > 0) {
      activeCats++;
      var w = byC[c] / total;
      hhi += w * w;
    }
  });

  var divScore = activeCats <= 1 ? 10 : activeCats === 2 ? 30 : hhi < 0.3 ? 90 : hhi < 0.45 ? 70 : hhi < 0.6 ? 50 : 30;
  var divLabel = divScore >= 80 ? "매우 우수" : divScore >= 60 ? "양호" : divScore >= 40 ? "보통" : "개선 필요";
  var divColor = divScore >= 60 ? "var(--green)" : divScore >= 40 ? "#FBBF24" : "var(--red)";

  h += "<div style=\"display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap\">"
    + "<div style=\"flex:1;min-width:120px;padding:12px;background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.08);border-radius:10px;text-align:center\">"
    + "<div style=\"font-size:10px;color:var(--t4)\">분산투자 점수</div>"
    + "<div style=\"font-size:24px;font-weight:800;color:" + divColor + "\">" + divScore + "<span style=\"font-size:12px\">/100</span></div>"
    + "<div style=\"font-size:11px;color:" + divColor + ";font-weight:600\">" + divLabel + "</div></div>";

  h += "<div style=\"flex:1;min-width:120px;padding:12px;background:rgba(139,92,246,.04);border:1px solid rgba(139,92,246,.08);border-radius:10px;text-align:center\">"
    + "<div style=\"font-size:10px;color:var(--t4)\">활용 카테고리</div>"
    + "<div style=\"font-size:24px;font-weight:800;color:var(--t1)\">" + activeCats + "<span style=\"font-size:12px\">/" + CATEGORY_LIST.length + "</span></div>"
    + "<div style=\"font-size:11px;color:var(--t4)\">" + appState.assets.length + "개 종목 보유</div></div></div>";

  h += "<div style=\"font-size:12.5px;font-weight:600;color:var(--t2);margin-bottom:8px\">카테고리별 비중</div>";

  CATEGORY_LIST.forEach(function (cat) {
    if (byC[cat] > 0) {
      var wp = (byC[cat] / total) * 100;
      var warn = wp > 60 ? "⚠️ 과다 집중" : "";
      h += "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:6px\">"
        + "<span style=\"font-size:11.5px;color:var(--t3);min-width:70px\">" + CATEGORY_CONFIG[cat].icon + " " + cat + "</span>"
        + "<div style=\"flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden\">"
        + "<div style=\"height:100%;width:" + wp + "%;background:" + CATEGORY_CONFIG[cat].color + ";border-radius:3px\"></div></div>"
        + "<span style=\"font-size:11px;color:var(--t2);font-weight:600;min-width:40px;text-align:right\">" + wp.toFixed(1) + "%</span>"
        + (warn ? "<span style=\"font-size:10px;color:var(--red)\">" + warn + "</span>" : "")
        + "</div>";
    }
  });

  if (items.length >= 2) {
    h += "<div style=\"font-size:12.5px;font-weight:600;color:var(--t2);margin:14px 0 8px\">상위 종목 집중도</div>";
    var top3 = items.slice(0, 3);
    top3.forEach(function (it, i) {
      var wp = total > 0 ? (it.eval / total) * 100 : 0;
      h += "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:5px\">"
        + "<span style=\"font-size:11px;color:var(--t4);min-width:18px\">" + (i + 1) + ".</span>"
        + "<span style=\"flex:1;font-size:11.5px;color:var(--t2)\">" + escapeHtml(it.name) + "</span>"
        + "<span style=\"font-size:11px;font-weight:600;color:var(--t1)\">" + wp.toFixed(1) + "%</span>"
        + (wp > 40 ? "<span style=\"font-size:10px;color:var(--red)\">⚠️</span>" : "")
        + "</div>";
    });
    var topPct = total > 0 ? (top3.reduce(function (s, x) { return s + x.eval; }, 0) / total) * 100 : 0;
    if (topPct > 70)
      h += "<div style=\"font-size:10.5px;color:var(--red);margin-top:4px\">⚠️ 상위 3개 종목이 전체의 " + topPct.toFixed(0) + "%를 차지합니다</div>";
  }

  h += "</div>";

  /* --- 리스크 진단 카드 --- */
  h += "<div class=\"card\">"
    + "<div style=\"font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px\">⚠️ 리스크 진단</div>"
    + "<div style=\"font-size:11.5px;color:var(--t4);margin-bottom:14px\">포트폴리오 위험 요소를 점검합니다</div>";

  var risks = [];
  var cashPct = total > 0 ? ((byC["현금"] + byC["예적금"]) / total) * 100 : 0;
  var coinPct = total > 0 ? (byC["코인"] / total) * 100 : 0;
  var stockPct = total > 0 ? ((byC["국내주식"] + byC["해외주식"]) / total) * 100 : 0;

  if (cashPct < 10 && total > 0)
    risks.push({
      lv: "warning", ic: "🛡️", t: "안전자산 비중 부족",
      d: "현금+예적금 비중이 " + cashPct.toFixed(1) + "%로 낮습니다. 최소 10~20%의 안전자산을 확보하면 급락장에서 심리적 안정과 추가 매수 기회를 얻을 수 있습니다."
    });

  if (coinPct > 30)
    risks.push({
      lv: "danger", ic: "🎢", t: "고변동성 자산 과다",
      d: "코인 비중이 " + coinPct.toFixed(1) + "%입니다. 변동성이 매우 높아 전체 포트폴리오 안정성을 해칠 수 있습니다. 20% 이내로 조절을 고려해보세요."
    });

  /* SECURITY FIX: escapeHtml applied to items[0].name */
  if (items.length > 0 && total > 0 && (items[0].eval / total) > 0.5)
    risks.push({
      lv: "danger", ic: "🎯", t: "단일 종목 집중 위험",
      d: "\"" + escapeHtml(items[0].name) + "\"이(가) 전체의 " + ((items[0].eval / total) * 100).toFixed(1) + "%를 차지합니다. 한 종목에 50% 이상 집중은 큰 리스크입니다."
    });

  if (activeCats <= 1 && appState.assets.length > 0)
    risks.push({
      lv: "danger", ic: "📦", t: "자산 유형 단일화",
      d: "모든 자산이 한 카테고리에 집중되어 있습니다. 다양한 자산군으로 분산하면 위험이 크게 줄어듭니다."
    });

  if (stockPct > 0 && byC["국내주식"] > 0 && byC["해외주식"] > 0) {
    var domRatio = byC["국내주식"] / (byC["국내주식"] + byC["해외주식"]) * 100;
    if (domRatio > 80)
      risks.push({
        lv: "info", ic: "🌍", t: "국내 편중 (Home Bias)",
        d: "주식 중 국내 비중이 " + domRatio.toFixed(0) + "%입니다. 해외 분산 투자로 지역 리스크를 줄여보세요."
      });
  } else if (stockPct > 0 && byC["해외주식"] === 0 && byC["국내주식"] > 0) {
    risks.push({
      lv: "info", ic: "🌍", t: "해외 투자 부재",
      d: "주식이 국내에만 집중되어 있습니다. 글로벌 분산 투자를 고려해보세요."
    });
  }

  var profitItems = items.filter(function (x) { return x.cost > 0 && x.profit !== 0; });
  var bigLoss = profitItems.filter(function (x) { return x.profitPct < -20; });

  /* SECURITY FIX: escapeHtml applied to bigLoss item names */
  if (bigLoss.length > 0)
    risks.push({
      lv: "warning", ic: "📉", t: "큰 폭 손실 종목 보유",
      d: bigLoss.map(function (x) { return escapeHtml(x.name) + "(" + x.profitPct + "%)"; }).join(", ")
        + "의 손실이 큽니다. 손절 또는 물타기 여부를 신중히 판단하세요."
    });

  if (risks.length === 0)
    risks.push({
      lv: "good", ic: "✅", t: "특별한 위험 요소 없음",
      d: "현재 포트폴리오에서 큰 리스크가 감지되지 않았습니다. 다만 정기적인 리밸런싱을 권장합니다."
    });

  risks.forEach(function (r) {
    var bg = r.lv === "danger" ? "rgba(239,68,68,.05)"
      : r.lv === "warning" ? "rgba(245,158,11,.05)"
      : r.lv === "good" ? "rgba(16,185,129,.05)"
      : "rgba(59,130,246,.05)";
    var bd = r.lv === "danger" ? "rgba(239,68,68,.12)"
      : r.lv === "warning" ? "rgba(245,158,11,.12)"
      : r.lv === "good" ? "rgba(16,185,129,.12)"
      : "rgba(59,130,246,.12)";
    h += "<div style=\"padding:12px;background:" + bg + ";border:1px solid " + bd + ";border-radius:10px;margin-bottom:8px\">"
      + "<div style=\"font-size:12.5px;font-weight:700;color:var(--t1);margin-bottom:3px\">" + r.ic + " " + r.t + "</div>"
      + "<div style=\"font-size:11.5px;color:var(--t3);line-height:1.6\">" + r.d + "</div></div>";
  });

  h += "</div>";

  /* --- 자산 증식 전략 카드 --- */
  h += "<div class=\"card\">"
    + "<div style=\"font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px\">💡 자산 증식 전략</div>"
    + "<div style=\"font-size:11.5px;color:var(--t4);margin-bottom:14px\">현재 상태에 맞는 실행 가능한 전략을 제안합니다</div>";

  var strats = [];

  if (cashPct > 40)
    strats.push({
      ic: "💰", t: "유휴 현금 활용",
      d: "현금 비중이 " + cashPct.toFixed(0) + "%로 높습니다. 일부를 ETF 적립식 투자, CMA, 또는 단기 채권형 펀드로 옮기면 인플레이션 방어와 수익을 동시에 노릴 수 있습니다."
    });

  if (activeCats <= 2)
    strats.push({
      ic: "🔀", t: "자산군 다각화",
      d: "현재 " + activeCats + "개 카테고리만 활용 중입니다. 주식(국내·해외), 예적금, 코인 등으로 분산하면 한 자산군의 하락이 전체에 미치는 영향을 줄일 수 있습니다."
    });

  if (total > 0 && !g)
    strats.push({
      ic: "🎯", t: "목표 설정 권장",
      d: "구체적인 금액 목표와 기한을 설정하면 매월 필요한 투자금을 계산하고 진행 상황을 추적할 수 있습니다. 위의 목표 설정 기능을 활용해보세요."
    });

  if (g && g.amount > total) {
    var rm = g.amount - total;
    var rates = [5, 7, 10];

    h += "<div style=\"font-size:12.5px;font-weight:600;color:var(--t2);margin-bottom:10px\">📈 월별 적립 시뮬레이션</div>"
      + "<div style=\"font-size:11px;color:var(--t4);margin-bottom:8px\">목표 " + formatShortCurrency(g.amount) + " 달성을 위한 예상 기간</div>";

    h += "<div style=\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px\">";

    [500000, 1000000, 2000000, 3000000].forEach(function (mp) {
      h += "<div style=\"flex:1;min-width:110px;padding:10px;background:rgba(255,255,255,.02);border:1px solid var(--bd);border-radius:9px;text-align:center\">"
        + "<div style=\"font-size:10px;color:var(--t4)\">월 " + formatShortCurrency(mp) + "</div>";

      rates.forEach(function (r) {
        var mr = r / 100 / 12;
        var months;
        if (mr > 0) {
          var x = (g.amount + mp / mr) / (total + mp / mr);
          if (x <= 1) months = 0;
          else months = Math.ceil(Math.log(x) / Math.log(1 + mr));
        } else {
          months = Math.ceil(rm / mp);
        }
        if (months > 600) months = 999;
        var yy = Math.floor(months / 12);
        var mm = months % 12;
        h += "<div style=\"font-size:11px;margin-top:3px\">"
          + "<span style=\"color:var(--t5)\">연 " + r + "%:</span> "
          + "<span style=\"color:var(--t1);font-weight:600\">"
          + (months >= 999 ? "50년+" : months === 0 ? "달성" : yy > 0 ? yy + "년 " + mm + "개월" : mm + "개월")
          + "</span></div>";
      });

      h += "</div>";
    });

    h += "</div>";

    strats.push({
      ic: "📊", t: "적립식 투자 활용",
      d: "매월 일정 금액을 정해진 날짜에 투자하는 DCA(Dollar Cost Averaging) 전략은 시장 타이밍 리스크를 줄여줍니다. 위 시뮬레이션을 참고하여 본인에게 맞는 월 적립 금액을 설정해보세요."
    });
  }

  if (coinPct > 20)
    strats.push({
      ic: "⚖️", t: "리밸런싱 고려",
      d: "코인 비중(" + coinPct.toFixed(0) + "%)이 높습니다. 수익 실현 후 안전자산이나 ETF로 분산하면 변동성을 줄이면서 수익을 보전할 수 있습니다."
    });

  /* SECURITY FIX: escapeHtml applied to winner names */
  if (profitItems.length > 0) {
    var winners = profitItems.filter(function (x) { return x.profitPct > 30; });
    if (winners.length > 0)
      strats.push({
        ic: "🏆", t: "수익 실현 검토",
        d: winners.map(function (x) { return escapeHtml(x.name) + "(+" + x.profitPct + "%)"; }).join(", ")
          + "이 큰 수익 구간입니다. 일부 차익 실현 후 재투자하면 리스크를 관리하면서 복리 효과를 극대화할 수 있습니다."
      });
  }

  if (strats.length === 0)
    strats.push({
      ic: "👍", t: "현재 잘 운용되고 있습니다",
      d: "포트폴리오가 균형 잡혀 있습니다. 현재 전략을 유지하면서 정기적으로 리밸런싱하고, 시장 상황에 따라 비중을 미세 조정하세요."
    });

  strats.forEach(function (s) {
    h += "<div style=\"padding:12px;background:rgba(255,255,255,.02);border:1px solid var(--bd);border-radius:10px;margin-bottom:8px\">"
      + "<div style=\"font-size:12.5px;font-weight:700;color:var(--t1);margin-bottom:3px\">" + s.ic + " " + s.t + "</div>"
      + "<div style=\"font-size:11.5px;color:var(--t3);line-height:1.6\">" + s.d + "</div></div>";
  });

  h += "</div>";

  /* --- AI 컨설턴트 카드 --- */
  h += "<div class=\"card\">"
    + "<div style=\"font-size:16px;font-weight:800;color:var(--t1);margin-bottom:4px\">🤖 AI 컨설턴트 "
    + "<span style=\"font-size:12px;font-weight:500;color:#60A5FA\">(Gemini 3 Flash)</span></div>"
    + "<div style=\"font-size:11.5px;color:var(--t4);margin-bottom:14px\">포트폴리오를 기반으로 AI에게 자유롭게 질문할 수 있습니다</div>";

  var gk = getGeminiApiKey();

  if (!gk) {
    h += "<div style=\"padding:16px;background:rgba(59,130,246,.04);border:1px solid rgba(59,130,246,.1);border-radius:12px\">"
      + "<div style=\"font-size:12.5px;font-weight:600;color:var(--t2);margin-bottom:8px\">🔑 Gemini API 키 설정</div>"
      + "<div style=\"font-size:11.5px;color:var(--t4);margin-bottom:10px\">Google AI Studio에서 발급받은 API 키를 입력하세요</div>"
      + "<div style=\"display:flex;gap:6px\">"
      + "<input id=\"gem-key\" type=\"password\" maxlength=\"60\" placeholder=\"AIzaSy...\" style=\"flex:1\" autocomplete=\"off\">"
      + "<button class=\"btn btn-p\" style=\"flex-shrink:0;padding:0 14px\" onclick=\"saveGeminiApiKey()\">저장</button>"
      + "</div>"
      + "<div class=\"ht\" style=\"margin-top:6px\">🔒 키는 브라우저 로컬에만 저장되며 Google AI 서버로만 전송됩니다</div></div>";
  } else {
    h += "<div style=\"display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px\">"
      + "<button class=\"btn btn-p\" style=\"font-size:12px\" onclick=\"askGemini('analyze')\" " + (isGeminiLoading ? "disabled" : "") + ">📊 포트폴리오 분석</button>"
      + "<button class=\"btn\" style=\"font-size:12px;background:rgba(139,92,246,.1);color:#A78BFA;border:1px solid rgba(139,92,246,.15)\" onclick=\"askGemini('strategy')\" " + (isGeminiLoading ? "disabled" : "") + ">💡 증식 전략</button>"
      + "<button class=\"btn\" style=\"font-size:12px;background:rgba(16,185,129,.1);color:var(--green);border:1px solid rgba(16,185,129,.15)\" onclick=\"askGemini('risk')\" " + (isGeminiLoading ? "disabled" : "") + ">⚠️ 리스크 진단</button>"
      + "<button class=\"btn\" style=\"font-size:12px;background:rgba(245,158,11,.1);color:#FBBF24;border:1px solid rgba(245,158,11,.15)\" onclick=\"askGemini('rebalance')\" " + (isGeminiLoading ? "disabled" : "") + ">⚖️ 리밸런싱</button></div>";

    h += "<div style=\"display:flex;gap:6px;margin-bottom:12px\">"
      + "<input id=\"gem-q\" maxlength=\"500\" placeholder=\"예: 월 200만원 투자하면 5억까지 얼마나 걸려?\" style=\"flex:1\" onkeydown=\"if(event.key==='Enter')askGemini('custom')\">"
      + "<button class=\"btn btn-p\" style=\"flex-shrink:0;padding:0 14px\" onclick=\"askGemini('custom')\" " + (isGeminiLoading ? "disabled" : "") + ">전송</button></div>";

    if (isGeminiLoading)
      h += "<div style=\"text-align:center;padding:30px\"><span class=\"spinner\"></span>"
        + "<div style=\"font-size:12px;color:var(--t4);margin-top:10px\">Gemini 3 Flash가 분석 중입니다...</div></div>";
    else if (geminiResult)
      h += "<div style=\"padding:16px;background:rgba(255,255,255,.02);border:1px solid var(--bd);border-radius:12px;line-height:1.75\">"
        + "<div style=\"font-size:11px;color:var(--t5);margin-bottom:8px\">🤖 Gemini 3 Flash 분석 결과</div>"
        + "<div style=\"font-size:13px;color:var(--t2);white-space:pre-wrap\">" + formatGeminiResponse(geminiResult) + "</div></div>";

    h += "<div style=\"margin-top:8px;text-align:right\">"
      + "<button style=\"background:none;border:none;color:var(--t5);font-size:10.5px;cursor:pointer;font-family:inherit\" onclick=\"clearGeminiApiKey()\">🔑 API 키 변경</button></div>";
  }

  h += "</div>";

  h += "<div style=\"padding:10px 14px;background:rgba(245,158,11,.04);border:1px solid rgba(245,158,11,.1);border-radius:10px;font-size:10.5px;color:var(--t4)\">"
    + "⚠️ 분석 결과는 참고용이며, 투자 판단은 본인의 책임입니다. 전문적인 투자 상담은 공인 재무설계사에게 문의하세요.</div>";

  el.innerHTML = h;
}

function setGoal() {
  var amt = Number((document.getElementById("ai-goal-amt") || {}).value);
  var dt = (document.getElementById("ai-goal-date") || {}).value || null;
  if (!amt || amt <= 0) return;
  appState.goal = { amount: amt, date: dt, setDate: getTodayString() };
  saveData();
  renderAI();
}

function previewAmount(v) {
  var el = document.getElementById("amt-prev");
  if (!el) return;
  var n = Number(v);
  if (!n || n <= 0) { el.textContent = ""; return; }
  el.textContent = "→ " + formatCurrency(n);
}

function getGeminiApiKey() {
  try {
    var k = localStorage.getItem("gem_api_key") || "";
    return /^[A-Za-z0-9_\-]{20,60}$/.test(k) ? k : "";
  } catch (e) {
    return "";
  }
}

function saveGeminiApiKey() {
  var k = ((document.getElementById("gem-key") || {}).value || "").trim();
  if (!k) return;
  if (!/^[A-Za-z0-9_\-]{20,60}$/.test(k)) {
    showToast("❌ API 키 형식이 올바르지 않습니다");
    return;
  }
  try { localStorage.setItem("gem_api_key", k); } catch (e) {}
  showToast("✅ API 키가 저장되었습니다");
  renderAI();
}

function clearGeminiApiKey() {
  try { localStorage.removeItem("gem_api_key"); } catch (e) {}
  geminiResult = null;
  showToast("🔑 API 키가 삭제되었습니다");
  renderAI();
}

function formatGeminiResponse(t) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong style=\"color:var(--t1)\">$1</strong>")
    .replace(/^### (.+)$/gm, "<div style=\"font-size:14px;font-weight:700;color:var(--t1);margin:12px 0 6px\">$1</div>")
    .replace(/^## (.+)$/gm, "<div style=\"font-size:15px;font-weight:800;color:var(--t1);margin:14px 0 6px\">$1</div>");
}

function buildPortfolioSummary() {
  var total = 0, byC = {}, its = [];

  CATEGORY_LIST.forEach(function (c) { byC[c] = 0; });

  appState.assets.forEach(function (a) {
    var v = getAssetValue(a);
    total += v;
    byC[a.category] += v;
    var c = calcAsset(a);
    its.push({
      name: a.name,
      category: a.category,
      eval: v,
      cost: c.totalCost,
      profit: c.profit,
      profitPct: c.profitPct
    });
  });

  var cs = [];
  for (var k in byC) {
    if (byC[k] > 0)
      cs.push(k + ": " + formatShortCurrency(byC[k]) + " (" + ((byC[k] / total) * 100).toFixed(1) + "%)");
  }

  var t = "총 자산: " + formatShortCurrency(total)
    + "\n카테고리별: " + cs.join(", ")
    + "\n종목 수: " + its.length + "개";

  its.forEach(function (x) {
    t += "\n- " + x.name + " (" + x.category + "): 평가 " + formatShortCurrency(x.eval)
      + (x.cost > 0 ? ", 투자 " + formatShortCurrency(x.cost) + ", 수익률 " + x.profitPct + "%" : "");
  });

  if (appState.goal)
    t += "\n목표: " + formatShortCurrency(appState.goal.amount)
      + (appState.goal.date ? " (" + appState.goal.date + " 까지)" : "");

  if (appState.history.length >= 2) {
    var h1 = appState.history[appState.history.length - 2];
    var h2 = appState.history[appState.history.length - 1];
    t += "\n전일 변동: " + formatShortCurrency(h2.total - h1.total);
  }

  if (appState.income.length > 0) {
    var now = new Date();
    var cm = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    var mInc = 0, mCats = {};

    appState.income.forEach(function (x) {
      if (x.date && x.date.slice(0, 7) === cm) {
        mInc += x.amount;
        var cn = x.cat || "etc";
        mCats[cn] = (mCats[cn] || 0) + x.amount;
      }
    });

    if (mInc > 0) {
      t += "\n이번달 수입: " + formatShortCurrency(mInc);
      var ic = [];
      for (var ik in mCats) {
        var catNm = INCOME_CATEGORIES.find(function (c) { return c.id === ik; });
        ic.push((catNm ? catNm.label : ik) + ": " + formatShortCurrency(mCats[ik]));
      }
      t += " (" + ic.join(", ") + ")";
    }
  }

  return t;
}

function askGemini(mode) {
  var q = "";
  if (mode === "custom") {
    q = ((document.getElementById("gem-q") || {}).value || "").trim();
    if (!q) return;
  }

  var gk = getGeminiApiKey();
  if (!gk) return;

  var port = buildPortfolioSummary();

  var sys = "당신은 한국어 개인 자산관리 AI 컨설턴트입니다. 사용자 포트폴리오를 기반으로 핵심만 간결하게 조언하세요. "
    + "불필요한 서론이나 인사 없이 바로 본론으로, 300자 이내로 답변하세요. **볼드**와 ### 헤딩을 적절히 사용하세요. "
    + "투자 권유가 아닌 정보 제공입니다.";

  var um = "";
  if (mode === "analyze")
    um = "다음 포트폴리오를 종합 분석해주세요. 자산 배분 평가, 분산투자 수준, 강점과 약점, 개선 방향을 구체적으로 알려주세요.\n\n" + port;
  else if (mode === "strategy")
    um = "다음 포트폴리오를 보고 자산을 효과적으로 불려나가기 위한 구체적 전략을 제안해주세요. 리밸런싱 방향, 추가 투자 종목/카테고리 추천, 월 적립 전략, 시장 상황 고려사항을 포함해주세요.\n\n" + port;
  else if (mode === "risk")
    um = "다음 포트폴리오의 리스크를 정밀 진단해주세요. 집중도 위험, 변동성, 방어 자산 부족, 시장/환율 리스크를 분석하고 구체적 완화 방안을 제안해주세요.\n\n" + port;
  else if (mode === "rebalance")
    um = "다음 포트폴리오의 최적 리밸런싱 방안을 제안해주세요. 각 카테고리의 목표 비중, 구체적으로 늘릴/줄일 부분, 실행 순서를 알려주세요.\n\n" + port;
  else
    um = "포트폴리오:\n" + port + "\n\n질문: " + q;

  isGeminiLoading = true;
  geminiResult = null;
  renderAI();

  fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" + gk, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: sys + "\n\n" + um }] }],
      generationConfig: { maxOutputTokens: 2048 }
    })
  })
  .then(function (r) { return r.json(); })
  .then(function (d) {
    isGeminiLoading = false;
    if (d && d.candidates && d.candidates[0] && d.candidates[0].content) {
      geminiResult = d.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("\n");
      if (d.candidates[0].finishReason === "MAX_TOKENS")
        geminiResult += "\n\n⚠️ 응답이 길어서 일부가 잘렸습니다. 더 구체적인 질문으로 다시 시도해보세요.";
    } else if (d && d.error) {
      geminiResult = "❌ 오류: " + ((d.error.message || "알 수 없는 오류").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    } else {
      geminiResult = "응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.";
    }
    renderAI();
  })
  .catch(function (e) {
    isGeminiLoading = false;
    geminiResult = "❌ 네트워크 오류: " + (e.message || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    renderAI();
  });
}
