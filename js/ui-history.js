/* =============================================
   My Portfolio v5.3.0 — History & Export UI
   Soft Neutral palette, PDF 라벤더 강조
   Planner-Creator-Evaluator Cycle 3
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
        <button class="btn-action" data-action="export-csv" data-type="assets" aria-label="자산 CSV 내보내기">
          <span class="btn-action-icon" aria-hidden="true">📊</span><span>자산 CSV</span>
        </button>
        <button class="btn-action" data-action="export-csv" data-type="txns" aria-label="거래 CSV 내보내기">
          <span class="btn-action-icon" aria-hidden="true">📋</span><span>거래 CSV</span>
        </button>
        <button class="btn-action" data-action="export-pdf" aria-label="PDF 리포트 생성">
          <span class="btn-action-icon" aria-hidden="true">📄</span><span>PDF 리포트</span>
        </button>
        <button class="btn-action btn-action-danger" data-action="reset-all" aria-label="전체 데이터 초기화">
          <span class="btn-action-icon" aria-hidden="true">🗑</span><span>전체 초기화</span>
        </button>
      </div>
    </div>

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

  requestAnimationFrame(() => renderGrowthChart(0, false));

  _setupHistoryDelegation(container);
}

function _setupHistoryDelegation(container) {
  function handleAction(target) {
    const action = target.dataset.action;
    if (action === 'backup-json') doBackupJSON();
    else if (action === 'restore-json') doRestoreJSON();
    else if (action === 'export-csv') doExportCSV(target.dataset.type);
    else if (action === 'export-pdf') doExportPDF();
    else if (action === 'reset-all') doResetAll();
    else if (action === 'history-filter') setHistoryFilter(Number(target.dataset.days));
    else if (action === 'load-more-history') loadMoreHistory();
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
