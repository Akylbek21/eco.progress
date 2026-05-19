import { FormEvent, useState } from 'react';
import Button from './ui/Button';
import { createLead } from '../services/leadService';
import { trackLeadSubmit } from '../services/analytics';

type LeadFormProps = {
  source?: string;
  title?: string;
  compact?: boolean;
  defaultService?: string;
};

const serviceOptions = [
  'Экологические документы',
  'Вывоз отходов',
  'Утилизация отходов',
  'Лабораторные анализы',
  'Полигон ТБО',
  'Сопровождение проверки',
  'Не знаю, нужна консультация',
];

const LeadForm = ({ source = 'site_form', title = 'Получить консультацию', compact = false, defaultService = 'Не знаю, нужна консультация' }: LeadFormProps) => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const city = String(form.get('city') || '').trim();
    const serviceType = String(form.get('serviceType') || '').trim();
    const comment = String(form.get('comment') || '').trim();
    if (!name || !phone || !serviceType) return;

    setLoading(true);
    setError(false);
    setSent(false);
    try {
      const lead = await createLead({ name, phone, city, serviceType, comment, source });
      setSent(true);
      event.currentTarget.reset();
      try { trackLeadSubmit({ source, serviceType, leadId: lead.id }); } catch {}
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-xl shadow-eco-900/8 sm:p-7">
      <h2 className="text-2xl font-bold text-eco-900">{title}</h2>
      {!compact && <p className="mt-3 text-sm leading-6 text-slate-600">Оставьте контакты. Специалист ECOPROGRESS GROUP свяжется с вами и подскажет следующий шаг.</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Имя *
          <input name="name" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Телефон / WhatsApp *
          <input name="phone" required inputMode="tel" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Город
          <input name="city" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Что нужно? *
          <select name="serviceType" required defaultValue={defaultService} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
            {serviceOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Комментарий
        <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={compact ? 3 : 4} />
      </label>
      <Button disabled={loading} className="mt-5 w-full">{loading ? 'Отправляем...' : 'Отправить заявку'}</Button>
      {sent && <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">Спасибо! Специалист ECOPROGRESS GROUP свяжется с вами в ближайшее время.</p>}
      {error && <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">Не удалось отправить заявку. Попробуйте позже или свяжитесь по WhatsApp.</p>}
    </form>
  );
};

export default LeadForm;
