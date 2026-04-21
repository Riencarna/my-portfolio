/* =============================================
   My Portfolio v5.11.1 — Modals UI
   Cycle C: 자산 상세 거래 통계 섹션 (C-16)
   Soft Neutral: rounded sheets, soft shadows
   All IDs from uid() are strings — no Number() wrapping
   ============================================= */

let _modalKeyHandler = null;
let _focusStack = [];
const _modalCleanup = Cleanup.scope('modals');

function _getTopmostModal() {
  const all = $$('.modal.active');
  return all.length > 0 ? all[all.length - 1] : null;
}

function _ensureKeyHandler() {
  if (_modalKeyHandler) return;
  _modalKeyHandler = (e) => {
    const topModal = _getTopmostModal();
    if (!topModal) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeModal(topModal.id); return; }
    if (e.key === 'Tab') {
      const box = topModal.querySelector('.modal-box');
      if (!box) return;
      const focusable = box.querySelectorAll(FOCUSABLE_SEL);
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }
  };
  document.addEventListener('keydown', _modalKeyHandler);
}

function _removeKeyHandlerIfNoModals() {
  if ($$('.modal.active').length === 0 && _modalKeyHandler) {
    document.removeEventListener('keydown', _modalKeyHandler);
    _modalKeyHandler = null;
  }
}

function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  _focusStack.push(document.activeElement);
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const backdrop = modal.querySelector('.modal-backdrop');
  if (backdrop) backdrop.onclick = () => closeModal(id);
  _ensureKeyHandler();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const focusable = modal.querySelector(FOCUSABLE_SEL);
      if (focusable) focusable.focus();
    });
  });
}

function _restoreFocus() {
  const el = _focusStack.pop();
  if (el && typeof el.focus === 'function' && document.contains(el)) {
    try { el.focus(); } catch (e) { console.warn('_restoreFocus failed:', e); }
  }
}

function closeModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  modal.removeAttribute('aria-modal');
  modal.classList.add('closing');
  setTimeout(() => {
    modal.classList.remove('active', 'closing');
    _removeKeyHandlerIfNoModals();
    if ($$('.modal.active').length === 0) _restoreFocus();
  }, MODAL_ANIM_MS);
}

function closeAllModals() {
  const modals = $$('.modal.active');
  if (modals.length === 0) return Promise.resolve();
  _modalCleanup.removeAll();
  modals.forEach(m => {
    m.setAttribute('aria-hidden', 'true');
    m.removeAttribute('aria-modal');
    m.classList.add('closing');
  });
  return new Promise(resolve => {
    setTimeout(() => {
      modals.forEach(m => m.classList.remove('active', 'closing'));
      if (_modalKeyHandler) {
        document.removeEventListener('keydown', _modalKeyHandler);
        _modalKeyHandler = null;
      }
      const firstFocus = _focusStack.length > 0 ? _focusStack[0] : null;
      _focusStack = [];
      if (firstFocus && typeof firstFocus.focus === 'function' && document.contains(firstFocus)) {
        try { firstFocus.focus(); } catch (e) { console.warn('closeAllModals restoreFocus failed:', e); }
      }
      resolve();
    }, MODAL_ANIM_MS);
  });
}

function openConfirmModal(msg, onConfirm) {
  const container = $('#modalConfirm');
  if (!container) return;
  container.innerHTML = `<div class="modal-backdrop"></div>
    <div class="modal-box" role="alertdialog" aria-label="confirm" aria-describedby="confirmMsg">
      <div class="modal-body"><p id="confirmMsg" style="margin-bottom:8px">${escHtml(msg)}</p>
        <div class="modal-actions"><button class="btn-s" data-action="close-confirm">취소</button>
          <button class="btn-p btn-danger" data-action="confirm-ok">확인</button></div></div></div>`;
  openModal('modalConfirm');
  const handler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'close-confirm') closeModal('modalConfirm');
    else if (target.dataset.action === 'confirm-ok') { closeModal('modalConfirm'); onConfirm(); }
  };
  _modalCleanup.add(container, 'click', handler);
}

// ── Category Selector ──
function renderCategorySelector(selectedId, containerId) {
  return `<div class="cat-select" id="${containerId}" role="radiogroup" aria-labelledby="${containerId}Label">
    ${CATEGORIES.map(c => `<button class="cat-btn ${c.id === selectedId ? 'active' : ''}"
      data-cat="${escAttr(c.id)}" data-action="select-cat" role="radio"
      aria-checked="${c.id === selectedId ? 'true' : 'false'}">${c.icon} ${escHtml(c.label)}</button>`).join('')}</div>`;
}

function selectCat(btn) {
  const group = btn.closest('.cat-select');
  if (group) group.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
  updateFormFields(btn.dataset.cat);
}

function renderIncomeCatSelector(selectedCat, labelId) {
  return `<div class="cat-select" role="radiogroup" aria-labelledby="${labelId}">
    ${INCOME_CATS.map(c => `<button class="cat-btn ${c.id === selectedCat ? 'active' : ''}"
      data-cat="${escAttr(c.id)}" data-action="select-inc-cat" role="radio"
      aria-checked="${c.id === selectedCat ? 'true' : 'false'}">${c.icon} ${escHtml(c.label)}</button>`).join('')}</div>`;
}

function selectIncCat(btn) {
  const group = btn.closest('.cat-select');
  if (group) group.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
}

// ── Preset Datalist (v5.5.0) ──
function _renderPresetDatalist(listId, type) {
  const presets = loadPresets();
  const list = Array.isArray(presets[type]) ? presets[type] : [];
  if (list.length === 0) return '';
  return `<datalist id="${listId}">${list.map(v => `<option value="${escAttr(v)}"></option>`).join('')}</datalist>`;
}

// ── Main Modal Delegation ──
function _setupModalMainDelegation(container) {
  const handler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'close-modal') closeModal(target.dataset.modal || 'modalMain');
    else if (action === 'select-cat') selectCat(target);
    else if (action === 'select-inc-cat') selectIncCat(target);
    else if (action === 'do-add-asset') doAddAsset();
    else if (action === 'do-edit-asset') doEditAsset(target.dataset.id);
    else if (action === 'open-transaction') openTransaction(target.dataset.id, target.dataset.type || 'buy');
    else if (action === 'edit-asset-from-detail') openEditAsset(target.dataset.id);
    else if (action === 'edit-txn') { e.stopPropagation(); openEditTransaction(target.dataset.assetId, target.dataset.txnId); }
    else if (action === 'delete-txn') { e.stopPropagation(); doDeleteTxn(target.dataset.assetId, target.dataset.txnId); }
    else if (action === 'create-portfolio') doCreatePortfolio();
    else if (action === 'wallet-scan') doWalletScan();
    else if (action === 'import-wallet') doImportWallet();
    else if (action === 'toggle-wallet-all') {
      const cb = target.querySelector('input[type="checkbox"]') || target;
      toggleWalletAll(cb.checked);
    }
    else if (action === 'do-add-income') doAddIncome();
    else if (action === 'do-edit-income') doEditIncome(target.dataset.id);
    else if (action === 'do-save-usdt') doSaveUsdtBatch();
    else if (action === 'add-usdt-row') { const rows = $('#usdtRows'); if (rows) { rows.insertAdjacentHTML('beforeend', _buildUsdtDefaultRows(1)); } }
    else if (action === 'remove-usdt-row') { target.closest('.usdt-add-row')?.remove(); _recalcUsdtAddTotal(); }
    else if (action === 'set-add-tx-currency') _setAddTxCurrency(target, target.dataset.currency);
  };
  _modalCleanup.add(container, 'click', handler);
}

