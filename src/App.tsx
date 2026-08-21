import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Check,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileBarChart,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  Minus,
  Moon,
  Package,
  PanelRight,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import {
  addOrderItem as apiAddOrderItem,
  closeOrder as apiCloseOrder,
  createProduct as apiCreateProduct,
  deleteProduct as apiDeleteProduct,
  getDashboard as apiGetDashboard,
  getOrder as apiGetOrder,
  getReports as apiGetReports,
  getSale as apiGetSale,
  listInventory as apiListInventory,
  listProducts as apiListProducts,
  listRooms as apiListRooms,
  listSales as apiListSales,
  listUsers as apiListUsers,
  deleteSale as apiDeleteSale,
  openRoomOrder as apiOpenRoomOrder,
  removeOrderItem as apiRemoveOrderItem,
  updateOrderItem as apiUpdateOrderItem,
  updateProduct as apiUpdateProduct,
  type Dashboard,
  type Invoice,
  type Order,
  type Product,
  type Reports,
  type Room,
  type Sale,
  type UserProfile,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });

// ============================================================
// Shared UI Components
// ============================================================

function Logo({ invert = false }: { invert?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" data-testid="link-brand-home">
      <span className={cn('grid h-10 w-10 place-items-center rounded-xl text-lg font-black tracking-tighter', invert ? 'bg-[#f03e32] text-white' : 'bg-[#161616] text-white')}>
        EB
      </span>
      <span className={cn('text-[17px] font-extrabold tracking-[0.18em]', invert ? 'text-white' : 'text-foreground')}>
        EL BAFFA
      </span>
    </Link>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'dark' | 'soft' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-[0_5px_0_hsl(4_78%_34%)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none',
    dark: 'bg-[#171717] text-white shadow-[0_5px_0_#050505] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none dark:bg-[#e8e2d9] dark:text-[#141414]',
    soft: 'bg-secondary text-secondary-foreground hover:bg-accent',
    ghost: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:brightness-105',
  };
  return (
    <button
      type={props.type ?? 'button'}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-[12px] font-bold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'red' }) {
  const tones = {
    neutral: 'bg-secondary text-muted-foreground',
    success: 'bg-[#dff0e5] text-[#28603d] dark:bg-[#193525] dark:text-[#98d8ad]',
    warning: 'bg-[#fff0c9] text-[#805d04] dark:bg-[#3e3114] dark:text-[#f5d476]',
    danger: 'bg-[#f9dcd8] text-[#9e2e28] dark:bg-[#431f1b] dark:text-[#ffaba3]',
    red: 'bg-primary/10 text-primary',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold', tones[tone])}>
      {children}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-secondary', className)} />;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Boxes size={20} />
      </span>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function PageTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {eyebrow}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[90dvh] w-full max-w-xl overflow-auto rounded-2xl border border-card-border bg-card p-5 shadow-2xl md:p-7">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" data-testid="button-close-modal">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, accent = false }: { label: string; value: string; detail: string; icon: typeof TrendingUp; accent?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-5 transition-transform hover:-translate-y-0.5', accent ? 'border-primary bg-primary text-white' : 'border-card-border bg-card')}>
      <div className="flex items-start justify-between">
        <span className={cn('text-[11px] font-semibold', accent ? 'text-white/70' : 'text-muted-foreground')}>
          {label}
        </span>
        <span className={cn('grid h-8 w-8 place-items-center rounded-lg', accent ? 'bg-white/15' : 'bg-secondary text-primary')}>
          <Icon size={16} />
        </span>
      </div>
      <strong className={cn('mt-5 block text-2xl font-extrabold tabular-nums', accent ? 'text-white' : 'text-foreground')}>
        {value}
      </strong>
      <span className={cn('mt-2 block text-[10px]', accent ? 'text-white/65' : 'text-muted-foreground')}>
        {detail}
      </span>
    </div>
  );
}

// ============================================================
// Navigation
// ============================================================

const navItems = [
  { href: '/dashboard', label: 'نظرة عامة', icon: Home },
  { href: '/inventory', label: 'المخزون', icon: Boxes },
  { href: '/products', label: 'المنتجات', icon: Package, admin: true },
  { href: '/sales', label: 'المبيعات', icon: ShoppingBasket },
  { href: '/reports', label: 'التقارير', icon: FileBarChart },
  { href: '/users', label: 'المستخدمون', icon: Users, admin: true },
  { href: '/settings', label: 'الإعدادات', icon: Settings, admin: true },
];

// ============================================================
// Auth Page (Login only)
// ============================================================

function AuthPage() {
  const { signIn, user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) setLocation('/dashboard');
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (user) return <Redirect to="/dashboard" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      setLocation('/dashboard');
    }
  };

  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[.85fr_1.15fr]" dir="rtl">
      <section className="hidden bg-[#171717] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo invert />
        <div>
          <Badge tone="red">EL BAFFA / الوصول الآمن</Badge>
          <h1 className="mt-7 max-w-lg text-4xl font-extrabold leading-[1.4]">
            المناوبة تبدأ<br />
            <span className="text-primary">من هنا.</span>
          </h1>
          <p className="mt-5 max-w-sm text-xs leading-8 text-white/45">
            بيانات المبيعات والمخزون في مركز واحد، بصلاحيات واضحة لكل فرد في الفريق.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/35">
          <ShieldCheck size={15} className="text-primary" />
          جلسة عمل مشفرة ومحمية
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <div className="mb-8">
            <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-primary">مركز العمليات</p>
            <h1 className="text-2xl font-extrabold">مرحباً بعودتك</h1>
            <p className="mt-2 text-xs text-muted-foreground">سجّل الدخول لمتابعة المناوبة.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                {error}
              </div>
            )}
            <label className="block text-xs font-bold">
              البريد الإلكتروني
              <input
                className="mt-2 h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                type="email"
                required
                placeholder="kimo@elbaffa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-auth-email"
              />
            </label>
            <label className="block text-xs font-bold">
              كلمة المرور
              <input
                className="mt-2 h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-auth-password"
              />
            </label>
            <Button className="mt-2 w-full" type="submit" disabled={submitting} data-testid="button-auth-submit">
              {submitting ? 'جارِ التحقق...' : 'دخول إلى النظام'}
              <ArrowLeft size={16} />
            </Button>
          </form>
          <div className="mt-6 text-center text-[10px] text-muted-foreground">
            EL BAFFA &copy; {new Date().getFullYear()}
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Shell (Layout)
// ============================================================

