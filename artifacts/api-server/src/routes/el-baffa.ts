import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  inventoryTransactionsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  roomsTable,
  salesTable,
  usersTable,
} from "@workspace/db/schema";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId ?? "seed-admin";
  req.userId = userId;
  next();
}

const money = (value: string | number | null | undefined) => Number(value ?? 0);
const productView = (p: typeof productsTable.$inferSelect) => ({
  id: p.id,
  name: p.name,
  barcode: p.barcode,
  sellingPrice: money(p.sellingPrice),
  costPrice: money(p.costPrice),
  stock: p.stock,
  category: p.category,
  image: p.image,
  lowStockLimit: p.lowStockLimit,
});

async function ensureSeed() {
  const rooms = await db.select({ id: roomsTable.id }).from(roomsTable).limit(1);
  if (rooms.length) return;
  await db.insert(usersTable).values({
    id: "seed-admin",
    name: "Kimo",
    email: "kimo@elbaffa.com",
    role: "admin",
    active: true,
  }).onConflictDoNothing();
  await db.insert(roomsTable).values(
    Array.from({ length: 11 }, (_, i) => ({ name: `Room ${i + 1}` })),
  ).onConflictDoNothing();
  await db.insert(productsTable).values([
    { name: "Pepsi", barcode: "6223000550011", sellingPrice: "25", costPrice: "18", stock: 48, category: "مشروبات", lowStockLimit: 10 },
    { name: "Chipsy", barcode: "6223000550028", sellingPrice: "20", costPrice: "14", stock: 7, category: "سناكس", lowStockLimit: 10 },
    { name: "Cake", barcode: "6223000550035", sellingPrice: "35", costPrice: "22", stock: 18, category: "حلويات", lowStockLimit: 5 },
    { name: "Juice", barcode: "6223000550042", sellingPrice: "25", costPrice: "16", stock: 24, category: "مشروبات", lowStockLimit: 8 },
    { name: "Coffee", barcode: "6223000550059", sellingPrice: "30", costPrice: "12", stock: 30, category: "مشروبات ساخنة", lowStockLimit: 8 },
    { name: "Water", barcode: "6223000550066", sellingPrice: "15", costPrice: "7", stock: 80, category: "مشروبات", lowStockLimit: 15 },
  ]).onConflictDoNothing();
}

function orderPayload(order: typeof ordersTable.$inferSelect, roomName: string, items: Array<typeof orderItemsTable.$inferSelect & { name: string }>) {
  return {
    id: order.id,
    roomId: order.roomId,
    roomName,
    status: order.status,
    total: money(order.total),
    createdAt: order.createdAt.toISOString(),
    closedAt: order.closedAt?.toISOString() ?? null,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      total: item.quantity * money(item.unitPrice),
    })),
  };
}

async function readOrder(orderId: number) {
  const order = (await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)))[0];
  if (!order) return null;
  const room = (await db.select().from(roomsTable).where(eq(roomsTable.id, order.roomId)))[0];
  const items = await db.select({
    id: orderItemsTable.id,
    orderId: orderItemsTable.orderId,
    productId: orderItemsTable.productId,
    quantity: orderItemsTable.quantity,
    unitPrice: orderItemsTable.unitPrice,
    name: productsTable.name,
  }).from(orderItemsTable)
    .innerJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
    .where(eq(orderItemsTable.orderId, orderId))
    .orderBy(asc(orderItemsTable.id));
  return orderPayload(order, room?.name ?? `Room ${order.roomId}`, items);
}

router.use(requireAuth);
router.get("/rooms", async (_req, res) => {
  await ensureSeed();
  const rooms = await db.select().from(roomsTable).orderBy(asc(roomsTable.id));
  const open = await db.select().from(ordersTable).where(eq(ordersTable.status, "open"));
  res.json(rooms.map((room) => {
    const order = open.find((item) => item.roomId === room.id);
    return { id: room.id, name: room.name, status: order ? "open" : "available", total: money(order?.total), orderId: order?.id ?? null };
  }));
});

