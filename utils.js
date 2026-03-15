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

// ── CSV Import helpers ────────────────────────────────────────

/**
 * Keyword-to-category mapping for automatic category detection.
 * Keys are lowercase substrings; values are display category names.
 */
const CATEGORY_KEYWORDS = {
  coffee:     "Coffee",
  cafe:       "Coffee",
  starbucks:  "Coffee",
  uber:       "Taxi",
  lyft:       "Taxi",
  taxi:       "Taxi",
  bolt:       "Taxi",
  shell:      "Fuel",
  fuel:       "Fuel",
  petrol:     "Fuel",
  gas:        "Fuel",
  amazon:     "Shopping",
  shopping:   "Shopping",
  mall:       "Shopping",
  ebay:       "Shopping",
  restaurant: "Restaurants",
  burger:     "Restaurants",
  pizza:      "Restaurants",
  kfc:        "Restaurants",
  mcdonald:   "Restaurants",
  sushi:      "Restaurants",
  salary:     "Salary",
  payroll:    "Salary",
  paycheck:   "Salary",
  netflix:    "Entertainment",
  spotify:    "Entertainment",
  cinema:     "Entertainment",
  gym:        "Health",
  pharmacy:   "Health",
  hospital:   "Health",
  doctor:     "Health",
  rent:       "Rent",
  mortgage:   "Rent",
  electric:   "Utilities",
  water:      "Utilities",
  internet:   "Utilities",
  phone:      "Utilities",
};

/** Unique display-category names derived from CATEGORY_KEYWORDS values. */
const KNOWN_CATEGORY_NAMES = [...new Set(Object.values(CATEGORY_KEYWORDS))];

/**
 * Detect a category from a description string using keyword matching.
 * Returns "Other" when no keyword matches.
 * @param {string} description
 * @returns {string}
 */
export function detectCategory(description) {
  if (!description) return "Other";
  const lower = String(description).toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) return category;
  }
  return "Other";
}

/**
 * Resolve a raw category value (from an explicit "category" column) to a
 * canonical display name using case-insensitive matching.
 *
 * Resolution order:
 *   1. Direct keyword key match      (e.g. "salary"  → "Salary")
 *   2. Case-insensitive display-name match (e.g. "Coffee" → "Coffee")
 *   3. Non-empty unknown value: capitalise first letter (e.g. "food" → "Food")
 *   4. Empty / whitespace-only input → "Other"
 *
 * @param {string} raw
 * @returns {string}
 */
export function resolveCategory(raw) {
  const normalized = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!normalized) return "Other";

  // 1. Direct keyword key match (e.g. "salary" → "Salary")
  if (CATEGORY_KEYWORDS[normalized]) return CATEGORY_KEYWORDS[normalized];

  // 2. Case-insensitive match against known display names (e.g. "Coffee" → "Coffee")
  const match = KNOWN_CATEGORY_NAMES.find((n) => n.toLowerCase() === normalized);
  if (match) return match;

  // 3. Non-empty but unknown: capitalise first letter (e.g. "food" → "Food")
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Parse a CSV text string into an array of transaction objects.
 * Expected columns (case-insensitive): Date, Description, Amount
 * Any row with an invalid date or non-numeric amount is skipped.
 * @param {string} text  — raw CSV content
 * @returns {{ transactions: Array, errors: string[] }}
 */
export function parseCSVText(text) {
  const transactions = [];
  const errors = [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    errors.push("File is empty or contains no data rows.");
    return { transactions, errors };
  }

  // Parse a single CSV line respecting quoted fields
  function parseLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());

  const dateIdx     = headers.findIndex((h) => h === "date");
  const descIdx     = headers.findIndex((h) => ["description", "desc", "title", "name"].includes(h));
  const amountIdx   = headers.findIndex((h) => h === "amount");
  const typeIdx     = headers.findIndex((h) => h === "type");
  const categoryIdx = headers.findIndex((h) => h === "category");

  if (dateIdx === -1)   errors.push("Missing required column: Date");
  if (amountIdx === -1) errors.push("Missing required column: Amount");

  if (errors.length) return { transactions, errors };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const rawDate     = cols[dateIdx]     ?? "";
    const rawAmount   = cols[amountIdx]   ?? "";
    const rawDesc     = descIdx     !== -1 ? (cols[descIdx]     ?? "") : "";
    const rawCategory = categoryIdx !== -1 ? (cols[categoryIdx] ?? "") : "";
    const rawType     = typeIdx     !== -1 ? (cols[typeIdx]     ?? "") : "";

    const amount = parseNumber(rawAmount);
    if (!Number.isFinite(amount)) {
      errors.push(`Row ${i + 1}: invalid amount "${rawAmount}" — skipped.`);
      continue;
    }

    // Accept various date formats; fall back to rawDate if parsing fails
    const parsedDate = new Date(rawDate);
    const date = (!rawDate || isNaN(parsedDate.getTime()))
      ? todayISO()
      : parsedDate.toISOString().slice(0, 10);

    // Use the explicit "category" column when present, otherwise detect from description
    const trimmedCategory = rawCategory.trim();
    const category = trimmedCategory
      ? trimmedCategory
      : detectCategory(rawDesc);
    // Use the explicit "type" column when present, otherwise infer from amount sign
    const trimmedType = rawType.trim().toLowerCase();
    const type = (trimmedType === "expense" || trimmedType === "income")
      ? trimmedType
      : (amount < 0 ? "expense" : "income");

    transactions.push({ date, category, amount: Math.abs(amount), type });
  }

  return { transactions, errors };
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
