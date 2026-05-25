import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type CreateClientModalValues = {
  contactPerson: string;
  phone: string;
  email: string;
  companyName: string;
  bin: string;
  address: string;
  comment: string;
};

type CreateClientModalProps = {
  isOpen: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateClientModalValues) => void | Promise<void>;
};

const CreateClientModal = ({ isOpen, loading = false, onClose, onSubmit }: CreateClientModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await onSubmit({
        contactPerson: String(form.get('contactPerson') || ''),
        phone: String(form.get('phone') || ''),
        email: String(form.get('email') || ''),
        companyName: String(form.get('companyName') || ''),
        bin: String(form.get('bin') || ''),
        address: String(form.get('address') || ''),
        comment: String(form.get('comment') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось создать клиента.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Создать клиента" description="Для клиента будет создан профиль, заявку можно оформить сразу после этого." loading={loading}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">ФИО контактного лица<input name="contactPerson" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Телефон<input name="phone" type="tel" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Email<input name="email" type="email" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Название компании<input name="companyName" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">БИН<input name="bin" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Адрес<input name="address" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Создать клиента</Button></div>
      </form>
    </Modal>
  );
};

export default CreateClientModal;
