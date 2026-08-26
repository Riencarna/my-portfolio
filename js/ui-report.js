/* =============================================
   My Portfolio v5.39.0 — Monthly Report UI
   ============================================= */

const MONTHLY_REPORT_DISMISS_KEY = 'mp_monthly_report_dismissed';

function _monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function _prevMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

// 월의 시작 시점(1일 직전 또는 그 달 첫 날) 가장 가까운 스냅샷
function _firstSnapInOrBefore(year, month) {
  const monthStart = `${_monthKey(year, month)}-01`;
  const hist = appState.history;
  let candidate = null;
  for (const h of hist) {
    if (!h || !h.date) continue;
    if (h.date <= monthStart) candidate = h;
    else break;
  }
  return candidate;
}

function _lastSnapInMonth(year, month) {
  const prefix = _monthKey(year, month);
  const hist = appState.history;
  let last = null;
  for (const h of hist) {
    if (h && h.date && h.date.startsWith(prefix)) last = h;
  }
  return last;
}

function _snapsInMonth(year, month) {
  const prefix = _monthKey(year, month);
  return appState.history.filter(h => h && h.date && h.date.startsWith(prefix));
}

function _sumSnapshotCategories(snap, cats) {
  const byCategory = snap?.byCategory || {};
  return cats.reduce((sum, cat) => sum + safeNum(byCategory[cat]), 0);
}

function _buildMonthlyInvestmentReport(year, month, startSnap, endSnap) {
  const monthPrefix = _monthKey(year, month);
  const startByAsset = startSnap?.byAsset || {};
  const endByAsset = endSnap?.byAsset || {};
  const startValue = _sumSnapshotCategories(startSnap, INVESTMENT_CATS);
  const endValue = _sumSnapshotCategories(endSnap, INVESTMENT_CATS);
  const catMap = new Map(INVESTMENT_CATS.map(cat => [cat, {
    cat,
    start: safeNum(startSnap?.byCategory?.[cat]),
    end: safeNum(endSnap?.byCategory?.[cat]),
    buy: 0,
    sell: 0,
    buyCount: 0,
    sellCount: 0,
  }]));
  const assetRows = [];

  for (const asset of appState.assets) {
    if (!INVESTMENT_CATS.includes(asset.category)) continue;
    const start = safeNum(startByAsset[asset.id]);
    const end = safeNum(endByAsset[asset.id]);
    let buy = 0, sell = 0, buyCount = 0, sellCount = 0;

    for (const t of (asset.txns || [])) {
      if (!t.date || !t.date.startsWith(monthPrefix)) continue;
      const value = safeNum(t.price) * safeNum(t.qty);
      if (t.type === 'buy') { buy += value; buyCount++; }
      else if (t.type === 'sell') { sell += value; sellCount++; }
    }

    const bucket = catMap.get(asset.category);
    if (bucket) {
      bucket.buy += buy;
      bucket.sell += sell;
      bucket.buyCount += buyCount;
      bucket.sellCount += sellCount;
    }

    if (start > 0 || end > 0 || buy > 0 || sell > 0) {
      const netFlow = buy - sell;
      const profit = end - start - netFlow;
      const base = start + buy;
      assetRows.push({
        id: asset.id,
        name: asset.name,
        category: asset.category,
        start,
        end,
        buy,
        sell,
        netFlow,
        profit,
        returnPct: base > 0 ? (profit / base) * 100 : 0,
      });
    }
  }

  const catRows = [...catMap.values()].map(row => {
    const netFlow = row.buy - row.sell;
    const profit = row.end - row.start - netFlow;
    const base = row.start + row.buy;
    return {
      ...row,
      netFlow,
      profit,
      returnPct: base > 0 ? (profit / base) * 100 : 0,
    };
  }).filter(row => row.start > 0 || row.end > 0 || row.buy > 0 || row.sell > 0);

  const buyTotal = catRows.reduce((sum, row) => sum + safeNum(row.buy), 0);
  const sellTotal = catRows.reduce((sum, row) => sum + safeNum(row.sell), 0);
  const buyCount = catRows.reduce((sum, row) => sum + safeNum(row.buyCount), 0);
  const sellCount = catRows.reduce((sum, row) => sum + safeNum(row.sellCount), 0);
  const netFlow = buyTotal - sellTotal;
  const profit = endValue - startValue - netFlow;
  const capitalBase = startValue + buyTotal;
  const sortedAssets = assetRows.slice().sort((a, b) => b.profit - a.profit);

  return {
    startValue,
    endValue,
    buyTotal,
    sellTotal,
    buyCount,
    sellCount,
    netFlow,
    profit,
    returnPct: capitalBase > 0 ? (profit / capitalBase) * 100 : 0,
    capitalBase,
    catRows,
    topGain: sortedAssets.filter(a => a.profit > 0).slice(0, 3),
    topLoss: sortedAssets.filter(a => a.profit < 0).slice(-3).reverse(),
    hasData: !!endSnap && (startValue > 0 || endValue > 0 || buyTotal > 0 || sellTotal > 0),
  };
}

