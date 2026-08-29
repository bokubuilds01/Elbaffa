import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
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
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  closeOrder as apiCloseOrder,
  createProduct as apiCreateProduct,
  deleteProduct as apiDeleteProduct,
  getDashboard as apiGetDashboard,
  getOrder as apiGetOrder,
  getReports as apiGetReports,
  getSale as apiGetSale,
  getMostUsedProducts as apiGetMostUsedProducts,
  quickSale as apiQuickSale,
  listInventory as apiListInventory,
  listProducts as apiListProducts,
  listRooms as apiListRooms,
  listSales as apiListSales,
  listUsers as apiListUsers,
  deleteSale as apiDeleteSale,
  openRoomOrder as apiOpenRoomOrder,
  setOrderItemPaidQty as apiSetOrderItemPaidQty,
  syncOrderItems as apiSyncOrderItems,
  transferOrder as apiTransferOrder,
  createRoom as apiCreateRoom,
  deleteRoom as apiDeleteRoom,
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
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.from('site_settings').select('value').eq('key', 'logo_url').single();
        if (!cancelled && data?.value) setCustomLogo(data.value);
      } catch { /* no logo yet */ }
    };
    load();
    const handler = async () => {
      try {
        const { data } = await supabase.from('site_settings').select('value').eq('key', 'logo_url').single();
        if (!cancelled && data) setCustomLogo(data.value);
      } catch { /* ignore */ }
    };
    window.addEventListener('logo-updated', handler);
    return () => { cancelled = true; window.removeEventListener('logo-updated', handler); };
  }, []);

  return (
    <Link href="/dashboard" className="flex items-center gap-3" data-testid="link-brand-home">
      {customLogo ? (
        <img src={customLogo} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
      ) : (
        <span className={cn('grid h-10 w-10 place-items-center rounded-xl text-lg font-black tracking-tighter', invert ? 'bg-[#f03e32] text-white' : 'bg-[#161616] text-white')}>
          EB
        </span>
      )}
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
  { href: '/quick-sale', label: 'بيع سريع', icon: Zap },
  { href: '/inventory', label: 'المخزون', icon: Boxes, admin: true },
  { href: '/products', label: 'المنتجات', icon: Package, admin: true },
  { href: '/sales', label: 'المبيعات', icon: ShoppingBasket },
  { href: '/reports', label: 'التقارير', icon: FileBarChart, admin: true },
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
          <Badge tone="red">ELBAFFA</Badge>
          <h1 className="mt-7 max-w-lg text-4xl font-extrabold leading-[1.4]">
            مرحباً بعودتك<br />
            <span className="text-primary">سجّل الدخول.</span>
          </h1>
            <p className="mt-5 max-w-sm text-xs leading-8 text-white/45">
              كل ما تحتاجه في مكان واحد.
            </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/35">
            <ShieldCheck size={15} className="text-primary" />
            جلسة آمنة
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <div className="mb-8">
            <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-primary">ELBAFFA</p>
            <h1 className="text-2xl font-extrabold">مرحباً بعودتك</h1>
            <p className="mt-2 text-xs text-muted-foreground">سجّل الدخول للمتابعة.</p>
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
        <div className="mb-3 px-3 text-[9px] font-bold tracking-[0.2em] text-white/35">ELBAFFA</div>
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
            EL BAFFA
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
  const [showAddRoom, setShowAddRoom] = useState(false);
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

  const handleDeleteRoom = async (room: Room) => {
    if (!isAdmin) return;
    if (!confirm(`هل أنت متأكد من حذف ${room.name}؟`)) return;
    try {
      await apiDeleteRoom(room.id);
      await load();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="لوحة التحكم"
        title="نظرة عامة"
        detail="صورة حية لحركة المكان الآن."
        action={
          <div className="flex gap-2">
            {isAdmin && (
              <Button onClick={() => setShowAddRoom(true)} variant="soft" data-testid="button-add-room">
                <Plus size={15} /> إضافة غرفة
              </Button>
            )}
            <Button onClick={load} variant="soft" data-testid="button-refresh-dashboard">
              <RefreshCw size={15} /> تحديث البيانات
            </Button>
          </div>
        }
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="مبيعات اليوم"
          value={money.format(data?.todaySales ?? 0)}
          detail={`الشهر الحالي: ${money.format(data?.monthSales ?? 0)}`}
          icon={TrendingUp}
          accent
        />
<StatCard
            label="أرباح إجمالية"
            value={money.format(data?.totalProfit ?? 0)}
            detail="صافي الربح من الطلبات المغلقة"
            icon={BarChart3}
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
          detail="إجمالي الأصناف المباعة اليوم"
          icon={Package}
        />
      </div>
      <div className="mb-8 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-xl border border-card-border bg-card p-5 md:p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-extrabold">توزيع المبيعات</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">فصل مبيعات الغرف عن البيع السريع (الشهر الحالي)</p>
            </div>
            <Badge tone="neutral">{money.format((data?.roomSales ?? 0) + (data?.quickSales ?? 0))}</Badge>
          </div>
          {(() => {
            const roomSales = data?.roomSales ?? 0;
            const quickSales = data?.quickSales ?? 0;
            const grand = roomSales + quickSales;
            const pct = (v: number) => (grand > 0 ? Math.round((v / grand) * 100) : 0);
            return (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-bold">مبيعات الغرف</span>
                    <span className="font-mono-app text-muted-foreground">{money.format(roomSales)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct(roomSales)}%` }} data-testid="bar-room-sales" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-bold">بيع سريع</span>
                    <span className="font-mono-app text-muted-foreground">{money.format(quickSales)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-[#e2b24b]" style={{ width: `${pct(quickSales)}%` }} data-testid="bar-quick-sales" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">إجمالي المبيعات</span>
                  <strong className="font-mono-app text-sm" data-testid="total-sales">{money.format(grand)}</strong>
                </div>
              </div>
            );
          })()}
        </section>
      </div>
      <section className="rounded-xl border border-card-border bg-card p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold">الغرف / {rooms.length} نقطة بيع</h2>
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
            {rooms.map((room) => <RoomCard key={room.id} room={room} onOpen={openRoom} onDelete={isAdmin ? handleDeleteRoom : undefined} />)}
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
      {showAddRoom && (
        <AddRoomModal onClose={() => setShowAddRoom(false)} onAdded={() => { setShowAddRoom(false); load(); }} />
      )}
    </>
  );
}

// ============================================================
// Room Card
// ============================================================

function RoomCard({ room, onOpen, onDelete }: { room: Room; onOpen: (room: Room) => void; onDelete?: (room: Room) => void }) {
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
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDelete(room); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onDelete(room); } }}
          className="absolute top-4 left-4 z-10 grid h-6 w-6 place-items-center rounded-md bg-black/5 text-muted-foreground opacity-0 transition hover:bg-destructive hover:text-white group-hover:opacity-100"
          title="حذف الغرفة"
          data-testid={`button-delete-room-${room.id}`}
        >
          <Trash2 size={12} />
        </span>
      )}
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

function AddRoomModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiCreateRoom(name.trim());
      onAdded();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة الغرفة');
    }
    setSaving(false);
  };

  return (
    <Modal title="إضافة غرفة جديدة" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
        )}
        <label className="block text-xs font-bold">
          اسم الغرفة
          <input
            autoFocus
            className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
            placeholder="غرفة 12"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-room-name"
          />
        </label>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'جارِ الإضافة...' : 'إضافة الغرفة'}
          <Plus size={15} />
        </Button>
      </form>
    </Modal>
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
  const orderRef = useRef<Order | null>(null);
  const syncTimer = useRef<number | null>(null);
  const [paidDrafts, setPaidDrafts] = useState<Record<number, number>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => { orderRef.current = order; }, [order]);
  useEffect(() => () => { if (syncTimer.current) window.clearTimeout(syncTimer.current); }, []);

  const syncNow = async () => {
    const current = orderRef.current;
    if (!current) return;
    const snapshot = current.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    try {
      const fresh = await apiSyncOrderItems(current.id, snapshot);
      orderRef.current = fresh;
      setOrder(fresh);
    } catch (err) {
      console.error('Failed to sync order:', err);
      loadOrder();
    }
  };

  const scheduleSync = () => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(syncNow, 600);
  };

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

  const addProduct = (product: Product) => {
    const current = orderRef.current;
    if (!current) return;
    const existingItem = current.items.find((i) => i.productId === product.id);
    let newItems: OrderItem[];
    if (existingItem) {
      newItems = current.items.map((i) =>
        i.id === existingItem.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i,
      );
    } else {
      newItems = [...current.items, { id: Date.now(), productId: product.id, name: product.name, quantity: 1, unitPrice: product.sellingPrice, total: product.sellingPrice, paidAt: null, paidQuantity: 0 }];
    }
    const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
    const updated: Order = { ...current, items: newItems, total: newTotal };
    orderRef.current = updated;
    setOrder(updated);
    setRoom((prev) => prev ? { ...prev, total: newTotal } : prev);
    scheduleSync();
  };

  const updateQuantity = (itemId: number, delta: number) => {
    const current = orderRef.current;
    if (!current) return;
    const item = current.items.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;

    const compute = (items: OrderItem[]) =>
      newQty < 1
        ? items.filter((i) => i.id !== itemId)
        : items.map((i) => (i.id === itemId ? { ...i, quantity: newQty, total: newQty * i.unitPrice, paidQuantity: Math.min(i.paidQuantity, newQty) } : i));

    const newItems = compute(current.items);
    const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
    const updated: Order = { ...current, items: newItems, total: newTotal };
    orderRef.current = updated;
    setOrder(updated);
    setRoom((prev) => prev ? { ...prev, total: newTotal } : prev);
    setPaidDrafts((prev) => {
      const draft = prev[itemId];
      if (draft === undefined) return prev;
      const next = { ...prev };
      if (newQty <= 0 || draft > newQty) {
        delete next[itemId];
      }
      return next;
    });
    scheduleSync();
  };

  const removeItem = (itemId: number) => {
    const current = orderRef.current;
    if (!current) return;
    const newItems = current.items.filter((i) => i.id !== itemId);
    const newTotal = newItems.reduce((sum, i) => sum + i.total, 0);
    const updated: Order = { ...current, items: newItems, total: newTotal };
    orderRef.current = updated;
    setOrder(updated);
    setRoom((prev) => prev ? { ...prev, total: newTotal } : prev);
    setPaidDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    scheduleSync();
  };

  const changePaidDraft = (itemId: number, delta: number) => {
    const current = orderRef.current;
    if (!current) return;
    const item = current.items.find((i) => i.id === itemId);
    if (!item) return;
    const currentVal = paidDrafts[itemId] ?? item.paidQuantity;
    const nextVal = currentVal + delta;
    if (nextVal < 0 || nextVal > item.quantity) return;
    setPaidDrafts((prev) => {
      const next = { ...prev };
      if (nextVal <= 0) delete next[itemId];
      else next[itemId] = nextVal;
      return next;
    });
  };

  const confirmPaidDraft = async (itemId: number) => {
    const current = orderRef.current;
    if (!current) return;
    const item = current.items.find((i) => i.id === itemId);
    if (!item) return;
    const draft = paidDrafts[itemId] ?? item.paidQuantity;
    if (draft === item.paidQuantity) return;
    try {
      const fresh = await apiSetOrderItemPaidQty(current.id, itemId, draft);
      orderRef.current = fresh;
      setOrder(fresh);
      setPaidDrafts((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تأكيد الدفع');
    }
  };

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferRooms, setTransferRooms] = useState<Room[]>([]);
  const [transferError, setTransferError] = useState('');
  const [transferring, setTransferring] = useState(false);

  const openTransfer = async () => {
    setTransferError('');
    setTransferOpen(true);
    try {
      const rooms = await apiListRooms();
      setTransferRooms(rooms.filter((r) => r.id !== roomId));
    } catch { /* keep empty list */ }
  };

  const transferOrderNow = async (targetRoomId: number) => {
    if (!order) return;
    setTransferring(true);
    setTransferError('');
    try {
      await apiTransferOrder(order.id, targetRoomId);
      setTransferOpen(false);
      setLocation('/dashboard');
    } catch (err: any) {
      setTransferError(err.message || 'حدث خطأ أثناء نقل الطلب');
    }
    setTransferring(false);
  };

  const handleBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.barcode === barcode);
    if (product) addProduct(product);
    setBarcode('');
  };

  const performClose = async () => {
    if (!order) return;
    setClosing(true);
    try {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      await syncNow();
      await apiCloseOrder(orderRef.current?.id ?? order.id);
      setLocation('/sales');
    } catch (err: any) {
      setClosing(false);
      setConfirmClose(false);
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
          <span className="block text-[10px] text-muted-foreground">وقت الفتح</span>
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
              <div
                key={item.id}
                className={cn('rounded-lg bg-white/[0.055] p-3', item.paidQuantity > 0 && 'border border-[#58ae73]/30')}
                data-testid={`row-order-item-${item.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-bold">{item.name}</span>
                    {item.paidQuantity > 0 && (
                      <span className="shrink-0 rounded-full bg-[#58ae73]/15 px-2 py-0.5 text-[9px] font-bold text-[#58ae73]" data-testid={`badge-paid-item-${item.id}`}>
                        {item.paidQuantity >= item.quantity ? 'مدفوع بالكامل' : `مدفوع ${item.paidQuantity}`}
                      </span>
                    )}
                  </span>
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
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[#58ae73]/[0.08] px-2 py-1.5">
                  <span className="text-[10px] font-bold text-[#58ae73]">المدفوع</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changePaidDraft(item.id, -1)}
                      disabled={(paidDrafts[item.id] ?? item.paidQuantity) <= 0}
                      className="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-white/70 transition hover:bg-[#f03e32] disabled:cursor-not-allowed disabled:opacity-30"
                      data-testid={`button-paid-decrease-${item.id}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-4 text-center font-mono-app text-[11px]" data-testid={`paid-quantity-${item.id}`}>
                      {paidDrafts[item.id] ?? item.paidQuantity}
                    </span>
                    <button
                      onClick={() => changePaidDraft(item.id, 1)}
                      disabled={(paidDrafts[item.id] ?? item.paidQuantity) >= item.quantity}
                      className="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-white/70 transition hover:bg-[#58ae73] disabled:cursor-not-allowed disabled:opacity-30"
                      data-testid={`button-paid-increase-${item.id}`}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => confirmPaidDraft(item.id)}
                      disabled={(paidDrafts[item.id] ?? item.paidQuantity) === item.paidQuantity}
                      title={(paidDrafts[item.id] ?? item.paidQuantity) === item.paidQuantity ? 'مؤكد' : 'تأكيد الدفع'}
                      className={cn(
                        'grid h-6 w-6 place-items-center rounded-md transition',
                        (paidDrafts[item.id] ?? item.paidQuantity) === item.paidQuantity
                          ? item.paidQuantity > 0
                            ? 'bg-[#58ae73]/25 text-[#58ae73]'
                            : 'bg-white/5 text-white/25'
                          : 'bg-[#58ae73] text-white hover:bg-[#58ae73]/80',
                      )}
                      data-testid={`button-confirm-paid-${item.id}`}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(!order.items || order.items.length === 0) && (
            <div className="py-14 text-center text-xs text-white/40">لم تتم إضافة أصناف بعد</div>
          )}
          <div className="mt-5 space-y-2.5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>إجمالي الطلب</span>
              <strong className="font-mono-app text-sm text-white">{money.format(order.total)}</strong>
            </div>
            {(order.paidTotal ?? 0) > 0 && (
              <div className="flex items-center justify-between text-[11px] text-[#58ae73]">
                <span>المدفوع</span>
                <strong className="font-mono-app text-sm">
                  - {money.format(order.paidTotal)}
                </strong>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
              <span className="text-xs text-white/50">المتبقي</span>
              <strong className="font-mono-app text-lg text-white" data-testid="order-remaining">
                {money.format(order.total - (order.paidTotal ?? 0))}
              </strong>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Link
                href="/dashboard"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white/10 px-4 text-[11px] font-bold text-white/70 hover:bg-white/15"
              >
                إلغاء
              </Link>
              <Button
                onClick={openTransfer}
                className="bg-white/10 text-white/70 hover:bg-white/15"
                data-testid="button-transfer-order"
              >
                نقل الطلب
                <ArrowLeftRight size={14} />
              </Button>
            </div>
            <Button
              onClick={() => setConfirmClose(true)}
              className="w-full bg-[#f03e32] text-white shadow-[0_4px_0_#8d211c] hover:-translate-y-0.5"
              data-testid="button-close-order"
            >
              إغلاق وتسوية
            </Button>
          </div>
        </section>
        {transferOpen && (
          <Modal title={`نقل طلب ${room.name} إلى غرفة أخرى`} onClose={() => setTransferOpen(false)}>
            <p className="mb-4 text-xs text-muted-foreground">
              سيتم نقل جميع أصناف الطلب الحالي إلى الغرفة المختارة، وستعود هذه الغرفة متاحة. الغرف التي بها طلب مفتوح غير متاحة.
            </p>
            {transferError && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive" data-testid="transfer-error">
                {transferError}
              </div>
            )}
            <div className="max-h-[300px] space-y-2 overflow-auto scrollbar-thin">
              {transferRooms.map((r) => {
                const unavailable = r.status === 'open';
                return (
                  <button
                    key={r.id}
                    disabled={unavailable || transferring}
                    onClick={() => transferOrderNow(r.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-right transition',
                      unavailable
                        ? 'cursor-not-allowed border-card-border bg-muted opacity-40'
                        : 'border-card-border bg-background hover:border-primary/60',
                    )}
                    data-testid={`button-transfer-room-${r.id}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-black">
                        {String(r.id).padStart(2, '0')}
                      </span>
                      <span className="truncate text-xs font-bold">{r.name}</span>
                    </span>
                    <span className={cn('shrink-0 text-[10px] font-bold', unavailable ? 'text-muted-foreground' : 'text-[#58ae73]')}>
                      {unavailable ? 'بها طلب مفتوح' : 'متاحة'}
                    </span>
                  </button>
                );
              })}
              {transferRooms.length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground">لا توجد غرف أخرى لنقل الطلب إليها</p>
              )}
            </div>
          </Modal>
        )}
        {confirmClose && (
          <Modal title="تأكيد إغلاق الطلب" onClose={() => setConfirmClose(false)}>
            <div className="space-y-3">
              <div className="rounded-lg bg-secondary/60 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">إجمالي الطلب</span>
                  <strong className="font-mono-app">{money.format(order.total)}</strong>
                </div>
                {(order.paidTotal ?? 0) > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs text-[#45825a]">
                    <span>المدفوع</span>
                    <strong className="font-mono-app">- {money.format(order.paidTotal)}</strong>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-card-border pt-2 text-xs">
                  <span className="text-muted-foreground">المتبقي للتحصيل</span>
                  <strong className="font-mono-app text-sm" data-testid="close-remaining">
                    {money.format(Math.max(0, order.total - (order.paidTotal ?? 0)))}
                  </strong>
                </div>
              </div>
              {Object.keys(paidDrafts).length > 0 && (
                <div className="rounded-lg bg-amber-500/10 p-3 text-[11px] text-amber-600">
                  يوجد تعديل في المدفوع لم يتم تأكيده بعد. أكّد الدفع قبل الإغلاق أو سيتم تجاهله.
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                بعد الإغلاق يتم خصم الأصناف من المخزون وتسجيل الفاتورة، ولن يمكن تعديل الطلب نهائياً.
              </p>
              <div className="flex gap-3">
                <Button variant="soft" className="flex-1" onClick={() => setConfirmClose(false)} disabled={closing}>
                  العودة
                </Button>
                <Button
                  onClick={performClose}
                  className="flex-1 bg-[#f03e32] text-white shadow-[0_4px_0_#8d211c] hover:-translate-y-0.5"
                  disabled={closing}
                  data-testid="button-confirm-close-order"
                >
                  {closing ? 'جارِ الإغلاق...' : 'تأكيد الإغلاق'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
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

  const roomSales = sales.filter((s) => s.type === 'room');
  const quickSales = sales.filter((s) => s.type === 'quick');

  const invoiceHeader = (
    <tr>
      <th className="px-5 py-4">رقم الفاتورة</th>
      <th className="px-5 py-4">الغرفة</th>
      <th className="px-5 py-4">الموظف</th>
      <th className="px-5 py-4">التاريخ</th>
      <th className="px-5 py-4">الإجمالي</th>
      <th className="px-5 py-4">التفاصيل</th>
      {isAdmin && <th className="px-5 py-4">إجراء</th>}
    </tr>
  );

  const invoiceRows = (list: Sale[]) => (
    list.map((sale) => (
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
    ))
  );

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
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton className="h-12" key={i} />)}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-card-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-extrabold">مبيعات الغرف</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">الفواتير المرتبطة بالغرف</p>
              </div>
              <Badge tone="neutral">{integer.format(roomSales.length)} فاتورة</Badge>
            </div>
            <div className="overflow-x-auto">
              {roomSales.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">لا توجد مبيعات غرف بعد</p>
              ) : (
                <table className="w-full min-w-[760px] text-right">
                  <thead className="bg-secondary/60 text-[10px] text-muted-foreground">{invoiceHeader}</thead>
                  <tbody className="divide-y divide-border/80">{invoiceRows(roomSales)}</tbody>
                </table>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#e2b24b]/30 bg-card">
            <div className="flex items-center justify-between border-b border-[#e2b24b]/20 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-extrabold">
                  <Zap size={15} className="text-[#e2b24b]" />
                  بيع سريع / Quick Sales
                </h2>
                <p className="mt-1 text-[10px] text-muted-foreground">مبيعات مباشرة من الكاشير بدون غرفة</p>
              </div>
              <Badge tone="warning">{integer.format(quickSales.length)} عملية</Badge>
            </div>
            <div className="overflow-x-auto">
              {quickSales.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">لا توجد عمليات بيع سريع بعد</p>
              ) : (
                <table className="w-full min-w-[760px] text-right">
                  <thead className="bg-[#e2b24b]/[0.06] text-[10px] text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4">رقم الفاتورة</th>
                      <th className="px-5 py-4">الموظف</th>
                      <th className="px-5 py-4">التاريخ</th>
                      <th className="px-5 py-4">طريقة الدفع</th>
                      <th className="px-5 py-4">الإجمالي</th>
                      <th className="px-5 py-4">التفاصيل</th>
                      {isAdmin && <th className="px-5 py-4">إجراء</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/80">
                    {quickSales.map((sale) => (
                      <tr key={sale.id} className="text-xs hover:bg-[#e2b24b]/[0.04]" data-testid={`row-sale-quick-${sale.id}`}>
                        <td className="px-5 py-4">
                          <Link
                            href={`/sales/${sale.id}`}
                            className="font-mono-app font-bold text-[#b8860b] hover:underline"
                            data-testid={`link-sale-quick-${sale.id}`}
                          >
                            {sale.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{sale.employee}</td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {sale.date} <span className="mr-2 font-mono-app text-[10px]">{sale.time}</span>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={sale.paymentMethod === 'card' ? 'neutral' : 'success'}>
                            {sale.paymentMethod === 'card' ? 'كارت' : 'نقدي'}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 font-mono-app font-bold">{money.format(sale.total)}</td>
                        <td className="px-5 py-4">
                          <Link href={`/sales/${sale.id}`} className="text-[#b8860b] hover:underline" data-testid={`link-sale-quick-details-${sale.id}`}>
                            <ChevronLeft size={16} />
                          </Link>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4">
                            <button
                              onClick={() => removeSale(sale.id)}
                              className="text-[10px] font-bold text-destructive hover:underline"
                              data-testid={`button-delete-sale-quick-${sale.id}`}
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
          </section>
        </div>
      )}
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
            {sale.paymentMethod && (
              <div>
                <span className="block text-[10px] text-muted-foreground">طريقة الدفع</span>
                <strong className="mt-1 block">{sale.paymentMethod === 'card' ? 'كارت' : 'نقدي'}</strong>
              </div>
            )}
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
// Quick Sale Page (direct sale, no room)
// ============================================================

interface QuickCartItem {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  stock: number;
}

function QuickSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [mostUsed, setMostUsed] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState<QuickCartItem[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [receipt, setReceipt] = useState<{ invoiceNumber: string; total: number; items: QuickCartItem[]; method: 'cash' | 'card' } | null>(null);

  useEffect(() => {
    apiListProducts().then(setProducts).catch(() => {});
    apiGetMostUsedProducts(8).then(setMostUsed).catch(async () => {
      try {
        const all = await apiListProducts();
        setMostUsed(all.filter((p) => p.stock > 0).slice(0, 8));
      } catch { setMostUsed([]); }
    });
  }, []);

  const total = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const refreshStock = async () => {
    try {
      const fresh = await apiListProducts();
      setProducts(fresh);
      setMostUsed((prev) => prev.map((p) => fresh.find((f) => f.id === p.id) ?? p));
    } catch { /* keep current */ }
  };

  const addProduct = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, unitPrice: product.sellingPrice, quantity: 1, stock: product.stock }];
    });
  };

  const changeQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        const next = i.quantity + delta;
        if (next < 1 || next > i.stock) return i;
        return { ...i, quantity: next };
      }),
    );
  };

  const removeItem = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.barcode === barcode);
    if (product) addProduct(product);
    setBarcode('');
  };

  const visibleProducts = products.filter((p) =>
    p.name.includes(search) || p.category.includes(search) || p.barcode.includes(search)
  );

  const openPay = () => {
    setPayError('');
    setMethod('cash');
    setPayOpen(true);
  };

  const confirmPay = async () => {
    if (cart.length === 0) return;
    setPaying(true);
    setPayError('');
    const soldItems = cart;
    const paidWith = method;
    try {
      const res = await apiQuickSale(cart.map((i) => ({ productId: i.productId, quantity: i.quantity })), paidWith);
      setCart([]);
      setPayOpen(false);
      setReceipt({ invoiceNumber: res.invoiceNumber, total: res.total, items: soldItems, method: paidWith });
      await refreshStock();
    } catch (err: any) {
      setPayError(err.message || 'حدث خطأ أثناء إتمام الدفع');
    }
    setPaying(false);
  };

  const CartItemRow = ({ item }: { item: QuickCartItem }) => (
    <div className="rounded-lg bg-white/[0.055] p-3" data-testid={`quick-cart-item-${item.productId}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold">{item.name}</span>
        <strong className="font-mono-app text-xs">{money.format(item.quantity * item.unitPrice)}</strong>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-white/40">{money.format(item.unitPrice)} / وحدة</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeQty(item.productId, -1)}
            disabled={item.quantity <= 1}
            className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white/70 hover:bg-[#f03e32] disabled:cursor-not-allowed disabled:opacity-30"
            data-testid={`quick-decrease-${item.productId}`}
          >
            <Minus size={13} />
          </button>
          <span className="w-4 text-center font-mono-app text-xs" data-testid={`quick-qty-${item.productId}`}>{item.quantity}</span>
          <button
            onClick={() => changeQty(item.productId, 1)}
            disabled={item.quantity >= item.stock}
            className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white/70 hover:bg-[#58ae73] disabled:cursor-not-allowed disabled:opacity-30"
            data-testid={`quick-increase-${item.productId}`}
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => removeItem(item.productId)}
            className="mr-1 text-white/35 hover:text-[#f03e32]"
            data-testid={`quick-remove-${item.productId}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.15em] text-primary">QUICK SALE</p>
          <h1 className="mt-1 text-2xl font-extrabold">بيع سريع</h1>
          <p className="mt-1 text-[10px] text-muted-foreground">بيع مباشر من الكاشير بدون ربط بغرفة</p>
        </div>
        <form onSubmit={handleBarcode} className="flex h-11 w-full max-w-[320px] items-center gap-2 rounded-lg border border-input bg-card px-3" data-testid="quick-barcode-form">
          <ScanLine size={16} className="text-primary" />
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="مسح الباركود وإضافة فوراً..."
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            data-testid="quick-barcode-input"
          />
        </form>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_390px]">
        <section className="min-w-0 rounded-xl border border-card-border bg-card p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-[320px]">
              <Search size={15} className="absolute right-3 top-3 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="h-10 w-full rounded-lg border border-input bg-background pr-9 text-xs outline-none focus:border-primary"
                placeholder="ابحث باسم المنتج أو التصنيف..."
                data-testid="quick-search"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{itemCount} صنف في السلة</span>
          </div>

          {mostUsed.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-xs font-extrabold text-muted-foreground">الأكثر استخداماً</h3>
              <div className="flex flex-wrap gap-2">
                {mostUsed.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    disabled={product.stock <= 0}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition',
                      product.stock <= 0
                        ? 'cursor-not-allowed border-destructive/20 bg-destructive/5 text-destructive/60'
                        : 'border-primary/30 bg-primary/[0.04] text-foreground hover:-translate-y-0.5 hover:border-primary/70',
                    )}
                    data-testid={`quick-most-${product.id}`}
                  >
                    <Zap size={12} className={product.stock <= 0 ? 'text-destructive/50' : 'text-primary'} />
                    {product.name}
                    <span className="font-mono-app text-[10px] text-muted-foreground">
                      {product.stock <= 0 ? 'OUT OF STOCK' : `${money.format(product.sellingPrice)}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-muted-foreground">الكتالوج</h3>
            <span className="text-[10px] text-muted-foreground">{visibleProducts.length} منتج</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                disabled={product.stock <= 0}
                className={cn(
                  'group rounded-xl border border-card-border bg-background p-3 text-right transition',
                  product.stock <= 0
                    ? 'cursor-not-allowed opacity-45'
                    : 'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md',
                )}
                data-testid={`quick-product-${product.id}`}
              >
                <div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Package size={25} strokeWidth={1.4} />
                </div>
                <p className="truncate text-[11px] font-bold">{product.name}</p>
                <p className="mt-1 truncate text-[9px] text-muted-foreground">{product.category}</p>
                <div className="mt-2 flex items-center justify-between">
                  <strong className={cn('font-mono-app text-xs', product.stock <= 0 ? 'text-destructive' : 'text-primary')}>
                    {product.stock <= 0 ? 'OUT OF STOCK' : money.format(product.sellingPrice)}
                  </strong>
                  <span className="text-[9px] text-muted-foreground">{product.stock} متاح</span>
                </div>
              </button>
            ))}
          </div>
          {visibleProducts.length === 0 && (
            <p className="py-14 text-center text-xs text-muted-foreground">لا توجد منتجات مطابقة</p>
          )}
        </section>

        <section className="sticky top-[88px] rounded-xl border border-[#2a2a2a] bg-[#171717] p-5 text-white shadow-xl dark:bg-[#101010]">
          <div className="mb-5 flex items-start justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-[#f03e32]">QUICK SALE</p>
              <h2 className="mt-2 text-lg font-extrabold">السلة</h2>
            </div>
            <span className="font-mono-app text-[10px] text-white/35">{itemCount} صنف</span>
          </div>
          <div className="max-h-[340px] space-y-2 overflow-auto scrollbar-thin">
            {cart.map((item) => <CartItemRow key={item.productId} item={item} />)}
          </div>
          {cart.length === 0 && (
            <div className="py-14 text-center text-xs text-white/40">السلة فارغة — أضف منتجات من اليسار</div>
          )}
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>الإجمالي</span>
              <strong className="font-mono-app text-lg text-white" data-testid="quick-total">{money.format(total)}</strong>
            </div>
            <Button
              onClick={openPay}
              disabled={cart.length === 0}
              className="mt-4 w-full bg-[#f03e32] text-white shadow-[0_4px_0_#8d211c] hover:-translate-y-0.5"
              data-testid="button-quick-pay"
            >
              <Banknote size={15} />
              إتمام الدفع / PAY
            </Button>
          </div>
        </section>
      </div>

      {payOpen && (
        <Modal title="تأكيد إتمام الدفع" onClose={() => setPayOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary/60 p-4 text-center">
              <span className="block text-[10px] text-muted-foreground">الإجمالي</span>
              <strong className="mt-1 block font-mono-app text-2xl" data-testid="quick-pay-total">{money.format(total)}</strong>
            </div>
            <div>
              <span className="mb-2 block text-xs font-bold">طريقة الدفع</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMethod('cash')}
                  className={cn('rounded-lg border px-4 py-3 text-xs font-bold transition', method === 'cash' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-card-border bg-background text-muted-foreground')}
                  data-testid="quick-method-cash"
                >
                  <span className="block">CASH</span>
                  <span className="mt-1 block text-[10px] font-normal">نقدي</span>
                </button>
                <button
                  onClick={() => setMethod('card')}
                  className={cn('rounded-lg border px-4 py-3 text-xs font-bold transition', method === 'card' ? 'border-primary bg-primary/[0.06] text-primary' : 'border-card-border bg-background text-muted-foreground')}
                  data-testid="quick-method-card"
                >
                  <span className="block">CARD</span>
                  <span className="mt-1 block text-[10px] font-normal">كارت</span>
                </button>
              </div>
            </div>
            {payError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive" data-testid="quick-pay-error">
                {payError}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="soft" className="flex-1" onClick={() => setPayOpen(false)} disabled={paying}>
                العودة
              </Button>
              <Button
                onClick={confirmPay}
                className="flex-1 bg-[#f03e32] text-white shadow-[0_4px_0_#8d211c] hover:-translate-y-0.5"
                disabled={paying}
                data-testid="button-quick-confirm"
              >
                {paying ? 'جارِ الإتمام...' : 'تأكيد الدفع'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {receipt && (
        <Modal title="تم البيع بنجاح" onClose={() => setReceipt(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-[#58ae73]/10 p-4 text-center">
              <CircleCheck size={32} className="mx-auto text-[#58ae73]" />
              <p className="mt-3 font-mono-app text-sm font-bold">{receipt.invoiceNumber}</p>
              <strong className="mt-1 block font-mono-app text-2xl" data-testid="quick-receipt-total">{money.format(receipt.total)}</strong>
              <p className="mt-1 text-[10px] text-muted-foreground">{receipt.method === 'card' ? 'الدفع: كارت' : 'الدفع: نقدي'}</p>
            </div>
            <div className="rounded-lg border border-card-border bg-background p-4">
              {receipt.items && receipt.items.length > 0 ? (
                <div className="space-y-2">
                  {receipt.items.map((i) => (
                    <div key={i.productId} className="flex items-center justify-between text-xs">
                      <span>{i.name} ×{i.quantity}</span>
                      <span className="font-mono-app">{money.format(i.quantity * i.unitPrice)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">تم تسجيل البيع في سجل المبيعات</p>
              )}
            </div>
            <Button className="w-full bg-[#f03e32] text-white shadow-[0_4px_0_#8d211c] hover:-translate-y-0.5" onClick={() => setReceipt(null)} data-testid="button-quick-done">
              تم
            </Button>
          </div>
        </Modal>
      )}
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

  const r = reports ?? { today: 0, yesterday: 0, week: 0, month: 0, totalItems: 0, totalRevenue: 0, hourly: [], byRoom: [], byEmployee: [], topProducts: [], topProfit: [] };
  const maxHour = Math.max(...r.hourly, 1);
  const hours = r.hourly.map((v) => Math.round((v / maxHour) * 100));
  const labels = r.hourly.map((_, i) => {
    const d = new Date(Date.now() - (11 - i) * 3600 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });

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
          detail="آخر 7 أيام"
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
            <Badge tone="neutral">{money.format(r.hourly.reduce((a, b) => a + b, 0))}</Badge>
          </div>
          <div className="mt-10 flex h-48 items-end gap-2 border-b border-border px-2">
            {hours.map((height, i) => (
              <div key={i} className="group relative flex-1" title={`${money.format(r.hourly[i] ?? 0)}`}>
                <div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 font-mono-app text-[8px] text-background group-hover:block">
                  {money.format(r.hourly[i] ?? 0)}
                </div>
                <div
                  className={cn('w-full rounded-t-sm transition-all group-hover:bg-primary', (r.hourly[i] ?? 0) > 0 ? 'bg-primary/60' : 'bg-primary/10')}
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between px-1 font-mono-app text-[9px] text-muted-foreground">
            {labels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </section>
        <div className="space-y-5">
          <ReportList title="الأكثر مبيعاً" items={r.topProducts} suffix="قطعة" />
          <ReportList title="الأكثر ربحاً" items={r.topProfit} suffix="" moneyValue />
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
  const { isAdmin, profile } = useAuth();
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

  const handleDelete = async (user: UserProfile) => {
    if (profile && user.id === profile.id) {
      alert('لا يمكنك حذف حسابك الحالي');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف ${user.name}؟`)) return;
    try {
      const { deleteUser } = await import('@/lib/api');
      await deleteUser(user.id);
      await load();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  if (!isAdmin) {
    return <EmptyState title="غير مصرح" detail="هذه الصفحة متاحة لمديري النظام فقط." />;
  }

  return (
    <>
      <PageTitle
        eyebrow="الإدارة / الصلاحيات"
        title="المستخدمون"
        detail="إدارة صلاحيات الفريق."
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
                  <th className="px-5 py-4">إجراء</th>
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
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleDelete(user)}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500"
                        aria-label={`حذف ${user.name}`}
                        data-testid={`button-delete-user-${user.id}`}
                      >
                        <Trash2 size={15} />
                      </button>
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
  const { isAdmin, profile } = useAuth();
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('site_settings').select('value').eq('key', 'logo_url').single()
      .then(({ data }) => { if (data?.value) setLogo(data.value); })
      .catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) {
    return <EmptyState title="غير مصرح" detail="هذه الصفحة متاحة لمديري النظام فقط." />;
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'logo_url', value: dataUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (!error) {
        setLogo(dataUrl);
        window.dispatchEvent(new Event('logo-updated'));
      }
      setSaving(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setSaving(true);
    await supabase.from('site_settings').upsert({ key: 'logo_url', value: null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setLogo(null);
    window.dispatchEvent(new Event('logo-updated'));
    setSaving(false);
  };

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
              <h2 className="text-sm font-extrabold">الشعار</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">ارفع صورة لogo تظهر لجميع المستخدمين في الموقع.</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="grid h-16 w-16 place-items-center rounded-xl bg-secondary">
                {logo ? (
                  <img src={logo} alt="Logo" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <span className="text-lg font-black text-muted-foreground">EB</span>
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <Button onClick={() => fileRef.current?.click()} disabled={saving}>
                  <Upload size={14} />
                  {saving ? 'جاري الحفظ...' : 'ارفع شعار'}
                </Button>
                {logo && (
                  <Button variant="ghost" onClick={handleRemoveLogo} disabled={saving} className="text-destructive">
                    <Trash2 size={14} />
                    إزالة الشعار
                  </Button>
                )}
              </div>
            </div>
          </div>
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
              {[['العملة', 'جنيه مصري (EGP)'], ['الغرف', 'يمكن إضافة أو حذف غرف من لوحة التحكم'], ['قارئ الباركود', 'ادخل رقم الباركود يدوياً أو بالمسح'], ['المخزون', 'عند إغلاق الطلب يتم خصم المخزون تلقائياً']].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-3 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-extrabold">معلومات الحساب</h2>
          <div className="mt-5 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإصدار</span>
              <span className="font-mono-app">2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الاسم</span>
              <span className="font-bold">{profile?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الصلاحية</span>
              <Badge tone="red">{isAdmin ? 'مدير' : 'موظف'}</Badge>
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
      <Route path="/quick-sale">
        {() => (
          <ProtectedRoute>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <QuickSalePage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/products">
        {() => (
          <ProtectedRoute adminOnly>
            <Shell theme={theme} onToggleTheme={onToggleTheme}>
              <ProductsPage />
            </Shell>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory">
        {() => (
          <ProtectedRoute adminOnly>
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
          <ProtectedRoute adminOnly>
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
              detail="العودة إلى لوحة التحكم."
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
