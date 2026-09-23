-- ============================================================
-- El BAFFA - Migration 015: Close & archive a past month
--   * list_closeable_months() : admin-only list of past months
--     (any month strictly before the current one) that still have
--     closed orders, with per-month counts + net profit.
--   * close_month(year, month): admin-only, transactional purge of
--     a *past* month only. Deletes sales -> order_items -> orders.
--     Current month is always protected, numbers computed exactly
--     (no row-cap), and any error rolls back everything.
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_closeable_months()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  WITH base AS (
    SELECT o.id AS order_id, o.closed_at
    FROM orders o
    WHERE o.closed_at IS NOT NULL
      AND o.closed_at < date_trunc('month', now())
  ),
  by_month AS (
    SELECT
      EXTRACT(YEAR FROM closed_at)::INT  AS year,
      EXTRACT(MONTH FROM closed_at)::INT AS month,
      COUNT(*)::INT                      AS orders
    FROM base
    GROUP BY 1, 2
  )
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.year DESC, m.month DESC), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT
      b.year,
      b.month,
      b.orders,
      (SELECT COUNT(*)::INT FROM order_items oi
         JOIN base bb ON bb.order_id = oi.order_id
        WHERE bb.closed_at >= make_date(b.year, b.month, 1)
          AND bb.closed_at <  make_date(b.year, b.month, 1) + interval '1 month') AS items,
      (SELECT COUNT(*)::INT FROM sales s
         JOIN base bb ON bb.order_id = s.order_id
        WHERE bb.closed_at >= make_date(b.year, b.month, 1)
          AND bb.closed_at <  make_date(b.year, b.month, 1) + interval '1 month') AS sales,
      (SELECT COALESCE(SUM((oi.unit_price - pr.cost_price) * oi.quantity), 0)::NUMERIC
         FROM order_items oi
         JOIN base bb ON bb.order_id = oi.order_id
         JOIN products pr ON pr.id = oi.product_id
        WHERE bb.closed_at >= make_date(b.year, b.month, 1)
          AND bb.closed_at <  make_date(b.year, b.month, 1) + interval '1 month') AS profit
    FROM by_month b
  ) m;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_month(p_year INTEGER, p_month INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start   TIMESTAMPTZ;
  v_end     TIMESTAMPTZ;
  v_orders  INT := 0;
  v_items   INT := 0;
  v_sales   INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  IF p_year IS NULL OR p_month IS NULL
     OR p_month < 1 OR p_month > 12
     OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'شهر غير صالح';
  END IF;

  v_start := date_trunc('month', make_date(p_year, p_month, 1));
  v_end   := v_start + interval '1 month';

  -- Never allow closing the current or a future month.
  IF v_start >= date_trunc('month', now()) THEN
    RAISE EXCEPTION 'لا يمكن إغلاق الشهر الحالي أو شهر قادم';
  END IF;

  CREATE TEMP TABLE tmp_close_orders ON COMMIT DROP AS
    SELECT o.id
    FROM orders o
    WHERE (o.closed_at >= v_start AND o.closed_at < v_end)
       OR (o.status <> 'closed' AND o.created_at >= v_start AND o.created_at < v_end);

  DELETE FROM sales s
    USING tmp_close_orders t
    WHERE s.order_id = t.id;
  GET DIAGNOSTICS v_sales = ROW_COUNT;

  DELETE FROM order_items oi
    USING tmp_close_orders t
    WHERE oi.order_id = t.id;
  GET DIAGNOSTICS v_items = ROW_COUNT;

  DELETE FROM orders o
    USING tmp_close_orders t
    WHERE o.id = t.id;
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  RETURN jsonb_build_object('orders', v_orders, 'items', v_items, 'sales', v_sales);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_closeable_months() TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_month(INTEGER, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_closeable_months() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_month(INTEGER, INTEGER) FROM PUBLIC;