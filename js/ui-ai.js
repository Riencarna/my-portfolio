/* =============================================
   My Portfolio v5.16.0 — Analysis UI
   Cycle C compatible
   Soft Neutral palette, stagger animations
   ============================================= */

function renderAnalysis() {
  const container = $('#pgAi');
  if (!container) return;

  const total = calcTotal(appState.assets);
  const catTotals = calcCategoryTotals(appState.assets);

  const sections = [
    renderGoalSection(total),
    renderAllocationSection(total, catTotals),
    renderDiversificationSection(catTotals, total),
    renderRiskSection(catTotals, total),
    renderPeriodReturnsSection(),
    renderBenchmarkSection(),
    renderStrategySection(catTotals, total),
  ].filter(Boolean);

  let staggerIdx = 0;
  container.innerHTML = sections.map(html =>
    html.replace('<div class="card"', `<div class="card stagger-item" style="--i:${staggerIdx++}"`)
  ).join('');

  _setupAnalysisDelegation(container);
  _setupGoalAmountHint();
  _setupAllocationLiveSum();
}

function _setupGoalAmountHint() {
  const pairs = [
    ['goalAmount', 'goalAmountHint'],
    ['goalMonthlySaving', 'goalMonthlySavingHint'],
    ['goalMonthlyExpense', 'goalMonthlyExpenseHint'],
  ];
  for (const [inputId, hintId] of pairs) {
    const input = document.getElementById(inputId);
    const hint = document.getElementById(hintId);
    if (!input || !hint) continue;
    const update = () => { hint.textContent = fmtAmountHint(input.value); };
    input.addEventListener('input', update);
    update();
  }
}

function _setupAnalysisDelegation(container) {
  function handleAction(target) {
    const action = target.dataset.action;
    if (action === 'set-goal') doSetGoal();
    else if (action === 'edit-goal') doEditGoal();
    else if (action === 'cancel-goal-edit') doCancelGoalEdit();
    else if (action === 'clear-goal') doClearGoal();
    else if (action === 'set-allocation') doSetAllocation();
    else if (action === 'edit-allocation') doEditAllocation();
    else if (action === 'cancel-alloc-edit') doCancelAllocEdit();
    else if (action === 'clear-allocation') doClearAllocation();
    else if (action === 'toggle-alloc-override') doToggleAllocOverride();
    else if (action === 'load-benchmark') loadBenchmark();
  }
  container.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (target) handleAction(target);
  };
  container.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-action]');
    if (target) { e.preventDefault(); handleAction(target); }
  };
}

