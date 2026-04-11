/* =============================================
   My Portfolio v5.1.0 — Income UI
   Soft Neutral palette + dash-charts 재사용
   Planner-Creator-Evaluator Cycle 3
   ============================================= */

function renderIncome() {
  const container = $('#pgInc');
  if (!container) return;

  const [year, month] = UIState.incomeMonth.split('-').map(Number);
  const monthStr = `${year}년 ${month}월`;
  const items = getMonthIncome(year, month);
  const total = items.reduce((s, i) => s + safeNum(i.amount), 0);
  const prevItems = getMonthIncome(
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1
  );
  const prevTotal = prevItems.reduce((s, i) => s + safeNum(i.amount), 0);
  const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

  container.innerHTML = `
    <div class="card stagger-item" style="--i:0">
      <div class="month-nav" role="navigation" aria-label="월 탐색">
        <button class="btn-icon" data-action="change-month" data-delta="-1" aria-label="이전 달">◀</button>
        <span class="month-label" aria-live="polite">${escHtml(monthStr)}</span>
        <button class="btn-icon" data-action="change-month" data-delta="1" aria-label="다음 달">▶</button>
      </div>
      <div class="income-summary">
        <div class="income-total" aria-label="이번 달 총 수입">${escHtml(fmtKRW(total))}</div>
        ${prevTotal > 0 ? `
          <div class="income-growth ${growth >= 0 ? 'positive' : 'negative'}">
            전월 대비 ${escHtml(fmtPct(growth))}
          </div>
        ` : ''}
      </div>
    </div>

    <div class="card stagger-item" style="--i:1">
      <div class="card-title">
        수입 내역
        <button class="btn-p" data-action="open-add-income" aria-label="수입 추가">+ 추가</button>
      </div>
      ${renderIncomeItems(items)}
      ${prevItems.some(i => i.recurring) ? `
        <button class="btn-sm btn-mt" data-action="copy-recurring" data-year="${year}" data-month="${month}"
          aria-label="전월 반복 수입 복사">
          📋 전월 반복 수입 복사
        </button>
      ` : ''}
    </div>

    <div class="dash-charts">
      <div class="card stagger-item" style="--i:2">
        <div class="card-title">카테고리별</div>
        <div class="chart-wrap chart-wrap-220" role="img" aria-label="수입 카테고리 차트">
          <canvas id="chartIncPie"></canvas>
        </div>
        <div id="chartIncPieAlt"></div>
        ${renderIncomeCatLegend(items)}
      </div>
      <div class="card stagger-item" style="--i:3">
        <div class="card-title">최근 6개월 추이</div>
        <div class="chart-wrap chart-wrap-220" role="img" aria-label="6개월 수입 추이 차트">
          <canvas id="chartIncBar"></canvas>
        </div>
        <div id="chartIncBarAlt"></div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => renderIncomeCharts(items, year, month));

  _setupIncomeDelegation(container);
}

function _setupIncomeDelegation(container) {
  function handleAction(target) {
    const action = target.dataset.action;
    if (action === 'change-month') changeMonth(Number(target.dataset.delta));
    else if (action === 'open-add-income') openAddIncome();
    else if (action === 'edit-income') openEditIncome(target.dataset.id);
    else if (action === 'delete-income') doDeleteIncome(target.dataset.id);
    else if (action === 'copy-recurring') copyRecurring(Number(target.dataset.year), Number(target.dataset.month));
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

function getMonthIncome(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return appState.income.filter(i => i.date?.startsWith(prefix));
}

function renderIncomeItems(items) {
  if (items.length === 0) return '<div class="empty-state">이번 달 수입 내역이 없습니다</div>';
  const sorted = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
    <div class="income-list" role="list">
      ${sorted.map(i => {
        const cat = INCOME_MAP[i.cat] || INCOME_MAP.other;
        return `
          <div class="income-item" role="listitem">
            <div class="income-item-main">
              <span class="income-cat-icon" aria-hidden="true">${cat.icon}</span>
              <div>
                <div class="income-item-source">${escHtml(i.source || cat.label)}</div>
                <div class="income-item-date">${escHtml(fmtDate(i.date))} ${i.recurring ? '🔄' : ''}</div>
              </div>
            </div>
            <div class="income-item-right">
              <span class="income-item-amount">${escHtml(fmtKRW(i.amount))}</span>
              <button class="btn-icon" data-action="edit-income" data-id="${i.id}" aria-label="수입 수정">✎</button>
              <button class="btn-icon btn-danger" data-action="delete-income" data-id="${i.id}" aria-label="수입 삭제">✕</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderIncomeCatLegend(items) {
  const byCat = {};
  for (const i of items) byCat[i.cat] = (byCat[i.cat] || 0) + safeNum(i.amount);
  const total = items.reduce((s, i) => s + safeNum(i.amount), 0);
  if (total === 0) return '';
  return `
    <div class="pie-legend" role="list" aria-label="수입 카테고리 범례">
      ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([catId, val]) => {
        const cat = INCOME_MAP[catId] || INCOME_MAP.other;
        const pct = ((val / total) * 100).toFixed(1);
        return `
          <div class="legend-item" role="listitem">
            <span class="legend-label">${cat.icon} ${escHtml(cat.label)}</span>
            <span class="legend-value">${escHtml(fmtKRW(val))}</span>
            <span class="legend-pct">${pct}%</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Soft Neutral palette (v5.0.0)
const INCOME_COLORS = Object.freeze({
  salary: '#7C6FF0', bonus: '#A395F5', side: '#E8B474', invest: '#6BBF8A',
  rental: '#E8889E', interest: '#6B9DC7', other: '#B5ADA0',
});

function renderIncomeCharts(items, year, month) {
  destroyChart('incPie');
  const byCat = {};
  for (const i of items) byCat[i.cat] = (byCat[i.cat] || 0) + safeNum(i.amount);
  const catEntries = Object.entries(byCat).filter(([, v]) => v > 0);
  if (catEntries.length > 0) {
    charts.incPie = renderDoughnut('chartIncPie',
      catEntries.map(([id]) => (INCOME_MAP[id]?.label || id)),
      catEntries.map(([, v]) => v),
      catEntries.map(([id]) => INCOME_COLORS[id] || '#6B7280'),
      { centerText: { text: fmtKRW(items.reduce((s, i) => s + safeNum(i.amount), 0)), fontSize: 13 } }
    );

    const altContainer = document.getElementById('chartIncPieAlt');
    if (altContainer) {
      const totalInc = items.reduce((s, i) => s + safeNum(i.amount), 0);
      const rows = catEntries.map(([id, v]) => {
        const pct = totalInc > 0 ? ((v / totalInc) * 100).toFixed(1) + '%' : '0%';
        return [(INCOME_MAP[id]?.label || id), fmtKRW(v), pct];
      });
      altContainer.innerHTML = chartAltTable(['카테고리', '금액', '비중'], rows, '수입 카테고리 데이터');
    }
  }

  destroyChart('incBar');
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i, y = year;
    while (m <= 0) { m += 12; y--; }
    months.push({ y, m, label: `${m}월` });
  }
  const barData = months.map(({ y, m }) =>
    getMonthIncome(y, m).reduce((s, i) => s + safeNum(i.amount), 0)
  );
  if (barData.some(v => v > 0)) {
    const primary = getThemeColor('--primary') || '#7C6FF0';
    charts.incBar = renderBarChart('chartIncBar', months.map(m => m.label), barData, primary);

    const altContainer = document.getElementById('chartIncBarAlt');
    if (altContainer) {
      const rows = months.map((m, idx) => [m.label, fmtKRW(barData[idx])]);
      altContainer.innerHTML = chartAltTable(['월', '수입'], rows, '6개월 수입 추이 데이터');
    }
  }
}

function changeMonth(delta) {
  let [y, m] = UIState.incomeMonth.split('-').map(Number);
  m += delta;
  if (m > 12) { m = 1; y++; }
  if (m < 1) { m = 12; y--; }
  UIState.incomeMonth = `${y}-${String(m).padStart(2, '0')}`;
  renderIncome();
}

// ── Add Income Modal ──
function openAddIncome() {
  _modalCleanup.removeAll();

  const [year, month] = UIState.incomeMonth.split('-').map(Number);
  const day = Math.min(new Date().getDate(), new Date(year, month, 0).getDate());
  const defaultDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const container = $('#modalMain');
  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h3>수입 추가</h3>
        <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label id="incCatLabel">카테고리</label>
          ${renderIncomeCatSelector('salary', 'incCatLabel')}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="incAmount">금액 *</label>
            <input type="number" id="incAmount" placeholder="0" min="0" required>
          </div>
          <div class="form-group">
            <label for="incDate">날짜</label>
            <input type="date" id="incDate" value="${defaultDate}">
          </div>
        </div>
        <div class="form-group">
          <label for="incSource">출처</label>
          <input type="text" id="incSource" placeholder="예: 회사, 알바 등" maxlength="100">
        </div>
        <div class="form-group">
          <label for="incMemo">메모</label>
          <input type="text" id="incMemo" placeholder="선택사항" maxlength="200">
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="incRecurring"> 매월 반복</label>
        </div>
        <div class="modal-actions">
          <button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button>
          <button class="btn-p" data-action="do-add-income">추가</button>
        </div>
      </div>
    </div>
  `;
  openModal('modalMain');
  _setupModalMainDelegation(container);
}

function doAddIncome() {
  const amount = safeNum($('#incAmount')?.value);
  if (amount <= 0) { showToast('금액을 입력하세요 (0보다 큰 값)', 'error'); return; }
  const cat = $('#modalMain .cat-btn.active')?.dataset?.cat || 'other';

  addIncome({
    amount, cat,
    date: $('#incDate')?.value || today(),
    source: $('#incSource')?.value.trim() || '',
    memo: $('#incMemo')?.value.trim() || '',
    recurring: $('#incRecurring')?.checked || false,
  });

  closeModal('modalMain');
  showToast('수입 추가됨', 'success');
  renderIncome();
}

function doDeleteIncome(id) {
  openConfirmModal('이 수입 기록을 삭제하시겠습니까?', () => {
    deleteIncome(id);
    renderIncome();
    showToast('삭제됨');
  });
}

// ── Edit Income Modal ──
function openEditIncome(id) {
  const item = appState.income.find(i => i.id === id);
  if (!item) return;
  const cat = item.cat || 'other';

  _modalCleanup.removeAll();

  const container = $('#modalMain');
  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h3>수입 수정</h3>
        <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label id="editIncCatLabel">카테고리</label>
          ${renderIncomeCatSelector(cat, 'editIncCatLabel')}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="editIncAmount">금액 *</label>
            <input type="number" id="editIncAmount" value="${safeNum(item.amount)}" min="0" required>
          </div>
          <div class="form-group">
            <label for="editIncDate">날짜</label>
            <input type="date" id="editIncDate" value="${escAttr(item.date || '')}">
          </div>
        </div>
        <div class="form-group">
          <label for="editIncSource">출처</label>
          <input type="text" id="editIncSource" value="${escAttr(item.source || '')}" maxlength="100">
        </div>
        <div class="form-group">
          <label for="editIncMemo">메모</label>
          <input type="text" id="editIncMemo" value="${escAttr(item.memo || '')}" maxlength="200">
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="editIncRecurring" ${item.recurring ? 'checked' : ''}> 매월 반복</label>
        </div>
        <div class="modal-actions">
          <button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button>
          <button class="btn-p" data-action="do-edit-income" data-id="${id}">저장</button>
        </div>
      </div>
    </div>
  `;
  openModal('modalMain');
  _setupModalMainDelegation(container);
}

function doEditIncome(id) {
  const amount = safeNum($('#editIncAmount')?.value);
  if (amount <= 0) { showToast('금액을 입력하세요 (0보다 큰 값)', 'error'); return; }
  const cat = $('#modalMain .cat-btn.active')?.dataset?.cat || 'other';

  updateIncome(id, {
    amount, cat,
    date: $('#editIncDate')?.value || today(),
    source: $('#editIncSource')?.value.trim() || '',
    memo: $('#editIncMemo')?.value.trim() || '',
    recurring: $('#editIncRecurring')?.checked || false,
  });

  closeModal('modalMain');
  showToast('수입 수정됨', 'success');
  renderIncome();
}

// ── Copy Recurring ──
function copyRecurring(year, month) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const recurring = getMonthIncome(prevYear, prevMonth).filter(i => i.recurring);
  if (recurring.length === 0) { showToast('복사할 반복 수입이 없습니다', 'info'); return; }

  let count = 0;
  for (const r of recurring) {
    const exists = getMonthIncome(year, month).find(
      i => i.cat === r.cat && i.source === r.source && Math.abs(safeNum(i.amount) - safeNum(r.amount)) < 1
    );
    if (!exists) {
      const origDay = Number((r.date || '').split('-')[2]) || 1;
      const safeDay = clampDay(year, month, origDay);
      const newDate = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
      addIncome({ ...r, date: newDate, id: undefined });
      count++;
    }
  }
  showToast(count > 0 ? `${count}건 복사됨` : '이미 모두 복사됨', count > 0 ? 'success' : 'info');
  renderIncome();
}
