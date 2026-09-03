import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'info' | 'warning' | 'success' | 'error';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: { type?: ToastType; title: string; description?: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const DEFAULTS: Record<ToastType, { border: string; icon: string; iconNode: ReactNode }> = {
  info: { border: 'border-primary/50', icon: 'text-primary', iconNode: <CircleAlert size={16} /> },
  warning: { border: 'border-[#e2b24b]/70', icon: 'text-[#e2b24b]', iconNode: <CircleAlert size={16} /> },
  success: { border: 'border-[#58ae73]/70', icon: 'text-[#58ae73]', iconNode: <CircleCheck size={16} /> },
  error: { border: 'border-destructive/70', icon: 'text-destructive', iconNode: <CircleAlert size={16} /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: { type?: ToastType; title: string; description?: string; duration?: number }) => {
    const id = idRef.current++;
    const item: ToastItem = { id, type: t.type ?? 'info', title: t.title, description: t.description };
    setToasts((prev) => [...prev.slice(-4), item]);
    const duration = t.duration ?? (t.type === 'warning' ? 8000 : 5000);
    window.setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const d = DEFAULTS[t.type];
          return (
            <div
              key={t.id}
              role="status"
              data-testid={`toast-${t.type}`}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card p-4 shadow-2xl',
                d.border,
              )}
            >
              <span className={cn('mt-0.5 shrink-0', d.icon)}>{d.iconNode}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold leading-snug">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