type Theme = 'light' | 'dark';

function Shell({ children, theme, onToggleTheme }: { children: ReactNode; theme: Theme; onToggleTheme: () => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, signOut, isAdmin } = useAuth();
  const initials = profile?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? '??';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground" dir="rtl">
      <aside className={cn('fixed inset-y-0 right-0 z-40 flex w-[250px] flex-col border-l border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-200 md:translate-x-0', mobileOpen ? 'translate-x-0' : 'translate-x-full')}>
        <div className="mb-10 flex items-center justify-between px-2">
          <Logo invert />
          <button onClick={() => setMobileOpen(false)} className="text-white/60 md:hidden" aria-label="إغلاق القائمة" data-testid="button-close-menu">
            <X size={18} />
          </button>
        </div>
        <div className="mb-3 px-3 text-[9px] font-bold tracking-[0.2em] text-white/35">محطة التشغيل</div>
        <nav className="space-y-1">
          {navItems.filter((item) => !item.admin || isAdmin).map((item) => {
            const Icon = item.icon;
            const active = location === item.href || (item.href !== '/dashboard' && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn('group flex items-center justify-between rounded-lg px-3 py-3 text-[11px] font-semibold transition-colors', active ? 'bg-sidebar-primary text-white' : 'text-white/55 hover:bg-sidebar-accent hover:text-white')}
                data-testid={`link-nav-${item.href.slice(1)}`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
                  {item.label}
                </span>
                {item.admin && <LockKeyhole size={12} className={active ? 'text-white/70' : 'text-white/25'} />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e2b24b] text-xs font-black text-[#151515]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold">{profile?.name ?? 'مستخدم'}</p>
              <p className="mt-0.5 text-[9px] text-white/40">{isAdmin ? 'مدير النظام' : 'موظف'}</p>
            </div>
            <button className="text-white/40 hover:text-white" onClick={signOut} aria-label="تسجيل الخروج" data-testid="button-sign-out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button className="fixed inset-0 z-30 bg-[#111]/40 md:hidden" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" data-testid="button-overlay-menu" />
      )}
      <main className="min-h-[100dvh] md:mr-[250px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة" data-testid="button-open-menu">
            <Menu size={21} />
          </button>
          <div className="hidden text-[10px] font-bold text-muted-foreground md:block">
            EL BAFFA / مركز العمليات
          </div>
          <div className="mr-auto flex items-center gap-2 md:mr-0">
            <Button variant="ghost" className="h-9 min-h-9 px-3" onClick={onToggleTheme} data-testid="button-toggle-theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden text-[10px] md:inline">{theme === 'dark' ? 'الوضع الأبيض' : 'الوضع الداكن'}</span>
            </Button>
            <span className="hidden h-7 w-px bg-border md:block" />
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
              {initials[0]}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1480px] px-4 py-7 md:px-8 md:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// Dashboard Page
// ============================================================

function DashboardPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmRoom, setConfirmRoom] = useState<Room | null>(null);
  const [opening, setOpening] = useState(false);
  const { profile, isAdmin } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGetDashboard();
      setData(d);
    } catch { /* fallback */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rooms = data?.rooms ?? [];
  const openCount = rooms.filter((r) => r.status === 'open').length;

  const openRoom = async (room: Room) => {
    setConfirmRoom(room);
  };

  const confirmOpen = async () => {
    if (!confirmRoom) return;
    setOpening(true);
    try {
      await apiOpenRoomOrder(confirmRoom.id);
      setLocation(`/rooms/${confirmRoom.id}`);
    } catch (err) {
      console.error('Failed to open room:', err);
    }
    setOpening(false);
  };

  return (
    <>
      <PageTitle
        eyebrow="لوحة المناوبة / 01"
        title="نظرة عامة"
        detail="صورة حية لحركة المكان الآن."
        action={
          <Button onClick={load} variant="soft" data-testid="button-refresh-dashboard">
            <RefreshCw size={15} /> تحديث البيانات
          </Button>
        }
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="مبيعات اليوم"
          value={money.format(data?.todaySales ?? 0)}
          detail="إجمالي اليوم الحالي"
          icon={TrendingUp}
          accent
        />
        <StatCard
          label="طلبات مغلقة"
          value={integer.format(data?.todayOrders ?? 0)}
          detail={`${openCount} طلبات مفتوحة حالياً`}
          icon={ShoppingBasket}
        />
        <StatCard
          label="الأصناف المباعة"
          value={integer.format(data?.todayItems ?? 0)}
          detail="إجمالي الأصناف المباعة"
          icon={Package}
        />
        <StatCard
          label="تنبيهات المخزون"
          value={integer.format(data?.lowStockCount ?? 0)}
          detail="تحتاج إلى مراجعة اليوم"
          icon={CircleAlert}
        />
      </div>
      <section className="rounded-xl border border-card-border bg-card p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold">الغرف / 11 نقطة بيع</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">اختر غرفة لفتح الطلب أو متابعة الحساب</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#58ae73]" /> متاحة
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> مفتوحة
            </span>
          </div>
        </div>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[150px]" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.map((room) => <RoomCard key={room.id} room={room} onOpen={openRoom} />)}
          </div>
        )}
      </section>
      {confirmRoom && (
        <Modal title={confirmRoom.status === 'open' ? `فتح طلب ${confirmRoom.name}` : `فتح طلب ${confirmRoom.name}`} onClose={() => setConfirmRoom(null)}>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-6">
              {confirmRoom.status === 'open'
                ? `الغرفة بها طلب مفتوح بإجمالي ${money.format(confirmRoom.total)}. هل تريد متابعة الطلب؟`
                : `هل تريد فتح طلب جديد في ${confirmRoom.name}؟`
              }
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="soft" onClick={() => setConfirmRoom(null)} disabled={opening}>
                العودة
              </Button>
              <Button onClick={confirmOpen} disabled={opening}>
                {opening ? 'جارِ الفتح...' : confirmRoom.status === 'open' ? 'متابعة الطلب' : 'فتح الطلب'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ============================================================
// Room Card
// ============================================================

function RoomCard({ room, onOpen }: { room: Room; onOpen: (room: Room) => void }) {
  const open = room.status === 'open';
  return (
    <button
      onClick={() => onOpen(room)}
      className={cn(
        'group relative min-h-[150px] overflow-hidden rounded-xl border p-4 text-right transition-all hover:-translate-y-1 hover:shadow-lg',
        open ? 'border-primary/30 bg-primary/[0.055]' : 'border-card-border bg-card',
      )}
      data-testid={`card-room-${room.id}`}
    >
      <div className="flex items-start justify-between">
        <span className={cn('grid h-9 w-9 place-items-center rounded-lg text-xs font-black', open ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}>
          {String(room.id).padStart(2, '0')}
        </span>
        <span className={cn('flex items-center gap-1.5 text-[10px] font-bold', open ? 'text-primary' : 'text-[#45825a]')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', open ? 'bg-primary' : 'bg-[#58ae73]')} />
          {open ? 'مفتوحة' : 'متاحة'}
        </span>
      </div>
      <div className="mt-5">
        <p className="text-sm font-bold">{room.name}</p>
        {open ? (
          <div className="mt-2 flex items-end justify-between">
            <span className="text-[10px] text-muted-foreground">إجمالي الطلب</span>
            <strong className="font-mono-app text-sm">{money.format(room.total)}</strong>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-muted-foreground">اضغط لفتح طلب جديد</p>
        )}
      </div>
      <ChevronLeft size={16} className="absolute bottom-4 left-4 text-muted-foreground/50 transition-transform group-hover:-translate-x-1" />
    </button>
  );
}

// ============================================================
// Room Page (Order Management)
// ============================================================

function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const roomId = Number(params.roomId);
  const [room, setRoom] = useState<Room | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  const loadOrder = useCallback(async () => {
    try {
      const rooms = await apiListRooms();
      const found = rooms.find((r) => r.id === roomId);
      if (found) setRoom(found);

      if (found?.orderId) {
        const o = await apiGetOrder(found.orderId);
        setOrder(o);
      } else if (found) {
        const o = await apiOpenRoomOrder(roomId);
        setOrder(o);
        setRoom((prev) => prev ? { ...prev, status: 'open', orderId: o.id } : prev);
      }
    } catch (err) {
      console.error('Failed to load room:', err);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  useEffect(() => {
    apiListProducts().then(setProducts).catch(() => {});
  }, []);

  const visibleProducts = products.filter((p) =>
    p.name.includes(search) || p.category.includes(search)
  );

  const addProduct = async (product: Product) => {
    if (!order) return;
    const existingItem = order.items.find((i) => i.productId === product.id);
    let newItems: OrderItem[];
    if (existingItem) {
      newItems = order.items.map((i) =>
        i.id === existingItem.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i,
      );
    } else {
      newItems = [...order.items, { id: Date.now(), productId: product.id, name: product.name, quantity: 1, unitPrice: product.sellingPrice, total: product.sellingPrice }];
    }
    const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
    setOrder({ ...order, items: newItems, total: newTotal });
    setRoom((prev) => prev ? { ...prev, total: newTotal } : prev);
    try {
      const updated = await apiAddOrderItem(order.id, product.id, 1);
      setOrder(updated);
      setRoom((prev) => prev ? { ...prev, total: updated.total } : prev);
    } catch (err) {
      console.error('Failed to add product:', err);
      loadOrder();
    }
  };

  const updateQuantity = async (itemId: number, delta: number) => {
    if (!order) return;
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;

    if (newQty < 1) {
      const newItems = order.items.filter((i) => i.id !== itemId);
      const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
      setOrder({ ...order, items: newItems, total: newTotal });
      setRoom((prev) => prev ? { ...prev, total: newTotal } : prev);
    } else {
      const newItems = order.items.map((i) =>
        i.id === itemId ? { ...i, quantity: newQty, total: newQty * i.unitPrice } : i,
      );
      const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
      setOrder({ ...order, items: newItems, total: newTotal });
      setRoom((prev) => prev ? { ...prev, total: newTotal } : prev);
    }

    try {
      if (newQty < 1) {
        const updated = await apiRemoveOrderItem(order.id, itemId);
        setOrder(updated);
      } else {
        const updated = await apiUpdateOrderItem(order.id, itemId, newQty);
        setOrder(updated);
      }
    } catch (err) {
      console.error('Failed to update item:', err);
      loadOrder();
    }
  };

  const removeItem = async (itemId: number) => {
    if (!order) return;
    const newItems = order.items.filter((i) => i.id !== itemId);
    const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
    setOrder({ ...order, items: newItems, total: newTotal });
    setRoom((prev) => prev ? { ...prev, total: newTotal } : prev);
    try {
      const updated = await apiRemoveOrderItem(order.id, itemId);
      setOrder(updated);
    } catch (err) {
      console.error('Failed to remove item:', err);
      loadOrder();
    }
  };

  const handleBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.barcode === barcode);
    if (product) addProduct(product);
    setBarcode('');
  };

  const closeOrder = async () => {
    if (!order) return;
    try {
      await apiCloseOrder(order.id);
      setLocation('/sales');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إغلاق الطلب');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!room || !order) {
    return (
      <EmptyState
        title="الغرفة غير موجودة"
        detail="العودة إلى لوحة التحكم"
        action={
          <Link href="/dashboard"><Button>العودة</Button></Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={room.status === 'open' ? 'red' : 'success'}>
                {room.status === 'open' ? 'طلب مفتوح' : 'غرفة جديدة'}
              </Badge>
              <span className="font-mono-app text-[10px] text-muted-foreground">
                #{String(roomId).padStart(2, '0')}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold">{room.name}</h1>
          </div>
        </div>
        <div className="text-left">
          <span className="block text-[10px] text-muted-foreground">بدأت المناوبة</span>
          <span className="font-mono-app text-xs">
            {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_390px]">
        <section className="min-w-0 rounded-xl border border-card-border bg-card p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-extrabold">كتالوج المنتجات</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">انقر للإضافة أو استخدم قارئ الباركود</p>
            </div>
            <form onSubmit={handleBarcode} className="flex h-10 w-full max-w-[280px] items-center gap-2 rounded-lg border border-input bg-background px-3">
              <ScanLine size={15} className="text-primary" />
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="مسح الباركود..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                data-testid="input-barcode-scanner"
              />
            </form>
          </div>
          <div className="relative mb-5">
            <Search size={15} className="absolute right-3 top-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background pr-9 text-xs outline-none focus:border-primary"
              placeholder="ابحث باسم المنتج أو التصنيف..."
              data-testid="input-product-search-room"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                disabled={product.stock === 0}
                className="group rounded-xl border border-card-border bg-background p-3 text-right transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md disabled:opacity-40"
                data-testid={`button-add-product-${product.id}`}
              >
                <div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Package size={25} strokeWidth={1.4} />
                </div>
                <p className="truncate text-[11px] font-bold">{product.name}</p>
                <p className="mt-1 truncate text-[9px] text-muted-foreground">{product.category}</p>
                <div className="mt-2 flex items-center justify-between">
                  <strong className="font-mono-app text-xs text-primary">{money.format(product.sellingPrice)}</strong>
                  <span className="text-[9px] text-muted-foreground">{product.stock} متاح</span>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="sticky top-[88px] rounded-xl border border-[#2a2a2a] bg-[#171717] p-5 text-white shadow-xl dark:bg-[#101010]">
          <div className="mb-5 flex items-start justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-[#f03e32]">الطلب الحالي</p>
              <h2 className="mt-2 text-lg font-extrabold">{room.name}</h2>
            </div>
            <span className="font-mono-app text-[10px] text-white/35">#{order.id}</span>
          </div>
          <div className="max-h-[340px] space-y-2 overflow-auto scrollbar-thin">
            {order.items?.map((item) => (
              <div key={item.id} className="rounded-lg bg-white/[0.055] p-3" data-testid={`row-order-item-${item.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{item.name}</span>
                  <strong className="font-mono-app text-xs">{money.format(item.total)}</strong>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{money.format(item.unitPrice)} / وحدة</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white/70 hover:bg-[#f03e32]"
                      data-testid={`button-decrease-item-${item.id}`}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center font-mono-app text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white/70 hover:bg-[#f03e32]"
                      data-testid={`button-increase-item-${item.id}`}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="mr-1 text-white/35 hover:text-[#f03e32]"
                      data-testid={`button-remove-item-${item.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(!order.items || order.items.length === 0) && (
            <div className="py-14 text-center text-xs text-white/40">لم تتم إضافة أصناف بعد</div>
          )}
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>الإجمالي</span>
              <strong className="font-mono-app text-lg text-white">{money.format(order.total)}</strong>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link
                href="/dashboard"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white/10 px-4 text-[11px] font-bold text-white/70 hover:bg-white/15"
              >
                إلغاء
              </Link>
              <Button
                onClick={closeOrder}
                className="w-full bg-[#f03e32] text-white shadow-[0_4px_0_#8d211c] hover:-translate-y-0.5"
                data-testid="button-close-order"
              >
                إغلاق وتسوية
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// ============================================================
// Products Page
// ============================================================

function ProductsPage() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; product?: Product } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiListProducts();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) => p.name.includes(search) || p.barcode.includes(search));

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: String(form.get('name')),
      barcode: String(form.get('barcode')),
      category: String(form.get('category')),
      sellingPrice: Number(form.get('sellingPrice')),
      costPrice: Number(form.get('costPrice')),
      stock: Number(form.get('stock')),
      lowStockLimit: Number(form.get('lowStockLimit')),
      image: '',
    };
    try {
      if (modal?.mode === 'edit' && modal.product) {
        await apiUpdateProduct(modal.product.id, data);
      } else {
        await apiCreateProduct(data);
      }
      setModal(null);
      await load();
    } catch (err) {
      console.error('Failed to save product:', err);
    }
    setSaving(false);
  };

  const remove = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    await apiDeleteProduct(id);
    await load();
  };

  return (
    <>
      <PageTitle
        eyebrow="الإدارة / كتالوج"
        title="المنتجات"
        detail="إدارة الأسعار، الباركود، وحدود المخزون."
        action={
          isAdmin ? (
            <Button onClick={() => setModal({ mode: 'create' })} data-testid="button-new-product">
              <Plus size={16} /> منتج جديد
            </Button>
          ) : undefined
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search size={15} className="absolute right-3 top-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-card pr-9 text-xs outline-none focus:border-primary"
            placeholder="ابحث بالاسم أو الباركود..."
            data-testid="input-products-search"
          />
        </div>
        <Badge tone="neutral">{integer.format(filtered.length)} منتج</Badge>
      </div>
      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton className="h-12" key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="لا توجد منتجات"
              detail="أضف أول منتج إلى كتالوج EL BAFFA."
              action={
                isAdmin ? <Button onClick={() => setModal({ mode: 'create' })}>إضافة منتج</Button> : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead className="bg-secondary/70 text-[10px] font-bold text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">المنتج</th>
                  <th className="px-5 py-4">الباركود</th>
                  <th className="px-5 py-4">التصنيف</th>
                  <th className="px-5 py-4">سعر البيع</th>
                  <th className="px-5 py-4">المخزون</th>
                  {isAdmin && <th className="px-5 py-4">إجراء</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {filtered.map((product) => (
                  <tr key={product.id} className="text-xs hover:bg-secondary/30" data-testid={`row-product-${product.id}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
                          <Package size={16} />
                        </span>
                        <span className="font-bold">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono-app text-[10px] text-muted-foreground">{product.barcode}</td>
                    <td className="px-5 py-4 text-muted-foreground">{product.category}</td>
                    <td className="px-5 py-4 font-mono-app font-bold">{money.format(product.sellingPrice)}</td>
                    <td className="px-5 py-4">
                      <Badge tone={product.stock === 0 ? 'danger' : product.stock <= product.lowStockLimit ? 'warning' : 'success'}>
                        {product.stock === 0 ? 'نفد' : `${product.stock} وحدة`}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setModal({ mode: 'edit', product })}
                            className="text-[10px] font-bold text-primary hover:underline"
                            data-testid={`button-edit-product-${product.id}`}
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => remove(product.id)}
                            className="text-[10px] font-bold text-destructive hover:underline"
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'إضافة منتج جديد' : 'تعديل المنتج'}
          onClose={() => setModal(null)}
        >
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold sm:col-span-2">
              اسم المنتج
              <input
                name="name"
                defaultValue={modal.product?.name}
                required
                className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                data-testid="input-product-name"
              />
            </label>
            <label className="text-xs font-bold">
              الباركود
              <input
                name="barcode"
                defaultValue={modal.product?.barcode}
                required
                className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono-app text-xs outline-none focus:border-primary"
                data-testid="input-product-barcode"
              />
            </label>
            <label className="text-xs font-bold">
              التصنيف
              <input
                name="category"
                defaultValue={modal.product?.category}
                required
                className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                data-testid="input-product-category"
              />
            </label>
            {[['sellingPrice', 'سعر البيع'], ['costPrice', 'سعر التكلفة'], ['stock', 'الكمية الحالية'], ['lowStockLimit', 'حد التنبيه']].map(([name, label]) => (
              <label key={name} className="text-xs font-bold">
                {label}
                <input
                  name={name}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={modal.product?.[name as keyof Product] ?? 0}
                  required
                  className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono-app text-xs outline-none focus:border-primary"
                  data-testid={`input-product-${name}`}
                />
              </label>
            ))}
            <Button type="submit" className="mt-2 sm:col-span-2" disabled={saving} data-testid="button-save-product">
              {saving ? 'جارِ الحفظ...' : 'حفظ المنتج'}
              <Check size={15} />
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ============================================================
// Inventory Page
// ============================================================

function InventoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiListInventory().then(setRows).finally(() => setLoading(false));
  }, []);

  const low = rows.filter((item) => item.status !== 'good');

  return (
    <>
      <PageTitle
        eyebrow="المخزون / الحالة الحية"
        title="مراقبة المخزون"
        detail="اعرف ما يحتاجه الرف قبل أن يطلبه العميل."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="إجمالي الأصناف"
          value={integer.format(rows.length)}
          detail="أصناف نشطة في الكتالوج"
          icon={Boxes}
        />
        <StatCard
          label="يحتاج إعادة طلب"
          value={integer.format(low.length)}
          detail="تحت حد التنبيه"
          icon={CircleAlert}
        />
        <StatCard
          label="قيمة البيع المتاحة"
          value={money.format(rows.reduce((sum, row) => sum + row.stock * row.sellingPrice, 0))}
          detail="تقدير قيمة المخزون"
          icon={TrendingUp}
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-extrabold">حالة الأصناف</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">آخر تحديث منذ لحظات</p>
          </div>
          <Badge tone={low.length ? 'warning' : 'success'}>
            {low.length ? `${low.length} تنبيهات` : 'كل شيء مستقر'}
          </Badge>
        </div>
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton className="h-12" key={i} />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-right">
              <thead className="bg-secondary/60 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">الصنف</th>
                  <th className="px-5 py-4">الباركود</th>
                  <th className="px-5 py-4">الكمية</th>
                  <th className="px-5 py-4">الحد الأدنى</th>
                  <th className="px-5 py-4">المؤشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {rows.map((row) => (
                  <tr key={row.productId} className="text-xs">
                    <td className="px-5 py-4 font-bold">{row.name}</td>
                    <td className="px-5 py-4 font-mono-app text-[10px] text-muted-foreground">{row.barcode}</td>
                    <td className="px-5 py-4 font-mono-app text-sm">{row.stock}</td>
                    <td className="px-5 py-4 font-mono-app text-muted-foreground">{row.lowStockLimit}</td>
                    <td className="px-5 py-4">
                      <Badge tone={row.status === 'out' ? 'danger' : row.status === 'low' ? 'warning' : 'success'}>
                        {row.status === 'out' ? 'نفد' : row.status === 'low' ? 'منخفض' : 'متوفر'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// Sales Page
// ============================================================

function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    apiListSales().then(setSales).finally(() => setLoading(false));
  }, []);

  const removeSale = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    await apiDeleteSale(id);
    setSales((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <>
      <PageTitle
        eyebrow="المبيعات / السجل"
        title="سجل المبيعات"
        detail="كل الفواتير المغلقة في ورديات المكان."
      />
      <div className="mb-5 flex gap-3">
        <div className="rounded-lg border border-card-border bg-card px-4 py-3">
          <span className="block text-[10px] text-muted-foreground">إجمالي الفترة</span>
          <strong className="mt-1 block font-mono-app text-lg">
            {money.format(sales.reduce((sum, sale) => sum + sale.total, 0))}
          </strong>
        </div>
        <div className="rounded-lg border border-card-border bg-card px-4 py-3">
          <span className="block text-[10px] text-muted-foreground">عدد الفواتير</span>
          <strong className="mt-1 block font-mono-app text-lg">{integer.format(sales.length)}</strong>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton className="h-12" key={i} />)}
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-right">
              <thead className="bg-secondary/60 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">رقم الفاتورة</th>
                  <th className="px-5 py-4">الغرفة</th>
                  <th className="px-5 py-4">الموظف</th>
                  <th className="px-5 py-4">التاريخ</th>
                  <th className="px-5 py-4">الإجمالي</th>
                  {isAdmin && <th className="px-5 py-4">إجراء</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {sales.map((sale) => (
                  <tr key={sale.id} className="text-xs hover:bg-secondary/30" data-testid={`row-sale-${sale.id}`}>
                    <td className="px-5 py-4">
                      <Link
                        href={`/sales/${sale.id}`}
                        className="font-mono-app font-bold text-primary hover:underline"
                        data-testid={`link-sale-${sale.id}`}
                      >
                        {sale.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-bold">{sale.room}</td>
                    <td className="px-5 py-4 text-muted-foreground">{sale.employee}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {sale.date} <span className="mr-2 font-mono-app text-[10px]">{sale.time}</span>
                    </td>
                    <td className="px-5 py-4 font-mono-app font-bold">{money.format(sale.total)}</td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/sales/${sale.id}`}
                        className="text-primary hover:underline"
                        data-testid={`link-sale-details-${sale.id}`}
                      >
                        <ChevronLeft size={16} />
                      </Link>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <button
                          onClick={() => removeSale(sale.id)}
                          className="text-[10px] font-bold text-destructive hover:underline"
                          data-testid={`button-delete-sale-${sale.id}`}
                        >
                          حذف
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Sale Details Page
// ============================================================

function SaleDetailsPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = Number(params.saleId);
  const [sale, setSale] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetSale(saleId).then(setSale).finally(() => setLoading(false));
  }, [saleId]);

  if (loading) return <Skeleton className="h-[400px]" />;
  if (!sale) {
    return (
      <EmptyState
        title="الفاتورة غير موجودة"
        detail="العودة لسجل المبيعات"
        action={
          <Link href="/sales"><Button>العودة</Button></Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/sales"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground"
          data-testid="link-back-sales"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-[10px] font-bold text-primary">الفاتورة / تفاصيل البيع</p>
          <h1 className="mt-1 text-2xl font-extrabold">{sale.invoiceNumber}</h1>
        </div>
        <Button variant="soft" className="mr-auto" onClick={() => window.print()} data-testid="button-print-invoice">
          <Printer size={15} /> طباعة
        </Button>
      </div>
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-card-border bg-card p-6 md:p-9">
          <div className="flex items-start justify-between border-b border-border pb-6">
            <div>
              <Logo />
              <p className="mt-4 text-[10px] text-muted-foreground">فاتورة مبيعات</p>
            </div>
            <div className="text-left">
              <Badge tone="success">
                <CircleCheck size={12} /> مكتملة
              </Badge>
              <p className="mt-3 font-mono-app text-[10px] text-muted-foreground">{sale.createdAt}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 border-b border-border py-6 text-xs">
            <div>
              <span className="block text-[10px] text-muted-foreground">الغرفة</span>
              <strong className="mt-1 block">{sale.roomName}</strong>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground">الموظف</span>
              <strong className="mt-1 block">{sale.employee}</strong>
            </div>
          </div>
          <div className="py-5">
            <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-4 text-[10px] font-bold text-muted-foreground">
              <span>الصنف</span>
              <span>الكمية</span>
              <span>الإجمالي</span>
            </div>
            {sale.items?.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-border/70 py-4 text-xs">
                <span className="font-bold">{item.name}</span>
                <span className="font-mono-app text-muted-foreground">{item.quantity}</span>
                <span className="font-mono-app">{money.format(item.total)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-5 text-xs">
            <span className="text-muted-foreground">الإجمالي</span>
            <strong className="font-mono-app text-lg">{money.format(sale.total)}</strong>
          </div>
        </section>
      </div>
    </>
  );
}

// ============================================================
// Reports Page
// ============================================================

function ReportsPage() {
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetReports().then(setReports).finally(() => setLoading(false));
  }, []);

  const r = reports ?? { today: 0, yesterday: 0, week: 0, month: 0, totalItems: 0, totalRevenue: 0, byRoom: [], byEmployee: [], topProducts: [] };
  const bars = [42, 68, 55, 78, 48, 88, 72, 61, 92, 65, 76, 81];

  return (
    <>
      <PageTitle
        eyebrow="التحليل / قراءة الأداء"
        title="التقارير"
        detail="إشارات واضحة تساعدك على قرار الوردية التالية."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="اليوم"
          value={money.format(r.today)}
          detail={`أمس ${money.format(r.yesterday)}`}
          icon={TrendingUp}
          accent
        />
        <StatCard
          label="هذا الأسبوع"
          value={money.format(r.week)}
          detail="من السبت إلى اليوم"
          icon={BarChart3}
        />
        <StatCard
          label="هذا الشهر"
          value={money.format(r.month)}
          detail="إجمالي الإيراد"
          icon={FileBarChart}
        />
        <StatCard
          label="الوحدات المباعة"
          value={integer.format(r.totalItems)}
          detail="منذ بداية الشهر"
          icon={Package}
        />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-xl border border-card-border bg-card p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-extrabold">إيقاع المبيعات</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">آخر 12 ساعة تشغيل</p>
            </div>
          </div>
          <div className="mt-10 flex h-48 items-end gap-2 border-b border-border px-2">
            {bars.map((height, i) => (
              <div key={i} className="group relative flex-1">
                <div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 font-mono-app text-[8px] text-background group-hover:block">
                  {height * 120}
                </div>
                <div
                  className={cn('w-full rounded-t-sm transition-all group-hover:bg-primary', i === 8 ? 'bg-primary' : 'bg-primary/25')}
                  style={{ height: `${height}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between px-1 font-mono-app text-[9px] text-muted-foreground">
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>00:00</span>
          </div>
        </section>
        <div className="space-y-5">
          <ReportList title="الأكثر مبيعاً" items={r.topProducts} suffix="قطعة" />
          <ReportList title="الأكثر ربحاً" items={r.byEmployee} suffix="" moneyValue />
          <ReportList title="أداء الغرف" items={r.byRoom} suffix="" moneyValue />
        </div>
      </div>
    </>
  );
}

function ReportList({ title, items, suffix, moneyValue = false }: { title: string; items: Array<{ label: string; value?: number; quantity?: number }>; suffix: string; moneyValue?: boolean }) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-5">
      <h2 className="text-sm font-extrabold">{title}</h2>
      <div className="mt-4 divide-y divide-border/70">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-3 py-3 text-xs">
            <span className="font-mono-app text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
            <span className="flex-1 font-bold">{item.label}</span>
            <span className="font-mono-app">
              {moneyValue ? money.format(item.value ?? 0) : `${item.quantity ?? item.value ?? 0} ${suffix}`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Users Page (Admin only)
// ============================================================

function UsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiListUsers();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) {
    return <EmptyState title="غير مصرح" detail="هذه الصفحة متاحة لمديري النظام فقط." />;
  }

  return (
    <>
      <PageTitle
        eyebrow="الإدارة / الصلاحيات"
        title="المستخدمون"
        detail="إدارة من يمكنه الوصول إلى مركز العمليات."
        action={
          <Button onClick={() => setModal('create')} data-testid="button-invite-user">
            <Plus size={16} /> إضافة مستخدم
          </Button>
        }
      />
      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.045] p-4 text-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-primary" />
          <div>
            <strong>صلاحيات الإدارة محمية</strong>
            <p className="mt-1 text-[10px] text-muted-foreground">
              هذه الصفحة متاحة لمديري النظام فقط. لا يمكن للموظف تعديل المنتجات أو المستخدمين.
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton className="h-12" key={i} />)}
            </div>
          ) : (
            <table className="w-full min-w-[680px] text-right">
              <thead className="bg-secondary/60 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">المستخدم</th>
                  <th className="px-5 py-4">الدور</th>
                  <th className="px-5 py-4">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {users.map((user) => (
                  <tr key={user.id} className="text-xs" data-testid={`row-user-${user.id}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-[10px] font-black text-primary">
                          {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                        <div>
                          <p className="font-bold">{user.name}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={user.role === 'admin' ? 'red' : 'neutral'}>
                        {user.role === 'admin' ? 'مدير' : 'موظف'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={user.active ? 'success' : 'neutral'}>
                        {user.active ? 'نشط' : 'موقوف'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal && (
        <Modal title="إضافة مستخدم جديد" onClose={() => setModal(null)}>
          <CreateUserForm onDone={() => { setModal(null); load(); }} />
        </Modal>
      )}
    </>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { createUser } = await import('@/lib/api');
      await createUser({ name, email, password, role });
      onDone();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      <label className="block text-xs font-bold">
        اسم الموظف
        <input
          className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-xs font-bold">
        البريد الإلكتروني
        <input
          className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-xs font-bold">
        كلمة المرور
        <input
          className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="block text-xs font-bold">
        الدور
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setRole('employee')}
            className={cn('flex-1 rounded-lg border p-3 text-xs font-bold', role === 'employee' ? 'border-primary bg-primary/5 text-primary' : 'border-border')}
          >
            موظف
          </button>
          <button
            type="button"
            onClick={() => setRole('admin')}
            className={cn('flex-1 rounded-lg border p-3 text-xs font-bold', role === 'admin' ? 'border-primary bg-primary/5 text-primary' : 'border-border')}
          >
            مدير
          </button>
        </div>
      </label>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'جارِ الإنشاء...' : 'إنشاء الحساب'}
      </Button>
    </form>
  );
}

// ============================================================
// Settings Page (Admin only)
// ============================================================

function SettingsPage({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <EmptyState title="غير مصرح" detail="هذه الصفحة متاحة لمديري النظام فقط." />;
  }

  return (
    <>
      <PageTitle
        eyebrow="النظام / التفضيلات"
        title="الإعدادات"
        detail="تحكم في طريقة عمل النظام داخل المكان."
      />
      <div className="grid max-w-4xl gap-5 lg:grid-cols-[1fr_280px]">
        <section className="space-y-5">
          <div className="rounded-xl border border-card-border bg-card p-5">
            <div className="mb-5">
              <h2 className="text-sm font-extrabold">المظهر</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">اختيارك محفوظ على هذا الجهاز.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => theme === 'dark' && onToggleTheme()}
                className={cn('rounded-xl border p-4 text-right transition', theme === 'light' ? 'border-primary bg-primary/[0.04]' : 'border-border')}
                data-testid="button-theme-light"
              >
                <div className="mb-5 h-16 rounded-lg border border-[#ded6cb] bg-[#f5f1eb] p-2">
                  <div className="h-2 w-1/2 rounded bg-[#171717]/15" />
                  <div className="mt-2 h-7 rounded bg-white" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">الوضع الأبيض</span>
                  {theme === 'light' && <Check size={15} className="text-primary" />}
                </div>
              </button>
              <button
                onClick={() => theme === 'light' && onToggleTheme()}
                className={cn('rounded-xl border p-4 text-right transition', theme === 'dark' ? 'border-primary bg-primary/[0.04]' : 'border-border')}
                data-testid="button-theme-dark"
              >
                <div className="mb-5 h-16 rounded-lg border border-[#3a3a3a] bg-[#171717] p-2">
                  <div className="h-2 w-1/2 rounded bg-white/20" />
                  <div className="mt-2 h-7 rounded bg-[#282828]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">الوضع الداكن</span>
                  {theme === 'dark' && <Check size={15} className="text-primary" />}
                </div>
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-5">
            <h2 className="text-sm font-extrabold">إعدادات التشغيل</h2>
            <div className="mt-5 divide-y divide-border/70">
              {[['العملة', 'جنيه مصري (EGP)'], ['عدد الغرف', '11 غرفة ثابتة'], ['قارئ الباركود', 'متصل عبر USB'], ['النسخ الاحتياطي', 'Supabase Cloud']].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-3 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-extrabold">حول النظام</h2>
          <div className="mt-5 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإصدار</span>
              <span className="font-mono-app">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">البنية التحتية</span>
              <span>Cloudflare + Supabase</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">آخر تحديث</span>
              <span>{new Date().toLocaleDateString('ar-EG')}</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// ============================================================
// Protected Route Wrapper
// ============================================================

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <Shell theme="light" onToggleTheme={() => {}}>
        <div className="grid min-h-[60vh] place-items-center">
          <Skeleton className="h-8 w-48" />
        </div>
      </Shell>
    );
  }
  if (!user) return <Redirect to="/sign-in" />;
  if (adminOnly && !isAdmin) {
    return <EmptyState title="غير مصرح" detail="هذه الصفحة متاحة لمديري النظام فقط." />;
  }

  return <>{children}</>;
}

// ============================================================
// App Router
// ============================================================

function AppRouter({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <Switch>
      <Route path="/sign-in" component={AuthPage} />
      <Route path="/dashboard">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <DashboardPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/rooms/:roomId">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <RoomPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/products">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <ProductsPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <InventoryPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <SalesPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales/:saleId">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <SaleDetailsPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/reports">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <ReportsPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/users">
        {() => (
          <ProtectedRoute adminOnly>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <UsersPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <ProtectedRoute adminOnly>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <SettingsPage theme={theme} onToggleTheme={onToggleTheme} />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/">
        {() => <Redirect to="/sign-in" />}
      </Route>
      <Route>
        {() => (
          <div className="min-h-[100dvh] bg-background p-10">
            <EmptyState
              title="الصفحة غير موجودة"
              detail="العودة إلى مركز العمليات للوصول إلى الصفحات المتاحة."
              action={
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-xs font-bold text-white"
                  data-testid="link-not-found-dashboard"
                >
                  العودة للوحة
                </Link>
              }
            />
          </div>
        )}
      </Route>
    </Switch>
  );
}

// ============================================================
// App Root
// ============================================================

function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('el-baffa-theme') as Theme) || 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('el-baffa-theme', theme);
  }, [theme]);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <ErrorBoundary resetKey={window.location.pathname}>
              <AppRouter
                theme={theme}
                onToggleTheme={() => setTheme((c) => c === 'light' ? 'dark' : 'light')}
              />
            </ErrorBoundary>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

// Need QueryClientProvider for the toast component
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

export default App;
