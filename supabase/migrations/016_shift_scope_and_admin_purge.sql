-- ============================================================
-- El BAFFA - Migration 016: shift-scoped totals, admin purge,
-- single-round-trip order-item sync.
--   * Shift numbers belong to the shift owner and never reset at midnight.
--   * admin_purge_records() removes all business records atomically while
--     keeping users, products and rooms intact.
--   * sync_order_items() replaces ~5 sequential REST calls with one RPC.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. current_shift_summary(): owner-scoped live numbers + items sold
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_shift_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts;
  v_count INTEGER;
  v_total NUMERIC(10,2);
  v_cash NUMERIC(10,2);
  v_card NUMERIC(10,2);
  v_items INTEGER := 0;
BEGIN
  SELECT * INTO v_shift
  FROM public.shifts
  WHERE employee_id = auth.uid() AND status = 'open'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_shift.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(total), 0),
    COALESCE(SUM(total) FILTER (WHERE payment_method IS NULL OR payment_method = 'cash'), 0),
    COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0)
  INTO v_count, v_total, v_cash, v_card
  FROM public.sales
  WHERE created_at >= v_shift.started_at
    AND created_at <= now()
    AND employee_id = v_shift.employee_id;

  SELECT COALESCE(SUM(oi.quantity), 0)::INTEGER INTO v_items
  FROM public.order_items oi
  JOIN public.sales s ON s.order_id = oi.order_id
  WHERE s.created_at >= v_shift.started_at
    AND s.created_at <= now()
    AND s.employee_id = v_shift.employee_id;

  RETURN jsonb_build_object(
    'shift', jsonb_build_object(
      'id', v_shift.id,
      'employee_id', v_shift.employee_id,
      'shift_type', v_shift.shift_type,
      'status', v_shift.status,
      'opening_cash', v_shift.opening_cash,
      'started_at', v_shift.started_at
    ),
    'summary', jsonb_build_object(
      'sales_count', v_count,
      'sales_total', v_total,
      'cash_sales', v_cash,
      'card_sales', v_card,
      'items_sold', v_items,
      'expected_cash', v_shift.opening_cash + v_cash
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_shift_summary() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_shift_summary() FROM PUBLIC;

-- ------------------------------------------------------------------
-- 2. handover_shift(): same owner-scoped window before freezing report
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handover_shift(p_counted_cash NUMERIC, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users;
  v_shift public.shifts;
  v_count INTEGER;
  v_total NUMERIC(10,2);
  v_cash NUMERIC(10,2);
  v_card NUMERIC(10,2);
  v_expected NUMERIC(10,2);
  v_diff NUMERIC(10,2);
  v_handover public.shift_handovers;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();
  IF v_user.id IS NULL OR NOT v_user.active THEN
    RAISE EXCEPTION 'مستخدم غير مسجل';
  END IF;
  IF NOT v_user.can_handover THEN
    RAISE EXCEPTION 'الحساب ليس لديه صلاحية تسليم الشيفت';
  END IF;
  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'المبلغ المُعدّ يجب أن يكون أكبر من أو يساوي صفر';
  END IF;

  SELECT * INTO v_shift
  FROM public.shifts
  WHERE employee_id = auth.uid() AND status = 'open'
  ORDER BY started_at DESC
  LIMIT 1;
  IF v_shift.id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد شيفت مفتوح للتسليم';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(total), 0),
    COALESCE(SUM(total) FILTER (WHERE payment_method IS NULL OR payment_method = 'cash'), 0),
    COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0)
  INTO v_count, v_total, v_cash, v_card
  FROM public.sales
  WHERE created_at >= v_shift.started_at
    AND created_at <= now()
    AND employee_id = v_shift.employee_id;

  v_expected := v_shift.opening_cash + v_cash;
  v_diff := p_counted_cash - v_expected;

  INSERT INTO public.shift_handovers (
    shift_id, employee_id, shift_type, started_at, ended_at,
    sales_count, sales_total, cash_sales, card_sales,
    opening_cash, expected_cash, counted_cash, difference, notes
  )
  VALUES (
    v_shift.id, auth.uid(), v_shift.shift_type, v_shift.started_at, now(),
    v_count, v_total, v_cash, v_card,
    v_shift.opening_cash, v_expected, p_counted_cash, v_diff, p_notes
  )
  RETURNING * INTO v_handover;

  UPDATE public.shifts SET status = 'closed', closed_at = now() WHERE id = v_shift.id;

  RETURN jsonb_build_object(
    'id', v_handover.id,
    'shift_id', v_handover.shift_id,
    'shift_type', v_handover.shift_type,
    'started_at', v_handover.started_at,
    'ended_at', v_handover.ended_at,
    'sales_count', v_handover.sales_count,
    'sales_total', v_handover.sales_total,
    'cash_sales', v_handover.cash_sales,
    'card_sales', v_handover.card_sales,
    'opening_cash', v_handover.opening_cash,
    'expected_cash', v_handover.expected_cash,
    'counted_cash', v_handover.counted_cash,
    'difference', v_handover.difference,
    'notes', v_handover.notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.handover_shift(NUMERIC, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handover_shift(NUMERIC, TEXT) FROM PUBLIC;

-- ------------------------------------------------------------------
-- 3. admin_delete_sales(): admin-only bulk delete, stock restored once
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_sales(p_ids BIGINT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.products pr
     SET stock = pr.stock + x.qty
    FROM (
      SELECT oi.product_id AS product_id, SUM(oi.quantity)::INTEGER AS qty
        FROM public.order_items oi
        JOIN public.sales s ON s.order_id = oi.order_id
       WHERE s.id = ANY(p_ids)
       GROUP BY oi.product_id
    ) x
   WHERE pr.id = x.product_id;

  DELETE FROM public.sales WHERE id = ANY(p_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_sales(BIGINT[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_sales(BIGINT[]) FROM PUBLIC;

-- ------------------------------------------------------------------
-- 4. admin_purge_records(): atomic wipe of business records only
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_purge_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales INTEGER := 0;
  v_items INTEGER := 0;
  v_orders INTEGER := 0;
  v_payouts INTEGER := 0;
  v_inventory INTEGER := 0;
  v_handovers INTEGER := 0;
  v_shifts INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Return sold quantities to the catalog before removing the records.
  UPDATE public.products pr
     SET stock = pr.stock + x.qty
    FROM (
      SELECT oi.product_id AS product_id, SUM(oi.quantity)::INTEGER AS qty
        FROM public.order_items oi
        JOIN public.sales s ON s.order_id = oi.order_id
       GROUP BY oi.product_id
    ) x
   WHERE pr.id = x.product_id;

  DELETE FROM public.sales;
  GET DIAGNOSTICS v_sales = ROW_COUNT;

  DELETE FROM public.order_items;
  GET DIAGNOSTICS v_items = ROW_COUNT;

  DELETE FROM public.orders;
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  DELETE FROM public.owner_payouts;
  GET DIAGNOSTICS v_payouts = ROW_COUNT;

  DELETE FROM public.inventory_transactions;
  GET DIAGNOSTICS v_inventory = ROW_COUNT;

  DELETE FROM public.shift_handovers;
  GET DIAGNOSTICS v_handovers = ROW_COUNT;

  DELETE FROM public.shifts;
  GET DIAGNOSTICS v_shifts = ROW_COUNT;

  RETURN jsonb_build_object(
    'sales', v_sales,
    'items', v_items,
    'orders', v_orders,
    'payouts', v_payouts,
    'inventory', v_inventory,
    'handovers', v_handovers,
    'shifts', v_shifts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_records() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_purge_records() FROM PUBLIC;

-- ------------------------------------------------------------------
-- 5. sync_order_items(): one round trip for fast quantity edits
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_order_items(p_order_id INTEGER, p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_employee() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  UPDATE public.order_items oi
     SET quantity = x.quantity
    FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS x(product_id INTEGER, quantity INTEGER)
   WHERE oi.order_id = p_order_id
     AND oi.product_id = x.product_id
     AND x.quantity > 0;

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
  SELECT p_order_id, x.product_id, x.quantity, pr.selling_price
    FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS x(product_id INTEGER, quantity INTEGER)
    JOIN public.products pr ON pr.id = x.product_id
   WHERE x.quantity > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.product_id = x.product_id
     );

  DELETE FROM public.order_items oi
   WHERE oi.order_id = p_order_id
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS x(product_id INTEGER, quantity INTEGER)
        WHERE x.product_id = oi.product_id AND x.quantity > 0
     );

  UPDATE public.orders o
     SET total = COALESCE((
       SELECT SUM(oi.quantity * oi.unit_price)
         FROM public.order_items oi
        WHERE oi.order_id = p_order_id
     ), 0)
   WHERE o.id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_order_items(INTEGER, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_items(INTEGER, JSONB) FROM PUBLIC;

-- ------------------------------------------------------------------
-- 6. Indexes for the hot shift/report reads
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON public.orders (closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_employee_created ON public.sales (employee_id, created_at DESC);
