import { FormEvent, ReactNode, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../ui/Button';
import type { StaffManualOrderPayload } from '../../types';

type StaffNewOrderFormProps = {
  loading?: boolean;
  onSubmit: (payload: StaffManualOrderPayload) => void | Promise<void>;
};

const sources: Array<{ value: StaffManualOrderPayload['source']; label: string }> = [
  { value: 'site', label: 'Сайт' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Звонок' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'recommendation', label: 'Рекомендация' },
  { value: 'old_client', label: 'Старый клиент' },
  { value: 'other', label: 'Другое' },
];

const StaffNewOrderForm = ({ loading = false, onSubmit }: StaffNewOrderFormProps) => {
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const preset = {
    clientId: searchParams.get('clientId') || '',
    clientName: searchParams.get('clientName') || '',
    companyName: searchParams.get('companyName') || '',
    bin: searchParams.get('bin') || '',
    phone: searchParams.get('phone') || '',
    whatsapp: searchParams.get('whatsapp') || '',
    email: searchParams.get('email') || '',
    city: searchParams.get('city') || '',
    service: searchParams.get('service') || '',
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const files = form.getAll('files').filter((file): file is File => file instanceof File && Boolean(file.name));
    const payload: StaffManualOrderPayload = {
      clientId: String(form.get('clientId') || ''),
      clientName: String(form.get('clientName') || ''),
      companyName: String(form.get('companyName') || ''),
      bin: String(form.get('bin') || ''),
      phone: String(form.get('phone') || ''),
      whatsapp: String(form.get('whatsapp') || ''),
      email: String(form.get('email') || ''),
      city: String(form.get('city') || ''),
      serviceId: String(form.get('serviceId') || ''),
      service: String(form.get('service') || ''),
      serviceType: String(form.get('serviceType') || ''),
      urgency: String(form.get('urgency') || 'Обычная'),
      source: String(form.get('source') || 'call') as StaffManualOrderPayload['source'],
      comment: String(form.get('comment') || ''),
      responsibleManagerId: String(form.get('responsibleManagerId') || ''),
      files,
    };
    if (!payload.clientName || !payload.phone || !payload.service) {
      setError('Укажите клиента, телефон и услугу.');
      return;
    }
    await onSubmit(payload);
    event.currentTarget.reset();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Клиент"><input name="clientName" required defaultValue={preset.clientName} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="ID клиента"><input name="clientId" defaultValue={preset.clientId} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Компания"><input name="companyName" defaultValue={preset.companyName} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="БИН / ИИН"><input name="bin" defaultValue={preset.bin} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Телефон"><input name="phone" required defaultValue={preset.phone} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="WhatsApp"><input name="whatsapp" defaultValue={preset.whatsapp} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={preset.email} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Город"><input name="city" defaultValue={preset.city} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Услуга"><input name="service" required defaultValue={preset.service} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Тип услуги"><input name="serviceType" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Срочность">
          <select name="urgency" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option>Обычная</option>
            <option>Срочная</option>
            <option>Очень срочная</option>
          </select>
        </Field>
        <Field label="Источник заявки">
          <select name="source" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
            {sources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
          </select>
        </Field>
        <Field label="Ответственный менеджер"><input name="responsibleManagerId" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Файлы"><input name="files" type="file" multiple className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
      </div>
      <label className="text-sm font-semibold text-slate-700">
        Комментарий
        <textarea name="comment" rows={4} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
      </label>
      <div className="flex justify-end">
        <Button disabled={loading}>Создать заявку</Button>
      </div>
    </form>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="text-sm font-semibold text-slate-700">
    {label}
    <div className="mt-2">{children}</div>
  </label>
);

export default StaffNewOrderForm;

