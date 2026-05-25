import { X } from 'lucide-react';
import clsx from 'clsx';
import type { ToastItem } from './ToastProvider';

const tone: Record<ToastItem['type'], { bar: string; label: string }> = {
  success: { bar: 'bg-emerald-500', label: 'text-emerald-700' },
  error: { bar: 'bg-rose-500', label: 'text-rose-700' },
  warning: { bar: 'bg-amber-500', label: 'text-amber-700' },
  info: { bar: 'bg-eco-500', label: 'text-eco-700' },
};

type ToastProps = {
  toast: ToastItem;
  onClose: (id: string) => void;
};

const Toast = ({ toast, onClose }: ToastProps) => {
  const colors = tone[toast.type];

  return (
    <div className="pointer-events-auto w-full animate-[toast-in_180ms_ease-out] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-eco-900/12">
      <div className="flex gap-3 p-4">
        <span className={clsx('mt-1 h-9 w-1.5 shrink-0 rounded-full', colors.bar)} />
        <div className="min-w-0 flex-1">
          <p className={clsx('text-sm font-bold', colors.label)}>{toast.title}</p>
          {toast.message && <p className="mt-1 text-sm leading-5 text-slate-600">{toast.message}</p>}
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={toast.onAction}
              className="mt-3 text-sm font-bold text-eco-700 transition hover:text-eco-900"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          aria-label="Закрыть уведомление"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