function _setupModalSubDelegation(container, extraHandler) {
  const handler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'close-sub-modal') closeModal('modalSub');
    else if (extraHandler) extraHandler(action, target, e);
  };
  _modalCleanup.add(container, 'click', handler);
}

// ── Form Fields ──
const NAME_PLACEHOLDER = {
  '국내주식': '예: 삼성전자, SK하이닉스',
  '해외주식': '예: AAPL, QQQ, TSLA',
  '코인': '예: BTC, ETH, SOL',
  '현금': '예: 비상금, 달러, 용돈',
  '예적금': '예: 정기예금, 적금',
  '부동산': '예: 아파트, 오피스텔',
  '기타': '예: 금, 자동차, 보험',
};

function updateFormFields(cat) {
  const isStock = ['국내주식', '해외주식'].includes(cat);
  const isCoin = cat === '코인';
  const isCash = cat === '현금';
  const isInvestment = INVESTMENT_CATS.includes(cat);
  const stockF = $('#stockFields'), coinF = $('#coinField'), usdtF = $('#usdtField');
  const txnSection = $('#txnSection'), valueField = $('#valueField');
  const priceLabel = $('#editPriceLabel');
  const nameInput = $('#assetName') || $('#editName');
  if (stockF) { stockF.classList.toggle('hidden', !isStock); stockF.classList.toggle('form-row-visible', isStock); }
  const stockKrHint = $('#stockKrHint');
  if (stockKrHint) stockKrHint.classList.toggle('hidden', cat !== '국내주식');
  if (coinF) coinF.classList.toggle('hidden', !isCoin);
  if (usdtF) usdtF.classList.toggle('hidden', !isCash);
  const usdtMultiF = $('#usdtMultiField');
  if (usdtMultiF) usdtMultiF.classList.toggle('hidden', !(isCash && $('#isUsdt')?.checked));
  if (txnSection) txnSection.classList.toggle('hidden', !isInvestment);
  if (valueField) valueField.classList.toggle('hidden', isInvestment || (isCash && $('#isUsdt')?.checked));
  if (priceLabel) priceLabel.textContent = isInvestment ? '현재 단가' : '금액';
  if (nameInput) nameInput.placeholder = NAME_PLACEHOLDER[cat] || '자산명';
  const coinCurrField = $('#coinCurrencyField');
  if (coinCurrField) coinCurrField.classList.toggle('hidden', !isCoin);
  if (!isCoin) {
    const addCurr = $('#addTxCurrency');
    if (addCurr) addCurr.value = 'KRW';
    const addLabel = $('#addTxPriceLabel');
    if (addLabel) addLabel.textContent = '단가';
  }
}

