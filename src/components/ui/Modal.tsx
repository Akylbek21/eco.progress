import { ReactNode } from 'react';
import clsx from 'clsx';

type ModalProps = {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
};

const Modal = ({ open, title, children, onClose }: ModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            {title && <h2 className="text-xl font-semibold text-slate-900">{title}</h2>}
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-3 py-2 text-slate-700 transition hover:bg-slate-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
