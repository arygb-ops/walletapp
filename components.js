// Components: DOM wiring for wallets, transactions, dashboard, theme, export

import {
  computeAnalytics,
  createTransaction,
  addWallet,
  deleteWallet,
  deleteTransaction,
  updateTransaction,
  findWallet,
  getState,
  getTheme,
  listTransactions,
  listWallets,
  loadAllTransactions,
  setTheme,
  updateWallet,
} from "./services.js";

import { downloadFile, formatCurrency, generateInsights, toCSV, todayISO } from "./utils.js";
import { initCharts, updateCharts } from "./charts.js";

export async function initApp() {
  const els = queryElements();
  applyInitialTheme(els);
  wireThemeToggle(els);
  wireExport(els);

  // Show loading state while fetching from Supabase
  showLoadingState(els);

  const { error } = await loadAllTransactions();
  if (error) {
    showDbError(els, error);
    return;
  }

  hideLoadingState(els);

  renderWallets(els);
  syncWalletSelects(els);

  wireWalletForm(els);
  wireWalletList(els);

  wireTransactionForm(els);
  wireTransactionFilters(els);
  renderTransactions(els);
  renderRecentTransactions(els);

  const analytics = computeAnalytics();
  renderAnalytics(els, analytics);
  revealCurrencyElements(); // remove loading opacity now that correct ₼ values are written
  initCharts(analytics, listTransactions());

  // Inject edit modal + toast into DOM
  injectEditModal();
  injectToast();
  injectDeleteConfirmModal();
  wireEditModal(els);
  wireDeleteConfirmModal(els);
}

function queryElements() {
  return {
    body: document.body,
    walletId: document.getElementById("wallet-id"),
    walletForm: document.getElementById("wallet-form"),
    walletName: document.getElementById("wallet-name"),
    walletType: document.getElementById("wallet-type"),
    walletBalance: document.getElementById("wallet-balance"),
    walletList: document.getElementById("wallet-list"),
    walletSubmitButton: document.getElementById("wallet-submit-button"),
    walletCancelEdit: document.getElementById("wallet-cancel-edit"),
    walletError: document.getElementById("wallet-error"),
    transactionForm: document.getElementById("transaction-form"),
    transactionWallet: document.getElementById("transaction-wallet"),
    transactionType: document.getElementById("transaction-type"),
    transactionAmount: document.getElementById("transaction-amount"),
    transactionCategory: document.getElementById("transaction-category"),
    transactionDate: document.getElementById("transaction-date"),
    transactionNote: document.getElementById("transaction-note"),
    transactionError: document.getElementById("transaction-error"),
    transactionsTableBody: document.getElementById("transactions-tbody"),
    transactionsEmpty: document.getElementById("transactions-empty"),
    recentTransactionsList: document.getElementById("recent-transactions-list"),
    filterWallet: document.getElementById("filter-wallet"),
    filterType: document.getElementById("filter-type"),
    filterCategory: document.getElementById("filter-category"),
    filterDateFrom: document.getElementById("filter-date-from"),
    filterDateTo: document.getElementById("filter-date-to"),
    totalBalance: document.getElementById("total-balance"),
    walletCount: document.getElementById("wallet-count"),
    avgBalance: document.getElementById("avg-balance"),
    sumBank: document.getElementById("sum-bank"),
    sumCash: document.getElementById("sum-cash"),
    sumCrypto: document.getElementById("sum-crypto"),
    sumOther: document.getElementById("sum-other"),
    totalIncome: document.getElementById("total-income"),
    totalExpenses: document.getElementById("total-expenses"),
    netBalance: document.getElementById("net-balance"),
    themeToggle: document.getElementById("theme-toggle"),
    exportButton: document.getElementById("export-button"),
    exportMenuPanel: document.getElementById("export-menu-panel"),
  };
}

function applyInitialTheme({ body }) {
  body.dataset.theme = getTheme();
}

function wireThemeToggle({ themeToggle, body }) {
  if (!themeToggle) return;
  themeToggle.addEventListener("click", () => {
    const next = body.dataset.theme === "dark" ? "light" : "dark";
    body.dataset.theme = next;
    setTheme(next);
  });
}

