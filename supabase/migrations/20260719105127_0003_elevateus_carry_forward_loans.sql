/*
# ElevateUS — Carry-forward loans + split principal/interest payments

## Overview
- Loans support carry-forward: an unpaid balance (principal + accrued interest)
  can be rolled into a new loan when the term ends, instead of defaulting.
- Repayments split into principal and interest portions, paid together.
- Tracks accrued_interest separately from principal_balance.

## Changes
1. loans: add principal_balance, accrued_interest, carry_forward_from, carried_forward_at
2. loan_payments: add principal_paid, interest_paid, carry_forward flag
3. Drop old current_balance/amount_paid usage in favor of split balances
*/

-- ===== loans additions =====
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS principal_balance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accrued_interest numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carry_forward_from uuid REFERENCES loans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carried_forward_at timestamptz;

-- Backfill principal_balance / accrued_interest for any existing rows
UPDATE loans
  SET principal_balance = COALESCE(principal, 0) - COALESCE(amount_paid, 0),
      accrued_interest  = COALESCE(interest_amount, 0)
  WHERE principal_balance = 0 AND accrued_interest = 0;

-- ===== loan_payments additions =====
ALTER TABLE loan_payments
  ADD COLUMN IF NOT EXISTS principal_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_carry_forward boolean NOT NULL DEFAULT false;

-- Index for carry-forward lineage lookups
CREATE INDEX IF NOT EXISTS idx_loans_carry_forward_from ON loans(carry_forward_from);
