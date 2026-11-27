# Elbaffa Online POS Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the published Elbaffa dashboard show the open shift's net, give Kimo an admin-only one-click purge of all business records, and speed up cashier edits.

**Architecture:** A new Supabase migration scopes shift totals to the shift owner, adds admin-only purge/delete RPCs, and ports the single-round-trip `sync_order_items` RPC from the offline branch. The React client reads the same shift RPC for its dashboard cards, adds a select-all bulk-delete flow gated by `isAdmin`, and flushes pending quantity edits when leaving a room.

**Tech Stack:** React 19 + TypeScript + Vite 6, Supabase JS, PostgreSQL/PLpgSQL migrations, Node 24 built-in test runner (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-11-27-online-pos-improvements-design.md`

## Global Constraints

- Base is `origin/main` at `4dd4ea2` in worktree `F:\El-BAFFA-Online`; never modify the uncommitted `server/db.mjs` in `F:\El-BAFFA`.
- No midnight-based numbers anywhere in dashboard cards; no automatic shift closing.
- Every destructive RPC must check `public.is_admin()` and run atomically in one function call.
- `users`, `products`, `rooms` are never deleted by purge or bulk delete.
- Migrations must be applied in Supabase before the new frontend is published.
- No secrets in files or reports.

## Review Focus

- Shift started before midnight: dashboard still shows the shift total, not a midnight reset — pinned by Task 2 `mapShiftSummary` tests and Task 1 SQL guardrail.
- Two employees, one open shift: totals must include only the shift owner's sales — pinned by Task 1 guardrail regex for `employee_id = v_shift.employee_id`.
- Non-admin calling purge / bulk delete: must be rejected server-side — pinned by Task 1 guardrail `is_admin` assertions.
- Purge with FK dependencies: must delete children before parents and never touch users/products/rooms — pinned by Task 1 delete-order assertions.
- Fast quantity taps + leaving the room: pending debounced edit must be flushed — pinned by Task 4 implementation and manual code review; no automated browser test available offline.

---

### Task 1: Supabase migration — shift scope, admin purge, fast sync

**Files:**
- Create: `supabase/migrations/016_shift_scope_and_admin_purge.sql`
- Create: `tests/sql-guardrails.test.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Produces: RPC `current_shift_summary()` returning `summary.items_sold`; `admin_delete_sales(p_ids BIGINT[])`; `admin_purge_records()` returning counts `{sales, items, orders, payouts, inventory, handovers, shifts}`; `sync_order_items(p_order_id INTEGER, p_items JSONB)`; indexes on `orders.closed_at` and `sales(employee_id, created_at DESC)`.

- [ ] **Step 1: Add the npm test script and write the failing guardrail test**

Add to `package.json` scripts: `"test": "node --test tests"`.

Create `tests/sql-guardrails.test.ts` reading the migration as text and asserting:
  - `current_shift_summary` and `handover_shift` bodies each contain `employee_id = v_shift.employee_id`;
  - migration contains `items_sold`;
  - `admin_purge_records` and `admin_delete_sales` each contain `IF NOT public.is_admin() THEN`;
  - `DELETE FROM` targets appear in this order: `sales`, `order_items`, `orders`, `owner_payouts`, `inventory_transactions`, `shift_handovers`, `shifts`;
  - no `DELETE FROM users`, `DELETE FROM products`, or `DELETE FROM rooms`;
  - `public.sync_order_items` exists and both new indexes are created.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/016_shift_scope_and_admin_purge.sql`:
  - Replace `current_shift_summary()` and `handover_shift()` with copies of the migration-010 bodies whose sales aggregate adds `AND employee_id = v_shift.employee_id`; extend the summary JSON with `items_sold` computed as `COALESCE(SUM(oi.quantity),0)` over `order_items oi JOIN sales s ON s.order_id = oi.order_id` in the same window and employee.
  - Add `admin_delete_sales(p_ids BIGINT[])` with admin check, stock restore for selected sales' order items, then `DELETE FROM sales WHERE id = ANY(p_ids)`; return the deleted count.
  - Add `admin_purge_records()` with admin check: restore stock for every sold order item; delete in the order listed in Global Constraints; `GET DIAGNOSTICS` each count; return `jsonb_build_object(...)` with the seven keys.
  - Add `sync_order_items` copied verbatim from offline commit `139e96b` (`supabase/migrations/016_sync_order_items.sql`), and `CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON orders (closed_at DESC)` plus `idx_sales_employee_created ON sales (employee_id, created_at DESC)`.
  - Grant/revoke `EXECUTE` to `authenticated`/`PUBLIC` for all new functions.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS with all guardrail assertions.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/sql-guardrails.test.ts supabase/migrations/016_shift_scope_and_admin_purge.sql
git commit -m "feat(supabase): scope shift totals and add admin purge RPCs"
```

---

### Task 2: Pure helpers for shift numbers, selection and purge results

**Files:**
- Create: `src/lib/pos-helpers.ts`
- Create: `tests/pos-helpers.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces: `mapShiftSummary(raw: any): {sales:number; orders:number; items:number; open:boolean}`; `bulkActionForSelection(selectedCount:number, visibleCount:number): 'purge'|'delete'|null`; `toSyncItems(items: Array<{productId:number; quantity:number}>): Array<{product_id:number; quantity:number}>`; `mapPurgeResult(raw:any)` returning numeric counts with keys `sales, items, orders, payouts, inventory, handovers, shifts`.

- [ ] **Step 1: Write failing tests in `tests/pos-helpers.test.ts`**

Assertions:
  - `mapShiftSummary({shift:{id:7}, summary:{sales_total:'1890.00', sales_count:3, items_sold:12}})` equals `{sales:1890, orders:3, items:12, open:true}`;
  - `mapShiftSummary({shift:{id:7}, summary:{sales_total:800, sales_count:2}}).items === 0` (old RPC without `items_sold`);
  - `mapShiftSummary(null)` equals all zeros with `open:false`;
  - `bulkActionForSelection(0,5) === null`, `(2,5) === 'delete'`, `(5,5) === 'purge'`, `(0,0) === null`;
  - `toSyncItems([{productId:4, quantity:0}, {productId:9, quantity:2}])` equals `[{product_id:4, quantity:0}, {product_id:9, quantity:2}]`;
  - `mapPurgeResult({sales:3})` fills missing keys with `0` and keeps `sales:3`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL because `pos-helpers.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/pos-helpers.ts`**

Use `Number(value ?? 0)` coercion, `Boolean(raw?.shift?.id)` for `open`, and no date logic.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pos-helpers.ts tests/pos-helpers.test.ts
git commit -m "test: pin shift-number and bulk-selection helpers"
```

---

### Task 3: API layer — shift-backed dashboard, bulk delete, fast sync

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `mapShiftSummary`, `bulkActionForSelection` (used only by UI), `toSyncItems`, `mapPurgeResult` from Task 2.
- Produces: `Dashboard` with `shiftSales, shiftOrders, shiftItems, shiftOpen`; `getCurrentShift()` exposing `summary.items_sold`; `deleteSales(ids: number[]): Promise<void>`; `purgeAllRecords(): Promise<PurgeCounts>`; `syncOrderItems()` using the fast RPC with legacy fallback.

- [ ] **Step 1: Write the failing API contract test**

Append to `tests/pos-helpers.test.ts` a source-level assertion that `src/lib/api.ts` contains `supabase.rpc('current_shift_summary')`, `deleteSales`, `purgeAllRecords`, and no `setHours(0` call.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL on the source assertions.

- [ ] **Step 3: Update `src/lib/api.ts`**

  - Import helpers from `./pos-helpers`.
  - Replace `Dashboard.todaySales/todayOrders/todayItems` with `shiftSales/shiftOrders/shiftItems/shiftOpen`; add `items_sold` to `ShiftSummary`.
  - In `getDashboard`, start `monthStart` from `new Date()` without `setHours`, add `supabase.rpc('current_shift_summary')` to the `Promise.all`, and build the four shift fields with `mapShiftSummary`.
  - In `getCurrentShift`, map `items_sold: num(summary?.items_sold)`.
  - Add `deleteSales(ids)` calling `admin_delete_sales` with `{p_ids: ids}` and `purgeAllRecords()` calling `admin_purge_records` then `mapPurgeResult`.
  - In `syncOrderItems`, call `supabase.rpc('sync_order_items', {p_order_id: orderId, p_items: toSyncItems(items)})`; on success return `readOrder(orderId)`; on error keep the existing legacy implementation verbatim.

- [ ] **Step 4: Verify**

Run: `npm test` (PASS), `npx tsc --noEmit` (no errors), `npm run build` (success).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts tests/pos-helpers.test.ts
git commit -m "feat: back dashboard numbers by open shift and add bulk delete API"
```

---

### Task 4: UI — dashboard cards, select-all purge, flush on leaving room

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Dashboard.shiftSales/shiftOrders/shiftItems/shiftOpen`, `deleteSales`, `purgeAllRecords`, `bulkActionForSelection` from Task 3.

- [ ] **Step 1: Write a failing source test for the UI hooks**

Append to `tests/pos-helpers.test.ts` assertions that `src/App.tsx` contains `صافي الشيفت الحالي`, `تحديد الكل`, `حذف كل السجلات`, and `bulkActionForSelection`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Update the dashboard cards in `DashboardPage`**

Replace `label="مبيعات اليوم"` with `label="صافي الشيفت الحالي"`, value from `data?.shiftSales`, detail `data?.shiftOpen ? 'من بداية الشيفت — التسليم يدوي' : 'لا يوجد شيفت مفتوح'`. Replace the orders card with `طلبات الشيفت` / `shiftOrders` and the items card with `أصناف الشيفت` / `shiftItems` / detail `من بداية الشيفت`.

- [ ] **Step 4: Add bulk selection to `SalesPage`**

Add `selectedIds: Set<number>` state (admin only), a checkbox column, a header «تحديد الكل» checkbox toggling all `visibleSales`, and a bulk-delete button whose label/action come from `bulkActionForSelection(selectedIds.size, visibleSales.length)`. `purge` case: confirm dialog listing deleted record types and stating user accounts are kept; call `purgeAllRecords()`; toast counts; clear sales and selection. `delete` case: confirm dialog; call `deleteSales([...selectedIds])`; remove rows from local state. Keep the existing single-row delete intact.

- [ ] **Step 5: Flush pending room edits on navigation**

In `RoomPage`, add a ref holding the flush function, clear the timer and flush on unmount/room change, and wrap the dashboard navigation handler with a `leaveTo('/dashboard')` helper that races the flush against 700ms before navigating.

- [ ] **Step 6: Verify**

Run: `npm test` (PASS), `npx tsc --noEmit` (no errors), `npm run build` (success).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx tests/pos-helpers.test.ts
git commit -m "feat: shift-based dashboard cards and admin select-all purge UI"
```
