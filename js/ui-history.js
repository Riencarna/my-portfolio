/* =============================================
   My Portfolio v5.25.2 — History & Export UI
   Cycle B: history tabs (records/txns), txn search/filter/sort
   Soft Neutral palette, PDF 라벤더 강조
   ============================================= */

function renderHistory() {
  const container = $('#pgHist');
  if (!container) return;

  const usage = getStorageUsage();
  const usagePct = ((usage / LIMITS.storage) * 100).toFixed(1);
  const usageNum = Math.min(Number(usagePct), 100);
  const usageBarClass = usageNum > 80 ? 'progress-fill-danger' : 'progress-fill';

  container.innerHTML = `
    <div class="card stagger-item" style="--i:0" role="region" aria-label="데이터 관리">
      <div class="card-title">데이터 관리</div>
      <div class="storage-info">
        <div class="progress-bar" role="progressbar" aria-valuenow="${usagePct}" aria-valuemin="0" aria-valuemax="100"
          aria-label="저장소 사용량 ${usagePct}%">
          <div class="${usageBarClass}" style="width:${usageNum}%"></div>
        </div>
        <span>저장소: ${(usage / 1024).toFixed(0)}KB / ${(LIMITS.storage / 1024 / 1024).toFixed(0)}MB (${usagePct}%)</span>
      </div>
      <div class="action-grid" role="group" aria-label="데이터 관리 버튼">
        <button class="btn-action" data-action="backup-json" aria-label="JSON 백업 다운로드">
          <span class="btn-action-icon" aria-hidden="true">💾</span><span>JSON 백업</span>
        </button>
        <button class="btn-action" data-action="restore-json" aria-label="백업 파일 복원">
          <span class="btn-action-icon" aria-hidden="true">📂</span><span>백업 복원</span>
        </button>
        <button class="btn-action" data-action="open-auto-backup-manager" aria-label="자동 백업 관리">
          <span class="btn-action-icon" aria-hidden="true">🗂</span><span>자동 백업</span>
        </button>
        <button class="btn-action" data-action="export-csv" data-type="assets" aria-label="자산 CSV 내보내기">
          <span class="btn-action-icon" aria-hidden="true">📊</span><span>자산 CSV</span>
        </button>
        <button class="btn-action" data-action="export-csv" data-type="txns" aria-label="거래 CSV 내보내기">
          <span class="btn-action-icon" aria-hidden="true">📋</span><span>거래 CSV</span>
        </button>
        <button class="btn-action" data-action="import-csv" aria-label="거래 CSV 가져오기">
          <span class="btn-action-icon" aria-hidden="true">📥</span><span>거래 CSV 가져오기</span>
        </button>
        <button class="btn-action" data-action="export-pdf" aria-label="PDF 리포트 생성">
          <span class="btn-action-icon" aria-hidden="true">📄</span><span>PDF 리포트</span>
        </button>
        <button class="btn-action btn-action-danger" data-action="reset-all" aria-label="전체 데이터 초기화">
          <span class="btn-action-icon" aria-hidden="true">🗑</span><span>전체 초기화</span>
        </button>
      </div>
    </div>

    <div class="hist-tabs" role="tablist" aria-label="기록 탭">
      <button class="hist-tab ${UIState.historyTab === 'records' ? 'active' : ''}" role="tab"
        aria-selected="${UIState.historyTab === 'records' ? 'true' : 'false'}"
        data-action="set-hist-tab" data-tab="records">📈 자산 기록</button>
      <button class="hist-tab ${UIState.historyTab === 'txns' ? 'active' : ''}" role="tab"
        aria-selected="${UIState.historyTab === 'txns' ? 'true' : 'false'}"
        data-action="set-hist-tab" data-tab="txns">🧾 거래 내역</button>
    </div>

    <div class="hist-tab-content" role="tabpanel">
      ${UIState.historyTab === 'records' ? _renderRecordsTab() : _renderTxnsTab()}
    </div>
  `;

  if (UIState.historyTab === 'records') {
    runWhenIdle(() => renderGrowthChart(0, false));
  }

  _setupHistoryDelegation(container);
}

