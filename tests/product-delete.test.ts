import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('migration 018 archives products instead of refusing to delete used ones', () => {
  const sql = read('../supabase/migrations/018_archive_product_delete.sql');
  assert.match(sql, /ALTER TABLE public\.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_delete_product/);
  assert.match(sql, /IF NOT public\.is_admin\(\)/, 'delete must be admin-only');
  assert.match(sql, /SET search_path = public/);
  assert.match(sql, /SELECT name INTO v_name[\s\S]*FOR UPDATE/);
  assert.match(sql, /UPDATE public\.products SET deleted_at = now\(\) WHERE id = p_product_id/);
  assert.ok(!/DELETE FROM public\.products/.test(sql), 'the row must stay for invoice history');
  assert.ok(!/FROM public\.order_items WHERE product_id = p_product_id/.test(sql), 'no invoice guard');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_delete_product\(BIGINT\) TO authenticated/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.admin_delete_product\(BIGINT\) FROM anon/);
  assert.ok(!/ON DELETE CASCADE/.test(sql), 'no cascade may remove invoice lines');
});

test('archived products are hidden from the catalog and cannot be sold again', () => {
  const sql = read('../supabase/migrations/018_archive_product_delete.sql');
  assert.match(sql, /FROM products p[\s\S]*WHERE p\.deleted_at IS NULL/, 'quick-sale RPC filter');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.reject_archived_product_item/);
  assert.match(sql, /BEFORE INSERT ON public\.order_items/, 'guard new sales only');
  assert.match(sql, /deleted_at IS NOT NULL/, 'reject archived products on new invoice lines');

  const api = read('../src/lib/api.ts');
  assert.match(api, /\.is\('deleted_at', null\)/, 'catalog list must hide archived products');
});

test('deleteProduct still uses the RPC and surfaces errors', () => {
  const api = read('../src/lib/api.ts');
  const start = api.indexOf('export async function deleteProduct');
  assert.ok(start >= 0, 'deleteProduct must exist');
  const body = api.slice(start, api.indexOf('// Inventory', start));
  assert.match(body, /supabase\.rpc\('admin_delete_product', \{ p_product_id: id \}\)/);
  assert.match(body, /if \(error\) throw new Error\(error\.message\)/);
});

test('products page explains the new delete behavior and keeps safe feedback', () => {
  const app = read('../src/App.tsx');
  const start = app.indexOf('function ProductsPage()');
  assert.ok(start >= 0, 'ProductsPage must exist');
  const page = app.slice(start, app.indexOf('// Inventory Page', start));

  assert.match(page, /ستختفي من الكتالوج/, 'confirmation must say the product disappears');
  assert.match(page, /الفواتير[^\n]*لا تتأثر/, 'invoices must be explicitly unchanged');
  assert.ok(!/مسجّل في فواتير/.test(page), 'old refusal copy must be gone');
  assert.match(page, /deletingId/, 'disable the row while deleting');
  assert.match(page, /disabled=\{deletingId === product\.id\}/);
  assert.match(page, /\} finally \{/, 'loading flag must always clear');
  assert.match(page, /تعذّر الحفظ/, 'save failures must be visible');
  assert.match(page, /الباركود مستخدم/, 'duplicate barcode must be named');
  assert.match(page, /المخزون المنخفض/, 'low-stock filter');
  assert.match(page, /هامش الربح/, 'margin column');
});
