-- ============================================================
-- El BAFFA - Migration 010: Shift handover system
-- Morning/evening shifts, shift opening with opening cash,
-- and counted-cash handover with shortage/excess report.
-- ============================================================

-- 1. Users: shift assignment + handover permission.
ALTER TABLE users ADD COLUMN IF NOT EXISTS shift_type TEXT CHECK (shift_type IN ('morning', 'evening'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_handover BOOLEAN NOT NULL DEFAULT false;

-- 2. SHIFTS table (one open shift per employee at a time).
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id),
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_one_open ON shifts (employee_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);

-- 3. SHIFT HANDOVERS table (final immutable shift report).
CREATE TABLE IF NOT EXISTS shift_handovers (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL UNIQUE REFERENCES shifts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id),
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  sales_count INTEGER NOT NULL DEFAULT 0,
  sales_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  counted_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  difference NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handovers_employee ON shift_handovers (employee_id);
CREATE INDEX IF NOT EXISTS idx_handovers_created ON shift_handovers (created_at DESC);

-- 4. RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select" ON shifts;
CREATE POLICY "shifts_select" ON shifts FOR SELECT USING (public.is_admin() OR employee_id = auth.uid());
DROP POLICY IF EXISTS "shifts_insert" ON shifts;
CREATE POLICY "shifts_insert" ON shifts FOR INSERT WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "shift_handovers_select" ON shift_handovers;
CREATE POLICY "shift_handovers_select" ON shift_handovers FOR SELECT USING (public.is_admin() OR employee_id = auth.uid());
DROP POLICY IF EXISTS "shift_handovers_insert" ON shift_handovers;
CREATE POLICY "shift_handovers_insert" ON shift_handovers FOR INSERT WITH CHECK (public.is_admin() OR employee_id = auth.uid());

-- 5. open_shift(): start a shift for the current user.
CREATE OR REPLACE FUNCTION public.open_shift(p_opening_cash NUMERIC DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users;
  v_shift public.shifts;
  v_cash NUMERIC := 0;
BEGIN
  IF p_opening_cash IS NOT NULL AND p_opening_cash > 0 THEN
    v_cash := p_opening_cash;
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();
  IF v_user.id IS NULL OR NOT v_user.active THEN
    RAISE EXCEPTION 'مستخدم غير مسجل';
  END IF;
  IF v_user.shift_type IS NULL THEN
    RAISE EXCEPTION 'لم يتم تحديد شيفت لهذا الحساب';
  END IF;
  IF NOT v_user.can_handover THEN
    RAISE EXCEPTION 'الحساب ليس لديه صلاحية فتح وتسليم الشيفت';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shifts WHERE employee_id = auth.uid() AND status = 'open') THEN
    RAISE EXCEPTION 'يوجد شيفت مفتوح بالفعل';
  END IF;

  INSERT INTO public.shifts (employee_id, shift_type, opening_cash)
  VALUES (auth.uid(), v_user.shift_type, v_cash)
  RETURNING * INTO v_shift;

  RETURN jsonb_build_object(
    'id', v_shift.id,
    'employee_id', v_shift.employee_id,
    'shift_type', v_shift.shift_type,
    'status', v_shift.status,
    'opening_cash', v_shift.opening_cash,
    'started_at', v_shift.started_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_shift(NUMERIC) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.open_shift(NUMERIC) FROM PUBLIC;

-- 6. current_shift_summary(): live numbers for the current user's open shift.
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
  WHERE created_at >= v_shift.started_at AND created_at <= now();

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
      'expected_cash', v_shift.opening_cash + v_cash
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_shift_summary() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_shift_summary() FROM PUBLIC;

-- 7. handover_shift(): freeze the shift report, close the shift.
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
  WHERE created_at >= v_shift.started_at AND created_at <= now();

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