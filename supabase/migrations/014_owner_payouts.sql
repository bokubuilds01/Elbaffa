-- ============================================================
-- El BAFFA - Migration 014: Owner profit account (settle + payout)
--   * owner_payouts : ledger of owner withdrawals from net profit.
--   * add_owner_payout() / delete_owner_payout() (admin only).
--   * get_owner_profit(): exact month aggregates (no 1000-row cap,
--     server-side aggregation) -> { earned, paid, balance }.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.owner_payouts (
  id SERIAL PRIMARY KEY,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  employee_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_payouts_admin_all" ON public.owner_payouts;
CREATE POLICY "owner_payouts_admin_all" ON public.owner_payouts
  FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "owner_payouts_admin_insert" ON public.owner_payouts;
CREATE POLICY "owner_payouts_admin_insert" ON public.owner_payouts
  FOR INSERT WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.add_owner_payout(p_amount NUMERIC, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ غير صالح';
  END IF;
  INSERT INTO public.owner_payouts (amount, note, employee_id)
  VALUES (p_amount, p_note, auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_owner_payout(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  DELETE FROM public.owner_payouts WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_profit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_earned NUMERIC; v_paid NUMERIC; v_balance NUMERIC;
BEGIN
  IF NOT public.is_active_employee() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  SELECT COALESCE(SUM((oi.unit_price - pr.cost_price) * oi.quantity), 0)
    INTO v_earned
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.status = 'closed'
    JOIN products pr ON pr.id = oi.product_id
    WHERE o.closed_at >= date_trunc('month', now());
  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM public.owner_payouts
    WHERE created_at >= date_trunc('month', now());
  v_balance := GREATEST(v_earned - v_paid, 0);
  RETURN jsonb_build_object('earned', v_earned, 'paid', v_paid, 'balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_owner_payout(NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owner_payout(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_profit() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_payout(NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_owner_payout(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_profit() FROM PUBLIC;