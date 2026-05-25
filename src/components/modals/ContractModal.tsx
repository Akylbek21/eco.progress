import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { ContractType } from '../../types';

export type ContractModalValues = {
  contractNumber: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  file: File | null;
  comment: string;
  contractType: ContractType;
};

type ContractModalProps = {
  isOpen: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: ContractModalValues) => void | Promise<void>;
};

const ContractModal = ({ isOpen, loading = false, onClose, onSubmit }: ContractModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    setError('');
    try {
      await onSubmit({
        contractNumber: String(form.get('contractNumber') || ''),
        amount: String(form.get('amount') || ''),
        periodStart: String(form.get('periodStart') || ''),
        periodEnd: String(form.get('periodEnd') || ''),
        file: file?.name ? file : null,
        comment: String(form.get('comment') || ''),
        contractType: String(form.get('contractType') || 'one_time') as ContractType,
      });
      onClose();
    } catch {
      setError('Не удалось отправить договор.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Отправить договор" loading={loading}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Номер договора<input name="contractNumber" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Сумма договора<input name="amount" type="number" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Начало периода<input name="periodStart" type="date" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Окончание периода<input name="periodEnd" type="date" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Тип договора<select name="contractType" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="one_time">Разовый</option><option value="annual_quarterly">Годовой / квартальный</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Файл договора<input name="file" type="file" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий клиенту<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Отправить договор</Button></div>
      </form>
    </Modal>
  );
};

export default ContractModal;
