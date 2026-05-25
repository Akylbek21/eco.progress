import { ReactNode, createContext, useCallback, useEffect, useMemo, useState } from 'react';
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

type ToastInput = Omit<ToastItem, 'id' | 'type' | 'title'>;

export type ToastContextValue = {
  show: (type: ToastType, title: string, message?: string, options?: ToastInput) => string;
  success: (title: string, message?: string, options?: ToastInput) => string;
  error: (title: string, message?: string, options?: ToastInput) => string;
  warning: (title: string, message?: string, options?: ToastInput) => string;
  info: (title: string, message?: string, options?: ToastInput) => string;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

const getErrorMessage = (value: unknown) => {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const maybe = value as { response?: { data?: { message?: string } }; message?: string };
    return maybe.response?.data?.message || maybe.message;
  }
  return '';
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((type: ToastType, title: string, message?: string, options: ToastInput = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const toast: ToastItem = { id, type, title, message, duration: 4200, ...options };
    setToasts((current) => [toast, ...current].slice(0, 5));

    if (toast.duration !== 0) {
      window.setTimeout(() => dismiss(id), toast.duration ?? 4200);
    }

    return id;
  }, [dismiss]);

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      show('error', 'Ошибка', getErrorMessage(event.reason) || 'Не удалось выполнить действие.');
    };
    const onError = (event: ErrorEvent) => {
      show('error', 'Ошибка', event.message || 'Произошла ошибка.');
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  }, [show]);

  const value = useMemo<ToastContextValue>(() => ({
    show,
    success: (title, message, options) => show('success', title, message, options),
    error: (title, message, options) => show('error', title, message, options),
    warning: (title, message, options) => show('warning', title, message, options),
    info: (title, message, options) => show('info', title, message, options),
    dismiss,
  }), [dismiss, show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex flex-col items-center gap-3 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[380px] sm:items-stretch sm:px-0">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
