# Product archive delete — short design (2026-11-28, replaces earlier guard approach)

## Intent

The owner wants deleting a product to be as easy as adding one, **even when the product appears in
past invoices**, with no effect on sales, invoices, stock history or profit. The product must simply
disappear from the catalog and from selling.

## Why the previous fix is not enough

Migration 017 hard-deletes unused products but deliberately refuses products referenced by
`order_items`. `order_items` has no product name snapshot: invoice screens, reports and Excel read
`products(name, cost_price)` through the FK. A physical delete would either break those reads or
require rewriting every report and invoice reader with new snapshot columns.

## Chosen behavior (owner decision: archive)

- `products.deleted_at TIMESTAMPTZ` marks a product as removed from the POS.
- `admin_delete_product(BIGINT)` is an admin-only `SECURITY DEFINER` RPC that **sets `deleted_at`**
  and returns a JSONB result. It never deletes the row, never touches `order_items`,
  `inventory_transactions`, `sales`, stock values, name, barcode or prices.
- Catalog reads (`listProducts`, `top_sold_products`) filter `deleted_at IS NULL`, so the product
  vanishes from `/products`, barcode lookup and Quick Sale buttons.
- A `BEFORE INSERT` trigger on `order_items` rejects any new sale of an archived product, while
  existing invoice lines and open orders remain readable and closable.
- Old invoices keep working unchanged because the row they reference still exists with the same
  name and cost price; no FK is dropped and no PostgREST relationship is lost.

## Rejected alternatives

- Physical delete with snapshot columns on every invoice line: true deletion, but changes many
  report/profit paths and risks misstating historical profit.
- `ON DELETE CASCADE` / `SET NULL`: would mutate or erase invoice lines.
- Placeholder product reassignment: would change what old invoices show.

## Scope

- Online version only (`F:\El-BAFFA-Online`); no desktop/offline changes.
- Migration 018 supersedes 017's guard; 017 stays in history for fresh databases.
- No production data deleted or mutated beyond setting `deleted_at` on products the admin explicitly deletes.
- Tests remain source-level `node:test` guardrails, plus mocked-browser UI verification.
