import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mapShiftSummary,
  bulkActionForSelection,
  toSyncItems,
  mapPurgeResult,
} from '../src/lib/pos-helpers.ts';

test('dashboard cards use the open shift total, not a midnight window', () => {
  assert.deepEqual(
    mapShiftSummary({
      shift: { id: 7 },
      summary: { sales_total: '1890.00', sales_count: 3, items_sold: 12 },
    }),
    { sales: 1890, orders: 3, items: 12, open: true },
  );
});

test('old RPC without items_sold still maps money and count', () => {
  assert.deepEqual(
    mapShiftSummary({ shift: { id: 7 }, summary: { sales_total: 800, sales_count: 2 } }),
    { sales: 800, orders: 2, items: 0, open: true },
  );
});

test('no open shift means zero cards', () => {
  assert.deepEqual(mapShiftSummary(null), { sales: 0, orders: 0, items: 0, open: false });
});

test('selection maps to bulk delete or full purge', () => {
  assert.equal(bulkActionForSelection(0, 5), null);
  assert.equal(bulkActionForSelection(2, 5), 'delete');
  assert.equal(bulkActionForSelection(5, 5), 'purge');
  assert.equal(bulkActionForSelection(0, 0), null);
});

test('sync payload keeps zero quantities so the RPC can remove items', () => {
  assert.deepEqual(
    toSyncItems([{ productId: 4, quantity: 0 }, { productId: 9, quantity: 2 }]),
    [{ product_id: 4, quantity: 0 }, { product_id: 9, quantity: 2 }],
  );
});

test('purge result fills missing counters with zero', () => {
  assert.deepEqual(mapPurgeResult({ sales: 3 }), {
    sales: 3, items: 0, orders: 0, payouts: 0, inventory: 0, handovers: 0, shifts: 0,
  });
});

test('API reads shift totals and exposes bulk delete without midnight math', () => {
  const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
  assert.match(api, /supabase\.rpc\('current_shift_summary'\)/);
  assert.match(api, /export async function deleteSales/);
  assert.match(api, /export async function purgeAllRecords/);
  assert.ok(!api.includes('setHours(0'), 'dashboard must not depend on local midnight');
});

test('UI shows shift cards and an admin select-all purge', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const marker of ['صافي الشيفت الحالي', 'تحديد الكل', 'حذف كل السجلات', 'bulkActionForSelection']) {
    assert.ok(app.includes(marker), `App.tsx must contain ${marker}`);
  }
});
