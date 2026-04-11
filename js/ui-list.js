/* =============================================
   My Portfolio v5.3.2 — Asset List UI
   Soft Neutral: cleaner toolbar, stagger animations
   Drag&Drop logic preserved from v4.4.1 (lines 290~507)
   Planner-Creator-Evaluator Cycle 3
   ============================================= */

let _dragAssetId = null;
let _dragCatName = null;
let _dragInsertBefore = false;
let _touchDragEl = null;
let _touchClone = null;
let _touchInsertBefore = false;

const _listCleanup = Cleanup.scope('list');
const _dragCleanup = Cleanup.scope('drag');

function renderList() {
  const container = $('#pgList');
  if (!container) return;

  _listCleanup.removeAll();

  const assets = filterAssets(appState.assets, UIState.listSearchQuery);
  const grouped = groupBy(assets, 'category');
  const order = appState.categoryOrder;

  container.innerHTML = `
    <div class="list-toolbar stagger-item" style="--i:0">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="자산 검색..."
          value="${escAttr(UIState.listSearchQuery)}" aria-label="자산 검색">
        ${UIState.listSearchQuery ? '<button class="search-clear" data-action="clear-search" aria-label="검색 초기화">✕</button>' : ''}
      </div>
      <div class="list-actions">
        <button class="btn-sm ${UIState.isEditMode ? 'active' : ''}" data-action="toggle-edit"
          aria-pressed="${UIState.isEditMode}" aria-label="${UIState.isEditMode ? '편집 완료' : '편집 모드'}">
          ${UIState.isEditMode ? '✓ 완료' : '✎ 편집'}
        </button>
      </div>
    </div>

    <div class="asset-summary stagger-item" style="--i:1" aria-label="자산 요약">
      <span>총 ${appState.assets.length}개 자산</span>
      <span>${escHtml(fmtKRW(calcTotal(appState.assets)))}</span>
    </div>

    <div id="assetListBody" role="list" aria-label="자산 목록">
      ${order.map((catId, idx) => {
        const catAssets = grouped[catId] || [];
        if (catAssets.length === 0 && !UIState.isEditMode) return '';
        return renderListCategory(catId, catAssets, idx + 2);
      }).join('')}
    </div>
  `;

  const searchInput = $('#searchInput');
  if (searchInput) {
    const handler = debounce(e => { UIState.listSearchQuery = e.target.value; renderList(); });
    _listCleanup.add(searchInput, 'input', handler);
  }

  $$('.legend-dot[data-color]').forEach(dot => {
    dot.style.background = dot.dataset.color;
  });

  _setupListDelegation(container);
  if (UIState.isEditMode) setupDragAndDrop();
}

function _setupListDelegation(container) {
  container.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    _handleListAction(target, e);
  };
  container.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    _handleListAction(target, e);
  };
}

function _handleListAction(target, e) {
  const action = target.dataset.action;
  if (action === 'clear-search') clearSearch();
  else if (action === 'toggle-edit') toggleEditMode();
  else if (action === 'open-add-asset') openAddAsset();
  else if (action === 'toggle-list-cat') {
    const catId = target.dataset.cat;
    if (catId) toggleListCat(catId);
  } else if (action === 'show-more') {
    const catId = target.dataset.cat;
    if (catId) showMoreAssets(catId);
  } else if (action === 'open-asset-detail') {
    const id = target.dataset.id;
    if (id) openAssetDetail(id);
  } else if (action === 'edit-asset') {
    e.stopPropagation();
    const id = target.dataset.id;
    if (id) openEditAsset(id);
  } else if (action === 'delete-asset') {
    e.stopPropagation();
    const id = target.dataset.id;
    if (id) confirmDeleteAsset(id);
  }
}

function filterAssets(assets, query) {
  if (!query) return assets;
  const q = query.toLowerCase();
  return assets.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.category.includes(q) ||
    (a.stockCode && a.stockCode.toLowerCase().includes(q)) ||
    (a.note && a.note.toLowerCase().includes(q))
  );
}

