import { createContext, ReactNode, useCallback, useMemo, useState } from 'react';
import Toast from './Toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export type ToastInput = Omit<ToastItem, 'id' | 'type' | 'title'>;

export type ToastContextValue = {
  show: (type: ToastType, title: string, message?: string, options?: ToastInput) => string;
  success: (title: string, message?: string, options?: ToastInput) => string;
  error: (title: string, message?: string, options?: ToastInput) => string;
  warning: (title: string, message?: string, options?: ToastInput) => string;
  info: (title: string, message?: string, options?: ToastInput) => string;
  close: (id: string) => void;
  clear: () => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4200;

const createId = () => `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const close = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((type: ToastType, title: string, message?: string, options: ToastInput = {}) => {
    const id = createId();
    const toast: ToastItem = {
      id,
      type,
      title,
      message,
      duration: options.duration ?? DEFAULT_DURATION,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    };
    setToasts((items) => [toast, ...items].slice(0, 5));
    if (toast.duration && toast.duration > 0) {
      window.setTimeout(() => close(id), toast.duration);
    }
    return id;
  }, [close]);

  const value = useMemo<ToastContextValue>(() => ({
    show,
    success: (title, message, options) => show('success', title, message, options),
    error: (title, message, options) => show('error', title, message, options),
    warning: (title, message, options) => show('warning', title, message, options),
    info: (title, message, options) => show('info', title, message, options),
    close,
    clear: () => setToasts([]),
  }), [show, close]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[140] mx-auto flex max-w-md flex-col gap-3 sm:inset-x-auto sm:right-5 sm:mx-0 sm:w-[420px]">
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onClose={close} />)}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
