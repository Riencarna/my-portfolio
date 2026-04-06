/* =============================================
   My Portfolio v3.13.2 — App Entry Point
   Desktop UI Overhaul: Sidebar navigation, centered modals
   Fix: ARIA tablist structure, tab-switch animation
   ============================================= */

let currentTab = 'pgDash';
let _swipeStartX = 0;
let _swipeStartY = 0;
const TAB_ORDER = ['pgDash', 'pgList', 'pgInc', 'pgHist', 'pgAi'];
const TAB_ICONS = ['📊', '📋', '💰', '📁', '🔍'];
const TAB_LABELS = ['대시보드', '자산', '수입', '기록', '분석'];

// ── Initialization ──
document.addEventListener('DOMContentLoaded', async () => {
  try {
    loadTheme();
    initPortfolio();
    loadData();
    restoreLastTab();
    render();
    removeSplash();
    registerSW();

    fetchExchangeRate().catch(e => {
      console.warn('Initial exchange rate fetch failed:', e.message);
    });
    setupSwipe();

    EventBus.on('dataImported', () => render());
    EventBus.on('dataReset', () => render());
  } catch (e) {
    console.error('App initialization failed:', e);
    const splash = document.getElementById('splash');
    if (splash) splash.remove();
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:#EF4444">
          <h2>초기화 오류</h2>
          <p>앱을 시작할 수 없습니다. 브라우저 콘솔을 확인하세요.</p>
          <p style="font-size:12px;color:#94A3B8;margin-top:8px">${escHtml(String(e.message || e))}</p>
        </div>
      `;
    }
  }
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            showToast('새 버전이 있습니다. 새로고침하면 적용됩니다.', 'info');
          }
        });
      });
    }).catch(e => {
      console.warn('Service worker registration failed:', e.message);
    });
  }
}

// ── Theme ──
function loadTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'dark';
  document.body.dataset.theme = theme;
  updateThemeMeta(theme);
}

function toggleTheme() {
  const current = document.body.dataset.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  updateThemeMeta(next);
  destroyAllCharts();
  updateSidebarThemeBtn(next);
  requestAnimationFrame(() => {
    renderTabContent();
  });
}

function updateSidebarThemeBtn(theme) {
  const btn = $('#sidebarThemeBtn');
  if (btn) {
    btn.querySelector('.sidebar-action-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.querySelector('span:not(.sidebar-action-icon)').textContent = theme === 'dark' ? '라이트 모드' : '다크 모드';
  }
}

function updateThemeMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0a0a0f' : '#f5f7fa';
}

// ── Tab Routing ──
function goTab(tabId) {
  if (!TAB_ORDER.includes(tabId)) return;
  currentTab = tabId;
  localStorage.setItem(TAB_KEY, tabId);
  destroyAllCharts();
  renderTabContent();
  syncNav();
  renderPageHeader();
}

function restoreLastTab() {
  const saved = localStorage.getItem(TAB_KEY);
  if (saved && TAB_ORDER.includes(saved)) currentTab = saved;
}

function render() {
  renderSidebar();
  renderPageHeader();
  renderTabContent();
  renderBottomNav();
  syncNav();
}

// ── Sidebar (Desktop/Tablet) ──
function renderSidebar() {
  const sidebar = $('#sidebar');
  if (!sidebar) return;
  const meta = loadPortfolioMeta();
  const pf = meta.list.find(p => p.id === activePortfolioId);
  const isDark = document.body.dataset.theme === 'dark';

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-logo">${escHtml(APP_NAME)}</div>
      <div class="sidebar-version">v${APP_VERSION}</div>
      ${meta.list.length > 0 ? `
        <div class="sidebar-pf" data-action="open-portfolio-manager"
          role="button" tabindex="0" aria-label="포트폴리오 전환: ${escAttr(pf?.name || '기본')}">
          <span class="sidebar-pf-icon">📂</span>
          <span>${escHtml(pf?.name || '기본 포트폴리오')}</span>
          ${meta.list.length > 1 ? '<span style="margin-left:auto;color:var(--t4)">▾</span>' : ''}
        </div>
      ` : ''}
    </div>

    <nav class="sidebar-nav" role="tablist" aria-orientation="vertical" aria-label="메인 탐색">
      ${TAB_ORDER.map((id, i) => `
        <div class="nav-item ${currentTab === id ? 'active' : ''}"
          data-action="go-tab" data-tab="${id}"
          role="tab" tabindex="${currentTab === id ? '0' : '-1'}"
          aria-selected="${currentTab === id}" aria-controls="${id}" aria-label="${TAB_LABELS[i]}">
          <span class="nav-item-icon">${TAB_ICONS[i]}</span>
          <span class="nav-item-label">${TAB_LABELS[i]}</span>
        </div>
      `).join('')}
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-action" data-action="open-wallet-scan" role="button" tabindex="0" aria-label="EVM 지갑 스캔">
        <span class="sidebar-action-icon">🔗</span><span>지갑 스캔</span>
      </div>
      <div class="sidebar-action" id="sidebarThemeBtn" data-action="toggle-theme" role="button" tabindex="0"
        aria-label="${isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}">
        <span class="sidebar-action-icon">${isDark ? '☀️' : '🌙'}</span><span>${isDark ? '라이트 모드' : '다크 모드'}</span>
      </div>
    </div>
  `;

  sidebar.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'go-tab') goTab(target.dataset.tab);
    else if (action === 'open-portfolio-manager') openPortfolioManager();
    else if (action === 'open-wallet-scan') openWalletScan();
    else if (action === 'toggle-theme') toggleTheme();
  };

  sidebar.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target.closest('[data-action]');
      if (target) { e.preventDefault(); target.click(); }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = $$('.nav-item', sidebar);
      const current = items.findIndex(i => i.dataset.tab === currentTab);
      if (current < 0) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
      goTab(items[next].dataset.tab);
      requestAnimationFrame(() => items[next].focus());
    }
  };
}

