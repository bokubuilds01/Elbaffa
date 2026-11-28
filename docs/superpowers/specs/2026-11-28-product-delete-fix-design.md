# Product delete fix — short design (2026-11-28)

## Intent

On the online POS, deleting a product from `/products` shows a success toast but the
product comes back after the refresh. The cashier needs a reliable catalog without
damaging invoice history.

## Root cause (verified in source)

- `supabase/migrations/001_initial_schema.sql`: `order_items.product_id` and
  `inventory_transactions.product_id` are plain `REFERENCES products(id)` with no
  `ON DELETE` action. A product already used in an invoice cannot be hard-deleted.
- `src/lib/api.ts`: `deleteProduct()` awaits the delete but never reads `error`, so
  the UI believes the delete succeeded, reloads from Supabase, and the product returns.
- `src/App.tsx`: save failures are logged only to `console.error`; the admin gets no
  feedback when a name/barcode conflicts.

## Chosen behavior (owner decision)

- A product **not** referenced by `order_items` is hard-deleted normally.
- A product referenced by `order_items` (room invoices **and** quick sales both write
  order items) is **left exactly as it is**; the RPC raises a clear Arabic error and
  the UI shows it instead of a false success.
- No `ON DELETE CASCADE`, no global archive flag, no destruction of invoice lines.

## Approaches considered

1. **Guard RPC (chosen)** — admin-only `admin_delete_product` checks invoice usage,
   removes only that product's own inventory log rows, then hard-deletes. Preserves
   history, matches the repo's existing RPC/RLS pattern, and gives a precise message.
2. Soft-delete like migration 013 — would leave used products hidden from the catalog,
   which the owner explicitly did not want.
3. `ON DELETE CASCADE` — would erase old invoice lines and corrupt reports; rejected.

## Implementation decisions

- New migration `017_safe_product_delete.sql`; `SECURITY DEFINER`, fixed `search_path`,
  `is_admin()` gate, `SELECT ... FOR UPDATE`, grants to `authenticated` only.
- `deleteProduct(id)` calls the RPC and throws `Error(error.message)`; UI catch already
  renders the message in a toast.
- Confirmation copy states the rule; delete button is disabled while the request is in
  flight; loading state is cleared with `finally`.
- Useful additions on the same page: low-stock filter chip with count, margin column
  (selling − cost, plus percentage), and a visible error toast on save failure
  (duplicate barcode included).

## Constraints / non-goals

- Online version only (`F:\El-BAFFA-Online`); desktop/SQLite copy untouched.
- No production data deleted by testing; live migration only after explicit approval.
- Existing invoices, users, products not selected for deletion, and rooms unchanged.
- Tests are source-level guardrails, in line with the existing `node:test` suite.
