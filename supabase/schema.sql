-- Run this in the Supabase SQL Editor to reset and restructure

-- Drop existing tables and triggers if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_user_role_change ON public.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.sync_role_to_jwt() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_user_profile(text) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_user_record(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.timesheets CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.calendar_sync_logs CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP TYPE IF EXISTS timesheet_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Custom types (safe if type already exists)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'employee');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role user_role DEFAULT 'employee',
  hourly_rate DECIMAL(10,2) DEFAULT 15.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shifts table
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL(10,2) NOT NULL,
  google_event_id TEXT UNIQUE, -- to avoid duplicates during sync
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helper: admin check via JWT
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'employee') = 'admin';
$$;

-- Sync role into JWT app_metadata
CREATE OR REPLACE FUNCTION public.sync_role_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_jwt();

-- Auto-create user on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC to create/fetch user record (bypasses RLS safely on login)
DROP FUNCTION IF EXISTS public.ensure_user_profile(text) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_user_record(text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_user_record(
  full_name text DEFAULT 'Employee',
  email text DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.users;
  user_email text;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  user_email := COALESCE(
    email,
    (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
  );

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'No email found for authenticated user';
  END IF;

  INSERT INTO public.users (id, email, full_name)
  VALUES (auth.uid(), user_email, full_name)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_record(text, text) TO authenticated;

-- Table grants for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.shifts TO authenticated;
GRANT USAGE ON TYPE user_role TO authenticated;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Users policies (drop first so script can be re-run)
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (is_admin());

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE USING (is_admin());

-- Shifts policies (drop first so script can be re-run)
DROP POLICY IF EXISTS "shifts_select_own" ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_admin" ON public.shifts;

CREATE POLICY "shifts_select_own" ON public.shifts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "shifts_select_admin" ON public.shifts
  FOR SELECT USING (is_admin());

-- No insert/update/delete for employees on shifts from the app, handled by admin/service role
CREATE POLICY "shifts_insert_admin" ON public.shifts
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "shifts_update_admin" ON public.shifts
  FOR UPDATE USING (is_admin());
CREATE POLICY "shifts_delete_admin" ON public.shifts
  FOR DELETE USING (is_admin());
