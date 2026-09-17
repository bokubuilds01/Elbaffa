-- ============================================================
-- El BAFFA - Migration 012: Role-scoped profit-card visibility
--   * users.hide_profit_cards  : per-account preference to hide
--     the money/profit boxes (daily/weekly/monthly) from view.
--     Purely presentational - never touches business data.
--   * set_hide_profit_cards()  : SECURITY DEFINER RPC so each
--     account can update ONLY its own flag (no general self-update).
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hide_profit_cards BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_hide_profit_cards(p_hidden BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_value BOOLEAN := COALESCE(p_hidden, false);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'غير مسجل';
  END IF;
  UPDATE public.users SET hide_profit_cards = v_value WHERE id = v_uid;
  RETURN v_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_hide_profit_cards(BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_hide_profit_cards(BOOLEAN) FROM PUBLIC;