// ── Goal Section ──
function renderGoalSection(total) {
  const goal = appState.goal;
  const editing = UIState.goalEditMode;
  if (!goal || editing) {
    const defaultDate = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; })();
    const prefill = {
      amount: goal && goal.amount ? goal.amount : '',
      date: goal && goal.date ? goal.date : defaultDate,
      monthlySaving: goal && goal.monthlySaving ? goal.monthlySaving : '',
      expectedReturn: goal && goal.expectedReturn != null ? goal.expectedReturn : 7,
      monthlyExpense: goal && goal.monthlyExpense ? goal.monthlyExpense : '',
    };
    return `
      <div class="card" role="region" aria-label="재무 목표 설정">
        <div class="card-title">
          재무 목표 & FIRE 계산기
          ${editing ? '<button class="btn-sm" data-action="cancel-goal-edit" aria-label="편집 취소">취소</button>' : ''}
        </div>
        <p class="text-muted">목표 금액과 저축 계획을 입력하면 달성 예상 시점과 FIRE 진행률을 계산합니다.</p>
        <div class="goal-form">
          <label class="goal-field">
            <span class="goal-label">목표 금액</span>
            <input type="number" id="goalAmount" placeholder="예: 100000000" min="0" value="${escAttr(prefill.amount)}" aria-label="목표 금액">
            <div class="amount-hint" id="goalAmountHint"></div>
          </label>
          <label class="goal-field">
            <span class="goal-label">목표 날짜</span>
            <input type="date" id="goalDate" value="${escAttr(prefill.date)}" aria-label="목표 날짜">
          </label>
          <label class="goal-field">
            <span class="goal-label">월 저축액</span>
            <input type="number" id="goalMonthlySaving" placeholder="예: 1000000" min="0" value="${escAttr(prefill.monthlySaving)}" aria-label="월 저축액">
            <div class="amount-hint" id="goalMonthlySavingHint"></div>
          </label>
          <label class="goal-field">
            <span class="goal-label">연 기대 수익률 (%)</span>
            <input type="number" id="goalExpectedReturn" value="${escAttr(prefill.expectedReturn)}" step="0.1" aria-label="연 기대 수익률">
          </label>
          <label class="goal-field">
            <span class="goal-label">월 생활비 <span class="text-muted">(FIRE용, 선택)</span></span>
            <input type="number" id="goalMonthlyExpense" placeholder="예: 3000000" min="0" value="${escAttr(prefill.monthlyExpense)}" aria-label="월 생활비">
            <div class="amount-hint" id="goalMonthlyExpenseHint"></div>
          </label>
          <button class="btn-p goal-submit" data-action="set-goal">${editing ? '저장' : '설정'}</button>
        </div>
      </div>
    `;
  }

  const pct = goal.amount > 0 ? (total / goal.amount) * 100 : 0;
  const remain = goal.amount - total;
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.date) - new Date()) / 86400000));
  const monthlySaving = safeNum(goal.monthlySaving);
  const expectedReturn = safeNum(goal.expectedReturn != null ? goal.expectedReturn : 7);
  const monthlyExpense = safeNum(goal.monthlyExpense);

  const projMonths = projectMonthsToTarget(total, goal.amount, monthlySaving, expectedReturn);
  const projReachable = isFinite(projMonths);
  const projDate = projReachable ? addMonthsFromNow(projMonths) : '';
  const projLabel = projReachable ? fmtMonthsToKorean(projMonths) : '현재 계획으로는 도달 불가';

  const fireAmount = calcFireAmount(monthlyExpense);
  const firePct = fireAmount > 0 ? (total / fireAmount) * 100 : 0;

  return `
    <div class="card" role="region" aria-label="재무 목표 달성률">
      <div class="card-title">
        재무 목표 달성률
        <div class="card-title-actions">
          <button class="btn-sm" data-action="edit-goal" aria-label="목표 수정">수정</button>
          <button class="btn-sm" data-action="clear-goal" aria-label="목표 초기화">초기화</button>
        </div>
      </div>
      <div class="goal-progress">
        <div class="progress-bar progress-lg" role="progressbar"
          aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="목표 ${Math.round(pct)}% 달성">
          <div class="progress-fill" style="width:${Math.min(pct, 100)}%"></div>
        </div>
        <div class="goal-stats">
          <span>${escHtml(fmtPct(pct, 1))} 달성</span>
          <span>남은 금액: ${escHtml(fmtKRW(Math.max(0, remain)))}</span>
          ${goal.date ? `<span>D-${daysLeft}</span>` : ''}
        </div>
        <div class="goal-detail">
          <span>현재: ${escHtml(fmtKRW(total))}</span>
          <span>목표: ${escHtml(fmtKRW(goal.amount))}</span>
        </div>
        ${remain > 0 ? `
          <div class="goal-projection">
            <div class="goal-projection-row">
              <span class="goal-projection-label">예상 도달</span>
              <span class="goal-projection-value">${escHtml(projLabel)}${projDate ? ` <span class="text-muted">(${escHtml(projDate)})</span>` : ''}</span>
            </div>
            <div class="goal-projection-row text-muted">
              월 ${escHtml(fmtKRW(monthlySaving))} 저축 · 연 ${expectedReturn}% 복리 기준
            </div>
          </div>
        ` : ''}
      </div>
      ${monthlyExpense > 0 ? `
        <div class="fire-section">
          <div class="fire-title">🔥 FIRE 진행률 <span class="text-muted">(월 생활비 × 300, 4% 룰)</span></div>
          <div class="progress-bar progress-lg" role="progressbar"
            aria-valuenow="${Math.round(firePct)}" aria-valuemin="0" aria-valuemax="100" aria-label="FIRE ${Math.round(firePct)}% 달성">
            <div class="progress-fill fire-fill" style="width:${Math.min(firePct, 100)}%"></div>
          </div>
          <div class="goal-stats">
            <span>${escHtml(fmtPct(firePct, 1))} 달성</span>
            <span>FIRE 자산: ${escHtml(fmtKRW(fireAmount))}</span>
            <span>남은 금액: ${escHtml(fmtKRW(Math.max(0, fireAmount - total)))}</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function doSetGoal() {
  const amount = safeNum($('#goalAmount')?.value);
  const date = $('#goalDate')?.value;
  const monthlySaving = safeNum($('#goalMonthlySaving')?.value);
  const expectedReturn = safeNum($('#goalExpectedReturn')?.value);
  const monthlyExpense = safeNum($('#goalMonthlyExpense')?.value);
  if (amount <= 0) { showToast('유효한 목표 금액을 입력하세요', 'error'); return; }
  if (!date || !isValidDate(date)) { showToast('유효한 날짜를 입력하세요', 'error'); return; }
  setGoal({ amount, date, monthlySaving, expectedReturn, monthlyExpense });
  UIState.goalEditMode = false;
  renderAnalysis();
  renderDashboard();
  showToast('목표 설정 완료', 'success');
}

