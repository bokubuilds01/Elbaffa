import { supabase } from '@/lib/supabase';

// ============================================================
// Pagination helper
// Supabase caps a single query at 1000 rows. Since closed orders can
// exceed that in a busy month, aggregate reads are fetched page by page.
// ============================================================
async function fetchAllRows(build: (from: number, to: number) => PromiseLike<{ data: any[] | null }>, hardLimit = 20000): Promise<any[]> {
  const rows: any[] = [];
  const size = 1000;
  for (let from = 0; from < hardLimit; from += size) {
    const { data } = await build(from, from + size - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < size) break;
  }
  return rows;
}

// ============================================================
// Types
// ============================================================
export interface Room {
  id: number;
  name: string;
  status: 'available' | 'open';
  total: number;
  orderId: number | null;
}

export interface Product {
  id: number;
  name: string;
  barcode: string;
  sellingPrice: number;
  costPrice: number;
  stock: number;
  category: string;
  image: string | null;
  lowStockLimit: number;
}

export interface OrderItem {
  id: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paidAt: string | null;
  paidQuantity: number;
}

export interface Order {
  id: number;
  roomId: number | null;
  roomName: string;
  status: 'open' | 'closed' | 'cancelled';
  total: number;
  paidTotal: number;
  items: OrderItem[];
  createdAt: string;
  closedAt: string | null;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  room: string;
  employee: string;
  date: string;
  time: string;
  total: number;
  type: 'room' | 'quick';
  paymentMethod: string | null;
  createdAt: string;
}

export interface Invoice extends Order {
  invoiceNumber: string;
  employee: string;
  paymentMethod: string | null;
  saleId: number;
}

export interface InventoryRow {
  productId: number;
  name: string;
  barcode: string;
  stock: number;
  sellingPrice: number;
  lowStockLimit: number;
  status: 'good' | 'low' | 'out';
}

export interface Dashboard {
  todaySales: number;
  todayOrders: number;
  todayItems: number;
  lowStockCount: number;
  monthSales: number;
  totalProfit: number;
  roomSales: number;
  quickSales: number;
  rooms: Room[];
}

export interface Reports {
  today: number;
  yesterday: number;
  week: number;
  month: number;
  totalItems: number;
  totalRevenue: number;
  hourly: number[];
  byRoom: Array<{ label: string; value: number }>;
  byEmployee: Array<{ label: string; value: number }>;
  topProducts: Array<{ label: string; quantity: number }>;
  topProfit: Array<{ label: string; value: number }>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  active: boolean;
  shift_type: 'morning' | 'evening' | null;
  can_handover: boolean;
  hide_profit_cards: boolean;
}

export type ShiftType = 'morning' | 'evening';

export interface ShiftSummary {
  sales_count: number;
  sales_total: number;
  cash_sales: number;
  card_sales: number;
  expected_cash: number;
}

export interface ShiftRecord {
  id: number;
  shift_type: ShiftType;
  status: 'open' | 'closed';
  opening_cash: number;
  started_at: string;
  closed_at: string | null;
}

export interface OpenShift {
  id: number;
  shift_type: ShiftType;
  opening_cash: number;
  started_at: string;
  summary: ShiftSummary;
}

export interface ShiftHandover {
  id: number;
  shiftId: number;
  employeeId: string;
  employeeName: string;
  shift_type: ShiftType;
  started_at: string;
  ended_at: string;
  sales_count: number;
  sales_total: number;
  cash_sales: number;
  card_sales: number;
  opening_cash: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  notes: string | null;
}

// ============================================================
// Helpers
// ============================================================

const num = (v: string | number | null | undefined) => Number(v ?? 0);

function buildOrderItems(rawItems: any[]): OrderItem[] {
  return rawItems.map((item: any) => ({
    id: item.id,
    productId: item.product_id,
    name: item.products?.name ?? item.name ?? '',
    quantity: item.quantity,
    unitPrice: num(item.unit_price),
    total: item.quantity * num(item.unit_price),
    paidAt: item.paid_at ?? null,
    paidQuantity: item.paid_quantity ?? 0,
  }));
}