function wireExport({ exportButton, exportMenuPanel }) {
  if (!exportButton || !exportMenuPanel) return;
  exportButton.addEventListener("click", () => {
    exportMenuPanel.classList.toggle("export-menu-panel--open");
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!exportMenuPanel.contains(target) && target !== exportButton && !exportButton.contains(target)) {
      exportMenuPanel.classList.remove("export-menu-panel--open");
    }
  });
  exportMenuPanel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const kind = target.dataset.export;
    if (!kind) return;
    handleExport(kind);
    exportMenuPanel.classList.remove("export-menu-panel--open");
  });
}

function handleExport(kind) {
  const { wallets, transactions } = getState();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (kind === "json") {
    downloadFile({ filename: `wallet-dashboard-${timestamp}.json`, content: JSON.stringify({ wallets, transactions }, null, 2), mimeType: "application/json" });
    return;
  }
  if (kind === "csv") {
    const walletRows = wallets.map((w) => ({ id: w.id, name: w.name, type: w.type, balance: w.balance }));
    const txRows = transactions.map((t) => ({ id: t.id, walletId: t.walletId, type: t.type, amount: t.amount, category: t.category, date: t.date, note: t.note }));
    const combined = ["# Wallets", toCSV(walletRows), "", "# Transactions", toCSV(txRows)].join("\n");
    downloadFile({ filename: `wallet-dashboard-${timestamp}.csv`, content: combined, mimeType: "text/csv" });
  }
}

// Wallets
function renderWallets(els) {
  const wallets = listWallets();
  if (!wallets.length) {
    els.walletList.innerHTML = '<div class="wallet-list-empty">No accounts yet. Add one below to get started.</div>';
    return;
  }
  els.walletList.innerHTML = wallets.map((wallet) => {
    const icon = wallet.type === "bank" ? "🏦" : wallet.type === "cash" ? "💵" : wallet.type === "crypto" ? "🪙" : "📁";
    const typeLabel = wallet.type.charAt(0).toUpperCase() + wallet.type.slice(1);
    return `
      <div class="wallet-row" data-id="${wallet.id}" data-type="${wallet.type}">
        <div class="wallet-card-top">
          <span class="wallet-card-icon">${icon}</span>
          <div class="wallet-card-actions">
            <button type="button" class="wallet-action-btn wallet-edit" title="Edit account">✏️</button>
            <button type="button" class="wallet-action-btn delete-btn wallet-delete" title="Delete account">🗑️</button>
          </div>
        </div>
        <div class="wallet-card-name">${wallet.name}</div>
        <div class="wallet-card-type">${typeLabel}</div>
        <div class="wallet-card-balance">${formatCurrency(wallet.balance)}</div>
      </div>`;
  }).join("");
}

function syncWalletSelects(els) {
  const wallets = listWallets();
  if (!els.transactionWallet || !els.filterWallet) return;
  const prev = els.transactionWallet.value;
  const optionsHtml = wallets.map((w) => `<option value="${w.id}">${w.name}</option>`).join("");
  if (wallets.length) {
    els.transactionWallet.innerHTML = optionsHtml;
    els.transactionWallet.value = wallets.some((w) => w.id === prev) ? prev : wallets[wallets.length - 1].id;
  } else {
    els.transactionWallet.innerHTML = '<option value="">No wallets</option>';
  }
  els.filterWallet.innerHTML = '<option value="">All</option>' + optionsHtml;
}

function resetWalletForm(els) {
  els.walletId.value = "";
  els.walletForm.reset();
  els.walletSubmitButton.textContent = "Save account";
  els.walletCancelEdit.style.display = "none";
  els.walletError.textContent = "";
}

function wireWalletForm(els) {
  resetWalletForm(els);
  els.walletCancelEdit.addEventListener("click", () => resetWalletForm(els));
  els.walletForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.walletError.textContent = "";
    const id = els.walletId.value || null;
    const payload = { name: els.walletName.value, type: els.walletType.value, startingBalance: els.walletBalance.value };

    const submitBtn = els.walletSubmitButton;
    const origText  = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

    const result = await (id ? updateWallet(id, payload) : addWallet(payload));

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
    if (result.error) { els.walletError.textContent = result.error; return; }
    resetWalletForm(els);
    renderWallets(els);
    syncWalletSelects(els);
    const analytics = computeAnalytics();
    renderAnalytics(els, analytics);
    renderRecentTransactions(els);
    updateCharts(analytics, listTransactions());
  });
}

