/* =============================================
   My Portfolio v5.36.9 — Charts (Chart.js)
   Cycle C compatible
   Soft Neutral: lavender/coral palette
   ============================================= */

const charts = { pie: null, catPie: null, catPies: {}, trend: null, incBar: null, incPie: null, growth: null };

function getThemeColor(varName) {
  try {
    return getComputedStyle(document.body).getPropertyValue(varName).trim() || '#888';
  } catch (e) {
    console.warn('getThemeColor failed for', varName, e);
    return '#888';
  }
}

const CATEGORY_GROWTH_COLORS = Object.freeze({
  '국내주식': '#4F6DF5',
  '해외주식': '#8B5CF6',
  '코인': '#F59E0B',
  '현금': '#10B981',
  '예적금': '#0EA5E9',
  '부동산': '#F43F5E',
  '기타': '#64748B',
});

function colorAlpha(color, alpha) {
  const hex = String(color || '').trim();
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart) {
    const meta = chart.options.plugins?.centerText;
    if (!meta?.text) return;
    const { ctx, chartArea: { left, right, top, bottom } } = chart;
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (meta.sub) {
      ctx.font = `bold ${meta.fontSize || 14}px Pretendard`;
      ctx.fillStyle = meta.color || getThemeColor('--t1');
      ctx.fillText(meta.text, cx, cy - 10);
      ctx.font = `${(meta.fontSize || 14) - 2}px Pretendard`;
      ctx.fillStyle = meta.subColor || getThemeColor('--t3');
      ctx.fillText(meta.sub, cx, cy + 12);
    } else {
      ctx.font = `bold ${meta.fontSize || 16}px Pretendard`;
      ctx.fillStyle = meta.color || getThemeColor('--t1');
      ctx.fillText(meta.text, cx, cy);
    }
    ctx.restore();
  }
};

function destroyAllCharts() {
  for (const [key, val] of Object.entries(charts)) {
    if (key === 'catPies') {
      Object.values(val).forEach(c => { try { c?.destroy(); } catch (e) { console.warn('destroyAllCharts catPie:', e); } });
      charts.catPies = {};
    } else if (val) {
      try { val.destroy(); } catch (e) { console.warn('destroyAllCharts:', key, e); }
      charts[key] = null;
    }
  }
}

function destroyChart(name) {
  if (name === 'catPies') {
    Object.values(charts.catPies).forEach(c => { try { c?.destroy(); } catch (e) { console.warn('destroyChart catPie:', e); } });
    charts.catPies = {};
  } else if (charts[name]) {
    try { charts[name].destroy(); } catch (e) { console.warn('destroyChart:', name, e); }
    charts[name] = null;
  }
}

// ── sr-only table HTML for chart accessibility ──
function chartAltTable(headers, rows, caption) {
  if (!rows || rows.length === 0) return '';
  return `<table class="sr-only" aria-label="${escAttr(caption)}">
    <caption>${escHtml(caption)}</caption>
    <thead><tr>${headers.map(h => `<th scope="col">${escHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escHtml(String(c))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function renderDoughnut(canvasId, labels, data, colors, opts = {}) {
  if (!isChartReady()) { console.warn('Chart.js not loaded — skipping', canvasId); return null; }
  const canvas = document.getElementById(canvasId);
  if (!canvas) { console.error(`Canvas not found: ${canvasId}`); return null; }
  const ctx = canvas.getContext('2d');
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: opts.cutout || '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: item => {
          const total = item.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((item.parsed / total) * 100).toFixed(1) : 0;
          return ` ${item.label}: ${fmtKRW(item.parsed)} (${pct}%)`;
        }}},
        centerText: opts.centerText || undefined,
      },
      animation: { duration: opts.animate === false ? 0 : 600 },
    },
    plugins: [centerTextPlugin],
  });
}