function _renderRecordsTab() {
  return `
    <div class="card stagger-item" style="--i:1" role="region" aria-label="자산 기록">
      <div class="card-title">
        자산 기록
        <div class="btn-group" role="group" aria-label="기록 기간 필터">
          ${[7, 30, 90, 0].map(d => `
            <button class="btn-sm ${UIState.historyFilter === d ? 'active' : ''}"
              data-action="history-filter" data-days="${d}" aria-pressed="${UIState.historyFilter === d}">${d === 0 ? '전체' : '최근 ' + d + '일'}</button>
          `).join('')}
        </div>
      </div>
      ${renderHistoryList()}
    </div>

    <div class="card stagger-item" style="--i:2" role="region" aria-label="자산 성장 그래프">
      <div class="card-title">자산 성장 그래프</div>
      <div class="btn-group btn-group-mb" role="group" aria-label="성장 그래프 필터">
        <button class="btn-sm active" data-action="growth-view" data-days="0" data-by-cat="false" aria-pressed="true">전체</button>
        <button class="btn-sm" data-action="growth-view" data-days="90" data-by-cat="false" aria-pressed="false">90일</button>
        <button class="btn-sm" data-action="growth-view" data-days="0" data-by-cat="true" aria-pressed="false">카테고리별</button>
      </div>
      <div class="chart-wrap chart-wrap-220" role="img" aria-label="자산 성장 차트">
        <canvas id="chartGrowth"></canvas>
      </div>
      <div id="chartGrowthAlt"></div>
    </div>
  `;
}

function _renderTxnsTab() {
  const totalCount = _getAllTxns().length;
  return `
    <div class="card stagger-item" style="--i:1" role="region" aria-label="거래 내역">
      <div class="card-title"><span id="txnListTitle">거래 내역 (${totalCount}건)</span></div>
      <div class="txn-filters">
        <input type="search" id="txnSearchInput" class="txn-search-input"
          value="${escAttr(UIState.txnSearch)}" placeholder="자산명·계좌·메모 검색"
          aria-label="거래 검색" maxlength="100">
        <div class="btn-group txn-period-group" role="group" aria-label="기간 필터">
          ${[0, 7, 30, 90, 365].map(d => `
            <button class="btn-sm ${UIState.txnFilterPeriod === d ? 'active' : ''}"
              data-action="txn-filter-period" data-days="${d}" aria-pressed="${UIState.txnFilterPeriod === d}">${d === 0 ? '전체' : d === 365 ? '1년' : d + '일'}</button>
          `).join('')}
        </div>
        <div class="txn-filter-row">
          <select id="txnFilterType" aria-label="거래 유형 필터">
            <option value="all" ${UIState.txnFilterType === 'all' ? 'selected' : ''}>유형: 전체</option>
            <option value="buy" ${UIState.txnFilterType === 'buy' ? 'selected' : ''}>유형: 매수</option>
            <option value="sell" ${UIState.txnFilterType === 'sell' ? 'selected' : ''}>유형: 매도</option>
          </select>
          <select id="txnFilterCat" aria-label="카테고리 필터">
            <option value="all" ${UIState.txnFilterCat === 'all' ? 'selected' : ''}>카테고리: 전체</option>
            ${CATEGORIES.map(c => `<option value="${escAttr(c.id)}" ${UIState.txnFilterCat === c.id ? 'selected' : ''}>${c.icon} ${escHtml(c.label)}</option>`).join('')}
          </select>
          <select id="txnSortSelect" aria-label="정렬">
            <option value="date-desc" ${UIState.txnSort === 'date-desc' ? 'selected' : ''}>정렬: 날짜 ↓</option>
            <option value="date-asc" ${UIState.txnSort === 'date-asc' ? 'selected' : ''}>정렬: 날짜 ↑</option>
            <option value="amount-desc" ${UIState.txnSort === 'amount-desc' ? 'selected' : ''}>정렬: 금액 ↓</option>
            <option value="amount-asc" ${UIState.txnSort === 'amount-asc' ? 'selected' : ''}>정렬: 금액 ↑</option>
          </select>
        </div>
      </div>
      <div id="txnListContainer">${_renderTxnListContent()}</div>
    </div>
  `;
}

function _getAllTxns() {
  const txns = [];
  for (const a of appState.assets) {
    if (!Array.isArray(a.txns)) continue;
    for (const t of a.txns) {
      txns.push({
        id: t.id,
        type: t.type,
        price: t.price,
        qty: t.qty,
        date: t.date,
        account: t.account,
        memo: t.memo,
        assetId: a.id,
        assetName: a.name,
        category: a.category,
      });
    }
  }
  return txns;
}

function _filterTxns(txns) {
  let filtered = txns;

  if (UIState.txnFilterPeriod > 0) {
    const d = new Date();
    d.setDate(d.getDate() - UIState.txnFilterPeriod);
    const cutoff = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    filtered = filtered.filter(t => (t.date || '') >= cutoff);
  }
  if (UIState.txnFilterType !== 'all') {
    filtered = filtered.filter(t => t.type === UIState.txnFilterType);
  }
  if (UIState.txnFilterCat !== 'all') {
    filtered = filtered.filter(t => t.category === UIState.txnFilterCat);
  }
  if (UIState.txnSearch) {
    const q = UIState.txnSearch.toLowerCase();
    filtered = filtered.filter(t =>
      (t.assetName || '').toLowerCase().includes(q) ||
      (t.account || '').toLowerCase().includes(q) ||
      (t.memo || '').toLowerCase().includes(q)
    );
  }

  const sorted = filtered.slice();
  switch (UIState.txnSort) {
    case 'date-asc':
      sorted.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      break;
    case 'amount-desc':
      sorted.sort((a, b) => (b.price * b.qty) - (a.price * a.qty));
      break;
    case 'amount-asc':
      sorted.sort((a, b) => (a.price * a.qty) - (b.price * b.qty));
      break;
    case 'date-desc':
    default:
      sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      break;
  }
  return sorted;
}