router.get("/dashboard", async (_req, res) => {
  await ensureSeed();
  const rooms = await db.select().from(roomsTable).orderBy(asc(roomsTable.id));
  const open = await db.select().from(ordersTable).where(eq(ordersTable.status, "open"));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sales = await db.select().from(salesTable).where(gte(salesTable.createdAt, today));
  const products = await db.select().from(productsTable);
  res.json({
    todaySales: sales.reduce((sum, sale) => sum + money(sale.total), 0),
    todayOrders: sales.length,
    todayItems: 0,
    lowStockCount: products.filter((p) => p.stock <= p.lowStockLimit).length,
    monthSales: sales.reduce((sum, sale) => sum + money(sale.total), 0),
    rooms: rooms.map((room) => {
      const order = open.find((item) => item.roomId === room.id);
      return { id: room.id, name: room.name, status: order ? "open" : "available", total: money(order?.total), orderId: order?.id ?? null };
    }),
  });
});

router.post("/rooms/:roomId/orders", async (req, res) => {
  await ensureSeed();
  const roomId = Number(req.params.roomId);
  const existing = await db.select().from(ordersTable).where(and(eq(ordersTable.roomId, roomId), eq(ordersTable.status, "open")));
  if (existing[0]) return res.json(await readOrder(existing[0].id));
  const [order] = await db.insert(ordersTable).values({ roomId, employeeId: (req as any).userId, status: "open", total: "0" }).returning();
  return res.status(201).json(await readOrder(order.id));
});

router.get("/orders/:orderId", async (req, res) => {
  const order = await readOrder(Number(req.params.orderId));
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  return res.json(order);
});

router.post("/orders/:orderId/items", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const productId = Number(req.body.productId);
  const quantity = Math.max(1, Number(req.body.quantity ?? 1));
  const product = (await db.select().from(productsTable).where(eq(productsTable.id, productId)))[0];
  if (!product) return res.status(404).json({ error: "المنتج غير موجود." });
  const existing = (await db.select().from(orderItemsTable).where(and(eq(orderItemsTable.orderId, orderId), eq(orderItemsTable.productId, productId))))[0];
  if (existing) {
    await db.update(orderItemsTable).set({ quantity: existing.quantity + quantity }).where(eq(orderItemsTable.id, existing.id));
  } else {
    await db.insert(orderItemsTable).values({ orderId, productId, quantity, unitPrice: product.sellingPrice });
  }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const total = items.reduce((sum, item) => sum + item.quantity * money(item.unitPrice), 0);
  await db.update(ordersTable).set({ total: total.toFixed(2) }).where(eq(ordersTable.id, orderId));
  return res.json(await readOrder(orderId));
});

router.patch("/orders/:orderId/items/:itemId", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const quantity = Math.max(1, Number(req.body.quantity));
  await db.update(orderItemsTable).set({ quantity }).where(and(eq(orderItemsTable.id, Number(req.params.itemId)), eq(orderItemsTable.orderId, orderId)));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const total = items.reduce((sum, item) => sum + item.quantity * money(item.unitPrice), 0);
  await db.update(ordersTable).set({ total: total.toFixed(2) }).where(eq(ordersTable.id, orderId));
  res.json(await readOrder(orderId));
});

router.delete("/orders/:orderId/items/:itemId", async (req, res) => {
  const orderId = Number(req.params.orderId);
  await db.delete(orderItemsTable).where(and(eq(orderItemsTable.id, Number(req.params.itemId)), eq(orderItemsTable.orderId, orderId)));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const total = items.reduce((sum, item) => sum + item.quantity * money(item.unitPrice), 0);
  await db.update(ordersTable).set({ total: total.toFixed(2) }).where(eq(ordersTable.id, orderId));
  res.json(await readOrder(orderId));
});

router.post("/orders/:orderId/close", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const order = (await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)))[0];
  if (!order || order.status !== "open") return res.status(409).json({ error: "الطلب مغلق بالفعل." });
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  await db.transaction(async (tx) => {
    for (const item of items) {
      const product = (await tx.select().from(productsTable).where(eq(productsTable.id, item.productId)))[0];
      if (!product || product.stock < item.quantity) throw new Error("الكمية المطلوبة أكبر من المخزون المتاح.");
      await tx.update(productsTable).set({ stock: product.stock - item.quantity }).where(eq(productsTable.id, item.productId));
      await tx.insert(inventoryTransactionsTable).values({ productId: item.productId, quantity: -item.quantity, type: "sale", referenceId: orderId });
    }
    await tx.update(ordersTable).set({ status: "closed", closedAt: new Date() }).where(eq(ordersTable.id, orderId));
    await tx.insert(salesTable).values({ orderId, invoiceNumber: `INV-${String(orderId).padStart(5, "0")}`, roomId: order.roomId, employeeId: (req as any).userId, total: order.total });
  });
  const invoice = await readOrder(orderId);
  return res.json({ ...invoice, invoiceNumber: `INV-${String(orderId).padStart(5, "0")}`, employee: "Kimo" });
});