function wireWalletList(els) {
  els.walletList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest(".wallet-row");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (!id) return;
    if (target.classList.contains("wallet-edit")) {
      const wallet = findWallet(id);
      if (!wallet) return;
      els.walletId.value = wallet.id;
      els.walletName.value = wallet.name;
      els.walletType.value = wallet.type;
      els.walletBalance.value = wallet.balance.toString();
      els.walletSubmitButton.textContent = "Update wallet";
      els.walletCancelEdit.style.display = "inline-flex";
      els.walletName.focus();
      return;
    }
    if (target.classList.contains("wallet-delete")) {
      const wallet = findWallet(id);
      if (!wallet) return;
      if (!window.confirm(`Delete wallet "${wallet.name}"?\n\nIf it has transactions, delete those first.`)) return;
      const deleteBtn = target.closest(".wallet-delete");
      if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = "…"; }
      const result = await deleteWallet(id);
      if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = "🗑️"; }
      if (result.error) { els.walletError.textContent = result.error; return; }
      resetWalletForm(els);
      renderWallets(els);
      syncWalletSelects(els);
      const analytics = computeAnalytics();
      renderAnalytics(els, analytics);
      renderRecentTransactions(els);
      updateCharts(analytics, listTransactions());
    }
  });
}

// Transactions
function wireTransactionForm(els) {
  els.transactionDate.value = todayISO();
  els.transactionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.transactionError.textContent = "";

    const submitBtn = els.transactionForm.querySelector("button[type='submit']");
    const origText  = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

    const payload = {
      walletId: els.transactionWallet.value,
      type: els.transactionType.value,
      amount: els.transactionAmount.value,
      category: els.transactionCategory.value,
      date: els.transactionDate.value,
      note: els.transactionNote.value,
    };
    const result = await createTransaction(payload);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
    if (result.error) { els.transactionError.textContent = result.error; return; }

    els.transactionForm.reset();
    els.transactionType.value = "income";
    els.transactionDate.value = todayISO();
    syncWalletSelects(els);
    renderWallets(els);
    renderTransactions(els);
    renderRecentTransactions(els);
    const analytics = computeAnalytics();
    renderAnalytics(els, analytics);
    updateCharts(analytics, listTransactions());
  });
}

function wireTransactionFilters(els) {
  const inputs = [els.filterWallet, els.filterType, els.filterCategory, els.filterDateFrom, els.filterDateTo];
  const rerender = () => renderTransactions(els);
  for (const input of inputs) {
    if (!input) continue;
    input.addEventListener("input", rerender);
    if (input instanceof HTMLSelectElement) input.addEventListener("change", rerender);
  }
}

function applyTransactionFilters(els, transactions) {
  const walletId = els.filterWallet.value;
  const type = els.filterType.value;
  const category = els.filterCategory.value.trim().toLowerCase();
  const from = els.filterDateFrom.value;
  const to = els.filterDateTo.value;
  return transactions.filter((t) => {
    if (walletId && t.walletId !== walletId) return false;
    if (type && t.type !== type) return false;
    if (category && !t.category.toLowerCase().includes(category)) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });
}

function renderTransactions(els) {
  const allTransactions = listTransactions();
  const filtered = applyTransactionFilters(els, allTransactions);
  const walletsMap = new Map(listWallets().map((w) => [w.id, w]));
  if (!filtered.length) {
    els.transactionsTableBody.innerHTML = "";
    els.transactionsEmpty.style.display = "flex";
    return;
  }
  els.transactionsTableBody.innerHTML = filtered.map((t) => {
    const wallet = walletsMap.get(t.walletId);
    const walletName = wallet ? wallet.name : "Unknown";
    const typeLabel = t.type === "income" ? "Income" : "Expense";
    const typeClass = t.type === "income" ? "tx-income" : "tx-expense";
    return `
      <tr>
        <td>${t.date}</td>
        <td>${walletName}</td>
        <td><span class="tx-type ${typeClass}">${typeLabel}</span></td>
        <td>${t.category}</td>
        <td class="align-right">${formatCurrency(t.amount)}</td>
        <td>${t.note || ""}</td>
        <td class="tx-actions">
          <button class="tx-action-btn edit-record-btn" type="button" title="Edit" data-id="${t.id}">✏️</button>
          <button class="tx-action-btn delete-record-btn" type="button" title="Delete" data-id="${t.id}">🗑</button>
        </td>
      </tr>`;
  }).join("");
  els.transactionsEmpty.style.display = "none";
}

// ── Recent transactions with Edit/Delete ─────────────────────

