/* =============================================
   My Portfolio v5.13.1 — Analysis UI
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
}

function _setupGoalAmountHint() {
  const input = document.getElementById('goalAmount');
  const hint = document.getElementById('goalAmountHint');
  if (!input || !hint) return;
  const update = () => { hint.textContent = fmtAmountHint(input.value); };
  input.addEventListener('input', update);
  update();
}

function _setupAnalysisDelegation(container) {
  function handleAction(target) {
    const action = target.dataset.action;
    if (action === 'set-goal') doSetGoal();
    else if (action === 'clear-goal') doClearGoal();
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
  if (!goal) {
    return `
      <div class="card" role="region" aria-label="목표 설정">
        <div class="card-title">목표 설정</div>
        <p class="text-muted">자산 목표를 설정하면 진행률을 추적할 수 있습니다.</p>
        <div class="form-row">
          <div class="form-col-grow">
            <input type="number" id="goalAmount" placeholder="목표 금액" min="0" aria-label="목표 금액">
            <div class="amount-hint" id="goalAmountHint"></div>
          </div>
          <input type="date" id="goalDate" value="${(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; })()}" aria-label="목표 날짜">
          <button class="btn-p" data-action="set-goal">설정</button>
        </div>
      </div>
    `;
  }

  const pct = goal.amount > 0 ? (total / goal.amount) * 100 : 0;
  const remain = goal.amount - total;
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.date) - new Date()) / 86400000));

  return `
    <div class="card" role="region" aria-label="목표 달성률">
      <div class="card-title">
        목표 달성률
        <button class="btn-sm" data-action="clear-goal" aria-label="목표 초기화">초기화</button>
      </div>
      <div class="goal-progress">
        <div class="progress-bar progress-lg" role="progressbar"
          aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="목표 ${Math.round(pct)}% 달성">
          <div class="progress-fill" style="width:${Math.min(pct, 100)}%"></div>
        </div>
        <div class="goal-stats">
          <span>${escHtml(fmtPct(pct, 1))} 달성</span>
          <span>남은 금액: ${escHtml(fmtKRW(Math.max(0, remain)))}</span>
          <span>D-${daysLeft}</span>
        </div>
        <div class="goal-detail">
          <span>현재: ${escHtml(fmtKRW(total))}</span>
          <span>목표: ${escHtml(fmtKRW(goal.amount))}</span>
        </div>
        ${daysLeft > 0 && remain > 0 ? `
          <div class="goal-monthly text-muted">
            월 ${escHtml(fmtKRW(Math.ceil(remain / Math.max(1, Math.ceil(daysLeft / 30)))))} 추가 필요
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function doSetGoal() {
  const amount = safeNum($('#goalAmount')?.value);
  const date = $('#goalDate')?.value;
  if (amount <= 0) { showToast('유효한 금액을 입력하세요', 'error'); return; }
  if (!date || !isValidDate(date)) { showToast('유효한 날짜를 입력하세요', 'error'); return; }
  setGoal(amount, date);
  renderAnalysis();
  showToast('목표 설정 완료', 'success');
}

function doClearGoal() {
  clearGoal();
  renderAnalysis();
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