function _renderTxnListContent() {
  const all = _getAllTxns();
  const filtered = _filterTxns(all);

  if (filtered.length === 0) {
    return '<div class="empty-state">조건에 맞는 거래 내역이 없습니다</div>';
  }

  const visible = filtered.slice(0, UIState.txnShown);
  const hasMore = filtered.length > UIState.txnShown;

  return `
    <div class="txn-result-count text-muted">${filtered.length}건 표시 중</div>
    <div class="txn-flat-list" role="list">
      ${visible.map(t => {
        const cat = CAT_MAP[t.category];
        const total = t.price * t.qty;
        const metaParts = [];
        if (t.account) metaParts.push(escHtml(t.account));
        if (t.memo) metaParts.push(escHtml(t.memo));
        return `
          <div class="txn-flat-item" role="listitem" data-action="open-asset-from-txn" data-id="${escAttr(t.assetId)}" tabindex="0" aria-label="${escAttr(t.assetName)} ${t.type === 'buy' ? '매수' : '매도'} ${fmtKRW(total)}">
            <div class="txn-flat-head">
              <span class="txn-type ${t.type}">${t.type === 'buy' ? '매수' : '매도'}</span>
              <span class="txn-flat-name"><span class="txn-cat-icon" aria-hidden="true">${cat?.icon || '📦'}</span>${escHtml(t.assetName)}</span>
              <span class="txn-flat-total">${escHtml(fmtKRW(total))}</span>
            </div>
            <div class="txn-flat-sub text-muted">
              <span>${escHtml(fmtPrice(t.price))} × ${escHtml(fmtNum(t.qty, t.qty % 1 !== 0 ? 4 : 0))}</span>
              <span>${escHtml(fmtDate(t.date))}</span>
            </div>
            ${metaParts.length > 0 ? `<div class="txn-flat-meta text-muted">${metaParts.join(' · ')}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
    ${hasMore ? `
      <button class="btn-sm btn-full-width btn-mt" data-action="load-more-txn"
        aria-label="거래 더 보기 (${filtered.length - UIState.txnShown}건 남음)">
        더 보기 (${filtered.length - UIState.txnShown}건 남음)
      </button>
    ` : ''}
  `;
}

function _rerenderTxnList() {
  const container = $('#txnListContainer');
  if (container) container.innerHTML = _renderTxnListContent();
  const title = $('#txnListTitle');
  if (title) title.textContent = `거래 내역 (${_getAllTxns().length}건)`;
}

function _setupHistoryDelegation(container) {
  function handleAction(target) {
    const action = target.dataset.action;
    if (action === 'backup-json') doBackupJSON();
    else if (action === 'restore-json') doRestoreJSON();
    else if (action === 'open-auto-backup-manager') openAutoBackupManager();
    else if (action === 'export-csv') doExportCSV(target.dataset.type);
    else if (action === 'import-csv') doImportCSV();
    else if (action === 'export-pdf') doExportPDF();
    else if (action === 'reset-all') doResetAll();
    else if (action === 'history-filter') setHistoryFilter(Number(target.dataset.days));
    else if (action === 'delete-history') confirmDeleteHistory(target.dataset.date);
    else if (action === 'load-more-history') loadMoreHistory();
    else if (action === 'load-more-txn') loadMoreTxn();
    else if (action === 'set-hist-tab') setHistoryTab(target.dataset.tab);
    else if (action === 'txn-filter-period') setTxnFilterPeriod(Number(target.dataset.days));
    else if (action === 'open-asset-from-txn') openAssetDetail(target.dataset.id);
    else if (action === 'growth-view') {
      const days = Number(target.dataset.days);
      const byCat = target.dataset.byCat === 'true';
      _handleGrowthViewClick(days, byCat, target);
    }
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

  // Txn search input (debounced + IME-safe)
  const searchInput = $('#txnSearchInput');
  if (searchInput) {
    let searchTimer = null;
    let composing = false;
    searchInput.addEventListener('compositionstart', () => { composing = true; });
    searchInput.addEventListener('compositionend', () => {
      composing = false;
      UIState.txnSearch = searchInput.value.trim();
      UIState.txnShown = TXN_PAGE_SIZE;
      _rerenderTxnList();
    });
    searchInput.addEventListener('input', () => {
      if (composing) return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        UIState.txnSearch = searchInput.value.trim();
        UIState.txnShown = TXN_PAGE_SIZE;
        _rerenderTxnList();
      }, DEBOUNCE_MS);
    });
  }

  // Filter/Sort selects
  const typeSel = $('#txnFilterType');
  if (typeSel) typeSel.addEventListener('change', () => {
    UIState.txnFilterType = typeSel.value;
    UIState.txnShown = TXN_PAGE_SIZE;
    _rerenderTxnList();
  });
  const catSel = $('#txnFilterCat');
  if (catSel) catSel.addEventListener('change', () => {
    UIState.txnFilterCat = catSel.value;
    UIState.txnShown = TXN_PAGE_SIZE;
    _rerenderTxnList();
  });
  const sortSel = $('#txnSortSelect');
  if (sortSel) sortSel.addEventListener('change', () => {
    UIState.txnSort = sortSel.value;
    _rerenderTxnList();
  });
}