// ── Page Header (contextual) ──
function renderPageHeader() {
  const header = $('#appHeader');
  if (!header) return;
  const idx = TAB_ORDER.indexOf(currentTab);
  const meta = loadPortfolioMeta();
  const pf = meta.list.find(p => p.id === activePortfolioId);

  header.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:10px">
      <span class="page-title">${TAB_LABELS[idx] || '대시보드'}</span>
      <span class="page-subtitle">${escHtml(pf?.name || APP_NAME)}</span>
    </div>
    <div class="header-actions">
      ${currentTab === 'pgDash' ? `
        <button class="btn-p" id="btnAutoUpdateHeader" data-action="auto-update"
          aria-label="전체 가격 업데이트" ${autoUpdateProgress.running ? 'disabled' : ''}>
          ${autoUpdateProgress.running ? '업데이트 중...' : '🔄 가격 업데이트'}
        </button>
      ` : ''}
      ${currentTab === 'pgList' ? `
        <button class="btn-p" data-action="open-add-asset" aria-label="자산 추가">+ 자산 추가</button>
      ` : ''}
      ${currentTab === 'pgInc' ? `
        <button class="btn-p" data-action="open-add-income" aria-label="수입 추가">+ 수입 추가</button>
      ` : ''}
    </div>
  `;

  header.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'auto-update') startAutoUpdate();
    else if (action === 'open-add-asset') openAddAsset();
    else if (action === 'open-add-income') openAddIncome();
  };
}

function renderTabContent() {
  TAB_ORDER.forEach(id => {
    const page = $(`#${id}`);
    if (page) {
      page.classList.add('hidden');
      page.classList.remove('visible');
      page.setAttribute('aria-hidden', 'true');
    }
  });
  const page = $(`#${currentTab}`);
  if (page) {
    page.classList.remove('hidden');
    page.classList.add('visible', 'page-enter');
    page.removeAttribute('aria-hidden');
    requestAnimationFrame(() => {
      setTimeout(() => page.classList.remove('page-enter'), PAGE_ENTER_MS);
    });
  }

  switch (currentTab) {
    case 'pgDash': renderDashboard(); break;
    case 'pgList': renderList(); break;
    case 'pgInc': renderIncome(); break;
    case 'pgHist': renderHistory(); break;
    case 'pgAi': renderAnalysis(); break;
  }

  setTimeout(applyDynamicColors, DYNAMIC_COLOR_DELAY_MS);
}

// ── Bottom Nav (mobile fallback) ──
function renderBottomNav() {
  const nav = $('#bottomNav');
  if (!nav) return;
  nav.innerHTML = TAB_ORDER.map((id, i) => `
    <button class="nav-btn ${currentTab === id ? 'active' : ''}"
      data-action="go-tab" data-tab="${id}"
      role="tab" aria-selected="${currentTab === id}"
      aria-controls="${id}" aria-label="${TAB_LABELS[i]}"
      tabindex="${currentTab === id ? '0' : '-1'}">
      <span class="nav-icon" aria-hidden="true">${TAB_ICONS[i]}</span>
      <span class="nav-label">${TAB_LABELS[i]}</span>
    </button>
  `).join('');

  nav.onclick = (e) => {
    const target = e.target.closest('[data-action="go-tab"]');
    if (!target) return;
    goTab(target.dataset.tab);
  };

  nav.onkeydown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const btns = $$('.nav-btn', nav);
    const currentIdx = btns.findIndex(b => b.dataset.tab === currentTab);
    if (currentIdx < 0) return;
    e.preventDefault();
    const nextIdx = e.key === 'ArrowRight'
      ? (currentIdx + 1) % btns.length
      : (currentIdx - 1 + btns.length) % btns.length;
    goTab(btns[nextIdx].dataset.tab);
    requestAnimationFrame(() => {
      const newBtn = $(`[data-tab="${btns[nextIdx].dataset.tab}"]`, nav);
      if (newBtn) newBtn.focus();
    });
  };
}

function syncNav() {
  // Sidebar nav items
  $$('.sidebar .nav-item').forEach(item => {
    const isActive = item.dataset.tab === currentTab;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
    item.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  // Bottom nav buttons (mobile)
  $$('.bottom-nav .nav-btn').forEach(btn => {
    const isActive = btn.dataset.tab === currentTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
  });
}

// ── Dynamic color application ──
function applyDynamicColors() {
  $$('.legend-dot[data-color]').forEach(dot => {
    dot.style.background = dot.dataset.color;
  });
  $$('.score-circle[data-border-color]').forEach(circle => {
    circle.style.borderColor = circle.dataset.borderColor;
  });
}

// ── Swipe Navigation (mobile) ──
function setupSwipe() {
  document.addEventListener('touchstart', e => {
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _swipeStartX;
    const dy = e.changedTouches[0].clientY - _swipeStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (e.target.closest('input, select, textarea, .drag-handle, canvas, .modal.active')) return;

    const idx = TAB_ORDER.indexOf(currentTab);
    if (dx > 0 && idx > 0) goTab(TAB_ORDER[idx - 1]);
    else if (dx < 0 && idx < TAB_ORDER.length - 1) goTab(TAB_ORDER[idx + 1]);
  }, { passive: true });
}

// ── Splash Screen ──
function removeSplash() {
  const splash = $('#splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), SPLASH_FADE_MS);
  }
}

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', e => {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;

  if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    goTab(TAB_ORDER[Number(e.key) - 1]);
  }

  if (e.key === 't' && e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    toggleTheme();
  }
});