async function readOrder(orderId: number): Promise<Order | null> {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, rooms!orders_room_id_fkey(name), order_items(*, products(name))')
    .eq('id', orderId)
    .single();
  if (orderErr || !order) return null;

  const items = buildOrderItems(order.order_items ?? []);
  const paidTotal = items.reduce((sum, item) => sum + item.paidQuantity * item.unitPrice, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return {
    id: order.id,
    roomId: order.room_id,
    roomName: order.rooms?.name ?? (order.room_id != null ? `غرفة ${order.room_id}` : 'Quick Sale'),
    status: order.status,
    total,
    paidTotal,
    items,
    createdAt: order.created_at,
    closedAt: order.closed_at ?? null,
  };
}

async function recalcOrderTotal(orderId: number): Promise<number> {
  const { data, error } = await supabase.rpc('recalc_order_total', { p_order_id: orderId });
  if (data != null && !error) return num(data);
  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, unit_price')
    .eq('order_id', orderId);
  const total = items?.reduce((sum, item) => sum + item.quantity * num(item.unit_price), 0) ?? 0;
  await supabase.from('orders').update({ total: String(total) }).eq('id', orderId);
  return total;
}

// ============================================================
// Rooms
// ============================================================
export async function listRooms(): Promise<Room[]> {
  const [roomsRes, ordersRes] = await Promise.all([
    supabase.from('rooms').select('*').is('deleted_at', null).order('id'),
    supabase.from('orders').select('id, room_id, order_items(quantity, unit_price)').eq('status', 'open'),
  ]);

  const rooms = roomsRes.data ?? [];
  const openOrders = ordersRes.data ?? [];

  return rooms.map((room) => {
    const order = openOrders.find((o) => o.room_id === room.id);
    const total = (order?.order_items ?? []).reduce(
      (sum, item) => sum + item.quantity * num(item.unit_price),
      0
    );
    return {
      id: room.id,
      name: room.name,
      status: order ? 'open' : 'available',
      total,
      orderId: order?.id ?? null,
    };
  });
}

export async function createRoom(name: string): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ name })
    .select()
    .single();
  if (error) {
    if (String(error.message).includes('duplicate')) throw new Error('اسم الغرفة موجود بالفعل');
    throw error;
  }
  return { id: data.id, name: data.name, status: 'available', total: 0, orderId: null };
}

export async function deleteRoom(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_room', { p_room_id: id });
  if (error) throw new Error(error.message);
}

// ============================================================
// Orders
// ============================================================
export async function openRoomOrder(roomId: number): Promise<Order> {
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('room_id', roomId)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();

  if (existing) return (await readOrder(existing.id))!;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: order } = await supabase
    .from('orders')
    .insert({ room_id: roomId, employee_id: user?.id, status: 'open', total: 0 })
    .select()
    .single();

  return (await readOrder(order!.id))!;
}

export async function getOrder(orderId: number): Promise<Order | null> {
  return readOrder(orderId);
}

