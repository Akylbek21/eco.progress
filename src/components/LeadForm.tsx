import { FormEvent, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from './ui/Button';
import { createLead } from '../services/leadService';
import { getLeadAttribution, trackContentEvent, trackEvent, trackLeadSubmit } from '../services/analytics';
import { useToast } from '../hooks/useToast';
import { createWhatsAppLeadMessage, createWhatsAppUrl } from '../utils/whatsapp';
import { activeServices } from '../content/serviceCatalog';

type LeadFormProps = {
  source?: string;
  title?: string;
  compact?: boolean;
  defaultService?: string;
  variant?: 'light' | 'blue';
  formId?: string;
  ctaId?: string;
  serviceSlug?: string;
  sourcePage?: string;
  locale?: 'ru' | 'kk';
};

const ruServiceOptions = [...activeServices.map((service) => service.title), 'Не знаю, нужна консультация'];
const kkServiceOptions = ['Экологиялық қызметтер', 'Қалдықтар паспорты', 'ШРШ жобасы', 'ПЭК бағдарламасы', 'ПЭК есебі', 'Экологиялық рұқсат', 'СҚА жобасы', 'Зертханалық зерттеулер', 'Су анализі', 'Қалдықтарды кәдеге жарату', 'Қай қызмет керек екенін білмеймін'];

const LeadForm = ({ source = 'site_form', title = 'Получить консультацию', compact = false, defaultService = 'Не знаю, нужна консультация', variant = 'light', formId = source, ctaId, serviceSlug, sourcePage, locale = 'ru' }: LeadFormProps) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [whatsAppFallbackUrl, setWhatsAppFallbackUrl] = useState('');
  const [started, setStarted] = useState(false);
  const isBlue = variant === 'blue';
  const isKk = locale === 'kk';
  const serviceOptions = isKk ? [...new Set([defaultService, ...kkServiceOptions])] : ruServiceOptions;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const city = String(form.get('city') || '').trim();
    const serviceType = String(form.get('serviceType') || '').trim();
    const comment = String(form.get('comment') || '').trim();
    const selectedService = activeServices.find((item) => item.title === serviceType);
    setWhatsAppFallbackUrl('');
    if (!name || !phone || !serviceType) {
      toast.error(isKk ? 'Міндетті жолдарды толтырыңыз' : 'Заполните обязательные поля', isKk ? 'Атыңызды, телефонды және қызмет түрін көрсетіңіз.' : 'Укажите имя, телефон и тип услуги.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      toast.error(isKk ? 'Телефон нөмірін тексеріңіз' : 'Проверьте телефон', isKk ? 'Дұрыс телефон немесе WhatsApp нөмірін енгізіңіз.' : 'Введите корректный номер телефона или WhatsApp.');
      return;
    }

    setLoading(true);
    setError(false);
    setSent(false);
    try {
      trackEvent('form_submit', { lead_source: source, service_type: serviceType });
      const resolvedService = selectedService || activeServices.find((item) => item.slug === serviceSlug);
      const attribution = {
        ...getLeadAttribution(),
        sourceType: sourcePage ? 'REGIONAL_PAGE' as const : getLeadAttribution().sourceType,
        sourceSlug: sourcePage?.replace(/^\//, '') || getLeadAttribution().sourceSlug,
        sourceUrl: sourcePage || getLeadAttribution().sourceUrl,
        pageUrl: sourcePage || getLeadAttribution().pageUrl,
        locale,
        serviceId: resolvedService?.id,
        serviceSlug: resolvedService?.slug || serviceSlug,
        formId,
        ctaId,
      };
      await createLead({ name, phone, city, serviceType, comment, source, attribution });
      trackContentEvent({ eventName: 'form_submit', pageType: attribution.sourceType || 'UNKNOWN', contentSlug: attribution.sourceSlug, serviceId: attribution.serviceId, serviceSlug: attribution.serviceSlug, ctaId, position: formId });
      setSent(true);
      toast.success(isKk ? 'Өтінім қабылданды' : 'Заявка создана', isKk ? 'Менеджер өтінімді алды және сізбен байланысады.' : 'Менеджер получил вашу заявку и свяжется с вами.');
      formEl.reset();
      try { trackLeadSubmit({ lead_source: source, service_type: serviceType }); } catch {}
    } catch {
      trackEvent('form_error', { lead_source: source, service_type: serviceType });
      const attribution = getLeadAttribution();
      trackContentEvent({ eventName: 'form_error', pageType: attribution.sourceType || 'UNKNOWN', contentSlug: attribution.sourceSlug, serviceSlug: selectedService?.slug || attribution.serviceSlug, ctaId, position: formId });
      setError(true);
      setWhatsAppFallbackUrl(createWhatsAppUrl(createWhatsAppLeadMessage({ service: serviceType, name, phone, city, comment })));
      toast.error(isKk ? 'Өтінім жіберілмеді' : 'Не удалось создать заявку', isKk ? 'Деректерді тексеріп, қайталап көріңіз.' : 'Проверьте данные и попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      onFocus={() => {
        if (started) return;
        setStarted(true);
        trackEvent('form_start', { lead_source: source });
        const context = getLeadAttribution();
        trackContentEvent({ eventName: 'form_start', pageType: context.sourceType || 'UNKNOWN', contentSlug: context.sourceSlug, serviceSlug: context.serviceSlug, ctaId, position: formId });
      }}
      className={`rounded-[24px] border p-5 shadow-xl sm:p-7 ${isBlue ? 'border-eco-700 bg-eco-900 text-white shadow-eco-900/18' : 'border-slate-200 bg-white shadow-eco-900/8'}`}
    >
      <h2 className={`text-2xl font-bold ${isBlue ? 'text-white' : 'text-eco-900'}`}>{title}</h2>
      {!compact && <p className={`mt-3 text-sm leading-6 ${isBlue ? 'text-white/72' : 'text-slate-600'}`}>{isKk ? 'Байланыс деректерін қалдырыңыз. EcoProgress маманы келесі қадамды түсіндіреді.' : 'Оставьте контакты. Специалист ecoprogress.kz свяжется с вами и подскажет следующий шаг.'}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          {isKk ? 'Аты-жөні' : 'Имя'} *
          <input name="name" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          <span className="inline-flex items-center gap-1.5"><FaWhatsapp className="text-[#25D366]" size={15} aria-hidden="true" /> Телефон / WhatsApp *</span>
          <input name="phone" required inputMode="tel" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          {isKk ? 'Қала' : 'Город'}
          <input name="city" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          {isKk ? 'Қандай қызмет керек?' : 'Что нужно?'} *
          <select name="serviceType" required defaultValue={defaultService} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900">
            {serviceOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <label className={`mt-4 block text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
        {isKk ? 'Түсініктеме' : 'Комментарий'}
        <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" rows={compact ? 3 : 4} />
      </label>
      <Button disabled={loading} className={`mt-5 w-full ${isBlue ? 'bg-accent text-eco-900 hover:bg-accent/90' : ''}`}>{loading ? (isKk ? 'Жіберіліп жатыр...' : 'Отправляем...') : (isKk ? 'Өтінім жіберу' : 'Отправить заявку')}</Button>
      {sent && <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">{isKk ? 'Рақмет! EcoProgress маманы жақын арада сізбен байланысады.' : 'Спасибо! Специалист ecoprogress.kz свяжется с вами в ближайшее время.'}</p>}
      {error && (
        <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          <p className="inline-flex w-full items-start gap-2">
            <FaWhatsapp className="mt-0.5 shrink-0 text-[#25D366]" size={16} aria-hidden="true" />
            {isKk ? 'Сайт арқылы өтінім жіберілмеді. Оны менеджерге WhatsApp арқылы жіберуге болады.' : 'Не удалось отправить заявку через сайт. Можно отправить ее менеджеру в WhatsApp.'}
          </p>
          {whatsAppFallbackUrl && (
            <a href={whatsAppFallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white hover:bg-[#20bd5a]">
              {isKk ? 'WhatsApp ашу' : 'Открыть WhatsApp'}
            </a>
          )}
        </div>
      )}
    </form>
  );
};

export default LeadForm;
