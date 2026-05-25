import { FormEvent, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from './ui/Button';
import { createWhatsAppLeadMessage, createWhatsAppUrl } from '../utils/whatsapp';
import { trackWhatsAppClick } from '../services/analytics';
import { useToast } from '../hooks/useToast';

type WhatsAppLeadFormProps = {
  title?: string;
  defaultService?: string;
  source?: string;
  compact?: boolean;
};

const serviceOptions = [
  'Экологические документы',
  'Вывоз отходов',
  'Утилизация отходов',
  'Лабораторные замеры',
  'Полигон ТБО',
  'Сопровождение проверки',
  'Нужна консультация',
];

const WhatsAppLeadForm = ({
  title = 'Заявка через WhatsApp',
  defaultService = '',
  source = 'whatsapp_form',
  compact = false,
}: WhatsAppLeadFormProps) => {
  const toast = useToast();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const serviceSelectOptions = Array.from(new Set([defaultService, ...serviceOptions].filter(Boolean)));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const service = String(form.get('service') || '').trim();
    const company = String(form.get('company') || '').trim();
    const bin = String(form.get('bin') || '').trim();
    const city = String(form.get('city') || '').trim();
    const comment = String(form.get('comment') || '').trim();

    setError('');
    setNotice('');
    setManualUrl('');

    if (!name || !phone || !service) {
      setError('Заполните имя, телефон и услугу.');
      toast.error('Ошибка', 'Заполните имя, телефон и услугу.');
      return;
    }

    const url = createWhatsAppUrl(createWhatsAppLeadMessage({ service, name, phone, company, bin, city, comment }));
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;

    trackWhatsAppClick({ placement: source, service });
    setManualUrl(url);
    setNotice(opened ? 'WhatsApp открыт. Отправьте сообщение менеджеру.' : 'Если WhatsApp не открылся, откройте ссылку вручную.');
    if (opened) {
      toast.success('WhatsApp открыт', 'Отправьте сообщение менеджеру.');
    } else {
      toast.warning('WhatsApp не открылся', 'Откройте ссылку вручную.');
    }
  };

  return (
    <form onSubmit={submit} className="min-w-0 overflow-hidden rounded-[24px] border border-green-100 bg-white p-5 shadow-xl shadow-eco-900/8 sm:p-7">
      <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-eco-900"><FaWhatsapp className="text-[#25D366]" size={24} aria-hidden="true" /> {title}</h2>
      {!compact && (
        <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600">
          <FaWhatsapp className="mt-1 shrink-0 text-[#25D366]" size={16} aria-hidden="true" />
          <span>Заполните короткую заявку. Мы откроем WhatsApp с готовым сообщением, вам останется отправить его менеджеру.</span>
        </p>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Имя *
          <input name="name" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Телефон *
          <input name="phone" required inputMode="tel" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Компания
          <input name="company" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          БИН
          <input name="bin" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Город
          <input name="city" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Услуга *
          <select name="service" required defaultValue={defaultService} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <option value="">Выберите услугу</option>
            {serviceSelectOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Комментарий
        <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={compact ? 3 : 4} />
      </label>
      <Button type="submit" className="mt-5 w-full gap-2 bg-[#25D366] text-white hover:bg-[#20bd5a]">
        <FaWhatsapp size={18} aria-hidden="true" /> Отправить через WhatsApp
      </Button>
      {error && <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p>}
      {notice && <p className="mt-4 flex items-start gap-2 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800"><FaWhatsapp className="mt-0.5 shrink-0 text-[#25D366]" size={16} aria-hidden="true" /> <span>{notice}</span></p>}
      {manualUrl && (
        <a href={manualUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#168a42] hover:text-[#0f6b32]">
          <FaWhatsapp size={16} aria-hidden="true" />
          Открыть WhatsApp вручную
        </a>
      )}
    </form>
  );
};

export default WhatsAppLeadForm;
