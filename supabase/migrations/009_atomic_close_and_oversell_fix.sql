-- ============================================================
-- El BAFFA - Migration 009: Atomic order closing + oversell protection
--   * close_room_order()  : closes an open order atomically
--     (locks products FOR UPDATE, validates stock, deducts stock,
--      logs inventory, closes order, records sale) as one transaction.
--   * create_quick_sale() : re-created with FOR UPDATE locks so two
--     concurrent quick sales can never oversell a product.
--   * delete_sale()       : refunds stock when a sale record is removed
--     (admin) so inventory stays consistent.
--   * orders_update RLS   : restrict non-admin updates to own orders.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Atomic room-order closing (SECURITY DEFINER, single transaction)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_room_order(p_order_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id UUID := auth.uid();
  v_item RECORD;
  v_total NUMERIC(10,2) := 0;
  v_room_id INTEGER;
  v_invoice TEXT;
  v_sale_id BIGINT;
BEGIN
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'مستخدم غير مسجل';
  END IF;

  -- Lock the order row and confirm it is still open (only owner or admin).
  SELECT room_id INTO v_room_id
  FROM orders
  WHERE id = p_order_id AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو مغلق بالفعل';
  END IF;

  -- Iterate items; lock each product row FOR UPDATE to prevent overselling.
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.unit_price, p.stock AS stock, p.name AS name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
    FOR UPDATE OF p
  LOOP
    IF v_item.stock < v_item.quantity THEN
      RAISE EXCEPTION '%: الكمية المطلوبة (%) أكبر من المخزون (%)',
        v_item.name, v_item.quantity, v_item.stock;
    END IF;
    v_total := v_total + (v_item.quantity * v_item.unit_price);
  END LOOP;

  -- Recompute the order total from its items.
  UPDATE orders SET total = v_total WHERE id = p_order_id;

  -- Close order, deduct stock, log inventory & record the sale.
  UPDATE orders SET status = 'closed', closed_at = now() WHERE id = p_order_id;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.stock AS stock
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    UPDATE products SET stock = stock - v_item.quantity WHERE id = v_item.product_id;
    INSERT INTO inventory_transactions (product_id, quantity, type, reference_id)
    VALUES (v_item.product_id, -v_item.quantity, 'sale', p_order_id);
  END LOOP;

  v_invoice := 'INV-' || lpad(p_order_id::TEXT, 5, '0');
  INSERT INTO sales (order_id, invoice_number, room_id, employee_id, total, payment_method)
  VALUES (p_order_id, v_invoice, v_room_id, v_emp_id, v_total, NULL)
  RETURNING id INTO v_sale_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'sale_id', v_sale_id,
    'invoice_number', v_invoice,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_room_order(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.close_room_order(BIGINT) FROM PUBLIC;

-- ------------------------------------------------------------------
-- 2. Re-create create_quick_sale with FOR UPDATE product locks
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_quick_sale(
  p_employee_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id BIGINT;
  v_qty INTEGER;
  v_unit NUMERIC(10,2);
  v_stock INTEGER;
  v_name TEXT;
  v_total NUMERIC(10,2) := 0;
  v_order_id BIGINT;
  v_sale_id BIGINT;
  v_invoice TEXT;
BEGIN
  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'مستخدم غير مسجل';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'لا توجد منتجات في السلة';
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'card') THEN
    p_payment_method := 'cash';
  END IF;

  -- Lock & validate each product FOR UPDATE, computing the total.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::BIGINT;
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'كمية غير صحيحة';
    END IF;

    SELECT p.name, p.selling_price, p.stock INTO v_name, v_unit, v_stock
    FROM products p WHERE p.id = v_product_id FOR UPDATE;

    IF NOT FOUND OR v_unit IS NULL THEN
      RAISE EXCEPTION 'منتج غير موجود';
    END IF;
    IF v_stock < v_qty THEN
      RAISE EXCEPTION '%: الكمية المطلوبة (%) أكبر من المخزون (%)', v_name, v_qty, v_stock;
    END IF;

    v_total := v_total + (v_qty * v_unit);
  END LOOP;

  -- Create a closed order with no room.
  INSERT INTO orders (room_id, employee_id, status, total, closed_at)
  VALUES (NULL, p_employee_id, 'closed', v_total, now())
  RETURNING id INTO v_order_id;

  -- Insert items, deduct stock, log inventory transaction.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::BIGINT;
    v_qty := (v_item->>'quantity')::INTEGER;

    SELECT selling_price INTO v_unit FROM products WHERE id = v_product_id;
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, v_product_id, v_qty, v_unit);

    UPDATE products SET stock = stock - v_qty WHERE id = v_product_id;
    INSERT INTO inventory_transactions (product_id, quantity, type, reference_id)
    VALUES (v_product_id, -v_qty, 'sale', v_order_id);
  END LOOP;

  v_invoice := 'QS-' || lpad(v_order_id::TEXT, 5, '0');
  INSERT INTO sales (order_id, invoice_number, room_id, employee_id, total, payment_method)
  VALUES (v_order_id, v_invoice, NULL, p_employee_id, v_total, p_payment_method)
  RETURNING id INTO v_sale_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'sale_id', v_sale_id,
    'invoice_number', v_invoice,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quick_sale(UUID, JSONB, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_quick_sale(UUID, JSONB, TEXT) FROM PUBLIC;

-- ------------------------------------------------------------------
-- 3. delete_sale() - refund stock before removing a sale record (admin)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_sale(p_sale_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id BIGINT;
  v_item RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  SELECT order_id INTO v_order_id FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة';
  END IF;

  -- Restore stock for each line item of the order.
  FOR v_item IN
    SELECT product_id, quantity FROM order_items WHERE order_id = v_order_id
  LOOP
    UPDATE products
    SET stock = stock + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  DELETE FROM sales WHERE id = p_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_sale(BIGINT) TO admin;
GRANT EXECUTE ON FUNCTION public.delete_sale(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_sale(BIGINT) FROM PUBLIC;

-- ------------------------------------------------------------------
-- 4. Scope orders_update RLS to owner or admin (fix privilege escalation)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (public.is_admin() OR employee_id = auth.uid());
