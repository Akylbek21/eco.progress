import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type InvoiceModalValues = {
  invoiceNumber: string;
  amount: number;
  invoiceDate: string;
  dueDate: string;
  file: File | null;
  comment: string;
};

type InvoiceModalProps = {
  isOpen: boolean;
  loading?: boolean;
  defaultAmount?: number;
  onClose: () => void;
  onSubmit: (values: InvoiceModalValues) => void | Promise<void>;
};

const InvoiceModal = ({ isOpen, loading = false, defaultAmount = 0, onClose, onSubmit }: InvoiceModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    setError('');
    try {
      await onSubmit({
        invoiceNumber: String(form.get('invoiceNumber') || ''),
        amount: Number(form.get('amount') || 0),
        invoiceDate: String(form.get('invoiceDate') || new Date().toISOString().slice(0, 10)),
        dueDate: String(form.get('dueDate') || ''),
        file: file?.name ? file : null,
        comment: String(form.get('comment') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось выставить счет.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Выставить счет" description="После отправки счет будет доступен клиенту в кабинете." loading={loading}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Номер счета<input name="invoiceNumber" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Сумма<input name="amount" type="number" defaultValue={defaultAmount || ''} required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Дата счета<input name="invoiceDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Срок оплаты<input name="dueDate" type="date" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Файл счета<input name="file" type="file" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий клиенту<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Отправить счет</Button></div>
      </form>
    </Modal>
  );
};

export default InvoiceModal;
