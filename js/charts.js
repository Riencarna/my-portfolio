/* charts.js - Chart.js 차트 렌더링 (v2.6.0) */

function destroyAllCharts() {
  for (var key in charts) {
    if (key === 'catPies') {
      for (var ck in charts.catPies) {
        try { if (charts.catPies[ck]) charts.catPies[ck].destroy(); } catch(e) {}
      }
      charts.catPies = {};
    } else {
      try { if (charts[key]) charts[key].destroy(); } catch(e) {}
      charts[key] = null;
    }
  }
}

function drawPie(data, total) {
  var ctx = document.getElementById("cPie");
  if (!ctx) return;

  var lb = data.map(function(d) { return d.ic + " " + d.n; });
  var dv = data.map(function(d) { return d.v; });
  var bg = data.map(function(d) { return d.c; });

  if (charts.pie && charts.pie.canvas === ctx) {
    try {
      charts.pie.data.labels = lb;
      charts.pie.data.datasets[0].data = dv;
      charts.pie.data.datasets[0].backgroundColor = bg;
      charts.pie.options.plugins.tooltip.callbacks.label = function(c) {
        return c.label + ": " + formatNumber(c.raw) + " (" + ((c.raw / total) * 100).toFixed(1) + "%)";
      };
      charts.pie.update("none");
      return;
    } catch(e) {}
  }

  try { if (charts.pie) charts.pie.destroy(); } catch(e) {}
  charts.pie = null;

  charts.pie = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: lb,
      datasets: [{
        data: dv,
        backgroundColor: bg,
        borderWidth: 0,
        spacing: 2
      }]
    },
    options: {
      cutout: "62%",
      responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1A1D23",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          titleFont: { family: "Pretendard Variable", size: 12 },
          bodyFont: { family: "Pretendard Variable", size: 12 },
          callbacks: {
            label: function(c) {
              return c.label + ": " + formatNumber(c.raw) + " (" + ((c.raw / total) * 100).toFixed(1) + "%)";
            }
          }
        }
      }
    },
    plugins: [{
      id: "ct",
      afterDraw: function(ch) {
        var c = ch.ctx, w = ch.width, hh = ch.height;
        c.save();
        c.textAlign = "center";
        c.fillStyle = "#94A3B8";
        c.font = "10px Pretendard Variable";
        c.fillText("총 자산", w / 2, hh / 2 - 5);
        c.fillStyle = "#F1F5F9";
        c.font = "bold 13px Pretendard Variable";
        c.fillText(formatShortCurrency(total), w / 2, hh / 2 + 11);
        c.restore();
      }
    }]
  });
}

function drawCatPie(id, items, total, colors) {
  var ctx = document.getElementById(id);
  if (!ctx) return;

  var lb = items.map(function(d) { return d.name; });
  var dv = items.map(function(d) { return d.v; });
  var bg = items.map(function(d, i) { return colors[i % colors.length]; });

  if (charts.catPies[id] && charts.catPies[id].canvas === ctx) {
    try {
      charts.catPies[id].data.labels = lb;
      charts.catPies[id].data.datasets[0].data = dv;
      charts.catPies[id].data.datasets[0].backgroundColor = bg;
      charts.catPies[id].update("none");
      return;
    } catch(e) {}
  }

  try { if (charts.catPies[id]) charts.catPies[id].destroy(); } catch(e) {}
  charts.catPies[id] = null;

  charts.catPies[id] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: lb,
      datasets: [{
        data: dv,
        backgroundColor: bg,
        borderWidth: 0,
        spacing: 2
      }]
    },
    options: {
      cutout: "58%",
      responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1A1D23",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          titleFont: { family: "Pretendard Variable", size: 11 },
          bodyFont: { family: "Pretendard Variable", size: 11 },
          callbacks: {
            label: function(c) {
              return c.label + ": " + formatShortCurrency(c.raw) + " (" + ((c.raw / total) * 100).toFixed(1) + "%)";
            }
          }
        }
      }
    },
    plugins: [{
      id: "ct2",
      afterDraw: function(ch) {
        var c = ch.ctx, w = ch.width, hh = ch.height;
        c.save();
        c.textAlign = "center";
        c.fillStyle = "#94A3B8";
        c.font = "9px Pretendard Variable";
        c.fillText(items.length + "종목", w / 2, hh / 2 - 4);
        c.fillStyle = "#F1F5F9";
        c.font = "bold 11px Pretendard Variable";
        c.fillText(formatShortCurrency(total), w / 2, hh / 2 + 10);
        c.restore();
      }
    }]
  });
}

