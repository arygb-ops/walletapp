// Chart.js integration and updates

import { formatCurrency } from "./utils.js";

let categoryChart;
let monthlyChart;
let walletChart;
let analyticsMonthlyChart;
let analyticsCategoryChart;
let netWorthChart;
let savingsRateChart;

export function initCharts(analytics, transactions = []) {
  if (!window.Chart) return;

  // Store raw transactions for per-month category filtering
  _rawTransactions = transactions;

  const categoryCtx = document.getElementById("chart-category");
  const monthlyCtx = document.getElementById("chart-monthly");
  const walletCtx = document.getElementById("chart-wallets");

  const categoryData = toCategoryData(analytics.byCategory);
  const monthlyData = toMonthlyData(analytics.byMonth);
  const walletData = toWalletData(analytics.byWalletSpending);

  if (categoryCtx) categoryChart = new Chart(categoryCtx, {
    type: "pie",
    data: {
      labels: categoryData.labels,
      datasets: [
        {
          label: "Spending by category",
          data: categoryData.values,
          backgroundColor: categoryData.colors,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          align: "center",
          labels: {
            color: "#e2e8f0",
            usePointStyle: true,
            boxWidth: 8,
            padding: 16,
            font: {
              family: "DM Sans, system-ui, -apple-system, sans-serif",
              size: 11,
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(13,17,23,0.97)",
          borderColor: "rgba(99,179,237,0.35)",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          callbacks: {
            label: (ctx) =>
              `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
      layout: {
        padding: {
          top: 4,
          right: 12,
          bottom: 4,
          left: 12,
        },
      },
      maintainAspectRatio: false,
    },
  });

  if (monthlyCtx) monthlyChart = new Chart(monthlyCtx, {
    type: "bar",
    data: {
      labels: monthlyData.labels,
      datasets: [
        {
          label: "Income",
          data: monthlyData.income,
          backgroundColor: "rgba(8, 136, 89, 0.88)",
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 32,
        },
        {
          label: "Expenses",
          data: monthlyData.expense,
          backgroundColor: "rgba(248, 113, 113, 0.90)",
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 32,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 8,
          right: 16,
          left: 4,
          bottom: 0,
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#64748b",
            padding: 6,
            font: {
              family: "DM Sans, system-ui, -apple-system, sans-serif",
              size: 11,
            },
          },
          grid: {
            display: false,
            drawBorder: false,
          },
        },
        y: {
          ticks: {
            color: "#64748b",
            padding: 6,
            font: {
              family: "DM Sans, system-ui, -apple-system, sans-serif",
              size: 11,
            },
            callback: (value) => formatCurrency(value),
          },
          grid: {
            color: "rgba(99,179,237,0.09)",
            drawBorder: false,
            borderDash: [4, 4],
          },
        },
      },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            color: "#e2e8f0",
            usePointStyle: true,
            boxWidth: 8,
            padding: 12,
            font: {
              family: "DM Sans, system-ui, -apple-system, sans-serif",
              size: 11,
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(13,17,23,0.97)",
          borderColor: "rgba(99,179,237,0.35)",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
    },
  });

  if (walletCtx) walletChart = new Chart(walletCtx, {
    type: "doughnut",
    data: {
      labels: walletData.labels,
      datasets: [
        {
          label: "Wallet distribution",
          data: walletData.values,
          backgroundColor: walletData.colors,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          align: "center",
          labels: {
            color: "#e2e8f0",
            usePointStyle: true,
            boxWidth: 8,
            padding: 16,
            font: {
              family: "DM Sans, system-ui, -apple-system, sans-serif",
              size: 11,
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(13,17,23,0.97)",
          borderColor: "rgba(99,179,237,0.35)",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          callbacks: {
            label: (ctx) =>
              `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
      cutout: "55%",
      layout: {
        padding: {
          top: 4,
          right: 12,
          bottom: 4,
          left: 12,
        },
      },
      maintainAspectRatio: false,
    },
  });

  // ── Analytics page charts ────────────────────────────────────
  const analyticsMonthlyCtx = document.getElementById("chart-monthly-2");
  const analyticsCategoryCtx = document.getElementById("chart-category-2");
  const netWorthCtx = document.getElementById("chart-networth");
  const savingsRateCtx = document.getElementById("chart-savings-rate");

  const netWorthData = toNetWorthData(analytics.byMonth, analytics.totalBalance);
  const savingsData = toSavingsRateData(analytics.byMonth);

  // ── Net Worth Trend (line) ──────────────────────────────────
  if (netWorthCtx) {
    const nwGradient = netWorthCtx.getContext("2d").createLinearGradient(0, 0, 0, 340);
    nwGradient.addColorStop(0, "rgba(96,165,250,0.35)");
    nwGradient.addColorStop(1, "rgba(96,165,250,0.03)");
    netWorthChart = new Chart(netWorthCtx, {
      type: "line",
      data: {
        labels: netWorthData.labels,
        datasets: [{
          label: "Net Worth",
          data: netWorthData.values,
          borderColor: "#60A5FA",
          backgroundColor: nwGradient,
          fill: true,
          tension: 0.45,
          pointBackgroundColor: "#93C5FD",
          pointBorderColor: "#0d1117",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 900, easing: "easeInOutQuart" },
        layout: { padding: { top: 8, right: 16, left: 4, bottom: 0 } },
        scales: {
          x: {
            ticks: { color: "rgba(226,232,240,0.7)", padding: 6, font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 } },
            grid: { display: false, drawBorder: false },
          },
          y: {
            ticks: { color: "rgba(226,232,240,0.7)", padding: 6, font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 }, callback: (v) => formatCurrency(v) },
            grid: { color: "rgba(255,255,255,0.06)", drawBorder: false, borderDash: [4, 4] },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(13,17,23,0.97)",
            borderColor: "rgba(96,165,250,0.35)",
            borderWidth: 1, padding: 10,
            titleColor: "#e2e8f0", bodyColor: "#94a3b8",
            callbacks: { label: (ctx) => `Net Worth: ${formatCurrency(ctx.parsed.y)}` },
          },
        },
      },
    });
  }

  // ── Income vs Expenses (bar) ────────────────────────────────
  if (analyticsMonthlyCtx) {
    analyticsMonthlyChart = new Chart(analyticsMonthlyCtx, {
      type: "bar",
      data: {
        labels: monthlyData.labels,
        datasets: [
          {
            label: "Income",
            data: monthlyData.income,
            backgroundColor: "#34D399",
            hoverBackgroundColor: "#10B981",
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 40,
          },
          {
            label: "Expenses",
            data: monthlyData.expense,
            backgroundColor: "#F87171",
            hoverBackgroundColor: "#EF4444",
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 900, easing: "easeInOutQuart" },
        layout: { padding: { top: 8, right: 16, left: 4, bottom: 0 } },
        scales: {
          x: {
            ticks: { color: "rgba(226,232,240,0.7)", padding: 6, font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 } },
            grid: { display: false, drawBorder: false },
          },
          y: {
            ticks: { color: "rgba(226,232,240,0.7)", padding: 6, font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 }, callback: (v) => formatCurrency(v) },
            grid: { color: "rgba(255,255,255,0.06)", drawBorder: false, borderDash: [4, 4] },
          },
        },
        plugins: {
          legend: {
            position: "top", align: "end",
            labels: {
              color: "#e2e8f0", usePointStyle: true, boxWidth: 8, padding: 12,
              font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 },
              generateLabels: (chart) => chart.data.datasets.map((ds, i) => ({
                text: ds.label, fillStyle: ds.backgroundColor, strokeStyle: ds.backgroundColor,
                pointStyle: "circle", hidden: !chart.isDatasetVisible(i), datasetIndex: i,
              })),
            },
          },
          tooltip: {
            backgroundColor: "rgba(13,17,23,0.97)",
            borderColor: "rgba(96,165,250,0.35)",
            borderWidth: 1, padding: 10,
            titleColor: "#e2e8f0", bodyColor: "#94a3b8",
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
          },
        },
      },
    });
  }

  // ── Spending by Category (donut) ────────────────────────────
  if (analyticsCategoryCtx) {
    // Center text plugin (scoped to this chart)
    const centerTextPlugin = {
      id: "centerText",
      afterDraw(chart) {
        if (chart.config.type !== "doughnut") return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const total = chart.config.data.datasets[0].data.reduce((s, v) => s + v, 0);
        if (!total) return;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "700 15px 'DM Sans', system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(formatCurrency(total), cx, cy - 9);
        ctx.font = "500 10px 'DM Sans', system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText("Total Spending", cx, cy + 9);
        ctx.restore();
      },
    };

    analyticsCategoryChart = new Chart(analyticsCategoryCtx, {
      type: "doughnut",
      plugins: [centerTextPlugin],
      data: {
        labels: categoryData.labels,
        datasets: [{
          label: "Spending by category",
          data: categoryData.values,
          backgroundColor: categoryData.colors,
          borderColor: "rgba(13,17,23,0.8)",
          borderWidth: 2,
        }],
      },
      options: {
        cutout: "55%",
        plugins: {
          legend: {
            position: "bottom", align: "center",
            labels: {
              color: "#e2e8f0", usePointStyle: true, boxWidth: 8, padding: 16,
              font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 }
            },
          },
          tooltip: {
            backgroundColor: "rgba(13,17,23,0.97)",
            borderColor: "rgba(96,165,250,0.35)",
            borderWidth: 1, padding: 10,
            titleColor: "#e2e8f0", bodyColor: "#94a3b8",
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                return [`${formatCurrency(ctx.parsed)}`, `${pct}% of total`];
              },
            },
          },
        },
        layout: { padding: { top: 4, right: 12, bottom: 4, left: 12 } },
        maintainAspectRatio: false,
      },
    });

    // Wire up the year/month filter controls
    _initCategoryFilter(analytics);
  }

  // ── Savings Rate (line, %) ──────────────────────────────────
  if (savingsRateCtx) {
    const srGradient = savingsRateCtx.getContext("2d").createLinearGradient(0, 0, 0, 340);
    srGradient.addColorStop(0, "rgba(52,211,153,0.35)");
    srGradient.addColorStop(1, "rgba(52,211,153,0.05)");
    savingsRateChart = new Chart(savingsRateCtx, {
      type: "line",
      data: {
        labels: savingsData.labels,
        datasets: [{
          label: "Savings Rate",
          data: savingsData.values,
          borderColor: "#34D399",
          backgroundColor: srGradient,
          fill: true,
          tension: 0.45,
          pointBackgroundColor: "#34D399",
          pointBorderColor: "#0d1117",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 900, easing: "easeInOutQuart" },
        layout: { padding: { top: 8, right: 16, left: 4, bottom: 0 } },
        scales: {
          x: {
            ticks: { color: "rgba(226,232,240,0.7)", padding: 6, font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 } },
            grid: { display: false, drawBorder: false },
          },
          y: {
            min: -100,
            max: 100,
            ticks: { color: "rgba(226,232,240,0.7)", padding: 6, font: { family: "DM Sans, system-ui, -apple-system, sans-serif", size: 11 }, callback: (v) => v + "%" },
            grid: { color: "rgba(255,255,255,0.06)", drawBorder: false, borderDash: [4, 4] },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(13,17,23,0.97)",
            borderColor: "rgba(52,211,153,0.35)",
            borderWidth: 1, padding: 10,
            titleColor: "#e2e8f0", bodyColor: "#94a3b8",
            callbacks: { label: (ctx) => `Savings Rate: ${ctx.parsed.y.toFixed(1)}%` },
          },
        },
      },
    });
  }
}