function clearSearch() {
  UIState.listSearchQuery = '';
  renderList();
}

function toggleEditMode() {
  UIState.isEditMode = !UIState.isEditMode;
  renderList();
}

function renderListCategory(catId, assets, staggerIdx = 2) {
  const cat = CAT_MAP[catId];
  const isOpen = UIState.listCategoryOpen[catId] !== false;
  const total = assets.reduce((s, a) => s + calcAssetValue(a).value, 0);
  const shownCount = UIState.listCategoryShown[catId] || LAZY_RENDER_THRESHOLD;
  const visibleAssets = assets.slice(0, shownCount);
  const hasMore = assets.length > shownCount;

  return `
    <div class="list-cat stagger-item" style="--i:${staggerIdx}" id="listCat-${escAttr(catId)}" data-cat="${escAttr(catId)}"
      ${UIState.isEditMode ? 'draggable="true"' : ''} role="listitem">
      <div class="list-cat-header" data-action="toggle-list-cat" data-cat="${escAttr(catId)}"
        role="button" tabindex="0" aria-expanded="${isOpen}">
        ${UIState.isEditMode ? '<span class="drag-handle cat-drag" aria-label="카테고리 드래그">⠿</span>' : ''}
        <span class="cat-icon" aria-hidden="true">${cat.icon}</span>
        <span class="cat-name">${escHtml(cat.label)} (${assets.length})</span>
        <span class="cat-total">${escHtml(fmtKRW(total))}</span>
        <span class="chevron ${isOpen ? 'open' : ''}" aria-hidden="true">▸</span>
      </div>
      ${isOpen ? `
        <div class="list-cat-body" role="list">
          ${visibleAssets.length > 0
            ? visibleAssets.map(a => renderListAsset(a)).join('')
            : '<div class="empty-cat">자산이 없습니다</div>'}
          ${hasMore ? `
            <button class="btn-sm show-more-btn" data-action="show-more" data-cat="${escAttr(catId)}"
              aria-label="${escAttr(cat.label)} 자산 더 보기 (${assets.length - shownCount}개 남음)">
              더 보기 (${assets.length - shownCount}개 남음)
            </button>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function showMoreAssets(catId) {
  const oldShown = UIState.listCategoryShown[catId] || LAZY_RENDER_THRESHOLD;
  const newShown = oldShown + LAZY_RENDER_PAGE;
  UIState.listCategoryShown[catId] = newShown;

  const section = $(`#listCat-${catId}`);
  if (!section) { renderList(); return; }
  const body = section.querySelector('.list-cat-body');
  if (!body) { renderList(); return; }

  const assets = filterAssets(appState.assets, UIState.listSearchQuery).filter(a => a.category === catId);
  const newItems = assets.slice(oldShown, newShown);
  const hasMore = assets.length > newShown;
  const cat = CAT_MAP[catId];

  const oldBtn = body.querySelector('.show-more-btn');
  if (oldBtn) oldBtn.remove();

  const fragment = document.createDocumentFragment();
  for (const a of newItems) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderListAsset(a);
    while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
  }
  body.appendChild(fragment);

  if (hasMore) {
    const btnWrapper = document.createElement('div');
    btnWrapper.innerHTML = `
      <button class="btn-sm show-more-btn" data-action="show-more" data-cat="${escAttr(catId)}"
        aria-label="${escAttr(cat.label)} 자산 더 보기 (${assets.length - newShown}개 남음)">
        더 보기 (${assets.length - newShown}개 남음)
      </button>
    `;
    body.appendChild(btnWrapper.firstElementChild);
  }

  if (UIState.isEditMode) setupDragAndDrop();
}

