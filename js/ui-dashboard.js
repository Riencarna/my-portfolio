/* =============================================
   My Portfolio v5.3.0 — Dashboard UI
   Soft Neutral: hero + stats + charts + breakdown
   Planner-Creator-Evaluator Cycle 3
   ============================================= */

let _dashRenderKey = '';

function renderDashboard() {
  const container = $('#pgDash');
  if (!container) return;

  const total = calcTotal(appState.assets);
  const catTotals = calcCategoryTotals(appState.assets);
  const prevTotal = getPreviousTotal();
  const change = total - prevTotal;
  const changePct = prevTotal > 0 ? (change / prevTotal) * 100 : 0;
  const assetCount = appState.assets.length;
  const hasAssets = assetCount > 0;

  const key = `${assetCount}_${total}_${appState.saved}_${Object.values(UIState.dashboardCategoryOpen).join('')}`;
  if (_dashRenderKey === key && container.innerHTML !== '') return;
  _dashRenderKey = key;

  container.innerHTML = hasAssets ? `
    <section class="dash-hero stagger-item" style="--i:0" role="region" aria-label="총 자산 현황">
      <div class="dash-hero-label">총 자산</div>
      <div class="dash-hero-value" id="totalValue">${escHtml(fmtKRW(total))}</div>
      <div class="dash-hero-change ${profitClass(change)}" aria-label="일일 변동">
        ${change !== 0 ? `${change > 0 ? '▲' : '▼'} ${escHtml(fmtKRW(Math.abs(change)))} (${escHtml(fmtPct(changePct))})` : '변동 없음'}
      </div>
      ${appState.saved ? `<div class="dash-hero-saved">마지막 저장: ${escHtml(fmtRelTime(appState.saved))}</div>` : ''}
    </section>

    <section class="dash-stats" role="region" aria-label="요약 지표">
      <div class="stat-card stagger-item" style="--i:1">
        <div class="stat-label">보유 자산</div>
        <div class="stat-value">${assetCount}개</div>
        <div class="stat-sub">${appState.categoryOrder.filter(c => catTotals[c] > 0).length}개 카테고리</div>
      </div>
      ${cachedRate ? `
        <div class="stat-card stagger-item" style="--i:2">
          <div class="stat-label">USD/KRW 환율</div>
          <div class="stat-value">${escHtml(fmtNum(cachedRate.rate, 2))}</div>
          <div class="stat-sub">${escHtml(cachedRate.source)} · ${escHtml(fmtRelTime(new Date(cachedRate.time).toISOString()))}</div>
        </div>
      ` : ''}
      ${cachedUsdt ? `
        <div class="stat-card stagger-item" style="--i:${cachedRate ? 3 : 2}">
          <div class="stat-label">USDT</div>
          <div class="stat-value">${escHtml(fmtNum(cachedUsdt.rate, 0))}원</div>
          <div class="stat-sub">${escHtml(cachedUsdt.source)}</div>
        </div>
      ` : ''}
      ${appState.history.length >= 2 ? `
        <div class="stat-card stagger-item" style="--i:${(cachedRate ? 1 : 0) + (cachedUsdt ? 1 : 0) + 2}">
          <div class="stat-label">기록 일수</div>
          <div class="stat-value">${appState.history.length}일</div>
          <div class="stat-sub">최초: ${escHtml(fmtDate(appState.history[0]?.date))}</div>
        </div>
      ` : ''}
    </section>

    ${renderBackupReminder()}

    <section class="dash-charts" role="region" aria-label="차트">
      <div class="card stagger-item" style="--i:3">
        <div class="card-title">자산 분포</div>
        <div class="chart-wrap chart-wrap-220" role="img" aria-label="자산 분포 차트">
          <canvas id="chartPie"></canvas>
        </div>
        <div id="chartPieAlt"></div>
        ${renderPieLegend(catTotals, total)}
      </div>
      <div class="card stagger-item" style="--i:4">
        <div class="card-title">
          <span>자산 추이</span>
          <div class="btn-group" id="trendBtns" role="group" aria-label="기간 선택">
            <button class="btn-sm ${UIState.dashboardTrendDays === 30 ? 'active' : ''}" data-action="trend" data-days="30" aria-pressed="${UIState.dashboardTrendDays === 30}">30일</button>
            <button class="btn-sm ${UIState.dashboardTrendDays === 90 ? 'active' : ''}" data-action="trend" data-days="90" aria-pressed="${UIState.dashboardTrendDays === 90}">90일</button>
            <button class="btn-sm ${UIState.dashboardTrendDays === 0 ? 'active' : ''}" data-action="trend" data-days="0" aria-pressed="${UIState.dashboardTrendDays === 0}">전체</button>
          </div>
        </div>
        <div class="chart-wrap chart-wrap-220" role="img" aria-label="자산 추이 차트">
          <canvas id="chartTrend"></canvas>
        </div>
        <div id="chartTrendAlt"></div>
      </div>
    </section>

    ${renderAutoUpdateSection()}
    ${renderCategoryBreakdown(catTotals, total)}
  ` : `${renderOnboarding()}`;

  if (hasAssets) {
    requestAnimationFrame(() => {
      destroyChart('pie');
      destroyChart('trend');
      renderPortfolioPie();
      renderTrendChart(UIState.dashboardTrendDays);
    });
  }

  _setupDashboardDelegation(container);
}

