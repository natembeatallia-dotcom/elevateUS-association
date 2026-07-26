/*
# ElevateUS — admin-created members + loan transaction cost + expenses cleanup

## Changes
1. loans: add transaction_cost column (part of total repayable)
2. expenses: drop paid_by and approved_by columns (no longer tracked)
3. profiles: add is_system flag to mark admin-only accounts (not members)
*/

-- ===== loans: transaction cost =====
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS transaction_cost numeric(12,2) NOT NULL DEFAULT 0;

-- Recompute total_repayable to include transaction cost for existing rows
UPDATE loans
  SET total_repayable = round(COALESCE(principal,0) + COALESCE(interest_amount,0) + COALESCE(transaction_cost,0), 2)
  WHERE total_repayable <> round(COALESCE(principal,0) + COALESCE(interest_amount,0) + COALESCE(transaction_cost,0), 2);

-- ===== expenses: remove paid_by and approved_by =====
ALTER TABLE expenses DROP COLUMN IF EXISTS paid_by;
ALTER TABLE expenses DROP COLUMN IF EXISTS approved_by;

-- ===== profiles: system account flag =====
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Mark the admin (Dan Simiyu) as a system account
UPDATE profiles SET is_system = true WHERE full_name = 'Dan Simiyu';