// ── Add Asset ──
function openAddAsset() {
  _modalCleanup.removeAll();
  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>자산 추가</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="form-group"><label id="catSelectLabel">카테고리</label>${renderCategorySelector('국내주식', 'catSelect')}</div>
    <div class="form-group"><label for="assetName">자산명 *</label><input type="text" id="assetName" placeholder="예: 삼성전자, SK하이닉스" maxlength="100" required></div>
    <div class="form-row" id="stockFields"><div class="form-group"><label for="assetCode">종목코드</label><input type="text" id="assetCode" placeholder="예: 005930" maxlength="20"></div><div class="form-group"><label for="assetMarket">시장</label><select id="assetMarket"><option value="KOSPI">KOSPI</option><option value="KOSDAQ">KOSDAQ</option><option value="NYSE">NYSE</option><option value="NASDAQ">NASDAQ</option><option value="">기타</option></select></div></div>
    <div class="form-hint-info" id="stockKrHint" role="note">💡 TIGER/KODEX 미국·나스닥 등 <strong>해외 지수 추종 ETF</strong>는 "해외주식" 카테고리를 선택하세요</div>
    <div class="form-group hidden" id="coinField"><label for="coinSelect">코인 ID (CoinGecko)</label><select id="coinSelect"><option value="">선택하세요</option>${Object.entries(COIN_IDS).map(([sym, id]) => `<option value="${escAttr(id)}">${escHtml(sym)} (${escHtml(id)})</option>`).join('')}<option value="__custom__">직접 입력</option></select><input type="text" id="coinCustomId" class="hidden" placeholder="CoinGecko ID 입력 (예: tether-gold)" maxlength="100" style="margin-top:6px"></div>
    <div class="form-group hidden" id="usdtField"><label><input type="checkbox" id="isUsdt"> USDT (자동 환율 업데이트)</label></div>
    <div class="hidden" id="usdtMultiField">
      <label class="form-label">거래소/지갑별 USDT 입력</label>
      <div id="usdtRows">${_buildUsdtDefaultRows(5)}</div>
      <button type="button" class="btn-sm" data-action="add-usdt-row" style="margin-top:6px">+ 추가 입력</button>
      <div class="usdt-add-total" id="usdtAddTotalBar">합계: <strong id="usdtAddTotal">0</strong> USDT <span class="amount-hint" id="usdtAddTotalHint"></span></div>
    </div>
    <div class="form-group"><label for="assetNote">메모</label><input type="text" id="assetNote" placeholder="선택사항" maxlength="500"></div>
    <div class="form-group hidden" id="valueField"><label for="assetValue">금액</label><input type="number" id="assetValue" placeholder="예: 1000000" min="0" step="any"><div class="amount-hint" id="valueHint"></div></div>
    <div id="txnSection"><hr><h4>첫 거래 입력</h4>
    <div class="form-group hidden" id="coinCurrencyField"><label>통화</label><div class="btn-group" role="radiogroup" aria-label="통화 선택"><button type="button" class="btn-sm active" data-action="set-add-tx-currency" data-currency="KRW" role="radio" aria-checked="true">KRW (원)</button><button type="button" class="btn-sm" data-action="set-add-tx-currency" data-currency="USD" role="radio" aria-checked="false">USD ($)</button></div><input type="hidden" id="addTxCurrency" value="KRW"></div>
    <div class="form-row"><div class="form-group"><label for="txPrice" id="addTxPriceLabel">단가</label><input type="number" id="txPrice" placeholder="0" min="0" step="any"><div class="amount-hint" id="txPriceHint"></div></div><div class="form-group"><label for="txQty">수량</label><input type="number" id="txQty" placeholder="0" min="0" step="any"></div></div>
    <div class="tx-total" aria-live="polite">총 투자금: <span id="addTxTotal">₩0</span></div>
    <div class="form-row"><div class="form-group"><label for="txDate">날짜</label><input type="date" id="txDate" value="${today()}"></div><div class="form-group"><label for="txAccount">계좌</label><input type="text" id="txAccount" placeholder="선택사항" maxlength="50" list="txAccountPresets">${_renderPresetDatalist('txAccountPresets', 'accounts')}</div></div></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button><button class="btn-p" data-action="do-add-asset">추가</button></div></div></div>`;
  openModal('modalMain');
  updateFormFields('국내주식');
  _setupModalMainDelegation(container);
  _setupAmountHints(['assetValue:valueHint', 'txPrice:txPriceHint']);
  _setupUsdtCheckbox();
  _setupAddTxTotal();
  _setupCoinCustomId();
}

function doAddAsset() {
  const name = $('#assetName')?.value.trim();
  if (!name) { showToast('자산명을 입력하세요', 'error'); return; }
  const cat = $('.modal.active .cat-btn.active')?.dataset?.cat || '기타';
  const isInvestment = INVESTMENT_CATS.includes(cat);
  const isUsdtChecked = cat === '현금' && ($('#isUsdt')?.checked || false);
  let amount, txns, usdtQty, usdtDetails;
  if (isInvestment) {
    let price = safeNum($('#txPrice')?.value);
    const qty = safeNum($('#txQty')?.value);
    const addCurrency = $('#addTxCurrency')?.value;
    if (cat === '코인' && addCurrency === 'USD' && price > 0) {
      const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
      price = Math.round(price * rate);
    }
    amount = price;
    txns = price > 0 && qty > 0 ? [{
      type: 'buy', price, qty,
      date: $('#txDate')?.value || today(),
      account: $('#txAccount')?.value.trim() || null, memo: null,
    }] : [];
  } else if (isUsdtChecked) {
    const collected = _collectUsdtRows();
    usdtDetails = collected.details;
    usdtQty = collected.total;
    const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
    amount = Math.round(usdtQty * rate);
    txns = amount > 0 ? [{ type: 'buy', price: amount, qty: 1, date: today(), account: null, memo: null }] : [];
  } else {
    const val = safeNum($('#assetValue')?.value);
    amount = val;
    txns = amount > 0 ? [{ type: 'buy', price: amount, qty: 1, date: today(), account: null, memo: null }] : [];
  }
  const asset = addAsset({
    name, category: cat, amount,
    stockCode: isInvestment ? ($('#assetCode')?.value.trim() || '') : '',
    market: isInvestment ? ($('#assetMarket')?.value || '') : '',
    coinId: cat === '코인' ? _getCoinIdValue() : '',
    isUsdt: isUsdtChecked,
    usdtQty: isUsdtChecked ? usdtQty : undefined,
    usdtDetails: isUsdtChecked ? usdtDetails : undefined,
    note: $('#assetNote')?.value.trim() || null,
    txns,
  });
  if (asset) {
    const acctVal = $('#txAccount')?.value.trim();
    if (acctVal) addPreset('accounts', acctVal);
    closeModal('modalMain');
    showToast(`"${name}" 추가됨`, 'success');
    render();
    if (isInvestment) _autoFetchNewAssetPrice(asset);
  }
}

async function _autoFetchNewAssetPrice(asset) {
  try {
    let price = null;
    if (asset.coinId) {
      const prices = await fetchCoinPrices([asset.coinId]);
      price = prices[asset.coinId];
    } else if (asset.stockCode) {
      price = await fetchStockPrice(asset);
    }
    if (price != null && isFinite(price) && price > 0) {
      updateAsset(asset.id, { amount: price, lpu: new Date().toLocaleString('ko-KR') });
      invalidateCalcCache();
      render();
    }
  } catch (e) {
    console.warn('_autoFetchNewAssetPrice: failed for', asset.name, e.message);
  }
}

// ── Edit Asset ──
function openEditAsset(id) {
  const asset = getAsset(id);
  if (!asset) return;
  const isStock = ['국내주식', '해외주식'].includes(asset.category);
  const isCoin = asset.category === '코인';
  const isCash = asset.category === '현금';
  _modalCleanup.removeAll();
  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>자산 수정</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="form-group"><label id="editCatSelectLabel">카테고리</label>${renderCategorySelector(asset.category, 'editCatSelect')}</div>
    <div class="form-group"><label for="editName">자산명</label><input type="text" id="editName" value="${escAttr(asset.name)}" maxlength="100"></div>
    <div class="form-row ${isStock ? '' : 'hidden'}" id="stockFields"><div class="form-group"><label for="assetCode">종목코드</label><input type="text" id="assetCode" value="${escAttr(asset.stockCode)}" maxlength="20"></div><div class="form-group"><label for="assetMarket">시장</label><select id="assetMarket">${['KOSPI', 'KOSDAQ', 'NYSE', 'NASDAQ', ''].map(m => `<option value="${escAttr(m)}" ${asset.market === m ? 'selected' : ''}>${m || '기타'}</option>`).join('')}</select></div></div>
    <div class="form-hint-info ${asset.category === '국내주식' ? '' : 'hidden'}" id="stockKrHint" role="note">💡 TIGER/KODEX 미국·나스닥 등 <strong>해외 지수 추종 ETF</strong>는 "해외주식" 카테고리를 선택하세요</div>
    <div class="form-group ${isCoin ? '' : 'hidden'}" id="coinField"><label for="coinSelect">코인 ID</label><select id="coinSelect"><option value="">선택하세요</option>${Object.entries(COIN_IDS).map(([sym, cid]) => `<option value="${escAttr(cid)}" ${asset.coinId === cid ? 'selected' : ''}>${escHtml(sym)}</option>`).join('')}<option value="__custom__" ${asset.coinId && !Object.values(COIN_IDS).includes(asset.coinId) ? 'selected' : ''}>직접 입력</option></select><input type="text" id="coinCustomId" class="${asset.coinId && !Object.values(COIN_IDS).includes(asset.coinId) ? '' : 'hidden'}" value="${escAttr(asset.coinId && !Object.values(COIN_IDS).includes(asset.coinId) ? asset.coinId : '')}" placeholder="CoinGecko ID 입력 (예: tether-gold)" maxlength="100" style="margin-top:6px"></div>
    <div class="form-group ${isCash ? '' : 'hidden'}" id="usdtField"><label><input type="checkbox" id="isUsdt" ${asset.isUsdt ? 'checked' : ''}> USDT</label></div>
    <div class="${asset.isUsdt ? '' : 'hidden'}" id="usdtMultiField">
      <label class="form-label">거래소/지갑별 USDT 입력</label>
      <div id="usdtRows">${asset.isUsdt ? _buildUsdtRowsFromDetails(asset.usdtDetails) : _buildUsdtDefaultRows(5)}</div>
      <button type="button" class="btn-sm" data-action="add-usdt-row" style="margin-top:6px">+ 추가 입력</button>
      <div class="usdt-add-total" id="usdtAddTotalBar">합계: <strong id="usdtAddTotal">0</strong> USDT <span class="amount-hint" id="usdtAddTotalHint"></span></div>
    </div>
    <div class="form-group ${asset.isUsdt ? 'hidden' : ''}"><label for="editPrice" id="editPriceLabel">${INVESTMENT_CATS.includes(asset.category) ? '현재 단가' : '금액'}</label><input type="number" id="editPrice" value="${safeNum(asset.amount)}" min="0" step="any"><div class="amount-hint" id="editPriceHint"></div></div>
    <div class="form-group"><label for="editNote">메모</label><input type="text" id="editNote" value="${escAttr(asset.note || '')}" maxlength="500"></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button><button class="btn-p" data-action="do-edit-asset" data-id="${id}">저장</button></div></div></div>`;
  openModal('modalMain');
  _setupModalMainDelegation(container);
  _setupAmountHints(['editPrice:editPriceHint']);
  _setupUsdtCheckbox();
  _setupCoinCustomId();
}