function doEditGoal() {
  UIState.goalEditMode = true;
  renderAnalysis();
}

function doCancelGoalEdit() {
  UIState.goalEditMode = false;
  renderAnalysis();
}

function doClearGoal() {
  openConfirmModal('재무 목표를 초기화하시겠습니까?', () => {
    clearGoal();
    UIState.goalEditMode = false;
    renderAnalysis();
    renderDashboard();
    showToast('목표가 초기화되었습니다', 'success');
  });
}

// ── Allocation Targets ──
function renderAllocationSection(total, catTotals) {
  if (total <= 0) return '';
  const alloc = appState.allocation;
  const editing = UIState.allocationEditMode;
  const hasAlloc = alloc && alloc.enabled;

  if (!hasAlloc || editing) {
    return _renderAllocationEditor(alloc, editing);
  }
  return _renderAllocationView(alloc, total, catTotals);
}

function _renderAllocationEditor(alloc, editing) {
  const enabled = editing ? !!(alloc && alloc.enabled) : true;
  const assetOverride = !!(alloc && alloc.assetOverride);
  const cats = (alloc && alloc.categories) || DEFAULT_ALLOCATION_CATEGORIES;
  const assetTargets = (alloc && alloc.assets) || {};
  const threshold = (alloc && alloc.driftThreshold != null) ? alloc.driftThreshold : ALLOC_DRIFT_THRESHOLD_DEFAULT;
  const sumPct = sumAllocationCategoryPct(cats);
  const sumOk = Math.abs(sumPct - 100) < 0.1;

  const catInputs = CATEGORIES.map(c => `
    <label class="alloc-cat-field">
      <span class="alloc-cat-label"><span class="alloc-cat-icon" aria-hidden="true">${c.icon}</span>${escHtml(c.label)}</span>
      <span class="alloc-pct-wrap">
        <input type="number" class="alloc-cat-input" data-alloc-cat="${escAttr(c.id)}"
          value="${escAttr(safeNum(cats[c.id]))}" min="0" max="100" step="0.1"
          aria-label="${escAttr(c.label)} 목표 비율">
        <span class="alloc-pct-suffix">%</span>
      </span>
    </label>
  `).join('');

  return `
    <div class="card" role="region" aria-label="자산 배분 목표 설정">
      <div class="card-title">
        자산 배분 목표
        ${editing ? '<button class="btn-sm" data-action="cancel-alloc-edit" aria-label="편집 취소">취소</button>' : ''}
      </div>
      <p class="text-muted">카테고리별 목표 비율을 설정하면 편차를 추적하고 리밸런싱 제안을 받을 수 있습니다.</p>

      <div class="alloc-form">
        <label class="alloc-toggle-row">
          <input type="checkbox" id="allocEnabled" ${enabled ? 'checked' : ''} aria-label="배분 목표 사용">
          <span class="alloc-toggle-label">배분 목표 사용</span>
        </label>

        <div class="alloc-section-title">카테고리별 목표 비율</div>
        <div class="alloc-cat-grid">${catInputs}</div>
        <div class="alloc-sum-indicator ${sumOk ? 'ok' : 'warn'}" id="allocSumIndicator">
          합계: <strong>${sumPct.toFixed(1)}%</strong> ${sumOk ? '✓' : '⚠️ 100%가 아닙니다'}
        </div>

        <label class="alloc-toggle-row">
          <input type="checkbox" id="allocOverride" ${assetOverride ? 'checked' : ''}
            data-action="toggle-alloc-override" aria-label="개별 종목 타겟 활성화">
          <span class="alloc-toggle-label">개별 종목 타겟 활성화 <span class="text-muted">(일부 종목에 별도 목표 설정)</span></span>
        </label>

        ${assetOverride ? _renderAssetTargetList(assetTargets) : ''}

        <label class="alloc-field">
          <span class="alloc-label">편차 경고 임계값 (%)</span>
          <input type="number" id="allocThreshold" value="${escAttr(threshold)}" min="0" max="50" step="0.5"
            aria-label="편차 경고 임계값">
          <div class="text-muted" style="font-size:12px">이 값 이상 벗어나면 🚨 경고를 표시합니다.</div>
        </label>

        <div class="alloc-actions">
          <button class="btn-p" data-action="set-allocation">저장</button>
          ${alloc ? '<button class="btn-sm" data-action="clear-allocation" aria-label="배분 목표 초기화">초기화</button>' : ''}
        </div>
      </div>
    </div>
  `;
}

