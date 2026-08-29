-- ============================================================
-- El BAFFA - Migration 007: Partial payment per item
-- ============================================================

-- 1. Track how many units of each item line are paid (default 0).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS paid_quantity INTEGER NOT NULL DEFAULT 0;

-- 2. Items that were fully paid with the old boolean flag keep being fully paid.
UPDATE order_items SET paid_quantity = quantity WHERE paid_at IS NOT NULL AND paid_quantity = 0;

-- 3. Enforce paid_quantity <= quantity at the database level (never over-pay a line).
CREATE OR REPLACE FUNCTION public.clamp_order_item_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.paid_quantity > NEW.quantity THEN
    NEW.paid_quantity := NEW.quantity;
  END IF;
  IF NEW.paid_quantity < 0 THEN
    NEW.paid_quantity := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clamp_order_item_paid ON order_items;
CREATE TRIGGER trg_clamp_order_item_paid
BEFORE INSERT OR UPDATE OF quantity, paid_quantity ON order_items
FOR EACH ROW EXECUTE FUNCTION public.clamp_order_item_paid();