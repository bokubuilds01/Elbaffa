import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('migration 017 keeps products used in invoices and deletes only unused ones', () => {
  const sql = read('../supabase/migrations/017_safe_product_delete.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_delete_product/);
  assert.match(sql, /IF NOT public\.is_admin\(\)/, 'delete must be admin-only');
  assert.match(sql, /SET search_path = public/);
  assert.match(sql, /SELECT name INTO v_name[\s\S]*FOR UPDATE/);
  assert.match(sql, /FROM public\.order_items WHERE product_id = p_product_id/, 'invoice guard');
  assert.match(sql, /RAISE EXCEPTION[^\n]*فواتير/, 'clear Arabic reason when used');
  assert.match(sql, /DELETE FROM public\.inventory_transactions WHERE product_id = p_product_id/);
  assert.match(sql, /DELETE FROM public\.products WHERE id = p_product_id/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_delete_product\(BIGINT\) TO authenticated/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.admin_delete_product\(BIGINT\) FROM PUBLIC/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.admin_delete_product\(BIGINT\) FROM anon/);
  assert.ok(!/ON DELETE CASCADE/.test(sql), 'no cascade may remove invoice lines');
});

test('deleteProduct uses the guarded RPC and throws the database error', () => {
  const api = read('../src/lib/api.ts');
  const start = api.indexOf('export async function deleteProduct');
  assert.ok(start >= 0, 'deleteProduct must exist');
  const body = api.slice(start, api.indexOf('// Inventory', start));
  assert.match(body, /supabase\.rpc\('admin_delete_product', \{ p_product_id: id \}\)/);
  assert.match(body, /if \(error\) throw new Error\(error\.message\)/);
});

test('products page reports failures and helps spot slow-moving stock', () => {
  const app = read('../src/App.tsx');
  const start = app.indexOf('function ProductsPage()');
  assert.ok(start >= 0, 'ProductsPage must exist');
  const page = app.slice(start, app.indexOf('// Inventory Page', start));

  assert.match(page, /مسجّل في فواتير/, 'confirmation must explain the rule');
  assert.match(page, /deletingId/, 'disable the row while deleting');
  assert.match(page, /disabled=\{deletingId === product\.id\}/);
  assert.match(page, /\} finally \{/, 'loading flag must always clear');
  assert.match(page, /تعذّر الحفظ/, 'save failures must be visible');
  assert.match(page, /الباركود مستخدم/, 'duplicate barcode must be named');
  assert.match(page, /المخزون المنخفض/, 'low-stock filter');
  assert.match(page, /هامش الربح/, 'margin column');
});