function renderRecentTransactions(els) {
  const el = els.recentTransactionsList;
  if (!el) return;
  const transactions = listTransactions().slice(0, 8);
  const walletsMap = new Map(listWallets().map((w) => [w.id, w]));

  if (!transactions.length) {
    el.innerHTML = '<div class="empty-sm">No records yet</div>';
    return;
  }

  el.innerHTML = transactions.map((t) => {
    const isIncome = t.type === "income";
    const dotClass  = isIncome ? "tx-dot-income"  : "tx-dot-expense";
    const amtClass  = isIncome ? "amt-income"      : "amt-expense";
    const prefix    = isIncome ? "+"               : "−";
    const wallet    = walletsMap.get(t.walletId);
    const walletName = wallet ? wallet.name : "Unknown";
    return `
      <div class="recent-tx-item" data-tx-id="${t.id}">
        <span class="tx-dot ${dotClass}">${isIncome ? "↑" : "↓"}</span>
        <div class="recent-tx-body">
          <div class="recent-tx-cat">${t.category}</div>
          <div class="recent-tx-date">${t.date} · ${walletName}</div>
        </div>
        <span class="recent-tx-amount ${amtClass}">${prefix}${formatCurrency(t.amount)}</span>
        <div class="tx-actions-wrap">
          <button class="tx-three-dot" type="button" title="Options" data-tx-id="${t.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5"  r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          <div class="tx-dropdown" id="tx-drop-${t.id}">
            <button class="tx-drop-item tx-drop-edit" type="button" data-tx-id="${t.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="tx-drop-item tx-drop-delete" type="button" data-tx-id="${t.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete
            </button>
          </div>
        </div>
      </div>`;
  }).join("");

  // Wire three-dot toggles
  el.querySelectorAll(".tx-three-dot").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const txId = btn.dataset.txId;
      const drop = document.getElementById(`tx-drop-${txId}`);
      // Close all others
      document.querySelectorAll(".tx-dropdown.open").forEach((d) => {
        if (d !== drop) d.classList.remove("open");
      });
      drop.classList.toggle("open");
    });
  });
}

// Close all dropdowns on outside click
document.addEventListener("click", () => {
  document.querySelectorAll(".tx-dropdown.open").forEach((d) => d.classList.remove("open"));
});

// ── Edit Modal ────────────────────────────────────────────────

