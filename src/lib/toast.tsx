import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  description?: string;
}

interface ToastCtx {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastViewport />
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const KIND_STYLES: Record<ToastKind, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: 'bg-success-50', border: 'border-success-200', icon: 'text-success-600', text: 'text-success-800' },
  error: { bg: 'bg-danger-50', border: 'border-danger-200', icon: 'text-danger-600', text: 'text-danger-800' },
  warning: { bg: 'bg-warning-50', border: 'border-warning-200', icon: 'text-warning-600', text: 'text-warning-800' },
  info: { bg: 'bg-brand-50', border: 'border-brand-200', icon: 'text-brand-600', text: 'text-brand-800' },
};

const KIND_ICONS: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

function ToastViewport() {
  const { toasts, dismiss } = useToastCtx();
  return (
    <div className="fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const s = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={`animate-slide-in flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} px-4 py-3 shadow-pop`}
            role="alert"
          >
            <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white text-xs font-bold ${s.icon}`}>
              {KIND_ICONS[t.kind]}
            </span>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${s.text}`}>{t.message}</p>
              {t.description && <p className="mt-0.5 text-xs text-ink-600">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-400 transition hover:text-ink-700"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

// internal hook to avoid circular dep
function useToastCtx(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('ToastCtx missing');
  return ctx;
}
