/* =============================================
   My Portfolio v4.1.0 — Modals UI
   Planner-Creator-Evaluator Cycle 2
   Centered modals with scale animation
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
  if (coinF) coinF.classList.toggle('hidden', !isCoin);
  if (usdtF) usdtF.classList.toggle('hidden', !isCash);
  if (txnSection) txnSection.classList.toggle('hidden', !isInvestment);
  if (valueField) valueField.classList.toggle('hidden', isInvestment);
  if (priceLabel) priceLabel.textContent = isInvestment ? '현재 단가' : '금액';
  if (nameInput) nameInput.placeholder = NAME_PLACEHOLDER[cat] || '자산명';
}

// ── Add Asset ──
function openAddAsset() {
  _modalCleanup.removeAll();
  const container = $('#modalMain');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>자산 추가</h3><button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div><div class="modal-body">
    <div class="form-group"><label id="catSelectLabel">카테고리</label>${renderCategorySelector('국내주식', 'catSelect')}</div>
    <div class="form-group"><label for="assetName">자산명 *</label><input type="text" id="assetName" placeholder="예: 삼성전자, SK하이닉스" maxlength="100" required></div>
    <div class="form-row" id="stockFields"><div class="form-group"><label for="assetCode">종목코드</label><input type="text" id="assetCode" placeholder="예: 005930" maxlength="20"></div><div class="form-group"><label for="assetMarket">시장</label><select id="assetMarket"><option value="KOSPI">KOSPI</option><option value="KOSDAQ">KOSDAQ</option><option value="NYSE">NYSE</option><option value="NASDAQ">NASDAQ</option><option value="">기타</option></select></div></div>
    <div class="form-group hidden" id="coinField"><label for="coinSelect">코인 ID (CoinGecko)</label><select id="coinSelect"><option value="">선택하세요</option>${Object.entries(COIN_IDS).map(([sym, id]) => `<option value="${escAttr(id)}">${escHtml(sym)} (${escHtml(id)})</option>`).join('')}</select></div>
    <div class="form-group hidden" id="usdtField"><label><input type="checkbox" id="isUsdt"> USDT (자동 환율 업데이트)</label></div>
    <div class="form-group"><label for="assetNote">메모</label><input type="text" id="assetNote" placeholder="선택사항" maxlength="500"></div>
    <div class="form-group hidden" id="valueField"><label for="assetValue">금액</label><input type="number" id="assetValue" placeholder="예: 1000000" min="0" step="any"><div class="amount-hint" id="valueHint"></div></div>
    <div id="txnSection"><hr><h4>첫 거래 입력</h4>
    <div class="form-row"><div class="form-group"><label for="txPrice">단가</label><input type="number" id="txPrice" placeholder="0" min="0" step="any"><div class="amount-hint" id="txPriceHint"></div></div><div class="form-group"><label for="txQty">수량</label><input type="number" id="txQty" placeholder="0" min="0" step="any"></div></div>
    <div class="tx-total" aria-live="polite">총 투자금: <span id="addTxTotal">₩0</span></div>
    <div class="form-row"><div class="form-group"><label for="txDate">날짜</label><input type="date" id="txDate" value="${today()}"></div><div class="form-group"><label for="txAccount">계좌</label><input type="text" id="txAccount" placeholder="선택사항" maxlength="50"></div></div></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button><button class="btn-p" data-action="do-add-asset">추가</button></div></div></div>`;
  openModal('modalMain');
  updateFormFields('국내주식');
  _setupModalMainDelegation(container);
  _setupAmountHints(['assetValue:valueHint', 'txPrice:txPriceHint']);
  _setupAddTxTotal();
}

function doAddAsset() {
  const name = $('#assetName')?.value.trim();
  if (!name) { showToast('자산명을 입력하세요', 'error'); return; }
  const cat = $('.modal.active .cat-btn.active')?.dataset?.cat || '기타';
  const isInvestment = INVESTMENT_CATS.includes(cat);
  let amount, txns;
  if (isInvestment) {
    const price = safeNum($('#txPrice')?.value), qty = safeNum($('#txQty')?.value);
    amount = price;
    txns = price > 0 && qty > 0 ? [{
      type: 'buy', price, qty,
      date: $('#txDate')?.value || today(),
      account: $('#txAccount')?.value.trim() || null, memo: null,
    }] : [];
  } else {
    const val = safeNum($('#assetValue')?.value);
    amount = val;
    txns = val > 0 ? [{ type: 'buy', price: val, qty: 1, date: today(), account: null, memo: null }] : [];
  }
  const asset = addAsset({
    name, category: cat, amount,
    stockCode: isInvestment ? ($('#assetCode')?.value.trim() || '') : '',
    market: isInvestment ? ($('#assetMarket')?.value || '') : '',
    coinId: cat === '코인' ? ($('#coinSelect')?.value || '') : '',
    isUsdt: cat === '현금' ? ($('#isUsdt')?.checked || false) : false,
    note: $('#assetNote')?.value.trim() || null,
    krxEtf: ETF_PREFIXES.some(p => name.toUpperCase().startsWith(p)),
    txns,
  });
  if (asset) {
    closeModal('modalMain');
    showToast(`"${name}" 추가됨`, 'success');
    render();
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
    <div class="form-group ${isCoin ? '' : 'hidden'}" id="coinField"><label for="coinSelect">코인 ID</label><select id="coinSelect"><option value="">선택하세요</option>${Object.entries(COIN_IDS).map(([sym, cid]) => `<option value="${escAttr(cid)}" ${asset.coinId === cid ? 'selected' : ''}>${escHtml(sym)}</option>`).join('')}</select></div>
    <div class="form-group ${isCash ? '' : 'hidden'}" id="usdtField"><label><input type="checkbox" id="isUsdt" ${asset.isUsdt ? 'checked' : ''}> USDT</label></div>
    <div class="form-group"><label for="editPrice" id="editPriceLabel">${INVESTMENT_CATS.includes(asset.category) ? '현재 단가' : '금액'}</label><input type="number" id="editPrice" value="${safeNum(asset.amount)}" min="0" step="any"><div class="amount-hint" id="editPriceHint"></div></div>
    <div class="form-group"><label for="editNote">메모</label><input type="text" id="editNote" value="${escAttr(asset.note || '')}" maxlength="500"></div>
    <div class="modal-actions"><button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button><button class="btn-p" data-action="do-edit-asset" data-id="${id}">저장</button></div></div></div>`;
  openModal('modalMain');
  _setupModalMainDelegation(container);
  _setupAmountHints(['editPrice:editPriceHint']);
}

function doEditAsset(id) {
  const cat = $$('#modalMain .cat-btn.active')[0]?.dataset?.cat || '기타';
  const newAmount = safeNum($('#editPrice')?.value);
  const updates = {
    name: $('#editName')?.value.trim() || '이름 없음',
    category: cat,
    stockCode: $('#assetCode')?.value.trim() || '',
    market: $('#assetMarket')?.value || '',
    coinId: $('#coinSelect')?.value || '',
    isUsdt: $('#isUsdt')?.checked || false,
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
            <button class="btn-icon btn-danger txn-del" aria-label="거래 삭제"
              data-action="delete-txn" data-asset-id="${id}" data-txn-id="${t.id}">✕</button>
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
  const container = $('#modalSub');
  container.innerHTML = `<div class="modal-backdrop"></div><div class="modal-box"><div class="modal-header"><h3>${escHtml(asset.name)} — ${type === 'buy' ? '매수' : '매도'}</h3><button class="modal-close" data-action="close-sub-modal" aria-label="닫기">✕</button></div><div class="modal-body">
    ${isForeign ? `<div class="form-group"><label>통화</label><div class="btn-group" role="radiogroup" aria-label="통화 선택"><button class="btn-sm active" data-action="set-tx-currency" data-currency="KRW" role="radio" aria-checked="true">KRW</button><button class="btn-sm" data-action="set-tx-currency" data-currency="USD" role="radio" aria-checked="false">USD</button></div><input type="hidden" id="txCurrency" value="KRW"></div>` : ''}
    <div class="form-row"><div class="form-group"><label for="txnPrice">단가 ${isForeign ? '(<span id="txCurrLabel">KRW</span>)' : ''}</label><input type="number" id="txnPrice" placeholder="0" min="0" step="any"><div class="amount-hint" id="txnPriceHint"></div></div><div class="form-group"><label for="txnQty">수량</label><input type="number" id="txnQty" placeholder="0" min="0" step="any"></div></div>
    <div class="tx-total" aria-live="polite">총액: <span id="txnTotal">₩0</span></div>
    <div class="form-row"><div class="form-group"><label for="txnDate">날짜</label><input type="date" id="txnDate" value="${today()}"></div><div class="form-group"><label for="txnAccount">계좌</label><input type="text" id="txnAccount" placeholder="선택사항" maxlength="50"></div></div>
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
function _setupAmountHints(pairs) {
  for (const pair of pairs) {
    const [inputId, hintId] = pair.split(':');
    const input = $(`#${inputId}`);
    const hint = $(`#${hintId}`);
    if (!input || !hint) continue;
    const update = () => { hint.textContent = fmtAmountHint(input.value); };
    _modalCleanup.add(input, 'input', update);
    update();
  }
}

function _setupAddTxTotal() {
  const calc = () => {
    const p = safeNum($('#txPrice')?.value), q = safeNum($('#txQty')?.value);
    const el = $('#addTxTotal');
    if (el) el.textContent = fmtKRW(p * q);
  };
  const priceEl = $('#txPrice'), qtyEl = $('#txQty');
  if (priceEl) _modalCleanup.add(priceEl, 'input', calc);
  if (qtyEl) _modalCleanup.add(qtyEl, 'input', calc);
}