function injectEditModal() {
  if (document.getElementById("tx-edit-modal")) return;
  const html = `
    <div class="tx-modal-backdrop" id="tx-modal-backdrop"></div>
    <div class="tx-edit-modal" id="tx-edit-modal" aria-hidden="true">
      <div class="tx-modal-header">
        <div class="tx-modal-title-group">
          <div class="tx-modal-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div>
            <h3 class="tx-modal-title">Edit Record</h3>
            <p class="tx-modal-sub">Update transaction details</p>
          </div>
        </div>
        <button class="tx-modal-close" id="tx-modal-close" type="button" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <form id="tx-edit-form" class="tx-edit-form">
        <input type="hidden" id="tx-edit-id" />

        <div class="tx-modal-field-row">
          <div class="tx-modal-field">
            <label class="tx-modal-label">Type</label>
            <div class="tx-type-toggle">
              <button type="button" class="tx-type-btn active" data-type="income" id="tx-toggle-income">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                Income
              </button>
              <button type="button" class="tx-type-btn" data-type="expense" id="tx-toggle-expense">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                Expense
              </button>
            </div>
            <input type="hidden" id="tx-edit-type" value="income" />
          </div>
        </div>

        <div class="tx-modal-field-row two-col">
          <div class="tx-modal-field">
            <label class="tx-modal-label" for="tx-edit-amount">Amount</label>
            <div class="tx-amount-wrap">
              <input class="tx-modal-input" id="tx-edit-amount" type="number" step="0.01" placeholder="0.00" required />
              <span class="tx-amount-symbol">₼</span>
            </div>
          </div>
          <div class="tx-modal-field">
            <label class="tx-modal-label" for="tx-edit-date">Date</label>
            <input class="tx-modal-input" id="tx-edit-date" type="date" required />
          </div>
        </div>

        <div class="tx-modal-field">
          <label class="tx-modal-label" for="tx-edit-category">Category</label>
          <div class="tx-cat-grid" id="tx-cat-grid">
            ${CATEGORY_OPTIONS.map(c => `
              <button type="button" class="tx-cat-chip" data-cat="${c.label}">
                <span>${c.icon}</span><span>${c.label}</span>
              </button>`).join("")}
          </div>
          <input class="tx-modal-input" id="tx-edit-category" type="text" placeholder="Or type custom category…" required />
        </div>

        <div class="tx-modal-field">
          <label class="tx-modal-label" for="tx-edit-note">Note <span class="tx-optional">(optional)</span></label>
          <input class="tx-modal-input" id="tx-edit-note" type="text" placeholder="Add a note…" />
        </div>

        <div class="tx-modal-error" id="tx-edit-error"></div>

        <div class="tx-modal-actions">
          <button type="button" class="tx-cancel-btn" id="tx-edit-cancel">Cancel</button>
          <button type="submit" class="tx-save-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Save Changes
          </button>
        </div>
      </form>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", html);
}

const CATEGORY_OPTIONS = [
  { icon: "🛒", label: "Groceries" },
  { icon: "🍽️", label: "Dining" },
  { icon: "🚗", label: "Transport" },
  { icon: "🏠", label: "Housing" },
  { icon: "💊", label: "Health" },
  { icon: "🎬", label: "Entertainment" },
  { icon: "👕", label: "Shopping" },
  { icon: "💰", label: "Salary" },
  { icon: "📈", label: "Investment" },
  { icon: "🎁", label: "Gift" },
];

function openEditModal(tx) {
  const modal    = document.getElementById("tx-edit-modal");
  const backdrop = document.getElementById("tx-modal-backdrop");
  if (!modal || !backdrop) return;

  // Populate
  document.getElementById("tx-edit-id").value       = tx.id;
  document.getElementById("tx-edit-amount").value   = tx.amount;
  document.getElementById("tx-edit-date").value     = tx.date;
  document.getElementById("tx-edit-category").value = tx.category;
  document.getElementById("tx-edit-note").value     = tx.note || "";
  document.getElementById("tx-edit-error").textContent = "";

  // Type toggle
  setTypeToggle(tx.type);

  // Category chips: highlight if match
  document.querySelectorAll(".tx-cat-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.cat.toLowerCase() === tx.category.toLowerCase());
  });

  // Animate in
  backdrop.classList.add("visible");
  modal.removeAttribute("aria-hidden");
  requestAnimationFrame(() => {
    modal.classList.add("visible");
    backdrop.classList.add("visible");
  });
}

function closeEditModal() {
  const modal    = document.getElementById("tx-edit-modal");
  const backdrop = document.getElementById("tx-modal-backdrop");
  if (!modal || !backdrop) return;
  modal.classList.remove("visible");
  backdrop.classList.remove("visible");
  setTimeout(() => modal.setAttribute("aria-hidden", "true"), 260);
}

function setTypeToggle(type) {
  document.getElementById("tx-edit-type").value = type;
  document.getElementById("tx-toggle-income").classList.toggle("active",  type === "income");
  document.getElementById("tx-toggle-expense").classList.toggle("active", type === "expense");
}

function wireEditModal(els) {
  // Category chips
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".tx-cat-chip");
    if (!chip) return;
    document.querySelectorAll(".tx-cat-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    document.getElementById("tx-edit-category").value = chip.dataset.cat;
  });

  // Type toggle
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".tx-type-btn");
    if (!btn) return;
    setTypeToggle(btn.dataset.type);
  });

  // Close button
  document.addEventListener("click", (e) => {
    if (e.target.closest("#tx-modal-close") || e.target.id === "tx-modal-backdrop") {
      closeEditModal();
    }
  });

  // Edit/Delete from recent list (delegated)
  const recentEl = document.getElementById("recent-transactions-list");
  if (recentEl) {
    recentEl.addEventListener("click", (e) => {
      const editBtn   = e.target.closest(".tx-drop-edit");
      const deleteBtn = e.target.closest(".tx-drop-delete");

      if (editBtn) {
        const txId = editBtn.dataset.txId;
        const txList = listTransactions();
        const tx = txList.find((t) => t.id === txId);
        if (!tx) return;
        openEditModal(tx);
        document.getElementById(`tx-drop-${txId}`)?.classList.remove("open");
      }

      if (deleteBtn) {
        const txId = deleteBtn.dataset.txId;
        openDeleteConfirm(txId, els);
        document.getElementById(`tx-drop-${txId}`)?.classList.remove("open");
      }
    });
  }

  // Edit/Delete from All Records table (delegated)
  const tableBody = document.getElementById("transactions-tbody");
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const editBtn   = e.target.closest(".edit-record-btn");
      const deleteBtn = e.target.closest(".delete-record-btn");

      if (editBtn) {
        const txId = editBtn.dataset.id;
        const tx = listTransactions().find((t) => t.id === txId);
        if (!tx) return;
        openEditModal(tx);
      }

      if (deleteBtn) {
        const txId = deleteBtn.dataset.id;
        openDeleteConfirm(txId, els);
      }
    });
  }

  // Edit form submit
  const form = document.getElementById("tx-edit-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id       = document.getElementById("tx-edit-id").value;
      const amount   = document.getElementById("tx-edit-amount").value;
      const date     = document.getElementById("tx-edit-date").value;
      const category = document.getElementById("tx-edit-category").value;
      const note     = document.getElementById("tx-edit-note").value;
      const type     = document.getElementById("tx-edit-type").value;

      const saveBtn  = form.querySelector(".tx-save-btn");
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

      const result = await updateTransaction(id, { amount, date, category, note, type });

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Save Changes`;
      }

      if (result.error) {
        document.getElementById("tx-edit-error").textContent = result.error;
        return;
      }

      closeEditModal();
      fullRefresh(els);
      showToast("Record updated successfully");
    });
  }

  document.getElementById("tx-edit-cancel")?.addEventListener("click", closeEditModal);
}