function renderListAsset(asset) {
  const v = calcAssetValue(asset);
  const isInv = INVESTMENT_CATS.includes(asset.category);
  const hasProfit = isInv && v.cost > 0;

  return `
    <div class="list-asset" data-id="${asset.id}" data-cat="${escAttr(asset.category)}"
      ${UIState.isEditMode ? 'draggable="true"' : ''}
      ${UIState.isEditMode ? '' : `data-action="open-asset-detail" data-id="${asset.id}"`}
      role="listitem" tabindex="0"
      aria-label="${escAttr(asset.name)}: ${fmtKRW(v.value)}">
      ${UIState.isEditMode ? '<span class="drag-handle" aria-label="드래그">⠿</span>' : ''}
      <div class="asset-main">
        <div class="asset-name">
          ${escHtml(asset.name)}
          ${asset.stockCode ? `<span class="asset-code">${escHtml(asset.stockCode)}</span>` : ''}
        </div>
        <div class="asset-sub">
          ${isInv && v.qty > 0 ? `${escHtml(fmtNum(v.qty, v.qty % 1 !== 0 ? 4 : 0))}${asset.category === '코인' ? '개' : '주'}` : ''}
          ${asset.lpu ? `${isInv && v.qty > 0 ? '· ' : ''}${escHtml(fmtRelTime(asset.lpu))}` : ''}
        </div>
      </div>
      <div class="asset-values">
        <div class="asset-value">${escHtml(fmtKRW(v.value))}</div>
        ${hasProfit ? `<div class="asset-profit ${profitClass(v.profit)}">${escHtml(fmtKRW(v.profit))} (${escHtml(fmtPct(v.profitPct))})</div>` : ''}
      </div>
      ${UIState.isEditMode ? `
        <div class="edit-actions" draggable="false">
          <button class="btn-icon" data-action="edit-asset" data-id="${asset.id}" draggable="false" aria-label="${escAttr(asset.name)} 수정">✎</button>
          <button class="btn-icon btn-danger" data-action="delete-asset" data-id="${asset.id}" draggable="false" aria-label="${escAttr(asset.name)} 삭제">🗑</button>
        </div>
      ` : ''}
    </div>
  `;
}

function toggleListCat(catId) {
  const newOpen = UIState.listCategoryOpen[catId] === false ? true : false;
  UIState.listCategoryOpen[catId] = newOpen;

  const section = $(`#listCat-${catId}`);
  if (!section) { renderList(); return; }

  const header = section.querySelector('.list-cat-header');
  if (header) {
    header.setAttribute('aria-expanded', String(newOpen));
    const chevron = header.querySelector('.chevron');
    if (chevron) chevron.classList.toggle('open', newOpen);
  }

  const existingBody = section.querySelector('.list-cat-body');
  if (newOpen) {
    if (!existingBody) {
      const assets = filterAssets(appState.assets, UIState.listSearchQuery).filter(a => a.category === catId);
      const shownCount = UIState.listCategoryShown[catId] || LAZY_RENDER_THRESHOLD;
      const visibleAssets = assets.slice(0, shownCount);
      const hasMore = assets.length > shownCount;
      const cat = CAT_MAP[catId];

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'list-cat-body';
      bodyDiv.setAttribute('role', 'list');
      bodyDiv.innerHTML = `
        ${visibleAssets.length > 0
          ? visibleAssets.map(a => renderListAsset(a)).join('')
          : '<div class="empty-cat">자산이 없습니다</div>'}
        ${hasMore ? `
          <button class="btn-sm show-more-btn" data-action="show-more" data-cat="${escAttr(catId)}"
            aria-label="${escAttr(cat.label)} 자산 더 보기 (${assets.length - shownCount}개 남음)">
            더 보기 (${assets.length - shownCount}개 남음)
          </button>
        ` : ''}
      `;
      section.appendChild(bodyDiv);
      if (UIState.isEditMode) setupDragAndDrop();
    }
  } else {
    if (existingBody) existingBody.remove();
  }
}

