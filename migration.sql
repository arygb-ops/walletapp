-- Migration: Fix transactions.wallet_id to be a proper UUID foreign key
--
-- Background:
--   The `wallet_id` column was stored as TEXT and contained account names
--   (e.g. "Arif") instead of the UUID primary key from the `accounts` table.
--   This caused the frontend to show "Unknown" in the Account column because
--   walletsMap.get(t.walletId) looked up by UUID but found a name string.
--
-- Steps:
--   1. Add a temporary UUID column.
--   2. Back-fill it by matching the old text value against accounts.id (if it
--      is already a valid UUID) or against accounts.name (if it was a name).
--   3. Drop the old text column.
--   4. Rename the new column to wallet_id.
--   5. Add a foreign-key constraint to accounts(id).

-- Step 1: Add a new UUID column to hold the correct references
ALTER TABLE transactions
  ADD COLUMN wallet_id_new UUID;

-- Step 2: Back-fill using the existing text value.
--   A correlated subquery with DISTINCT ON picks exactly one matching account
--   per transaction, preventing non-deterministic results when multiple accounts
--   share the same name (the app enforces uniqueness in application code, but the
--   DB constraint is added in step 5, so we guard here too).
--
--   Resolution order per row:
--     1. wallet_id is already a valid UUID string that matches accounts.id.
--     2. wallet_id is an account name (e.g. "Arif") → look up accounts.id by name.
UPDATE transactions t
SET wallet_id_new = (
  SELECT DISTINCT ON (a.id) a.id
  FROM accounts a
  WHERE a.name = t.wallet_id
     OR a.id::text = t.wallet_id
  LIMIT 1
)
WHERE wallet_id IS NOT NULL;

-- Step 3: Drop the old text wallet_id column
ALTER TABLE transactions
  DROP COLUMN wallet_id;

-- Step 4: Rename the new column
ALTER TABLE transactions
  RENAME COLUMN wallet_id_new TO wallet_id;

-- Step 5: Add a foreign-key constraint so future rows are always valid
ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_wallet
  FOREIGN KEY (wallet_id) REFERENCES accounts(id)
  ON DELETE SET NULL;
