// Shared utility helpers (formatting, dates, CSV/JSON export)

export const CURRENCY = "AZN";

/**
 * Format a number as Azerbaijani Manat.
 *
 * Output example: "1,250.00 ₼"
 *
 * Why we format manually instead of using Intl currency style:
 *   style:"currency" + currency:"AZN" renders inconsistently across
 *   browsers and OS locales — some output "AZN 1,250.00", others "man.",
 *   few show "₼" at all. Hardcoding the symbol guarantees identical
 *   output everywhere and eliminates the flicker where the browser
 *   briefly shows the OS-default currency symbol before JS corrects it.
 *
 * Format rules (per requirements):
 *   • "en-US" locale → comma thousands separator, dot decimal
 *   • Exactly 2 decimal places always
 *   • ₼ symbol placed AFTER the number
 *   • Narrow no-break space (U+202F) between number and symbol
 */
export function formatCurrency(value) {
  const number = Number.isFinite(value) ? value : 0;
  const formatted = number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatted + "\u202F\u20BC"; // e.g. "1,250.00 ₼"
}

export function parseNumber(value) {
  const n = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKeyFromISO(dateISO) {
  if (!dateISO) return "";
  return dateISO.slice(0, 7); // YYYY-MM
}

export function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function downloadFile({ filename, content, mimeType }) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function toCSV(rows, { includeHeader = true } = {}) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    if (value == null) return "";
    const s = String(value);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [];
  if (includeHeader) {
    lines.push(headers.map(escape).join(","));
  }
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

/**
 * Generate smart financial insights from analytics data.
 * Returns an array of insight strings (may be empty).
 */
export function generateInsights(analytics) {
  const insights = [];
  const { byCategory, totalExpenses, totalIncome, net, walletCount } = analytics;

  // 1. Highest spending category
  const catEntries = Object.entries(byCategory || {}).sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    const [topCat, topAmt] = catEntries[0];
    const label = topCat.charAt(0).toUpperCase() + topCat.slice(1);
    insights.push(`Your highest spending category is ${label} (${formatCurrency(topAmt)}).`);
  }

  // 2. Savings rate + 3. Income vs expenses + 5. Healthy savings
  if (totalIncome > 0) {
    const savingsRate = Math.round((net / totalIncome) * 100);
    insights.push(`Your savings rate this month is ${savingsRate}%.`);

    const ratio = totalIncome / (totalExpenses || 1);
    if (ratio >= 2) {
      insights.push(`Your income is ${Math.round(ratio)}× higher than your expenses.`);
    } else if (totalExpenses > 0 && (totalExpenses / totalIncome) >= 0.85) {
      insights.push("Your expenses are close to your income this month.");
    }

    if (savingsRate > 50) {
      insights.push("Great job — you saved more than half of your income.");
    }
  }

  // 4. Wallet tracking
  if (walletCount > 0) {
    const label = walletCount === 1 ? "account" : "accounts";
    insights.push(`You are currently tracking ${walletCount} ${label}.`);
  }

  // 6. Expense warning
  if (totalExpenses > totalIncome && totalIncome >= 0) {
    insights.push("Warning: your expenses exceeded your income.");
  }

  return insights;
}