function renderLineChart(canvasId, labels, datasets, opts = {}) {
  if (!isChartReady()) { console.warn('Chart.js not loaded — skipping', canvasId); return null; }
  const canvas = document.getElementById(canvasId);
  if (!canvas) { console.error(`Canvas not found: ${canvasId}`); return null; }
  const yTickCallback = opts.yTickCallback || (v => fmtKRW(v));
  const tooltipLabelCallback = opts.tooltipLabelCallback || (item => ` ${item.dataset.label}: ${fmtKRW(item.parsed.y)}`);
  return new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { display: opts.showX !== false, stacked: !!opts.stacked, grid: { display: false },
          ticks: { color: getThemeColor('--t4'), font: { size: 10 }, maxTicksLimit: opts.maxXTicks || 6 } },
        y: { display: opts.showY !== false, stacked: !!opts.stacked, beginAtZero: !!opts.beginAtZero,
          grid: { color: 'rgba(128,128,128,0.1)' },
          ticks: { color: getThemeColor('--t4'), font: { size: 10 }, callback: yTickCallback } },
      },
      plugins: {
        legend: {
          display: !!opts.legend,
          position: opts.legendPosition || 'top',
          labels: {
            color: getThemeColor('--t2'),
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 8,
            boxHeight: 8,
            padding: 12,
            font: { size: 11, weight: '600' },
          },
        },
        tooltip: { callbacks: { label: tooltipLabelCallback } },
      },
      elements: { line: { tension: opts.tension ?? 0.35, borderWidth: opts.lineWidth ?? 2 }, point: { radius: opts.pointRadius ?? 2, hoverRadius: 5 } },
      animation: { duration: opts.animate === false ? 0 : 600 },
    },
  });
}

function renderBarChart(canvasId, labels, data, color) {
  if (!isChartReady()) { console.warn('Chart.js not loaded — skipping', canvasId); return null; }
  const canvas = document.getElementById(canvasId);
  if (!canvas) { console.error(`Canvas not found: ${canvasId}`); return null; }
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, color + '33');
  return new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: gradient, borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: getThemeColor('--t4'), font: { size: 10 } } },
        y: { grid: { color: 'rgba(128,128,128,0.1)' },
          ticks: { color: getThemeColor('--t4'), font: { size: 10 }, callback: v => fmtKRW(v) } },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: item => ` ${fmtKRW(item.parsed.y)}` } } },
      animation: { duration: 600 },
    },
  });
}

function makeGradient(canvas, color, alpha = 0.3) {
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
  g.addColorStop(1, color + '00');
  return g;
}

function renderPortfolioPie() {
  destroyChart('pie');
  const totals = calcCategoryTotals(appState.assets);
  const cats = appState.categoryOrder.filter(c => totals[c] > 0);
  if (cats.length === 0) return;
  const total = cats.reduce((s, c) => s + totals[c], 0);
  charts.pie = renderDoughnut('chartPie',
    cats.map(c => CAT_MAP[c].label), cats.map(c => totals[c]), cats.map(c => CAT_MAP[c].color),
    { centerText: { text: fmtKRW(total), sub: '총 자산', fontSize: 14 } }
  );

  const altContainer = document.getElementById('chartPieAlt');
  if (altContainer) {
    const rows = cats.map(c => {
      const pct = total > 0 ? ((totals[c] / total) * 100).toFixed(1) + '%' : '0%';
      return [CAT_MAP[c].label, fmtKRW(totals[c]), pct];
    });
    altContainer.innerHTML = chartAltTable(['카테고리', '금액', '비중'], rows, '자산 분포 데이터');
  }
}

