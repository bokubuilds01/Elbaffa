-- ============================================================
-- El BAFFA - Migration 008: Quick Sale (direct sales, no room)
-- ============================================================

-- 1. Sales and orders may now exist without a room (Quick Sale).
--    This does not change any existing behavior for room sales.
ALTER TABLE sales ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN room_id DROP NOT NULL;

-- 2. Payment method for sales (cash / card).
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 3. Create a Quick Sale atomically: order + items + stock deduction +
--    inventory transaction + sales record. Never touches any room.
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

  -- Validate products, stock and compute order total.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::BIGINT;
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'كمية غير صحيحة';
    END IF;

    SELECT name, selling_price, stock INTO v_name, v_unit, v_stock
    FROM products WHERE id = v_product_id;

    IF v_unit IS NULL THEN
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

  -- Record the sale with a Quick Sale invoice number.
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

-- 4. Most-used products for the Quick Sale speed buttons.
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
  GROUP BY p.id
  ORDER BY COALESCE(SUM(oi.quantity), 0) DESC, p.name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.top_sold_products(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.top_sold_products(INTEGER) FROM PUBLIC;