// ── Category filter state ─────────────────────────────────────
let _catFilterYear  = null;
let _catFilterMonth = null;
let _cachedAnalytics = null;

function _initCategoryFilter(analytics) {
  _cachedAnalytics = analytics;

  // Populate year dropdown from available months
  const yearSelect = document.getElementById("cat-year-select");
  if (!yearSelect) return;

  const years = _getAvailableYears(analytics);
  const now   = new Date();
  const curYear  = String(now.getFullYear());
  const curMonth = String(now.getMonth() + 1).padStart(2, "0");

  // Default selection: current year/month (or latest available)
  _catFilterYear  = years.includes(curYear)  ? curYear  : (years[years.length - 1] || curYear);
  _catFilterMonth = curMonth;

  // Build year options
  yearSelect.innerHTML = years.map(y =>
    `<option value="${y}" ${y === _catFilterYear ? "selected" : ""}>${y}</option>`
  ).join("");

  // Year change
  yearSelect.addEventListener("change", () => {
    _catFilterYear = yearSelect.value;
    _applyCategoryFilter();
  });

  // Month tabs
  const tabs = document.getElementById("cat-month-tabs");
  if (tabs) {
    tabs.querySelectorAll(".cat-month-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        _catFilterMonth = btn.dataset.month;
        _applyCategoryFilter();
      });
    });
  }

  _applyCategoryFilter();
}

