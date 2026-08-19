import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
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
  Zap,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getGetOrderQueryKey,
  getGetReportsQueryKey,
  getGetSaleQueryKey,
  getHealthCheckUrl,
  getListInventoryQueryKey,
  getListProductsQueryKey,
  getListRoomsQueryKey,
  getListSalesQueryKey,
  getListUsersQueryKey,
  useAddOrderItem,
  useCloseOrder,
  useCreateProduct,
  useDeleteProduct,
  useGetDashboard,
  useGetOrder,
  useGetReports,
  useGetSale,
  useHealthCheck,
  useListInventory,
  useListProducts,
  useListRooms,
  useListSales,
  useListUsers,
  useOpenRoomOrder,
  useRemoveOrderItem,
  useUpdateOrderItem,
  useUpdateProduct,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();
const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });

const demoRooms = Array.from({ length: 11 }, (_, index) => ({
  id: index + 1,
  name: `غرفة ${String(index + 1).padStart(2, '0')}`,
  status: index === 1 || index === 4 || index === 7 ? 'open' : 'available',
  total: index === 1 ? 485 : index === 4 ? 210 : index === 7 ? 760 : 0,
  orderId: index === 1 ? 101 : index === 4 ? 104 : index === 7 ? 107 : null,
}));
const demoProducts = [
  { id: 1, name: 'قهوة تركي', barcode: '6223008100012', sellingPrice: 42, costPrice: 17, stock: 86, category: 'مشروبات ساخنة', lowStockLimit: 20 },
  { id: 2, name: 'لاتيه فانيليا', barcode: '6223008100013', sellingPrice: 68, costPrice: 27, stock: 34, category: 'مشروبات ساخنة', lowStockLimit: 15 },
  { id: 3, name: 'مياه معدنية', barcode: '6223008100014', sellingPrice: 18, costPrice: 7, stock: 132, category: 'مشروبات باردة', lowStockLimit: 30 },
  { id: 4, name: 'تشيز كيك', barcode: '6223008100015', sellingPrice: 95, costPrice: 44, stock: 9, category: 'حلويات', lowStockLimit: 12 },
  { id: 5, name: 'بطاطس متبلة', barcode: '6223008100016', sellingPrice: 74, costPrice: 31, stock: 28, category: 'مقبلات', lowStockLimit: 10 },
  { id: 6, name: 'عصير مانجو', barcode: '6223008100017', sellingPrice: 58, costPrice: 21, stock: 0, category: 'مشروبات باردة', lowStockLimit: 12 },
];
const demoSales = [
  { id: 301, invoiceNumber: 'INV-240618-031', room: 'غرفة 08', employee: 'محمود حسن', date: '18 يونيو 2024', time: '22:48', total: 760 },
  { id: 300, invoiceNumber: 'INV-240618-030', room: 'غرفة 02', employee: 'سارة علي', date: '18 يونيو 2024', time: '22:16', total: 485 },
  { id: 299, invoiceNumber: 'INV-240618-029', room: 'غرفة 05', employee: 'يوسف أحمد', date: '18 يونيو 2024', time: '21:52', total: 210 },
  { id: 298, invoiceNumber: 'INV-240618-028', room: 'غرفة 09', employee: 'محمود حسن', date: '18 يونيو 2024', time: '21:11', total: 634 },
];

type Theme = 'light' | 'dark';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Logo({ invert = false }: { invert?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-brand-home">
      <span className={cn('grid h-10 w-10 place-items-center rounded-xl text-lg font-black tracking-tighter', invert ? 'bg-[#f03e32] text-white' : 'bg-[#161616] text-white')}>
        EB
      </span>
      <span className={cn('text-[17px] font-extrabold tracking-[0.18em]', invert ? 'text-white' : 'text-foreground')}>EL BAFFA</span>
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
  return <button type={props.type ?? 'button'} className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-[12px] font-bold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50', styles[variant], className)} {...props}>{children}</button>;
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'red' }) {
  const tones = {
    neutral: 'bg-secondary text-muted-foreground',
    success: 'bg-[#dff0e5] text-[#28603d] dark:bg-[#193525] dark:text-[#98d8ad]',
    warning: 'bg-[#fff0c9] text-[#805d04] dark:bg-[#3e3114] dark:text-[#f5d476]',
    danger: 'bg-[#f9dcd8] text-[#9e2e28] dark:bg-[#431f1b] dark:text-[#ffaba3]',
    red: 'bg-primary/10 text-primary',
  };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold', tones[tone])}>{children}</span>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-secondary', className)} />;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
    <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground"><Boxes size={20} /></span>
    <h3 className="text-sm font-bold">{title}</h3>
    <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">{detail}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

function PageTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{eyebrow}</div>
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
    {action}
  </div>;
}

const navItems = [
  { href: '/dashboard', label: 'نظرة عامة', icon: Home },
  { href: '/inventory', label: 'المخزون', icon: Boxes },
  { href: '/products', label: 'المنتجات', icon: Package, admin: true },
  { href: '/sales', label: 'المبيعات', icon: ShoppingBasket },
  { href: '/reports', label: 'التقارير', icon: FileBarChart },
  { href: '/users', label: 'المستخدمون', icon: Users, admin: true },
  { href: '/settings', label: 'الإعدادات', icon: Settings, admin: true },
];

