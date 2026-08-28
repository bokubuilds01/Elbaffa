-- ============================================================
-- El BAFFA - Migration 004: Repair & Self-Heal for Users
-- Fixes existing employee accounts that were created while the
-- session-swap bug prevented their public.users row from existing.
-- ============================================================

-- 1. Auto-confirm any existing auth user that was never confirmed
--    (so accounts created before migration 003 can sign in).
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 2. Backfill public.users for every auth user missing a profile row.
INSERT INTO public.users (id, name, email, role, active, created_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)) AS name,
  au.email,
  CASE
    WHEN au.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::public.user_role
    ELSE 'employee'::public.user_role
  END AS role,
  true AS active,
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id);

-- 3. Self-heal RPC: any authenticated user can ensure their own
--    profile row exists on next login (SECURITY DEFINER so RLS on
--    public.users does not block it).
CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.users (id, name, email, role, active)
  SELECT
    au.id,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    au.email,
    CASE
      WHEN au.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::public.user_role
      ELSE 'employee'::public.user_role
    END,
    true
  FROM auth.users au
  WHERE au.id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id);
  RETURN true;
$$;
REVOKE ALL ON FUNCTION public.ensure_current_user_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;