function _getAvailableYears(analytics) {
  const keys = Object.keys(analytics.byMonth || {});
  const yearSet = new Set(keys.map(k => k.slice(0, 4)));
  const now = String(new Date().getFullYear());
  yearSet.add(now);
  return [...yearSet].sort();
}

function _applyCategoryFilter() {
  if (!analyticsCategoryChart || !_cachedAnalytics) return;

  // Highlight active month tab
  document.querySelectorAll(".cat-month-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.month === _catFilterMonth);
  });

  // Filter transactions for selected year+month
  const key = `${_catFilterYear}-${_catFilterMonth}`;
  const monthData = _cachedAnalytics.byMonth[key];

  let byCategory = {};
  if (monthData && monthData.byCategory) {
    byCategory = monthData.byCategory;
  } else if (monthData) {
    // Fall back: use global byCategory filtered approach
    byCategory = _filterCategoryForMonth(_catFilterYear, _catFilterMonth);
  } else {
    byCategory = _filterCategoryForMonth(_catFilterYear, _catFilterMonth);
  }

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const labels  = entries.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  const values  = entries.map(([, v]) => v);
  const colors  = generateColors(values.length);

  analyticsCategoryChart.data.labels = labels;
  analyticsCategoryChart.data.datasets[0].data   = values;
  analyticsCategoryChart.data.datasets[0].backgroundColor = colors;
  analyticsCategoryChart.update();
}

