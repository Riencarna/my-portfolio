/* =============================================
   My Portfolio v5.28.0 — Monthly Report UI
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
  const incomeItems = appState.income.filter(i => i && i.date && i.date.startsWith(monthPrefix));
  const incomeTotal = incomeItems.reduce((s, i) => s + safeNum(i.amount), 0);

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

  return {
    year, month, monthStr,
    startTotal, endTotal, change, changePct,
    catChanges, topGain, topLoss,
    incomeTotal, incomeCount: incomeItems.length,
    buyTotal, sellTotal, buyCount, sellCount,
    trendData,
    hasData: !!(startSnap || endSnap || incomeItems.length > 0 || (buyCount + sellCount) > 0),
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
  return `
    <div class="card card-report-notice" role="alert">
      <div class="report-notice-text">
        <div class="report-notice-title">📊 ${escHtml(r.monthStr)} 리포트가 도착했어요</div>
        <div class="report-notice-sub ${cls}">${sign}${escHtml(fmtKRW(r.change))}${r.startTotal > 0 ? ` (${escHtml(fmtPct(r.changePct))})` : ''}</div>
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