router.get("/products", async (req, res) => {
  await ensureSeed();
  const search = String(req.query.search ?? "").trim();
  const products = await db.select().from(productsTable).orderBy(asc(productsTable.name));
  res.json(products.filter((p) => !search || p.name.includes(search) || p.barcode.includes(search)).map(productView));
});

router.get("/inventory", async (_req, res) => {
  await ensureSeed();
  const products = await db.select().from(productsTable).orderBy(asc(productsTable.name));
  res.json(products.map((p) => ({ productId: p.id, name: p.name, barcode: p.barcode, stock: p.stock, sellingPrice: money(p.sellingPrice), lowStockLimit: p.lowStockLimit, status: p.stock === 0 ? "out" : p.stock <= p.lowStockLimit ? "low" : "good" })));
});

router.post("/products", async (req, res) => {
  const [product] = await db.insert(productsTable).values({
    name: req.body.name, barcode: req.body.barcode, sellingPrice: String(req.body.sellingPrice), costPrice: String(req.body.costPrice),
    stock: Number(req.body.stock), category: req.body.category, image: req.body.image ?? null, lowStockLimit: Number(req.body.lowStockLimit),
  }).returning();
  res.status(201).json(productView(product));
});

router.patch("/products/:productId", async (req, res) => {
  const id = Number(req.params.productId);
  const [product] = await db.update(productsTable).set({
    name: req.body.name, barcode: req.body.barcode, sellingPrice: String(req.body.sellingPrice), costPrice: String(req.body.costPrice),
    stock: Number(req.body.stock), category: req.body.category, image: req.body.image ?? null, lowStockLimit: Number(req.body.lowStockLimit),
  }).where(eq(productsTable.id, id)).returning();
  if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
  return res.json(productView(product));
});

router.delete("/products/:productId", async (req, res) => {
  await db.delete(productsTable).where(eq(productsTable.id, Number(req.params.productId)));
  res.status(204).end();
});

router.get("/sales", async (_req, res) => {
  await ensureSeed();
  const sales = await db.select({
    id: salesTable.id, invoiceNumber: salesTable.invoiceNumber, total: salesTable.total,
    createdAt: salesTable.createdAt, room: roomsTable.name, employee: usersTable.name,
  }).from(salesTable).innerJoin(roomsTable, eq(roomsTable.id, salesTable.roomId)).innerJoin(usersTable, eq(usersTable.id, salesTable.employeeId)).orderBy(desc(salesTable.createdAt));
  res.json(sales.map((sale) => {
    const date = sale.createdAt.toLocaleDateString("ar-EG");
    const time = sale.createdAt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    return { id: sale.id, invoiceNumber: sale.invoiceNumber, room: sale.room, employee: sale.employee, date, time, total: money(sale.total) };
  }));
});

router.get("/sales/:saleId", async (req, res) => {
  const sale = (await db.select().from(salesTable).where(eq(salesTable.id, Number(req.params.saleId))))[0];
  if (!sale) return res.status(404).json({ error: "الفاتورة غير موجودة" });
  const invoice = await readOrder(sale.orderId);
  return res.json({ ...invoice, invoiceNumber: sale.invoiceNumber, employee: "Kimo" });
});

router.get("/reports", async (_req, res) => {
  await ensureSeed();
  const sales = await db.select().from(salesTable);
  const rooms = await db.select().from(roomsTable);
  const products = await db.select().from(productsTable);
  const total = sales.reduce((sum, sale) => sum + money(sale.total), 0);
  res.json({
    today: total, yesterday: 0, week: total, month: total, totalItems: 0, totalRevenue: total,
    byRoom: rooms.map((room) => ({ label: room.name, value: sales.filter((sale) => sale.roomId === room.id).reduce((sum, sale) => sum + money(sale.total), 0) })),
    byEmployee: [{ label: "Kimo", value: total }],
    topProducts: products.slice(0, 5).map((product) => ({ label: product.name, quantity: 0 })),
  });
});

router.get("/users", async (_req, res) => {
  await ensureSeed();
  res.json(await db.select().from(usersTable).orderBy(asc(usersTable.name)));
});

export default router;