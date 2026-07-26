/*
# ElevateUS — Association Management System Schema

## Overview
Creates the full relational schema for a financial cooperative / member-based welfare
association. The app is single-tenant (no sign-in): all association data is intentionally
shared, so RLS policies use `TO anon, authenticated` with `USING (true)`. Role-Based Access
Control is enforced client-side via a role switcher that simulates the logged-in member.

## New Tables
1. `roles` — lookup of roles and their permission matrices (Admin, Chairperson, Secretary,
   Treasurer, Organizing Secretary, Member).
2. `profiles` — member directory: name, role, phone, email, join date, credit score, status.
3. `subscriptions` — monthly subscription payments tracker (expected vs paid).
4. `membership_fees` — annual non-refundable membership registration fees sub-ledger.
5. `loans` — loan register: principal, interest, repayable, paid, balance, due date, status.
6. `loan_payments` — repayments made against a loan.
7. `interest_records` — interest earned per loan per period.
8. `fines` — statutory penalties (lateness, absences, violations).
9. `expenses` — operational outflows audit log.
10. `events` — organizational events calendar (AGM, reviews, welfare calls).
11. `event_attendees` — RSVP / attendance registry per event.
12. `email_logs` — internal comms / notification dispatch log.
13. `constitution_versions` — versioned constitution document (articles/sections as JSONB).
14. `audit_logs` — immutable trace of every write / status override / profile change.
15. `organization_settings` — key/value JSONB store for global configuration.

## Security
- RLS enabled on every table.
- `TO anon, authenticated` CRUD policies because the data is intentionally shared
  across the association (single-tenant app, no sign-in). RBAC is enforced in the UI.
- `audit_logs` is INSERT-only for anon (no update/delete) to preserve immutability.

## Notes
- All money columns use NUMERIC(12,2) to avoid float precision drift.
- Foreign keys use ON DELETE CASCADE for child tables to keep referential integrity.
- `recorded_by` columns reference `profiles(id)`.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL,
  permission_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role_id INT REFERENCES roles(id) ON DELETE SET NULL,
  phone_number TEXT,
  email TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  credit_score INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  avatar_url TEXT,
  notes TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- ============================================================
-- subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  billing_month DATE NOT NULL,
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date timestamptz,
  status TEXT NOT NULL DEFAULT 'Unpaid',
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reference_number TEXT,
  notes TEXT,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subs_member ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subs_month ON subscriptions(billing_month);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);

-- ============================================================
-- membership_fees
-- ============================================================
CREATE TABLE IF NOT EXISTS membership_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL DEFAULT 'Annual Registration',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date timestamptz,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'Unpaid',
  reference_number TEXT,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mf_member ON membership_fees(member_id);
CREATE INDEX IF NOT EXISTS idx_mf_status ON membership_fees(status);

-- ============================================================
-- loans
-- ============================================================
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  principal NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  interest_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_repayable NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  credit_snapshot TEXT,
  purpose TEXT,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  disbursed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due ON loans(due_date);

-- ============================================================
-- loan_payments
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date timestamptz DEFAULT now(),
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lp_loan ON loan_payments(loan_id);

-- ============================================================
-- interest_records
-- ============================================================
CREATE TABLE IF NOT EXISTS interest_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  principal_basis NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_earned DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Accrued',
  notes TEXT,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ir_member ON interest_records(member_id);
CREATE INDEX IF NOT EXISTS idx_ir_date ON interest_records(date_earned);

-- ============================================================
-- fines
-- ============================================================
CREATE TABLE IF NOT EXISTS fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fine_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_issued DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Unpaid',
  notes TEXT,
  issued_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  waived_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fines_member ON fines(member_id);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);

-- ============================================================
-- expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_spent DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT,
  paid_by TEXT,
  approved_by TEXT,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exp_date ON expenses(date_spent);
CREATE INDEX IF NOT EXISTS idx_exp_category ON expenses(category);

-- ============================================================
-- events
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'Meeting',
  event_date timestamptz NOT NULL,
  location TEXT,
  rsvp_count INT NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- ============================================================
-- event_attendees
-- ============================================================
CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'Invited',
  notes TEXT,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_ea_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_ea_member ON event_attendees(member_id);

-- ============================================================
-- email_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_group TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  template_used TEXT,
  sent_at timestamptz DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Sent',
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_email_sent ON email_logs(sent_at);

-- ============================================================
-- constitution_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS constitution_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'ElevateUS Constitution',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  changelog TEXT,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cv_version ON constitution_versions(version_number);

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  old_value JSONB,
  new_value JSONB,
  summary TEXT,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================
-- organization_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- Single-tenant shared data: anon + authenticated have full CRUD.
-- audit_logs is INSERT-only (immutable trace).
-- ============================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE constitution_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Helper to apply standard CRUD policies to a shared table
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'roles','profiles','subscriptions','membership_fees','loans','loan_payments',
    'interest_records','fines','expenses','events','event_attendees','email_logs',
    'constitution_versions','organization_settings'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s;', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON %s FOR SELECT TO anon, authenticated USING (true);', t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s;', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON %s FOR INSERT TO anon, authenticated WITH CHECK (true);', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s;', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON %s FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s;', t||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON %s FOR DELETE TO anon, authenticated USING (true);', t||'_delete', t);
  END LOOP;
END $$;

-- audit_logs: SELECT + INSERT only (immutable). No UPDATE / DELETE.
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