function doEditAsset(id) {
  const cat = $$('#modalMain .cat-btn.active')[0]?.dataset?.cat || '기타';
  const isUsdtChecked = cat === '현금' && ($('#isUsdt')?.checked || false);
  let newAmount, usdtQty, usdtDetails;
  if (isUsdtChecked) {
    const collected = _collectUsdtRows();
    usdtDetails = collected.details;
    usdtQty = collected.total;
    const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
    newAmount = Math.round(usdtQty * rate);
  } else {
    newAmount = safeNum($('#editPrice')?.value);
  }
  const updates = {
    name: $('#editName')?.value.trim() || '이름 없음',
    category: cat,
    stockCode: $('#assetCode')?.value.trim() || '',
    market: $('#assetMarket')?.value || '',
    coinId: _getCoinIdValue(),
    isUsdt: isUsdtChecked,
    usdtQty: isUsdtChecked ? usdtQty : undefined,
    usdtDetails: isUsdtChecked ? usdtDetails : undefined,
    amount: newAmount,
    note: $('#editNote')?.value.trim() || null,
  };
  if (!INVESTMENT_CATS.includes(cat)) {
    updates.txns = newAmount > 0
      ? [{ id: uid(), type: 'buy', price: newAmount, qty: 1, date: today(), account: null, memo: null }]
      : [];
  }
  updateAsset(id, updates);
  closeModal('modalMain');
  showToast('수정되었습니다', 'success');
  render();
}

// ── Asset Detail ──
function openAssetDetail(id) {
  const asset = getAsset(id);
  if (!asset) return;
  const v = calcAssetValue(asset);
  const isInv = INVESTMENT_CATS.includes(asset.category);
  _modalCleanup.removeAll();
  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box modal-large"><div class="modal-header"><h3>${escHtml(asset.name)}</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-label">카테고리</span><span>${CAT_MAP[asset.category]?.icon || ''} ${escHtml(asset.category)}</span></div>
      ${isInv ? `
        <div class="detail-item"><span class="detail-label">현재가</span><span>${escHtml(fmtPrice(v.price))}</span></div>
        <div class="detail-item"><span class="detail-label">수량</span><span>${escHtml(fmtNum(v.qty, v.qty % 1 !== 0 ? 4 : 0))}</span></div>
        <div class="detail-item"><span class="detail-label">평균 단가</span><span>${escHtml(fmtPrice(v.avgPrice))}</span></div>
        <div class="detail-item"><span class="detail-label">평가금액</span><span class="value-lg">${escHtml(fmtKRW(v.value))}</span></div>
        <div class="detail-item"><span class="detail-label">투자금액</span><span>${escHtml(fmtKRW(v.cost))}</span></div>
        <div class="detail-item"><span class="detail-label">손익</span><span class="${profitClass(v.profit)}">${escHtml(fmtKRW(v.profit))} (${escHtml(fmtPct(v.profitPct))})</span></div>
      ` : `
        <div class="detail-item"><span class="detail-label">금액</span><span class="value-lg">${escHtml(fmtKRW(v.value))}</span></div>
      `}
      ${asset.lpu ? `<div class="detail-item"><span class="detail-label">최근 업데이트</span><span>${escHtml(asset.lpu)}</span></div>` : ''}
      ${asset.stockCode ? `<div class="detail-item"><span class="detail-label">종목코드</span><span>${escHtml(asset.stockCode)} (${escHtml(asset.market)})</span></div>` : ''}
      ${asset.note ? `<div class="detail-item"><span class="detail-label">메모</span><span>${escHtml(asset.note)}</span></div>` : ''}
    </div>
    <div class="detail-actions">
      ${isInv ? `
        <button class="btn-p" data-action="open-transaction" data-id="${id}" data-type="buy">매수</button>
        <button class="btn-s" data-action="open-transaction" data-id="${id}" data-type="sell">매도</button>
      ` : ''}
      <button class="btn-sm" data-action="edit-asset-from-detail" data-id="${id}">수정</button>
    </div>
    ${isInv && asset.txns.length > 0 ? _renderTxnStats(v) : ''}
    ${isInv ? `
    <div class="txn-section" role="region" aria-label="거래 내역"><h4>거래 내역 (${asset.txns.length}건)</h4><div class="txn-list" role="list">
      ${asset.txns.length > 0
        ? asset.txns.slice().reverse().map(t => `<div class="txn-item" role="listitem">
            <div class="txn-info">
              <span class="txn-type ${t.type}">${t.type === 'buy' ? '매수' : '매도'}</span>
              <span>${escHtml(fmtDate(t.date))}</span>
              ${t.account ? `<span class="txn-acct">${escHtml(t.account)}</span>` : ''}
            </div>
            <div class="txn-values">
              <span>${escHtml(fmtPrice(t.price))} x ${escHtml(fmtNum(t.qty, t.qty % 1 !== 0 ? 4 : 0))}</span>
              <span class="txn-total">${escHtml(fmtKRW(t.price * t.qty))}</span>
            </div>
            ${t.memo ? `<div class="txn-memo">${escHtml(t.memo)}</div>` : ''}
            <div class="txn-actions">
              <button class="btn-icon txn-edit" aria-label="거래 수정"
                data-action="edit-txn" data-asset-id="${id}" data-txn-id="${t.id}">✎</button>
              <button class="btn-icon btn-danger txn-del" aria-label="거래 삭제"
                data-action="delete-txn" data-asset-id="${id}" data-txn-id="${t.id}">✕</button>
            </div>
          </div>`).join('')
        : '<div class="empty-state">거래 내역이 없습니다</div>'}
    </div></div>
    ` : ''}
    </div></div>`;
  openModal('modalMain');
  _setupModalMainDelegation(container);
}

// ── Transaction ──
function openTransaction(assetId, type = 'buy') {
  const asset = getAsset(assetId);
  if (!asset) return;
  const isForeign = asset.market && !['KOSPI', 'KOSDAQ', ''].includes(asset.market);
  const isCoin = asset.category === '코인';
  const showCurrency = isForeign || isCoin;
  const container = $('#modalSub');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>${escHtml(asset.name)} — ${type === 'buy' ? '매수' : '매도'}</h3><button class="modal-close" data-action="close-sub-modal" aria-label="닫기">✕</button></div><div class="modal-body">
    ${showCurrency ? `<div class="form-group"><label>통화</label><div class="btn-group" role="radiogroup" aria-label="통화 선택"><button class="btn-sm active" data-action="set-tx-currency" data-currency="KRW" role="radio" aria-checked="true">KRW (원)</button><button class="btn-sm" data-action="set-tx-currency" data-currency="USD" role="radio" aria-checked="false">USD ($)</button></div><input type="hidden" id="txCurrency" value="KRW"></div>` : ''}
    <div class="form-row"><div class="form-group"><label for="txnPrice">단가 ${showCurrency ? '(<span id="txCurrLabel">KRW</span>)' : ''}</label><input type="number" id="txnPrice" placeholder="0" min="0" step="any"><div class="amount-hint" id="txnPriceHint"></div></div><div class="form-group"><label for="txnQty">수량</label><input type="number" id="txnQty" placeholder="0" min="0" step="any"></div></div>
    <div class="tx-total" aria-live="polite">총액: <span id="txnTotal">₩0</span></div>
    <div class="form-row"><div class="form-group"><label for="txnDate">날짜</label><input type="date" id="txnDate" value="${today()}"></div><div class="form-group"><label for="txnAccount">계좌</label><input type="text" id="txnAccount" placeholder="선택사항" maxlength="50" list="txnAccountPresets">${_renderPresetDatalist('txnAccountPresets', 'accounts')}</div></div>
    <div class="form-group"><label for="txnMemo">메모</label><input type="text" id="txnMemo" placeholder="선택사항" maxlength="200"></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-sub-modal">취소</button><button class="btn-p" data-action="do-transaction" data-asset-id="${assetId}" data-type="${type}">${type === 'buy' ? '매수' : '매도'}</button></div></div></div>`;
  openModal('modalSub');
  _setupModalSubDelegation(container, (action, target) => {
    if (action === 'set-tx-currency') _setTxCurrency(target, target.dataset.currency);
    else if (action === 'do-transaction') doTransaction(target.dataset.assetId, target.dataset.type);
  });
  const calcTxTotal = () => {
    const p = safeNum($('#txnPrice')?.value), q = safeNum($('#txnQty')?.value);
    const el = $('#txnTotal');
    if (el) el.textContent = fmtKRW(p * q);
  };
  const txnPriceEl = $('#txnPrice'), txnQtyEl = $('#txnQty');
  if (txnPriceEl) _modalCleanup.add(txnPriceEl, 'input', calcTxTotal);
  if (txnQtyEl) _modalCleanup.add(txnQtyEl, 'input', calcTxTotal);
  _setupAmountHints(['txnPrice:txnPriceHint']);
}

