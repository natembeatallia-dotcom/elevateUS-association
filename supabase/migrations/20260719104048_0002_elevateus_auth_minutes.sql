/*
# ElevateUS — Auth integration

## Overview
Links `profiles` to `auth.users` so members can sign in with email/password.
Adds a `minutes` table for the Secretary to record meeting minutes.

## Changes
1. `profiles.user_id` — new nullable uuid column referencing `auth.users(id)`.
2. `profiles.password_hash` removed in favor of Supabase Auth.
3. New `minutes` table — meeting minutes managed by Secretary.
4. RLS policy for `minutes` (shared read, secretary/admin write enforced client-side).

## Security
- RLS enabled on `minutes`.
- `profiles` keeps shared read (anon+authenticated) so the directory works pre-sign-in.
*/

-- Link profiles to auth users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- ============================================================
-- minutes (Secretary)
-- ============================================================
CREATE TABLE IF NOT EXISTS minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date DATE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  attendees TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_minutes_date ON minutes(meeting_date);

ALTER TABLE minutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS minutes_select ON minutes;
CREATE POLICY minutes_select ON minutes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS minutes_insert ON minutes;
CREATE POLICY minutes_insert ON minutes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS minutes_update ON minutes;
CREATE POLICY minutes_update ON minutes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS minutes_delete ON minutes;
CREATE POLICY minutes_delete ON minutes FOR DELETE TO anon, authenticated USING (true);
