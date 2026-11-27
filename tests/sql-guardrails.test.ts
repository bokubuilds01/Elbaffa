import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationPath = fileURLToPath(
  new URL('../supabase/migrations/016_shift_scope_and_admin_purge.sql', import.meta.url),
);
const sql = readFileSync(migrationPath, 'utf8');

function functionBody(name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}`);
  assert.notEqual(start, -1, `${name} is missing from the migration`);
  const end = sql.indexOf('$$;', start);
  assert.notEqual(end, -1, `${name} has no function body terminator`);
  return sql.slice(start, end);
}

test('shift aggregates include only the shift owner sales', () => {
  for (const name of ['current_shift_summary', 'handover_shift']) {
    assert.match(functionBody(name), /employee_id = v_shift\.employee_id/);
  }
});

test('shift summary exposes items_sold', () => {
  assert.match(functionBody('current_shift_summary'), /items_sold/);
});

test('destructive RPCs are admin-only', () => {
  for (const name of ['admin_delete_sales', 'admin_purge_records']) {
    assert.match(functionBody(name), /IF NOT public\.is_admin\(\) THEN/);
  }
});

test('purge deletes children before parents and keeps accounts/catalog/rooms', () => {
  const targets = ['sales', 'order_items', 'orders', 'owner_payouts',
    'inventory_transactions', 'shift_handovers', 'shifts'];
  const deleted = [...sql.matchAll(/DELETE FROM\s+(?:public\.)?(\w+)/g)].map((m) => m[1]);
  let last = -1;
  for (const table of targets) {
    const at = deleted.indexOf(table);
    assert.notEqual(at, -1, `purge must delete ${table}`);
    assert.ok(at > last, `${table} must be deleted after the previous target`);
    last = at;
  }
  for (const kept of ['users', 'products', 'rooms']) {
    assert.ok(!deleted.includes(kept), `purge must never delete ${kept}`);
  }
});

test('fast order sync and supporting indexes are installed', () => {
  assert.match(sql, /FUNCTION public\.sync_order_items/);
  assert.match(sql, /idx_orders_closed_at/);
  assert.match(sql, /idx_sales_employee_created/);
});
