/* =============================================
   My Portfolio v5.36.6 — Household Book UI
   Cycle C compatible
   ============================================= */

const BOOK_TYPES = Object.freeze({
  income: { label: '수입', sign: '+', cls: 'income', defaultCat: 'salary', sourceLabel: '출처', sourcePlaceholder: '예: 회사, 배당, 알바' },
  expense: { label: '지출', sign: '-', cls: 'expense', defaultCat: 'food', sourceLabel: '사용처', sourcePlaceholder: '예: 마트, 카페, 관리비' },
});

const BOOK_FILTERS = Object.freeze([
  { id: 'all', label: '전체' },
  { id: 'expense', label: '지출' },
  { id: 'income', label: '수입' },
]);

const INCOME_COLORS = Object.freeze({
  salary: '#7C6FF0', bonus: '#A395F5', side: '#E8B474', invest: '#6BBF8A',
  rental: '#E8889E', interest: '#6B9DC7', other: '#B5ADA0',
});

const EXPENSE_COLORS = Object.freeze({
  food: '#E8889E', cafe: '#D09A50', transport: '#6B9DC7', housing: '#7C6FF0',
  life: '#67A9A5', shopping: '#A395F5', health: '#6BBF8A', family: '#E8B474',
  tax: '#8FA3B8', travel: '#5368D6', other: '#B5ADA0',
});

const BOOK_CUSTOM_COLORS = Object.freeze([
  '#7C6FF0', '#E8889E', '#6B9DC7', '#6BBF8A', '#E8B474',
  '#A395F5', '#67A9A5', '#D09A50', '#8FA3B8', '#5368D6',
]);
const BOOK_CAT_MAX_PER_TYPE = 40;
let _bookCatManagerType = 'expense';

function getDefaultBookCategories(type) {
  return type === 'expense' ? EXPENSE_CATS : INCOME_CATS;
}

function getDefaultBookCategoryMap(type) {
  return type === 'expense' ? EXPENSE_MAP : INCOME_MAP;
}

function normalizeBookCategoryPrefs(raw) {
  const result = {
    income: { hidden: [], overrides: {}, custom: [] },
    expense: { hidden: [], overrides: {}, custom: [] },
  };

  for (const type of ['income', 'expense']) {
    const src = raw && typeof raw === 'object' && raw[type] && typeof raw[type] === 'object' ? raw[type] : {};
    const defaultIds = new Set(getDefaultBookCategories(type).map(c => c.id));

    result[type].hidden = Array.isArray(src.hidden)
      ? src.hidden.map(String).filter(id => id !== 'other' && defaultIds.has(id))
      : [];

    if (src.overrides && typeof src.overrides === 'object') {
      for (const [id, patch] of Object.entries(src.overrides)) {
        if (!defaultIds.has(id) || !patch || typeof patch !== 'object') continue;
        const label = stripHtml(patch.label, 30);
        const icon = stripHtml(patch.icon, 12);
        if (label || icon) result[type].overrides[id] = { label, icon };
      }
    }

    const seen = new Set(defaultIds);
    if (Array.isArray(src.custom)) {
      for (const c of src.custom) {
        if (!c || typeof c !== 'object') continue;
        const rawId = c.id ? String(c.id) : `custom_${uid()}`;
        const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
        const label = stripHtml(c.label, 30);
        const icon = stripHtml(c.icon, 12) || '🏷️';
        if (!id || !label || seen.has(id)) continue;
        result[type].custom.push({ id, label, icon });
        seen.add(id);
        if (result[type].custom.length >= BOOK_CAT_MAX_PER_TYPE) break;
      }
    }
  }

  return result;
}

function getBookCategoryPrefs() {
  return normalizeBookCategoryPrefs(appState.bookCategories);
}

function saveBookCategoryPrefs(prefs) {
  appState.bookCategories = normalizeBookCategoryPrefs(prefs);
  saveData();
  EventBus.emit('bookCategoriesChanged');
}

function buildBookCategories(type) {
  const cleanType = type === 'expense' ? 'expense' : 'income';
  const prefs = getBookCategoryPrefs()[cleanType];
  const hidden = new Set(prefs.hidden);
  const base = getDefaultBookCategories(cleanType)
    .filter(c => !hidden.has(c.id))
    .map(c => {
      const patch = prefs.overrides[c.id] || {};
      return {
        ...c,
        label: patch.label || c.label,
        icon: patch.icon || c.icon,
        builtin: true,
      };
    });
  const custom = prefs.custom.map(c => ({ ...c, builtin: false }));
  const all = [...base, ...custom];
  if (!all.some(c => c.id === 'other')) {
    const other = getDefaultBookCategoryMap(cleanType).other;
    all.push({ ...other, builtin: true });
  }
  return all;
}

