import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type LaboratoryMeasurementValues = {
  measurementDate: string;
  measurementTime: string;
  address: string;
  contactPerson: string;
  phone: string;
  measurementScope: string;
  comment: string;
  sendToClient: boolean;
};

type LaboratoryMeasurementModalProps = {
  isOpen: boolean;
  loading?: boolean;
  defaults?: Partial<LaboratoryMeasurementValues>;
  onClose: () => void;
  onSubmit: (values: LaboratoryMeasurementValues) => void | Promise<void>;
};

const LaboratoryMeasurementModal = ({ isOpen, loading = false, defaults = {}, onClose, onSubmit }: LaboratoryMeasurementModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await onSubmit({
        measurementDate: String(form.get('measurementDate') || ''),
        measurementTime: String(form.get('measurementTime') || ''),
        address: String(form.get('address') || ''),
        contactPerson: String(form.get('contactPerson') || ''),
        phone: String(form.get('phone') || ''),
        measurementScope: String(form.get('measurementScope') || ''),
        comment: String(form.get('comment') || ''),
        sendToClient: form.get('sendToClient') === 'on',
      });
      onClose();
    } catch {
      setError('Не удалось назначить замер.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Назначить замер" size="lg" loading={loading}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Дата замера<input name="measurementDate" type="date" defaultValue={defaults.measurementDate || ''} required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Время<input name="measurementTime" type="time" defaultValue={defaults.measurementTime || ''} required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Адрес объекта<input name="address" defaultValue={defaults.address || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Ответственное лицо<input name="contactPerson" defaultValue={defaults.contactPerson || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Телефон<input name="phone" defaultValue={defaults.phone || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Что нужно замерить<textarea name="measurementScope" defaultValue={defaults.measurementScope || ''} rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий<textarea name="comment" defaultValue={defaults.comment || ''} rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2"><input name="sendToClient" type="checkbox" className="accent-[#38C7BA]" /> Отправить клиенту на согласование</label>
        <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Сохранить замер</Button></div>
      </form>
    </Modal>
  );
};

export default LaboratoryMeasurementModal;