// Access raw transactions via a stored reference set during updateCharts
let _rawTransactions = [];

function _filterCategoryForMonth(year, month) {
  const prefix = `${year}-${month}`;
  const byCategory = {};
  for (const tx of _rawTransactions) {
    if (tx.type !== "expense") continue;
    if (!tx.date || !tx.date.startsWith(prefix)) continue;
    const cat = (tx.category || "other").toLowerCase();
    byCategory[cat] = (byCategory[cat] || 0) + tx.amount;
  }
  return byCategory;
}

export function updateCharts(analytics, transactions = []) {
  if (!window.Chart) return;

  // Store raw transactions for per-month filtering
  _rawTransactions = transactions;
  _cachedAnalytics = analytics;

  const categoryData = toCategoryData(analytics.byCategory);
  const monthlyData = toMonthlyData(analytics.byMonth);
  const walletData = toWalletData(analytics.byWalletSpending);

  if (categoryChart) {
    categoryChart.data.labels = categoryData.labels;
    categoryChart.data.datasets[0].data = categoryData.values;
    categoryChart.data.datasets[0].backgroundColor = categoryData.colors;
    categoryChart.update();
  }

  if (monthlyChart) {
    monthlyChart.data.labels = monthlyData.labels;
    monthlyChart.data.datasets[0].data = monthlyData.income;
    monthlyChart.data.datasets[1].data = monthlyData.expense;
    monthlyChart.update();
  }

  if (walletChart) {
    walletChart.data.labels = walletData.labels;
    walletChart.data.datasets[0].data = walletData.values;
    walletChart.data.datasets[0].backgroundColor = walletData.colors;
    walletChart.update();
  }

  const netWorthData = toNetWorthData(analytics.byMonth, analytics.totalBalance);
  const savingsData = toSavingsRateData(analytics.byMonth);

  if (netWorthChart) {
    netWorthChart.data.labels = netWorthData.labels;
    netWorthChart.data.datasets[0].data = netWorthData.values;
    netWorthChart.update();
  }

  if (analyticsMonthlyChart) {
    analyticsMonthlyChart.data.labels = monthlyData.labels;
    analyticsMonthlyChart.data.datasets[0].data = monthlyData.income;
    analyticsMonthlyChart.data.datasets[1].data = monthlyData.expense;
    analyticsMonthlyChart.update();
  }

  if (analyticsCategoryChart) {
    // Refresh year options if needed, then re-apply filter
    const yearSelect = document.getElementById("cat-year-select");
    if (yearSelect) {
      const years = _getAvailableYears(analytics);
      yearSelect.innerHTML = years.map(y =>
        `<option value="${y}" ${y === _catFilterYear ? "selected" : ""}>${y}</option>`
      ).join("");
    }
    _applyCategoryFilter();
  }

  if (savingsRateChart) {
    savingsRateChart.data.labels = savingsData.labels;
    savingsRateChart.data.datasets[0].data = savingsData.values;
    savingsRateChart.update();
  }
}