export async function addOrderItem(orderId: number, productId: number, quantity: number = 1): Promise<Order> {
  const { data: product } = await supabase
    .from('products')
    .select('id, name, selling_price')
    .eq('id', productId)
    .single();
  if (!product) throw new Error('المنتج غير موجود');

  const { data: existing } = await supabase
    .from('order_items')
    .select('id, quantity')
    .eq('order_id', orderId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('order_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('order_items')
      .insert({ order_id: orderId, product_id: productId, quantity, unit_price: product.selling_price });
  }

  await recalcOrderTotal(orderId);
  return (await readOrder(orderId))!;
}

export async function updateOrderItem(orderId: number, itemId: number, quantity: number): Promise<Order> {
  if (quantity < 1) {
    await supabase.from('order_items').delete().eq('id', itemId).eq('order_id', orderId);
  } else {
    await supabase.from('order_items').update({ quantity }).eq('id', itemId).eq('order_id', orderId);
  }

  await recalcOrderTotal(orderId);
  return (await readOrder(orderId))!;
}

export async function removeOrderItem(orderId: number, itemId: number): Promise<Order> {
  await supabase.from('order_items').delete().eq('id', itemId).eq('order_id', orderId);
  await recalcOrderTotal(orderId);
  return (await readOrder(orderId))!;
}

export async function syncOrderItems(orderId: number, items: Array<{ productId: number; quantity: number }>): Promise<Order> {
  const { data: existing } = await supabase
    .from('order_items')
    .select('id, product_id')
    .eq('order_id', orderId);

  const existingByProduct = new Map<number, number>((existing ?? []).map((item: any) => [item.product_id, item.id]));

  // Batch-fetch prices for any brand-new products in a single query.
  const newProductIds = Array.from(new Set(items.filter((i) => !existingByProduct.has(i.productId) && i.quantity > 0).map((i) => i.productId)));
  let priceByProduct: Record<number, number> = {};
  if (newProductIds.length) {
    const { data: newProducts } = await supabase
      .from('products')
      .select('id, selling_price')
      .in('id', newProductIds);
    priceByProduct = Object.fromEntries((newProducts ?? []).map((p) => [p.id, Number(p.selling_price)]));
  }

  await Promise.all(
    items.map(async ({ productId, quantity }) => {
      const itemId = existingByProduct.get(productId);
      if (itemId !== undefined) {
        if (quantity < 1) {
          await supabase.from('order_items').delete().eq('id', itemId);
        } else {
          await supabase.from('order_items').update({ quantity }).eq('id', itemId);
        }
        existingByProduct.delete(productId);
      } else if (quantity > 0) {
        const unitPrice = priceByProduct[productId];
        if (unitPrice !== undefined) {
          await supabase
            .from('order_items')
            .insert({ order_id: orderId, product_id: productId, quantity, unit_price: unitPrice });
        }
      }
    })
  );

  await Promise.all(
    Array.from(existingByProduct.entries()).map(async ([productId, itemId]) => {
      await supabase.from('order_items').delete().eq('id', itemId);
    })
  );

  await recalcOrderTotal(orderId);
  return (await readOrder(orderId))!;
}

export async function setOrderItemPaidQty(orderId: number, itemId: number, paidQuantity: number): Promise<Order> {
  await supabase
    .from('order_items')
    .update({ paid_quantity: paidQuantity, paid_at: paidQuantity > 0 ? new Date().toISOString() : null })
    .eq('id', itemId)
    .eq('order_id', orderId);
  return (await readOrder(orderId))!;
}

export async function transferOrder(orderId: number, targetRoomId: number): Promise<Order> {
  const { error } = await supabase.rpc('transfer_order', {
    p_order_id: orderId,
    p_target_room_id: targetRoomId,
  });
  if (error) throw new Error(error.message);
  return (await readOrder(orderId))!;
}

export async function quickSale(
  items: Array<{ productId: number; quantity: number }>,
  paymentMethod: 'cash' | 'card' = 'cash',
): Promise<{ orderId: number; saleId: number; invoiceNumber: string; total: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
  const { data, error } = await supabase.rpc('create_quick_sale', {
    p_employee_id: user?.id,
    p_items: payload,
    p_payment_method: paymentMethod,
  });
  if (error) throw new Error(error.message);
  return data as { orderId: number; saleId: number; invoiceNumber: string; total: number };
}

export async function getMostUsedProducts(limit = 6): Promise<Product[]> {
  const { data, error } = await supabase.rpc('top_sold_products', { p_limit: limit });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    sellingPrice: num(p.selling_price),
    costPrice: num(p.cost_price),
    stock: p.stock,
    category: p.category,
    image: null,
    lowStockLimit: p.low_stock_limit,
  }));
}

export async function setHideProfitCards(hidden: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_hide_profit_cards', { p_hidden: hidden });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function currentUserName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
  return data?.name ?? null;
}

export async function closeOrder(orderId: number): Promise<Invoice> {
  const { data, error } = await supabase.rpc('close_room_order', { p_order_id: orderId });
  if (error) throw new Error(error.message);

  const employee = await currentUserName();
  const invoice = (await readOrder(orderId))!;
  return {
    ...invoice,
    saleId: num(data?.sale_id),
    invoiceNumber: data?.invoice_number ?? `INV-${String(orderId).padStart(5, '0')}`,
    employee: employee ?? 'موظف',
    paymentMethod: null,
  };
}

