/* =============================================
   My Portfolio v5.11.0 — Dashboard UI
   Cycle C compatible
   Soft Neutral: hero + stats + charts + breakdown
   ============================================= */

// ── Card Registry ──
const DASH_CARD_REGISTRY = Object.freeze([
  { id: 'hero',        label: '총 자산 헤더' },
  { id: 'stats',       label: '요약 지표' },
  { id: 'pie',         label: '자산 분포' },
  { id: 'trend',       label: '자산 추이' },
  { id: 'auto-update', label: '가격 업데이트' },
  { id: 'breakdown',   label: '카테고리별 상세' },
]);

let _dashDragId = null;
const _dashDragCleanup = Cleanup.scope('dash-drag');

function renderDashboard() {
  const container = $('#pgDash');
  if (!container) return;

  const hasAssets = appState.assets.length > 0;
  if (!hasAssets) {
    container.innerHTML = renderOnboarding();
    _setupDashboardDelegation(container);
    return;
  }

  const ctx = _buildDashContext();
  const prefs = loadDashPrefs();
  const order = _getDashOrder(prefs);
  const hiddenSet = new Set(prefs.hidden || []);
  const editMode = UIState.dashboardEditMode;

  let staggerIdx = 0;
  const cardsHtml = order.map((id) => {
    const meta = DASH_CARD_REGISTRY.find(c => c.id === id);
    if (!meta) return '';
    const isHidden = hiddenSet.has(id);
    if (!editMode && isHidden) return '';
    const inner = _renderDashCardInner(id, ctx);
    if (!inner) return '';
    return _wrapDashCard(id, meta.label, inner, isHidden, editMode, staggerIdx++);
  }).filter(Boolean).join('');

  container.innerHTML = `
    ${_renderDashToolbar(editMode)}
    ${renderBackupReminder()}
    <div class="dash-cards ${editMode ? 'dash-edit-mode' : ''}">${cardsHtml}</div>
  `;

  requestAnimationFrame(() => {
    destroyChart('pie');
    destroyChart('trend');
    if (!hiddenSet.has('pie') || editMode) renderPortfolioPie();
    if (!hiddenSet.has('trend') || editMode) renderTrendChart(UIState.dashboardTrendDays);
  });

  _setupDashboardDelegation(container);
  if (editMode) _setupDashDragAndDrop(container);
  else _dashDragCleanup.removeAll();
}

function _buildDashContext() {
  const total = calcTotal(appState.assets);
  const catTotals = calcCategoryTotals(appState.assets);
  const prevTotal = getPreviousTotal();
  const change = total - prevTotal;
  const changePct = prevTotal > 0 ? (change / prevTotal) * 100 : 0;
  const prevSnap = getPreviousSnapshot();
  const prevCatTotals = prevSnap ? prevSnap.byCategory || null : null;
  const prevAssetValues = prevSnap ? prevSnap.byAsset || null : null;
  return { total, catTotals, prevTotal, change, changePct, prevCatTotals, prevAssetValues };
}

// 오늘 이전의 가장 최근 스냅샷 entry 반환. 없으면 null.
function getPreviousSnapshot() {
  const hist = appState.history;
  if (!Array.isArray(hist) || hist.length === 0) return null;
  const todayStr = today();
  for (let i = hist.length - 1; i >= 0; i--) {
    const snap = hist[i];
    if (snap && snap.date && snap.date < todayStr) return snap;
  }
  return null;
}

// 하위 호환: 기존 호출부 유지
function getPreviousCategoryTotals() {
  const snap = getPreviousSnapshot();
  return snap ? snap.byCategory || null : null;
}

function _shouldShowAssetDelta(asset) {
  if (!asset) return false;
  if (typeof ASSET_DELTA_ENABLED_CATS !== 'undefined' && ASSET_DELTA_ENABLED_CATS.includes(asset.category)) return true;
  if (asset.isUsdt === true) return true;
  return false;
}