function Shell({ children, theme, onToggleTheme }: { children: ReactNode; theme: Theme; onToggleTheme: () => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const health = useHealthCheck({ query: { queryKey: ['/api/healthz'], staleTime: 60_000 } });
  const runHealthCheck = () => { void health.refetch(); };
  return <div className="min-h-[100dvh] bg-background text-foreground" dir="rtl" data-health-endpoint={getHealthCheckUrl()}>
    <aside className={cn('fixed inset-y-0 right-0 z-40 flex w-[250px] flex-col border-l border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-200 md:translate-x-0', mobileOpen ? 'translate-x-0' : 'translate-x-full')}>
      <div className="mb-10 flex items-center justify-between px-2"><Logo invert /><button onClick={() => setMobileOpen(false)} className="text-white/60 md:hidden" data-testid="button-close-menu"><X size={18} /></button></div>
      <div className="mb-3 px-3 text-[9px] font-bold tracking-[0.2em] text-white/35">محطة التشغيل</div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location === item.href || (item.href !== '/dashboard' && location.startsWith(item.href));
          return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn('group flex items-center justify-between rounded-lg px-3 py-3 text-[11px] font-semibold transition-colors', active ? 'bg-sidebar-primary text-white' : 'text-white/55 hover:bg-sidebar-accent hover:text-white')} data-testid={`link-nav-${item.href.slice(1)}`}>
            <span className="flex items-center gap-3"><Icon size={17} strokeWidth={active ? 2.5 : 1.8} />{item.label}</span>
            {item.admin && <LockKeyhole size={12} className={active ? 'text-white/70' : 'text-white/25'} />}
          </Link>;
        })}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold"><span className={cn('h-2 w-2 rounded-full', health.isError ? 'bg-primary' : 'bg-[#62ce83]')} /> اتصال النظام</div>
          <div className="flex items-center justify-between text-[10px] text-white/45"><span>{health.isError ? 'تحقق من الخادم' : 'متصل ويعمل'}</span><button onClick={runHealthCheck} className="text-white/50 hover:text-white" data-testid="button-check-health"><RefreshCw size={12} /></button></div>
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e2b24b] text-xs font-black text-[#151515]">م ح</div>
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">محمود حسن</p><p className="mt-0.5 text-[9px] text-white/40">مدير المناوبة</p></div>
          <button className="text-white/40 hover:text-white" data-testid="button-sign-out"><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-[#111]/40 md:hidden" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" data-testid="button-overlay-menu" />}
    <main className="min-h-[100dvh] md:mr-[250px]">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
        <button className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={21} /></button>
        <div className="hidden text-[10px] font-bold text-muted-foreground md:block">{location === '/dashboard' ? 'الثلاثاء، 18 يونيو 2024' : 'EL BAFFA / مركز العمليات'}</div>
        <div className="mr-auto flex items-center gap-2 md:mr-0">
          <Button variant="ghost" className="h-9 min-h-9 px-3" onClick={onToggleTheme} data-testid="button-toggle-theme">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span className="hidden text-[10px] md:inline">{theme === 'dark' ? 'الوضع الأبيض' : 'الوضع الداكن'}</span></Button>
          <span className="hidden h-7 w-px bg-border md:block" />
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-[10px] font-black text-primary">م</div>
        </div>
      </header>
      <div className="mx-auto max-w-[1480px] px-4 py-7 md:px-8 md:py-9">{children}</div>
    </main>
  </div>;
}

function Landing() {
  return <div className="min-h-[100dvh] bg-[#171717] text-[#f5f0e8]" dir="rtl">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10"><Logo invert /><div className="flex items-center gap-3"><Link href="/sign-in" className="rounded-lg px-3 py-2 text-[11px] font-bold text-white/70 hover:text-white" data-testid="link-landing-sign-in">تسجيل الدخول</Link><Link href="/sign-up" className="rounded-lg bg-[#f03e32] px-4 py-2.5 text-[11px] font-bold text-white shadow-[0_4px_0_#8d211c]" data-testid="link-landing-sign-up">ابدأ الآن</Link></div></header>
    <section className="relative mx-auto grid max-w-7xl items-center gap-12 overflow-hidden px-5 pb-24 pt-16 md:grid-cols-[1.1fr_.9fr] md:px-10 md:pb-36 md:pt-24">
      <div className="relative z-10 animate-rise-in"><Badge tone="red">نظام تشغيل المبيعات والمخزون</Badge><h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-[1.22] tracking-tight md:text-7xl">كل طلب في مكانه.<br /><span className="text-[#f03e32]">كل لحظة محسوبة.</span></h1><p className="mt-7 max-w-lg text-sm leading-8 text-white/55">من أول نقرة على الغرفة إلى آخر فاتورة في الوردية — منصة واحدة صُممت لتتحرك مع إيقاع المكان، لا لتبطئه.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/sign-in" className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#f03e32] px-6 text-xs font-bold text-white shadow-[0_5px_0_#8d211c] transition-transform hover:-translate-y-0.5" data-testid="link-landing-enter"><Zap size={16} /> دخول مركز العمليات</Link><a href="#how" className="inline-flex min-h-12 items-center rounded-lg border border-white/15 px-6 text-xs font-bold text-white/75 hover:bg-white/5" data-testid="link-landing-learn">كيف يعمل النظام؟</a></div></div>
      <div className="relative animate-rise-in delay-2"><div className="absolute -inset-10 rounded-full bg-[#f03e32]/10 blur-3xl" /><div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#242424] p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3"><div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f03e32]" /><span className="h-2 w-2 rounded-full bg-[#e2b24b]" /><span className="h-2 w-2 rounded-full bg-[#62ce83]" /></div><span className="font-mono-app text-[9px] text-white/35">LIVE / SHIFT 08</span></div><div className="grid grid-cols-2 gap-3"><div className="col-span-2 rounded-xl bg-[#f03e32] p-5"><div className="flex items-center justify-between text-[10px] text-white/70"><span>مبيعات اليوم</span><TrendingUp size={15} /></div><strong className="mt-2 block text-3xl font-black">١٢٬٨٤٠ ج.م</strong><span className="mt-2 block text-[9px] text-white/65">+ ١٨٫٤٪ عن أمس</span></div>{['غرفة ٠٢','غرفة ٠٥','غرفة ٠٨','غرفة ١١'].map((room, index) => <div key={room} className="rounded-xl border border-white/8 bg-[#1b1b1b] p-4"><span className="text-[10px] text-white/45">{room}</span><div className="mt-3 flex items-center justify-between"><span className={cn('h-2 w-2 rounded-full', index === 3 ? 'bg-[#e2b24b]' : 'bg-[#62ce83]')} /><strong className="font-mono-app text-sm">{index === 0 ? '٤٨٥' : index === 1 ? '٢١٠' : index === 2 ? '٧٦٠' : '—'}</strong></div></div>)}</div></div></div>
    </section>
    <section id="how" className="border-y border-white/10 bg-[#1d1d1d] px-5 py-20 md:px-10"><div className="mx-auto max-w-7xl"><div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-[10px] font-bold tracking-[0.18em] text-[#f03e32]">صُمم للوردية الحقيقية</p><h2 className="mt-3 text-3xl font-extrabold md:text-4xl">أقل بحث. أكثر إنجاز.</h2></div><p className="max-w-sm text-xs leading-7 text-white/45">واجهة عملية ومباشرة، تتسع للمعلومات دون أن تزدحم بها.</p></div><div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">{[['01','افتح الغرفة','اختر الغرفة، ابدأ الطلب، واترك النظام يتولى الحساب.'],['02','أضف بنقرة','منتجات واضحة أو ماسح الباركود — الكمية تتحدث لحظياً.'],['03','أغلق بثقة','الفاتورة، البيع، وخصم المخزون تتم في خطوة واحدة.']].map(([num,title,desc]) => <div key={num} className="bg-[#1d1d1d] p-7 md:p-9"><span className="font-mono-app text-3xl text-[#f03e32]">{num}</span><h3 className="mt-9 text-lg font-bold">{title}</h3><p className="mt-3 text-xs leading-7 text-white/45">{desc}</p></div>)}</div></div></section>
    <section className="mx-auto flex max-w-7xl flex-col justify-between gap-7 px-5 py-20 md:flex-row md:items-center md:px-10"><div><p className="text-[10px] font-bold tracking-[0.18em] text-[#f03e32]">جاهز للوردية القادمة؟</p><h2 className="mt-3 max-w-xl text-3xl font-extrabold md:text-4xl">المكان سريع. نظامك يجب أن يكون أسرع.</h2></div><Link href="/sign-in" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#f03e32] px-6 text-xs font-bold text-white shadow-[0_5px_0_#8d211c]" data-testid="link-landing-final-cta">دخول مركز العمليات <ArrowLeft size={16} /></Link></section>
    <footer className="border-t border-white/10 px-5 py-6 text-[10px] text-white/35 md:px-10"><div className="mx-auto flex max-w-7xl justify-between"><span>© 2024 EL BAFFA</span><span>مصمم ليدير المكان بثبات</span></div></footer>
  </div>;
}

function AuthPage({ signUp = false }: { signUp?: boolean }) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const submit = (event: React.FormEvent) => { event.preventDefault(); setLoading(true); window.setTimeout(() => setLocation('/dashboard'), 500); };
  return <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[.85fr_1.15fr]" dir="rtl">
    <section className="hidden bg-[#171717] p-12 text-white lg:flex lg:flex-col lg:justify-between"><Logo invert /><div><Badge tone="red">EL BAFFA / الوصول الآمن</Badge><h1 className="mt-7 max-w-lg text-4xl font-extrabold leading-[1.4]">المناوبة تبدأ<br /><span className="text-primary">من هنا.</span></h1><p className="mt-5 max-w-sm text-xs leading-8 text-white/45">بيانات المبيعات والمخزون في مركز واحد، بصلاحيات واضحة لكل فرد في الفريق.</p></div><div className="flex items-center gap-2 text-[10px] text-white/35"><ShieldCheck size={15} className="text-primary" /> جلسة عمل مشفرة ومحمية</div></section>
    <section className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-[430px]"><div className="mb-10 lg:hidden"><Logo /></div><div className="mb-8"><p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-primary">مركز العمليات</p><h1 className="text-2xl font-extrabold">{signUp ? 'أنشئ حساب فريقك' : 'مرحباً بعودتك'}</h1><p className="mt-2 text-xs text-muted-foreground">{signUp ? 'أضف حساباً جديداً لفريق EL BAFFA.' : 'سجّل الدخول لمتابعة المناوبة.'}</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-bold">البريد الإلكتروني<input className="mt-2 h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" type="email" required placeholder="name@elbaffa.com" data-testid="input-auth-email" /></label><label className="block text-xs font-bold">كلمة المرور<input className="mt-2 h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" type="password" required placeholder="••••••••" data-testid="input-auth-password" /></label>{signUp && <label className="block text-xs font-bold">اسم الموظف<input className="mt-2 h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" required placeholder="الاسم بالكامل" data-testid="input-auth-name" /></label>}<Button className="mt-2 w-full" type="submit" disabled={loading} data-testid="button-auth-submit">{loading ? 'جارِ التحقق...' : signUp ? 'إنشاء الحساب' : 'دخول إلى النظام'}<ArrowLeft size={16} /></Button></form><div className="my-6 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border" />أو<span className="h-px flex-1 bg-border" /></div><Button variant="soft" className="w-full" onClick={() => setLocation('/dashboard')} data-testid="button-auth-demo">الدخول إلى وضع المعاينة</Button><p className="mt-7 text-center text-xs text-muted-foreground">{signUp ? 'لديك حساب بالفعل؟ ' : 'ليس لديك حساب؟ '}<Link href={signUp ? '/sign-in' : '/sign-up'} className="font-bold text-primary hover:underline" data-testid="link-auth-switch">{signUp ? 'تسجيل الدخول' : 'إنشاء حساب'}</Link></p><p className="mt-10 text-center text-[10px] text-muted-foreground/70">هذه الواجهة متصلة بمصادقة Clerk عند تفعيل بيئة الحساب.</p></div></section>
  </div>;
}

function StatCard({ label, value, detail, icon: Icon, accent = false }: { label: string; value: string; detail: string; icon: typeof TrendingUp; accent?: boolean }) {
  return <div className={cn('rounded-xl border p-5 transition-transform hover:-translate-y-0.5', accent ? 'border-primary bg-primary text-white' : 'border-card-border bg-card')}><div className="flex items-start justify-between"><span className={cn('text-[11px] font-semibold', accent ? 'text-white/70' : 'text-muted-foreground')}>{label}</span><span className={cn('grid h-8 w-8 place-items-center rounded-lg', accent ? 'bg-white/15' : 'bg-secondary text-primary')}><Icon size={16} /></span></div><strong className={cn('mt-5 block text-2xl font-extrabold tabular-nums', accent ? 'text-white' : 'text-foreground')}>{value}</strong><span className={cn('mt-2 block text-[10px]', accent ? 'text-white/65' : 'text-muted-foreground')}>{detail}</span></div>;
}

function RoomCard({ room, onOpen }: { room: any; onOpen: (room: any) => void }) {
  const open = room.status === 'open';
  return <button onClick={() => onOpen(room)} className={cn('group relative min-h-[150px] overflow-hidden rounded-xl border p-4 text-right transition-all hover:-translate-y-1 hover:shadow-lg', open ? 'border-primary/30 bg-primary/[0.055]' : 'border-card-border bg-card')} data-testid={`card-room-${room.id}`}><div className="flex items-start justify-between"><span className={cn('grid h-9 w-9 place-items-center rounded-lg text-xs font-black', open ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}>{String(room.id).padStart(2, '0')}</span><span className={cn('flex items-center gap-1.5 text-[10px] font-bold', open ? 'text-primary' : 'text-[#45825a]')}><span className={cn('h-1.5 w-1.5 rounded-full', open ? 'bg-primary' : 'bg-[#58ae73]')} />{open ? 'مفتوحة' : 'متاحة'}</span></div><div className="mt-5"><p className="text-sm font-bold">{room.name}</p>{open ? <div className="mt-2 flex items-end justify-between"><span className="text-[10px] text-muted-foreground">إجمالي الطلب</span><strong className="font-mono-app text-sm">{money.format(room.total)}</strong></div> : <p className="mt-2 text-[10px] text-muted-foreground">اضغط لفتح طلب جديد</p>}</div><ChevronLeft size={16} className="absolute bottom-4 left-4 text-muted-foreground/50 transition-transform group-hover:-translate-x-1" /></button>;
}

function DashboardPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const dashboard = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), staleTime: 30_000 } });
  const roomsQuery = useListRooms({ query: { queryKey: getListRoomsQueryKey(), staleTime: 30_000 } });
  const openRoom = useOpenRoomOrder();
  const rooms = roomsQuery.data?.length ? roomsQuery.data : dashboard.data?.rooms?.length ? dashboard.data.rooms : demoRooms;
  const data = dashboard.data;
  const openCount = rooms.filter((room: any) => room.status === 'open').length;
  const open = (room: any) => {
    if (room.orderId) { setLocation(`/rooms/${room.id}`); return; }
    openRoom.mutate({ roomId: room.id }, { onSuccess: (order: any) => { qc.setQueryData(getGetOrderQueryKey(order.id), order); void qc.invalidateQueries({ queryKey: getListRoomsQueryKey() }); setLocation(`/rooms/${room.id}`); } });
  };
  return <><PageTitle eyebrow="لوحة المناوبة / 01" title="نظرة عامة" detail="صورة حية لحركة المكان الآن." action={<Button onClick={() => void qc.invalidateQueries()} variant="soft" data-testid="button-refresh-dashboard"><RefreshCw size={15} /> تحديث البيانات</Button>} />
    <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="مبيعات اليوم" value={money.format(data?.todaySales ?? 12840)} detail="+ 18.4% مقارنة بأمس" icon={TrendingUp} accent /><StatCard label="طلبات مغلقة" value={integer.format(data?.todayOrders ?? 42)} detail={`${openCount} طلبات مفتوحة حالياً`} icon={ShoppingBasket} /><StatCard label="الأصناف المباعة" value={integer.format(data?.todayItems ?? 138)} detail="متوسط 3.2 صنف لكل طلب" icon={Package} /><StatCard label="تنبيهات المخزون" value={integer.format(data?.lowStockCount ?? 3)} detail="تحتاج إلى مراجعة اليوم" icon={CircleAlert} /></div>
    <section className="rounded-xl border border-card-border bg-card p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-extrabold">الغرف / 11 نقطة بيع</h2><p className="mt-1 text-[10px] text-muted-foreground">اختر غرفة لفتح الطلب أو متابعة الحساب</p></div><div className="flex items-center gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#58ae73]" /> متاحة</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> مفتوحة</span></div></div>{roomsQuery.isLoading && !roomsQuery.data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_,i) => <Skeleton key={i} className="h-[150px]" />)}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rooms.map((room: any) => <RoomCard key={room.id} room={room} onOpen={open} />)}</div>}</section>
  </>;
}