function drawLine(id, data, h) {
  var ctx = document.getElementById(id);
  if (!ctx) return;

  var key = id === "cL1" ? "l1" : "l2";
  var lb = data.map(function(d) { return d.d; });
  var dv = data.map(function(d) { return d.v; });

  if (charts[key] && charts[key].canvas === ctx) {
    try {
      charts[key].data.labels = lb;
      charts[key].data.datasets[0].data = dv;
      charts[key].update("none");
      return;
    } catch(e) {}
  }

  try { if (charts[key]) charts[key].destroy(); } catch(e) {}
  charts[key] = null;

  var g = ctx.getContext("2d").createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(59,130,246,.2)");
  g.addColorStop(1, "rgba(59,130,246,0)");

  charts[key] = new Chart(ctx, {
    type: "line",
    data: {
      labels: lb,
      datasets: [{
        data: dv,
        borderColor: "#3B82F6",
        borderWidth: 2.5,
        backgroundColor: g,
        fill: true,
        pointRadius: data.length > 15 ? 2 : 3,
        pointBackgroundColor: "#3B82F6",
        tension: .35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.03)" },
          ticks: {
            color: "#475569",
            font: { size: 10, family: "Pretendard Variable" }
          },
          border: { display: false }
        },
        y: {
          grid: { color: "rgba(255,255,255,.03)" },
          ticks: {
            color: "#475569",
            font: { size: 10, family: "Pretendard Variable" },
            callback: function(v) { return formatShortCurrency(v); }
          },
          border: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1A1D23",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          titleFont: { family: "Pretendard Variable" },
          bodyFont: { family: "Pretendard Variable" },
          callbacks: {
            label: function(c) { return formatNumber(c.raw); }
          }
        }
      }
    }
  });
}

/* --- Growth Chart (multi-line with categories) --- */

function drawGrowthChart(id, historyData, h, showCategories) {
  var ctx = document.getElementById(id);
  if (!ctx) return;

  if (charts.growth) { try { charts.growth.destroy(); } catch(e) {} }
  charts.growth = null;

  var labels = historyData.map(function(d) { return d.date.slice(5); });
  var totalData = historyData.map(function(d) { return d.total; });

  var g = ctx.getContext("2d").createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(59,130,246,.15)");
  g.addColorStop(1, "rgba(59,130,246,0)");

  var datasets = [{
    label: "총 자산",
    data: totalData,
    borderColor: "#3B82F6",
    borderWidth: 2.5,
    backgroundColor: g,
    fill: true,
    pointRadius: historyData.length > 30 ? 0 : 2,
    pointBackgroundColor: "#3B82F6",
    tension: .35,
    order: 0
  }];

  if (showCategories) {
    var cats = {};
    historyData.forEach(function(d) {
      if (!d.byCategory) return;
      for (var c in d.byCategory) {
        if (!cats[c]) cats[c] = [];
      }
    });

    var catNames = Object.keys(cats);
    catNames.forEach(function(cat) {
      var cfg = CATEGORY_CONFIG[cat];
      if (!cfg) return;
      var catValues = historyData.map(function(d) {
        return d.byCategory && d.byCategory[cat] ? d.byCategory[cat] : 0;
      });
      if (catValues.every(function(v) { return v === 0; })) return;

      datasets.push({
        label: (cfg.icon || "") + " " + cat,
        data: catValues,
        borderColor: cfg.color,
        borderWidth: 1.5,
        borderDash: [4, 3],
        fill: false,
        pointRadius: 0,
        tension: .35,
        order: 1
      });
    });
  }

  charts.growth = new Chart(ctx, {
    type: "line",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.03)" },
          ticks: { color: "#475569", font: { size: 10, family: "Pretendard Variable" }, maxTicksLimit: 10 },
          border: { display: false }
        },
        y: {
          grid: { color: "rgba(255,255,255,.03)" },
          ticks: { color: "#475569", font: { size: 10, family: "Pretendard Variable" }, callback: function(v) { return formatShortCurrency(v); } },
          border: { display: false }
        }
      },
      plugins: {
        legend: { display: showCategories, position: "bottom", labels: { color: "#94A3B8", font: { size: 10, family: "Pretendard Variable" }, boxWidth: 12, padding: 8 } },
        tooltip: {
          backgroundColor: "#1A1D23", borderColor: "rgba(255,255,255,.1)", borderWidth: 1,
          titleFont: { family: "Pretendard Variable" }, bodyFont: { family: "Pretendard Variable" },
          callbacks: { label: function(c) { return c.dataset.label + ": " + formatNumber(c.raw); } }
        }
      }
    }
  });
}