function toCategoryData(byCategory) {
  const entries = Object.entries(byCategory || {}).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([key]) => key);
  const values = entries.map(([, value]) => value);
  const colors = generateColors(values.length);
  return { labels, values, colors };
}

function toMonthlyData(byMonth) {
  const keys = Object.keys(byMonth || {}).sort();
  const income = keys.map((k) => byMonth[k].income || 0);
  const expense = keys.map((k) => byMonth[k].expense || 0);
  return { labels: keys, income, expense };
}

function toWalletData(byWalletSpending) {
  const entries = Object.entries(byWalletSpending || {}).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([name]) => name);
  const values = entries.map(([, value]) => value);
  const colors = generateColors(values.length);
  return { labels, values, colors };
}

/** Net Worth per month: work backwards from current totalBalance */
function toNetWorthData(byMonth, totalBalance) {
  const keys = Object.keys(byMonth || {}).sort();
  if (!keys.length) return { labels: [], values: [] };

  // Compute cumulative net per month in chronological order
  const monthlyNet = keys.map((k) => (byMonth[k].income || 0) - (byMonth[k].expense || 0));
  const totalNet = monthlyNet.reduce((s, v) => s + v, 0);

  // The balance before the first recorded month
  const baseBalance = totalBalance - totalNet;

  const values = [];
  let running = baseBalance;
  for (const net of monthlyNet) {
    running += net;
    values.push(Math.round(running * 100) / 100);
  }

  return { labels: keys, values };
}

/** Savings rate per month: (income - expense) / income * 100 */
function toSavingsRateData(byMonth) {
  const keys = Object.keys(byMonth || {}).sort();
  const values = keys.map((k) => {
    const inc = byMonth[k].income || 0;
    const exp = byMonth[k].expense || 0;
    if (inc === 0) return 0;
    return Math.round(((inc - exp) / inc) * 1000) / 10;  // one decimal
  });
  return { labels: keys, values };
}

function generateColors(count) {
  const baseColors = [
    "#60A5FA",
    "#34D399",
    "#FBBF24",
    "#A78BFA",
    "#22D3EE",
    "#F87171",
  ];
  if (count <= baseColors.length) return baseColors.slice(0, count);
  const colors = [];
  for (let i = 0; i < count; i += 1) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}