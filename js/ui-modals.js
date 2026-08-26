/* =============================================
   My Portfolio v5.39.1 — Modals UI
   Cycle C: 자산 상세 거래 통계 섹션 (C-16)
   Soft Neutral: rounded sheets, soft shadows
   All IDs from uid() are strings — no Number() wrapping
   ============================================= */

let _modalKeyHandler = null;
let _focusStack = [];
let _addAssetFormGeneration = 0;
let _transactionFormGeneration = 0;
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
  if (!modal) return Promise.resolve(false);
  modal.setAttribute('aria-hidden', 'true');
  modal.removeAttribute('aria-modal');
  modal.classList.add('closing');
  return new Promise(resolve => {
    setTimeout(() => {
      modal.classList.remove('active', 'closing');
      _removeKeyHandlerIfNoModals();
      if ($$('.modal.active').length === 0) _restoreFocus();
      resolve(true);
    }, MODAL_ANIM_MS);
  });
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
  _modalCleanup.removeForElement(container);
  container.innerHTML = `<div class="modal-backdrop"></div>
    <div class="modal-box" role="alertdialog" aria-label="confirm" aria-describedby="confirmMsg">
      <div class="modal-body"><p id="confirmMsg" style="margin-bottom:8px;white-space:pre-line">${escHtml(msg)}</p>
        <div class="modal-actions"><button class="btn-s" data-action="close-confirm">취소</button>
          <button class="btn-p btn-danger" data-action="confirm-ok">확인</button></div></div></div>`;
  openModal('modalConfirm');
  const handler = async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'close-confirm') closeModal('modalConfirm');
    else if (target.dataset.action === 'confirm-ok') {
      target.disabled = true;
      await closeModal('modalConfirm');
      try {
        await onConfirm();
      } catch (err) {
        console.error('Confirmation action failed:', err);
        showToast('작업을 완료하지 못했습니다', 'error');
      }
    }
  };
  _modalCleanup.add(container, 'click', handler);
}

// ── Category Selector ──
const STOCK_KIND_DOMESTIC = 'domesticStock';
const STOCK_KIND_FOREIGN = 'foreignStock';
const STOCK_KIND_DOMESTIC_FOREIGN_ETF = 'domesticForeignEtf';
const KOREAN_EXCHANGE_MARKETS = Object.freeze(['KOSPI', 'KOSDAQ']);
const KOREAN_STOCK_MARKETS = Object.freeze([...KOREAN_EXCHANGE_MARKETS, '']);
const KOREAN_LISTED_ETF_MARKETS = Object.freeze(['KOSPI']);
const FOREIGN_STOCK_MARKETS = Object.freeze(['NASDAQ', 'NYSE', '']);

function renderCategorySelector(selectedId, containerId, selectedStockKind = '') {
  return `<div class="cat-select" id="${containerId}" role="radiogroup" aria-labelledby="${containerId}Label">
    ${CATEGORIES.map(c => {
      const stockKind = c.id === '국내주식' ? STOCK_KIND_DOMESTIC : (c.id === '해외주식' ? STOCK_KIND_FOREIGN : '');
      const isBaseActive = c.id === selectedId && !(c.id === '해외주식' && selectedStockKind === STOCK_KIND_DOMESTIC_FOREIGN_ETF);
      const base = `<button class="cat-btn ${isBaseActive ? 'active' : ''}"
        data-cat="${escAttr(c.id)}" data-stock-kind="${escAttr(stockKind)}" data-action="select-cat" role="radio"
        aria-checked="${isBaseActive ? 'true' : 'false'}">${c.icon} ${escHtml(c.label)}</button>`;
      if (c.id !== '해외주식') return base;
      const isEtfActive = selectedId === '해외주식' && selectedStockKind === STOCK_KIND_DOMESTIC_FOREIGN_ETF;
      return base + `<button class="cat-btn ${isEtfActive ? 'active' : ''}"
        data-cat="해외주식" data-stock-kind="${STOCK_KIND_DOMESTIC_FOREIGN_ETF}" data-action="select-cat" role="radio"
        aria-checked="${isEtfActive ? 'true' : 'false'}">🇰🇷🌍 국내상장 해외 ETF</button>`;
    }).join('')}</div>`;
}