function renderTrendChart(days = 30, options = {}) {
  destroyChart('trend');
  let history = appState.history;
  if (days > 0) history = history.slice(-days);
  if (history.length < 2) return;
  const canvas = document.getElementById('chartTrend');
  if (!canvas) return;
  const labels = history.map(h => fmtDate(h.date).slice(5));
  const hideAbsolute = !!options.hideAbsolute;
  const baseTotal = safeNum(history.find(h => safeNum(h.total) > 0)?.total || history[0]?.total);
  const data = hideAbsolute && baseTotal > 0
    ? history.map(h => safeNum(((safeNum(h.total) - baseTotal) / baseTotal) * 100))
    : history.map(h => h.total);
  const primary = getThemeColor('--primary') || '#7C6FF0';
  charts.trend = renderLineChart('chartTrend', labels, [{
    label: hideAbsolute ? '총 자산 변동률' : '총 자산', data, borderColor: primary,
    backgroundColor: makeGradient(canvas, primary), fill: true,
  }], hideAbsolute ? {
    pointRadius: data.length > CHART_POINT_THRESHOLD ? 0 : 2,
    yTickCallback: v => fmtPct(v, 1),
    tooltipLabelCallback: item => ` ${item.dataset.label}: ${fmtPct(item.parsed.y, 2)}`,
    beginAtZero: true,
  } : { pointRadius: data.length > CHART_POINT_THRESHOLD ? 0 : 2 });

  const altContainer = document.getElementById('chartTrendAlt');
  if (altContainer) {
    const step = Math.max(1, Math.floor(history.length / 10));
    const rows = history.filter((_, i) => i % step === 0 || i === history.length - 1)
      .map(h => {
        const value = hideAbsolute && baseTotal > 0
          ? fmtPct(((safeNum(h.total) - baseTotal) / baseTotal) * 100, 2)
          : fmtKRW(h.total);
        return [fmtDate(h.date), value];
      });
    altContainer.innerHTML = chartAltTable(['날짜', hideAbsolute ? '변동률' : '총 자산'], rows, '자산 추이 데이터');
  }
}

function renderGrowthChart(days = 0, byCategory = false) {
  destroyChart('growth');
  let history = appState.history;
  if (days > 0) history = history.slice(-days);
  if (history.length < 2) return;
  const canvas = document.getElementById('chartGrowth');
  if (!canvas) return;
  const labels = history.map(h => fmtDate(h.date).slice(5));

  if (byCategory) {
    const categorySeries = [];
    for (const cat of CATEGORIES) {
      const data = history.map(h => h.byCategory?.[cat.id] || 0);
      if (data.some(v => v > 0)) {
        const color = CATEGORY_GROWTH_COLORS[cat.id] || cat.color;
        categorySeries.push({
          label: cat.label,
          data,
          finalValue: data[data.length - 1] || 0,
          borderColor: color,
          backgroundColor: colorAlpha(color, 0.28),
          pointBackgroundColor: color,
          fill: true,
          borderWidth: 2,
        });
      }
    }
    const datasets = categorySeries
      .sort((a, b) => b.finalValue - a.finalValue)
      .map(({ finalValue, ...dataset }) => dataset);
    charts.growth = renderLineChart('chartGrowth', labels, datasets, {
      legend: true,
      pointRadius: 0,
      stacked: true,
      beginAtZero: true,
      maxXTicks: 8,
      tension: 0.22,
    });
  } else {
    const primary = getThemeColor('--primary') || '#7C6FF0';
    charts.growth = renderLineChart('chartGrowth', labels, [{
      label: '총 자산', data: history.map(h => h.total), borderColor: primary,
      backgroundColor: makeGradient(canvas, primary), fill: true,
    }], { pointRadius: history.length > CHART_POINT_THRESHOLD ? 0 : 2 });
  }

  const altContainer = document.getElementById('chartGrowthAlt');
  if (altContainer) {
    const step = Math.max(1, Math.floor(history.length / 10));
    const rows = history.filter((_, i) => i % step === 0 || i === history.length - 1)
      .map(h => [fmtDate(h.date), fmtKRW(h.total)]);
    altContainer.innerHTML = chartAltTable(['날짜', '총 자산'], rows, '자산 성장 데이터');
  }
}
