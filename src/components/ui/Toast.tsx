import { X } from 'lucide-react';
import clsx from 'clsx';
import type { ToastItem } from './ToastProvider';

type ToastProps = {
  toast: ToastItem;
  onClose: (id: string) => void;
};

const tone: Record<ToastItem['type'], string> = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  warning: 'bg-amber-400',
  info: 'bg-sky-500',
};

const titleTone: Record<ToastItem['type'], string> = {
  success: 'text-emerald-900',
  error: 'text-rose-900',
  warning: 'text-amber-900',
  info: 'text-slate-900',
};

const Toast = ({ toast, onClose }: ToastProps) => (
  <div className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-eco-900/15 ring-1 ring-black/5 animate-[toast-in_180ms_ease-out]">
    <span className={clsx('mt-1 h-3 w-3 shrink-0 rounded-full', tone[toast.type])} />
    <div className="min-w-0 flex-1">
      <p className={clsx('text-sm font-bold', titleTone[toast.type])}>{toast.title}</p>
      {toast.message && <p className="mt-1 text-sm leading-5 text-slate-600">{toast.message}</p>}
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={toast.onAction}
          className="mt-3 text-sm font-bold text-eco-700 hover:text-eco-900"
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
    <button
      type="button"
      aria-label="Закрыть уведомление"
      onClick={() => onClose(toast.id)}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
    >
      <X size={16} />
    </button>
  </div>
);

export default Toast;