function _setTxCurrency(btn, currency) {
  $$('#modalSub .btn-group [role="radio"]').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
  const input = $('#txCurrency');
  if (input) input.value = currency;
  const label = $('#txCurrLabel');
  if (label) label.textContent = currency;
  // refresh amount hint
  const txnPriceEl = $('#txnPrice');
  if (txnPriceEl) txnPriceEl.dispatchEvent(new Event('input'));
}

async function doTransaction(assetId, type) {
  let price = safeNum($('#txnPrice')?.value);
  const qty = safeNum($('#txnQty')?.value);
  if (!price || !qty) { showToast('단가와 수량을 입력하세요', 'error'); return; }
  const currency = $('#txCurrency')?.value;
  if (currency === 'USD') {
    try {
      const rate = await fetchExchangeRate();
      price = Math.round(price * rate);
    } catch (e) {
      console.warn('doTransaction: exchange rate fetch failed', e);
      showToast('환율 조회 실패', 'error');
      return;
    }
  }
  const asset = getAsset(assetId);
  if (!asset) return;
  if (type === 'sell') {
    const v = calcAssetValue(asset);
    if (qty > v.qty) { showToast(`보유 수량(${fmtNum(v.qty, 2)})을 초과합니다`, 'error'); return; }
  }
  const success = addTransactionWithPrice(assetId, {
    type, price, qty,
    date: $('#txnDate')?.value || today(),
    account: $('#txnAccount')?.value.trim() || null,
    memo: $('#txnMemo')?.value.trim() || null,
  }, price);
  if (success) {
    const acctVal = $('#txnAccount')?.value.trim();
    if (acctVal) addPreset('accounts', acctVal);
    closeModal('modalSub');
    showToast(`${type === 'buy' ? '매수' : '매도'} 완료`, 'success');
    openAssetDetail(assetId);
  }
}

function doDeleteTxn(assetId, txnId) {
  openConfirmModal('이 거래를 삭제하시겠습니까?', () => {
    deleteTransaction(assetId, txnId);
    openAssetDetail(assetId);
    showToast('거래 삭제됨');
  });
}

// ── Edit Transaction ──
function openEditTransaction(assetId, txnId) {
  const asset = getAsset(assetId);
  if (!asset) return;
  const txn = asset.txns.find(t => t.id === txnId);
  if (!txn) return;
  const container = $('#modalSub');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>거래 수정</h3><button class="modal-close" data-action="close-sub-modal" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="form-group"><label>유형</label><div class="btn-group" role="radiogroup" aria-label="거래 유형"><button type="button" class="btn-sm ${txn.type === 'buy' ? 'active' : ''}" data-action="set-edit-txn-type" data-type="buy" role="radio" aria-checked="${txn.type === 'buy'}">매수</button><button type="button" class="btn-sm ${txn.type === 'sell' ? 'active' : ''}" data-action="set-edit-txn-type" data-type="sell" role="radio" aria-checked="${txn.type === 'sell'}">매도</button></div><input type="hidden" id="editTxnType" value="${txn.type}"></div>
    <div class="form-row"><div class="form-group"><label for="editTxnPrice">단가</label><input type="number" id="editTxnPrice" value="${safeNum(txn.price)}" min="0" step="any"><div class="amount-hint" id="editTxnPriceHint"></div></div><div class="form-group"><label for="editTxnQty">수량</label><input type="number" id="editTxnQty" value="${safeNum(txn.qty)}" min="0" step="any"></div></div>
    <div class="tx-total" aria-live="polite">총액: <span id="editTxnTotal">${escHtml(fmtKRW(txn.price * txn.qty))}</span></div>
    <div class="form-row"><div class="form-group"><label for="editTxnDate">날짜</label><input type="date" id="editTxnDate" value="${txn.date || today()}"></div><div class="form-group"><label for="editTxnAccount">계좌</label><input type="text" id="editTxnAccount" value="${escAttr(txn.account || '')}" placeholder="선택사항" maxlength="50" list="editTxnAccountPresets">${_renderPresetDatalist('editTxnAccountPresets', 'accounts')}</div></div>
    <div class="form-group"><label for="editTxnMemo">메모</label><input type="text" id="editTxnMemo" value="${escAttr(txn.memo || '')}" placeholder="선택사항" maxlength="200"></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-sub-modal">취소</button><button class="btn-p" data-action="do-edit-txn" data-asset-id="${assetId}" data-txn-id="${txnId}">저장</button></div></div></div>`;
  openModal('modalSub');
  _setupModalSubDelegation(container, (action, target) => {
    if (action === 'set-edit-txn-type') _setEditTxnType(target, target.dataset.type);
    else if (action === 'do-edit-txn') doEditTxn(target.dataset.assetId, target.dataset.txnId);
  });
  const calcTotal = () => {
    const p = safeNum($('#editTxnPrice')?.value), q = safeNum($('#editTxnQty')?.value);
    const el = $('#editTxnTotal');
    if (el) el.textContent = fmtKRW(p * q);
  };
  const priceEl = $('#editTxnPrice'), qtyEl = $('#editTxnQty');
  if (priceEl) _modalCleanup.add(priceEl, 'input', calcTotal);
  if (qtyEl) _modalCleanup.add(qtyEl, 'input', calcTotal);
  _setupAmountHints(['editTxnPrice:editTxnPriceHint']);
}

function _setEditTxnType(btn, type) {
  $$('#modalSub .btn-group [role="radio"]').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
  const input = $('#editTxnType');
  if (input) input.value = type;
}

