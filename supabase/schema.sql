-- Run this in the Supabase SQL Editor

-- Custom types
CREATE TYPE user_role AS ENUM ('admin', 'employee');
CREATE TYPE timesheet_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'employee',
  hourly_rate DECIMAL(10,2) DEFAULT 15.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timesheets table (groups a week of entries)
CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  week_start_date DATE NOT NULL,
  status timesheet_status DEFAULT 'pending',
  total_week_hours DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (employee_id, week_start_date)
);

-- Clients table (billing / project clients)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time entries table (daily logs)
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID REFERENCES timesheets(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIME,
  clock_out TIME,
  break_minutes INT DEFAULT 0,
  total_day_hours DECIMAL(10,2) DEFAULT 0,
  client_id UUID REFERENCES clients(id),
  notes TEXT,
  UNIQUE (timesheet_id, work_date)
);

-- Helper: admin check via JWT (never queries profiles — no RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'employee') = 'admin';
$$;

-- Sync profile role into JWT app_metadata
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

CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_jwt();

-- RPC to create/fetch profile (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.ensure_user_profile(full_name text DEFAULT 'Employee')
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.profiles;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  INSERT INTO public.profiles (id, full_name)
  VALUES (auth.uid(), full_name)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile(text) TO authenticated;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Table grants for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON timesheets TO authenticated;
GRANT ALL ON time_entries TO authenticated;
GRANT ALL ON clients TO authenticated;
GRANT USAGE ON TYPE user_role TO authenticated;
GRANT USAGE ON TYPE timesheet_status TO authenticated;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Profiles policies (is_admin reads JWT only — safe on this table)
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- Timesheets policies
CREATE POLICY "timesheets_insert" ON timesheets
  FOR INSERT WITH CHECK (auth.uid() = employee_id OR is_admin());

CREATE POLICY "timesheets_select" ON timesheets
  FOR SELECT USING (auth.uid() = employee_id OR is_admin());

CREATE POLICY "timesheets_update" ON timesheets
  FOR UPDATE USING (auth.uid() = employee_id OR is_admin());

CREATE POLICY "timesheets_delete" ON timesheets
  FOR DELETE USING (auth.uid() = employee_id OR is_admin());

-- Time entries policies
CREATE POLICY "entries_insert" ON time_entries
  FOR INSERT WITH CHECK (
    timesheet_id IN (SELECT id FROM timesheets WHERE employee_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "entries_select" ON time_entries
  FOR SELECT USING (
    timesheet_id IN (SELECT id FROM timesheets WHERE employee_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "entries_update" ON time_entries
  FOR UPDATE USING (
    timesheet_id IN (SELECT id FROM timesheets WHERE employee_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "entries_delete" ON time_entries
  FOR DELETE USING (
    timesheet_id IN (SELECT id FROM timesheets WHERE employee_id = auth.uid())
    OR is_admin()
  );

-- Clients policies
CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "clients_insert_admin" ON clients
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "clients_update_admin" ON clients
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "clients_delete_admin" ON clients
  FOR DELETE TO authenticated USING (is_admin());