function setHistoryTab(tab) {
  if (UIState.historyTab === tab) return;
  UIState.historyTab = tab;
  renderHistory();
}

function setTxnFilterPeriod(days) {
  UIState.txnFilterPeriod = days;
  UIState.txnShown = TXN_PAGE_SIZE;
  _rerenderTxnList();
  $$('#pgHist [data-action="txn-filter-period"]').forEach(b => {
    const active = Number(b.dataset.days) === days;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function loadMoreTxn() {
  UIState.txnShown += TXN_PAGE_SIZE;
  _rerenderTxnList();
}

function _handleGrowthViewClick(days, byCategory, btn) {
  const parent = btn?.closest('.card');
  if (parent) {
    parent.querySelectorAll('.btn-group .btn-sm').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
  }
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }
  renderGrowthChart(days, byCategory);
}

function renderHistoryList() {
  let history = [...appState.history].reverse();
  if (UIState.historyFilter > 0) {
    const d = new Date();
    d.setDate(d.getDate() - UIState.historyFilter);
    const cutoffStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    history = history.filter(h => h.date >= cutoffStr);
  }

  if (history.length === 0) {
    return '<div class="empty-state">기록이 없습니다. 자산 업데이트 시 자동으로 기록됩니다.</div>';
  }

  const visible = history.slice(0, UIState.historyShown);
  const hasMore = history.length > UIState.historyShown;

  return `
    <div class="history-list" role="list" aria-label="자산 기록 목록">
      ${visible.map((h, i) => {
        const prev = visible[i + 1] || (i === visible.length - 1 && history[UIState.historyShown] ? history[UIState.historyShown] : null);
        const change = prev ? h.total - prev.total : 0;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        return `
          <div class="history-item" role="listitem">
            <span class="history-date">${escHtml(fmtDate(h.date))}</span>
            <span class="history-total">${escHtml(fmtKRW(h.total))}</span>
            ${change !== 0 ? `<span class="${changeClass}" aria-label="변동: ${fmtKRW(change)}">${change > 0 ? '+' : ''}${escHtml(fmtKRW(change))}</span>` : ''}
            <button class="btn-hist-del" data-action="delete-history" data-date="${escAttr(h.date)}" aria-label="${escAttr(fmtDate(h.date))} 기록 삭제" title="삭제">×</button>
          </div>
        `;
      }).join('')}
    </div>
    ${hasMore ? `
      <button class="btn-sm btn-full-width btn-mt" data-action="load-more-history"
        aria-label="기록 더 보기 (${history.length - UIState.historyShown}건 남음)">
        더 보기 (${history.length - UIState.historyShown}건 남음)
      </button>
    ` : ''}
  `;
}

function confirmDeleteHistory(date) {
  openConfirmModal(
    `${fmtDate(date)} 기록을 삭제하시겠습니까?`,
    () => {
      const undo = deleteHistoryRecord(date);
      if (undo) {
        renderHistory();
        showUndoToast('기록이 삭제되었습니다', () => { undo(); renderHistory(); });
      }
    }
  );
}

function loadMoreHistory() {
  UIState.historyShown += HISTORY_PAGE_SIZE;
  renderHistory();
}

function setHistoryFilter(days) {
  UIState.historyFilter = days;
  UIState.historyShown = HISTORY_PAGE_SIZE;
  renderHistory();
}

// ── Backup & Restore ──
function doBackupJSON() {
  try {
    saveDataNow();
    const data = exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const now = new Date();
    const fname = `MyPortfolio_backup_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`;
    downloadBlob(blob, fname);
    showToast('백업 파일 다운로드 완료', 'success');
  } catch (e) {
    console.error('Backup failed:', e);
    showToast('백업 생성 실패', 'error');
  }
}

function doRestoreJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LIMITS.upload) {
      showToast(`파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB, 최대 10MB)`, 'error');
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const assetCount = (data.data?.assets || data.assets || []).length;
      const version = (typeof data.version === 'string') ? stripHtml(data.version, 20) : '알 수 없음';
      openConfirmModal(
        `백업 복원: v${version}, 자산 ${assetCount}개. 현재 데이터를 덮어씁니다. 계속하시겠습니까?`,
        () => {
          if (importData(data)) {
            showToast('복원 완료', 'success');
            render();
          }
        }
      );
    } catch (err) {
      console.error('Restore failed:', err);
      showToast('파일을 읽을 수 없습니다', 'error');
    }
  };
  input.click();
}

