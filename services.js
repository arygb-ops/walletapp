// services.js — Supabase-backed data layer
// Transactions AND wallets/accounts now persist in Supabase.

import { supabase } from "./supabase.js";

import {
  getTransactions   as sbGetTransactions,
  addTransaction    as sbAddTransaction,
  deleteTransaction as sbDeleteTransaction,
  updateTransaction as sbUpdateTransaction,
} from "./supabase.js";

import {
  deepClone,
  formatCurrency,
  monthKeyFromISO,
  parseNumber,
  todayISO,
} from "./utils.js";

// ── Theme (still local — no DB column for it) ─────────────────
const PREF_KEY = "wallet-dashboard-prefs-v1";

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? JSON.parse(raw) : { theme: "dark" };
  } catch {
    return { theme: "dark" };
  }
}

function savePrefs(prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {}
}

export function getTheme() {
  return loadPrefs().theme === "light" ? "light" : "dark";
}

export function setTheme(theme) {
  const prefs = loadPrefs();
  prefs.theme = theme === "light" ? "light" : "dark";
  savePrefs(prefs);
}

// ── In-memory caches ──────────────────────────────────────────
let _txCache     = [];   // transaction objects from Supabase
let _walletCache = [];   // wallet/account objects from Supabase

// ── Helpers ───────────────────────────────────────────────────

/** Map Supabase transactions row → internal shape */
function normalizeTx(row) {
  return {
    id:       String(row.id),
    walletId: String(row.walletId ?? row.wallet_id ?? ""),
    title:    row.title    ?? "",
    amount:   Number(row.amount) || 0,
    type:     row.type === "income" ? "income" : "expense",
    category: row.category ?? "Uncategorised",
    date:     row.date     ?? todayISO(),
    note:     row.note     ?? "",
  };
}

/** Map Supabase accounts row → internal wallet shape */
function normalizeWallet(row) {
  return {
    id:      String(row.id),
    name:    row.name    ?? "",
    type:    row.type    ?? "other",
    balance: Number(row.balance) || 0,
    user_id: row.user_id ?? null,
  };
}

/** Get the currently authenticated user's id (null if not signed in) */
async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.id : null;
}

// ── Bootstrap ─────────────────────────────────────────────────
/**
 * Must be called once at app startup (in initApp) before anything
 * else touches wallets or transactions.
 * Returns { error } on failure.
 */
export async function loadAllTransactions() {
  // Load wallets from Supabase
  const { error: walletError } = await _loadWalletsFromDB();
  if (walletError) return { error: walletError };

  // Load transactions from Supabase
  const { data, error: txError } = await sbGetTransactions();
  if (txError) {
    console.error("[services] Failed to load transactions:", txError.message);
    return { error: txError };
  }
  _txCache = (data || []).map(normalizeTx);
  return { error: null };
}

/** Fetch all accounts for current user from Supabase into cache */
async function _loadWalletsFromDB() {
  try {
    const userId = await getCurrentUserId();
    let query = supabase.from("accounts").select("*").order("name", { ascending: true });
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;
    _walletCache = (data || []).map(normalizeWallet);
    return { error: null };
  } catch (error) {
    console.error("[services] Failed to load accounts:", error.message);
    return { error };
  }
}

// ── getState (used by export) ─────────────────────────────────
export function getState() {
  return deepClone({ wallets: _walletCache, transactions: _txCache });
}

// ── Wallets / Accounts (Supabase) ─────────────────────────────

export function listWallets() {
  return deepClone(_walletCache);
}

export async function addWallet({ name, type, startingBalance }) {
  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Wallet name is required." };

  const amount = parseNumber(startingBalance);
  if (!Number.isFinite(amount)) return { error: "Starting balance must be a number." };

  if (_walletCache.find((w) => w.name.toLowerCase() === trimmedName.toLowerCase())) {
    return { error: "A wallet with this name already exists." };
  }

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("accounts")
    .insert([{ name: trimmedName, type, balance: amount, user_id: userId }])
    .select()
    .single();

  if (error) {
    console.error("[services] addWallet:", error.message);
    return { error: `Database error: ${error.message}` };
  }

  const wallet = normalizeWallet(data);
  _walletCache.push(wallet);
  return { wallet: deepClone(wallet) };
}

export async function updateWallet(id, { name, type, startingBalance }) {
  const cached = _walletCache.find((w) => w.id === id);
  if (!cached) return { error: "Wallet not found." };

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Wallet name is required." };

  const amount = parseNumber(startingBalance);
  if (!Number.isFinite(amount)) return { error: "Starting balance must be a number." };

  if (_walletCache.find((w) => w.id !== id && w.name.toLowerCase() === trimmedName.toLowerCase())) {
    return { error: "Another wallet with this name already exists." };
  }

  const { data, error } = await supabase
    .from("accounts")
    .update({ name: trimmedName, type, balance: amount })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[services] updateWallet:", error.message);
    return { error: `Database error: ${error.message}` };
  }

  // Update cache in-place
  Object.assign(cached, normalizeWallet(data));
  return { wallet: deepClone(cached) };
}

export async function deleteWallet(id) {
  if (_txCache.some((t) => t.walletId === id)) {
    return { error: "This wallet has transactions. Delete or reassign those first." };
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[services] deleteWallet:", error.message);
    return { error: `Database error: ${error.message}` };
  }

  _walletCache = _walletCache.filter((w) => w.id !== id);
  return { success: true };
}

export function findWallet(id) {
  return deepClone(_walletCache.find((w) => w.id === id) || null);
}

