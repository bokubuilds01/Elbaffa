import type { Product } from '@/lib/api';
import type { useToast } from '@/components/Toast';

// Tracks product ids that already triggered a low-stock toast in the current
// session. A product is removed from this set only when its stock climbs back
// above its low_stock_limit (i.e. a restock), so a new low period can alert
// again — but within one low period it alerts only once, not on every load.
const alerted = new Set<number>();

export function checkLowStock(products: Product[], toast: ReturnType<typeof useToast>['toast']): void {
  for (const p of products) {
    if (p.stock === 0) {
      // Out of stock entirely: keep it flagged silently (no repeated toasts).
      alerted.add(p.id);
      continue;
    }
    if (p.stock <= p.lowStockLimit) {
      if (!alerted.has(p.id)) {
        alerted.add(p.id);
        toast({
          type: 'warning',
          title: `"${p.name}" قارب على النفاد`,
          description: `الكمية المتبقية ${p.stock} فقط — يُفضَّل إعادة التزويد قريباً.`,
        });
      }
    } else {
      // Restocked above the threshold → allow a future low-stock alert again.
      alerted.delete(p.id);
    }
  }
}
