# Product Archive Delete — Implementation Plan

**Goal:** Deleting a product always succeeds, removes it from every catalog/selling surface, and
leaves invoices, profit and stock history unchanged.

**Architecture:** New migration 018 adds `products.deleted_at`, replaces the 017 delete RPC with an
archive RPC, filters the Quick Sale RPC, and adds an insert-only guard trigger on `order_items`.
Frontend catalog reads filter archived rows; the RPC name and UI call path stay unchanged.

**Spec:** `docs/superpowers/specs/2026-11-28-product-archive-design.md`

## Global constraints

- Work only in `F:\El-BAFFA-Online`; do not touch `F:\El-BAFFA` or `server/db.mjs`.
- Do not drop FKs, delete invoice/inventory rows, zero stock, or rename/change barcode of products.
- RPC stays `SECURITY DEFINER`, `SET search_path = public`, gated by `public.is_admin()`.
- Arabic UI copy; no secrets in files; no live data deletion during testing.

---

### Task 1: Archive migration (TDD)

- [ ] Write failing assertions in `tests/product-delete.test.ts` for migration 018: `deleted_at`
  column, `UPDATE ... SET deleted_at`, no hard delete / no invoice guard, admin gate, anon revoke,
  `top_sold_products` filter, and insert-only trigger on `order_items`.
- [ ] `npm test` → FAIL.
- [ ] Implement `supabase/migrations/018_archive_product_delete.sql`.
- [ ] `npm test` → PASS; commit.

### Task 2: Catalog reads and UI copy (TDD)

- [ ] Add failing assertions that `listProducts` filters `deleted_at IS NULL`, and that the
  confirmation copy says the product disappears from the catalog while invoices are unaffected.
- [ ] `npm test` → FAIL.
- [ ] Update `src/lib/api.ts` and `src/App.tsx`.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` → PASS; commit.

### Task 3: Live verification and publish

- [ ] Apply migration 018 to Supabase and verify column/RPC/trigger/anon revoke.
- [ ] Mocked-browser check: delete a product used in invoices → success toast, row disappears.
- [ ] Push `main`, trigger Cloudflare Pages deployment, verify canonical deployment.
- [ ] Update `F:\workflow Elzoz\Elbaffa\PROJECT.md` and `LOG.md`.
