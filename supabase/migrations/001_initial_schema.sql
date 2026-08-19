-- ============================================================
-- El BAFFA - Initial Database Schema for Supabase
-- ============================================================

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'employee');
CREATE TYPE order_status AS ENUM ('open', 'closed', 'cancelled');

-- 2. USERS TABLE (linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'employee',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ROOMS TABLE (11 fixed rooms)
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 4. PRODUCTS TABLE
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  barcode TEXT NOT NULL UNIQUE,
  selling_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  image TEXT,
  low_stock_limit INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ORDERS TABLE
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  employee_id UUID NOT NULL REFERENCES users(id),
  status order_status NOT NULL DEFAULT 'open',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- 6. ORDER ITEMS TABLE
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL
);

-- 7. SALES TABLE
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  invoice_number TEXT NOT NULL UNIQUE,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  employee_id UUID NOT NULL REFERENCES users(id),
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. INVENTORY TRANSACTIONS TABLE
CREATE TABLE inventory_transactions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_orders_room_id ON orders(room_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_employee_id ON orders(employee_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_sales_room_id ON sales(room_id);
CREATE INDEX idx_sales_employee_id ON sales(employee_id);
CREATE INDEX idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_inventory_transactions_product_id ON inventory_transactions(product_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if current user is active employee
CREATE OR REPLACE FUNCTION public.is_active_employee()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- USERS: Admin full access, employees read own profile
CREATE POLICY "users_admin_all" ON users FOR ALL USING (public.is_admin());
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_authenticated_read" ON users FOR SELECT USING (public.is_active_employee());

-- ROOMS: All authenticated users can read, admin can manage
CREATE POLICY "rooms_read" ON rooms FOR SELECT USING (public.is_active_employee());
CREATE POLICY "rooms_admin_manage" ON rooms FOR ALL USING (public.is_admin());

-- PRODUCTS: All authenticated users can read, admin can manage
CREATE POLICY "products_read" ON products FOR SELECT USING (public.is_active_employee());
CREATE POLICY "products_admin_insert" ON products FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "products_admin_update" ON products FOR UPDATE USING (public.is_admin());
CREATE POLICY "products_admin_delete" ON products FOR DELETE USING (public.is_admin());

-- ORDERS: All authenticated users can read and create, admin can do all
CREATE POLICY "orders_read" ON orders FOR SELECT USING (public.is_active_employee());
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (public.is_active_employee());
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (public.is_active_employee());
CREATE POLICY "orders_admin_delete" ON orders FOR DELETE USING (public.is_admin());

-- ORDER ITEMS: All authenticated users can read and manage
CREATE POLICY "order_items_read" ON order_items FOR SELECT USING (public.is_active_employee());
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (public.is_active_employee());
CREATE POLICY "order_items_update" ON order_items FOR UPDATE USING (public.is_active_employee());
CREATE POLICY "order_items_delete" ON order_items FOR DELETE USING (public.is_active_employee());

-- SALES: All authenticated users can read, admin can manage
CREATE POLICY "sales_read" ON sales FOR SELECT USING (public.is_active_employee());
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (public.is_active_employee());
CREATE POLICY "sales_admin_delete" ON sales FOR DELETE USING (public.is_admin());

-- INVENTORY TRANSACTIONS: All authenticated users can read, admin can manage
CREATE POLICY "inventory_read" ON inventory_transactions FOR SELECT USING (public.is_active_employee());
CREATE POLICY "inventory_insert" ON inventory_transactions FOR INSERT WITH CHECK (public.is_active_employee());

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert rooms (11 rooms)
INSERT INTO rooms (name) VALUES
  ('غرفة 01'), ('غرفة 02'), ('غرفة 03'), ('غرفة 04'), ('غرفة 05'),
  ('غرفة 06'), ('غرفة 07'), ('غرفة 08'), ('غرفة 09'), ('غرفة 10'),
  ('غرفة 11');

-- Insert products
INSERT INTO products (name, barcode, selling_price, cost_price, stock, category, low_stock_limit) VALUES
  ('قهوة تركي', '6223008100012', 42, 17, 86, 'مشروبات ساخنة', 20),
  ('لاتيه فانيليا', '6223008100013', 68, 27, 34, 'مشروبات ساخنة', 15),
  ('مياه معدنية', '6223008100014', 18, 7, 132, 'مشروبات باردة', 30),
  ('تشيز كيك', '6223008100015', 95, 44, 9, 'حلويات', 12),
  ('بطاطس متبلة', '6223008100016', 74, 31, 28, 'مقبلات', 10),
  ('عصير مانجو', '6223008100017', 58, 21, 0, 'مشروبات باردة', 12),
  ('بيبسي', '6223000550011', 25, 18, 48, 'مشروبات', 10),
  ('شيبسي', '6223000550028', 20, 14, 7, 'سناكس', 10),
  ('كيك شوكولاتة', '6223000550035', 35, 22, 18, 'حلويات', 5),
  ('عصير برتقال', '6223000550042', 25, 16, 24, 'مشروبات', 8),
  ('قهوة أمريكانو', '6223000550059', 30, 12, 30, 'مشروبات ساخنة', 8),
  ('مياه غازية', '6223000550066', 15, 7, 80, 'مشروبات', 15);

-- Note: Kimo user will be created after first Supabase Auth signup
-- The user should sign up with email kimo@elbaffa.com / password 900300
-- Then run this INSERT to set admin role:

-- After creating the auth user, run:
-- INSERT INTO users (id, name, email, role, active)
-- VALUES ('<auth-user-uuid>', 'Kimo', 'kimo@elbaffa.com', 'admin', true)
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';
