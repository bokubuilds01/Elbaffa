-- ============================================================
-- El BAFFA - Migration 018: delete products without touching history
--   * products.deleted_at hides a product from every selling surface.
--   * admin_delete_product() archives instead of hard-deleting, so
--     invoice lines keep their product name/cost through the existing FK.
--   * top_sold_products() omits archived products from Quick Sale.
--   * An INSERT-only trigger blocks selling an archived product while
--     leaving old invoices and open orders readable and closable.
-- ============================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
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

  -- Keep the row (and its FK) intact: invoices read name and cost from it.
  UPDATE public.products SET deleted_at = now() WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'archived', true,
    'id', p_product_id,
    'name', v_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_product(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_product(BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_product(BIGINT) FROM anon;

-- Quick Sale speed buttons must not offer archived products.
CREATE OR REPLACE FUNCTION public.top_sold_products(p_limit INTEGER DEFAULT 6)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  barcode TEXT,
  selling_price NUMERIC,
  cost_price NUMERIC,
  stock INTEGER,
  category TEXT,
  low_stock_limit INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.name, p.barcode, p.selling_price, p.cost_price, p.stock, p.category, p.low_stock_limit
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  WHERE p.deleted_at IS NULL
  GROUP BY p.id
  ORDER BY COALESCE(SUM(oi.quantity), 0) DESC, p.name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.top_sold_products(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.top_sold_products(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.top_sold_products(INTEGER) FROM anon;

-- Guard only NEW invoice lines. Existing lines may still be edited/closed,
-- so deleting a product never invalidates a past or open invoice.
CREATE OR REPLACE FUNCTION public.reject_archived_product_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.products
     WHERE id = NEW.product_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'المنتج محذوف من الكتالوج ولا يمكن بيعه';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_archived_product_item ON public.order_items;
CREATE TRIGGER trg_reject_archived_product_item
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.reject_archived_product_item();
