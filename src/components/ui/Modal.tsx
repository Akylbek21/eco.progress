import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';

type ModalProps = {
  open?: boolean;
  isOpen?: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'wizard';
  closeOnBackdrop?: boolean;
  loading?: boolean;
  contentClassName?: string;
  onClose: () => void;
};

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  wizard: 'h-dvh max-h-dvh max-w-none rounded-none sm:h-[92vh] sm:max-h-[92vh] sm:w-[94vw] sm:max-w-[1400px] sm:rounded-[24px]',
};

const Modal = ({
  open,
  isOpen,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  loading = false,
  contentClassName,
  onClose,
}: ModalProps) => {
  const visible = isOpen ?? open ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const loadingRef = useRef(loading);
  onCloseRef.current = onClose;
  loadingRef.current = loading;

  useEffect(() => {
    if (!visible) return;

    const originalOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';

    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []);
    window.requestAnimationFrame(() => (focusable()[0] || dialogRef.current)?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loadingRef.current) onCloseRef.current();
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 py-6 backdrop-blur-sm sm:p-5"
      onMouseDown={() => {
        if (closeOnBackdrop && !loading) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        className={clsx(
          'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl shadow-eco-900/15',
          'animate-[modal-in_160ms_ease-out]',
          sizeClass[size],
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              {title && <h2 id="modal-title" className="text-lg font-bold text-eco-900 sm:text-xl">{title}</h2>}
              {description && <p id="modal-description" className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onClose}
              disabled={loading}
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={clsx('min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6', contentClassName)}>
          {loading && (
            <div className="mb-4 rounded-2xl bg-eco-50 px-4 py-3 text-sm font-semibold text-eco-800">
              Выполняем действие...
            </div>
          )}
          {children}
        </div>
        {footer && (
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
