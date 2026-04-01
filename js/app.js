/* =============================================
   My Portfolio v3.12.0 — App Entry Point
   Cycle 15: Full rebuild from scratch
   P7 FIX: toggleTheme uses rAF delay before chart re-creation
           so CSS variable values are updated first
   ============================================= */

let currentTab = 'pgDash';
let _swipeStartX = 0;
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

// P7 FIX: Use requestAnimationFrame delay before re-creating charts after theme change
// This ensures CSS variable values (colors, borders) are fully updated by the browser
// before Chart.js reads them for rendering
function toggleTheme() {
  const current = document.body.dataset.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  updateThemeMeta(next);
  destroyAllCharts();

  const themeBtn = $('#themeToggle');
  if (themeBtn) {
    themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    themeBtn.setAttribute('aria-label', next === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  }

  // P7 FIX: rAF ensures the browser has applied the new CSS variable values
  // before renderTabContent() triggers chart creation that reads those values
  requestAnimationFrame(() => {
    renderTabContent();
  });
}

function updateThemeMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0B0D11' : '#F8FAFC';
}

// ── Tab Routing ──
function goTab(tabId) {
  if (!TAB_ORDER.includes(tabId)) return;
  currentTab = tabId;
  localStorage.setItem(TAB_KEY, tabId);
  destroyAllCharts();
  renderTabContent();
  syncNav();
}

function restoreLastTab() {
  const saved = localStorage.getItem(TAB_KEY);
  if (saved && TAB_ORDER.includes(saved)) currentTab = saved;
}

function render() {
  renderHeader();
  renderTabContent();
  renderBottomNav();
  syncNav();
}

function renderHeader() {
  const header = $('#appHeader');
  if (!header) return;
  const meta = loadPortfolioMeta();
  const pf = meta.list.find(p => p.id === activePortfolioId);
  const isDark = document.body.dataset.theme === 'dark';

  header.innerHTML = `
    <div class="header-left">
      <h1 class="app-title" data-action="open-portfolio-manager" role="button" tabindex="0"
        aria-label="${escAttr(pf?.name || APP_NAME)} 포트폴리오${meta.list.length > 1 ? ' (클릭하여 전환)' : ''}">
        ${escHtml(pf?.name || APP_NAME)}
        ${meta.list.length > 1 ? '<span class="pf-indicator" aria-hidden="true">▾</span>' : ''}
      </h1>
      <span class="app-version" aria-hidden="true">v${APP_VERSION}</span>
    </div>
    <div class="header-right" role="toolbar" aria-label="앱 도구">
      <button class="btn-icon" data-action="open-wallet-scan" aria-label="EVM 지갑 스캔">🔗</button>
      <button class="btn-icon" id="themeToggle" data-action="toggle-theme"
        aria-label="${isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}">
        ${isDark ? '☀️' : '🌙'}
      </button>
    </div>
  `;

  header.onclick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'open-portfolio-manager') openPortfolioManager();
    else if (action === 'open-wallet-scan') openWalletScan();
    else if (action === 'toggle-theme') toggleTheme();
  };
  header.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target.closest('[data-action="open-portfolio-manager"]');
      if (target) { e.preventDefault(); openPortfolioManager(); }
    }
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
    page.classList.add('visible');
    page.removeAttribute('aria-hidden');
    page.classList.add('page-enter');
    setTimeout(() => page.classList.remove('page-enter'), PAGE_ENTER_MS);
  }

  switch (currentTab) {
    case 'pgDash': renderDashboard(); break;
    case 'pgList': renderList(); break;
    case 'pgInc': renderIncome(); break;
    case 'pgHist': renderHistory(); break;
    case 'pgAi': renderAnalysis(); break;
  }

  // Apply dynamic colors after content render
  setTimeout(applyDynamicColors, DYNAMIC_COLOR_DELAY_MS);
}

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
      <span class="nav-label tl">${TAB_LABELS[i]}</span>
    </button>
  `).join('');

  // Event delegation for bottom nav clicks
  nav.onclick = (e) => {
    const target = e.target.closest('[data-action="go-tab"]');
    if (!target) return;
    goTab(target.dataset.tab);
  };

  // Left/right arrow key navigation for WAI-ARIA Tabs pattern
  nav.onkeydown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const btns = $$('.nav-btn', nav);
    const currentIdx = btns.findIndex(b => b.dataset.tab === currentTab);
    if (currentIdx < 0) return;

    let nextIdx;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % btns.length;
    } else {
      nextIdx = (currentIdx - 1 + btns.length) % btns.length;
    }

    e.preventDefault();
    const nextTab = btns[nextIdx].dataset.tab;
    goTab(nextTab);
    // Focus the newly activated tab button
    requestAnimationFrame(() => {
      const newBtn = $(`[data-tab="${nextTab}"]`, nav);
      if (newBtn) newBtn.focus();
    });
  };
}

function syncNav() {
  $$('.nav-btn').forEach((btn, i) => {
    const isActive = TAB_ORDER[i] === currentTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
    // Roving tabindex for WAI-ARIA Tabs pattern
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
  });
}

// ── Dynamic color application ──
function applyDynamicColors() {
  // Legend dots
  $$('.legend-dot[data-color]').forEach(dot => {
    dot.style.background = dot.dataset.color;
  });
  // Score circle border — only use data-border-color
  $$('.score-circle[data-border-color]').forEach(circle => {
    circle.style.borderColor = circle.dataset.borderColor;
  });
}

// ── Swipe Navigation ──
// Check |dx| > |dy| to avoid triggering on vertical scroll
let _swipeStartY = 0;
function setupSwipe() {
  document.addEventListener('touchstart', e => {
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _swipeStartX;
    const dy = e.changedTouches[0].clientY - _swipeStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll — ignore
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
