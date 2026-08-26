/* =============================================
   My Portfolio v5.38.0 — Dashboard UI
   Cycle C compatible
   Soft Neutral: hero + stats + charts + breakdown
   ============================================= */

// ── Card Registry ──
const DASH_CARD_REGISTRY = Object.freeze([
  { id: 'hero',        label: '총 자산 헤더' },
  { id: 'stats',       label: '요약 지표' },
  { id: 'fire-goal',   label: '재무 목표 & FIRE' },
  { id: 'allocation',  label: '배분 편차' },
  { id: 'stock-sector', label: '주식 섹터 분포' },
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
    ${renderMonthlyReportCard()}
    <div class="dash-cards ${editMode ? 'dash-edit-mode' : ''}">${cardsHtml}</div>
  `;

  destroyChart('pie');
  destroyChart('trend');
  runWhenIdle(() => {
    if (!hiddenSet.has('trend') || editMode) renderTrendChart(UIState.dashboardTrendDays, { hideAbsolute: isDashTotalHidden() });
  });

  _setupDashboardDelegation(container);
  if (editMode) _setupDashDragAndDrop(container);
  else _dashDragCleanup.removeAll();
  setTimeout(applyDynamicColors, DYNAMIC_COLOR_DELAY_MS);
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
    case 'fire-goal':   return _renderFireGoalCard(ctx);
    case 'allocation':  return _renderAllocationCard(ctx);
    case 'stock-sector': return _renderStockSectorCard();
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
        <button class="dash-vis-btn" data-action="toggle-dash-card" data-card="${escAttr(id)}" aria-label="${escAttr(label)} ${isHidden ? '표시' : '숨김'}" aria-pressed="${isHidden ? 'false' : 'true'}">
          ${renderTotalPrivacyIcon(isHidden, 'dash-vis-icon')}
        </button>
      </div>
      <div class="dash-card-inner">${innerHtml}</div>
    </div>
  `;
}

function _renderDashToolbar(editMode) {
  if (editMode) {
    return `
      <div class="dash-toolbar" role="toolbar" aria-label="대시보드 편집 도구">
        <span class="dash-toolbar-hint">카드를 드래그하거나 ▲▼로 순서를 바꾸고, 눈 아이콘으로 표시/숨김을 전환하세요.</span>
        <div class="dash-toolbar-actions">
          <button class="btn-sm" data-action="reset-dash-prefs" aria-label="대시보드 초기화">초기화</button>
          <button class="btn-p" data-action="toggle-dash-edit" aria-label="편집 완료">✓ 완료</button>
        </div>
      </div>
    `;
  }
  const totalHidden = isDashTotalHidden();
  return `
    <div class="dash-top-actions" role="toolbar" aria-label="대시보드 빠른 설정">
      <button type="button" class="btn-sm dash-total-toggle" data-action="toggle-dash-total"
        aria-label="대시보드 금액 ${totalHidden ? '드러내기' : '숨기기'}" aria-pressed="${totalHidden}" title="대시보드 금액 ${totalHidden ? '드러내기' : '숨기기'}">
        ${renderTotalPrivacyIcon(totalHidden)}
      </button>
      <button class="btn-sm dash-edit-toggle" data-action="toggle-dash-edit" aria-label="대시보드 편집">✎ 편집</button>
    </div>
  `;
}

function renderTotalPrivacyIcon(totalHidden, extraClass = '') {
  const className = `dash-total-icon${extraClass ? ` ${extraClass}` : ''}`;
  if (totalHidden) {
    return `
      <svg class="${escAttr(className)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }
  return `
    <svg class="${escAttr(className)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18"></path>
      <path d="M10.7 5.7A10.5 10.5 0 0 1 12 5.6c6 0 9.5 6.4 9.5 6.4a16 16 0 0 1-3.1 4"></path>
      <path d="M6.1 6.3C3.8 8 2.5 12 2.5 12s3.5 6.4 9.5 6.4a10.7 10.7 0 0 0 4-.8"></path>
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
    </svg>
  `;
}

// ── Card Renderers ──
function _renderHeroCard(ctx) {
  const totalHidden = isDashTotalHidden();
  return `
    <section class="dash-hero" role="region" aria-label="총 자산 현황">
      <div class="dash-hero-label">총 자산</div>
      <div class="dash-hero-value ${totalHidden ? 'dash-value-hidden' : ''}" id="totalValue"
        aria-label="${totalHidden ? '총 자산 숨김' : `총 자산 ${fmtKRW(ctx.total)}`}">${escHtml(totalHidden ? maskMoney() : fmtKRW(ctx.total))}</div>
      <div class="dash-hero-change ${profitClass(ctx.change)}" aria-label="일일 변동">
        ${totalHidden ? '변동 금액 숨김' : (ctx.change !== 0 ? `${ctx.change > 0 ? '▲' : '▼'} ${escHtml(fmtKRW(Math.abs(ctx.change)))} (${escHtml(fmtPct(ctx.changePct))})` : '변동 없음')}
      </div>
      <div class="dash-hero-saved ${appState.saved ? '' : 'hidden'}" id="dashLastSaved">${appState.saved ? `마지막 저장: ${escHtml(fmtRelTime(appState.saved))}` : ''}</div>
    </section>
  `;
}

function _renderStatsCard(ctx) {
  const { catTotals } = ctx;
  const assetCount = appState.assets.length;
  const kimchi = getKimchiPremiumInfo();
  const usdRateInfo = getRateDisplayInfo('usdkrw');
  const usdtRateInfo = getRateDisplayInfo('usdt');
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
          <div class="stat-sub">${escHtml(formatRateSourceLabel(usdRateInfo))}</div>
        </div>
      ` : ''}
      ${cachedUsdt ? `
        <div class="stat-card">
          <div class="stat-label">USDT</div>
          <div class="stat-value">${escHtml(fmtNum(cachedUsdt.rate, 0))}원</div>
          <div class="stat-sub">${escHtml(formatRateSourceLabel(usdtRateInfo))}</div>
        </div>
      ` : ''}
      ${kimchi ? `
        <div class="stat-card stat-kimp">
          <div class="stat-label">김치 프리미엄</div>
          <div class="stat-value ${kimchi.premium >= 0 ? 'positive' : 'negative'}">${escHtml(fmtPct(kimchi.premium, 2))}</div>
          <div class="stat-sub">${escHtml(fmtNum(kimchi.usdtRate, 0))}원 ÷ ${escHtml(fmtNum(kimchi.usdRate, 2))}${kimchi.fallback ? ' · 이전 저장 가격 포함' : ''}</div>
        </div>
      ` : `
        <div class="stat-card stat-kimp stat-muted">
          <div class="stat-label">김치 프리미엄</div>
          <div class="stat-value">대기</div>
          <div class="stat-sub">USD/KRW와 USDT 시세 필요</div>
        </div>
      `}
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

function _renderFireGoalCard(ctx) {
  const goal = appState.goal;
  if (!goal) {
    return `
      <div class="card dash-fire-empty" role="region" aria-label="재무 목표 없음">
        <div class="card-title">재무 목표 & FIRE</div>
        <p class="text-muted" style="margin:8px 0 12px">목표를 설정하면 달성 예상 시점과 FIRE 진행률이 표시됩니다.</p>
        <button class="btn-p" data-action="go-tab" data-tab="pgAi" aria-label="목표 설정하러 가기">목표 설정</button>
      </div>
    `;
  }
  const total = ctx.total;
  const totalDisplay = isDashTotalHidden() ? maskMoney() : fmtKRW(total);
  const pct = goal.amount > 0 ? (total / goal.amount) * 100 : 0;
  const monthlySaving = safeNum(goal.monthlySaving);
  const expectedReturn = safeNum(goal.expectedReturn != null ? goal.expectedReturn : 7);
  const monthlyExpense = safeNum(goal.monthlyExpense);
  const projMonths = projectMonthsToTarget(total, goal.amount, monthlySaving, expectedReturn);
  const projLabel = isFinite(projMonths) ? fmtMonthsToKorean(projMonths) : '도달 불가';
  const projDate = isFinite(projMonths) ? addMonthsFromNow(projMonths) : '';
  const fireAmount = calcFireAmount(monthlyExpense);
  const firePct = fireAmount > 0 ? (total / fireAmount) * 100 : 0;

  return `
    <div class="card dash-fire-card" role="region" aria-label="재무 목표 요약">
      <div class="card-title">
        재무 목표 & FIRE
        <button class="btn-sm" data-action="go-tab" data-tab="pgAi" aria-label="재무 목표 상세">상세</button>
      </div>
      <div class="dash-fire-row">
        <div class="dash-fire-label">목표 달성률</div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width:${Math.min(pct, 100)}%"></div>
        </div>
        <div class="dash-fire-stats">
          <span>${escHtml(fmtPct(pct, 1))}</span>
          <span class="text-muted">${escHtml(totalDisplay)} / ${escHtml(fmtKRW(goal.amount))}</span>
        </div>
        ${goal.amount > total ? `
          <div class="dash-fire-proj text-muted">예상 도달: ${escHtml(projLabel)}${projDate ? ` (${escHtml(projDate)})` : ''}</div>
        ` : '<div class="dash-fire-proj positive">🎉 목표 달성!</div>'}
      </div>
      ${monthlyExpense > 0 ? `
        <div class="dash-fire-row">
          <div class="dash-fire-label">🔥 FIRE 진행률</div>
          <div class="progress-bar" role="progressbar" aria-valuenow="${Math.round(firePct)}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill fire-fill" style="width:${Math.min(firePct, 100)}%"></div>
          </div>
          <div class="dash-fire-stats">
            <span>${escHtml(fmtPct(firePct, 1))}</span>
            <span class="text-muted">${escHtml(totalDisplay)} / ${escHtml(fmtKRW(fireAmount))}</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function _renderAllocationCard(ctx) {
  const alloc = appState.allocation;
  if (!alloc || !alloc.enabled) {
    return `
      <div class="card" role="region" aria-label="자산 배분 편차">
        <div class="card-title">
          배분 편차
          <button class="btn-sm" data-action="go-tab" data-tab="pgAi" aria-label="배분 목표 설정">설정</button>
        </div>
        <p class="text-muted">배분 목표를 설정하면 여기에 편차가 표시됩니다.</p>
      </div>
    `;
  }
  const driftRows = calcAllocationDrift(appState.assets, alloc, ctx.total, ctx.catTotals);
  const threshold = safeNum(alloc.driftThreshold != null ? alloc.driftThreshold : ALLOC_DRIFT_THRESHOLD_DEFAULT);
  if (!driftRows.length) {
    return `
      <div class="card" role="region" aria-label="자산 배분 편차">
        <div class="card-title">
          배분 편차
          <button class="btn-sm" data-action="go-tab" data-tab="pgAi" aria-label="배분 목표 상세">상세</button>
        </div>
        <p class="text-muted">표시할 편차가 없습니다.</p>
      </div>
    `;
  }
  const MAX_VISUAL_DRIFT = Math.max(10, threshold * 2);
  const alerts = driftRows.filter(r => r.status !== 'ok').length;

  return `
    <div class="card" role="region" aria-label="자산 배분 편차">
      <div class="card-title">
        배분 편차
        <div class="card-title-actions">
          ${alerts > 0 ? `<span class="dash-alloc-alert-badge" aria-label="경고 ${alerts}건">🚨 ${alerts}</span>` : ''}
          <button class="btn-sm" data-action="go-tab" data-tab="pgAi" aria-label="배분 목표 상세">상세</button>
        </div>
      </div>
      <div class="alloc-drift-list dash-alloc-list">
        ${driftRows.map(r => {
          const absDrift = Math.min(Math.abs(r.driftPct), MAX_VISUAL_DRIFT);
          const fillWidth = (absDrift / MAX_VISUAL_DRIFT) * 50;
          const side = r.driftPct >= 0 ? 'right' : 'left';
          const sign = r.driftPct > 0 ? '+' : (r.driftPct < 0 ? '' : '±');
          const statusIcon = r.status === 'ok' ? '✅' : '🚨';
          return `
            <div class="alloc-drift-row alloc-${r.status}">
              <div class="alloc-drift-label">${escHtml(r.label)}</div>
              <div class="alloc-drift-bar" role="presentation">
                <div class="alloc-drift-center"></div>
                <div class="alloc-drift-fill" data-drift-fill="${side}"
                  style="width:${fillWidth.toFixed(2)}%"></div>
              </div>
              <div class="alloc-drift-pct">${sign}${r.driftPct.toFixed(1)}%</div>
              <div class="alloc-drift-stats">
                <span>${escHtml(fmtPct(r.actualPct, 1))} / 목표 ${escHtml(fmtPct(r.targetPct, 1))}</span>
                <span class="text-muted">${statusIcon}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function _renderStockSectorCard() {
  const costCompare = isSectorCostCompareEnabled();
  const totalHidden = isDashTotalHidden();
  const toggle = `
    <button type="button" class="btn-sm" data-action="toggle-sector-cost-compare"
      aria-pressed="${costCompare}" aria-label="섹터 원금 비교 그래프 ${costCompare ? '끄기' : '켜기'}">
      ${costCompare ? '원금 비교 끄기' : '원금 비교 켜기'}
    </button>
  `;
  const sectorHtml = renderStockSectorSection('dash', { bare: true, showTitle: false, scope: 'dash', hideAmounts: totalHidden });
  if (!sectorHtml) {
    return `
      <div class="card" role="region" aria-label="주식 섹터 분포">
        <div class="card-title"><span>주식 섹터 분포</span><div class="card-title-actions">${toggle}</div></div>
        <p class="text-muted">표시할 주식 자산이 없습니다.</p>
      </div>
    `;
  }
  return `
    <div class="card" role="region" aria-label="주식 섹터 분포">
      <div class="card-title"><span>주식 섹터 분포</span><div class="card-title-actions">${toggle}</div></div>
      ${sectorHtml}
    </div>
  `;
}

function _renderPieCard(ctx) {
  const totalHidden = isDashTotalHidden();
  return `
    <div class="card" role="region" aria-label="자산 분포 차트">
      <div class="card-title">자산 분포</div>
      ${renderDistributionBelt(ctx.catTotals, ctx.total, '자산 분포', null, { hideTotal: totalHidden })}
      ${renderPieLegend(ctx.catTotals, ctx.total, { hideAmounts: totalHidden })}
    </div>
  `;
}

function renderDistributionBelt(totals, total, label, rowsOverride = null, options = {}) {
  const rows = rowsOverride || appState.categoryOrder
    .filter(c => safeNum(totals[c]) > 0)
    .map(c => ({
      id: c,
      label: CAT_MAP[c].label,
      value: safeNum(totals[c]),
      color: CAT_MAP[c].color,
    }));
  if (!rows.length || total <= 0) {
    return '<div class="empty-state">표시할 데이터가 없습니다</div>';
  }
  const segments = rows.map(row => {
    const pct = total > 0 ? (row.value / total) * 100 : 0;
    return `
      <div class="belt-segment" style="--seg-pct:${pct.toFixed(4)}%;--seg-color:${escAttr(row.color)}"
        title="${escAttr(row.label)} ${pct.toFixed(1)}%" aria-label="${escAttr(row.label)} ${pct.toFixed(1)}%"></div>
    `;
  }).join('');
  const top = rows.reduce((best, row) => !best || row.value > best.value ? row : best, null);
  const topPct = top ? (top.value / total) * 100 : 0;
  return `
    <div class="belt-chart-wrap" role="img" aria-label="${escAttr(label)} 띠그래프">
      <div class="belt-chart">${segments}</div>
      <div class="belt-summary">
        <span>${escHtml(label)}</span>
        <strong>${escHtml(options.hideTotal ? maskMoney() : fmtKRW(total))}</strong>
        ${top ? `<span class="text-muted">최대 ${escHtml(top.label)} ${topPct.toFixed(1)}%</span>` : ''}
      </div>
    </div>
  `;
}

function renderStockSectorSection(variant = 'full', options = {}) {
  const sector = calcStockSectorTotals(appState.assets);
  if (!sector.rows.length || sector.total <= 0) return '';
  const bare = !!options.bare;
  const showTitle = options.showTitle !== false;
  const scope = String(options.scope || variant || 'sector').replace(/[^\w-]/g, '');
  const compact = variant === 'dash' || !!options.compact;
  const showCostCompare = isSectorCostCompareEnabled();
  const hideAmounts = !!options.hideAmounts;
  const displayAmount = value => hideAmounts ? maskMoney() : fmtKRW(value);
  const dashboardSectorLimit = 4;
  const groups = (sector.groups && sector.groups.length ? sector.groups : [{ id: 'all', label: '전체 주식', total: sector.total, costTotal: sector.costTotal, rows: sector.rows, unclassified: sector.unclassified }])
    .filter(group => group.total > 0 && group.rows.length > 0);
  const groupSections = groups.map(group => {
    const buildMetricRows = metric => {
      const isCost = metric === 'cost';
      const metricRows = group.rows
        .filter(row => safeNum(isCost ? row.cost : row.value) > 0)
        .sort((a, b) => safeNum(isCost ? b.cost : b.value) - safeNum(isCost ? a.cost : a.value))
        .map(row => ({
          ...row,
          value: safeNum(isCost ? row.cost : row.value),
          cost: safeNum(row.cost),
          assets: row.assets || [],
        }));
      if (!compact || metricRows.length <= dashboardSectorLimit) return metricRows;
      const topRows = metricRows.slice(0, dashboardSectorLimit);
      const restRows = metricRows.slice(dashboardSectorLimit);
      const otherValue = restRows.reduce((sum, row) => sum + safeNum(row.value), 0);
      const otherCost = restRows.reduce((sum, row) => sum + safeNum(row.cost), 0);
      const otherAssets = restRows.flatMap(row => row.assets || [])
        .filter(item => safeNum(isCost ? item.cost : item.value) > 0);
      return topRows.concat({
        id: `other-${metric}`,
        label: `기타 ${restRows.length}개`,
        color: (STOCK_SECTOR_MAP.other_stock && STOCK_SECTOR_MAP.other_stock.color) || '#A8A29A',
        value: otherValue,
        cost: isCost ? otherValue : otherCost,
        assets: otherAssets,
      });
    };
    const valueRows = buildMetricRows('value');
    const costRows = buildMetricRows('cost');
    const renderMetricRows = (metric, rows) => {
      const isCost = metric === 'cost';
      const total = isCost ? group.costTotal : group.total;
      return rows.map(row => {
        const rowValue = safeNum(row.value);
        const pct = total > 0 ? (rowValue / total) * 100 : 0;
        const stateKey = `${group.id}:${metric}:${row.id}`;
        const isOpen = !!UIState.stockSectorOpen[stateKey];
        const panelId = `sectorAssets_${scope}_${group.id}_${metric}_${row.id}`;
        const assetList = isOpen ? row.assets
          .slice()
          .filter(item => safeNum(isCost ? item.cost : item.value) > 0)
          .sort((a, b) => safeNum(isCost ? b.cost : b.value) - safeNum(isCost ? a.cost : a.value))
          .map(item => {
            const asset = item.asset || {};
            const code = asset.stockCode ? ` · ${asset.stockCode}` : '';
            const itemValue = safeNum(isCost ? item.cost : item.value);
            const assetPct = rowValue > 0 ? (itemValue / rowValue) * 100 : 0;
            return `
              <button type="button" class="sector-asset-row" data-action="open-asset-detail" data-id="${escAttr(asset.id)}"
                aria-label="${escAttr(asset.name || '이름 없는 주식')} 상세 보기">
                <span class="sector-asset-name">${escHtml(asset.name || '이름 없는 주식')}<span class="sector-asset-code">${escHtml(code)}</span></span>
                <span class="sector-asset-value">${escHtml(displayAmount(itemValue))}</span>
                <span class="sector-asset-pct">${assetPct.toFixed(1)}%</span>
              </button>
            `;
          }).join('') : '';
        return `
          <button type="button" class="sector-row sector-row-toggle" data-action="toggle-stock-sector" data-sector-key="${escAttr(stateKey)}"
            aria-expanded="${isOpen}" aria-controls="${escAttr(panelId)}"
            style="--sector-color:${escAttr(row.color)};--sector-pct:${Math.min(pct, 100).toFixed(2)}%">
            <span class="legend-dot" data-color="${escAttr(row.color)}" aria-hidden="true"></span>
            <span class="sector-label">${escHtml(row.label)}</span>
            <span class="sector-value">${escHtml(displayAmount(rowValue))}</span>
            <span class="sector-pct">${pct.toFixed(1)}%</span>
            <span class="sector-chevron ${isOpen ? 'open' : ''}" aria-hidden="true">▾</span>
            <span class="sector-mini-bar" aria-hidden="true"><span class="sector-mini-fill"></span></span>
          </button>
          <div class="sector-assets ${isOpen ? 'open' : ''}" id="${escAttr(panelId)}" ${isOpen ? '' : 'hidden'}>
            ${assetList}
          </div>
        `;
      }).join('');
    };
    const renderDonutPanel = (title, total, rows) => {
      const activeRows = rows
        .filter(row => safeNum(row.value) > 0)
        .sort((a, b) => safeNum(b.value) - safeNum(a.value));
      if (!activeRows.length || total <= 0) return '';
      let cursor = 0;
      const parts = activeRows.map(row => {
        const start = cursor;
        const pct = total > 0 ? (safeNum(row.value) / total) * 100 : 0;
        cursor = Math.min(360, cursor + (pct * 3.6));
        return `${row.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
      });
      if (cursor < 360) parts.push(`var(--surface-sunken) ${cursor.toFixed(2)}deg 360deg`);
      const top = activeRows.reduce((best, row) => !best || row.value > best.value ? row : best, null);
      const topPct = top && total > 0 ? (safeNum(top.value) / total) * 100 : 0;
      const legendRows = activeRows.slice(0, 3).map(row => {
        const pct = total > 0 ? (safeNum(row.value) / total) * 100 : 0;
        return `
          <div class="sector-donut-legend-row">
            <span class="legend-dot" data-color="${escAttr(row.color)}" aria-hidden="true"></span>
            <span class="sector-donut-legend-label">${escHtml(row.label)}</span>
            <strong>${pct.toFixed(1)}%</strong>
          </div>
        `;
      }).join('');
      return `
        <div class="sector-donut-panel">
          <div class="sector-donut" style="--sector-donut-gradient:${escAttr(parts.join(','))}"
            role="img" aria-label="${escAttr(group.label)} ${title} 도넛 차트">
            <div class="sector-donut-hole">
              <span>최대 섹터</span>
              <strong>${escHtml(top ? top.label : '-')}</strong>
              <em>${topPct.toFixed(1)}%</em>
            </div>
          </div>
          <div class="sector-donut-total">
            <strong>${escHtml(displayAmount(total))}</strong>
            <span>${activeRows.length}개 섹터</span>
          </div>
          <div class="sector-donut-legend">${legendRows}</div>
        </div>
      `;
    };
    const renderMetricPanel = (metric, title, total, rows) => `
      <div class="sector-metric-panel sector-metric-${escAttr(metric)}">
        <div class="sector-metric-title">${escHtml(title)}</div>
        <div class="sector-visual-grid">
          <div class="sector-list-panel">
            <div class="sector-list">${renderMetricRows(metric, rows)}</div>
          </div>
          ${renderDonutPanel(title, total, rows)}
        </div>
      </div>
    `;
    const hasCostCompare = showCostCompare && safeNum(group.costTotal) > 0 && costRows.length > 0;
    const unknown = group.unclassified && group.unclassified.length > 0
      ? `<div class="sector-note">기타 주식: ${escHtml(group.unclassified.map(a => a.name).slice(0, 4).join(', '))}${group.unclassified.length > 4 ? ' 외' : ''}</div>`
      : '';
    const regionClass = String(group.id || 'all').replace(/[^\w-]/g, '') || 'all';
    return `
      <div class="sector-region sector-region-${escAttr(regionClass)}">
        <div class="sector-region-title">
          <span>${escHtml(group.label)} 섹터</span>
          <strong>${escHtml(displayAmount(group.total))}</strong>
        </div>
        <div class="sector-comparison-grid ${hasCostCompare ? '' : 'sector-comparison-single'}">
          ${renderMetricPanel('value', '평가액 비중', group.total, valueRows)}
          ${hasCostCompare ? renderMetricPanel('cost', '투자 원금 비중', group.costTotal, costRows) : ''}
        </div>
        ${unknown}
      </div>
    `;
  }).join('');
  const regionLayoutClass = groups.length > 1 ? 'sector-region-grid' : 'sector-region-stack';
  return `
    <div class="stock-sector-section ${bare ? 'stock-sector-bare' : ''} ${compact ? 'stock-sector-compact' : ''}">
      ${showTitle ? '<div class="alloc-view-title">주식 섹터 분포</div>' : ''}
      <div class="${regionLayoutClass}">${groupSections}</div>
    </div>
  `;
}

function _renderTrendCard() {
  return `
    <div class="card" role="region" aria-label="자산 추이 차트">
      <div class="card-title">
        <span>자산 추이</span>
        <div class="btn-group" id="trendBtns" role="group" aria-label="기간 선택">
          <button class="btn-sm ${UIState.dashboardTrendDays === 7 ? 'active' : ''}" data-action="trend" data-days="7" aria-pressed="${UIState.dashboardTrendDays === 7}">7일</button>
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
  else if (action === 'toggle-stock-sector') { const sectorKey = target.dataset.sectorKey || target.dataset.sector; if (sectorKey) toggleStockSector(sectorKey); }
  else if (action === 'toggle-sector-cost-compare') toggleSectorCostCompare();
  else if (action === 'toggle-dash-total') toggleDashTotalHidden();
  else if (action === 'open-asset-detail') { const id = target.dataset.id; if (id) openAssetDetail(id); }
  else if (action === 'go-tab') { const tab = target.dataset.tab; if (tab) goTab(tab); }
  else if (action === 'toggle-dash-edit') toggleDashEditMode();
  else if (action === 'toggle-dash-card') { if (e) e.stopPropagation(); toggleDashCardHidden(target.dataset.card); }
  else if (action === 'dash-move-up') { if (e) e.stopPropagation(); moveDashCard(target.dataset.card, -1); }
  else if (action === 'dash-move-down') { if (e) e.stopPropagation(); moveDashCard(target.dataset.card, 1); }
  else if (action === 'reset-dash-prefs') doResetDashPrefs();
  else if (action === 'open-monthly-report') openMonthlyReport(target.dataset.month || null);
  else if (action === 'dismiss-monthly-report') dismissMonthlyReportCard(target.dataset.month);
}

function toggleStockSector(sectorId) {
  UIState.stockSectorOpen[sectorId] = !UIState.stockSectorOpen[sectorId];
  if (currentTab === 'pgAi') renderAnalysis();
  else if (currentTab === 'pgDash') renderDashboard();
}

function maskMoney() {
  return '••••••';
}

function isDashTotalHidden() {
  return !!loadDashPrefs().totalHidden;
}

function toggleDashTotalHidden() {
  const prefs = loadDashPrefs();
  saveDashPrefs({ totalHidden: !prefs.totalHidden });
  renderDashboard();
}

function isSectorCostCompareEnabled() {
  return loadDashPrefs().sectorCostCompare !== false;
}

function toggleSectorCostCompare() {
  const prefs = loadDashPrefs();
  saveDashPrefs({ sectorCostCompare: prefs.sectorCostCompare === false });
  if (currentTab === 'pgAi') renderAnalysis();
  else renderDashboard();
}

function _handleTrendClick(days, btn) {
  UIState.dashboardTrendDays = days;
  $$('#trendBtns .btn-sm').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
  renderTrendChart(days, { hideAbsolute: isDashTotalHidden() });
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

function isDashCardVisible(cardId) {
  if (!cardId) return true;
  const prefs = loadDashPrefs();
  return !(prefs.hidden || []).includes(cardId);
}

function setDashCardVisible(cardId, visible) {
  if (!cardId) return;
  const prefs = loadDashPrefs();
  const hidden = new Set(prefs.hidden || []);
  if (visible) hidden.delete(cardId);
  else hidden.add(cardId);
  saveDashPrefs({ order: _getDashOrder(prefs), hidden: [...hidden] });
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
  const issueLogs = updateLogs.filter(entry => !entry.ok || entry.cacheFallback || entry.stale);
  const issueSet = new Set(issueLogs);
  const visibleLogs = [
    ...issueLogs,
    ...updateLogs.slice(-10).filter(entry => !issueSet.has(entry)),
  ];
  const fallbackNames = formatAffectedAssetNames(issueLogs.filter(entry => entry.cacheFallback).map(entry => entry.assetName || entry.name));
  const failedNames = formatAffectedAssetNames(issueLogs.filter(entry => !entry.ok).map(entry => entry.assetName || entry.name));
  const staleNames = formatAffectedAssetNames(issueLogs.filter(entry => entry.stale).map(entry => entry.assetName || entry.name));
  const issueRows = [];
  if (fallbackNames) issueRows.push(`<div><span>이전 저장 가격 사용</span><strong>${escHtml(fallbackNames)}</strong></div>`);
  if (failedNames) issueRows.push(`<div><span>시세 연결 실패</span><strong>${escHtml(failedNames)}</strong></div>`);
  if (staleNames) issueRows.push(`<div><span>가격 확인 필요</span><strong>${escHtml(staleNames)}</strong></div>`);
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
      ${issueRows.length > 0 ? `
        <div class="update-issue-summary" role="alert">
          <div class="update-issue-title">⚠️ 확인이 필요한 자산</div>
          ${issueRows.join('')}
        </div>
      ` : ''}
      <div id="updateLogs" class="update-logs" aria-label="업데이트 로그">
        ${visibleLogs.map(l => {
          const cls = !l.ok ? 'log-fail' : (l.cacheFallback ? 'log-cache' : (l.stale ? 'log-stale' : 'log-ok'));
          const prefix = l.stale ? '⚠️ ' : '';
          const right = !l.ok ? '✗ 실패'
            : (l.price ? prefix + escHtml(fmtPrice(l.price)) : '✓');
          const storedMs = new Date(l.cacheStoredAt || '').getTime();
          const storedAge = Number.isFinite(storedMs) && storedMs > 0 ? formatRateAge(storedMs) : '저장 시각을 알 수 없음';
          const errorLabel = l.originStatus ? `시세 서버 오류 ${l.originStatus}`
            : (l.fallbackReason === 'network-error' ? '네트워크 연결 실패'
              : (l.fallbackReason === 'app-cache' ? '시세 연결 실패' : '시세 서버 연결 실패'));
          const fallbackDetail = l.cacheFallback
            ? `${errorLabel} — 이전 저장 가격 사용 · ${storedAge}${l.stale ? ' · 값 미변화 의심' : ''}`
            : '';
          const problemDetail = !l.ok ? '최신 시세를 가져오지 못했습니다'
            : (fallbackDetail || (l.stale ? '값 미변화 의심 — 이전 가격과 동일합니다' : ''));
          const titleText = problemDetail;
          const title = titleText ? `title="${escAttr(titleText)}"` : '';
          const aria = problemDetail ? `aria-label="${escAttr(`${l.name}, ${problemDetail}, ${l.price ? fmtPrice(l.price) : ''}`)}"` : '';
          return `<div class="log-item ${cls}" role="listitem" ${title} ${aria}>
            <span class="log-name">${escHtml(l.name)}${problemDetail ? `<small class="log-detail">${escHtml(problemDetail)}</small>` : ''}</span>
            <span class="log-value">${right}</span>
          </div>`;
        }).join('')}
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

  if (summary && summary.skipped) {
    // 백그라운드 업데이트와 충돌 — autoUpdateAll이 이미 안내 토스트를 띄움
  } else if (summary && summary.total > 0) {
    const parts = [`최신 ${summary.success}건`];
    const fallbackNames = formatAffectedAssetNames(summary.fallbackAssets);
    const failedNames = formatAffectedAssetNames(summary.failedAssets);
    const staleNames = formatAffectedAssetNames(summary.staleAssets);
    if (summary.fallback > 0) parts.push(`⚠️ 이전 저장 가격 ${summary.fallback}건${fallbackNames ? ` (${fallbackNames})` : ''}`);
    if (summary.failed > 0) parts.push(`실패 ${summary.failed}건${failedNames ? ` (${failedNames})` : ''}`);
    if (summary.stale > 0) parts.push(`가격 확인 필요 ${summary.stale}건${staleNames ? ` (${staleNames})` : ''}`);
    const msg = `가격 업데이트: ${parts.join(' · ')}`;
    const toastType = (summary.fallback > 0 || summary.failed > 0 || summary.stale > 0) ? 'info' : 'success';
    showToast(msg, toastType);
  } else {
    showToast('업데이트할 자산이 없습니다', 'info');
  }

  renderDashboard();
  renderPageHeader();
}

function renderPieLegend(catTotals, total, options = {}) {
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
          <span class="legend-value">${escHtml(options.hideAmounts ? maskMoney() : fmtKRW(val))}</span>
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
  const periods = [
    { label: '1주', days: 7 },
    { label: '1개월', days: 30 },
    { label: '3개월', days: 90 },
    { label: '6개월', days: 180 },
    { label: '1년', days: 365 },
  ];
  return calcSnapshotPeriodChanges(appState.history, periods);
}
