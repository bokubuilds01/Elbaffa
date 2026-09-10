-- ============================================================
-- El BAFFA - Migration 011: Bulletproof order totals + scope
-- 1) Recalc order total via SECURITY DEFINER so any active
--    employee can persist it (RLS on orders.update blocks
--    non-owner updates and left totals stale at 0).
-- 2) Self-heal: recompute total for every currently open order.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalc_order_total(p_order_id BIGINT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(10,2);
BEGIN
  IF NOT public.is_active_employee() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id) THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO v_total
  FROM order_items
  WHERE order_id = p_order_id;
  UPDATE orders SET total = v_total WHERE id = p_order_id;
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_order_total(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_order_total(BIGINT) FROM PUBLIC;

-- Self-heal any stale totals for currently open orders.
UPDATE orders o
SET total = x.total
FROM (
  SELECT order_id, COALESCE(SUM(quantity * unit_price), 0) AS total
  FROM order_items
  GROUP BY order_id
) x
WHERE o.id = x.order_id
  AND o.status = 'open'
  AND o.total IS DISTINCT FROM x.total;