function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const roomId = Number(params.roomId);
  const productsQuery = useListProducts(undefined, { query: { queryKey: getListProductsQueryKey(), staleTime: 60_000 } });
  const roomsQuery = useListRooms({ query: { queryKey: getListRoomsQueryKey() } });
  const room = (roomsQuery.data?.length ? roomsQuery.data : demoRooms).find((item: any) => item.id === roomId) ?? demoRooms[roomId - 1] ?? demoRooms[0];
  const openOrder = useOpenRoomOrder();
  const orderId = room?.orderId ?? 101;
  const orderQuery = useGetOrder(orderId, { query: { enabled: Boolean(orderId), queryKey: getGetOrderQueryKey(orderId), staleTime: 15_000 } });
  const addItem = useAddOrderItem();
  const updateItem = useUpdateOrderItem();
  const removeItem = useRemoveOrderItem();
  const closeOrder = useCloseOrder();
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);
  const products = productsQuery.data?.length ? productsQuery.data : demoProducts;
  const order = orderQuery.data ?? { id: orderId, roomId, roomName: room.name, status: 'open', total: room.total, items: [{ id: 1, productId: 1, name: 'قهوة تركي', quantity: 2, unitPrice: 42, total: 84 }, { id: 2, productId: 4, name: 'تشيز كيك', quantity: 1, unitPrice: 95, total: 95 }], createdAt: '2024-06-18T20:42:00Z' };
  const visibleProducts = products.filter((item: any) => item.name.includes(search) || item.category.includes(search));
  const syncOrder = (next: any) => { qc.setQueryData(getGetOrderQueryKey(orderId), next); void qc.invalidateQueries({ queryKey: getListRoomsQueryKey() }); };
  const add = (product: any) => { addItem.mutate({ orderId, data: { productId: product.id, quantity: 1 } }, { onSuccess: syncOrder }); };
  const scan = (event: React.FormEvent) => { event.preventDefault(); const product = products.find((item: any) => item.barcode === barcode); if (product) add(product); setBarcode(''); };
  const update = (item: any, delta: number) => { const quantity = item.quantity + delta; if (quantity < 1) { removeItem.mutate({ orderId, itemId: item.id }, { onSuccess: syncOrder }); } else updateItem.mutate({ orderId, itemId: item.id, data: { quantity } }, { onSuccess: syncOrder }); };
  const close = () => closeOrder.mutate({ orderId }, { onSuccess: (invoice: any) => { void qc.invalidateQueries({ queryKey: getListSalesQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setLocation(`/sales/${invoice.id ?? orderId}`); } });
  return <><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground" data-testid="link-back-dashboard"><ArrowLeft size={16} /></Link><div><div className="mb-1 flex items-center gap-2"><Badge tone={room.status === 'open' ? 'red' : 'success'}>{room.status === 'open' ? 'طلب مفتوح' : 'غرفة جديدة'}</Badge><span className="font-mono-app text-[10px] text-muted-foreground">#{String(roomId).padStart(2, '0')}</span></div><h1 className="text-2xl font-extrabold">{room.name}</h1></div></div><div className="text-left"><span className="block text-[10px] text-muted-foreground">بدأت المناوبة</span><span className="font-mono-app text-xs">20:42</span></div></div>
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_390px]"><section className="min-w-0 rounded-xl border border-card-border bg-card p-5 md:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-extrabold">كتالوج المنتجات</h2><p className="mt-1 text-[10px] text-muted-foreground">انقر للإضافة أو استخدم قارئ الباركود</p></div><form onSubmit={scan} className="flex h-10 w-full max-w-[280px] items-center gap-2 rounded-lg border border-input bg-background px-3"><ScanLine size={15} className="text-primary" /><input ref={barcodeRef} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="مسح الباركود..." className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" data-testid="input-barcode-scanner" /><kbd className="hidden rounded bg-secondary px-1.5 py-1 font-mono-app text-[8px] text-muted-foreground sm:block">USB</kbd></form></div><div className="relative mb-5"><Search size={15} className="absolute right-3 top-3 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background pr-9 text-xs outline-none focus:border-primary" placeholder="ابحث باسم المنتج أو التصنيف..." data-testid="input-product-search-room" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.map((product: any) => <button key={product.id} onClick={() => add(product)} className="group rounded-xl border border-card-border bg-background p-3 text-right transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md" data-testid={`button-add-product-${product.id}`}><div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-secondary text-primary"><Package size={25} strokeWidth={1.4} /></div><p className="truncate text-[11px] font-bold">{product.name}</p><p className="mt-1 truncate text-[9px] text-muted-foreground">{product.category}</p><div className="mt-3 flex items-center justify-between"><strong className="font-mono-app text-xs">{money.format(product.sellingPrice)}</strong><span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-white transition group-hover:scale-110"><Plus size={13} /></span></div></button>)}</div>{visibleProducts.length === 0 && <EmptyState title="لا توجد نتائج" detail="جرّب البحث باسم مختلف أو امسح باركود المنتج." />}</section>
      <section className="sticky top-[88px] rounded-xl border border-[#2a2a2a] bg-[#171717] p-5 text-white shadow-xl dark:bg-[#101010]"><div className="mb-5 flex items-start justify-between border-b border-white/10 pb-4"><div><p className="text-[10px] font-bold tracking-[0.15em] text-[#f03e32]">الطلب الحالي</p><h2 className="mt-2 text-lg font-extrabold">{room.name}</h2></div><span className="font-mono-app text-[10px] text-white/35">#{order.id}</span></div><div className="max-h-[340px] space-y-2 overflow-auto scrollbar-thin">{order.items?.map((item: any) => <div key={item.id} className="rounded-lg bg-white/[0.055] p-3" data-testid={`row-order-item-${item.id}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">{item.name}</span><strong className="font-mono-app text-xs">{money.format(item.total)}</strong></div><div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-white/40">{money.format(item.unitPrice)} / وحدة</span><div className="flex items-center gap-2"><button onClick={() => update(item, -1)} className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white/70 hover:bg-[#f03e32]" data-testid={`button-decrease-item-${item.id}`}><Minus size={13} /></button><span className="w-4 text-center font-mono-app text-xs">{item.quantity}</span><button onClick={() => update(item, 1)} className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white/70 hover:bg-[#f03e32]" data-testid={`button-increase-item-${item.id}`}><Plus size={13} /></button><button onClick={() => removeItem.mutate({ orderId, itemId: item.id }, { onSuccess: syncOrder })} className="mr-1 text-white/35 hover:text-[#f03e32]" data-testid={`button-remove-item-${item.id}`}><Trash2 size={13} /></button></div></div></div>)}</div>{(!order.items || order.items.length === 0) && <div className="py-14 text-center text-xs text-white/40">لم تتم إضافة أصناف بعد</div>}<div className="mt-5 border-t border-white/10 pt-5"><div className="flex items-center justify-between text-xs text-white/50"><span>الإجمالي</span><strong className="font-mono-app text-xl text-white">{money.format(order.total ?? order.items?.reduce((sum: number, i: any) => sum + i.total, 0) ?? 0)}</strong></div><Button variant="primary" className="mt-5 w-full" onClick={close} disabled={closeOrder.isPending || !order.items?.length} data-testid="button-close-order"><Check size={16} />{closeOrder.isPending ? 'جارِ إغلاق الطلب...' : 'إغلاق الطلب وإصدار الفاتورة'}</Button><p className="mt-3 text-center text-[9px] text-white/30">سيتم خصم الأصناف من المخزون تلقائياً</p></div></section></div>
  </>;
}