// ── Delete Confirm Modal ──────────────────────────────────────

let _pendingDeleteId = null;

function injectDeleteConfirmModal() {
  if (document.getElementById("tx-delete-modal")) return;
  const html = `
    <div class="tx-delete-modal" id="tx-delete-modal" aria-hidden="true">
      <div class="tx-delete-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </div>
      <p class="tx-delete-title">Delete Record?</p>
      <p class="tx-delete-sub">This will reverse the balance effect and cannot be undone.</p>
      <div class="tx-delete-actions">
        <button class="tx-cancel-btn" id="tx-delete-cancel" type="button">Cancel</button>
        <button class="tx-confirm-delete-btn" id="tx-delete-confirm" type="button">Delete</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}

function openDeleteConfirm(txId, els) {
  _pendingDeleteId = txId;
  const modal = document.getElementById("tx-delete-modal");
  if (!modal) return;
  modal.removeAttribute("aria-hidden");
  requestAnimationFrame(() => modal.classList.add("visible"));
}

function closeDeleteConfirm() {
  _pendingDeleteId = null;
  const modal = document.getElementById("tx-delete-modal");
  if (!modal) return;
  modal.classList.remove("visible");
  setTimeout(() => modal.setAttribute("aria-hidden", "true"), 250);
}

function wireDeleteConfirmModal(els) {
  document.addEventListener("click", async (e) => {
    if (e.target.closest("#tx-delete-cancel")) { closeDeleteConfirm(); return; }
    if (e.target.closest("#tx-delete-confirm")) {
      if (!_pendingDeleteId) return;
      const id = _pendingDeleteId;

      const confirmBtn = document.getElementById("tx-delete-confirm");
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Deleting…"; }

      const result = await deleteTransaction(id);

      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Delete"; }

      closeDeleteConfirm();
      if (result.error) { alert(result.error); return; }
      fullRefresh(els);
      showToast("Record deleted", "delete");
    }
  });
}

// ── Toast ─────────────────────────────────────────────────────

function injectToast() {
  if (document.getElementById("tx-toast")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="tx-toast" id="tx-toast" aria-live="polite">
      <span class="tx-toast-icon" id="tx-toast-icon"></span>
      <span id="tx-toast-msg"></span>
    </div>`);
}