function hashBookCategoryId(id) {
  let hash = 0;
  for (const ch of String(id || '')) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function getBookCategoryColor(type, catId) {
  const defaults = type === 'expense' ? EXPENSE_COLORS : INCOME_COLORS;
  if (defaults[catId]) return defaults[catId];
  return BOOK_CUSTOM_COLORS[hashBookCategoryId(catId) % BOOK_CUSTOM_COLORS.length];
}

function renderIncome() {
  const container = $('#pgInc');
  if (!container) return;

  const [year, month] = UIState.incomeMonth.split('-').map(Number);
  const monthStr = `${year}년 ${month}월`;
  const items = getMonthIncome(year, month);
  const filteredItems = filterBookItems(items);
  const summary = calcBookSummary(items);
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const prevItems = getMonthIncome(prev.year, prev.month);
  const prevSummary = calcBookSummary(prevItems);
  const netDelta = prevSummary.net !== 0 ? summary.net - prevSummary.net : 0;

  container.innerHTML = `
    <div class="card stagger-item" style="--i:0">
      <div class="month-nav" role="navigation" aria-label="월 탐색">
        <button class="btn-icon" data-action="change-month" data-delta="-1" aria-label="이전 달">◀</button>
        <span class="month-label" aria-live="polite">${escHtml(monthStr)}</span>
        <button class="btn-icon" data-action="change-month" data-delta="1" aria-label="다음 달">▶</button>
      </div>
      ${renderBookSummary(summary, prevSummary, netDelta)}
    </div>

    <div class="card stagger-item" style="--i:1">
      <div class="card-title">
        가계부 내역
        <div class="card-title-actions">
          <button class="btn-sm" data-action="open-book-cats" aria-label="가계부 카테고리 관리">카테고리</button>
          <button class="btn-p" data-action="open-add-income" aria-label="가계부 내역 추가">+ 내역 추가</button>
        </div>
      </div>
      ${renderBookToolbar(items)}
      ${renderIncomeItems(filteredItems)}
      ${prevItems.some(i => i.recurring) ? `
        <button class="btn-sm btn-mt" data-action="copy-recurring" data-year="${year}" data-month="${month}"
          aria-label="전월 반복 내역 복사">
          📋 전월 반복 내역 복사
        </button>
      ` : ''}
    </div>

    <div class="dash-charts">
      <div class="card stagger-item" style="--i:2">
        <div class="card-title">${escHtml(getCategoryChartTitle(items))}</div>
        <div class="chart-wrap chart-wrap-220" role="img" aria-label="가계부 카테고리 차트">
          <canvas id="chartIncPie"></canvas>
        </div>
        <div id="chartIncPieAlt"></div>
        ${renderIncomeCatLegend(items)}
      </div>
      <div class="card stagger-item" style="--i:3">
        <div class="card-title">최근 6개월 흐름</div>
        <div class="chart-wrap chart-wrap-220" role="img" aria-label="6개월 가계부 흐름 차트">
          <canvas id="chartIncBar"></canvas>
        </div>
        <div id="chartIncBarAlt"></div>
      </div>
    </div>
  `;

  runWhenIdle(() => renderIncomeCharts(items, year, month));
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
    else if (action === 'book-filter') setBookFilter(target.dataset.filter || 'all');
    else if (action === 'clear-book-search') clearBookSearch();
    else if (action === 'open-book-cats') openBookCategoryManager();
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
  const search = $('#bookSearch', container);
  if (search) {
    search.oninput = debounce(() => {
      UIState.bookSearch = search.value.trim();
      renderIncome();
    }, 180);
  }
}

function getBookType(item) {
  return item?.type === 'expense' ? 'expense' : 'income';
}

function getBookTypeMeta(type) {
  return BOOK_TYPES[type === 'expense' ? 'expense' : 'income'];
}

function getBookCategories(type) {
  return buildBookCategories(type);
}

function getBookCategoryMap(type) {
  return Object.freeze(Object.fromEntries(getBookCategories(type).map(c => [c.id, c])));
}

function getBookCategory(item) {
  const type = getBookType(item);
  const map = getBookCategoryMap(type);
  return map[item.cat] || map.other;
}

function getMonthIncome(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return appState.income.filter(i => i.date?.startsWith(prefix));
}

function calcBookSummary(items) {
  const income = items
    .filter(i => getBookType(i) === 'income')
    .reduce((s, i) => s + safeNum(i.amount), 0);
  const expense = items
    .filter(i => getBookType(i) === 'expense')
    .reduce((s, i) => s + safeNum(i.amount), 0);
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;
  return { income, expense, net, savingsRate, count: items.length };
}

function renderBookSummary(summary, prevSummary, netDelta) {
  const netCls = profitClass(summary.net);
  const expenseDelta = prevSummary.expense > 0 ? ((summary.expense - prevSummary.expense) / prevSummary.expense) * 100 : null;
  const incomeDelta = prevSummary.income > 0 ? ((summary.income - prevSummary.income) / prevSummary.income) * 100 : null;
  return `
    <div class="book-summary-grid" aria-label="이번 달 가계부 요약">
      <div class="book-summary-card">
        <span class="book-summary-label">수입</span>
        <strong class="book-summary-value positive">${escHtml(fmtKRW(summary.income))}</strong>
        ${incomeDelta != null ? `<span class="book-summary-sub ${incomeDelta >= 0 ? 'positive' : 'negative'}">전월 ${escHtml(fmtPct(incomeDelta))}</span>` : '<span class="book-summary-sub">기록 없음</span>'}
      </div>
      <div class="book-summary-card">
        <span class="book-summary-label">지출</span>
        <strong class="book-summary-value negative">${escHtml(fmtKRW(summary.expense))}</strong>
        ${expenseDelta != null ? `<span class="book-summary-sub ${expenseDelta <= 0 ? 'positive' : 'negative'}">전월 ${escHtml(fmtPct(expenseDelta))}</span>` : '<span class="book-summary-sub">기록 없음</span>'}
      </div>
      <div class="book-summary-card book-summary-main">
        <span class="book-summary-label">순흐름</span>
        <strong class="book-summary-value ${netCls}">${summary.net >= 0 ? '+' : ''}${escHtml(fmtKRW(summary.net))}</strong>
        ${prevSummary.net !== 0 ? `<span class="book-summary-sub ${netDelta >= 0 ? 'positive' : 'negative'}">전월 대비 ${netDelta >= 0 ? '+' : ''}${escHtml(fmtKRW(netDelta))}</span>` : '<span class="book-summary-sub">수입 - 지출</span>'}
      </div>
      <div class="book-summary-card">
        <span class="book-summary-label">저축률</span>
        <strong class="book-summary-value ${summary.savingsRate >= 0 ? 'positive' : 'negative'}">${escHtml(fmtPct(summary.savingsRate, 1))}</strong>
        <span class="book-summary-sub">${summary.count}건 기록</span>
      </div>
    </div>
  `;
}

function renderBookToolbar(items) {
  const counts = {
    all: items.length,
    income: items.filter(i => getBookType(i) === 'income').length,
    expense: items.filter(i => getBookType(i) === 'expense').length,
  };
  return `
    <div class="book-toolbar">
      <div class="book-tabs" role="tablist" aria-label="가계부 유형 필터">
        ${BOOK_FILTERS.map(f => `
          <button class="book-tab ${UIState.bookFilter === f.id ? 'active' : ''}"
            data-action="book-filter" data-filter="${escAttr(f.id)}"
            role="tab" aria-selected="${UIState.bookFilter === f.id ? 'true' : 'false'}">
            ${escHtml(f.label)} <span>${counts[f.id] || 0}</span>
          </button>
        `).join('')}
      </div>
      <div class="book-search-wrap">
        <input type="text" id="bookSearch" class="book-search" value="${escAttr(UIState.bookSearch || '')}"
          placeholder="내역명·메모 검색" aria-label="가계부 내역 검색">
        ${UIState.bookSearch ? '<button class="search-clear" data-action="clear-book-search" aria-label="검색 초기화">✕</button>' : ''}
      </div>
    </div>
  `;
}

function filterBookItems(items) {
  let filtered = items.slice();
  if (UIState.bookFilter === 'income' || UIState.bookFilter === 'expense') {
    filtered = filtered.filter(i => getBookType(i) === UIState.bookFilter);
  }
  const q = (UIState.bookSearch || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(i => {
      const cat = getBookCategory(i);
      const text = `${i.source || ''} ${i.memo || ''} ${cat.label}`.toLowerCase();
      return text.includes(q);
    });
  }
  return filtered;
}

function setBookFilter(filter) {
  UIState.bookFilter = ['all', 'income', 'expense'].includes(filter) ? filter : 'all';
  renderIncome();
}

function clearBookSearch() {
  UIState.bookSearch = '';
  renderIncome();
}

function openBookCategoryManager(type = UIState.bookFilter === 'income' ? 'income' : 'expense') {
  _bookCatManagerType = type === 'income' ? 'income' : 'expense';
  renderBookCategoryManager();
}

function renderBookCategoryManager() {
  _modalCleanup.removeAll();
  const type = _bookCatManagerType === 'income' ? 'income' : 'expense';
  const meta = getBookTypeMeta(type);
  const cats = getBookCategories(type);
  const container = $('#modalMain');
  const wasActive = container.classList.contains('active');

  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box modal-large">
      <div class="modal-header">
        <h3>가계부 카테고리 관리</h3>
        <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">
        <div class="book-type-toggle book-cat-type-toggle" role="radiogroup" aria-label="카테고리 유형">
          ${['expense', 'income'].map(t => `
            <button type="button" class="book-type-option ${type === t ? 'active' : ''}"
              data-action="switch-book-cat-type" data-type="${t}" role="radio"
              aria-checked="${type === t ? 'true' : 'false'}">${escHtml(getBookTypeMeta(t).label)}</button>
          `).join('')}
        </div>

        <div class="book-cat-manager-head">
          <div>
            <div class="book-cat-manager-title">${escHtml(meta.label)} 카테고리</div>
            <div class="book-cat-manager-hint">삭제한 카테고리를 쓰던 기존 내역은 기타로 이동합니다.</div>
          </div>
          <button class="btn-sm" data-action="restore-default-book-cats" data-type="${type}">기본 복원</button>
        </div>

        <div class="book-cat-list" role="list">
          ${cats.map(c => {
            const usage = countBookCategoryUsage(type, c.id);
            const isOther = c.id === 'other';
            return `
              <div class="book-cat-row" role="listitem">
                <div class="book-cat-main">
                  <span class="book-cat-icon" aria-hidden="true">${escHtml(c.icon)}</span>
                  <div class="book-cat-text">
                    <div class="book-cat-label">${escHtml(c.label)}</div>
                    <div class="book-cat-meta">${c.builtin ? '기본' : '사용자'} · ${usage}건</div>
                  </div>
                </div>
                <div class="book-cat-actions">
                  <button class="btn-icon" data-action="edit-book-cat" data-type="${type}" data-cat-id="${escAttr(c.id)}" aria-label="${escAttr(c.label)} 카테고리 편집">✎</button>
                  <button class="btn-icon btn-danger" data-action="delete-book-cat" data-type="${type}" data-cat-id="${escAttr(c.id)}" aria-label="${escAttr(c.label)} 카테고리 삭제" ${isOther ? 'disabled' : ''}>✕</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="book-cat-add">
          <div class="book-cat-add-title">새 카테고리</div>
          <div class="book-cat-add-row">
            <input type="text" id="bookCatNewIcon" value="🏷️" maxlength="12" aria-label="새 카테고리 아이콘">
            <input type="text" id="bookCatNewLabel" placeholder="카테고리 이름" maxlength="30" aria-label="새 카테고리 이름">
            <button class="btn-p" data-action="add-book-cat" data-type="${type}">추가</button>
          </div>
        </div>
      </div>
    </div>
  `;

  if (!wasActive) openModal('modalMain');
  else {
    container.removeAttribute('aria-hidden');
    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) backdrop.onclick = () => closeModal('modalMain');
  }
  _setupModalMainDelegation(container);
  _setupBookCategoryManagerDelegation(container);
}

function _setupBookCategoryManagerDelegation(container) {
  const clickHandler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'switch-book-cat-type') {
      _bookCatManagerType = target.dataset.type === 'income' ? 'income' : 'expense';
      renderBookCategoryManager();
    } else if (action === 'add-book-cat') {
      doAddBookCategory(target.dataset.type);
    } else if (action === 'edit-book-cat') {
      openEditBookCategory(target.dataset.type, target.dataset.catId);
    } else if (action === 'delete-book-cat') {
      doDeleteBookCategory(target.dataset.type, target.dataset.catId);
    } else if (action === 'restore-default-book-cats') {
      doRestoreDefaultBookCategories(target.dataset.type);
    }
  };
  const keyHandler = (e) => {
    if (e.key !== 'Enter') return;
    if (e.target?.id === 'bookCatNewIcon' || e.target?.id === 'bookCatNewLabel') {
      e.preventDefault();
      doAddBookCategory(_bookCatManagerType);
    }
  };
  _modalCleanup.add(container, 'click', clickHandler);
  _modalCleanup.add(container, 'keydown', keyHandler);
}

function countBookCategoryUsage(type, catId) {
  return appState.income.filter(i => getBookType(i) === type && i.cat === catId).length;
}

function findBookCategory(type, catId) {
  return getBookCategories(type).find(c => c.id === catId) || null;
}

function hasBookCategoryLabel(type, label, exceptId = '') {
  const clean = stripHtml(label, 30).toLowerCase();
  return getBookCategories(type).some(c => c.id !== exceptId && c.label.toLowerCase() === clean);
}

function doAddBookCategory(type) {
  const cleanType = type === 'income' ? 'income' : 'expense';
  const prefs = getBookCategoryPrefs();
  const label = stripHtml($('#bookCatNewLabel')?.value, 30);
  const icon = stripHtml($('#bookCatNewIcon')?.value, 12) || '🏷️';
  if (!label) { showToast('카테고리 이름을 입력하세요', 'error'); return; }
  if (hasBookCategoryLabel(cleanType, label)) { showToast('이미 같은 이름의 카테고리가 있습니다', 'error'); return; }
  if (prefs[cleanType].custom.length >= BOOK_CAT_MAX_PER_TYPE) {
    showToast(`사용자 카테고리는 최대 ${BOOK_CAT_MAX_PER_TYPE}개까지`, 'error');
    return;
  }

  prefs[cleanType].custom.push({
    id: `${cleanType}_cat_${uid().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18)}`,
    label,
    icon,
  });
  saveBookCategoryPrefs(prefs);
  showToast('카테고리 추가됨', 'success');
  renderBookCategoryManager();
  renderIncome();
}

function openEditBookCategory(type, catId) {
  const cleanType = type === 'income' ? 'income' : 'expense';
  const cat = findBookCategory(cleanType, catId);
  if (!cat) return;

  const container = $('#modalSub');
  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h3>카테고리 편집</h3>
        <button class="modal-close" data-action="close-sub-modal" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group book-cat-icon-field">
            <label for="bookCatEditIcon">아이콘</label>
            <input type="text" id="bookCatEditIcon" value="${escAttr(cat.icon)}" maxlength="12">
          </div>
          <div class="form-group">
            <label for="bookCatEditLabel">이름</label>
            <input type="text" id="bookCatEditLabel" value="${escAttr(cat.label)}" maxlength="30">
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-s" data-action="close-sub-modal">취소</button>
          <button class="btn-p" data-action="save-book-cat-edit" data-type="${cleanType}" data-cat-id="${escAttr(catId)}">저장</button>
        </div>
      </div>
    </div>
  `;
  openModal('modalSub');
  _setupModalSubDelegation(container, (action, target) => {
    if (action === 'save-book-cat-edit') {
      doSaveBookCategoryEdit(target.dataset.type, target.dataset.catId);
    }
  });
}

function doSaveBookCategoryEdit(type, catId) {
  const cleanType = type === 'income' ? 'income' : 'expense';
  const label = stripHtml($('#bookCatEditLabel')?.value, 30);
  const icon = stripHtml($('#bookCatEditIcon')?.value, 12) || '🏷️';
  if (!label) { showToast('카테고리 이름을 입력하세요', 'error'); return; }
  if (hasBookCategoryLabel(cleanType, label, catId)) { showToast('이미 같은 이름의 카테고리가 있습니다', 'error'); return; }

  const prefs = getBookCategoryPrefs();
  const defaultMap = getDefaultBookCategoryMap(cleanType);
  if (defaultMap[catId]) {
    prefs[cleanType].overrides[catId] = { label, icon };
  } else {
    const idx = prefs[cleanType].custom.findIndex(c => c.id === catId);
    if (idx < 0) return;
    prefs[cleanType].custom[idx] = { ...prefs[cleanType].custom[idx], label, icon };
  }
  saveBookCategoryPrefs(prefs);
  closeModal('modalSub');
  showToast('카테고리 수정됨', 'success');
  renderBookCategoryManager();
  renderIncome();
}

function doDeleteBookCategory(type, catId) {
  const cleanType = type === 'income' ? 'income' : 'expense';
  const cat = findBookCategory(cleanType, catId);
  if (!cat) return;
  if (catId === 'other') { showToast('기타 카테고리는 삭제할 수 없습니다', 'error'); return; }
  if (getBookCategories(cleanType).length <= 1) { showToast('카테고리는 최소 1개가 필요합니다', 'error'); return; }
  const usage = countBookCategoryUsage(cleanType, catId);
  const msg = usage > 0
    ? `"${cat.label}" 카테고리를 삭제할까요?\n이 카테고리를 쓰던 ${usage}건은 기타로 이동합니다.`
    : `"${cat.label}" 카테고리를 삭제할까요?`;
  openConfirmModal(msg, () => {
    const prefs = getBookCategoryPrefs();
    const defaultMap = getDefaultBookCategoryMap(cleanType);
    if (defaultMap[catId]) {
      if (!prefs[cleanType].hidden.includes(catId)) prefs[cleanType].hidden.push(catId);
      delete prefs[cleanType].overrides[catId];
    } else {
      prefs[cleanType].custom = prefs[cleanType].custom.filter(c => c.id !== catId);
    }
    for (const item of appState.income) {
      if (getBookType(item) === cleanType && item.cat === catId) item.cat = 'other';
    }
    appState.bookCategories = normalizeBookCategoryPrefs(prefs);
    saveData();
    EventBus.emit('bookCategoriesChanged');
    showToast('카테고리 삭제됨', 'success');
    renderBookCategoryManager();
    renderIncome();
  });
}

function doRestoreDefaultBookCategories(type) {
  const cleanType = type === 'income' ? 'income' : 'expense';
  openConfirmModal(`${getBookTypeMeta(cleanType).label} 기본 카테고리를 복원할까요?\n사용자 추가 카테고리는 유지됩니다.`, () => {
    const prefs = getBookCategoryPrefs();
    prefs[cleanType].hidden = [];
    prefs[cleanType].overrides = {};
    saveBookCategoryPrefs(prefs);
    showToast('기본 카테고리 복원됨', 'success');
    renderBookCategoryManager();
    renderIncome();
  });
}

function renderIncomeItems(items) {
  if (items.length === 0) return '<div class="empty-state">조건에 맞는 가계부 내역이 없습니다</div>';
  const sorted = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
    <div class="income-list" role="list">
      ${sorted.map(i => {
        const type = getBookType(i);
        const meta = getBookTypeMeta(type);
        const cat = getBookCategory(i);
        const amountPrefix = type === 'income' ? '+' : '-';
        return `
          <div class="income-item book-item-${type}" role="listitem">
            <div class="income-item-main">
              <span class="income-cat-icon ${type}" aria-hidden="true">${cat.icon}</span>
              <div class="income-item-text">
                <div class="income-item-source">${escHtml(i.source || cat.label)}</div>
                <div class="income-item-date">
                  <span class="book-type-badge ${type}">${escHtml(meta.label)}</span>
                  ${escHtml(cat.label)} · ${escHtml(fmtDate(i.date))}${i.recurring ? ' · 반복' : ''}
                  ${i.memo ? ` · ${escHtml(i.memo)}` : ''}
                </div>
              </div>
            </div>
            <div class="income-item-right">
              <span class="income-item-amount ${type}">${amountPrefix}${escHtml(fmtKRW(i.amount))}</span>
              <button class="btn-icon" data-action="edit-income" data-id="${i.id}" aria-label="가계부 내역 수정">✎</button>
              <button class="btn-icon btn-danger" data-action="delete-income" data-id="${i.id}" aria-label="가계부 내역 삭제">✕</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function getCategoryChartType(items) {
  if (UIState.bookFilter === 'income') return 'income';
  if (UIState.bookFilter === 'expense') return 'expense';
  if (items.some(i => getBookType(i) === 'expense')) return 'expense';
  return 'income';
}

function getCategoryChartTitle(items) {
  if (!items || items.length === 0) return '카테고리별';
  const type = getCategoryChartType(items);
  return `${getBookTypeMeta(type).label} 카테고리`;
}

function renderIncomeCatLegend(items) {
  const type = getCategoryChartType(items);
  const typeItems = items.filter(i => getBookType(i) === type);
  const byCat = {};
  for (const i of typeItems) byCat[i.cat] = (byCat[i.cat] || 0) + safeNum(i.amount);
  const total = typeItems.reduce((s, i) => s + safeNum(i.amount), 0);
  if (total === 0) return '<div class="empty-state empty-state-compact">표시할 카테고리 데이터가 없습니다</div>';
  const map = getBookCategoryMap(type);
  return `
    <div class="pie-legend" role="list" aria-label="${escAttr(getBookTypeMeta(type).label)} 카테고리 범례">
      ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([catId, val]) => {
        const cat = map[catId] || map.other;
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

function renderIncomeCharts(items, year, month) {
  renderBookCategoryChart(items);
  renderBookFlowChart(year, month);
}

function renderBookCategoryChart(items) {
  destroyChart('incPie');
  const type = getCategoryChartType(items);
  const typeItems = items.filter(i => getBookType(i) === type);
  const byCat = {};
  for (const i of typeItems) byCat[i.cat] = (byCat[i.cat] || 0) + safeNum(i.amount);
  const catEntries = Object.entries(byCat).filter(([, v]) => v > 0);
  if (catEntries.length === 0) return;

  const map = getBookCategoryMap(type);
  const colors = type === 'expense' ? EXPENSE_COLORS : INCOME_COLORS;
  const total = typeItems.reduce((s, i) => s + safeNum(i.amount), 0);
  charts.incPie = renderDoughnut('chartIncPie',
    catEntries.map(([id]) => (map[id]?.label || id)),
    catEntries.map(([, v]) => v),
    catEntries.map(([id]) => colors[id] || getBookCategoryColor(type, id)),
    { centerText: { text: fmtKRW(total), sub: getBookTypeMeta(type).label, fontSize: 13 } }
  );

  const altContainer = document.getElementById('chartIncPieAlt');
  if (altContainer) {
    const rows = catEntries.map(([id, v]) => {
      const pct = total > 0 ? ((v / total) * 100).toFixed(1) + '%' : '0%';
      return [(map[id]?.label || id), fmtKRW(v), pct];
    });
    altContainer.innerHTML = chartAltTable(['카테고리', '금액', '비중'], rows, `${getBookTypeMeta(type).label} 카테고리 데이터`);
  }
}

function renderBookFlowChart(year, month) {
  destroyChart('incBar');
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i, y = year;
    while (m <= 0) { m += 12; y--; }
    months.push({ y, m, label: `${m}월` });
  }
  const incomeData = [];
  const expenseData = [];
  const netData = [];
  for (const m of months) {
    const summary = calcBookSummary(getMonthIncome(m.y, m.m));
    incomeData.push(summary.income);
    expenseData.push(summary.expense);
    netData.push(summary.net);
  }
  if (![...incomeData, ...expenseData, ...netData].some(v => v !== 0)) return;
  charts.incBar = renderLineChart('chartIncBar', months.map(m => m.label), [
    { label: '수입', data: incomeData, borderColor: '#6BBF8A', backgroundColor: colorAlpha('#6BBF8A', 0.16), fill: false },
    { label: '지출', data: expenseData, borderColor: '#E8788A', backgroundColor: colorAlpha('#E8788A', 0.16), fill: false },
    { label: '순흐름', data: netData, borderColor: getThemeColor('--primary') || '#7C6FF0', backgroundColor: colorAlpha('#7C6FF0', 0.12), fill: false },
  ], { legend: true, pointRadius: 3, tension: 0.25 });

  const altContainer = document.getElementById('chartIncBarAlt');
  if (altContainer) {
    const rows = months.map((m, idx) => [m.label, fmtKRW(incomeData[idx]), fmtKRW(expenseData[idx]), fmtKRW(netData[idx])]);
    altContainer.innerHTML = chartAltTable(['월', '수입', '지출', '순흐름'], rows, '6개월 가계부 흐름 데이터');
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

function _renderLedgerSourceDatalist(type, listId) {
  const presets = loadPresets();
  const key = type === 'expense' ? 'expenseSources' : 'incomeSources';
  const list = Array.isArray(presets[key]) ? presets[key] : [];
  if (list.length === 0) return '';
  return `<datalist id="${listId}">${list.map(v => `<option value="${escAttr(v)}"></option>`).join('')}</datalist>`;
}

function renderLedgerCatSelector(type, selectedCat, labelId) {
  const cats = getBookCategories(type);
  const map = getBookCategoryMap(type);
  const fallback = getBookTypeMeta(type).defaultCat;
  const selected = map[selectedCat] ? selectedCat : fallback;
  return `<div class="cat-select" role="radiogroup" aria-labelledby="${labelId}">
    ${cats.map(c => `<button class="cat-btn ${c.id === selected ? 'active' : ''}"
      data-cat="${escAttr(c.id)}" data-action="select-book-cat" role="radio"
      aria-checked="${c.id === selected ? 'true' : 'false'}">${c.icon} ${escHtml(c.label)}</button>`).join('')}</div>`;
}

function _setupIncomeAmountHint(inputId, hintId) {
  const input = $(`#${inputId}`);
  const hint = $(`#${hintId}`);
  if (!input || !hint) return;
  const update = () => { hint.textContent = fmtAmountHint(input.value); };
  _modalCleanup.add(input, 'input', update);
  update();
}

function _renderLedgerTypeToggle(type) {
  return `
    <div class="book-type-toggle" role="radiogroup" aria-label="내역 유형">
      ${['expense', 'income'].map(t => `
        <button type="button" class="book-type-option ${type === t ? 'active' : ''}"
          data-action="set-ledger-type" data-type="${t}" role="radio"
          aria-checked="${type === t ? 'true' : 'false'}">
          ${escHtml(getBookTypeMeta(t).label)}
        </button>
      `).join('')}
    </div>
    <input type="hidden" id="ledgerType" value="${escAttr(type)}">
  `;
}

function _refreshLedgerFormForType(type, selectedCat) {
  const cleanType = type === 'income' ? 'income' : 'expense';
  const meta = getBookTypeMeta(cleanType);
  const typeInput = $('#ledgerType');
  if (typeInput) typeInput.value = cleanType;
  $$('#modalMain [data-action="set-ledger-type"]').forEach(btn => {
    const active = btn.dataset.type === cleanType;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  });
  const catWrap = $('#ledgerCatWrap');
  if (catWrap) catWrap.innerHTML = renderLedgerCatSelector(cleanType, selectedCat || meta.defaultCat, 'ledgerCatLabel');
  const sourceLabel = $('#ledgerSourceLabel');
  if (sourceLabel) sourceLabel.textContent = meta.sourceLabel;
  const source = $('#ledgerSource');
  if (source) {
    source.placeholder = meta.sourcePlaceholder;
    const listId = cleanType === 'expense' ? 'expenseSourcePresets' : 'incomeSourcePresets';
    source.setAttribute('list', listId);
  }
  const datalistWrap = $('#ledgerDatalistWrap');
  if (datalistWrap) {
    datalistWrap.innerHTML =
      _renderLedgerSourceDatalist('expense', 'expenseSourcePresets') +
      _renderLedgerSourceDatalist('income', 'incomeSourcePresets');
  }
}

function _setupLedgerFormInteractions(container) {
  const handler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'set-ledger-type') {
      _refreshLedgerFormForType(target.dataset.type, null);
    } else if (action === 'select-book-cat') {
      const group = target.closest('.cat-select');
      if (group) group.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      target.classList.add('active');
      target.setAttribute('aria-checked', 'true');
    }
  };
  _modalCleanup.add(container, 'click', handler);
}

