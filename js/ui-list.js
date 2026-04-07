/* =============================================
   My Portfolio v4.0.0 — Asset List UI
   Planner-Creator-Evaluator Cycle 1
   Scoped Cleanup for drag listeners
   ID-safe: all IDs are strings via sanitizeAsset
   ============================================= */

let _dragAssetId = null;
let _dragCatName = null;
let _touchDragEl = null;
let _touchClone = null;

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
    <div class="list-toolbar">
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
        <button class="btn-p" data-action="open-add-asset" aria-label="자산 추가">+ 자산 추가</button>
      </div>
    </div>

    <div class="asset-summary" aria-label="자산 요약">
      <span>총 ${appState.assets.length}개 자산</span>
      <span>${escHtml(fmtKRW(calcTotal(appState.assets)))}</span>
    </div>

    <div id="assetListBody" role="list" aria-label="자산 목록">
      ${order.map(catId => {
        const catAssets = grouped[catId] || [];
        if (catAssets.length === 0 && !UIState.isEditMode) return '';
        return renderListCategory(catId, catAssets);
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

function renderListCategory(catId, assets) {
  const cat = CAT_MAP[catId];
  const isOpen = UIState.listCategoryOpen[catId] !== false;
  const total = assets.reduce((s, a) => s + calcAssetValue(a).value, 0);
  const shownCount = UIState.listCategoryShown[catId] || LAZY_RENDER_THRESHOLD;
  const visibleAssets = assets.slice(0, shownCount);
  const hasMore = assets.length > shownCount;

  return `
    <div class="list-cat" id="listCat-${escAttr(catId)}" data-cat="${escAttr(catId)}"
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
  const hasProfit = v.cost > 0;

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
          ${v.qty > 0 ? `${escHtml(fmtNum(v.qty, v.qty % 1 !== 0 ? 4 : 0))}주` : ''}
          ${asset.lpu ? `· ${escHtml(fmtRelTime(asset.lpu))}` : ''}
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
function setupDragAndDrop() {
  _dragCleanup.removeAll();

  $$('.list-asset[draggable]').forEach(el => {
    _dragCleanup.add(el, 'dragstart', e => {
      if (!e.target.closest('.drag-handle')) { e.preventDefault(); return; }
      e.stopPropagation();
      _dragAssetId = el.dataset.id;
      _dragCatName = el.dataset.cat;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });
    _dragCleanup.add(el, 'dragend', () => {
      el.classList.remove('dragging');
      $$('.drag-over').forEach(d => d.classList.remove('drag-over'));
    });
    _dragCleanup.add(el, 'dragover', e => {
      e.preventDefault();
      if (el.dataset.cat === _dragCatName) el.classList.add('drag-over');
    });
    _dragCleanup.add(el, 'dragleave', () => el.classList.remove('drag-over'));
    _dragCleanup.add(el, 'drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const targetId = el.dataset.id;
      if (_dragAssetId && _dragAssetId !== targetId && el.dataset.cat === _dragCatName) {
        onReorderAsset(_dragAssetId, targetId);
      }
    });
  });

  $$('.list-cat[draggable]').forEach(el => {
    _dragCleanup.add(el, 'dragstart', e => {
      if (!e.target.closest('.cat-drag')) { e.preventDefault(); return; }
      _dragAssetId = null;
      _dragCatName = el.dataset.cat;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });
    _dragCleanup.add(el, 'dragend', () => {
      el.classList.remove('dragging');
      $$('.drag-over').forEach(d => d.classList.remove('drag-over'));
    });
    _dragCleanup.add(el, 'dragover', e => {
      e.preventDefault();
      if (_dragCatName && el.dataset.cat !== _dragCatName) el.classList.add('drag-over');
    });
    _dragCleanup.add(el, 'dragleave', () => el.classList.remove('drag-over'));
    _dragCleanup.add(el, 'drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const targetCat = el.dataset.cat;
      if (_dragCatName && !_dragAssetId && _dragCatName !== targetCat) onReorderCategory(_dragCatName, targetCat);
    });
  });

  setupTouchDrag();
}

function setupTouchDrag() {
  const touchMoveHandler = e => {
    if (!_touchClone) return;
    e.preventDefault();
    positionGhost(e.touches[0]);
    const elBelow = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    const target = elBelow?.closest('.list-asset, .list-cat');
    $$('.drag-over').forEach(d => d.classList.remove('drag-over'));
    if (target && target !== _touchDragEl) target.classList.add('drag-over');
  };
  _dragCleanup.add(document, 'touchmove', touchMoveHandler, { passive: false });

  const touchEndHandler = () => {
    if (!_touchClone) return;
    const dropTarget = $('.drag-over');
    if (dropTarget && _touchDragEl) {
      if (_touchDragEl.classList.contains('list-asset') && dropTarget.classList.contains('list-asset')) {
        const fromId = _touchDragEl.dataset.id;
        const toId = dropTarget.dataset.id;
        if (fromId && toId && _touchDragEl.dataset.cat === dropTarget.dataset.cat) {
          onReorderAsset(fromId, toId);
        }
      } else if (_touchDragEl.classList.contains('list-cat') && dropTarget.classList.contains('list-cat')) {
        const fromCat = _touchDragEl.dataset.cat;
        const toCat = dropTarget.dataset.cat;
        if (fromCat && toCat && fromCat !== toCat) onReorderCategory(fromCat, toCat);
      }
    }
    cleanupTouchDrag();
  };
  _dragCleanup.add(document, 'touchend', touchEndHandler);

  $$('.drag-handle').forEach(handle => {
    _dragCleanup.add(handle, 'touchstart', e => {
      e.preventDefault();
      const target = handle.closest('.list-asset') || handle.closest('.list-cat');
      if (!target) return;
      _touchDragEl = target;
      _touchClone = target.cloneNode(true);
      _touchClone.classList.add('touch-ghost');
      _touchClone.style.width = target.offsetWidth + 'px';
      document.body.appendChild(_touchClone);
      positionGhost(e.touches[0]);
      target.classList.add('dragging');
    }, { passive: false });
  });
}

function cleanupTouchDrag() {
  if (_touchClone) { _touchClone.remove(); _touchClone = null; }
  if (_touchDragEl) { _touchDragEl.classList.remove('dragging'); _touchDragEl = null; }
  $$('.drag-over').forEach(d => d.classList.remove('drag-over'));
}

function positionGhost(touch) {
  if (!_touchClone) return;
  _touchClone.style.left = (touch.clientX - TOUCH_GHOST_OFFSET.x) + 'px';
  _touchClone.style.top = (touch.clientY - TOUCH_GHOST_OFFSET.y) + 'px';
}

function onReorderAsset(fromId, toId) {
  reorderAsset(fromId, toId);
  renderList();
}

function onReorderCategory(fromCat, toCat) {
  reorderCategory(fromCat, toCat);
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