function getAvailableReportMonths() {
  const months = new Set();
  for (const h of appState.history) {
    if (h && h.date) months.add(h.date.slice(0, 7));
  }
  for (const i of appState.income) {
    if (i && i.date) months.add(i.date.slice(0, 7));
  }
  for (const a of appState.assets) {
    for (const t of (a.txns || [])) {
      if (t && t.date) months.add(t.date.slice(0, 7));
    }
  }
  // 현재 월은 제외 (아직 진행 중이라 의미 있는 요약 안 됨)
  const todayMonth = today().slice(0, 7);
  months.delete(todayMonth);
  return [...months].sort().reverse();
}

function buildMonthlyReport(year, month) {
  const monthStr = `${year}년 ${month}월`;
  const startSnap = _firstSnapInOrBefore(year, month);
  const endSnap = _lastSnapInMonth(year, month);
  const monthSnaps = _snapsInMonth(year, month);

  const startTotal = startSnap ? safeNum(startSnap.total) : 0;
  const endTotal = endSnap ? safeNum(endSnap.total) : startTotal;
  const change = endTotal - startTotal;
  const changePct = startTotal > 0 ? (change / startTotal) * 100 : 0;

  const startByCat = startSnap?.byCategory || {};
  const endByCat = endSnap?.byCategory || startByCat;
  const catChanges = CAT_IDS.map(cat => {
    const s = safeNum(startByCat[cat]);
    const e = safeNum(endByCat[cat]);
    return { cat, start: s, end: e, change: e - s, pct: s > 0 ? ((e - s) / s) * 100 : 0 };
  }).filter(c => c.start > 0 || c.end > 0);

  const startByAsset = startSnap?.byAsset || {};
  const endByAsset = endSnap?.byAsset || {};
  const assetChanges = appState.assets.map(a => {
    const s = safeNum(startByAsset[a.id]);
    const e = safeNum(endByAsset[a.id]);
    return {
      id: a.id, name: a.name, category: a.category,
      start: s, end: e, change: e - s,
      pct: s > 0 ? ((e - s) / s) * 100 : 0,
    };
  }).filter(c => c.start > 0 || c.end > 0);

  const sortedByChange = [...assetChanges].sort((a, b) => b.change - a.change);
  const topGain = sortedByChange.filter(a => a.change > 0).slice(0, 3);
  const topLoss = sortedByChange.filter(a => a.change < 0).slice(-3).reverse();

  const monthPrefix = _monthKey(year, month);
  const ledgerItems = appState.income.filter(i => i && i.date && i.date.startsWith(monthPrefix));
  const incomeItems = ledgerItems.filter(i => getBookType(i) === 'income');
  const expenseItems = ledgerItems.filter(i => getBookType(i) === 'expense');
  const incomeTotal = incomeItems.reduce((s, i) => s + safeNum(i.amount), 0);
  const expenseTotal = expenseItems.reduce((s, i) => s + safeNum(i.amount), 0);
  const netCashFlow = incomeTotal - expenseTotal;

  let buyTotal = 0, sellTotal = 0, buyCount = 0, sellCount = 0;
  for (const a of appState.assets) {
    for (const t of (a.txns || [])) {
      if (!t.date || !t.date.startsWith(monthPrefix)) continue;
      const value = safeNum(t.price) * safeNum(t.qty);
      if (t.type === 'buy') { buyTotal += value; buyCount++; }
      else if (t.type === 'sell') { sellTotal += value; sellCount++; }
    }
  }

  const trendData = monthSnaps.map(s => ({ date: s.date, total: safeNum(s.total) }));
  const investment = _buildMonthlyInvestmentReport(year, month, startSnap, endSnap);

  return {
    year, month, monthStr,
    startTotal, endTotal, change, changePct,
    catChanges, topGain, topLoss,
    incomeTotal, incomeCount: incomeItems.length,
    expenseTotal, expenseCount: expenseItems.length,
    netCashFlow, ledgerCount: ledgerItems.length,
    buyTotal, sellTotal, buyCount, sellCount,
    trendData,
    investment,
    hasData: !!(startSnap || endSnap || ledgerItems.length > 0 || (buyCount + sellCount) > 0 || investment.hasData),
  };
}