function selectCat(btn) {
  const group = btn.closest('.cat-select');
  if (group) group.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-checked', 'true');
  updateFormFields(btn.dataset.cat, btn.dataset.stockKind || '');
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
    else if (action === 'restore-usdt-history') { e.stopPropagation(); doRestoreUsdtHistory(target.dataset.id, target.dataset.idx); }
    else if (action === 'delete-usdt-history') { e.stopPropagation(); doDeleteUsdtHistory(target.dataset.id, target.dataset.idx); }
    else if (action === 'restore-auto-backup') { doRestoreAutoBackup(target.dataset.id); }
    else if (action === 'delete-auto-backup') { e.stopPropagation(); doDeleteAutoBackup(target.dataset.id); }
    else if (action === 'compact-auto-backups') { e.stopPropagation(); doCompactAutoBackups(Number(target.dataset.keep || 1)); }
    else if (action === 'clear-auto-backups') { e.stopPropagation(); doClearAutoBackups(); }
    else if (action === 'open-auto-backup-manager') openAutoBackupManager();
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

function _stockKindForAsset(asset) {
  if (!asset) return '';
  if (asset.category === '국내주식') return STOCK_KIND_DOMESTIC;
  // Older local test data may have KOSDAQ here; keep recognizing it as this
  // form choice, but new domestic-listed overseas ETFs are saved as KOSPI.
  if (asset.category === '해외주식' && KOREAN_EXCHANGE_MARKETS.includes(asset.market || '')) {
    return STOCK_KIND_DOMESTIC_FOREIGN_ETF;
  }
  if (asset.category === '해외주식') return STOCK_KIND_FOREIGN;
  return '';
}

function _stockMarketsFor(cat, stockKind) {
  if (stockKind === STOCK_KIND_DOMESTIC_FOREIGN_ETF) return KOREAN_LISTED_ETF_MARKETS;
  if (cat === '국내주식') return KOREAN_STOCK_MARKETS;
  if (cat === '해외주식') return FOREIGN_STOCK_MARKETS;
  return [''];
}

function _renderStockMarketOptions(cat, stockKind, selectedMarket = '') {
  const markets = _stockMarketsFor(cat, stockKind);
  const selected = markets.includes(selectedMarket) ? selectedMarket : markets[0];
  return markets.map(m => `<option value="${escAttr(m)}" ${selected === m ? 'selected' : ''}>${m || '기타'}</option>`).join('');
}

function _syncStockMarketFields(cat, stockKind) {
  const select = $('#assetMarket');
  if (!select) return;
  const markets = _stockMarketsFor(cat, stockKind);
  const selected = markets.includes(select.value) ? select.value : markets[0];
  select.innerHTML = _renderStockMarketOptions(cat, stockKind, selected);
  select.value = selected;

  const marketLabel = document.querySelector('.modal.active label[for="assetMarket"]');
  if (marketLabel) {
    marketLabel.textContent = stockKind === STOCK_KIND_DOMESTIC_FOREIGN_ETF ? '국내 거래소' : '시장';
  }

  const codeInput = $('#assetCode');
  if (codeInput) {
    if (stockKind === STOCK_KIND_DOMESTIC_FOREIGN_ETF) codeInput.placeholder = '예: 360750';
    else if (cat === '국내주식') codeInput.placeholder = '예: 005930';
    else if (cat === '해외주식') codeInput.placeholder = '예: AAPL, QQQ';
    else codeInput.placeholder = '';
  }
}

function updateFormFields(cat, stockKind = '') {
  const activeCatBtn = $('.modal.active .cat-btn.active');
  const effectiveStockKind = stockKind || activeCatBtn?.dataset?.stockKind || '';
  const isDomesticForeignEtf = cat === '해외주식' && effectiveStockKind === STOCK_KIND_DOMESTIC_FOREIGN_ETF;
  const isStock = ['국내주식', '해외주식'].includes(cat);
  const isCoin = cat === '코인';
  const isCash = cat === '현금';
  const isInvestment = INVESTMENT_CATS.includes(cat);
  const stockF = $('#stockFields'), coinF = $('#coinField'), usdtF = $('#usdtField');
  const txnSection = $('#txnSection'), valueField = $('#valueField');
  const priceLabel = $('#editPriceLabel');
  const nameInput = $('#assetName') || $('#editName');
  if (stockF) { stockF.classList.toggle('hidden', !isStock); stockF.classList.toggle('form-row-visible', isStock); }
  if (isStock) _syncStockMarketFields(cat, effectiveStockKind);
  const stockKrHint = $('#stockKrHint');
  if (stockKrHint) {
    stockKrHint.classList.toggle('hidden', !(cat === '국내주식' || isDomesticForeignEtf));
    if (isDomesticForeignEtf) {
      stockKrHint.innerHTML = '국내 거래소에 상장됐지만 <strong>해외주식 자산</strong>으로 저장됩니다. 가격은 국내 종목코드로 업데이트됩니다.';
    } else if (cat === '국내주식') {
      stockKrHint.innerHTML = 'TIGER/KODEX 미국·나스닥 등 <strong>해외 지수 추종 ETF</strong>는 "국내상장 해외 ETF"를 선택하세요.';
    }
  }
  if (coinF) coinF.classList.toggle('hidden', !isCoin);
  if (usdtF) usdtF.classList.toggle('hidden', !isCash);
  const usdtMultiF = $('#usdtMultiField');
  if (usdtMultiF) usdtMultiF.classList.toggle('hidden', !(isCash && $('#isUsdt')?.checked));
  if (txnSection) txnSection.classList.toggle('hidden', !isInvestment);
  if (valueField) valueField.classList.toggle('hidden', isInvestment || (isCash && $('#isUsdt')?.checked));
  if (priceLabel) priceLabel.textContent = isInvestment ? '현재 단가' : '금액';
  if (nameInput) {
    nameInput.placeholder = isDomesticForeignEtf ? '예: TIGER 미국S&P500, KODEX 미국나스닥100' : (NAME_PLACEHOLDER[cat] || '자산명');
  }
  const supportsUsd = isCoin || (cat === '해외주식' && !isDomesticForeignEtf);
  const currencyField = $('#addCurrencyField');
  if (currencyField) currencyField.classList.toggle('hidden', !supportsUsd);
  const defaultCurrency = cat === '해외주식' && !isDomesticForeignEtf ? 'USD' : 'KRW';
  _setAddTxCurrencyValue(defaultCurrency);
}

// ── Add Asset ──
function openAddAsset() {
  _modalCleanup.removeAll();
  _usdtFormInitialTotal = 0;
  const container = $('#modalMain');
  const initialUsdRate = getRateDisplayInfo('usdkrw')?.rate || '';
  const formGeneration = ++_addAssetFormGeneration;
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>자산 추가</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body"><input type="hidden" id="addAssetFormGeneration" value="${formGeneration}">
    <div class="form-group"><label id="catSelectLabel">카테고리</label>${renderCategorySelector('국내주식', 'catSelect')}</div>
    <div class="form-group"><label for="assetName">자산명 *</label><input type="text" id="assetName" placeholder="예: 삼성전자, SK하이닉스" maxlength="100" required></div>
    <div class="form-row" id="stockFields"><div class="form-group"><label for="assetCode">종목코드</label><input type="text" id="assetCode" placeholder="예: 005930" maxlength="20"></div><div class="form-group"><label for="assetMarket">시장</label><select id="assetMarket">${_renderStockMarketOptions('국내주식', STOCK_KIND_DOMESTIC, 'KOSPI')}</select></div></div>
    <div class="form-hint-info hidden" id="stockKrHint" role="note"></div>
    <div class="form-group hidden" id="coinField"><label for="coinSelect">코인 ID (CoinGecko)</label><select id="coinSelect"><option value="">선택하세요</option>${Object.entries(COIN_IDS).map(([sym, id]) => `<option value="${escAttr(id)}">${escHtml(sym)} (${escHtml(id)})</option>`).join('')}<option value="__custom__">직접 입력</option></select><input type="text" id="coinCustomId" class="hidden" placeholder="CoinGecko ID 입력 (예: tether-gold)" maxlength="100" style="margin-top:6px"></div>
    <div class="form-group hidden" id="usdtField"><label><input type="checkbox" id="isUsdt"> USDT (자동 환율 업데이트)</label></div>
    <div class="hidden" id="usdtMultiField">
      <label class="form-label">거래소/지갑별 USDT 입력</label>
      <div id="usdtRows">${_buildUsdtDefaultRows(5)}</div>
      <button type="button" class="btn-sm" data-action="add-usdt-row" style="margin-top:6px">+ 추가 입력</button>
      <div class="usdt-add-total" id="usdtAddTotalBar">합계: <strong id="usdtAddTotal">0</strong> USDT <span class="amount-hint" id="usdtAddTotalHint"></span></div>
    </div>
    <div class="form-group"><label for="assetNote">메모</label><input type="text" id="assetNote" placeholder="선택사항" maxlength="500"></div>
    <div class="form-group hidden" id="valueField"><label for="assetValue">금액</label><input type="number" inputmode="decimal" id="assetValue" placeholder="예: 1000000" min="0" step="any"><div class="amount-hint" id="valueHint"></div></div>
    <div id="txnSection"><hr><h4>첫 거래 입력</h4>
    <div class="form-group hidden" id="addCurrencyField"><label>통화</label><div class="btn-group" role="radiogroup" aria-label="통화 선택"><button type="button" class="btn-sm active" data-action="set-add-tx-currency" data-currency="KRW" role="radio" aria-checked="true">KRW (원)</button><button type="button" class="btn-sm" data-action="set-add-tx-currency" data-currency="USD" role="radio" aria-checked="false">USD ($)</button></div><input type="hidden" id="addTxCurrency" value="KRW"></div>
    <div class="form-group hidden" id="addFxRateField"><label for="addTxFxRate">적용 환율 (1달러당 원화) *</label><input type="number" inputmode="decimal" id="addTxFxRate" value="${initialUsdRate}" min="1" step="any"><div class="hint-text">자동 환율을 확인하고, 과거 거래라면 당시 환율로 수정하세요.</div></div>
    <div class="form-row"><div class="form-group"><label for="txPrice" id="addTxPriceLabel">단가</label><input type="number" inputmode="decimal" id="txPrice" placeholder="0" min="0" step="any"><div class="amount-hint" id="txPriceHint"></div></div><div class="form-group"><label for="txQty">수량</label><input type="number" inputmode="decimal" id="txQty" placeholder="0" min="0" step="any"></div></div>
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

async function doAddAsset() {
  const formGeneration = $('#addAssetFormGeneration')?.value;
  const name = $('#assetName')?.value.trim();
  if (!name) { showToast('자산명을 입력하세요', 'error'); return; }
  const activeCatBtn = $('.modal.active .cat-btn.active');
  const cat = activeCatBtn?.dataset?.cat || '기타';
  const isStock = STOCK_CATS.includes(cat);
  const isInvestment = INVESTMENT_CATS.includes(cat);
  const isUsdtChecked = cat === '현금' && ($('#isUsdt')?.checked || false);
  let amount, txns, usdtQty, usdtDetails;
  let addSubmitBtn = null;
  if (isInvestment) {
    let price = safeNum($('#txPrice')?.value);
    const qty = safeNum($('#txQty')?.value);
    const currency = $('#addTxCurrency')?.value === 'USD' ? 'USD' : 'KRW';
    const originalPrice = price;
    let fxRate = currency === 'USD' ? safeNum($('#addTxFxRate')?.value) : null;
    if (currency === 'USD' && price > 0) {
      addSubmitBtn = $('#modalMain [data-action="do-add-asset"]');
      if (addSubmitBtn?.disabled) return;
      if (addSubmitBtn) { addSubmitBtn.disabled = true; addSubmitBtn.textContent = '환율 확인 중…'; }
      try {
        if (!(fxRate > 0)) fxRate = await fetchReliableExchangeRate();
        if ($('#addAssetFormGeneration')?.value !== formGeneration) return;
        if (!(fxRate > 0)) {
          showToast('신뢰할 수 있는 환율이 없습니다. 적용 환율을 직접 입력해주세요.', 'error');
          if (addSubmitBtn) { addSubmitBtn.disabled = false; addSubmitBtn.textContent = '추가'; }
          $('#addTxFxRate')?.focus();
          return;
        }
        const rateInput = $('#addTxFxRate');
        if (rateInput) rateInput.value = fxRate;
        const modal = $('#modalMain');
        if (!modal?.classList.contains('active') || modal.getAttribute('aria-hidden') === 'true') return;
        price = Math.round(originalPrice * fxRate);
      } catch (e) {
        console.warn('doAddAsset: exchange rate fetch failed', e);
        showToast('환율을 확인하지 못해 자산을 추가하지 않았습니다', 'error');
        if (addSubmitBtn) { addSubmitBtn.disabled = false; addSubmitBtn.textContent = '추가'; }
        return;
      }
    }
    amount = price;
    txns = price > 0 && qty > 0 ? [{
      type: 'buy', price, qty, currency, originalPrice, fxRate,
      date: $('#txDate')?.value || today(),
      account: $('#txAccount')?.value.trim() || null, memo: null,
    }] : [];
  } else if (isUsdtChecked) {
    const collected = _collectUsdtRows();
    usdtDetails = collected.details;
    usdtQty = collected.total;
    const rate = getUsdtRateSync().rate;
    amount = Math.round(usdtQty * rate);
    txns = amount > 0 ? [{ type: 'buy', price: amount, qty: 1, date: today(), account: null, memo: null }] : [];
  } else {
    const val = safeNum($('#assetValue')?.value);
    amount = val;
    txns = amount > 0 ? [{ type: 'buy', price: amount, qty: 1, date: today(), account: null, memo: null }] : [];
  }
  const asset = addAsset({
    name, category: cat, amount,
    stockCode: isStock ? ($('#assetCode')?.value.trim() || '') : '',
    market: isStock ? ($('#assetMarket')?.value || '') : '',
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
  } else if (addSubmitBtn) {
    addSubmitBtn.disabled = false;
    addSubmitBtn.textContent = '추가';
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
  const stockKind = _stockKindForAsset(asset);
  _modalCleanup.removeAll();
  _usdtFormInitialTotal = asset.isUsdt ? safeNum(asset.usdtQty) : 0;
  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>자산 수정</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="form-group"><label id="editCatSelectLabel">카테고리</label>${renderCategorySelector(asset.category, 'editCatSelect', stockKind)}</div>
    <div class="form-group"><label for="editName">자산명</label><input type="text" id="editName" value="${escAttr(asset.name)}" maxlength="100"></div>
    <div class="form-row ${isStock ? '' : 'hidden'}" id="stockFields"><div class="form-group"><label for="assetCode">종목코드</label><input type="text" id="assetCode" value="${escAttr(asset.stockCode)}" maxlength="20"></div><div class="form-group"><label for="assetMarket">시장</label><select id="assetMarket">${_renderStockMarketOptions(asset.category, stockKind, asset.market)}</select></div></div>
    <div class="form-hint-info hidden" id="stockKrHint" role="note"></div>
    <div class="form-group ${isCoin ? '' : 'hidden'}" id="coinField"><label for="coinSelect">코인 ID</label><select id="coinSelect"><option value="">선택하세요</option>${Object.entries(COIN_IDS).map(([sym, cid]) => `<option value="${escAttr(cid)}" ${asset.coinId === cid ? 'selected' : ''}>${escHtml(sym)}</option>`).join('')}<option value="__custom__" ${asset.coinId && !Object.values(COIN_IDS).includes(asset.coinId) ? 'selected' : ''}>직접 입력</option></select><input type="text" id="coinCustomId" class="${asset.coinId && !Object.values(COIN_IDS).includes(asset.coinId) ? '' : 'hidden'}" value="${escAttr(asset.coinId && !Object.values(COIN_IDS).includes(asset.coinId) ? asset.coinId : '')}" placeholder="CoinGecko ID 입력 (예: tether-gold)" maxlength="100" style="margin-top:6px"></div>
    <div class="form-group ${isCash ? '' : 'hidden'}" id="usdtField"><label><input type="checkbox" id="isUsdt" ${asset.isUsdt ? 'checked' : ''}> USDT</label></div>
    <div class="${asset.isUsdt ? '' : 'hidden'}" id="usdtMultiField">
      <label class="form-label">거래소/지갑별 USDT 입력</label>
      <div id="usdtRows">${asset.isUsdt ? _buildUsdtRowsFromDetails(asset.usdtDetails) : _buildUsdtDefaultRows(5)}</div>
      <button type="button" class="btn-sm" data-action="add-usdt-row" style="margin-top:6px">+ 추가 입력</button>
      <div class="usdt-add-total" id="usdtAddTotalBar">합계: <strong id="usdtAddTotal">0</strong> USDT <span class="amount-hint" id="usdtAddTotalHint"></span></div>
    </div>
    <div class="form-group ${asset.isUsdt ? 'hidden' : ''}"><label for="editPrice" id="editPriceLabel">${INVESTMENT_CATS.includes(asset.category) ? '현재 단가' : '금액'}</label><input type="number" inputmode="decimal" id="editPrice" value="${safeNum(asset.amount)}" min="0" step="any"><div class="amount-hint" id="editPriceHint"></div></div>
    <div class="form-group"><label for="editNote">메모</label><input type="text" id="editNote" value="${escAttr(asset.note || '')}" maxlength="500"></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button><button class="btn-p" data-action="do-edit-asset" data-id="${id}">저장</button></div></div></div>`;
  openModal('modalMain');
  updateFormFields(asset.category, stockKind);
  _setupModalMainDelegation(container);
  _setupAmountHints(['editPrice:editPriceHint']);
  _setupUsdtCheckbox();
  _setupCoinCustomId();
}

function doEditAsset(id) {
  const prevAsset = getAsset(id);
  if (prevAsset) tryAutoBackup('major', `자산 수정 직전: ${prevAsset.name}`);
  const activeCatBtn = $$('#modalMain .cat-btn.active')[0];
  const cat = activeCatBtn?.dataset?.cat || '기타';
  const isStock = STOCK_CATS.includes(cat);
  const isUsdtChecked = cat === '현금' && ($('#isUsdt')?.checked || false);
  let newAmount, usdtQty, usdtDetails;
  if (isUsdtChecked) {
    const collected = _collectUsdtRows();
    usdtDetails = collected.details;
    usdtQty = collected.total;
    const rate = getUsdtRateSync().rate;
    newAmount = Math.round(usdtQty * rate);
  } else {
    newAmount = safeNum($('#editPrice')?.value);
  }
  const updates = {
    name: $('#editName')?.value.trim() || '이름 없음',
    category: cat,
    stockCode: isStock ? ($('#assetCode')?.value.trim() || '') : '',
    market: isStock ? ($('#assetMarket')?.value || '') : '',
    coinId: cat === '코인' ? _getCoinIdValue() : '',
    isUsdt: isUsdtChecked,
    usdtQty: isUsdtChecked ? usdtQty : undefined,
    usdtDetails: isUsdtChecked ? usdtDetails : undefined,
    amount: newAmount,
    note: $('#editNote')?.value.trim() || null,
  };
  // Capture USDT pre-change snapshot into asset history
  if (isUsdtChecked && prevAsset && prevAsset.isUsdt) {
    const prevSnap = _buildUsdtHistoryEntry(prevAsset);
    updates.usdtHistory = appendUsdtHistory(prevAsset, prevSnap);
  } else if (prevAsset && Array.isArray(prevAsset.usdtHistory)) {
    updates.usdtHistory = prevAsset.usdtHistory;
  }
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
    ${asset.isUsdt && Array.isArray(asset.usdtHistory) && asset.usdtHistory.length > 0
      ? _renderUsdtHistorySection(asset)
      : ''}
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
              <span>${escHtml(fmtTxnUnitPrice(t))} x ${escHtml(fmtNum(t.qty, t.qty % 1 !== 0 ? 4 : 0))}</span>
              <span class="txn-total">${escHtml(fmtTxnTotal(t))}</span>
            </div>
            ${getTxnCurrency(t) === 'USD' && getTxnFxRate(t) ? `<div class="txn-memo text-muted">적용 환율: ${escHtml(fmtKRW(getTxnFxRate(t)))} / USD</div>` : ''}
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

// ── USDT 변경 이력 섹션 ──
function _renderUsdtHistorySection(asset) {
  const list = asset.usdtHistory || [];
  const items = list.slice().reverse().map((h, revIdx) => {
    const realIdx = list.length - 1 - revIdx;
    const dt = (typeof h.at === 'string' && h.at.length >= 16)
      ? `${h.at.slice(0, 10)} ${h.at.slice(11, 16)}`
      : '시간 미상';
    const details = Array.isArray(h.usdtDetails) ? h.usdtDetails.filter(d => safeNum(d.qty) > 0) : [];
    return `
      <div class="usdt-hist-item" role="listitem">
        <div class="usdt-hist-meta">
          <span class="usdt-hist-date">${escHtml(dt)}</span>
          <span class="usdt-hist-qty">${escHtml(fmtNum(safeNum(h.usdtQty), 2))} USDT</span>
          <span class="usdt-hist-amt">${escHtml(fmtKRW(safeNum(h.amount)))}</span>
        </div>
        ${details.length > 0 ? `
          <ul class="usdt-hist-details">
            ${details.map(d => `<li>${escHtml(d.name || '(미상)')}: ${escHtml(fmtNum(safeNum(d.qty), 2))} USDT</li>`).join('')}
          </ul>
        ` : '<div class="usdt-hist-details-empty">상세 내역 없음</div>'}
        <div class="usdt-hist-actions">
          <button class="btn-sm" data-action="restore-usdt-history" data-id="${asset.id}" data-idx="${realIdx}">이 값으로 되돌리기</button>
          <button class="btn-icon btn-danger" data-action="delete-usdt-history" data-id="${asset.id}" data-idx="${realIdx}" aria-label="이 이력 삭제" title="이력 삭제">✕</button>
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="usdt-hist-section" role="region" aria-label="USDT 변경 이력">
      <h4>변경 이력 (${list.length}건)</h4>
      <div class="usdt-hist-list" role="list">${items}</div>
    </div>
  `;
}

function doRestoreUsdtHistory(assetId, idxStr) {
  const idx = Number(idxStr);
  if (!Number.isInteger(idx) || idx < 0) return;
  const asset = getAsset(assetId);
  if (!asset) return;
  const entry = (asset.usdtHistory || [])[idx];
  if (!entry) { showToast('이력 항목을 찾을 수 없습니다', 'error'); return; }
  const dt = (typeof entry.at === 'string' && entry.at.length >= 16)
    ? `${entry.at.slice(0, 10)} ${entry.at.slice(11, 16)}`
    : '시간 미상';
  openConfirmModal(
    `${dt} 시점 값 (${fmtNum(safeNum(entry.usdtQty), 2)} USDT) 으로 되돌리시겠습니까?\n현재 값은 자동으로 이력에 보관됩니다.`,
    () => {
      tryAutoBackup('major', `USDT 이력 복원 직전: ${asset.name}`);
      if (restoreUsdtHistoryEntry(assetId, idx)) {
        showToast('USDT 이력 복원 완료', 'success');
        openAssetDetail(assetId);
        render();
      }
    }
  );
}

function doDeleteUsdtHistory(assetId, idxStr) {
  const idx = Number(idxStr);
  if (!Number.isInteger(idx) || idx < 0) return;
  openConfirmModal('이 변경 이력을 삭제하시겠습니까?', () => {
    if (deleteUsdtHistoryEntry(assetId, idx)) {
      showToast('이력 삭제됨', 'success');
      openAssetDetail(assetId);
    }
  });
}

// ── Auto Backup Manager ──
function openAutoBackupManager() {
  _modalCleanup.removeAll();
  const container = $('#modalMain');
  const list = loadAutoBackups().slice().reverse();
  const totalBytes = list.reduce((s, b) => s + (b.json ? b.json.length : 0), 0);
  const triggerLabel = (t) => t === 'daily' ? '🗓 일일' : (t === 'major' ? '⚡ 변경' : '🔖 ' + t);

  const items = list.length === 0
    ? '<div class="empty-state">자동 백업이 아직 없습니다. 자산을 추가/수정하거나 다음 날 다시 확인해보세요.</div>'
    : list.map(b => {
        const dt = (typeof b.savedAt === 'string' && b.savedAt.length >= 16)
          ? `${b.savedAt.slice(0, 10)} ${b.savedAt.slice(11, 16)}`
          : '시간 미상';
        return `
          <div class="auto-bk-item" role="listitem">
            <div class="auto-bk-header">
              <span class="auto-bk-trigger">${triggerLabel(b.trigger)}</span>
              <span class="auto-bk-date">${escHtml(dt)}</span>
            </div>
            <div class="auto-bk-label">${escHtml(b.label || '')}</div>
            <div class="auto-bk-meta">
              <span>자산 ${b.assetCount || 0}개</span>
              <span>총액 ${escHtml(fmtKRW(safeNum(b.total)))}</span>
              <span class="auto-bk-size">${((b.json ? b.json.length : 0) / 1024).toFixed(0)}KB</span>
            </div>
            <div class="auto-bk-actions">
              <button class="btn-p btn-sm" data-action="restore-auto-backup" data-id="${escAttr(b.id)}">복원</button>
              <button class="btn-icon btn-danger" data-action="delete-auto-backup" data-id="${escAttr(b.id)}" aria-label="백업 삭제" title="삭제">✕</button>
            </div>
          </div>
        `;
      }).join('');

  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box modal-large">
    <div class="modal-header">
      <h3>🗂 자동 백업 관리</h3>
      <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button>
    </div>
    <div class="modal-body">
      <div class="auto-bk-summary">
        <div>보관 중: <strong>${list.length}/${LIMITS.autoBackup}건</strong></div>
        <div>차지 용량: <strong>${(totalBytes / 1024).toFixed(0)}KB</strong></div>
      </div>
      <div class="auto-bk-toolbar" role="group" aria-label="자동 백업 정리">
        <button class="btn-sm" data-action="compact-auto-backups" data-keep="1" ${list.length <= 1 ? 'disabled' : ''}>최신 1개만 남기기</button>
        <button class="btn-sm btn-danger" data-action="clear-auto-backups" ${list.length === 0 ? 'disabled' : ''}>전체 삭제</button>
      </div>
      <div class="auto-bk-info">
        매일 자동 + 자산 추가/삭제/수정 시 자동 저장됩니다. 저장소가 부족하면 먼저 오래된 자동 백업을 정리하세요.
      </div>
      <div class="auto-bk-list" role="list">${items}</div>
    </div>
  </div>`;
  openModal('modalMain');
  _setupModalMainDelegation(container);
}

function doRestoreAutoBackup(id) {
  const list = loadAutoBackups();
  const entry = list.find(b => b.id === id);
  if (!entry) { showToast('백업을 찾을 수 없습니다', 'error'); return; }
  const dt = (typeof entry.savedAt === 'string' && entry.savedAt.length >= 16)
    ? `${entry.savedAt.slice(0, 10)} ${entry.savedAt.slice(11, 16)}`
    : '시간 미상';
  openConfirmModal(
    `${dt} 시점으로 복원하시겠습니까?\n현재 데이터는 자동 백업에 한 번 더 저장되며, 복원 후에도 다시 되돌릴 수 있습니다.`,
    async () => {
      if (await restoreAutoBackup(id)) {
        showToast('자동 백업 복원 완료', 'success');
        closeModal('modalMain');
        render();
      }
    }
  );
}

function doDeleteAutoBackup(id) {
  openConfirmModal('이 자동 백업을 삭제하시겠습니까?', () => {
    deleteAutoBackup(id);
    showToast('백업 삭제됨', 'success');
    openAutoBackupManager();
    if (currentTab === 'pgHist') renderHistory();
  });
}

function _autoBackupFreedLabel(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${(bytes / 1024).toFixed(0)}KB`;
}

function doCompactAutoBackups(keep = 1) {
  const list = loadAutoBackups();
  if (list.length <= keep) {
    showToast('정리할 오래된 자동 백업이 없습니다', 'info');
    return;
  }
  openConfirmModal(
    `자동 백업을 최신 ${keep}개만 남기고 정리하시겠습니까?\nJSON 백업을 이미 받아두었다면 저장소 용량을 빠르게 줄일 수 있습니다.`,
    () => {
      const result = compactAutoBackups(keep);
      showToast(`자동 백업 ${result.removed}건 정리됨 · 약 ${_autoBackupFreedLabel(result.freedBytes)} 확보`, 'success');
      openAutoBackupManager();
      if (currentTab === 'pgHist') renderHistory();
    }
  );
}

function doClearAutoBackups() {
  const list = loadAutoBackups();
  if (list.length === 0) {
    showToast('삭제할 자동 백업이 없습니다', 'info');
    return;
  }
  const message = '자동 백업 ' + list.length + '건을 모두 삭제하시겠습니까?\nJSON 백업 파일을 따로 보관한 경우에만 진행하세요.';
  openConfirmModal(message, () => {
    const result = clearAutoBackups();
    showToast('자동 백업 전체 삭제됨 · 약 ' + _autoBackupFreedLabel(result.freedBytes) + ' 확보', 'success');
    openAutoBackupManager();
    if (currentTab === 'pgHist') renderHistory();
  });
}

// ── Transaction ──
function openTransaction(assetId, type = 'buy') {
  const asset = getAsset(assetId);
  if (!asset) return;
  const isForeign = asset.category === '해외주식' && !['KOSPI', 'KOSDAQ'].includes(asset.market);
  const isCoin = asset.category === '코인';
  const showCurrency = isForeign || isCoin;
  const defaultCurrency = isForeign ? 'USD' : 'KRW';
  const initialFxRate = getRateDisplayInfo('usdkrw')?.rate || '';
  const formGeneration = ++_transactionFormGeneration;
  const container = $('#modalSub');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>${escHtml(asset.name)} — ${type === 'buy' ? '매수' : '매도'}</h3><button class="modal-close" data-action="close-sub-modal" aria-label="닫기">✕</button></div><div class="modal-body"><input type="hidden" id="transactionFormGeneration" value="${formGeneration}">
    ${showCurrency ? `<div class="form-group"><label>통화</label><div class="btn-group" role="radiogroup" aria-label="통화 선택"><button class="btn-sm ${defaultCurrency === 'KRW' ? 'active' : ''}" data-action="set-tx-currency" data-currency="KRW" role="radio" aria-checked="${defaultCurrency === 'KRW'}">KRW (원)</button><button class="btn-sm ${defaultCurrency === 'USD' ? 'active' : ''}" data-action="set-tx-currency" data-currency="USD" role="radio" aria-checked="${defaultCurrency === 'USD'}">USD ($)</button></div><input type="hidden" id="txCurrency" value="${defaultCurrency}"></div>` : ''}
    ${showCurrency ? `<div class="form-group ${defaultCurrency === 'USD' ? '' : 'hidden'}" id="txFxRateField"><label for="txFxRate">적용 환율 (1달러당 원화) *</label><input type="number" inputmode="decimal" id="txFxRate" value="${initialFxRate}" min="1" step="any"><div class="hint-text">자동 환율을 확인하고, 과거 거래라면 당시 환율로 수정하세요.</div></div>` : ''}
    <div class="form-row"><div class="form-group"><label for="txnPrice">단가 ${showCurrency ? `(<span id="txCurrLabel">${defaultCurrency}</span>)` : ''}</label><input type="number" inputmode="decimal" id="txnPrice" placeholder="0" min="0" step="any"><div class="amount-hint" id="txnPriceHint"></div></div><div class="form-group"><label for="txnQty">수량</label><input type="number" inputmode="decimal" id="txnQty" placeholder="0" min="0" step="any"></div></div>
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
    if (!el) return;
    const currency = $('#txCurrency')?.value;
    if (currency === 'USD') {
      const rate = safeNum($('#txFxRate')?.value);
      el.textContent = `${fmtUSD(p * q)}${rate ? ` (≈ ${fmtKRW(p * q * rate)})` : ''}`;
    } else {
      el.textContent = fmtKRW(p * q);
    }
  };
  const txnPriceEl = $('#txnPrice'), txnQtyEl = $('#txnQty'), txFxRateEl = $('#txFxRate');
  if (txnPriceEl) _modalCleanup.add(txnPriceEl, 'input', calcTxTotal);
  if (txnQtyEl) _modalCleanup.add(txnQtyEl, 'input', calcTxTotal);
  if (txFxRateEl) _modalCleanup.add(txFxRateEl, 'input', calcTxTotal);
  _setupAmountHints(['txnPrice:txnPriceHint']);
  if (defaultCurrency === 'USD' && txnPriceEl) txnPriceEl.dispatchEvent(new Event('input'));
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
  const fxField = $('#txFxRateField');
  if (fxField) fxField.classList.toggle('hidden', currency !== 'USD');
  // refresh amount hint
  const txnPriceEl = $('#txnPrice');
  if (txnPriceEl) txnPriceEl.dispatchEvent(new Event('input'));
}

async function doTransaction(assetId, type) {
  const formGeneration = $('#transactionFormGeneration')?.value;
  let price = safeNum($('#txnPrice')?.value);
  const originalPrice = price;
  const qty = safeNum($('#txnQty')?.value);
  if (!price || !qty) { showToast('단가와 수량을 입력하세요', 'error'); return; }
  const submitBtn = $('#modalSub [data-action="do-transaction"]');
  if (submitBtn?.disabled) return;
  const submitLabel = type === 'buy' ? '매수' : '매도';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '처리 중…'; }
  const restoreSubmit = () => {
    if (submitBtn && document.contains(submitBtn)) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  };
  const currency = $('#txCurrency')?.value === 'USD' ? 'USD' : 'KRW';
  let fxRate = currency === 'USD' ? safeNum($('#txFxRate')?.value) : null;
  if (currency === 'USD') {
    try {
      if (!(fxRate > 0)) fxRate = await fetchReliableExchangeRate();
      if ($('#transactionFormGeneration')?.value !== formGeneration) return;
      const modal = $('#modalSub');
      if (!modal?.classList.contains('active') || modal.getAttribute('aria-hidden') === 'true') return;
      if (!(fxRate > 0)) {
        showToast('신뢰할 수 있는 환율이 없습니다. 적용 환율을 직접 입력해주세요.', 'error');
        $('#txFxRate')?.focus();
        restoreSubmit();
        return;
      }
      const rateInput = $('#txFxRate');
      if (rateInput) rateInput.value = fxRate;
      price = Math.round(originalPrice * fxRate);
    } catch (e) {
      console.warn('doTransaction: exchange rate fetch failed', e);
      showToast('환율 조회 실패', 'error');
      restoreSubmit();
      return;
    }
  }
  const asset = getAsset(assetId);
  if (!asset) { restoreSubmit(); return; }
  if (type === 'sell') {
    const v = calcAssetValue(asset);
    if (qty > v.qty) { showToast(`보유 수량(${fmtNum(v.qty, 2)})을 초과합니다`, 'error'); restoreSubmit(); return; }
  }
  const success = addTransactionWithPrice(assetId, {
    type, price, qty, currency,
    originalPrice: currency === 'USD' ? originalPrice : price,
    fxRate,
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
  } else {
    restoreSubmit();
  }
}

function doDeleteTxn(assetId, txnId) {
  openConfirmModal('이 거래를 삭제하시겠습니까?', () => {
    const undo = deleteTransaction(assetId, txnId);
    openAssetDetail(assetId);
    if (undo) showUndoToast('거래 삭제됨', () => { undo(); openAssetDetail(assetId); });
    else showToast('거래 삭제됨');
  });
}

// ── Edit Transaction ──
function openEditTransaction(assetId, txnId) {
  const asset = getAsset(assetId);
  if (!asset) return;
  const txn = asset.txns.find(t => t.id === txnId);
  if (!txn) return;
  const isUsd = getTxnCurrency(txn) === 'USD';
  const displayPrice = isUsd ? getTxnOriginalPrice(txn) : safeNum(txn.price);
  const savedFxRate = getTxnFxRate(txn);
  const formGeneration = ++_transactionFormGeneration;
  const container = $('#modalSub');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>거래 수정</h3><button class="modal-close" data-action="close-sub-modal" aria-label="닫기">✕</button></div><div class="modal-body"><input type="hidden" id="transactionFormGeneration" value="${formGeneration}">
    <div class="form-group"><label>유형</label><div class="btn-group" role="radiogroup" aria-label="거래 유형"><button type="button" class="btn-sm ${txn.type === 'buy' ? 'active' : ''}" data-action="set-edit-txn-type" data-type="buy" role="radio" aria-checked="${txn.type === 'buy'}">매수</button><button type="button" class="btn-sm ${txn.type === 'sell' ? 'active' : ''}" data-action="set-edit-txn-type" data-type="sell" role="radio" aria-checked="${txn.type === 'sell'}">매도</button></div><input type="hidden" id="editTxnType" value="${txn.type}"></div>
    <div class="form-row"><div class="form-group"><label for="editTxnPrice">단가${isUsd ? ' (USD)' : ''}</label><input type="number" inputmode="decimal" id="editTxnPrice" value="${displayPrice}" min="0" step="any"><div class="amount-hint" id="editTxnPriceHint"></div></div><div class="form-group"><label for="editTxnQty">수량</label><input type="number" inputmode="decimal" id="editTxnQty" value="${safeNum(txn.qty)}" min="0" step="any"></div></div>
    <div class="tx-total" aria-live="polite">총액: <span id="editTxnTotal">${escHtml(fmtTxnTotal(txn))}</span></div>
    ${isUsd ? `<div class="form-group"><label for="editTxnFxRate">적용 환율 (1달러당 원화) *</label><input type="number" inputmode="decimal" id="editTxnFxRate" value="${savedFxRate || ''}" min="1" step="any"><div class="hint-text">저장된 환율입니다. 잘못된 경우 직접 수정할 수 있습니다.</div></div>` : ''}
    <input type="hidden" id="editTxnCurrency" value="${isUsd ? 'USD' : 'KRW'}">
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
    const currentFxRate = safeNum($('#editTxnFxRate')?.value);
    const el = $('#editTxnTotal');
    if (el) el.textContent = isUsd
      ? `${fmtUSD(p * q)}${currentFxRate ? ` (${fmtKRW(p * q * currentFxRate)})` : ''}`
      : fmtKRW(p * q);
  };
  const priceEl = $('#editTxnPrice'), qtyEl = $('#editTxnQty'), rateEl = $('#editTxnFxRate');
  if (priceEl) _modalCleanup.add(priceEl, 'input', calcTotal);
  if (qtyEl) _modalCleanup.add(qtyEl, 'input', calcTotal);
  if (rateEl) _modalCleanup.add(rateEl, 'input', calcTotal);
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

async function doEditTxn(assetId, txnId) {
  const formGeneration = $('#transactionFormGeneration')?.value;
  const asset = getAsset(assetId);
  const existing = asset?.txns?.find(t => t.id === txnId);
  if (!existing) return;
  const originalPrice = safeNum($('#editTxnPrice')?.value);
  const qty = safeNum($('#editTxnQty')?.value);
  if (!originalPrice || !qty) { showToast('단가와 수량을 입력하세요', 'error'); return; }
  const submitBtn = $('#modalSub [data-action="do-edit-txn"]');
  if (submitBtn?.disabled) return;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '저장 중…'; }
  const restoreSubmit = () => {
    if (submitBtn && document.contains(submitBtn)) {
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  };
  const currency = getTxnCurrency(existing);
  let fxRate = currency === 'USD' ? safeNum($('#editTxnFxRate')?.value) : null;
  if (currency === 'USD' && !(fxRate > 0)) fxRate = await fetchReliableExchangeRate();
  if ($('#transactionFormGeneration')?.value !== formGeneration) return;
  const modal = $('#modalSub');
  if (!modal?.classList.contains('active') || modal.getAttribute('aria-hidden') === 'true') return;
  if (currency === 'USD' && !(fxRate > 0)) {
    showToast('신뢰할 수 있는 환율이 없습니다. 적용 환율을 직접 입력해주세요.', 'error');
    $('#editTxnFxRate')?.focus();
    restoreSubmit();
    return;
  }
  const price = currency === 'USD' ? Math.round(originalPrice * fxRate) : originalPrice;
  const ok = updateTransaction(assetId, txnId, {
    type: $('#editTxnType')?.value || 'buy',
    price, qty, currency, originalPrice, fxRate,
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
  } else {
    restoreSubmit();
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
  const switched = await switchPortfolio(pid);
  if (!switched) return;
  await closeAllModals();
  render();
  showToast('포트폴리오 변경됨', 'success');
}

async function doCreatePortfolio() {
  const name = $('#newPfName')?.value.trim();
  if (!name) { showToast('이름을 입력하세요', 'error'); return; }
  const id = await createPortfolio(name);
  if (id) {
    UIState.reset();
    const switched = await switchPortfolio(id);
    if (!switched) return;
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
  openConfirmModal(`"${name}" 포트폴리오를 삭제하시겠습니까?`, () => {
    openConfirmModal(
      `정말로 삭제하시겠습니까?\n"${name}" 안의 모든 자산 데이터가 영구 삭제되며 복구할 수 없습니다.`,
      async () => {
        await deletePortfolio(pid);
        await loadData();
        await closeAllModals();
        render();
        showToast('포트폴리오 삭제됨');
      }
    );
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
    `<div class="usdt-add-row"><input type="text" class="usdt-loc-input" placeholder="거래소/지갑명" maxlength="50"><input type="number" inputmode="decimal" class="usdt-qty-input" placeholder="USDT" min="0" step="any"><button type="button" class="btn-icon btn-danger usdt-row-del" data-action="remove-usdt-row" aria-label="삭제">✕</button></div>`
  ).join('');
}

function _buildUsdtRowsFromDetails(details) {
  if (!Array.isArray(details) || details.length === 0) return _buildUsdtDefaultRows(5);
  return details.map(d =>
    `<div class="usdt-add-row"><input type="text" class="usdt-loc-input" value="${escAttr(d.name)}" placeholder="거래소/지갑명" maxlength="50"><input type="number" inputmode="decimal" class="usdt-qty-input" value="${d.qty || ''}" placeholder="USDT" min="0" step="any"><button type="button" class="btn-icon btn-danger usdt-row-del" data-action="remove-usdt-row" aria-label="삭제">✕</button></div>`
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

let _usdtFormInitialTotal = 0;

function _recalcUsdtAddTotal() {
  const { total } = _collectUsdtRows();
  const el = $('#usdtAddTotal');
  const hint = $('#usdtAddTotalHint');
  if (!el || !hint) return;

  const info = getUsdtRateSync();
  const totalKrw = Math.round(total * info.rate);
  const initial = _usdtFormInitialTotal;
  const initialKrw = Math.round(initial * info.rate);
  const delta = total - initial;
  const deltaKrw = totalKrw - initialKrw;
  const hasInitial = initial > 0;
  const changed = hasInitial && Math.abs(delta) >= 0.000001;
  const srcHtml = `<span class="rate-src ${info.fallback ? 'rate-src-warn' : ''}">${escHtml(describeRateSource(info))}</span>`;

  if (changed && total > 0) {
    const sign = delta > 0 ? '+' : '';
    const cls = delta > 0 ? 'pos' : 'neg';
    const krwSign = deltaKrw > 0 ? '+' : '';
    el.innerHTML = `<span class="usdt-prev">${fmtNum(initial, 2)}</span> → ${fmtNum(total, 2)} <span class="usdt-delta ${cls}">(${sign}${fmtNum(delta, 2)})</span>`;
    hint.innerHTML = `≈ ${escHtml(fmtKRW(totalKrw))} <span class="usdt-delta ${cls}">(${krwSign}${escHtml(fmtKRW(deltaKrw))})</span> ${srcHtml}`;
  } else if (hasInitial && total === 0) {
    el.innerHTML = `<span class="usdt-prev">${fmtNum(initial, 2)}</span> → 0`;
    hint.innerHTML = `<span class="usdt-delta neg">(전부 제거)</span> ${srcHtml}`;
  } else {
    el.textContent = fmtNum(total, 2);
    hint.innerHTML = total > 0 ? `≈ ${escHtml(fmtKRW(totalKrw))} ${srcHtml}` : '';
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
        const rate = getUsdtRateSync().rate;
        const val = safeNum(input.value);
        hint.textContent = val > 0 ? `≈ ${fmtKRW(Math.round(val * rate))}` : '';
      } else {
        const addCurr = $('#addTxCurrency')?.value;
        const txCurr = $('#txCurrency')?.value;
        const editCurr = $('#editTxnCurrency')?.value;
        const isUsd = (inputId === 'txPrice' && addCurr === 'USD')
          || (inputId === 'txnPrice' && txCurr === 'USD')
          || (inputId === 'editTxnPrice' && editCurr === 'USD');
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
      const rate = safeNum($('#addTxFxRate')?.value);
      el.textContent = `${fmtUSD(p * q)}${rate ? ` (≈ ${fmtKRW(p * q * rate)})` : ''}`;
    } else {
      el.textContent = fmtKRW(p * q);
    }
  };
  const priceEl = $('#txPrice'), qtyEl = $('#txQty'), rateEl = $('#addTxFxRate');
  if (priceEl) _modalCleanup.add(priceEl, 'input', calc);
  if (qtyEl) _modalCleanup.add(qtyEl, 'input', calc);
  if (rateEl) _modalCleanup.add(rateEl, 'input', calc);
}

function _setAddTxCurrency(btn, currency) {
  _setAddTxCurrencyValue(currency);
  // refresh amount hint and total
  const txPriceEl = $('#txPrice');
  if (txPriceEl) txPriceEl.dispatchEvent(new Event('input'));
}

function _setAddTxCurrencyValue(currency) {
  $('#addCurrencyField')?.querySelectorAll('[role="radio"]').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-checked', 'false');
    if (b.dataset.currency === currency) {
      b.classList.add('active');
      b.setAttribute('aria-checked', 'true');
    }
  });
  const input = $('#addTxCurrency');
  if (input) input.value = currency;
  const label = $('#addTxPriceLabel');
  if (label) label.textContent = currency === 'USD' ? '단가 (USD)' : '단가';
  const fxField = $('#addFxRateField');
  if (fxField) fxField.classList.toggle('hidden', currency !== 'USD');
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
      <input type="number" inputmode="decimal" class="usdt-qty-input" value="${qty || ''}" placeholder="0" min="0" step="any">
      <span class="usdt-unit">USDT</span>
    </div>
  </div>`;
}

function _usdtRecalcTotal() {
  const rate = getUsdtRateSync().rate;
  let total = 0;
  for (const section of $$('#modalMain .usdt-section')) {
    let secTotal = 0;
    for (const input of section.querySelectorAll('.usdt-qty-input')) {
      secTotal += safeNum(input.value);
    }
    const sub = section.querySelector('.usdt-subtotal');
    if (sub) sub.textContent = `${fmtNum(secTotal, 2)} USDT`;
    total += secTotal;
  }

  const initial = _usdtInitialTotal;
  const delta = total - initial;
  const initialKrw = Math.round(initial * rate);
  const totalKrw = Math.round(total * rate);
  const deltaKrw = totalKrw - initialKrw;
  const changed = Math.abs(delta) >= 0.000001;

  const usdtRow = $('#usdtTotalRow');
  const krwRow = $('#usdtTotalKrwRow');

  if (usdtRow) {
    if (!changed) {
      usdtRow.innerHTML = `<strong>${fmtNum(total, 2)}</strong> USDT`;
    } else {
      const sign = delta > 0 ? '+' : '';
      const cls = delta > 0 ? 'pos' : 'neg';
      usdtRow.innerHTML = `<span class="usdt-prev">${fmtNum(initial, 2)}</span> → <strong>${fmtNum(total, 2)}</strong> USDT <span class="usdt-delta ${cls}">(${sign}${fmtNum(delta, 2)})</span>`;
    }
  }

  if (krwRow) {
    if (!changed) {
      krwRow.textContent = fmtKRW(totalKrw);
    } else {
      const sign = deltaKrw > 0 ? '+' : '';
      const cls = deltaKrw > 0 ? 'pos' : 'neg';
      krwRow.innerHTML = `<span class="usdt-prev">${escHtml(fmtKRW(initialKrw))}</span> → <strong>${escHtml(fmtKRW(totalKrw))}</strong> <span class="usdt-delta ${cls}">(${sign}${escHtml(fmtKRW(deltaKrw))})</span>`;
    }
  }
}

let _usdtInitialTotal = 0;

function openUsdtManager() {
  _modalCleanup.removeAll();
  const existingMap = _getExistingUsdtMap();
  const rateInfo = getUsdtRateSync();
  const rate = rateInfo.rate;

  _usdtInitialTotal = 0;
  for (const key of Object.keys(USDT_LOCATIONS)) {
    for (const item of USDT_LOCATIONS[key].items) {
      _usdtInitialTotal += safeNum(existingMap[item]?.usdtQty);
    }
  }

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
    <div class="usdt-rate-bar ${rateInfo.fallback ? 'usdt-rate-fallback' : ''}">현재 USDT 환율: <strong>${escHtml(fmtNum(rate, 0))}원</strong><span class="usdt-rate-src">${escHtml(describeRateSource(rateInfo))}</span></div>
    ${buildSection('overseas')}
    ${buildSection('wallet')}
    ${buildSection('domestic')}
    <div class="usdt-summary">
      <div class="usdt-summary-row"><span>합계</span><span class="usdt-summary-val" id="usdtTotalRow"></span></div>
      <div class="usdt-summary-row"><span>원화 환산</span><span class="usdt-summary-val" id="usdtTotalKrwRow"></span></div>
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
  const rate = getUsdtRateSync().rate;
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
