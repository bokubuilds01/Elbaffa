// Pure helpers shared by the dashboard, sales and room screens.
// Keeping these free of Supabase imports makes the cashier rules testable.

export interface ShiftNumbers {
  sales: number;
  orders: number;
  items: number;
  open: boolean;
}

export interface PurgeCounts {
  sales: number;
  items: number;
  orders: number;
  payouts: number;
  inventory: number;
  handovers: number;
  shifts: number;
}

export type BulkAction = 'purge' | 'delete' | null;

const asNumber = (value: unknown): number => Number(value ?? 0);

export function mapShiftSummary(raw: any): ShiftNumbers {
  const summary = raw?.summary;
  return {
    sales: asNumber(summary?.sales_total),
    orders: asNumber(summary?.sales_count),
    items: asNumber(summary?.items_sold),
    open: Boolean(raw?.shift?.id),
  };
}

export function bulkActionForSelection(selectedCount: number, visibleCount: number): BulkAction {
  if (selectedCount <= 0 || visibleCount <= 0) return null;
  return selectedCount >= visibleCount ? 'purge' : 'delete';
}

export function toSyncItems(items: Array<{ productId: number; quantity: number }>): Array<{ product_id: number; quantity: number }> {
  return items.map((item) => ({ product_id: item.productId, quantity: item.quantity }));
}

export function mapPurgeResult(raw: any): PurgeCounts {
  return {
    sales: asNumber(raw?.sales),
    items: asNumber(raw?.items),
    orders: asNumber(raw?.orders),
    payouts: asNumber(raw?.payouts),
    inventory: asNumber(raw?.inventory),
    handovers: asNumber(raw?.handovers),
    shifts: asNumber(raw?.shifts),
  };
}