function doEditTxn(assetId, txnId) {
  const price = safeNum($('#editTxnPrice')?.value);
  const qty = safeNum($('#editTxnQty')?.value);
  if (!price || !qty) { showToast('단가와 수량을 입력하세요', 'error'); return; }
  const ok = updateTransaction(assetId, txnId, {
    type: $('#editTxnType')?.value || 'buy',
    price, qty,
    date: $('#editTxnDate')?.value || today(),
    account: $('#editTxnAccount')?.value.trim() || null,
    memo: $('#editTxnMemo')?.value.trim() || null,
  });
  if (ok) {
    const acctVal = $('#editTxnAccount')?.value.trim();
    if (acctVal) addPreset('accounts', acctVal);
    closeModal('modalSub');
    showToast('거래 수정됨', 'success');
    if (_getTopmostModal()) {
      openAssetDetail(assetId);
    } else if (typeof _rerenderTxnList === 'function') {
      _rerenderTxnList();
    }
  }
}

// ── Portfolio Manager ──
function openPortfolioManager() {
  _modalCleanup.removeAll();
  const meta = loadPortfolioMeta();
  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>포트폴리오 관리</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="pf-list" role="list" id="pfListContainer">
      ${meta.list.map(p => `<div class="pf-item ${p.id === activePortfolioId ? 'active' : ''}" role="listitem" data-pid="${escAttr(p.id)}">
        <span class="pf-name" data-action="switch" data-pid="${escAttr(p.id)}" role="button" tabindex="0"
          aria-current="${p.id === activePortfolioId ? 'true' : 'false'}">${escHtml(p.name)}</span>
        <div class="pf-actions">
          <button class="btn-icon" data-action="rename" data-pid="${escAttr(p.id)}" aria-label="${escHtml(p.name)} 이름 변경">✎</button>
          ${p.id !== 'default' ? `<button class="btn-icon btn-danger" data-action="delete" data-pid="${escAttr(p.id)}" aria-label="${escHtml(p.name)} 삭제">🗑</button>` : ''}
        </div>
      </div>`).join('')}
    </div>
    ${meta.list.length < LIMITS.portfolios
      ? `<div class="form-group form-group-mt"><div class="form-row"><input type="text" id="newPfName" placeholder="새 포트폴리오 이름" maxlength="50" aria-label="새 포트폴리오 이름"><button class="btn-p" data-action="create-portfolio">생성</button></div></div>`
      : `<p class="text-muted">최대 ${LIMITS.portfolios}개 도달</p>`}
  </div></div>`;
  openModal('modalMain');
  const pfContainer = $('#pfListContainer');
  if (pfContainer) {
    _modalCleanup.add(pfContainer, 'click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action, pid = target.dataset.pid;
      if (!pid) return;
      if (action === 'switch') doSwitchPortfolio(pid);
      else if (action === 'rename') {
        const m = loadPortfolioMeta();
        const pf = m.list.find(p => p.id === pid);
        if (pf) openRenameModal(pid, pf.name);
      } else if (action === 'delete') {
        const m = loadPortfolioMeta();
        const pf = m.list.find(p => p.id === pid);
        if (pf) doDeletePortfolio(pid, pf.name);
      }
    });
    _modalCleanup.add(pfContainer, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target.closest('[data-action="switch"]');
        if (target) { e.preventDefault(); doSwitchPortfolio(target.dataset.pid); }
      }
    });
  }
  _setupModalMainDelegation(container);
}

async function doSwitchPortfolio(pid) {
  if (pid === activePortfolioId) return;
  UIState.reset();
  switchPortfolio(pid);
  await closeAllModals();
  render();
  showToast('포트폴리오 변경됨', 'success');
}

async function doCreatePortfolio() {
  const name = $('#newPfName')?.value.trim();
  if (!name) { showToast('이름을 입력하세요', 'error'); return; }
  const id = createPortfolio(name);
  if (id) {
    UIState.reset();
    switchPortfolio(id);
    await closeAllModals();
    render();
    showToast(`"${name}" 생성됨`, 'success');
  }
}

function openRenameModal(pid, currentName) {
  const container = $('#modalSub');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>포트폴리오 이름 변경</h3><button class="modal-close" data-action="close-sub-modal" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="form-group"><label for="renamePfInput">새 이름</label><input type="text" id="renamePfInput" value="${escAttr(currentName)}" maxlength="50"></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-sub-modal">취소</button><button class="btn-p" data-action="do-rename">변경</button></div></div></div>`;
  openModal('modalSub');
  _setupModalSubDelegation(container, (action) => {
    if (action === 'do-rename') {
      const name = $('#renamePfInput')?.value.trim();
      if (name) { renamePortfolio(pid, name); closeModal('modalSub'); openPortfolioManager(); }
    }
  });
}

function doDeletePortfolio(pid, name) {
  openConfirmModal(`"${name}" 포트폴리오를 삭제하시겠습니까?`, async () => {
    deletePortfolio(pid);
    loadData();
    await closeAllModals();
    render();
    showToast('삭제됨');
  });
}

