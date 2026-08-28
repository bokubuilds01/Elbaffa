import { supabase } from '@/lib/supabase';

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
}

export interface Order {
  id: number;
  roomId: number;
  roomName: string;
  status: 'open' | 'closed' | 'cancelled';
  total: number;
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
}

export interface Invoice extends Order {
  invoiceNumber: string;
  employee: string;
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
  rooms: Room[];
}

export interface Reports {
  today: number;
  yesterday: number;
  week: number;
  month: number;
  totalItems: number;
  totalRevenue: number;
  byRoom: Array<{ label: string; value: number }>;
  byEmployee: Array<{ label: string; value: number }>;
  topProducts: Array<{ label: string; quantity: number }>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  active: boolean;
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

  return {
    id: order.id,
    roomId: order.room_id,
    roomName: order.rooms?.name ?? `غرفة ${order.room_id}`,
    status: order.status,
    total: num(order.total),
    items,
    createdAt: order.created_at,
    closedAt: order.closed_at ?? null,
  };
}

async function recalcOrderTotal(orderId: number): Promise<number> {
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
    supabase.from('rooms').select('*').order('id'),
    supabase.from('orders').select('id, room_id, total').eq('status', 'open'),
  ]);

  const rooms = roomsRes.data ?? [];
  const openOrders = ordersRes.data ?? [];

  return rooms.map((room) => {
    const order = openOrders.find((o) => o.room_id === room.id);
    return {
      id: room.id,
      name: room.name,
      status: order ? 'open' : 'available',
      total: num(order?.total),
      orderId: order?.id ?? null,
    };
  });
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
        const { data: product } = await supabase
          .from('products')
          .select('name, selling_price')
          .eq('id', productId)
          .single();
        if (product) {
          await supabase
            .from('order_items')
            .insert({ order_id: orderId, product_id: productId, quantity, unit_price: product.selling_price });
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

export async function closeOrder(orderId: number): Promise<Invoice> {
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name, stock))')
    .eq('id', orderId)
    .single();
  if (!order || order.status !== 'open') throw new Error('الطلب مغلق بالفعل');

  const items = order.order_items ?? [];

  for (const item of items) {
    const stock = item.products?.stock ?? 0;
    if (stock < item.quantity) {
      throw new Error(`${item.products?.name}: الكمية المطلوبة (${item.quantity}) أكبر من المخزون (${stock})`);
    }
  }

  await Promise.all([
    ...items.map((item: any) =>
      Promise.all([
        supabase
          .from('products')
          .update({ stock: item.products.stock - item.quantity })
          .eq('id', item.product_id),
        supabase
          .from('inventory_transactions')
          .insert({ product_id: item.product_id, quantity: -item.quantity, type: 'sale', reference_id: orderId }),
      ])
    ),
    supabase
      .from('orders')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', orderId),
  ]);

  const { data: { user } } = await supabase.auth.getUser();
  const invoiceNumber = `INV-${String(orderId).padStart(5, '0')}`;
  await supabase
    .from('sales')
    .insert({ order_id: orderId, invoice_number: invoiceNumber, room_id: order.room_id, employee_id: user?.id, total: order.total });

  const invoice = (await readOrder(orderId))!;
  return { ...invoice, invoiceNumber, employee: 'Kimo' };
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
    .select('id, invoice_number, total, created_at, room_id, rooms!sales_room_id_fkey(name), users!sales_employee_id_fkey(name)')
    .order('created_at', { ascending: false });
  return (data ?? []).map((sale) => {
    const d = new Date(sale.created_at);
    return {
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      room: (sale.rooms as any)?.name ?? 'غرفة',
      employee: (sale.users as any)?.name ?? 'موظف',
      date: d.toLocaleDateString('ar-EG'),
      time: d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      total: num(sale.total),
    };
  });
}

export async function getSale(saleId: number): Promise<Invoice | null> {
  const { data: sale } = await supabase
    .from('sales')
    .select('id, invoice_number, order_id')
    .eq('id', saleId)
    .single();
  if (!sale) return null;

  const order = await readOrder(sale.order_id);
  if (!order) return null;

  return {
    ...order,
    invoiceNumber: sale.invoice_number,
    employee: 'Kimo',
  };
}

export async function deleteSale(id: number): Promise<void> {
  await supabase.from('sales').delete().eq('id', id);
}

// ============================================================
// Dashboard
// ============================================================
export async function getDashboard(): Promise<Dashboard> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [salesRes, productsRes, rooms] = await Promise.all([
    supabase.from('sales').select('total').gte('created_at', today.toISOString()),
    supabase.from('products').select('stock, low_stock_limit'),
    listRooms(),
  ]);

  return {
    todaySales: salesRes.data?.reduce((sum, s) => sum + num(s.total), 0) ?? 0,
    todayOrders: salesRes.data?.length ?? 0,
    todayItems: 0,
    lowStockCount: productsRes.data?.filter((p) => p.stock <= p.low_stock_limit).length ?? 0,
    monthSales: salesRes.data?.reduce((sum, s) => sum + num(s.total), 0) ?? 0,
    rooms,
  };
}

// ============================================================
// Reports
// ============================================================
export async function getReports(): Promise<Reports> {
  const [salesRes, roomsRes, productsRes, usersRes] = await Promise.all([
    supabase.from('sales').select('id, total, room_id, employee_id'),
    supabase.from('rooms').select('id, name'),
    supabase.from('products').select('name'),
    supabase.from('users').select('id, name'),
  ]);

  const sales = salesRes.data ?? [];
  const total = sales.reduce((sum, s) => sum + num(s.total), 0);

  return {
    today: total,
    yesterday: 0,
    week: total,
    month: total,
    totalItems: 0,
    totalRevenue: total,
    byRoom: (roomsRes.data ?? []).map((room) => ({
      label: room.name,
      value: sales.filter((s) => s.room_id === room.id).reduce((sum, s) => sum + num(s.total), 0),
    })),
    byEmployee: (usersRes.data ?? []).map((user) => ({
      label: user.name,
      value: sales.filter((s) => s.employee_id === user.id).reduce((sum, s) => sum + num(s.total), 0),
    })),
    topProducts: (productsRes.data ?? []).slice(0, 5).map((p) => ({
      label: p.name,
      quantity: 0,
    })),
  };
}

// ============================================================
// Users
// ============================================================
export async function listUsers(): Promise<UserProfile[]> {
  const { data } = await supabase.from('users').select('id, name, email, role, active').order('name');
  return (data ?? []) as UserProfile[];
}

export async function createUser(input: { name: string; email: string; password: string; role: 'admin' | 'employee' }): Promise<UserProfile> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (authError) throw authError;

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authData.user!.id,
      name: input.name,
      email: input.email,
      role: input.role,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function updateUser(id: string, input: Partial<Pick<UserProfile, 'name' | 'role' | 'active'>>): Promise<void> {
  await supabase.from('users').update(input).eq('id', id);
}

export async function deleteUser(id: string): Promise<void> {
  await supabase.from('users').delete().eq('id', id);
}
