// supabase.js — Wallet App Database Helper
// Browser-native ES module — no build tools required.
// Uses the Supabase JS v2 CDN ESM bundle.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── Credentials ───────────────────────────────────────────────
const supabaseUrl = "https://qlkgaczxgxxcwjagjauy.supabase.co";
const supabaseKey = "sb_publishable_sGti8tCmTX6npP35rflVdg_LAjI4Wsb";

// ── Client ────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE = "transactions";

// ── getTransactions ───────────────────────────────────────────
/**
 * Fetch all transactions ordered by date (newest first).
 * @returns {{ data: Array|null, error: object|null }}
 */
export async function getTransactions() {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("date", { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("[getTransactions]", error.message);
    return { data: null, error };
  }
}

// ── addTransaction ────────────────────────────────────────────
/**
 * Insert a new transaction row.
 * @param {string} title
 * @param {number} amount
 * @param {string} category
 * @param {"income"|"expense"} type
 * @param {string} date  — ISO date string, e.g. "2025-03-11"
 * @returns {{ data: object|null, error: object|null }}
 */
export async function addTransaction(title, amount, category, type, date) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert([{ title, amount, category, type, date }])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("[addTransaction]", error.message);
    return { data: null, error };
  }
}

// ── deleteTransaction ─────────────────────────────────────────
/**
 * Delete a transaction by id.
 * @param {string|number} id
 * @returns {{ data: object|null, error: object|null }}
 */
export async function deleteTransaction(id) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("[deleteTransaction]", error.message);
    return { data: null, error };
  }
}

// ── updateTransaction ─────────────────────────────────────────
/**
 * Update an existing transaction by id.
 * @param {string|number} id
 * @param {{ title?: string, amount?: number, category?: string, type?: string, date?: string }} updatedData
 * @returns {{ data: object|null, error: object|null }}
 */
export async function updateTransaction(id, updatedData) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(updatedData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("[updateTransaction]", error.message);
    return { data: null, error };
  }
}