// ── Wallet Scan ──
function openWalletScan() {
  _modalCleanup.removeAll();
  const addr = loadWalletAddr();
  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box modal-large"><div class="modal-header"><h3>지갑 스캔</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body">
    <p class="text-muted">EVM 호환 지갑 주소를 입력하면 6개 체인의 잔액을 스캔합니다.</p>
    <div class="form-row"><input type="text" id="walletAddr" value="${escAttr(addr)}" placeholder="0x..." class="flex-1" aria-label="EVM 지갑 주소"><button class="btn-p" id="btnScan" data-action="wallet-scan">스캔</button></div>
    <div id="walletProgress" class="hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar"><div class="progress-fill" id="walletProgressBar"></div></div><div class="progress-text" id="walletProgressText" aria-live="polite">스캔 중...</div></div>
    <div id="walletResults"></div></div></div>`;
  openModal('modalMain');
  _setupModalMainDelegation(container);
}

async function doWalletScan() {
  const addr = $('#walletAddr')?.value.trim();
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    showToast('올바른 EVM 주소를 입력하세요 (0x + 40자)', 'error');
    return;
  }
  saveWalletAddr(addr);
  const btn = $('#btnScan');
  if (btn) btn.disabled = true;
  const progress = $('#walletProgress');
  if (progress) { progress.classList.remove('hidden'); progress.classList.add('visible'); }

  const results = await scanWallet(addr, prog => {
    const pct = Math.round((prog.done / prog.total) * 100);
    const bar = $('#walletProgressBar');
    const text = $('#walletProgressText');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = `${prog.done}/${prog.total} 체크 중... (${pct}%)`;
  });

  if (progress) { progress.classList.add('hidden'); progress.classList.remove('visible'); }
  if (btn) btn.disabled = false;
  const resultsDiv = $('#walletResults');
  if (!resultsDiv) return;

  if (results.length === 0) {
    resultsDiv.innerHTML = '<div class="empty-state">발견된 자산이 없습니다</div>';
    return;
  }

  resultsDiv.innerHTML = `<div class="wallet-results">
    <div class="form-group"><label><input type="checkbox" id="walletSelectAll" checked> 전체 선택</label></div>
    ${results.map((r, i) => `<div class="wallet-item">
      <input type="checkbox" class="wallet-check" data-idx="${i}" checked aria-label="${escAttr(r.symbol)} 선택">
      <span class="wallet-symbol">${escHtml(r.symbol)}</span>
      <span class="wallet-bal">${escHtml(fmtNum(r.balance, 4))}</span>
      <span class="wallet-chains">${escHtml(r.chains.join(', '))}</span>
      <span class="wallet-value">${escHtml(fmtKRW(r.valueKRW))}</span>
    </div>`).join('')}
    <button class="btn-p btn-mt" data-action="import-wallet">선택 항목 가져오기</button>
  </div>`;
  const selectAllCb = $('#walletSelectAll');
  if (selectAllCb) _modalCleanup.add(selectAllCb, 'change', () => toggleWalletAll(selectAllCb.checked));
}

function toggleWalletAll(checked) {
  $$('.wallet-check').forEach(cb => cb.checked = checked);
}

function doImportWallet() {
  const selected = $$('.wallet-check:checked')
    .map(cb => walletScanResults[Number(cb.dataset.idx)])
    .filter(Boolean);
  if (selected.length === 0) { showToast('선택된 항목이 없습니다', 'error'); return; }
  const count = importWalletAssets(selected);
  closeModal('modalMain');
  showToast(`${count}개 자산 가져오기 완료`, 'success');
  render();
}

// ── Amount Hints ──
function _buildUsdtDefaultRows(count) {
  return Array.from({ length: count }, () =>
    `<div class="usdt-add-row"><input type="text" class="usdt-loc-input" placeholder="거래소/지갑명" maxlength="50"><input type="number" class="usdt-qty-input" placeholder="USDT" min="0" step="any"><button type="button" class="btn-icon btn-danger usdt-row-del" data-action="remove-usdt-row" aria-label="삭제">✕</button></div>`
  ).join('');
}

function _buildUsdtRowsFromDetails(details) {
  if (!Array.isArray(details) || details.length === 0) return _buildUsdtDefaultRows(5);
  return details.map(d =>
    `<div class="usdt-add-row"><input type="text" class="usdt-loc-input" value="${escAttr(d.name)}" placeholder="거래소/지갑명" maxlength="50"><input type="number" class="usdt-qty-input" value="${d.qty || ''}" placeholder="USDT" min="0" step="any"><button type="button" class="btn-icon btn-danger usdt-row-del" data-action="remove-usdt-row" aria-label="삭제">✕</button></div>`
  ).join('');
}

function _collectUsdtRows() {
  const rows = $$('#usdtRows .usdt-add-row');
  const details = [];
  let total = 0;
  for (const row of rows) {
    const name = row.querySelector('.usdt-loc-input')?.value.trim() || '';
    const qty = safeNum(row.querySelector('.usdt-qty-input')?.value);
    if (name || qty > 0) details.push({ name, qty });
    total += qty;
  }
  return { details, total };
}

function _recalcUsdtAddTotal() {
  const { total } = _collectUsdtRows();
  const el = $('#usdtAddTotal');
  if (el) el.textContent = fmtNum(total, 2);
  const hint = $('#usdtAddTotalHint');
  if (hint) {
    const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
    hint.textContent = total > 0 ? `≈ ${fmtKRW(Math.round(total * rate))}` : '';
  }
}

function _setupUsdtCheckbox() {
  const cb = $('#isUsdt');
  if (!cb) return;
  _modalCleanup.add(cb, 'change', () => {
    const multiField = $('#usdtMultiField');
    if (multiField) multiField.classList.toggle('hidden', !cb.checked);
    // 단일 금액 필드: USDT 모드에선 숨기기
    const valueField = $('#valueField');
    if (valueField) valueField.classList.toggle('hidden', cb.checked);
    const editPriceGroup = $('#editPrice')?.closest('.form-group');
    if (editPriceGroup && !$('#valueField')) editPriceGroup.classList.toggle('hidden', cb.checked);
    // 자산명 자동 채우기
    const nameInput = $('#assetName') || $('#editName');
    if (nameInput && cb.checked && !nameInput.value.trim()) nameInput.value = 'USDT';
    if (cb.checked) _recalcUsdtAddTotal();
  });
  // 행 입력 시 합계 재계산
  const rowsContainer = $('#usdtRows');
  if (rowsContainer) {
    _modalCleanup.add(rowsContainer, 'input', (e) => {
      if (e.target.classList.contains('usdt-qty-input')) _recalcUsdtAddTotal();
    });
  }
  // 초기 합계 계산
  if (cb.checked) _recalcUsdtAddTotal();
}

// ── Asset Detail Stats (Cycle C, C-16) ──
function _renderTxnStats(v) {
  const hasRealized = v.totalSell > 0;
  const hasFirstBuy = v.firstBuyDate && isValidDate(v.firstBuyDate);
  let holdingDays = null;
  if (hasFirstBuy) {
    const start = new Date(v.firstBuyDate).getTime();
    const end = (v.qty < 1e-9 && v.lastTxnDate) ? new Date(v.lastTxnDate).getTime() : Date.now();
    if (isFinite(start) && isFinite(end) && end >= start) {
      holdingDays = Math.floor((end - start) / 86400000);
    }
  }
  const periodLabel = (v.qty < 1e-9) ? '보유 기간' : '보유일';
  return `
    <div class="txn-stats" role="region" aria-label="거래 통계">
      <h4>거래 통계</h4>
      <div class="txn-stats-grid">
        <div class="txn-stat-item"><span class="txn-stat-label">총 매수액</span><span class="txn-stat-value">${escHtml(fmtKRW(v.totalBuy))}</span></div>
        <div class="txn-stat-item"><span class="txn-stat-label">총 매도액</span><span class="txn-stat-value">${escHtml(fmtKRW(v.totalSell))}</span></div>
        ${hasRealized ? `
          <div class="txn-stat-item"><span class="txn-stat-label">실현 손익</span>
            <span class="txn-stat-value ${profitClass(v.realizedProfit)}">${escHtml(fmtKRW(v.realizedProfit))} (${escHtml(fmtPct(v.realizedPct))})</span></div>
        ` : `
          <div class="txn-stat-item"><span class="txn-stat-label">실현 손익</span><span class="txn-stat-value text-muted">매도 기록 없음</span></div>
        `}
        ${hasFirstBuy ? `
          <div class="txn-stat-item"><span class="txn-stat-label">첫 매수일</span><span class="txn-stat-value">${escHtml(fmtDate(v.firstBuyDate))}${holdingDays != null ? ` <span class="txn-stat-sub">· ${periodLabel} ${holdingDays}일</span>` : ''}</span></div>
        ` : ''}
      </div>
    </div>
  `;
}

function _setupAmountHints(pairs) {
  for (const pair of pairs) {
    const [inputId, hintId] = pair.split(':');
    const input = $(`#${inputId}`);
    const hint = $(`#${hintId}`);
    if (!input || !hint) continue;
    const update = () => {
      const usdtCb = $('#isUsdt');
      if (usdtCb?.checked && (inputId === 'assetValue' || inputId === 'editPrice')) {
        const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
        const val = safeNum(input.value);
        hint.textContent = val > 0 ? `≈ ${fmtKRW(Math.round(val * rate))}` : '';
      } else {
        const addCurr = $('#addTxCurrency')?.value;
        const txCurr = $('#txCurrency')?.value;
        const isUsd = (inputId === 'txPrice' && addCurr === 'USD') || (inputId === 'txnPrice' && txCurr === 'USD');
        hint.textContent = isUsd ? fmtAmountHintUSD(input.value) : fmtAmountHint(input.value);
      }
    };
    _modalCleanup.add(input, 'input', update);
    update();
  }
}