/** Sync a wallet's balance to Supabase (used internally after transactions) */
async function _syncWalletBalance(wallet) {
  await supabase
    .from("accounts")
    .update({ balance: wallet.balance })
    .eq("id", wallet.id);
}

// ── Transactions ──────────────────────────────────────────────

export function listTransactions() {
  return deepClone(_txCache);
}

export async function createTransaction({ walletId, type, amount, category, date, note }) {
  const wallet = _walletCache.find((w) => w.id === walletId);
  if (!wallet) return { error: "Wallet is required." };

  const numericAmount = parseNumber(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { error: "Amount must be a positive number." };
  }

  const trimmedCategory = (category || "").trim();
  if (!trimmedCategory) return { error: "Category is required." };

  const dateISO = date || todayISO();

  if (type === "expense" && wallet.balance < numericAmount) {
    return { error: `Expense exceeds wallet balance (${formatCurrency(wallet.balance)}).` };
  }

  const title = trimmedCategory;
  const { data, error } = await sbAddTransaction(
    title, numericAmount, trimmedCategory,
    type === "income" ? "income" : "expense",
    dateISO
  );

  if (error) return { error: `Database error: ${error.message}` };

  // Update wallet balance locally then sync to DB
  if (type === "income")  wallet.balance += numericAmount;
  if (type === "expense") wallet.balance -= numericAmount;
  await _syncWalletBalance(wallet);

  const tx = normalizeTx({ ...data, walletId, note: (note || "").trim() });
  _txCache.unshift(tx);

  return { transaction: deepClone(tx), wallet: deepClone(wallet) };
}

export async function deleteTransaction(id) {
  const tx = _txCache.find((t) => t.id === id);
  if (!tx) return { error: "Transaction not found." };

  const { error } = await sbDeleteTransaction(id);
  if (error) return { error: `Database error: ${error.message}` };

  // Reverse wallet balance effect
  const wallet = _walletCache.find((w) => w.id === tx.walletId);
  if (wallet) {
    if (tx.type === "income")  wallet.balance -= tx.amount;
    if (tx.type === "expense") wallet.balance += tx.amount;
    await _syncWalletBalance(wallet);
  }

  _txCache = _txCache.filter((t) => t.id !== id);
  return { success: true };
}

export async function updateTransaction(id, { amount, category, date, note, type }) {
  const tx = _txCache.find((t) => t.id === id);
  if (!tx) return { error: "Transaction not found." };

  const wallet = _walletCache.find((w) => w.id === tx.walletId);
  if (!wallet) return { error: "Associated wallet not found." };

  const newAmount = parseNumber(amount);
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return { error: "Amount must be a positive number." };
  }

  const trimmedCategory = (category || "").trim();
  if (!trimmedCategory) return { error: "Category is required." };

  const newType = type === "income" ? "income" : "expense";

  // Temporarily reverse old balance effect to check headroom
  if (tx.type === "income")  wallet.balance -= tx.amount;
  if (tx.type === "expense") wallet.balance += tx.amount;

  if (newType === "expense" && wallet.balance < newAmount) {
    // Restore before returning error
    if (tx.type === "income")  wallet.balance += tx.amount;
    if (tx.type === "expense") wallet.balance -= tx.amount;
    return { error: "Expense exceeds wallet balance." };
  }

  const updatedFields = {
    title:    trimmedCategory,
    amount:   newAmount,
    category: trimmedCategory,
    type:     newType,
    date:     date || tx.date,
    note:     (note || "").trim(),
  };

  const { data, error } = await sbUpdateTransaction(id, updatedFields);
  if (error) {
    // Restore balance before returning
    if (tx.type === "income")  wallet.balance += tx.amount;
    if (tx.type === "expense") wallet.balance -= tx.amount;
    return { error: `Database error: ${error.message}` };
  }

  // Apply new balance effect then sync
  if (newType === "income")  wallet.balance += newAmount;
  if (newType === "expense") wallet.balance -= newAmount;
  await _syncWalletBalance(wallet);

  Object.assign(tx, normalizeTx({ ...data, walletId: tx.walletId }));

  return { transaction: deepClone(tx), wallet: deepClone(wallet) };
}

// ── Analytics ─────────────────────────────────────────────────

export function computeAnalytics() {
  const wallets      = _walletCache;
  const transactions = _txCache;

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const walletCount  = wallets.length;
  const avgBalance   = walletCount ? totalBalance / walletCount : 0;

  const byType = wallets.reduce(
    (acc, w) => { acc[w.type] = (acc[w.type] || 0) + w.balance; return acc; },
    { bank: 0, cash: 0, crypto: 0, other: 0 }
  );

  let totalIncome = 0, totalExpenses = 0;
  const byCategory = {}, byWalletSpending = {}, byMonth = {};

  for (const tx of transactions) {
    const monthKey = monthKeyFromISO(tx.date);
    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };

    if (tx.type === "income") {
      totalIncome += tx.amount;
      byMonth[monthKey].income += tx.amount;
    } else if (tx.type === "expense") {
      totalExpenses += tx.amount;
      byMonth[monthKey].expense += tx.amount;

      const catKey = tx.category.toLowerCase();
      byCategory[catKey] = (byCategory[catKey] || 0) + tx.amount;

      const wallet = _walletCache.find((w) => w.id === tx.walletId);
      const walletName = wallet ? wallet.name : "Unknown";
      byWalletSpending[walletName] = (byWalletSpending[walletName] || 0) + tx.amount;
    }
  }

  return {
    totalBalance, walletCount, avgBalance, byType,
    totalIncome, totalExpenses, net: totalIncome - totalExpenses,
    byCategory, byWalletSpending, byMonth,
  };
}