function _setupDashboardDelegation(container) {
  container.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    _handleDashAction(target);
  };
  container.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    _handleDashAction(target);
  };
}

function _handleDashAction(target) {
  const action = target.dataset.action;
  if (action === 'trend') _handleTrendClick(Number(target.dataset.days), target);
  else if (action === 'auto-update') startAutoUpdate();
  else if (action === 'toggle-dash-cat') { const catId = target.dataset.cat; if (catId) toggleDashCat(catId); }
  else if (action === 'open-asset-detail') { const id = target.dataset.id; if (id) openAssetDetail(id); }
  else if (action === 'go-tab') { const tab = target.dataset.tab; if (tab) goTab(tab); }
}

function _handleTrendClick(days, btn) {
  UIState.dashboardTrendDays = days;
  $$('#trendBtns .btn-sm').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
  renderTrendChart(days);
}

function getPreviousTotal() {
  const hist = appState.history;
  if (hist.length < 2) return calcTotal(appState.assets);
  return hist[hist.length - 2]?.total || 0;
}

function renderBackupReminder() {
  if (!appState.saved) return '';
  const daysSince = Math.floor((Date.now() - new Date(appState.saved).getTime()) / 86400000);
  if (daysSince < 7) return '';
  return `
    <div class="card card-warn stagger-item" style="--i:2" role="alert">
      <span>💾 마지막 백업이 ${daysSince}일 전입니다.</span>
      <button class="btn-sm btn-accent" data-action="go-tab" data-tab="pgHist" aria-label="백업 페이지로 이동">백업하기</button>
    </div>
  `;
}

