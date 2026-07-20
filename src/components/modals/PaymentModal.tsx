import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { PaymentMethod } from '../../types';
import { formatCurrency, paymentMethodLabel } from '../../utils/payments';

export type PaymentModalMode = 'client_receipt' | 'partial' | 'full';
export type PaymentModalValues = {
  mode: PaymentModalMode;
  amount: number;
  date: string;
  method: PaymentMethod;
  paymentOrderNumber: string;
  file: File | null;
  comment: string;
};

type PaymentModalProps = {
  isOpen: boolean;
  mode: PaymentModalMode;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentModalValues) => void | Promise<void>;
};

const methods: PaymentMethod[] = ['bank_transfer', 'cash', 'card', 'other'];

const PaymentModal = ({ isOpen, mode, totalAmount = 0, paidAmount = 0, remainingAmount = 0, loading = false, onClose, onSubmit }: PaymentModalProps) => {
  const [error, setError] = useState('');
  const title = mode === 'client_receipt' ? 'Загрузить чек оплаты' : mode === 'full' ? 'Подтвердить полную оплату' : 'Отметить частичную оплату';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    try {
      await onSubmit({
        mode,
        amount: Number(form.get('amount') || (mode === 'full' ? remainingAmount : 0)),
        date: String(form.get('date') || new Date().toISOString().slice(0, 10)),
        method: String(form.get('method') || 'bank_transfer') as PaymentMethod,
        paymentOrderNumber: String(form.get('paymentOrderNumber') || ''),
        file: file?.name ? file : null,
        comment: String(form.get('comment') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось сохранить оплату.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Сумма" value={formatCurrency(totalAmount)} />
          <Info label="Оплачено" value={formatCurrency(paidAmount)} />
          <Info label="Остаток" value={formatCurrency(remainingAmount)} />
        </div>
        <label className="text-sm font-semibold text-slate-700">Оплаченная сумма<input name="amount" type="number" min="0" defaultValue={mode === 'full' ? remainingAmount : ''} required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Дата оплаты<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Способ оплаты<select name="method" defaultValue="bank_transfer" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">{methods.map((method) => <option key={method} value={method}>{paymentMethodLabel(method)}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Номер платёжного поручения<input name="paymentOrderNumber" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Файл чека / поручения<input name="file" type="file" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Отмена</Button><Button type="submit" disabled={loading}>{loading ? 'Отправка...' : mode === 'full' ? 'Подтвердить оплату' : 'Сохранить оплату'}</Button></div>
      </form>
    </Modal>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-sm font-bold text-slate-900">{value}</p></div>;

export default PaymentModal;