function _renderAssetTargetList(assetTargets) {
  if (!appState.assets || appState.assets.length === 0) {
    return '<div class="alloc-asset-empty text-muted">보유 자산이 없습니다.</div>';
  }
  const byCat = {};
  for (const a of appState.assets) {
    if (!byCat[a.category]) byCat[a.category] = [];
    byCat[a.category].push(a);
  }
  const groups = CATEGORIES.map(c => {
    const arr = byCat[c.id];
    if (!arr || arr.length === 0) return '';
    const rows = arr.map(a => {
      const v = safeNum(assetTargets[String(a.id)]);
      const hasTarget = assetTargets[String(a.id)] != null;
      return `
        <label class="alloc-asset-row">
          <span class="alloc-asset-name">${escHtml(a.name)}</span>
          <span class="alloc-pct-wrap">
            <input type="number" class="alloc-asset-input" data-alloc-asset="${escAttr(String(a.id))}"
              value="${hasTarget ? escAttr(v) : ''}" placeholder="미설정" min="0" max="100" step="0.1"
              aria-label="${escAttr(a.name)} 목표 비율">
            <span class="alloc-pct-suffix">%</span>
          </span>
        </label>
      `;
    }).join('');
    return `
      <div class="alloc-asset-group">
        <div class="alloc-asset-group-title">${c.icon} ${escHtml(c.label)}</div>
        ${rows}
      </div>
    `;
  }).filter(Boolean).join('');
  return `
    <div class="alloc-asset-wrap">
      <div class="text-muted" style="font-size:12px;margin-bottom:6px">개별 타겟을 두고 싶은 종목에만 % 입력. 빈 칸은 해당 카테고리 일반 배분에 포함됩니다.</div>
      ${groups}
    </div>
  `;
}

