-- ============================================================
-- El BAFFA - Migration 005: Allow deleting users that have orders
-- ============================================================

-- Make employee_id nullable and SET NULL so a user can be deleted
-- even if they have orders / sales.
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_employee_id_fkey,
  ALTER COLUMN employee_id DROP NOT NULL,
  ADD CONSTRAINT orders_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_employee_id_fkey,
  ALTER COLUMN employee_id DROP NOT NULL,
  ADD CONSTRAINT sales_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL;

-- Admin-only RPC to fully delete an auth user (removes their login too).
-- Deleting from auth.users cascades to public.users via its FK.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  DELETE FROM auth.users WHERE id = p_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;