let _toastTimer = null;
function showToast(message, kind = "success") {
  const toast   = document.getElementById("tx-toast");
  const msgEl   = document.getElementById("tx-toast-msg");
  const iconEl  = document.getElementById("tx-toast-icon");
  if (!toast || !msgEl) return;

  if (_toastTimer) clearTimeout(_toastTimer);
  toast.classList.remove("visible", "toast-delete");

  msgEl.textContent = message;
  iconEl.innerHTML = kind === "delete"
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  if (kind === "delete") toast.classList.add("toast-delete");
  requestAnimationFrame(() => toast.classList.add("visible"));
  _toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

// ── Full refresh helper ───────────────────────────────────────

function fullRefresh(els) {
  renderWallets(els);
  syncWalletSelects(els);
  renderTransactions(els);
  renderRecentTransactions(els);
  const analytics = computeAnalytics();
  renderAnalytics(els, analytics);
  updateCharts(analytics, listTransactions());
}

// Analytics
function renderAnalytics(els, analytics) {
  els.totalBalance.textContent   = formatCurrency(analytics.totalBalance);
  els.walletCount.textContent    = String(analytics.walletCount);
  els.avgBalance.textContent     = formatCurrency(analytics.avgBalance);
  els.sumBank.textContent        = formatCurrency(analytics.byType.bank    || 0);
  els.sumCash.textContent        = formatCurrency(analytics.byType.cash    || 0);
  els.sumCrypto.textContent      = formatCurrency(analytics.byType.crypto  || 0);
  els.sumOther.textContent       = formatCurrency(analytics.byType.other   || 0);
  els.totalIncome.textContent    = formatCurrency(analytics.totalIncome);
  els.totalExpenses.textContent  = formatCurrency(analytics.totalExpenses);
  els.netBalance.textContent     = formatCurrency(analytics.net);
  renderInsightBanner(analytics);
  renderMonthlySummary(analytics);
}

function renderInsightBanner(analytics) {
  const banner = document.getElementById("insight-banner");
  const textEl = document.getElementById("insight-banner-text");
  if (!banner || !textEl) return;
  const insights = generateInsights(analytics);
  if (!insights.length) {
    banner.style.display = "none";
    return;
  }
  textEl.textContent = insights[0];
  banner.style.display = "flex";
}

function renderMonthlySummary(analytics) {
  const incomeEl = document.getElementById("summary-income");
  const expenseEl = document.getElementById("summary-expense");
  const savedEl = document.getElementById("summary-saved");
  const rateEl = document.getElementById("summary-rate");
  const labelEl = document.getElementById("monthly-summary-label");

  if (!incomeEl) return;

  const { totalIncome, totalExpenses, net } = analytics;
  const rate = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0;

  const now = new Date();
  if (labelEl) {
    labelEl.textContent = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  incomeEl.textContent  = formatCurrency(totalIncome);
  expenseEl.textContent = formatCurrency(totalExpenses);
  savedEl.textContent   = formatCurrency(net);
  rateEl.textContent    = rate + "%";

  savedEl.className = "monthly-summary-cell-value " + (net >= 0 ? "kpi-positive" : "kpi-negative");
  rateEl.className  = "monthly-summary-cell-value " + (rate >= 0 ? "kpi-positive" : "kpi-negative");
}

/**
 * Remove the .js-currency loading class from all currency display elements.
 *
 * Called once — after the very first renderAnalytics() in initApp().
 * At that point every element already contains the correct ₼ value written
 * by formatCurrency(), so making them visible is safe with no flicker.
 *
 * Subsequent renderAnalytics() calls (after wallet/transaction changes) do
 * not need this — the elements are already visible by then.
 */
function revealCurrencyElements() {
  document.querySelectorAll(".js-currency").forEach((el) => {
    el.classList.add("js-currency--ready");
  });
}

// ── Loading / error state helpers ────────────────────────────

function showLoadingState(els) {
  const recentEl = document.getElementById("recent-transactions-list");
  if (recentEl) {
    recentEl.innerHTML = `
      <div class="empty-sm db-loading">
        <span class="db-spinner"></span> Connecting to database…
      </div>`;
  }
  const tbody = document.getElementById("transactions-tbody");
  const empty = document.getElementById("transactions-empty");
  if (tbody) tbody.innerHTML = "";
  if (empty) {
    empty.style.display = "flex";
    empty.textContent   = "Loading records…";
  }
}

function hideLoadingState(els) {
  const empty = document.getElementById("transactions-empty");
  if (empty) empty.textContent = "No records yet.";
}

function showDbError(els, error) {
  const recentEl = document.getElementById("recent-transactions-list");
  if (recentEl) {
    recentEl.innerHTML = `
      <div class="empty-sm db-error">
        ⚠️ Could not load data.<br/>
        <span class="db-error-msg">${error.message || String(error)}</span>
      </div>`;
  }
  const empty = document.getElementById("transactions-empty");
  if (empty) {
    empty.style.display = "flex";
    empty.textContent   = "⚠️ Failed to connect to database.";
  }
  console.error("[initApp] Supabase error:", error);
}