function _defaultBookDate(year, month) {
  const todayDate = new Date();
  const day = Math.min(todayDate.getDate(), new Date(year, month, 0).getDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function _buildLedgerModalBody({ mode, item }) {
  const [year, month] = UIState.incomeMonth.split('-').map(Number);
  const type = item ? getBookType(item) : 'expense';
  const meta = getBookTypeMeta(type);
  const amount = item ? safeNum(item.amount) : '';
  const date = item ? (item.date || today()) : _defaultBookDate(year, month);
  const source = item ? (item.source || '') : '';
  const memo = item ? (item.memo || '') : '';
  const recurring = item ? !!item.recurring : false;
  const cat = item ? item.cat : meta.defaultCat;
  return `
    <div class="modal-body">
      <div class="form-group">
        <label>유형</label>
        ${_renderLedgerTypeToggle(type)}
      </div>
      <div class="form-group">
        <label id="ledgerCatLabel">카테고리</label>
        <div id="ledgerCatWrap">${renderLedgerCatSelector(type, cat, 'ledgerCatLabel')}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="ledgerAmount">금액 *</label>
          <input type="number" inputmode="decimal" id="ledgerAmount" value="${escAttr(amount)}" placeholder="0" min="0" required>
          <div class="amount-hint" id="ledgerAmountHint"></div>
        </div>
        <div class="form-group">
          <label for="ledgerDate">날짜</label>
          <input type="date" id="ledgerDate" value="${escAttr(date)}">
        </div>
      </div>
      <div class="form-group">
        <label for="ledgerSource" id="ledgerSourceLabel">${escHtml(meta.sourceLabel)}</label>
        <input type="text" id="ledgerSource" value="${escAttr(source)}" placeholder="${escAttr(meta.sourcePlaceholder)}"
          maxlength="100" list="${type === 'expense' ? 'expenseSourcePresets' : 'incomeSourcePresets'}">
        <div id="ledgerDatalistWrap">
          ${_renderLedgerSourceDatalist('expense', 'expenseSourcePresets')}
          ${_renderLedgerSourceDatalist('income', 'incomeSourcePresets')}
        </div>
      </div>
      <div class="form-group">
        <label for="ledgerMemo">메모</label>
        <input type="text" id="ledgerMemo" value="${escAttr(memo)}" placeholder="선택사항" maxlength="200">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="ledgerRecurring" ${recurring ? 'checked' : ''}> 매월 반복</label>
      </div>
      <div class="modal-actions">
        <button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button>
        <button class="btn-p" data-action="${mode === 'edit' ? 'do-edit-income' : 'do-add-income'}" ${mode === 'edit' ? `data-id="${escAttr(item.id)}"` : ''}>${mode === 'edit' ? '저장' : '추가'}</button>
      </div>
    </div>
  `;
}

function openAddIncome() {
  _modalCleanup.removeAll();
  const container = $('#modalMain');
  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h3>가계부 내역 추가</h3>
        <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button>
      </div>
      ${_buildLedgerModalBody({ mode: 'add' })}
    </div>
  `;
  openModal('modalMain');
  _setupModalMainDelegation(container);
  _setupLedgerFormInteractions(container);
  _setupIncomeAmountHint('ledgerAmount', 'ledgerAmountHint');
}

function _collectLedgerFormValues() {
  const type = $('#ledgerType')?.value === 'income' ? 'income' : 'expense';
  const amount = safeNum($('#ledgerAmount')?.value);
  if (amount <= 0) {
    showToast('금액을 입력하세요 (0보다 큰 값)', 'error');
    return null;
  }
  const map = getBookCategoryMap(type);
  const cat = $('#modalMain .cat-btn.active')?.dataset?.cat || getBookTypeMeta(type).defaultCat;
  const source = $('#ledgerSource')?.value.trim() || '';
  return {
    type,
    amount,
    cat: map[cat] ? cat : 'other',
    date: $('#ledgerDate')?.value || today(),
    source,
    memo: $('#ledgerMemo')?.value.trim() || '',
    recurring: $('#ledgerRecurring')?.checked || false,
  };
}

function doAddIncome() {
  const values = _collectLedgerFormValues();
  if (!values) return;

  addIncome(values);
  if (values.source) addPreset(values.type === 'expense' ? 'expenseSources' : 'incomeSources', values.source);

  closeModal('modalMain');
  showToast(`${getBookTypeMeta(values.type).label} 추가됨`, 'success');
  renderIncome();
}

function doDeleteIncome(id) {
  openConfirmModal('이 가계부 기록을 삭제하시겠습니까?', () => {
    const undo = deleteIncome(id);
    renderIncome();
    if (undo) showUndoToast('가계부 기록 삭제됨', () => { undo(); renderIncome(); });
    else showToast('삭제됨');
  });
}

function openEditIncome(id) {
  const item = appState.income.find(i => i.id === id);
  if (!item) return;

  _modalCleanup.removeAll();
  const container = $('#modalMain');
  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h3>가계부 내역 수정</h3>
        <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button>
      </div>
      ${_buildLedgerModalBody({ mode: 'edit', item })}
    </div>
  `;
  openModal('modalMain');
  _setupModalMainDelegation(container);
  _setupLedgerFormInteractions(container);
  _setupIncomeAmountHint('ledgerAmount', 'ledgerAmountHint');
}

function doEditIncome(id) {
  const values = _collectLedgerFormValues();
  if (!values) return;

  updateIncome(id, values);
  if (values.source) addPreset(values.type === 'expense' ? 'expenseSources' : 'incomeSources', values.source);

  closeModal('modalMain');
  showToast(`${getBookTypeMeta(values.type).label} 수정됨`, 'success');
  renderIncome();
}

function copyRecurring(year, month) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const recurring = getMonthIncome(prevYear, prevMonth).filter(i => i.recurring);
  if (recurring.length === 0) { showToast('복사할 반복 내역이 없습니다', 'info'); return; }

  let count = 0;
  for (const r of recurring) {
    const rType = getBookType(r);
    const exists = getMonthIncome(year, month).find(
      i => getBookType(i) === rType && i.cat === r.cat && i.source === r.source && Math.abs(safeNum(i.amount) - safeNum(r.amount)) < 1
    );
    if (!exists) {
      const origDay = Number((r.date || '').split('-')[2]) || 1;
      const safeDay = clampDay(year, month, origDay);
      const newDate = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
      addIncome({ ...r, type: rType, date: newDate, id: undefined });
      count++;
    }
  }
  showToast(count > 0 ? `${count}건 복사됨` : '이미 모두 복사됨', count > 0 ? 'success' : 'info');
  renderIncome();
}
