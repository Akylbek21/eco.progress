import { FormEvent, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from './ui/Button';
import { createLead } from '../services/leadService';
import { trackLeadSubmit } from '../services/analytics';
import { useToast } from '../hooks/useToast';

type LeadFormProps = {
  source?: string;
  title?: string;
  compact?: boolean;
  defaultService?: string;
  variant?: 'light' | 'blue';
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

const LeadForm = ({ source = 'site_form', title = 'Получить консультацию', compact = false, defaultService = 'Не знаю, нужна консультация', variant = 'light' }: LeadFormProps) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const isBlue = variant === 'blue';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
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
      toast.success('Заявка создана', 'Менеджер получил вашу заявку и свяжется с вами.');
      formEl.reset();
      try { trackLeadSubmit({ source, serviceType, leadId: lead.id }); } catch {}
    } catch {
      setError(true);
      toast.error('Не удалось создать заявку', 'Проверьте данные и попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className={`rounded-[24px] border p-5 shadow-xl sm:p-7 ${isBlue ? 'border-eco-700 bg-eco-900 text-white shadow-eco-900/18' : 'border-slate-200 bg-white shadow-eco-900/8'}`}>
      <h2 className={`text-2xl font-bold ${isBlue ? 'text-white' : 'text-eco-900'}`}>{title}</h2>
      {!compact && <p className={`mt-3 text-sm leading-6 ${isBlue ? 'text-white/72' : 'text-slate-600'}`}>Оставьте контакты. Специалист ecoprogress.kz свяжется с вами и подскажет следующий шаг.</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          Имя *
          <input name="name" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          <span className="inline-flex items-center gap-1.5"><FaWhatsapp className="text-[#25D366]" size={15} aria-hidden="true" /> Телефон / WhatsApp *</span>
          <input name="phone" required inputMode="tel" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          Город
          <input name="city" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          Что нужно? *
          <select name="serviceType" required defaultValue={defaultService} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900">
            {serviceOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <label className={`mt-4 block text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
        Комментарий
        <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" rows={compact ? 3 : 4} />
      </label>
      <Button disabled={loading} className={`mt-5 w-full ${isBlue ? 'bg-accent text-eco-900 hover:bg-accent/90' : ''}`}>{loading ? 'Отправляем...' : 'Отправить заявку'}</Button>
      {sent && <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">Спасибо! Специалист ecoprogress.kz свяжется с вами в ближайшее время.</p>}
      {error && <p className="mt-4 inline-flex w-full items-start gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800"><FaWhatsapp className="mt-0.5 shrink-0 text-[#25D366]" size={16} aria-hidden="true" /> Не удалось отправить заявку. Попробуйте позже или свяжитесь по WhatsApp.</p>}
    </form>
  );
};

export default LeadForm;
