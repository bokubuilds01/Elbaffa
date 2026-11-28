-- ============================================================
-- El BAFFA - Migration 017: honest product deletion
--   * A product used by any invoice line (room order or quick sale)
--     is left untouched; the admin gets a clear Arabic reason.
--   * An unused product is hard-deleted together with its own
--     stock-movement log rows. No FK is changed, no cascade is added,
--     and no invoice line is ever modified.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_inventory INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  SELECT name INTO v_name
    FROM public.products
   WHERE id = p_product_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنتج غير موجود';
  END IF;

  -- Both room orders and quick sales write order_items, so this single
  -- guard protects every invoice that ever mentioned this product.
  IF EXISTS (
    SELECT 1 FROM public.order_items WHERE product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف المنتج "%" لأنه مسجّل في فواتير سابقة', v_name;
  END IF;

  -- Inventory rows belong to this product only; removing them is what
  -- allows the unused product to disappear without touching history.
  DELETE FROM public.inventory_transactions WHERE product_id = p_product_id;
  GET DIAGNOSTICS v_inventory = ROW_COUNT;

  DELETE FROM public.products WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'id', p_product_id,
    'name', v_name,
    'inventory_rows', v_inventory
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_product(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_product(BIGINT) FROM PUBLIC;
-- Supabase grants EXECUTE to anon by default on new functions; remove it explicitly.
REVOKE EXECUTE ON FUNCTION public.admin_delete_product(BIGINT) FROM anon;