// ── CSV Export ──
function doExportCSV(type) {
  try {
    let csv, fname;
    if (type === 'assets') {
      csv = generateAssetCSV();
      fname = `MyPortfolio_assets_${today()}.csv`;
    } else {
      csv = generateTxnCSV();
      fname = `MyPortfolio_transactions_${today()}.csv`;
    }
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, fname);
    showToast('CSV 다운로드 완료', 'success');
  } catch (e) {
    console.error('CSV export failed:', e);
    showToast('CSV 생성 실패', 'error');
  }
}

function generateAssetCSV() {
  const headers = ['카테고리', '자산명', '종목코드', '현재가', '수량', '평가금액', '투자금액', '손익', '수익률'];
  const rows = appState.assets.map(a => {
    const v = calcAssetValue(a);
    return [a.category, a.name, a.stockCode || '', v.price, v.qty, v.value, v.cost, v.profit, v.profitPct.toFixed(2) + '%']
      .map(c => `"${String(c).replace(/"/g, '""')}"`)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

function generateTxnCSV() {
  const headers = ['자산명', '카테고리', '유형', '단가', '수량', '금액', '날짜', '계좌', '메모'];
  const rows = [];
  for (const a of appState.assets) {
    for (const t of a.txns) {
      rows.push([a.name, a.category, t.type === 'buy' ? '매수' : '매도',
        t.price, t.qty, t.price * t.qty, t.date, t.account || '', t.memo || '']
        .map(c => `"${String(c).replace(/"/g, '""')}"`)
        .join(','));
    }
  }
  return [headers.join(','), ...rows].join('\n');
}

// ── CSV Import ──
let _csvImportState = null;

function doImportCSV() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LIMITS.upload) {
      showToast(`파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB, 최대 10MB)`, 'error');
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        showToast('CSV 파일에 데이터가 없습니다', 'error');
        return;
      }
      const headers = rows[0].map(h => String(h || '').trim());
      const mapping = detectColumnMapping(headers);
      if (mapping.date < 0 || mapping.name < 0 || mapping.price < 0 || mapping.qty < 0) {
        showToast('필수 컬럼(날짜/자산명/단가/수량) 자동 매핑 실패. 헤더를 확인해주세요.', 'error');
        return;
      }
      const parsed = _buildImportRows(rows.slice(1), mapping);
      if (parsed.length === 0) {
        showToast('가져올 거래 행이 없습니다', 'info');
        return;
      }
      _openImportPreview(parsed);
    } catch (err) {
      console.error('CSV import failed:', err);
      showToast('CSV 파일을 읽을 수 없습니다', 'error');
    }
  };
  input.click();
}

// Parse CSV — handles quoted fields, escaped quotes (""), CRLF, BOM
function parseCSV(text) {
  const out = [];
  if (!text) return out;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* handled in \n */ }
      else if (c === '\n') {
        row.push(field);
        field = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) out.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) out.push(row);
  }
  return out;
}

function detectColumnMapping(headers) {
  const m = { date: -1, name: -1, category: -1, type: -1, price: -1, qty: -1, account: -1, memo: -1 };
  headers.forEach((h, i) => {
    const k = h.replace(/\s+/g, '').toLowerCase();
    if (m.date < 0 && /(날짜|일자|date|거래일|체결일)/i.test(k)) m.date = i;
    else if (m.name < 0 && /(자산명|종목명|name|종목)/i.test(k)) m.name = i;
    else if (m.category < 0 && /(카테고리|category|종류|구분)/i.test(k)) m.category = i;
    else if (m.type < 0 && /(유형|type|매매|매수매도)/i.test(k)) m.type = i;
    else if (m.price < 0 && /(단가|체결가|price|가격|매수가|매도가)/i.test(k)) m.price = i;
    else if (m.qty < 0 && /(수량|qty|quantity|주식수|주수)/i.test(k)) m.qty = i;
    else if (m.account < 0 && /(계좌|account)/i.test(k)) m.account = i;
    else if (m.memo < 0 && /(메모|적요|memo|note|비고)/i.test(k)) m.memo = i;
  });
  return m;
}