function _getDashOrder(prefs) {
  const defaults = DASH_CARD_REGISTRY.map(c => c.id);
  if (!prefs.order || prefs.order.length === 0) return defaults;
  const seen = new Set();
  const out = [];
  for (const id of prefs.order) {
    if (defaults.includes(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of defaults) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

function _renderDashCardInner(id, ctx) {
  switch (id) {
    case 'hero':        return _renderHeroCard(ctx);
    case 'stats':       return _renderStatsCard(ctx);
    case 'pie':         return _renderPieCard(ctx);
    case 'trend':       return _renderTrendCard(ctx);
    case 'auto-update': return renderAutoUpdateSection();
    case 'breakdown':   return renderCategoryBreakdown(ctx.catTotals, ctx.total, ctx.prevCatTotals, ctx.prevAssetValues);
    default: return '';
  }
}

function _wrapDashCard(id, label, innerHtml, isHidden, editMode, staggerIdx) {
  if (!editMode) {
    return `<div class="dash-card-wrap stagger-item" style="--i:${staggerIdx}" data-card="${escAttr(id)}">${innerHtml}</div>`;
  }
  return `
    <div class="dash-card-wrap dash-edit-card ${isHidden ? 'dash-hidden' : ''} stagger-item"
      style="--i:${staggerIdx}" data-card="${escAttr(id)}" draggable="true" aria-label="${escAttr(label)}">
      <div class="dash-edit-controls" role="group" aria-label="${escAttr(label)} 편집">
        <span class="dash-drag-handle" aria-hidden="true">⋮⋮</span>
        <span class="dash-edit-label">${escHtml(label)}</span>
        <button class="dash-move-btn" data-action="dash-move-up" data-card="${escAttr(id)}" aria-label="${escAttr(label)} 위로 이동">▲</button>
        <button class="dash-move-btn" data-action="dash-move-down" data-card="${escAttr(id)}" aria-label="${escAttr(label)} 아래로 이동">▼</button>
        <button class="dash-vis-btn" data-action="toggle-dash-card" data-card="${escAttr(id)}" aria-label="${escAttr(label)} ${isHidden ? '표시' : '숨김'}" aria-pressed="${isHidden ? 'false' : 'true'}">${isHidden ? '🙈' : '👁'}</button>
      </div>
      <div class="dash-card-inner">${innerHtml}</div>
    </div>
  `;
}

function _renderDashToolbar(editMode) {
  if (editMode) {
    return `
      <div class="dash-toolbar" role="toolbar" aria-label="대시보드 편집 도구">
        <span class="dash-toolbar-hint">💡 카드를 드래그하거나 ▲▼로 순서 변경, 👁로 표시/숨김 전환</span>
        <div class="dash-toolbar-actions">
          <button class="btn-sm" data-action="reset-dash-prefs" aria-label="대시보드 초기화">초기화</button>
          <button class="btn-p" data-action="toggle-dash-edit" aria-label="편집 완료">✓ 완료</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="dash-toolbar" role="toolbar" aria-label="대시보드 도구">
      <button class="btn-sm dash-edit-toggle" data-action="toggle-dash-edit" aria-label="대시보드 편집">✎ 편집</button>
    </div>
  `;
}

// ── Card Renderers ──
function _renderHeroCard(ctx) {
  return `
    <section class="dash-hero" role="region" aria-label="총 자산 현황">
      <div class="dash-hero-label">총 자산</div>
      <div class="dash-hero-value" id="totalValue">${escHtml(fmtKRW(ctx.total))}</div>
      <div class="dash-hero-change ${profitClass(ctx.change)}" aria-label="일일 변동">
        ${ctx.change !== 0 ? `${ctx.change > 0 ? '▲' : '▼'} ${escHtml(fmtKRW(Math.abs(ctx.change)))} (${escHtml(fmtPct(ctx.changePct))})` : '변동 없음'}
      </div>
      ${appState.saved ? `<div class="dash-hero-saved">마지막 저장: ${escHtml(fmtRelTime(appState.saved))}</div>` : ''}
    </section>
  `;
}

function _renderStatsCard(ctx) {
  const { catTotals } = ctx;
  const assetCount = appState.assets.length;
  return `
    <section class="dash-stats" role="region" aria-label="요약 지표">
      <div class="stat-card">
        <div class="stat-label">보유 자산</div>
        <div class="stat-value">${assetCount}개</div>
        <div class="stat-sub">${appState.categoryOrder.filter(c => catTotals[c] > 0).length}개 카테고리</div>
      </div>
      ${cachedRate ? `
        <div class="stat-card">
          <div class="stat-label">USD/KRW 환율</div>
          <div class="stat-value">${escHtml(fmtNum(cachedRate.rate, 2))}</div>
          <div class="stat-sub">${escHtml(cachedRate.source)} · ${escHtml(fmtRelTime(new Date(cachedRate.time).toISOString()))}</div>
        </div>
      ` : ''}
      ${cachedUsdt ? `
        <div class="stat-card">
          <div class="stat-label">USDT</div>
          <div class="stat-value">${escHtml(fmtNum(cachedUsdt.rate, 0))}원</div>
          <div class="stat-sub">${escHtml(cachedUsdt.source)}</div>
        </div>
      ` : ''}
      ${appState.history.length >= 2 ? `
        <div class="stat-card">
          <div class="stat-label">기록 일수</div>
          <div class="stat-value">${appState.history.length}일</div>
          <div class="stat-sub">최초: ${escHtml(fmtDate(appState.history[0]?.date))}</div>
        </div>
      ` : ''}
    </section>
  `;
}

function _renderPieCard(ctx) {
  return `
    <div class="card" role="region" aria-label="자산 분포 차트">
      <div class="card-title">자산 분포</div>
      <div class="chart-wrap chart-wrap-220" role="img" aria-label="자산 분포 차트">
        <canvas id="chartPie"></canvas>
      </div>
      <div id="chartPieAlt"></div>
      ${renderPieLegend(ctx.catTotals, ctx.total)}
    </div>
  `;
}

function _renderTrendCard() {
  return `
    <div class="card" role="region" aria-label="자산 추이 차트">
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
  `;
}

// ── Delegation ──
function _setupDashboardDelegation(container) {
  container.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    _handleDashAction(target, e);
  };
  container.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    _handleDashAction(target, e);
  };
}

function _handleDashAction(target, e) {
  const action = target.dataset.action;
  if (action === 'trend') _handleTrendClick(Number(target.dataset.days), target);
  else if (action === 'auto-update') startAutoUpdate();
  else if (action === 'toggle-dash-cat') { const catId = target.dataset.cat; if (catId) toggleDashCat(catId); }
  else if (action === 'open-asset-detail') { const id = target.dataset.id; if (id) openAssetDetail(id); }
  else if (action === 'go-tab') { const tab = target.dataset.tab; if (tab) goTab(tab); }
  else if (action === 'toggle-dash-edit') toggleDashEditMode();
  else if (action === 'toggle-dash-card') { if (e) e.stopPropagation(); toggleDashCardHidden(target.dataset.card); }
  else if (action === 'dash-move-up') { if (e) e.stopPropagation(); moveDashCard(target.dataset.card, -1); }
  else if (action === 'dash-move-down') { if (e) e.stopPropagation(); moveDashCard(target.dataset.card, 1); }
  else if (action === 'reset-dash-prefs') doResetDashPrefs();
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

// ── Edit Mode Actions ──
function toggleDashEditMode() {
  UIState.dashboardEditMode = !UIState.dashboardEditMode;
  renderDashboard();
}

function toggleDashCardHidden(cardId) {
  if (!cardId) return;
  const prefs = loadDashPrefs();
  const hidden = new Set(prefs.hidden || []);
  if (hidden.has(cardId)) hidden.delete(cardId);
  else hidden.add(cardId);
  saveDashPrefs({ order: _getDashOrder(prefs), hidden: [...hidden] });
  renderDashboard();
}

function moveDashCard(cardId, delta) {
  if (!cardId) return;
  const prefs = loadDashPrefs();
  const order = _getDashOrder(prefs);
  const idx = order.indexOf(cardId);
  if (idx < 0) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= order.length) return;
  order.splice(idx, 1);
  order.splice(newIdx, 0, cardId);
  saveDashPrefs({ order, hidden: prefs.hidden || [] });
  renderDashboard();
}

function doResetDashPrefs() {
  openConfirmModal('대시보드 레이아웃을 기본값으로 초기화하시겠습니까?', () => {
    resetDashPrefs();
    showToast('대시보드가 초기화되었습니다', 'success');
    renderDashboard();
  });
}

// ── Drag & Drop ──
function _setupDashDragAndDrop(container) {
  _dashDragCleanup.removeAll();
  const cards = container.querySelectorAll('.dash-card-wrap[draggable="true"]');

  cards.forEach(card => {
    _dashDragCleanup.add(card, 'dragstart', (e) => {
      _dashDragId = card.dataset.card;
      card.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', card.dataset.card); } catch (_) {} }
    });
    _dashDragCleanup.add(card, 'dragend', () => {
      card.classList.remove('dragging');
      _clearDashDragOver();
      _dashDragId = null;
    });
    _dashDragCleanup.add(card, 'dragover', (e) => {
      if (!_dashDragId || _dashDragId === card.dataset.card) return;
      e.preventDefault();
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const isTop = e.clientY < midY;
      _clearDashDragOver();
      card.classList.add(isTop ? 'drag-over-top' : 'drag-over-bottom');
    });
    _dashDragCleanup.add(card, 'dragleave', (e) => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });
    _dashDragCleanup.add(card, 'drop', (e) => {
      if (!_dashDragId) return;
      e.preventDefault();
      const targetId = card.dataset.card;
      if (targetId === _dashDragId) return;
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midY;
      _reorderDashCardDnD(_dashDragId, targetId, insertBefore);
    });
  });
}

function _clearDashDragOver() {
  $$('.dash-card-wrap.drag-over-top, .dash-card-wrap.drag-over-bottom').forEach(c => {
    c.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function _reorderDashCardDnD(fromId, toId, insertBefore) {
  const prefs = loadDashPrefs();
  const order = _getDashOrder(prefs);
  const fromIdx = order.indexOf(fromId);
  if (fromIdx < 0) return;
  order.splice(fromIdx, 1);
  let toIdx = order.indexOf(toId);
  if (toIdx < 0) return;
  if (!insertBefore) toIdx += 1;
  order.splice(toIdx, 0, fromId);
  saveDashPrefs({ order, hidden: prefs.hidden || [] });
  renderDashboard();
}

// ── Auto Update ──
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
    <div class="card card-warn" role="alert">
      <span>💾 마지막 백업이 ${daysSince}일 전입니다.</span>
      <button class="btn-sm btn-accent" data-action="go-tab" data-tab="pgHist" aria-label="백업 페이지로 이동">백업하기</button>
    </div>
  `;
}

function renderAutoUpdateSection() {
  return `
    <div class="card" role="region" aria-label="가격 업데이트">
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
  const btn = $('#btnAutoUpdate');
  const btn2 = $('#btnAutoUpdateHeader');
  if (btn) btn.disabled = true;
  if (btn2) btn2.disabled = true;
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

function renderCategoryBreakdown(catTotals, total, prevCatTotals, prevAssetValues) {
  const cats = appState.categoryOrder.filter(c => catTotals[c] > 0);
  if (cats.length === 0) return '';
  return `
    <div class="card" role="region" aria-label="카테고리별 상세">
      <div class="card-title">카테고리별 상세</div>
      ${cats.map(c => renderCategorySection(c, catTotals[c], total, prevCatTotals, prevAssetValues)).join('')}
    </div>
  `;
}

function renderCategorySection(catId, catTotal, total, prevCatTotals, prevAssetValues) {
  const cat = CAT_MAP[catId];
  const pct = total > 0 ? ((catTotal / total) * 100).toFixed(1) : 0;
  const assets = appState.assets.filter(a => a.category === catId);
  const isOpen = UIState.dashboardCategoryOpen[catId] || false;
  const deltaBadge = _renderCatDeltaBadge(catId, catTotal, prevCatTotals);

  return `
    <div class="cat-section" id="dashCat-${escAttr(catId)}">
      <div class="cat-header" data-action="toggle-dash-cat" data-cat="${escAttr(catId)}"
        role="button" tabindex="0" aria-expanded="${isOpen}">
        <span>${cat.icon} ${escHtml(cat.label)} (${assets.length})</span>
        <span>
          <span class="cat-value">${escHtml(fmtKRW(catTotal))}</span>
          ${deltaBadge}
          <span class="cat-pct">${pct}%</span>
          <span class="chevron ${isOpen ? 'open' : ''}" aria-hidden="true">▸</span>
        </span>
      </div>
      ${isOpen ? `<div class="cat-assets" role="list">${assets.map(a => renderDashAsset(a, prevAssetValues)).join('')}</div>` : ''}
    </div>
  `;
}

// 카테고리 이전 기록 대비 증감 배지. 이전 스냅샷 없으면 빈 문자열.
// aria-label은 '이전 기록 대비'로 표기 — 사용자가 매일 들어오지 않을 경우 실제 비교 기준이 전일이 아닐 수 있음.
function _renderCatDeltaBadge(catId, catTotal, prevCatTotals) {
  if (!prevCatTotals) return '';
  const prev = safeNum(prevCatTotals[catId], 0);
  const curr = safeNum(catTotal, 0);
  if (prev === 0 && curr === 0) return '';
  if (prev === 0) {
    return `<span class="cat-delta cat-delta-new" aria-label="신규 카테고리">NEW</span>`;
  }
  const diff = curr - prev;
  if (diff === 0) {
    return `<span class="cat-delta cat-delta-zero" aria-label="이전 기록 대비 변동 없음">±0</span>`;
  }
  const sign = diff > 0 ? '▲' : '▼';
  const cls = diff > 0 ? 'positive' : 'negative';
  const label = `이전 기록 대비 ${diff > 0 ? '증가' : '감소'} ${fmtKRW(Math.abs(diff))}`;
  return `<span class="cat-delta ${cls}" aria-label="${escAttr(label)}">${sign} ${escHtml(fmtKRW(Math.abs(diff)))}</span>`;
}

function renderDashAsset(asset, prevAssetValues) {
  const v = calcAssetValue(asset);
  const isInv = INVESTMENT_CATS.includes(asset.category);
  const assetDeltaBadge = _renderAssetDeltaBadge(asset, v.value, prevAssetValues);
  return `
    <div class="dash-asset" data-action="open-asset-detail" data-id="${asset.id}" role="listitem"
      tabindex="0" aria-label="${escAttr(asset.name)}: ${fmtKRW(v.value)}">
      <div class="dash-asset-name">${escHtml(asset.name)}${assetDeltaBadge}</div>
      <div class="dash-asset-info">
        <span class="dash-asset-value">${escHtml(fmtKRW(v.value))}</span>
        ${isInv ? `<span class="${profitClass(v.profit)}">${escHtml(fmtPct(v.profitPct))}</span>` : ''}
      </div>
    </div>
  `;
}

// 자산별 이전 기록 대비 일일 델타 배지.
// - 활성 카테고리(ASSET_DELTA_ENABLED_CATS) 또는 USDT 자산만 표시
// - 이전 스냅샷에 byAsset이 없거나 해당 자산 ID가 없으면 미표시 (신규 자산 포함)
// - 변동액이 반올림 후 0이면 미표시 (자산 행은 공간이 좁아 ±0 노이즈 방지)
function _renderAssetDeltaBadge(asset, currValue, prevAssetValues) {
  if (!_shouldShowAssetDelta(asset)) return '';
  if (!prevAssetValues) return '';
  const prev = prevAssetValues[asset.id];
  if (prev === undefined || prev === null) return '';
  const prevN = safeNum(prev, 0);
  const curr = safeNum(currValue, 0);
  const diff = Math.round(curr - prevN);
  if (diff === 0) return '';
  const sign = diff > 0 ? '▲' : '▼';
  const cls = diff > 0 ? 'positive' : 'negative';
  const label = `이전 기록 대비 ${diff > 0 ? '증가' : '감소'} ${fmtKRW(Math.abs(diff))}`;
  return `<span class="asset-delta ${cls}" aria-label="${escAttr(label)}">${sign} ${escHtml(fmtKRW(Math.abs(diff)))}</span>`;
}

function toggleDashCat(catId) {
  UIState.dashboardCategoryOpen[catId] = !UIState.dashboardCategoryOpen[catId];
  const isOpen = UIState.dashboardCategoryOpen[catId];
  const section = $(`#dashCat-${catId}`);
  if (!section) { renderDashboard(); return; }

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
      const prevSnap = getPreviousSnapshot();
      const prevAssetValues = prevSnap ? prevSnap.byAsset || null : null;
      const assetsDiv = document.createElement('div');
      assetsDiv.className = 'cat-assets';
      assetsDiv.setAttribute('role', 'list');
      assetsDiv.innerHTML = assets.map(a => renderDashAsset(a, prevAssetValues)).join('');
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