function renderAutoUpdateSection() {
  return `
    <div class="card stagger-item" style="--i:5" role="region" aria-label="가격 업데이트">
      <div class="card-title">
        가격 업데이트
        <button class="btn-p" id="btnAutoUpdate" data-action="auto-update"
          aria-label="전체 가격 업데이트" ${autoUpdateProgress.running ? 'disabled' : ''}>
          ${autoUpdateProgress.running ? '업데이트 중...' : '🔄 전체 업데이트'}
        </button>
      </div>
      <div id="updateProgressWrap" class="${autoUpdateProgress.running ? 'visible' : 'hidden'}"
        role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
        ${autoUpdateProgress.running ? 'aria-busy="true"' : ''}>
        <div class="progress-bar">
          <div class="progress-fill" id="updateProgressBar"></div>
        </div>
        <div class="progress-text" id="updateProgressText" aria-live="polite">준비 중...</div>
      </div>
      <div id="updateLogs" class="update-logs" aria-label="업데이트 로그">
        ${updateLogs.slice(-10).map(l => `
          <div class="log-item ${l.ok ? 'log-ok' : 'log-fail'}" role="listitem">
            <span>${escHtml(l.name)}</span>
            <span>${l.ok ? (l.price ? escHtml(fmtPrice(l.price)) : '✓') : '✗ 실패'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function startAutoUpdate() {
  const btn = $('#btnAutoUpdate') || $('#btnAutoUpdateHeader');
  if (btn) btn.disabled = true;
  const wrap = $('#updateProgressWrap');
  if (wrap) { wrap.classList.remove('hidden'); wrap.classList.add('visible'); wrap.setAttribute('aria-busy', 'true'); }

  const summary = await autoUpdateAll(prog => {
    const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
    const bar = $('#updateProgressBar');
    const text = $('#updateProgressText');
    const progressWrap = $('#updateProgressWrap');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = `${prog.done}/${prog.total} 완료 (${pct}%)`;
    if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(pct));
  });

  if (summary && summary.total > 0) {
    const msg = summary.failed > 0
      ? `가격 업데이트: ${summary.success}/${summary.total} 성공 (실패: ${summary.failed}건)`
      : `가격 업데이트 완료: ${summary.success}/${summary.total} 성공`;
    showToast(msg, summary.failed > 0 ? 'info' : 'success');
  } else {
    showToast('업데이트할 자산이 없습니다', 'info');
  }

  _dashRenderKey = '';
  renderDashboard();
  renderPageHeader();
}

function renderPieLegend(catTotals, total) {
  const items = appState.categoryOrder
    .filter(c => catTotals[c] > 0)
    .map(c => {
      const cat = CAT_MAP[c];
      const val = catTotals[c];
      const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
      return `
        <div class="legend-item">
          <span class="legend-dot" data-color="${escAttr(cat.color)}" aria-hidden="true"></span>
          <span class="legend-label">${cat.icon} ${escHtml(cat.label)}</span>
          <span class="legend-value">${escHtml(fmtKRW(val))}</span>
          <span class="legend-pct">${pct}%</span>
        </div>
      `;
    }).join('');
  return `<div class="pie-legend" role="list" aria-label="자산 분포 범례">${items}</div>`;
}

function renderCategoryBreakdown(catTotals, total) {
  const cats = appState.categoryOrder.filter(c => catTotals[c] > 0);
  if (cats.length === 0) return '';
  return `
    <div class="card stagger-item" style="--i:6" role="region" aria-label="카테고리별 상세">
      <div class="card-title">카테고리별 상세</div>
      ${cats.map(c => renderCategorySection(c, catTotals[c], total)).join('')}
    </div>
  `;
}

function renderCategorySection(catId, catTotal, total) {
  const cat = CAT_MAP[catId];
  const pct = total > 0 ? ((catTotal / total) * 100).toFixed(1) : 0;
  const assets = appState.assets.filter(a => a.category === catId);
  const isOpen = UIState.dashboardCategoryOpen[catId] || false;

  return `
    <div class="cat-section" id="dashCat-${escAttr(catId)}">
      <div class="cat-header" data-action="toggle-dash-cat" data-cat="${escAttr(catId)}"
        role="button" tabindex="0" aria-expanded="${isOpen}">
        <span>${cat.icon} ${escHtml(cat.label)} (${assets.length})</span>
        <span>
          <span class="cat-value">${escHtml(fmtKRW(catTotal))}</span>
          <span class="cat-pct">${pct}%</span>
          <span class="chevron ${isOpen ? 'open' : ''}" aria-hidden="true">▸</span>
        </span>
      </div>
      ${isOpen ? `<div class="cat-assets" role="list">${assets.map(a => renderDashAsset(a)).join('')}</div>` : ''}
    </div>
  `;
}

function renderDashAsset(asset) {
  const v = calcAssetValue(asset);
  const isInv = INVESTMENT_CATS.includes(asset.category);
  return `
    <div class="dash-asset" data-action="open-asset-detail" data-id="${asset.id}" role="listitem"
      tabindex="0" aria-label="${escAttr(asset.name)}: ${fmtKRW(v.value)}">
      <div class="dash-asset-name">${escHtml(asset.name)}</div>
      <div class="dash-asset-info">
        <span class="dash-asset-value">${escHtml(fmtKRW(v.value))}</span>
        ${isInv ? `<span class="${profitClass(v.profit)}">${escHtml(fmtPct(v.profitPct))}</span>` : ''}
      </div>
    </div>
  `;
}

function toggleDashCat(catId) {
  UIState.dashboardCategoryOpen[catId] = !UIState.dashboardCategoryOpen[catId];
  const isOpen = UIState.dashboardCategoryOpen[catId];
  const section = $(`#dashCat-${catId}`);
  if (!section) { _dashRenderKey = ''; renderDashboard(); return; }

  const header = section.querySelector('.cat-header');
  if (header) {
    header.setAttribute('aria-expanded', String(isOpen));
    const chevron = header.querySelector('.chevron');
    if (chevron) chevron.classList.toggle('open', isOpen);
  }

  const existingBody = section.querySelector('.cat-assets');
  if (isOpen) {
    if (!existingBody) {
      const assets = appState.assets.filter(a => a.category === catId);
      const assetsDiv = document.createElement('div');
      assetsDiv.className = 'cat-assets';
      assetsDiv.setAttribute('role', 'list');
      assetsDiv.innerHTML = assets.map(a => renderDashAsset(a)).join('');
      section.appendChild(assetsDiv);
    }
  } else {
    if (existingBody) existingBody.remove();
  }
}

function renderOnboarding() {
  if (appState.assets.length > 0) return '';
  return `
    <div class="card onboarding stagger-item" style="--i:0" role="region" aria-label="시작 가이드">
      <h3>👋 환영합니다!</h3>
      <p>자산을 추가하여 포트폴리오를 시작하세요.</p>
      <div class="onboard-steps">
        <div class="step stagger-item" style="--i:1"><span class="step-num" aria-hidden="true">1</span><span>자산 탭에서 자산 추가</span></div>
        <div class="step stagger-item" style="--i:2"><span class="step-num" aria-hidden="true">2</span><span>매수/매도 거래 기록</span></div>
        <div class="step stagger-item" style="--i:3"><span class="step-num" aria-hidden="true">3</span><span>가격 업데이트로 실시간 관리</span></div>
      </div>
      <button class="btn-p" data-action="go-tab" data-tab="pgList" aria-label="자산 추가 페이지로 이동">자산 추가하러 가기 →</button>
    </div>
  `;
}

function calcPeriodReturns() {
  const hist = appState.history;
  if (hist.length < 2) return null;
  const current = hist[hist.length - 1].total;
  const periods = [
    { label: '1주', days: 7 },
    { label: '1개월', days: 30 },
    { label: '3개월', days: 90 },
    { label: '6개월', days: 180 },
    { label: '1년', days: 365 },
  ];
  return periods.map(p => {
    const idx = Math.max(0, hist.length - p.days - 1);
    const prev = hist[idx]?.total || current;
    const ret = prev > 0 ? ((current - prev) / prev) * 100 : 0;
    return { ...p, ret: safeNum(ret) };
  });
}