// ============================================================
// Products
// ============================================================
export async function listProducts(search?: string): Promise<Product[]> {
  let query = supabase.from('products').select('id, name, barcode, selling_price, cost_price, stock, category, image, low_stock_limit').order('name');
  if (search) {
    query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`);
  }
  const { data } = await query;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    sellingPrice: num(p.selling_price),
    costPrice: num(p.cost_price),
    stock: p.stock,
    category: p.category,
    image: p.image,
    lowStockLimit: p.low_stock_limit,
  }));
}

export async function createProduct(input: Omit<Product, 'id'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      barcode: input.barcode,
      selling_price: input.sellingPrice,
      cost_price: input.costPrice,
      stock: input.stock,
      category: input.category,
      image: input.image,
      low_stock_limit: input.lowStockLimit,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    barcode: data.barcode,
    sellingPrice: num(data.selling_price),
    costPrice: num(data.cost_price),
    stock: data.stock,
    category: data.category,
    image: data.image,
    lowStockLimit: data.low_stock_limit,
  };
}

export async function updateProduct(id: number, input: Partial<Omit<Product, 'id'>>): Promise<Product> {
  const update: any = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.barcode !== undefined) update.barcode = input.barcode;
  if (input.sellingPrice !== undefined) update.selling_price = input.sellingPrice;
  if (input.costPrice !== undefined) update.cost_price = input.costPrice;
  if (input.stock !== undefined) update.stock = input.stock;
  if (input.category !== undefined) update.category = input.category;
  if (input.image !== undefined) update.image = input.image;
  if (input.lowStockLimit !== undefined) update.low_stock_limit = input.lowStockLimit;

  const { data, error } = await supabase
    .from('products')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    barcode: data.barcode,
    sellingPrice: num(data.selling_price),
    costPrice: num(data.cost_price),
    stock: data.stock,
    category: data.category,
    image: data.image,
    lowStockLimit: data.low_stock_limit,
  };
}

export async function deleteProduct(id: number): Promise<void> {
  await supabase.from('products').delete().eq('id', id);
}

// ============================================================
// Inventory
// ============================================================
export async function listInventory(): Promise<InventoryRow[]> {
  const { data } = await supabase.from('products').select('id, name, barcode, stock, selling_price, low_stock_limit').order('name');
  return (data ?? []).map((p) => ({
    productId: p.id,
    name: p.name,
    barcode: p.barcode,
    stock: p.stock,
    sellingPrice: num(p.selling_price),
    lowStockLimit: p.low_stock_limit,
    status: p.stock === 0 ? 'out' : p.stock <= p.low_stock_limit ? 'low' : 'good',
  }));
}

// ============================================================
// Sales
// ============================================================
export async function listSales(): Promise<Sale[]> {
  const { data } = await supabase
    .from('sales')
    .select('id, invoice_number, total, created_at, room_id, payment_method, rooms!sales_room_id_fkey(name), users!sales_employee_id_fkey(name)')
    .order('created_at', { ascending: false });
  return (data ?? []).map((sale) => {
    const d = new Date(sale.created_at);
    const isQuick = sale.room_id == null;
    return {
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      room: isQuick ? 'Quick Sale' : (sale.rooms as any)?.name ?? 'غرفة',
      employee: (sale.users as any)?.name ?? 'موظف',
      date: d.toLocaleDateString('ar-EG-u-nu-latn'),
      time: d.toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
      total: num(sale.total),
      type: isQuick ? 'quick' : 'room',
      paymentMethod: sale.payment_method ?? null,
      createdAt: sale.created_at,
    };
  });
}

export async function getSale(saleId: number): Promise<Invoice | null> {
  const { data: sale } = await supabase
    .from('sales')
    .select('id, invoice_number, order_id, payment_method, users!sales_employee_id_fkey(name)')
    .eq('id', saleId)
    .single();
  if (!sale) return null;

  const order = await readOrder(sale.order_id);
  if (!order) return null;

  return {
    ...order,
    saleId: num(sale.id),
    invoiceNumber: sale.invoice_number,
    employee: (sale.users as any)?.name ?? 'موظف',
    paymentMethod: sale.payment_method ?? null,
  };
}

export async function deleteSale(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_sale', { p_sale_id: id });
  if (error) throw new Error(error.message);
}

// ============================================================
// Dashboard
// ============================================================
export async function getDashboard(): Promise<Dashboard> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [salesRes, productsRes, rooms, closedOrders] = await Promise.all([
    supabase.from('sales').select('total, created_at, room_id').gte('created_at', monthStart.toISOString()),
    supabase.from('products').select('stock, low_stock_limit'),
    listRooms(),
    fetchAllRows((from, to) =>
      supabase
        .from('orders')
        .select('created_at, closed_at, order_items(quantity, unit_price, products(cost_price))')
        .eq('status', 'closed')
        .gte('closed_at', monthStart.toISOString())
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  const monthSales = salesRes.data ?? [];
  const todaySales = monthSales.filter((s) => new Date(s.created_at) >= today)
    .reduce((sum, s) => sum + num(s.total), 0);
  const monthTotal = monthSales.reduce((sum, s) => sum + num(s.total), 0);
  const roomSales = monthSales.filter((s) => s.room_id != null).reduce((sum, s) => sum + num(s.total), 0);
  const quickSales = monthSales.filter((s) => s.room_id == null).reduce((sum, s) => sum + num(s.total), 0);

  let totalProfit = 0;
  let todayItems = 0;
  for (const order of (closedOrders ?? []) as any[]) {
    const isToday = new Date(order.created_at) >= today;
    for (const item of (order.order_items ?? []) as any[]) {
      const qty = num(item.quantity);
      const unitPrice = num(item.unit_price);
      const cost = num(item.products?.cost_price);
      totalProfit += (unitPrice - cost) * qty;
      if (isToday) todayItems += qty;
    }
  }

  return {
    todaySales,
    todayOrders: monthSales.filter((s) => new Date(s.created_at) >= today).length,
    todayItems,
    lowStockCount: productsRes.data?.filter((p) => p.stock <= p.low_stock_limit).length ?? 0,
    monthSales: monthTotal,
    totalProfit,
    roomSales,
    quickSales,
    rooms,
  };
}

// ============================================================
// Reports
// ============================================================
export async function getReports(): Promise<Reports> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const [salesRes, roomsRes, usersRes, ordersRes] = await Promise.all([
    supabase.from('sales').select('id, total, room_id, employee_id, created_at').gte('created_at', startOfMonth.toISOString()),
    supabase.from('rooms').select('id, name').is('deleted_at', null),
    supabase.from('users').select('id, name'),
    fetchAllRows((from, to) =>
      supabase
        .from('orders')
        .select('closed_at, order_items(quantity, unit_price, products(name, cost_price))')
        .eq('status', 'closed')
        .gte('closed_at', startOfMonth.toISOString())
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  const sales = salesRes.data ?? [];
  const num = (v: any) => Number(v ?? 0);
  const sumIn = (from: Date, to: Date) =>
    sales
      .filter((s) => {
        const d = new Date(s.created_at);
        return d >= from && d <= to;
      })
      .reduce((acc, s) => acc + num(s.total), 0);

  const yesterday = new Date(startOfDay);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEnd = new Date(startOfDay);
  yesterdayEnd.setMilliseconds(-1);

  const productsMap = new Map<string, { label: string; quantity: number; profit: number }>();
  let totalItems = 0;
  for (const order of (ordersRes ?? []) as any[]) {
    for (const item of (order.order_items ?? []) as any[]) {
      const qty = num(item.quantity);
      const unitPrice = num(item.unit_price);
      const cost = num(item.products?.cost_price);
      const name = item.products?.name ?? 'منتج';
      totalItems += qty;
      const entry = productsMap.get(name) ?? { label: name, quantity: 0, profit: 0 };
      entry.quantity += qty;
      entry.profit += (unitPrice - cost) * qty;
      productsMap.set(name, entry);
    }
  }

  const orderedBefore = [...productsMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  const topProducts = orderedBefore.map(({ label, quantity }) => ({ label, quantity }));
  const topProfit = [...productsMap.values()].sort((a, b) => b.profit - a.profit).slice(0, 10).map(({ label, profit }) => ({ label, value: profit }));

  const hourly = Array.from({ length: 12 }, () => 0);
  const hourMs = 60 * 60 * 1000;
  for (const s of sales) {
    const dx = (now.getTime() - new Date(s.created_at).getTime()) / hourMs;
    if (dx >= 0 && dx < 12) {
      hourly[Math.floor(dx)] += num(s.total);
    }
  }
  hourly.reverse();

  return {
    today: sumIn(startOfDay, now),
    yesterday: sumIn(yesterday, yesterdayEnd),
    week: sumIn(startOfWeek, now),
    month: sumIn(startOfMonth, now),
    totalItems,
    totalRevenue: sales.reduce((sum, s) => sum + num(s.total), 0),
    hourly,
    byRoom: (roomsRes.data ?? [])
      .map((room) => ({
        label: room.name,
        value: sales
          .filter((s) => s.room_id === room.id)
          .reduce((sum, s) => sum + num(s.total), 0),
      }))
      .filter((r) => r.value > 0),
    byEmployee: (usersRes.data ?? [])
      .map((user) => ({
        label: user.name,
        value: sales
          .filter((s) => s.employee_id === user.id)
          .reduce((sum, s) => sum + num(s.total), 0),
      }))
      .filter((r) => r.value > 0),
    topProducts,
    topProfit,
  };
}

// ============================================================
// Owner profit account (admin): month profit + payouts + Excel rows
// ============================================================
export interface OwnerProfit {
  earned: number;
  paid: number;
  balance: number;
}

export interface OwnerPayout {
  id: number;
  amount: number;
  note: string | null;
  employee: string;
  createdAt: string;
}

export interface ProfitRow {
  date: string;
  invoice: string;
  product: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  profit: number;
}

export async function getOwnerProfit(): Promise<OwnerProfit> {
  const { data, error } = await supabase.rpc('get_owner_profit');
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as any;
  return { earned: num(d.earned), paid: num(d.paid), balance: num(d.balance) };
}

export async function listOwnerPayouts(): Promise<OwnerPayout[]> {
  const { data } = await supabase
    .from('owner_payouts')
    .select('id, amount, note, created_at, users!owner_payouts_employee_id_fkey(name)')
    .order('created_at', { ascending: false });
  return (data ?? []).map((p) => ({
    id: p.id,
    amount: num(p.amount),
    note: p.note,
    employee: (p.users as any)?.name ?? 'موظف',
    createdAt: p.created_at,
  }));
}

export async function addOwnerPayout(amount: number, note?: string): Promise<void> {
  const { error } = await supabase.rpc('add_owner_payout', { p_amount: amount, p_note: note || null });
  if (error) throw new Error(error.message);
}

export async function deleteOwnerPayout(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_owner_payout', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function exportProfitRows(): Promise<{ rows: ProfitRow[]; month: string }> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = startOfMonth.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' });

  const orders = await fetchAllRows((from, to) =>
    supabase
      .from('orders')
      .select('closed_at, order_items(quantity, unit_price, products(name, cost_price))')
      .eq('status', 'closed')
      .gte('closed_at', startOfMonth.toISOString())
      .order('id', { ascending: true })
      .range(from, to),
  );

  const invRes = await supabase
    .from('sales')
    .select('order_id, invoice_number')
    .gte('created_at', startOfMonth.toISOString());
  const invoiceByOrder = new Map<number, string>();
  for (const s of invRes.data ?? []) invoiceByOrder.set(s.order_id, s.invoice_number);

  const rows: ProfitRow[] = [];
  for (const order of orders as any[]) {
    for (const item of (order.order_items ?? []) as any[]) {
      const qty = num(item.quantity);
      const unitPrice = num(item.unit_price);
      const costPrice = num(item.products?.cost_price);
      rows.push({
        date: new Date(order.closed_at).toLocaleDateString('ar-EG-u-nu-latn'),
        invoice: invoiceByOrder.get(order.id) ?? '',
        product: item.products?.name ?? 'منتج',
        quantity: qty,
        unitPrice,
        costPrice,
        profit: (unitPrice - costPrice) * qty,
      });
    }
  }
  return { rows, month: monthLabel };
}

// ============================================================
// Users
// ============================================================
export async function listUsers(): Promise<UserProfile[]> {
  const { data } = await supabase.from('users').select('id, name, email, role, active, shift_type, can_handover, hide_profit_cards').order('name');
  return (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    shift_type: u.shift_type,
    can_handover: u.can_handover,
    hide_profit_cards: u.hide_profit_cards,
  }));
}

export async function createUser(input: { name: string; email: string; password: string; role: 'admin' | 'employee'; shift_type?: ShiftType | null; can_handover?: boolean }): Promise<UserProfile> {
  const { data: { session: adminSession } } = await supabase.auth.getSession();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name, role: input.role } },
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error('لم يتم إنشاء الحساب، حاول مرة أخرى');

  if (adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }

  const { data, error } = await supabase.rpc('upsert_user_profile', {
    p_id: authData.user.id,
    p_name: input.name,
    p_email: input.email,
    p_role: input.role,
  });
  if (error) throw error;

  await supabase.from('users').update({
    shift_type: input.shift_type ?? null,
    can_handover: input.can_handover ?? false,
  }).eq('id', authData.user.id);

  if (adminSession) {
    const { data: { user: current } } = await supabase.auth.getUser();
    if (!current || current.id !== adminSession.user.id) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }
  }

  return data as UserProfile;
}

export async function updateUser(id: string, input: Partial<Pick<UserProfile, 'name' | 'role' | 'active' | 'shift_type' | 'can_handover'>>): Promise<void> {
  const update: any = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.role !== undefined) update.role = input.role;
  if (input.active !== undefined) update.active = input.active;
  if (input.shift_type !== undefined) update.shift_type = input.shift_type;
  if (input.can_handover !== undefined) update.can_handover = input.can_handover;
  await supabase.from('users').update(update).eq('id', id);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', { p_id: id });
  if (error) {
    await supabase.from('users').delete().eq('id', id);
  }
}

// ============================================================
// Shift handover
// ============================================================
export async function openShift(openingCash = 0): Promise<void> {
  const { error } = await supabase.rpc('open_shift', { p_opening_cash: openingCash });
  if (error) throw new Error(error.message);
}

export async function getCurrentShift(): Promise<OpenShift | null> {
  const { data, error } = await supabase.rpc('current_shift_summary');
  if (error) throw new Error(error.message);
  if (!data) return null;
  const shift = (data as any).shift;
  const summary = (data as any).summary;
  return {
    id: shift?.id,
    shift_type: shift?.shift_type,
    opening_cash: num(shift?.opening_cash),
    started_at: shift?.started_at,
    summary: {
      sales_count: summary?.sales_count ?? 0,
      sales_total: num(summary?.sales_total),
      cash_sales: num(summary?.cash_sales),
      card_sales: num(summary?.card_sales),
      expected_cash: num(summary?.expected_cash),
    },
  };
}

export async function handoverShift(countedCash: number, notes?: string): Promise<ShiftHandover> {
  const { data, error } = await supabase.rpc('handover_shift', {
    p_counted_cash: countedCash,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  const raw = data as any;
  return {
    id: raw?.id,
    shiftId: raw?.shift_id,
    employeeId: '',
    employeeName: '',
    shift_type: raw?.shift_type,
    started_at: raw?.started_at,
    ended_at: raw?.ended_at,
    sales_count: raw?.sales_count ?? 0,
    sales_total: num(raw?.sales_total),
    cash_sales: num(raw?.cash_sales),
    card_sales: num(raw?.card_sales),
    opening_cash: num(raw?.opening_cash),
    expected_cash: num(raw?.expected_cash),
    counted_cash: num(raw?.counted_cash),
    difference: num(raw?.difference),
    notes: raw?.notes ?? null,
  };
}

export async function listOpenShifts(): Promise<Array<{ id: number; employee: string; shift_type: ShiftType; opening_cash: number; started_at: string }>> {
  const { data } = await supabase
    .from('shifts')
    .select('id, employee_id, shift_type, opening_cash, started_at, users!shifts_employee_id_fkey(name)')
    .eq('status', 'open')
    .order('started_at');
  return (data ?? []).map((s) => ({
    id: s.id,
    employee: (s.users as any)?.name ?? 'موظف',
    shift_type: s.shift_type,
    opening_cash: num(s.opening_cash),
    started_at: s.started_at,
  }));
}

export async function listHandovers(employeeId?: string): Promise<ShiftHandover[]> {
  let query = supabase
    .from('shift_handovers')
    .select('id, shift_id, employee_id, shift_type, started_at, ended_at, sales_count, sales_total, cash_sales, card_sales, opening_cash, expected_cash, counted_cash, difference, notes, users!shift_handovers_employee_id_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data } = await query;
  return (data ?? []).map((h) => ({
    id: h.id,
    shiftId: h.shift_id,
    employeeId: h.employee_id,
    employeeName: (h.users as any)?.name ?? 'موظف',
    shift_type: h.shift_type,
    started_at: h.started_at,
    ended_at: h.ended_at,
    sales_count: h.sales_count,
    sales_total: num(h.sales_total),
    cash_sales: num(h.cash_sales),
    card_sales: num(h.card_sales),
    opening_cash: num(h.opening_cash),
    expected_cash: num(h.expected_cash),
    counted_cash: num(h.counted_cash),
    difference: num(h.difference),
    notes: h.notes ?? null,
  }));
}