function _normalizeImportDate(s) {
  if (!s) return '';
  const t = s.replace(/[./]/g, '-').trim();
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const m2 = s.replace(/\s+/g, '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return '';
}

function _buildImportRows(dataRows, mapping) {
  const rows = [];
  for (const r of dataRows) {
    if (r.every(c => !c || !String(c).trim())) continue;
    const dateRaw = String(r[mapping.date] || '').trim();
    const name = String(r[mapping.name] || '').trim();
    const priceStr = String(r[mapping.price] || '').replace(/[,₩$\s]/g, '');
    const qtyStr = String(r[mapping.qty] || '').replace(/[,\s]/g, '');
    const typeRaw = mapping.type >= 0 ? String(r[mapping.type] || '').trim() : '매수';
    const cat = mapping.category >= 0 ? String(r[mapping.category] || '').trim() : '';
    const account = mapping.account >= 0 ? String(r[mapping.account] || '').trim() : '';
    const memo = mapping.memo >= 0 ? String(r[mapping.memo] || '').trim() : '';
    const date = _normalizeImportDate(dateRaw);
    const type = /sell|매도/i.test(typeRaw) ? 'sell' : 'buy';
    const price = Number(priceStr);
    const qty = Number(qtyStr);
    const valid = !!(name && date && price > 0 && qty > 0 && Number.isFinite(price) && Number.isFinite(qty));
    rows.push({ valid, name, date, price: valid ? price : 0, qty: valid ? qty : 0, type, account, memo, cat });
  }
  return rows;
}

function _findExistingAsset(name) {
  const n = name.trim().toLowerCase();
  return appState.assets.find(a => a.name.trim().toLowerCase() === n) || null;
}

function _isDuplicateImportTxn(asset, row) {
  if (!asset || !asset.txns) return false;
  return asset.txns.some(t =>
    t.date === row.date &&
    t.type === row.type &&
    Math.abs(safeNum(t.price) - row.price) < 0.01 &&
    Math.abs(safeNum(t.qty) - row.qty) < 0.000001
  );
}

function _openImportPreview(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = r.name || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const assetDecisions = {};
  for (const [name, list] of groups) {
    const existing = _findExistingAsset(name);
    if (existing) {
      assetDecisions[name] = { mode: 'existing', assetId: existing.id };
    } else {
      const firstWithCat = list.find(r => CAT_IDS.includes(r.cat));
      assetDecisions[name] = { mode: 'skip', newCat: firstWithCat ? firstWithCat.cat : '기타' };
    }
  }
  _csvImportState = { rows, groups, assetDecisions, importDuplicates: false };
  _renderImportPreview();
}

function _renderImportPreview() {
  const { rows, groups, assetDecisions, importDuplicates } = _csvImportState;
  let dupCount = 0, invalidCount = 0, skipCount = 0;
  let willImport = 0, willCreateAssets = 0;
  for (const r of rows) {
    if (!r.valid) { invalidCount++; continue; }
    const dec = assetDecisions[r.name];
    if (!dec || dec.mode === 'skip') { skipCount++; continue; }
    let target = null;
    if (dec.mode === 'existing') target = appState.assets.find(a => a.id === dec.assetId);
    if (target && _isDuplicateImportTxn(target, r)) {
      dupCount++;
      if (importDuplicates) willImport++;
      continue;
    }
    willImport++;
  }
  for (const dec of Object.values(assetDecisions)) {
    if (dec.mode === 'create') willCreateAssets++;
  }

  const container = $('#modalMain');
  if (!container) return;
  _modalCleanup.removeForElement(container);

  const groupRows = [...groups.entries()].map(([name, rs]) => {
    const dec = assetDecisions[name];
    const existing = _findExistingAsset(name);
    const sample = rs.find(r => r.valid) || rs[0];
    const sampleSummary = sample ? `${sample.date} ${sample.type === 'sell' ? '매도' : '매수'} ${fmtNum(sample.price, 0)}×${fmtNum(sample.qty, 4)}` : '';
    const dispName = name || '(이름없음)';
    let selectedVal = 'skip';
    if (dec.mode === 'existing') selectedVal = existing && dec.assetId === existing.id ? 'existing' : `map:${dec.assetId}`;
    else if (dec.mode === 'create') selectedVal = 'create';
    return `<tr>
      <td><strong>${escHtml(dispName)}</strong><div class="hint-text">${rs.length}건 · 예: ${escHtml(sampleSummary)}</div></td>
      <td>
        <select class="csv-select" data-action="csv-asset-decision" data-name="${escAttr(name)}" aria-label="${escAttr(dispName)} 처리 방식">
          <option value="skip" ${selectedVal === 'skip' ? 'selected' : ''}>건너뛰기</option>
          ${existing ? `<option value="existing" ${selectedVal === 'existing' ? 'selected' : ''}>기존 자산에 추가 (${escHtml(existing.category)})</option>` : ''}
          ${appState.assets.filter(a => !existing || a.id !== existing.id).map(a => `<option value="map:${escAttr(a.id)}" ${selectedVal === `map:${a.id}` ? 'selected' : ''}>매칭: ${escHtml(a.name)} (${escHtml(a.category)})</option>`).join('')}
          <option value="create" ${selectedVal === 'create' ? 'selected' : ''}>새 자산 생성</option>
        </select>
        ${dec.mode === 'create' ? `
          <select class="csv-select csv-cat-select" data-action="csv-asset-cat" data-name="${escAttr(name)}" aria-label="${escAttr(dispName)} 카테고리">
            ${CAT_IDS.map(c => `<option value="${escAttr(c)}" ${dec.newCat === c ? 'selected' : ''}>${CAT_MAP[c].icon} ${escHtml(c)}</option>`).join('')}
          </select>
        ` : ''}
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `<div class="modal-backdrop"></div>
    <div class="modal-box modal-large" role="dialog" aria-label="CSV 가져오기 미리보기">
      <div class="modal-header"><h3>📋 CSV 가져오기 미리보기</h3>
        <button class="modal-close" data-action="close-modal" data-modal="modalMain" aria-label="닫기">✕</button></div>
      <div class="modal-body">
        <div class="csv-import-summary">
          <div>총 <strong>${rows.length}</strong>행 · 가져올 거래 <strong>${willImport}</strong>건${willCreateAssets > 0 ? ` · 자산 생성 <strong>${willCreateAssets}</strong>개` : ''}</div>
          <div class="hint-text">중복 ${dupCount}건 · 건너뜀 ${skipCount}건 · 오류 ${invalidCount}건</div>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="csvImportDups" ${importDuplicates ? 'checked' : ''} data-action="csv-toggle-dups"> 중복도 함께 가져오기</label>
          <div class="hint-text">기본은 같은 날짜·단가·수량·유형 거래 제외</div>
        </div>
        <div class="csv-import-table-wrap">
          <table class="csv-import-table">
            <thead><tr><th>자산명 (CSV)</th><th>처리 방식</th></tr></thead>
            <tbody>${groupRows || '<tr><td colspan="2" class="hint-text">가져올 행이 없습니다</td></tr>'}</tbody>
          </table>
        </div>
        ${invalidCount > 0 ? `<div class="hint-text" style="color:var(--danger);margin-top:8px">⚠️ 필수값(날짜/단가/수량) 누락된 ${invalidCount}건은 자동 제외됩니다</div>` : ''}
        <div class="modal-actions">
          <button class="btn-s" data-action="close-modal" data-modal="modalMain">취소</button>
          <button class="btn-p" data-action="csv-import-confirm" ${willImport === 0 && willCreateAssets === 0 ? 'disabled' : ''}>가져오기 (${willImport}건)</button>
        </div>
      </div>
    </div>`;
  openModal('modalMain');

  const clickHandler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const a = target.dataset.action;
    if (a === 'close-modal') {
      closeModal(target.dataset.modal || 'modalMain');
      _csvImportState = null;
    } else if (a === 'csv-import-confirm') {
      _executeCSVImport();
    }
  };
  const changeHandler = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !_csvImportState) return;
    const a = target.dataset.action;
    if (a === 'csv-toggle-dups') {
      _csvImportState.importDuplicates = !!target.checked;
      _renderImportPreview();
    } else if (a === 'csv-asset-decision') {
      const name = target.dataset.name;
      const v = target.value;
      const dec = _csvImportState.assetDecisions[name];
      if (v === 'skip') dec.mode = 'skip';
      else if (v === 'existing') {
        const existing = _findExistingAsset(name);
        if (existing) { dec.mode = 'existing'; dec.assetId = existing.id; }
      } else if (v === 'create') {
        dec.mode = 'create';
      } else if (v.startsWith('map:')) {
        dec.mode = 'existing';
        dec.assetId = v.slice(4);
      }
      _renderImportPreview();
    } else if (a === 'csv-asset-cat') {
      _csvImportState.assetDecisions[target.dataset.name].newCat = target.value;
    }
  };
  _modalCleanup.add(container, 'click', clickHandler);
  _modalCleanup.add(container, 'change', changeHandler);
}

function _executeCSVImport() {
  const { rows, assetDecisions, importDuplicates } = _csvImportState;
  let imported = 0, created = 0, skipped = 0, dupSkipped = 0, errors = 0;

  const newAssetIds = {};
  for (const [name, dec] of Object.entries(assetDecisions)) {
    if (dec.mode !== 'create') continue;
    const newAsset = addAsset({ name, category: dec.newCat || '기타' });
    if (newAsset) { newAssetIds[name] = newAsset.id; created++; }
  }

  for (const r of rows) {
    if (!r.valid) { errors++; continue; }
    const dec = assetDecisions[r.name];
    if (!dec || dec.mode === 'skip') { skipped++; continue; }
    let assetId = null;
    if (dec.mode === 'existing') assetId = dec.assetId;
    else if (dec.mode === 'create') assetId = newAssetIds[r.name];
    if (!assetId) { skipped++; continue; }
    const asset = appState.assets.find(a => a.id === assetId);
    if (!asset) { skipped++; continue; }
    if (_isDuplicateImportTxn(asset, r) && !importDuplicates) { dupSkipped++; continue; }
    const ok = addTransaction(assetId, {
      type: r.type,
      price: r.price,
      qty: r.qty,
      date: r.date,
      account: r.account || null,
      memo: r.memo || null,
    });
    if (ok) imported++; else errors++;
  }

  closeModal('modalMain');
  _csvImportState = null;

  const parts = [`📋 CSV 가져오기 완료 · 거래 ${imported}건 추가`];
  if (created > 0) parts.push(`자산 ${created}개 생성`);
  if (dupSkipped > 0) parts.push(`중복 ${dupSkipped}건 제외`);
  if (skipped > 0) parts.push(`건너뜀 ${skipped}건`);
  if (errors > 0) parts.push(`오류 ${errors}건`);
  showToast(parts.join(' · '), imported > 0 || created > 0 ? 'success' : 'info');
  render();
}

// ── PDF Export ──
function doExportPDF() {
  try {
    const total = calcTotal(appState.assets);
    const catTotals = calcCategoryTotals(appState.assets);
    let html = `<html><head><meta charset="utf-8"><title>My Portfolio Report</title>
    <style>body{font-family:'Pretendard',sans-serif;padding:40px;color:#1A1A1A;background:#FAF9F7}
    h1{color:#1A1A1A;border-bottom:2px solid #7C6FF0;padding-bottom:8px}
    h2{color:#4A4A4A;margin-top:24px}table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{border:1px solid #EFEEEA;padding:8px 12px;text-align:left}th{background:#F4F2EE;font-weight:600}
    .total{font-size:24px;font-weight:700;color:#7C6FF0}.positive{color:#6BBF8A}.negative{color:#E8788A}
    .footer{margin-top:40px;color:#A8A8A8;font-size:12px}</style></head><body>
    <h1>${escHtml(APP_NAME)} 리포트</h1>
    <p>생성일: ${escHtml(fmtDate(new Date()))} | 버전: v${escHtml(APP_VERSION)}</p>
    <p class="total">총 자산: ${escHtml(fmtKRW(total))}</p>
    <h2>카테고리별 요약</h2><table><tr><th>카테고리</th><th>금액</th><th>비중</th></tr>
    ${appState.categoryOrder.filter(c => catTotals[c] > 0).map(c => {
      const pct = total > 0 ? ((catTotals[c] / total) * 100).toFixed(1) : 0;
      return `<tr><td>${CAT_MAP[c].icon} ${escHtml(c)}</td><td>${escHtml(fmtKRW(catTotals[c]))}</td><td>${pct}%</td></tr>`;
    }).join('')}</table>
    <h2>자산 상세</h2><table><tr><th>자산명</th><th>카테고리</th><th>수량</th><th>현재가</th><th>평가금액</th><th>손익</th></tr>
    ${appState.assets.map(a => {
      const v = calcAssetValue(a);
      return `<tr><td>${escHtml(a.name)}</td><td>${escHtml(a.category)}</td><td>${escHtml(fmtNum(v.qty, 2))}</td>
        <td>${escHtml(fmtPrice(v.price))}</td><td>${escHtml(fmtKRW(v.value))}</td>
        <td class="${v.profit >= 0 ? 'positive' : 'negative'}">${escHtml(fmtKRW(v.profit))} (${escHtml(fmtPct(v.profitPct))})</td></tr>`;
    }).join('')}</table>
    <div class="footer">Generated by ${escHtml(APP_NAME)} v${escHtml(APP_VERSION)}</div></body></html>`;

    const win = window.open('', '_blank');
    if (!win) { showToast('팝업이 차단되었습니다. 팝업을 허용해주세요.', 'error'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), PDF_PRINT_DELAY_MS);
  } catch (e) {
    console.error('PDF export failed:', e);
    showToast('PDF 생성 실패', 'error');
  }
}

// ── Reset All ──
function doResetAll() {
  openConfirmModal(
    '모든 데이터가 영구 삭제됩니다. 백업을 먼저 하시는 것을 권장합니다. 정말 초기화하시겠습니까?',
    () => {
      openConfirmModal('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.', () => {
        resetAllData();
        localStorage.clear();
        sessionStorage.clear();
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
          });
        }
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        setTimeout(() => location.reload(), 500);
      });
    }
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