function ProductsPage() {
  const qc = useQueryClient();
  const productsQuery = useListProducts(undefined, { query: { queryKey: getListProductsQueryKey(), staleTime: 30_000 } });
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<any>(null);
  const products = productsQuery.data?.length ? productsQuery.data : demoProducts;
  const filtered = products.filter((item: any) => item.name.includes(search) || item.barcode.includes(search));
  const save = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const data = { name: String(form.get('name')), barcode: String(form.get('barcode')), category: String(form.get('category')), sellingPrice: Number(form.get('sellingPrice')), costPrice: Number(form.get('costPrice')), stock: Number(form.get('stock')), lowStockLimit: Number(form.get('lowStockLimit')), image: '' }; const onSuccess = () => { setModal(null); void qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); }; if (modal?.mode === 'edit') update.mutate({ productId: modal.product.id, data }, { onSuccess }); else create.mutate({ data }, { onSuccess }); };
  return <><PageTitle eyebrow="الإدارة / كتالوج" title="المنتجات" detail="إدارة الأسعار، الباركود، وحدود المخزون." action={<Button onClick={() => setModal({ mode: 'create' })} data-testid="button-new-product"><Plus size={16} /> منتج جديد</Button>} /><div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative max-w-md flex-1"><Search size={15} className="absolute right-3 top-3 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-card pr-9 text-xs outline-none focus:border-primary" placeholder="ابحث بالاسم أو الباركود..." data-testid="input-products-search" /></div><Badge tone="neutral">{integer.format(filtered.length)} منتج</Badge></div><div className="overflow-hidden rounded-xl border border-card-border bg-card">{productsQuery.isLoading && !productsQuery.data ? <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton className="h-12" key={i} />)}</div> : filtered.length === 0 ? <div className="p-4"><EmptyState title="لا توجد منتجات" detail="أضف أول منتج إلى كتالوج EL BAFFA." action={<Button onClick={() => setModal({ mode: 'create' })}>إضافة منتج</Button>} /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-right"><thead className="bg-secondary/70 text-[10px] font-bold text-muted-foreground"><tr><th className="px-5 py-4">المنتج</th><th className="px-5 py-4">الباركود</th><th className="px-5 py-4">التصنيف</th><th className="px-5 py-4">سعر البيع</th><th className="px-5 py-4">المخزون</th><th className="px-5 py-4">إجراء</th></tr></thead><tbody className="divide-y divide-border/80">{filtered.map((product: any) => <tr key={product.id} className="text-xs hover:bg-secondary/30" data-testid={`row-product-${product.id}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><Package size={16} /></span><span className="font-bold">{product.name}</span></div></td><td className="px-5 py-4 font-mono-app text-[10px] text-muted-foreground">{product.barcode}</td><td className="px-5 py-4 text-muted-foreground">{product.category}</td><td className="px-5 py-4 font-mono-app">{money.format(product.sellingPrice)}</td><td className="px-5 py-4"><Badge tone={product.stock === 0 ? 'danger' : product.stock <= product.lowStockLimit ? 'warning' : 'success'}>{product.stock} وحدة</Badge></td><td className="px-5 py-4"><div className="flex gap-1"><Button variant="ghost" className="h-8 min-h-8 w-8 p-0" onClick={() => setModal({ mode: 'edit', product })} data-testid={`button-edit-product-${product.id}`}>تعديل</Button><button className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => { if (window.confirm('حذف هذا المنتج؟')) deleteProduct.mutate({ productId: product.id }, { onSuccess: () => void qc.invalidateQueries({ queryKey: getListProductsQueryKey() }) }); }} data-testid={`button-delete-product-${product.id}`}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>}</div>{modal && <Modal title={modal.mode === 'edit' ? 'تعديل المنتج' : 'إضافة منتج'} onClose={() => setModal(null)}><ProductForm product={modal.product} onSubmit={save} pending={create.isPending || update.isPending} /></Modal>}</>;
}

function ProductForm({ product, onSubmit, pending }: { product?: any; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; pending: boolean }) {
  return <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold sm:col-span-2">اسم المنتج<input name="name" defaultValue={product?.name} required className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary" data-testid="input-product-name" /></label><label className="text-xs font-bold">الباركود<input name="barcode" defaultValue={product?.barcode} required className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono-app text-xs outline-none focus:border-primary" data-testid="input-product-barcode" /></label><label className="text-xs font-bold">التصنيف<input name="category" defaultValue={product?.category} required className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary" data-testid="input-product-category" /></label>{[['sellingPrice','سعر البيع'],['costPrice','سعر التكلفة'],['stock','الكمية الحالية'],['lowStockLimit','حد التنبيه']].map(([name,label]) => <label key={name} className="text-xs font-bold">{label}<input name={name} type="number" min="0" step="0.01" defaultValue={product?.[name] ?? 0} required className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono-app text-xs outline-none focus:border-primary" data-testid={`input-product-${name}`} /></label>)}<Button type="submit" className="mt-2 sm:col-span-2" disabled={pending} data-testid="button-save-product">{pending ? 'جارِ الحفظ...' : 'حفظ المنتج'}<Check size={15} /></Button></form>;
}

function InventoryPage() {
  const inventoryQuery = useListInventory({ query: { queryKey: getListInventoryQueryKey(), staleTime: 30_000 } });
  const rows = inventoryQuery.data?.length ? inventoryQuery.data : demoProducts.map((p: any) => ({ productId: p.id, name: p.name, barcode: p.barcode, stock: p.stock, sellingPrice: p.sellingPrice, lowStockLimit: p.lowStockLimit, status: p.stock === 0 ? 'out' : p.stock <= p.lowStockLimit ? 'low' : 'good' }));
  const low = rows.filter((item: any) => item.status !== 'good');
  return <><PageTitle eyebrow="المخزون / الحالة الحية" title="مراقبة المخزون" detail="اعرف ما يحتاجه الرف قبل أن يطلبه العميل." action={<Button variant="soft" data-testid="button-inventory-export"><FileBarChart size={15} /> تصدير الحالة</Button>} /><div className="mb-6 grid gap-3 sm:grid-cols-3"><StatCard label="إجمالي الأصناف" value={integer.format(rows.length)} detail="أصناف نشطة في الكتالوج" icon={Boxes} /><StatCard label="يحتاج إعادة طلب" value={integer.format(low.length)} detail="تحت حد التنبيه" icon={CircleAlert} /><StatCard label="قيمة البيع المتاحة" value={money.format(rows.reduce((sum: number, row: any) => sum + row.stock * row.sellingPrice, 0))} detail="تقدير قيمة المخزون" icon={TrendingUp} /></div><div className="overflow-hidden rounded-xl border border-card-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-extrabold">حالة الأصناف</h2><p className="mt-1 text-[10px] text-muted-foreground">آخر تحديث منذ لحظات</p></div><Badge tone={low.length ? 'warning' : 'success'}>{low.length ? `${low.length} تنبيهات` : 'كل شيء مستقر'}</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right"><thead className="bg-secondary/60 text-[10px] text-muted-foreground"><tr><th className="px-5 py-4">الصنف</th><th className="px-5 py-4">الباركود</th><th className="px-5 py-4">الكمية</th><th className="px-5 py-4">الحد الأدنى</th><th className="px-5 py-4">المؤشر</th></tr></thead><tbody className="divide-y divide-border/80">{rows.map((row: any) => <tr key={row.productId} className="text-xs"><td className="px-5 py-4 font-bold">{row.name}</td><td className="px-5 py-4 font-mono-app text-[10px] text-muted-foreground">{row.barcode}</td><td className="px-5 py-4 font-mono-app text-sm">{row.stock}</td><td className="px-5 py-4 font-mono-app text-muted-foreground">{row.lowStockLimit}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><Badge tone={row.status === 'out' ? 'danger' : row.status === 'low' ? 'warning' : 'success'}>{row.status === 'out' ? 'نفد' : row.status === 'low' ? 'منخفض' : 'جيد'}</Badge><div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary"><div className={cn('h-full rounded-full', row.status === 'out' ? 'bg-primary' : row.status === 'low' ? 'bg-[#d9a62c]' : 'bg-[#58ae73]')} style={{ width: `${Math.min(100, row.stock / Math.max(row.lowStockLimit * 2, 1) * 100)}%` }} /></div></div></td></tr>)}</tbody></table></div></div></>;
}

function SalesPage() {
  const salesQuery = useListSales({ query: { queryKey: getListSalesQueryKey(), staleTime: 30_000 } });
  const sales = salesQuery.data?.length ? salesQuery.data : demoSales;
  return <><PageTitle eyebrow="المبيعات / السجل" title="سجل المبيعات" detail="كل الفواتير المغلقة في ورديات المكان." action={<Button variant="soft" data-testid="button-sales-filter"><Clock3 size={15} /> آخر 30 يوماً</Button>} /><div className="mb-5 flex gap-3"><div className="rounded-lg border border-card-border bg-card px-4 py-3"><span className="block text-[10px] text-muted-foreground">إجمالي الفترة</span><strong className="mt-1 block font-mono-app text-lg">{money.format(sales.reduce((sum: number, sale: any) => sum + sale.total, 0))}</strong></div><div className="rounded-lg border border-card-border bg-card px-4 py-3"><span className="block text-[10px] text-muted-foreground">عدد الفواتير</span><strong className="mt-1 block font-mono-app text-lg">{integer.format(sales.length)}</strong></div></div><div className="overflow-hidden rounded-xl border border-card-border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right"><thead className="bg-secondary/60 text-[10px] text-muted-foreground"><tr><th className="px-5 py-4">رقم الفاتورة</th><th className="px-5 py-4">الغرفة</th><th className="px-5 py-4">الموظف</th><th className="px-5 py-4">التاريخ</th><th className="px-5 py-4">الإجمالي</th><th className="px-5 py-4" /></tr></thead><tbody className="divide-y divide-border/80">{sales.map((sale: any) => <tr key={sale.id} className="text-xs hover:bg-secondary/30" data-testid={`row-sale-${sale.id}`}><td className="px-5 py-4"><Link href={`/sales/${sale.id}`} className="font-mono-app font-bold text-primary hover:underline" data-testid={`link-sale-${sale.id}`}>{sale.invoiceNumber}</Link></td><td className="px-5 py-4 font-bold">{sale.room}</td><td className="px-5 py-4 text-muted-foreground">{sale.employee}</td><td className="px-5 py-4 text-muted-foreground">{sale.date} <span className="mr-2 font-mono-app text-[10px]">{sale.time}</span></td><td className="px-5 py-4 font-mono-app font-bold">{money.format(sale.total)}</td><td className="px-5 py-4 text-left"><ChevronLeft size={16} className="text-muted-foreground" /></td></tr>)}</tbody></table></div></div></>;
}

function SaleDetailsPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = Number(params.saleId);
  const saleQuery = useGetSale(saleId, { query: { enabled: Boolean(saleId), queryKey: getGetSaleQueryKey(saleId) } });
  const sale: any = saleQuery.data ?? { id: saleId, invoiceNumber: `INV-240618-${String(saleId).padStart(3, '0')}`, room: 'غرفة 08', roomName: 'غرفة 08', employee: 'محمود حسن', date: '18 يونيو 2024', time: '22:48', total: 760, items: [{ id: 1, name: 'قهوة تركي', quantity: 4, unitPrice: 42, total: 168 }, { id: 2, name: 'تشيز كيك', quantity: 2, unitPrice: 95, total: 190 }, { id: 3, name: 'بطاطس متبلة', quantity: 2, unitPrice: 74, total: 148 }] };
  return <><div className="mb-6 flex items-center gap-3"><Link href="/sales" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground" data-testid="link-back-sales"><ArrowLeft size={16} /></Link><div><p className="text-[10px] font-bold text-primary">الفاتورة / تفاصيل البيع</p><h1 className="mt-1 text-2xl font-extrabold">{sale.invoiceNumber}</h1></div><Button variant="soft" className="mr-auto" onClick={() => window.print()} data-testid="button-print-invoice"><Printer size={15} /> طباعة</Button></div><div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1fr_280px]"><section className="rounded-xl border border-card-border bg-card p-6 md:p-9"><div className="flex items-start justify-between border-b border-border pb-6"><div><Logo /><p className="mt-4 text-[10px] text-muted-foreground">فاتورة مبيعات</p></div><div className="text-left"><Badge tone="success"><CircleCheck size={12} /> مكتملة</Badge><p className="mt-3 font-mono-app text-[10px] text-muted-foreground">{sale.date} / {sale.time}</p></div></div><div className="grid grid-cols-2 gap-5 border-b border-border py-6 text-xs"><div><span className="block text-[10px] text-muted-foreground">الغرفة</span><strong className="mt-1 block">{sale.roomName ?? sale.room}</strong></div><div><span className="block text-[10px] text-muted-foreground">الموظف</span><strong className="mt-1 block">{sale.employee}</strong></div></div><div className="py-5"><div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-4 text-[10px] font-bold text-muted-foreground"><span>الصنف</span><span>الكمية</span><span>الإجمالي</span></div>{sale.items?.map((item: any) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-border/70 py-4 text-xs"><span className="font-bold">{item.name}</span><span className="font-mono-app text-muted-foreground">{item.quantity}</span><span className="font-mono-app">{money.format(item.total)}</span></div>)}</div><div className="flex items-center justify-between border-t-2 border-foreground pt-5"><span className="text-sm font-bold">الإجمالي</span><strong className="font-mono-app text-xl">{money.format(sale.total)}</strong></div></section><aside className="h-fit rounded-xl bg-[#171717] p-5 text-white"><p className="text-[10px] font-bold tracking-[0.15em] text-[#f03e32]">ملخص سريع</p><strong className="mt-5 block text-3xl font-extrabold">{money.format(sale.total)}</strong><p className="mt-2 text-[10px] text-white/45">تم تسجيل البيع بنجاح</p><div className="mt-7 space-y-4 border-t border-white/10 pt-5 text-xs"><div className="flex justify-between"><span className="text-white/45">عدد الأصناف</span><span>{sale.items?.length ?? 0}</span></div><div className="flex justify-between"><span className="text-white/45">طريقة الدفع</span><span>نقدي</span></div></div></aside></div></>;
}

function ReportsPage() {
  const reportsQuery = useGetReports({ query: { queryKey: getGetReportsQueryKey(), staleTime: 60_000 } });
  const r = reportsQuery.data ?? { today: 12840, yesterday: 10842, week: 74620, month: 281460, totalItems: 1850, totalRevenue: 281460, byRoom: demoRooms.slice(0, 6).map((room: any, i) => ({ label: room.name, value: [18, 12, 23, 9, 15, 21][i] })), byEmployee: [{ label: 'محمود حسن', value: 48200 }, { label: 'سارة علي', value: 41180 }, { label: 'يوسف أحمد', value: 35240 }], topProducts: [{ label: 'قهوة تركي', quantity: 284 }, { label: 'مياه معدنية', quantity: 221 }, { label: 'تشيز كيك', quantity: 98 }] };
  const bars = [42, 68, 55, 78, 48, 88, 72, 61, 92, 65, 76, 81];
  return <><PageTitle eyebrow="التحليل / قراءة الأداء" title="التقارير" detail="إشارات واضحة تساعدك على قرار الوردية التالية." action={<Button variant="soft" data-testid="button-reports-period"><Clock3 size={15} /> هذا الشهر</Button>} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="اليوم" value={money.format(r.today)} detail={`أمس ${money.format(r.yesterday)}`} icon={TrendingUp} accent /><StatCard label="هذا الأسبوع" value={money.format(r.week)} detail="من السبت إلى اليوم" icon={BarChart3} /><StatCard label="هذا الشهر" value={money.format(r.month)} detail="إجمالي الإيراد" icon={FileBarChart} /><StatCard label="الوحدات المباعة" value={integer.format(r.totalItems)} detail="منذ بداية الشهر" icon={Package} /></div><div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><section className="rounded-xl border border-card-border bg-card p-5 md:p-6"><div className="flex items-start justify-between"><div><h2 className="text-sm font-extrabold">إيقاع المبيعات</h2><p className="mt-1 text-[10px] text-muted-foreground">آخر 12 ساعة تشغيل</p></div><Badge tone="success"><TrendingUp size={12} /> + 18.4%</Badge></div><div className="mt-10 flex h-48 items-end gap-2 border-b border-border px-2">{bars.map((height, i) => <div key={i} className="group relative flex-1"><div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 font-mono-app text-[8px] text-background group-hover:block">{height * 120}</div><div className={cn('w-full rounded-t-sm transition-all group-hover:bg-primary', i === 8 ? 'bg-primary' : 'bg-primary/25')} style={{ height: `${height}%` }} /></div>)}</div><div className="mt-3 flex justify-between px-1 font-mono-app text-[9px] text-muted-foreground"><span>12:00</span><span>16:00</span><span>20:00</span><span>00:00</span></div></section><section className="rounded-xl border border-card-border bg-card p-5 md:p-6"><h2 className="text-sm font-extrabold">الأكثر مبيعاً</h2><p className="mt-1 text-[10px] text-muted-foreground">بالوحدات خلال الفترة</p><div className="mt-6 space-y-5">{r.topProducts.map((product: any, i: number) => <div key={product.label}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold">{product.label}</span><span className="font-mono-app text-muted-foreground">{product.quantity}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={cn('h-full rounded-full', i === 0 ? 'bg-primary' : i === 1 ? 'bg-[#e2b24b]' : 'bg-[#438c8e]')} style={{ width: `${Math.min(100, product.quantity / 3)}%` }} /></div></div>)}</div></section></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><ReportList title="أداء الغرف" items={r.byRoom} suffix="طلب" /><ReportList title="أداء الموظفين" items={r.byEmployee} suffix="ج.م" moneyValue /></div></>;
}

function ReportList({ title, items, suffix, moneyValue = false }: { title: string; items: any[]; suffix: string; moneyValue?: boolean }) {
  return <section className="rounded-xl border border-card-border bg-card p-5"><h2 className="text-sm font-extrabold">{title}</h2><div className="mt-4 divide-y divide-border/70">{items.map((item, i) => <div key={item.label} className="flex items-center gap-3 py-3 text-xs"><span className="font-mono-app text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span><span className="flex-1 font-bold">{item.label}</span><span className="font-mono-app">{moneyValue ? money.format(item.value) : `${item.value} ${suffix}`}</span></div>)}</div></section>;
}

function UsersPage() {
  const usersQuery = useListUsers({ query: { queryKey: getListUsersQueryKey(), staleTime: 60_000 } });
  const users = usersQuery.data?.length ? usersQuery.data : [{ id: 'usr-1', name: 'محمود حسن', email: 'mahmoud@elbaffa.com', role: 'admin', active: true }, { id: 'usr-2', name: 'سارة علي', email: 'sara@elbaffa.com', role: 'employee', active: true }, { id: 'usr-3', name: 'يوسف أحمد', email: 'youssef@elbaffa.com', role: 'employee', active: false }];
  return <><PageTitle eyebrow="الإدارة / الصلاحيات" title="المستخدمون" detail="إدارة من يمكنه الوصول إلى مركز العمليات." action={<Button onClick={() => window.alert('سيتم فتح دعوة مستخدم جديدة عند تفعيل إدارة الحسابات.')} data-testid="button-invite-user"><Plus size={16} /> دعوة مستخدم</Button>} /><div className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.045] p-4 text-xs"><div className="flex items-center gap-3"><ShieldCheck size={18} className="text-primary" /><div><strong>صلاحيات الإدارة محمية</strong><p className="mt-1 text-[10px] text-muted-foreground">هذه الصفحة متاحة لمديري النظام فقط. لا يمكن للموظف تعديل المنتجات أو المستخدمين.</p></div></div></div><div className="overflow-hidden rounded-xl border border-card-border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right"><thead className="bg-secondary/60 text-[10px] text-muted-foreground"><tr><th className="px-5 py-4">المستخدم</th><th className="px-5 py-4">الدور</th><th className="px-5 py-4">الحالة</th><th className="px-5 py-4">إجراء</th></tr></thead><tbody className="divide-y divide-border/80">{users.map((user: any) => <tr key={user.id} className="text-xs" data-testid={`row-user-${user.id}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-[10px] font-black text-primary">{user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span><div><p className="font-bold">{user.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{user.email}</p></div></div></td><td className="px-5 py-4"><Badge tone={user.role === 'admin' ? 'red' : 'neutral'}>{user.role === 'admin' ? 'مدير' : 'موظف'}</Badge></td><td className="px-5 py-4"><Badge tone={user.active ? 'success' : 'neutral'}>{user.active ? 'نشط' : 'موقوف'}</Badge></td><td className="px-5 py-4"><button className="text-[10px] font-bold text-primary hover:underline" onClick={() => window.alert('تعديل الصلاحيات متاح من حساب المدير.')} data-testid={`button-edit-user-${user.id}`}>تعديل الصلاحيات</button></td></tr>)}</tbody></table></div></div></>;
}

function SettingsPage({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return <><PageTitle eyebrow="النظام / التفضيلات" title="الإعدادات" detail="تحكم في طريقة عمل النظام داخل المكان." /><div className="grid max-w-4xl gap-5 lg:grid-cols-[1fr_280px]"><section className="space-y-5"><div className="rounded-xl border border-card-border bg-card p-5"><div className="mb-5"><h2 className="text-sm font-extrabold">المظهر</h2><p className="mt-1 text-[10px] text-muted-foreground">اختيارك محفوظ على هذا الجهاز.</p></div><div className="grid gap-3 sm:grid-cols-2"><button onClick={() => theme === 'dark' && onToggleTheme()} className={cn('rounded-xl border p-4 text-right transition', theme === 'light' ? 'border-primary bg-primary/[0.04]' : 'border-border')} data-testid="button-theme-light"><div className="mb-5 h-16 rounded-lg border border-[#ded6cb] bg-[#f5f1eb] p-2"><div className="h-2 w-1/2 rounded bg-[#171717]/15" /><div className="mt-2 h-7 rounded bg-white" /></div><div className="flex items-center justify-between"><span className="text-xs font-bold">الوضع الأبيض</span>{theme === 'light' && <Check size={15} className="text-primary" />}</div></button><button onClick={() => theme === 'light' && onToggleTheme()} className={cn('rounded-xl border p-4 text-right transition', theme === 'dark' ? 'border-primary bg-primary/[0.04]' : 'border-border')} data-testid="button-theme-dark"><div className="mb-5 h-16 rounded-lg border border-[#3a3a3a] bg-[#171717] p-2"><div className="h-2 w-1/2 rounded bg-white/20" /><div className="mt-2 h-7 rounded bg-[#282828]" /></div><div className="flex items-center justify-between"><span className="text-xs font-bold">الوضع الداكن</span>{theme === 'dark' && <Check size={15} className="text-primary" />}</div></button></div></div><div className="rounded-xl border border-card-border bg-card p-5"><h2 className="text-sm font-extrabold">إعدادات التشغيل</h2><div className="mt-5 divide-y divide-border/70">{[['العملة','جنيه مصري (EGP)'],['عدد الغرف','11 غرفة ثابتة'],['قارئ الباركود','متصل عبر USB']].map(([label,value]) => <div key={label} className="flex items-center justify-between py-4 text-xs"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>)}</div></div></section><aside className="h-fit rounded-xl border border-card-border bg-card p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Settings size={20} /></div><h2 className="mt-5 text-sm font-extrabold">عن النظام</h2><p className="mt-2 text-[10px] leading-6 text-muted-foreground">EL BAFFA — مركز عمليات المبيعات والمخزون.</p><div className="mt-5 border-t border-border pt-4 text-[10px] text-muted-foreground"><div className="flex justify-between"><span>الإصدار</span><span className="font-mono-app">1.0.0</span></div><div className="mt-3 flex justify-between"><span>الحالة</span><span className="flex items-center gap-1.5 font-bold text-[#45825a]"><span className="h-1.5 w-1.5 rounded-full bg-[#58ae73]" /> متصل</span></div></div></aside></div></>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111]/55 p-4 backdrop-blur-sm"><div className="max-h-[90dvh] w-full max-w-xl overflow-auto rounded-2xl border border-card-border bg-card p-5 shadow-2xl md:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-extrabold">{title}</h2><button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" data-testid="button-close-modal"><X size={18} /></button></div>{children}</div></div>;
}

function AppRouter({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return <Switch><Route path="/" component={Landing} /><Route path="/sign-in/*?" component={() => <AuthPage />} /><Route path="/sign-up/*?" component={() => <AuthPage signUp />} /><Route path="/dashboard">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><DashboardPage /></Shell>}</Route><Route path="/rooms/:roomId">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><RoomPage /></Shell>}</Route><Route path="/products">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><ProductsPage /></Shell>}</Route><Route path="/inventory">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><InventoryPage /></Shell>}</Route><Route path="/sales">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><SalesPage /></Shell>}</Route><Route path="/sales/:saleId">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><SaleDetailsPage /></Shell>}</Route><Route path="/reports">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><ReportsPage /></Shell>}</Route><Route path="/users">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><UsersPage /></Shell>}</Route><Route path="/settings">{() => <Shell theme={theme} onToggleTheme={onToggleTheme}><SettingsPage theme={theme} onToggleTheme={onToggleTheme} /></Shell>}</Route><Route component={() => <div className="min-h-[100dvh] bg-background p-10"><EmptyState title="الصفحة غير موجودة" detail="العودة إلى مركز العمليات للوصول إلى الصفحات المتاحة." action={<Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-xs font-bold text-white" data-testid="link-not-found-dashboard">العودة للوحة</Link>} /></div>} /></Switch>;
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('el-baffa-theme') as Theme) || 'light');
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('el-baffa-theme', theme); }, [theme]);
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={window.location.pathname}><AppRouter theme={theme} onToggleTheme={() => setTheme(current => current === 'light' ? 'dark' : 'light')} /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;