// ── Drag & Drop ──
// v4.4.1: 처음부터 재작성
//  - 데스크톱: 행 어디서든 드래그 시작 (핸들 gate 제거, .edit-actions는 draggable=false로 차단됨)
//  - 모바일: .drag-handle 터치만 드래그 시작 (히트영역 44px CSS로 확대)
//  - 삽입선 피드백: 타겟 상/하반부 판정 → drag-over-top / drag-over-bottom
//  - window.__dragInProgress 전역 플래그: app.js 스와이프 핸들러가 이를 보고 bail
//  - 카테고리 dragstart도 stopPropagation
function setupDragAndDrop() {
  _dragCleanup.removeAll();

  // ── Asset rows ──
  $$('.list-asset[draggable]').forEach(el => {
    _dragCleanup.add(el, 'dragstart', e => {
      e.stopPropagation();
      _dragAssetId = el.dataset.id;
      _dragCatName = el.dataset.cat;
      _dragInsertBefore = false;
      el.classList.add('dragging');
      window.__dragInProgress = true;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(_dragAssetId));
      } catch (_) { /* Safari quirk */ }
    });

    _dragCleanup.add(el, 'dragend', () => {
      el.classList.remove('dragging');
      _clearDragOverClasses();
      _dragAssetId = null;
      _dragCatName = null;
      _dragInsertBefore = false;
      setTimeout(() => { window.__dragInProgress = false; }, 50);
    });

    _dragCleanup.add(el, 'dragover', e => {
      if (!_dragAssetId || el.dataset.cat !== _dragCatName) return;
      if (el.dataset.id === _dragAssetId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = el.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      _dragInsertBefore = before;
      _clearDragOverClasses();
      el.classList.add(before ? 'drag-over-top' : 'drag-over-bottom');
    });

    _dragCleanup.add(el, 'dragleave', e => {
      if (e.currentTarget === el && !el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    _dragCleanup.add(el, 'drop', e => {
      e.preventDefault();
      e.stopPropagation();
      _clearDragOverClasses();
      const targetId = el.dataset.id;
      if (_dragAssetId && _dragAssetId !== targetId && el.dataset.cat === _dragCatName) {
        onReorderAsset(_dragAssetId, targetId, _dragInsertBefore);
      }
    });
  });

  // ── Category rows ──
  $$('.list-cat[draggable]').forEach(el => {
    _dragCleanup.add(el, 'dragstart', e => {
      // 안전장치: 내부 asset에서 시작한 dragstart가 버블링된 경우 차단
      if (e.target.closest('.list-asset')) { e.preventDefault(); return; }
      e.stopPropagation();
      _dragAssetId = null;
      _dragCatName = el.dataset.cat;
      _dragInsertBefore = false;
      el.classList.add('dragging');
      window.__dragInProgress = true;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(_dragCatName));
      } catch (_) {}
    });

    _dragCleanup.add(el, 'dragend', () => {
      el.classList.remove('dragging');
      _clearDragOverClasses();
      _dragCatName = null;
      _dragInsertBefore = false;
      setTimeout(() => { window.__dragInProgress = false; }, 50);
    });

    _dragCleanup.add(el, 'dragover', e => {
      if (_dragAssetId) return; // asset 드래그 중엔 카테고리 하이라이트 금지
      if (!_dragCatName || el.dataset.cat === _dragCatName) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = el.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      _dragInsertBefore = before;
      _clearDragOverClasses();
      el.classList.add(before ? 'drag-over-top' : 'drag-over-bottom');
    });

    _dragCleanup.add(el, 'dragleave', e => {
      if (e.currentTarget === el && !el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    _dragCleanup.add(el, 'drop', e => {
      e.preventDefault();
      e.stopPropagation();
      _clearDragOverClasses();
      const targetCat = el.dataset.cat;
      if (_dragCatName && !_dragAssetId && _dragCatName !== targetCat) {
        onReorderCategory(_dragCatName, targetCat, _dragInsertBefore);
      }
    });
  });

  setupTouchDrag();
}

function _clearDragOverClasses() {
  $$('.drag-over-top, .drag-over-bottom, .drag-over').forEach(d => {
    d.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over');
  });
}

// ── Touch Drag (mobile) ──
function setupTouchDrag() {
  const touchMoveHandler = e => {
    if (!_touchClone) return;
    e.preventDefault();
    const t = e.touches[0];
    positionGhost(t);
    const elBelow = document.elementFromPoint(t.clientX, t.clientY);
    const target = elBelow?.closest('.list-asset, .list-cat');
    _clearDragOverClasses();
    if (!target || target === _touchDragEl) return;
    if (_touchDragEl.classList.contains('list-asset')) {
      if (!target.classList.contains('list-asset')) return;
      if (target.dataset.cat !== _touchDragEl.dataset.cat) return;
    } else if (_touchDragEl.classList.contains('list-cat')) {
      if (!target.classList.contains('list-cat')) return;
      if (target.dataset.cat === _touchDragEl.dataset.cat) return;
    }
    const rect = target.getBoundingClientRect();
    const before = (t.clientY - rect.top) < rect.height / 2;
    _touchInsertBefore = before;
    target.classList.add(before ? 'drag-over-top' : 'drag-over-bottom');
  };
  _dragCleanup.add(document, 'touchmove', touchMoveHandler, { passive: false });

  const touchEndHandler = () => {
    if (!_touchClone) return;
    const dropTarget = document.querySelector('.drag-over-top, .drag-over-bottom');
    if (dropTarget && _touchDragEl) {
      const before = dropTarget.classList.contains('drag-over-top');
      if (_touchDragEl.classList.contains('list-asset') && dropTarget.classList.contains('list-asset')) {
        const fromId = _touchDragEl.dataset.id;
        const toId = dropTarget.dataset.id;
        if (fromId && toId && _touchDragEl.dataset.cat === dropTarget.dataset.cat && fromId !== toId) {
          onReorderAsset(fromId, toId, before);
        }
      } else if (_touchDragEl.classList.contains('list-cat') && dropTarget.classList.contains('list-cat')) {
        const fromCat = _touchDragEl.dataset.cat;
        const toCat = dropTarget.dataset.cat;
        if (fromCat && toCat && fromCat !== toCat) {
          onReorderCategory(fromCat, toCat, before);
        }
      }
    }
    cleanupTouchDrag();
  };
  _dragCleanup.add(document, 'touchend', touchEndHandler);
  _dragCleanup.add(document, 'touchcancel', cleanupTouchDrag);

  $$('.drag-handle').forEach(handle => {
    _dragCleanup.add(handle, 'touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      const target = handle.closest('.list-asset') || handle.closest('.list-cat');
      if (!target) return;
      _touchDragEl = target;
      _touchInsertBefore = false;
      _touchClone = target.cloneNode(true);
      _touchClone.classList.add('touch-ghost');
      _touchClone.style.width = target.offsetWidth + 'px';
      document.body.appendChild(_touchClone);
      positionGhost(e.touches[0]);
      target.classList.add('dragging');
      window.__dragInProgress = true;
    }, { passive: false });
  });
}

function cleanupTouchDrag() {
  if (_touchClone) { _touchClone.remove(); _touchClone = null; }
  if (_touchDragEl) { _touchDragEl.classList.remove('dragging'); _touchDragEl = null; }
  _touchInsertBefore = false;
  _clearDragOverClasses();
  setTimeout(() => { window.__dragInProgress = false; }, 50);
}

function positionGhost(touch) {
  if (!_touchClone) return;
  _touchClone.style.left = (touch.clientX - TOUCH_GHOST_OFFSET.x) + 'px';
  _touchClone.style.top = (touch.clientY - TOUCH_GHOST_OFFSET.y) + 'px';
}

function onReorderAsset(fromId, toId, insertBefore) {
  reorderAsset(fromId, toId, insertBefore);
  renderList();
}

function onReorderCategory(fromCat, toCat, insertBefore) {
  reorderCategory(fromCat, toCat, insertBefore);
  renderList();
}

function confirmDeleteAsset(id) {
  const asset = getAsset(id);
  if (!asset) return;
  openConfirmModal(
    `"${asset.name}" 자산을 삭제하시겠습니까?`,
    () => { deleteAsset(id); renderList(); showToast('삭제되었습니다'); }
  );
}
