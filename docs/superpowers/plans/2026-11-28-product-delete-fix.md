# Product Delete Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make product deletion honest: hard-delete unused products, preserve used ones with a clear message, and add two small catalog-management aids.

**Architecture:** A single admin-only Postgres RPC owns the safety check; the frontend calls it and surfaces errors instead of swallowing them. Source-level tests pin the SQL guardrails and UI behavior.

**Tech Stack:** PostgreSQL/Supabase RLS + RPC, React 19/TypeScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-28-product-delete-fix-design.md`

## Global Constraints

- Work only in `F:\El-BAFFA-Online`; never touch `F:\El-BAFFA` or `server/db.mjs`.
- No `ON DELETE CASCADE` on product foreign keys; no invoice lines may be deleted.
- RPC must be `SECURITY DEFINER`, `SET search_path = public`, gated by `public.is_admin()`.
- No secrets in files; no live data deletion during testing.
- Arabic UI copy; keep existing `data-testid` naming style.

## Review Focus

- Product used in a room invoice → must stay untouched with Arabic error (Task 1 test).
- Product used only in quick sale → also referenced by `order_items`, same protection (Task 1 test).
- Product with only inventory log rows → logs removed, product deleted (Task 1 test).
- Non-admin call → `غير مصرح`, no mutation (Task 1 test).
- Duplicate barcode / save failure → visible toast, not a silent console error (Task 3 test).

---

### Task 1: Guardrail SQL migration

**Files:** Create `supabase/migrations/017_safe_product_delete.sql`; Test `tests/product-delete.test.ts`

- [ ] **Step 1: Write the failing test** for the SQL file: RPC name, admin gate,
  `order_items` guard with Arabic exception, `inventory_transactions` cleanup scoped to
  the product, `DELETE FROM products`, and authenticated-only grants.
- [ ] **Step 2:** `npm test` → expected FAIL (file missing).
- [ ] **Step 3:** Implement `public.admin_delete_product(p_product_id BIGINT) RETURNS JSONB`
  with `SELECT name ... FOR UPDATE`, usage guard, scoped inventory cleanup, and
  `jsonb_build_object('deleted', true, ...)` result.
- [ ] **Step 4:** `npm test` → expected PASS.
- [ ] **Step 5:** Commit `feat(supabase): guard product deletion against invoice history`.

### Task 2: API error propagation

**Files:** Modify `src/lib/api.ts:578-580`; Test `tests/product-delete.test.ts`

- [ ] **Step 1:** Add failing assertions that `deleteProduct` calls
  `supabase.rpc('admin_delete_product', { p_product_id: id })` and throws on error.
- [ ] **Step 2:** `npm test` → expected FAIL.
- [ ] **Step 3:** Replace the direct `.delete()` with the RPC call and throw on error.
- [ ] **Step 4:** `npm test` → expected PASS.
- [ ] **Step 5:** Commit `fix: surface product delete errors instead of swallowing them`.

### Task 3: Products page feedback and catalog aids

**Files:** Modify `src/App.tsx` (ProductsPage); Test `tests/product-delete.test.ts`

- [ ] **Step 1:** Add failing assertions for: confirmation copy mentioning invoices,
  `deletingId` state, disabled delete button, error toast on save failure, low-stock
  filter, margin column, duplicate-barcode message.
- [ ] **Step 2:** `npm test` → expected FAIL.
- [ ] **Step 3:** Implement those UI changes without altering other pages.
- [ ] **Step 4:** `npm test` + `npx tsc --noEmit` + `npm run build` → expected PASS.
- [ ] **Step 5:** Commit `feat(products): honest delete feedback, low-stock filter and margin`.

### Task 4: Live verification and publish (after approval)

- [ ] Apply migration 017 to Supabase via Management API and verify function presence.
- [ ] Push `main`, trigger Cloudflare Pages deployment, verify canonical deployment.
- [ ] Report results; no real product deletion during testing.