function _setupAddTxTotal() {
  const calc = () => {
    const p = safeNum($('#txPrice')?.value), q = safeNum($('#txQty')?.value);
    const el = $('#addTxTotal');
    if (!el) return;
    const curr = $('#addTxCurrency')?.value;
    if (curr === 'USD') {
      const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
      el.textContent = `$${fmtNum(p * q, 2)} (≈ ${fmtKRW(Math.round(p * q * rate))})`;
    } else {
      el.textContent = fmtKRW(p * q);
    }
  };
  const priceEl = $('#txPrice'), qtyEl = $('#txQty');
  if (priceEl) _modalCleanup.add(priceEl, 'input', calc);
  if (qtyEl) _modalCleanup.add(qtyEl, 'input', calc);
}

function _setAddTxCurrency(btn, currency) {
  $('#coinCurrencyField')?.querySelectorAll('[role="radio"]').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
  const input = $('#addTxCurrency');
  if (input) input.value = currency;
  const label = $('#addTxPriceLabel');
  if (label) label.textContent = currency === 'USD' ? '단가 (USD)' : '단가';
  // recalc total display
  const p = safeNum($('#txPrice')?.value), q = safeNum($('#txQty')?.value);
  const el = $('#addTxTotal');
  if (el) {
    if (currency === 'USD') {
      const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
      el.textContent = `$${fmtNum(p * q, 2)} (≈ ${fmtKRW(Math.round(p * q * rate))})`;
    } else {
      el.textContent = fmtKRW(p * q);
    }
  }
  // refresh amount hint
  const txPriceEl = $('#txPrice');
  if (txPriceEl) txPriceEl.dispatchEvent(new Event('input'));
}

// ── Coin Custom ID ──
function _setupCoinCustomId() {
  const sel = $('#coinSelect');
  if (!sel) return;
  _modalCleanup.add(sel, 'change', () => {
    const custom = $('#coinCustomId');
    if (custom) custom.classList.toggle('hidden', sel.value !== '__custom__');
  });
}

function _getCoinIdValue() {
  const sel = $('#coinSelect');
  if (!sel) return '';
  if (sel.value === '__custom__') return ($('#coinCustomId')?.value.trim().toLowerCase() || '');
  return sel.value || '';
}

// ── USDT Batch Manager ──
function _usdtLocationFromName(name) {
  const m = name.match(/^USDT\s*\((.+)\)$/);
  return m ? m[1] : null;
}

function _getExistingUsdtMap() {
  const map = {};
  for (const a of appState.assets) {
    if (a.isUsdt && a.category === '현금') {
      const loc = _usdtLocationFromName(a.name);
      if (loc) map[loc] = a;
    }
  }
  return map;
}

function _usdtRow(location, qty) {
  return `<div class="usdt-row" data-location="${escAttr(location)}">
    <span class="usdt-loc">${escHtml(location)}</span>
    <div class="usdt-input-wrap">
      <input type="number" class="usdt-qty-input" value="${qty || ''}" placeholder="0" min="0" step="any">
      <span class="usdt-unit">USDT</span>
    </div>
  </div>`;
}

function _usdtRecalcTotal() {
  const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
  let total = 0;
  // Section subtotals
  for (const section of $$('#modalMain .usdt-section')) {
    let secTotal = 0;
    for (const input of section.querySelectorAll('.usdt-qty-input')) {
      secTotal += safeNum(input.value);
    }
    const sub = section.querySelector('.usdt-subtotal');
    if (sub) sub.textContent = `${fmtNum(secTotal, 2)} USDT`;
    total += secTotal;
  }
  const totalEl = $('#usdtTotal');
  const krwEl = $('#usdtTotalKrw');
  if (totalEl) totalEl.textContent = fmtNum(total, 2);
  if (krwEl) krwEl.textContent = fmtKRW(Math.round(total * rate));
}

function openUsdtManager() {
  _modalCleanup.removeAll();
  const existingMap = _getExistingUsdtMap();
  const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;

  const buildSection = (key) => {
    const sec = USDT_LOCATIONS[key];
    const subtotalHtml = `<span class="usdt-subtotal">0 USDT</span>`;
    return `<div class="usdt-section" data-section="${key}">
      <div class="usdt-section-header">${sec.icon} ${sec.label} ${subtotalHtml}</div>
      ${sec.items.map(item => {
        const existing = existingMap[item];
        const qty = existing?.usdtQty || 0;
        return _usdtRow(item, qty);
      }).join('')}
    </div>`;
  };

  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box modal-large"><div class="modal-header"><h3>USDT 일괄 관리</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body usdt-manager">
    <div class="usdt-rate-bar">현재 USDT 환율: <strong>${escHtml(fmtNum(rate, 0))}원</strong><span class="usdt-rate-src">${cachedUsdt?.source || ''}</span></div>
    ${buildSection('overseas')}
    ${buildSection('wallet')}
    ${buildSection('domestic')}
    <div class="usdt-summary">
      <div class="usdt-summary-row"><span>합계</span><span><strong id="usdtTotal">0</strong> USDT</span></div>
      <div class="usdt-summary-row"><span>원화 환산</span><span id="usdtTotalKrw">${escHtml(fmtKRW(0))}</span></div>
    </div>
    <div class="modal-actions"><button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button><button class="btn-p" data-action="do-save-usdt">저장</button></div>
  </div></div>`;

  openModal('modalMain');
  _setupModalMainDelegation(container);

  const recalc = () => _usdtRecalcTotal();
  _modalCleanup.add(container, 'input', (e) => {
    if (e.target.classList.contains('usdt-qty-input')) recalc();
  });
  _usdtRecalcTotal();
}

function doSaveUsdtBatch() {
  const existingMap = _getExistingUsdtMap();
  const rate = cachedUsdt?.rate || FALLBACK_USD_KRW;
  const rows = $$('#modalMain .usdt-row');
  let addCount = 0, updateCount = 0;

  for (const row of rows) {
    const location = row.dataset.location;
    if (!location) continue;

    const qty = safeNum(row.querySelector('.usdt-qty-input')?.value);
    const assetName = `USDT (${location})`;
    const totalKRW = Math.round(qty * rate);

    const existing = existingMap[location];
    if (existing) {
      updateAsset(existing.id, {
        usdtQty: qty,
        amount: totalKRW,
        txns: totalKRW > 0 ? [{ id: uid(), type: 'buy', price: totalKRW, qty: 1, date: today(), account: null, memo: null }] : [],
      });
      updateCount++;
    } else if (qty > 0) {
      addAsset({
        name: assetName,
        category: '현금',
        isUsdt: true,
        usdtQty: qty,
        amount: totalKRW,
        note: null,
        txns: [{ type: 'buy', price: totalKRW, qty: 1, date: today(), account: null, memo: null }],
      });
      addCount++;
    }
  }

  closeModal('modalMain');
  const msg = [];
  if (addCount > 0) msg.push(`${addCount}개 추가`);
  if (updateCount > 0) msg.push(`${updateCount}개 업데이트`);
  showToast(msg.length > 0 ? `USDT: ${msg.join(', ')}` : 'USDT: 변경 없음', 'success');
  render();
}
