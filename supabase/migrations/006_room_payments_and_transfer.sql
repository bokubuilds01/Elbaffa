-- ============================================================
-- El BAFFA - Migration 006: Paid items & Order transfer
-- ============================================================

-- 1. Allow marking individual order items as paid (pre-payment tracking).
--    paid_at = when the item's price was collected.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Transfer an open order to another room atomically.
--    Moves the whole open order (and all its items) to the target room.
--    Rejects: non-open order, missing target room, same room, target already has an open order.
CREATE OR REPLACE FUNCTION public.transfer_order(p_order_id BIGINT, p_target_room_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_room BIGINT;
  v_target_has_open BOOLEAN;
  v_row RECORD;
BEGIN
  SELECT room_id INTO v_current_room
  FROM orders
  WHERE id = p_order_id AND status = 'open';

  IF v_current_room IS NULL THEN
    RAISE EXCEPTION 'الطلب غير مفتوح';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_target_room_id) THEN
    RAISE EXCEPTION 'الغرفة غير موجودة';
  END IF;

  IF v_current_room = p_target_room_id THEN
    RAISE EXCEPTION 'الغرفة الهدف هي نفس الغرفة الحالية';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM orders WHERE room_id = p_target_room_id AND status = 'open'
  ) INTO v_target_has_open;

  IF v_target_has_open THEN
    RAISE EXCEPTION 'الغرفة الهدف بها طلب مفتوح بالفعل';
  END IF;

  UPDATE orders SET room_id = p_target_room_id WHERE id = p_order_id;

  SELECT * INTO v_row FROM orders WHERE id = p_order_id;
  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_order(BIGINT, BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_order(BIGINT, BIGINT) FROM PUBLIC;