function _renderAllocationView(alloc, total, catTotals) {
  const driftRows = calcAllocationDrift(appState.assets, alloc, total, catTotals);
  const threshold = safeNum(alloc.driftThreshold != null ? alloc.driftThreshold : ALLOC_DRIFT_THRESHOLD_DEFAULT);
  const suggestions = getRebalancingSuggestions(driftRows, threshold);

  return `
    <div class="card" role="region" aria-label="자산 배분 목표 및 편차">
      <div class="card-title">
        자산 배분 목표
        <div class="card-title-actions">
          <button class="btn-sm" data-action="edit-allocation" aria-label="배분 목표 수정">수정</button>
          <button class="btn-sm" data-action="clear-allocation" aria-label="배분 목표 초기화">초기화</button>
        </div>
      </div>

      <div class="alloc-view-section">
        <div class="alloc-view-title">목표 vs 현재 편차 (임계값 ±${threshold}%)</div>
        ${_renderAllocDriftBars(driftRows, threshold)}
      </div>

      <div class="alloc-view-section">
        <div class="alloc-view-title">리밸런싱 제안</div>
        ${_renderAllocSuggestions(suggestions, threshold)}
      </div>
    </div>
  `;
}

function _renderAllocDriftBars(rows, threshold) {
  if (!rows || rows.length === 0) {
    return '<div class="text-muted">표시할 편차가 없습니다. 카테고리 목표를 설정하세요.</div>';
  }
  const MAX_VISUAL_DRIFT = Math.max(10, threshold * 2);  // 막대 스케일 기준점
  return `<div class="alloc-drift-list">${
    rows.map(r => {
      const absDrift = Math.min(Math.abs(r.driftPct), MAX_VISUAL_DRIFT);
      const fillWidth = (absDrift / MAX_VISUAL_DRIFT) * 50;  // 중앙에서 뻗어나가므로 최대 50%
      const side = r.driftPct >= 0 ? 'right' : 'left';
      const statusIcon = r.status === 'over' ? '🚨' : (r.status === 'under' ? '🚨' : '✅');
      const sign = r.driftPct > 0 ? '+' : (r.driftPct < 0 ? '' : '±');
      return `
        <div class="alloc-drift-row alloc-${r.status}" role="listitem"
          aria-label="${escAttr(r.label)} 편차 ${sign}${r.driftPct.toFixed(1)}%">
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
    }).join('')
  }</div>`;
}

function _renderAllocSuggestions(suggestions, threshold) {
  if (!suggestions || suggestions.length === 0) {
    return `<div class="alloc-sug-ok">✅ 모든 카테고리가 목표 ±${threshold}% 이내입니다. 리밸런싱 불필요.</div>`;
  }
  return `<ul class="alloc-sug-list">${
    suggestions.map(s => {
      const verb = s.direction === 'sell' ? '매도' : '추가';
      const icon = s.direction === 'sell' ? '📤' : '📥';
      return `
        <li class="alloc-sug-item alloc-${s.status}">
          <span aria-hidden="true">${icon}</span>
          <strong>${escHtml(s.label)}</strong>
          <span class="alloc-sug-detail">${s.direction === 'sell' ? '+' : '-'}${Math.abs(s.driftPct).toFixed(1)}% → 약 ${escHtml(fmtKRW(s.rebalanceAmt))} ${verb} 권장</span>
        </li>
      `;
    }).join('')
  }</ul>`;
}

function _readAllocationForm() {
  const enabled = !!$('#allocEnabled')?.checked;
  const assetOverride = !!$('#allocOverride')?.checked;
  const threshold = safeNum($('#allocThreshold')?.value);
  const categories = {};
  document.querySelectorAll('.alloc-cat-input').forEach(el => {
    categories[el.dataset.allocCat] = safeNum(el.value);
  });
  const assets = {};
  if (assetOverride) {
    document.querySelectorAll('.alloc-asset-input').forEach(el => {
      const v = el.value.trim();
      if (v === '') return;
      const n = safeNum(v);
      assets[el.dataset.allocAsset] = n;
    });
  }
  return { enabled, assetOverride, categories, assets, driftThreshold: threshold };
}

function doSetAllocation() {
  const opts = _readAllocationForm();
  if (!opts.enabled) {
    showToast('먼저 "배분 목표 사용"을 켜주세요', 'error');
    return;
  }
  setAllocation(opts);
  UIState.allocationEditMode = false;
  renderAnalysis();
  renderDashboard();
  const sum = sumAllocationCategoryPct(opts.categories);
  if (Math.abs(sum - 100) >= 0.1) {
    showToast(`⚠️ 저장됨 (합계 ${sum.toFixed(1)}%, 권장 100%)`, 'info');
  } else {
    showToast('배분 목표 저장 완료', 'success');
  }
}

function doEditAllocation() {
  UIState.allocationEditMode = true;
  renderAnalysis();
}

function doCancelAllocEdit() {
  UIState.allocationEditMode = false;
  renderAnalysis();
}

function doClearAllocation() {
  openConfirmModal('자산 배분 목표를 초기화하시겠습니까?', () => {
    clearAllocation();
    UIState.allocationEditMode = false;
    renderAnalysis();
    renderDashboard();
    showToast('배분 목표가 초기화되었습니다', 'success');
  });
}

function doToggleAllocOverride() {
  // 체크박스 click 이벤트 시점에는 checked가 이미 변경됨.
  // 자산 목록 DOM을 삽입/제거만 하면 됨 (카테고리 입력값은 유지).
  const override = !!$('#allocOverride')?.checked;
  const wrap = document.querySelector('.alloc-asset-wrap');
  if (override && !wrap) {
    const overrideRow = $('#allocOverride')?.closest('.alloc-toggle-row');
    if (overrideRow) {
      const html = _renderAssetTargetList((appState.allocation && appState.allocation.assets) || {});
      overrideRow.insertAdjacentHTML('afterend', html);
    }
  } else if (!override && wrap) {
    wrap.remove();
  }
}

// 카테고리 입력 합계를 실시간 업데이트
function _setupAllocationLiveSum() {
  const indicator = document.getElementById('allocSumIndicator');
  if (!indicator) return;
  const update = () => {
    const cats = {};
    document.querySelectorAll('.alloc-cat-input').forEach(el => {
      cats[el.dataset.allocCat] = safeNum(el.value);
    });
    const sum = sumAllocationCategoryPct(cats);
    const ok = Math.abs(sum - 100) < 0.1;
    indicator.className = `alloc-sum-indicator ${ok ? 'ok' : 'warn'}`;
    indicator.innerHTML = `합계: <strong>${sum.toFixed(1)}%</strong> ${ok ? '✓' : '⚠️ 100%가 아닙니다'}`;
  };
  document.querySelectorAll('.alloc-cat-input').forEach(el => {
    el.addEventListener('input', update);
  });
}

// ── Diversification ──
function renderDiversificationSection(catTotals, total) {
  if (total === 0) return '';
  const weights = Object.values(catTotals).filter(v => v > 0).map(v => v / total);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const score = Math.round((1 - hhi) * 100);
  const activeCats = weights.length;

  const assetValues = appState.assets.map(a => ({
    name: a.name, value: calcAssetValue(a).value,
  })).sort((a, b) => b.value - a.value);
  const top3 = assetValues.slice(0, 3);
  const top3Pct = total > 0 ? (top3.reduce((s, a) => s + a.value, 0) / total) * 100 : 0;

  let scoreLabel, scoreColor;
  if (score >= 70) { scoreLabel = '우수'; scoreColor = '#6BBF8A'; }
  else if (score >= 40) { scoreLabel = '보통'; scoreColor = '#E8B474'; }
  else { scoreLabel = '집중'; scoreColor = '#E8788A'; }

  return `
    <div class="card" role="region" aria-label="분산투자 진단">
      <div class="card-title">분산투자 진단</div>
      <div class="score-display">
        <div class="score-circle" data-border-color="${escAttr(scoreColor)}" role="meter"
          aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100" aria-label="분산투자 점수 ${score}점">
          <span class="score-number">${score}</span>
          <span class="score-label">${scoreLabel}</span>
        </div>
        <div class="score-details">
          <div class="score-detail">활성 카테고리: <strong>${activeCats}개 / ${CATEGORIES.length}개</strong></div>
          <div class="score-detail">상위 3 자산 비중: <strong>${top3Pct.toFixed(1)}%</strong></div>
          ${top3.map(a => `
            <div class="score-detail text-muted">${escHtml(a.name)}: ${escHtml(fmtKRW(a.value))} (${((a.value / total) * 100).toFixed(1)}%)</div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── Risk Analysis ──
function renderRiskSection(catTotals, total) {
  if (total === 0) return '';
  const risks = [];
  const safePct = ((safeNum(catTotals['현금']) + safeNum(catTotals['예적금'])) / total) * 100;
  const cryptoPct = (safeNum(catTotals['코인']) / total) * 100;
  const domesticPct = (safeNum(catTotals['국내주식']) / total) * 100;

  if (safePct < ANALYSIS_THRESHOLDS.safeLow) {
    risks.push({ level: 'high', msg: `안전자산 비중이 ${safePct.toFixed(1)}%로 매우 낮습니다. (권장: ${ANALYSIS_THRESHOLDS.safeLow}% 이상)` });
  }
  if (cryptoPct > ANALYSIS_THRESHOLDS.cryptoHigh) {
    risks.push({ level: 'high', msg: `코인 비중이 ${cryptoPct.toFixed(1)}%입니다. 변동성이 높은 자산이 과다합니다.` });
  }

  const assetVals = appState.assets.map(a => ({ name: a.name, value: calcAssetValue(a).value }));
  const maxAsset = assetVals.sort((a, b) => b.value - a.value)[0];
  if (maxAsset && (maxAsset.value / total) > (ANALYSIS_THRESHOLDS.singleAssetMax / 100)) {
    risks.push({ level: 'high', msg: `"${maxAsset.name}"이(가) 전체의 ${((maxAsset.value / total) * 100).toFixed(1)}%를 차지합니다.` });
  }
  if (domesticPct > ANALYSIS_THRESHOLDS.domesticRisk) {
    risks.push({ level: 'medium', msg: `국내주식 비중이 ${domesticPct.toFixed(1)}%입니다. 해외 분산 투자를 고려하세요.` });
  }

  const bigLoss = appState.assets.filter(a => {
    const v = calcAssetValue(a);
    return v.profitPct < ANALYSIS_THRESHOLDS.bigLoss && v.cost > 0;
  });
  if (bigLoss.length > 0) {
    risks.push({ level: 'medium', msg: `큰 손실 중인 자산 ${bigLoss.length}개: ${bigLoss.map(a => a.name).join(', ')}` });
  }

  if (risks.length === 0) {
    return `<div class="card" role="region" aria-label="리스크 진단"><div class="card-title">리스크 진단</div><div class="risk-ok" role="status">✓ 특별한 리스크 요인이 발견되지 않았습니다.</div></div>`;
  }

  return `
    <div class="card" role="region" aria-label="리스크 진단">
      <div class="card-title">리스크 진단</div>
      <div class="risk-list" role="list">
        ${risks.map(r => `
          <div class="risk-item risk-${r.level}" role="listitem">
            <span class="risk-icon" aria-hidden="true">${r.level === 'high' ? '🔴' : '🟡'}</span>
            <span>${escHtml(r.msg)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Period Returns ──
function renderPeriodReturnsSection() {
  const returns = calcPeriodReturns();
  if (!returns) return '';
  return `
    <div class="card" role="region" aria-label="기간별 수익률">
      <div class="card-title">기간별 수익률</div>
      <div class="period-grid" role="list">
        ${returns.map(p => `
          <div class="period-item" role="listitem" aria-label="${escAttr(p.label)} 수익률 ${fmtPct(p.ret)}">
            <div class="period-label">${escHtml(p.label)}</div>
            <div class="period-value ${p.ret >= 0 ? 'positive' : 'negative'}">${escHtml(fmtPct(p.ret))}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Benchmark ──
function renderBenchmarkSection() {
  return `
    <div class="card" role="region" aria-label="벤치마크 비교">
      <div class="card-title">
        벤치마크 비교
        <button class="btn-sm" id="btnBenchmark" data-action="load-benchmark" aria-label="벤치마크 데이터 불러오기">불러오기</button>
      </div>
      <div id="benchmarkResult">
        <p class="text-muted">KOSPI / S&P500과 내 포트폴리오 수익률을 비교합니다.</p>
      </div>
    </div>
  `;
}

async function loadBenchmark() {
  const btn = $('#btnBenchmark');
  if (btn) { btn.disabled = true; btn.textContent = '로딩...'; }

  try {
    const data = await fetchBenchmarkReturns();
    const myReturn = calcPeriodReturns();
    const myYtd = myReturn?.find(p => p.label === '1년')?.ret || 0;

    let html = '<div class="benchmark-grid" role="list">';
    html += `<div class="benchmark-item" role="listitem"><div class="benchmark-label">내 포트폴리오 (1년)</div><div class="benchmark-value ${profitClass(myYtd)}">${escHtml(fmtPct(myYtd))}</div></div>`;
    if (data.kospi) {
      html += `<div class="benchmark-item" role="listitem"><div class="benchmark-label">KOSPI (1년)</div><div class="benchmark-value ${profitClass(data.kospi.ytd)}">${escHtml(fmtPct(data.kospi.ytd))}</div></div>`;
    }
    if (data.sp500) {
      html += `<div class="benchmark-item" role="listitem"><div class="benchmark-label">S&P 500 (1년)</div><div class="benchmark-value ${profitClass(data.sp500.ytd)}">${escHtml(fmtPct(data.sp500.ytd))}</div></div>`;
    }
    html += '</div>';

    const result = $('#benchmarkResult');
    if (result) result.innerHTML = html;
  } catch (e) {
    console.error('Benchmark load failed:', e);
    showToast('벤치마크 데이터 로드 실패', 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = '새로고침'; }
}

// ── Strategies ──
function renderStrategySection(catTotals, total) {
  if (total === 0) return '';
  const strategies = [];
  const safePct = (safeNum(catTotals['현금']) + safeNum(catTotals['예적금'])) / total * 100;
  const cryptoPct = safeNum(catTotals['코인']) / total * 100;
  const foreignPct = safeNum(catTotals['해외주식']) / total * 100;
  const domesticPct = safeNum(catTotals['국내주식']) / total * 100;

  if (safePct < ANALYSIS_THRESHOLDS.safeLow) strategies.push({ icon: '🛡️', text: `비상금 확보: 안전자산(현금/예적금) 비중을 ${ANALYSIS_THRESHOLDS.safeLow}~20%로 늘리는 것을 고려하세요.` });
  if (foreignPct < ANALYSIS_THRESHOLDS.foreignLow && domesticPct > ANALYSIS_THRESHOLDS.domesticHigh) strategies.push({ icon: '🌍', text: `해외 분산: 해외주식/ETF 비중을 ${ANALYSIS_THRESHOLDS.foreignLow}% 이상으로 늘려 글로벌 분산 효과를 노려보세요.` });
  if (cryptoPct > ANALYSIS_THRESHOLDS.cryptoHigh) strategies.push({ icon: '⚖️', text: '리밸런싱: 코인 비중이 높습니다. 일부를 안정적인 자산으로 재배분하세요.' });
  if (appState.assets.length < 5) strategies.push({ icon: '📊', text: '자산 다양화: 보유 자산이 적습니다. 다양한 카테고리에 분산 투자하세요.' });
  if (appState.history.length < 7) strategies.push({ icon: '📈', text: '기록 축적: 꾸준히 기록하면 자산 추이를 분석할 수 있습니다.' });
  if (strategies.length === 0) strategies.push({ icon: '✨', text: '포트폴리오가 잘 분산되어 있습니다. 현재 전략을 유지하세요!' });

  return `
    <div class="card" role="region" aria-label="성장 전략">
      <div class="card-title">성장 전략</div>
      <div class="strategy-list" role="list">
        ${strategies.map(s => `
          <div class="strategy-item" role="listitem">
            <span class="strategy-icon" aria-hidden="true">${s.icon}</span>
            <span>${escHtml(s.text)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
