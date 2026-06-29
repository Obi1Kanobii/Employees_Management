-- Run this in Supabase SQL Editor to fix "infinite recursion" on profiles.
-- Safe to re-run.

-- 1. is_admin() reads JWT only — never queries profiles (no recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'employee') = 'admin';
$$;

-- 2. Sync profile role into JWT app_metadata (so is_admin() works)
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

DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_jwt();

-- 3. RPC to create/fetch profile (bypasses RLS)
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

-- 4. Table grants
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON timesheets TO authenticated;
GRANT ALL ON time_entries TO authenticated;
GRANT USAGE ON TYPE user_role TO authenticated;
GRANT USAGE ON TYPE timesheet_status TO authenticated;

-- 5. Signup trigger
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

-- 6. Backfill profiles + sync JWT roles
INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

UPDATE auth.users u
SET raw_app_meta_data =
  COALESCE(u.raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', p.role::text)
FROM public.profiles p
WHERE u.id = p.id;

-- 7. Drop ALL old policies
DROP POLICY IF EXISTS "Employees view own profile, admin views all" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Employees manage own timesheets, admin manages all" ON timesheets;
DROP POLICY IF EXISTS "Employees manage own entries, admin manages all" ON time_entries;
DROP POLICY IF EXISTS "Employees insert own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees select own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees update own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees delete own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees insert own entries" ON time_entries;
DROP POLICY IF EXISTS "Employees select own entries" ON time_entries;
DROP POLICY IF EXISTS "Employees update own entries" ON time_entries;
DROP POLICY IF EXISTS "Employees delete own entries" ON time_entries;

-- 8. Profiles policies (is_admin() is safe here — reads JWT only)
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

-- 9. Timesheets policies
CREATE POLICY "timesheets_insert" ON timesheets
  FOR INSERT WITH CHECK (auth.uid() = employee_id OR is_admin());

CREATE POLICY "timesheets_select" ON timesheets
  FOR SELECT USING (auth.uid() = employee_id OR is_admin());

CREATE POLICY "timesheets_update" ON timesheets
  FOR UPDATE USING (auth.uid() = employee_id OR is_admin());

CREATE POLICY "timesheets_delete" ON timesheets
  FOR DELETE USING (auth.uid() = employee_id OR is_admin());

-- 10. Time entries policies
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