let _reportSelectedMonth = null;

function openMonthlyReport(monthKey = null) {
  _modalCleanup.removeAll();

  const available = getAvailableReportMonths();
  if (available.length === 0) {
    showToast('아직 리포트로 볼 수 있는 데이터가 없어요', 'info');
    return;
  }
  _reportSelectedMonth = monthKey && available.includes(monthKey) ? monthKey : available[0];
  _renderMonthlyReportModal();
}

function _renderMonthlyReportModal() {
  const available = getAvailableReportMonths();
  const [yearStr, monthStr] = _reportSelectedMonth.split('-');
  const report = buildMonthlyReport(Number(yearStr), Number(monthStr));

  const container = $('#modalMain');
  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box modal-box-wide">
      <div class="modal-header">
        <h3>📊 월간 리포트</h3>
        <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="reportMonthSelect">조회 월</label>
          <select id="reportMonthSelect" data-action="change-report-month" aria-label="월 선택">
            ${available.map(m => {
              const [y, mo] = m.split('-');
              const sel = m === _reportSelectedMonth ? 'selected' : '';
              return `<option value="${m}" ${sel}>${y}년 ${Number(mo)}월</option>`;
            }).join('')}
          </select>
        </div>
        ${_renderMonthlyReportBody(report)}
        <div class="modal-actions">
          <button class="btn-p" data-action="close-modal" data-modal="modalMain">닫기</button>
        </div>
      </div>
    </div>
  `;
  openModal('modalMain');
  _setupMonthlyReportDelegation(container);
  if (report.trendData.length >= 2) {
    runWhenIdle(() => _renderReportTrendChart(report));
  }
}

function _renderMonthlyReportBody(r) {
  if (!r.hasData) {
    return '<div class="empty-state">이 달에는 기록된 데이터가 없습니다</div>';
  }
  const changeCls = profitClass(r.change);
  const sign = r.change >= 0 ? '+' : '';
  return `
    <div class="report-section">
      <div class="report-section-title">${escHtml(r.monthStr)} 요약</div>
      <div class="report-summary-grid">
        <div class="report-summary-card">
          <div class="report-summary-label">월초 자산</div>
          <div class="report-summary-value">${escHtml(fmtKRW(r.startTotal))}</div>
        </div>
        <div class="report-summary-card">
          <div class="report-summary-label">월말 자산</div>
          <div class="report-summary-value">${escHtml(fmtKRW(r.endTotal))}</div>
        </div>
        <div class="report-summary-card report-summary-change ${changeCls}">
          <div class="report-summary-label">변동</div>
          <div class="report-summary-value">${sign}${escHtml(fmtKRW(r.change))}</div>
          ${r.startTotal > 0 ? `<div class="report-summary-pct">${escHtml(fmtPct(r.changePct))}</div>` : ''}
        </div>
      </div>
    </div>

    ${_renderInvestmentReportSection(r.investment)}

    ${r.trendData.length >= 2 ? `
      <div class="report-section">
        <div class="report-section-title">자산 변동 추이</div>
        <div class="chart-wrap chart-wrap-220" role="img" aria-label="월간 자산 추이 차트">
          <canvas id="chartReportTrend"></canvas>
        </div>
      </div>
    ` : ''}

    ${r.catChanges.length > 0 ? `
      <div class="report-section">
        <div class="report-section-title">카테고리별 변화</div>
        <div class="report-cat-list">
          ${r.catChanges.map(c => {
            const cat = CAT_MAP[c.cat] || { icon: '📦', label: c.cat };
            const cls = profitClass(c.change);
            const csign = c.change >= 0 ? '+' : '';
            return `
              <div class="report-cat-row">
                <div class="report-cat-name"><span aria-hidden="true">${cat.icon}</span> ${escHtml(cat.label)}</div>
                <div class="report-cat-vals">
                  <span class="report-cat-end">${escHtml(fmtKRW(c.end))}</span>
                  <span class="report-cat-change ${cls}">${csign}${escHtml(fmtKRW(c.change))}${c.start > 0 ? ` (${escHtml(fmtPct(c.pct))})` : ''}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    ${(r.topGain.length > 0 || r.topLoss.length > 0) ? `
      <div class="report-section">
        <div class="report-section-title">최고/최저 변동 자산</div>
        <div class="report-top-grid">
          <div class="report-top-card report-top-gain">
            <div class="report-top-title">📈 가장 많이 증가</div>
            ${r.topGain.length === 0 ? '<div class="report-top-empty">증가한 자산이 없습니다</div>' :
              r.topGain.map(a => `
                <div class="report-top-row">
                  <div class="report-top-name">${escHtml(a.name)}</div>
                  <div class="report-top-val positive">+${escHtml(fmtKRW(a.change))}</div>
                </div>
              `).join('')}
          </div>
          <div class="report-top-card report-top-loss">
            <div class="report-top-title">📉 가장 많이 감소</div>
            ${r.topLoss.length === 0 ? '<div class="report-top-empty">감소한 자산이 없습니다</div>' :
              r.topLoss.map(a => `
                <div class="report-top-row">
                  <div class="report-top-name">${escHtml(a.name)}</div>
                  <div class="report-top-val negative">${escHtml(fmtKRW(a.change))}</div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    <div class="report-section">
      <div class="report-section-title">이번 달 흐름</div>
      <div class="report-flow-grid">
        <div class="report-flow-card">
          <div class="report-flow-label">수입</div>
          <div class="report-flow-value positive">${escHtml(fmtKRW(r.incomeTotal))}</div>
          <div class="report-flow-sub">${r.incomeCount}건</div>
        </div>
        <div class="report-flow-card">
          <div class="report-flow-label">지출</div>
          <div class="report-flow-value negative">${escHtml(fmtKRW(r.expenseTotal))}</div>
          <div class="report-flow-sub">${r.expenseCount}건</div>
        </div>
        <div class="report-flow-card">
          <div class="report-flow-label">순흐름</div>
          <div class="report-flow-value ${profitClass(r.netCashFlow)}">${r.netCashFlow >= 0 ? '+' : ''}${escHtml(fmtKRW(r.netCashFlow))}</div>
          <div class="report-flow-sub">가계부 ${r.ledgerCount}건</div>
        </div>
        <div class="report-flow-card">
          <div class="report-flow-label">매수</div>
          <div class="report-flow-value">${escHtml(fmtKRW(r.buyTotal))}</div>
          <div class="report-flow-sub">${r.buyCount}건</div>
        </div>
        <div class="report-flow-card">
          <div class="report-flow-label">매도</div>
          <div class="report-flow-value">${escHtml(fmtKRW(r.sellTotal))}</div>
          <div class="report-flow-sub">${r.sellCount}건</div>
        </div>
      </div>
    </div>
  `;
}

function _renderInvestmentReportSection(inv) {
  if (!inv || !inv.hasData) return '';
  const profitCls = profitClass(inv.profit);
  const profitSign = inv.profit >= 0 ? '+' : '';
  const flowLabel = inv.netFlow >= 0 ? '순매수' : '순매도';
  const flowCls = inv.netFlow >= 0 ? 'positive' : 'negative';
  const flowAmount = fmtKRW(Math.abs(inv.netFlow));
  const renderAssetRows = (rows, emptyText) => rows.length === 0
    ? `<div class="report-top-empty">${emptyText}</div>`
    : rows.map(a => {
      const cls = profitClass(a.profit);
      const sign = a.profit >= 0 ? '+' : '';
      return `
        <div class="report-top-row">
          <div class="report-top-name">${escHtml(a.name)}</div>
          <div class="report-top-val ${cls}">
            ${sign}${escHtml(fmtKRW(a.profit))}
            <span class="report-top-pct">${escHtml(fmtPct(a.returnPct))}</span>
          </div>
        </div>
      `;
    }).join('');

  return `
    <div class="report-section report-invest-section">
      <div class="report-section-title">투자 수익 리포트</div>
      <div class="report-summary-grid report-invest-summary">
        <div class="report-summary-card">
          <div class="report-summary-label">월초 투자자산</div>
          <div class="report-summary-value">${escHtml(fmtKRW(inv.startValue))}</div>
        </div>
        <div class="report-summary-card">
          <div class="report-summary-label">월말 투자자산</div>
          <div class="report-summary-value">${escHtml(fmtKRW(inv.endValue))}</div>
        </div>
        <div class="report-summary-card report-summary-flow ${flowCls}">
          <div class="report-summary-label">${flowLabel}</div>
          <div class="report-summary-value">${escHtml(flowAmount)}</div>
          <div class="report-summary-pct">매수 ${inv.buyCount}건 · 매도 ${inv.sellCount}건</div>
        </div>
        <div class="report-summary-card report-summary-change ${profitCls}">
          <div class="report-summary-label">월간 수익금</div>
          <div class="report-summary-value">${profitSign}${escHtml(fmtKRW(inv.profit))}</div>
          <div class="report-summary-pct">수익률 ${escHtml(fmtPct(inv.returnPct))}</div>
        </div>
      </div>
      <div class="report-invest-note">수익금은 월말 투자 평가액 - 월초 투자 평가액 - 순매수로 계산합니다.</div>

      ${inv.catRows.length > 0 ? `
        <div class="report-cat-list report-invest-cat-list">
          ${inv.catRows.map(c => {
            const cat = CAT_MAP[c.cat] || { icon: '📦', label: c.cat };
            const cls = profitClass(c.profit);
            const sign = c.profit >= 0 ? '+' : '';
            return `
              <div class="report-cat-row">
                <div class="report-cat-name"><span aria-hidden="true">${cat.icon}</span> ${escHtml(cat.label)}</div>
                <div class="report-cat-vals">
                  <span class="report-cat-end">${escHtml(fmtKRW(c.end))}</span>
                  <span class="report-cat-change ${cls}">${sign}${escHtml(fmtKRW(c.profit))} (${escHtml(fmtPct(c.returnPct))})</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      ${(inv.topGain.length > 0 || inv.topLoss.length > 0) ? `
        <div class="report-top-grid report-invest-top-grid">
          <div class="report-top-card report-top-gain">
            <div class="report-top-title">투자 수익 상위</div>
            ${renderAssetRows(inv.topGain, '수익이 난 투자 자산이 없습니다')}
          </div>
          <div class="report-top-card report-top-loss">
            <div class="report-top-title">투자 손실 상위</div>
            ${renderAssetRows(inv.topLoss, '손실이 난 투자 자산이 없습니다')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function _setupMonthlyReportDelegation(container) {
  const clickHandler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'close-modal') closeModal(target.dataset.modal || 'modalMain');
  };
  const changeHandler = (e) => {
    const target = e.target.closest('[data-action="change-report-month"]');
    if (!target) return;
    _reportSelectedMonth = target.value;
    _renderMonthlyReportModal();
  };
  _modalCleanup.add(container, 'click', clickHandler);
  _modalCleanup.add(container, 'change', changeHandler);
}

function _renderReportTrendChart(report) {
  destroyChart('reportTrend');
  const canvas = document.getElementById('chartReportTrend');
  if (!canvas) return;
  const labels = report.trendData.map(d => fmtDate(d.date).slice(5));
  const data = report.trendData.map(d => d.total);
  const primary = getThemeColor('--primary') || '#7C6FF0';
  const gradient = makeGradient(canvas, primary, 0.3);
  charts.reportTrend = renderLineChart('chartReportTrend', labels, [{
    label: '총 자산', data,
    borderColor: primary, backgroundColor: gradient, fill: true,
  }]);
}

function shouldShowMonthlyReportCard() {
  const now = new Date();
  const day = now.getDate();
  if (day < 1 || day > 7) return false;

  const prev = _prevMonth(now.getFullYear(), now.getMonth() + 1);
  const monthKey = _monthKey(prev.year, prev.month);

  let dismissed = '';
  try { dismissed = localStorage.getItem(MONTHLY_REPORT_DISMISS_KEY) || ''; }
  catch (e) { dismissed = ''; }
  if (dismissed === monthKey) return false;

  const report = buildMonthlyReport(prev.year, prev.month);
  return report.hasData;
}

function renderMonthlyReportCard() {
  if (!shouldShowMonthlyReportCard()) return '';
  const now = new Date();
  const prev = _prevMonth(now.getFullYear(), now.getMonth() + 1);
  const r = buildMonthlyReport(prev.year, prev.month);
  const monthKey = _monthKey(prev.year, prev.month);
  const cls = profitClass(r.change);
  const sign = r.change >= 0 ? '+' : '';
  const inv = r.investment;
  const invLine = inv && inv.hasData
    ? `<div class="report-notice-sub report-notice-invest ${profitClass(inv.profit)}">투자 ${inv.profit >= 0 ? '+' : ''}${escHtml(fmtKRW(inv.profit))} (${escHtml(fmtPct(inv.returnPct))})</div>`
    : '';
  return `
    <div class="card card-report-notice" role="alert">
      <div class="report-notice-text">
        <div class="report-notice-title">📊 ${escHtml(r.monthStr)} 리포트가 도착했어요</div>
        <div class="report-notice-sub ${cls}">순자산 ${sign}${escHtml(fmtKRW(r.change))}${r.startTotal > 0 ? ` (${escHtml(fmtPct(r.changePct))})` : ''}</div>
        ${invLine}
      </div>
      <div class="report-notice-actions">
        <button class="btn-p" data-action="open-monthly-report" data-month="${monthKey}">자세히 보기</button>
        <button class="btn-icon" data-action="dismiss-monthly-report" data-month="${monthKey}" aria-label="닫기">✕</button>
      </div>
    </div>
  `;
}

function dismissMonthlyReportCard(monthKey) {
  try { localStorage.setItem(MONTHLY_REPORT_DISMISS_KEY, monthKey); }
  catch (e) { /* ignore */ }
  renderDashboard();
}
