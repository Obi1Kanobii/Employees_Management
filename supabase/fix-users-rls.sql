-- Run this in Supabase SQL Editor to fix login + sync issues

-- 1. Allow users to insert their own row (backup if RPC is unavailable)
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. RPC that safely creates the user row on login (bypasses RLS)
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

-- 3. Backfill all existing auth users
INSERT INTO public.users (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE(
    (u.raw_app_meta_data->>'role')::public.user_role,
    'employee'::public.user_role
  )
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = u.id
);

-- 4. Set your admin account (CHANGE THIS EMAIL)
UPDATE public.users
SET role = 'admin'
WHERE email = 'YOUR_ADMIN_EMAIL@betterai360.com';

-- 5. Ensure employees exist for calendar matching
INSERT INTO public.users (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'employee'::public.user_role
FROM auth.users u
WHERE u.email IN ('yuval@betterai360.com', 'elad@betterai360.com')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = 'employee'::public.user_role;

-- 6. Sync roles into JWT (required for admin dashboard + sync button)
UPDATE auth.users au
SET raw_app_meta_data =
  COALESCE(au.raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', pu.role::text)
FROM public.users pu
WHERE pu.id = au.id;
