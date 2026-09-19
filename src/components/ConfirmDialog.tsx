import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setState((cur) => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}
        >
          <div className="w-full max-w-sm rounded-xl border border-card-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-destructive">
                <TriangleAlert size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold leading-snug">{state.opts.title}</p>
                {state.opts.message && (
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{state.opts.message}</p>
                )}
              </div>
              <button
                onClick={() => close(false)}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => close(true)}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-xs font-extrabold text-white transition-colors',
                  state.opts.danger ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90',
                )}
              >
                {state.opts.confirmText ?? 'تأكيد'}
              </button>
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-lg border border-card-border bg-secondary px-4 py-2 text-xs font-extrabold transition-colors hover:bg-secondary/70"
              >
                {state.opts.cancelText ?? 'إلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}