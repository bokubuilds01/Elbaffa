-- ============================================================
-- El BAFFA - Migration 013: Reliable room deletion (soft delete)
--   * rooms.deleted_at   : archive flag instead of hard delete, so
--     historical invoices keep their room reference intact.
--   * delete_room()      : SECURITY DEFINER (admin-only) that cancels
--     any open order (removes its items + the order) then archives the
--     room. No RLS DELETE policies are required.
-- ============================================================

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.delete_room(p_room_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Cancel any open order in this room (no stock effects for open orders).
  FOR v_order_id IN
    SELECT id FROM orders WHERE room_id = p_room_id AND status = 'open'
  LOOP
    DELETE FROM order_items WHERE order_id = v_order_id;
    DELETE FROM orders WHERE id = v_order_id;
  END LOOP;

  UPDATE rooms SET deleted_at = now() WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الغرفة غير موجودة';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_room(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_room(INTEGER) FROM PUBLIC;