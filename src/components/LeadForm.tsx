import { FormEvent, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from './ui/Button';
import { createLead } from '../services/leadService';
import { getLeadAttribution, trackContentEvent, trackEvent, trackLeadSubmit, trackWhatsAppClick } from '../services/analytics';
import { useToast } from '../hooks/useToast';
import { createWhatsAppLeadMessage, createWhatsAppUrl } from '../utils/whatsapp';
import { activeServices, normalizeServiceSlug } from '../content/serviceCatalog';

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
  submitLabel?: string;
};

const successDocumentPrompt = (serviceSlug: string, isKk: boolean) => {
  if (isKk) {
    if (serviceSlug === 'waste-recycling') return 'Есептеуді жылдамдату үшін қалдықтар тізімін, фотосуреттерді немесе қалдық паспорттарын WhatsApp-қа жіберіңіз.';
    if (serviceSlug === 'report-pek') return 'Есептеуді жылдамдату үшін ПЭБ бағдарламасын, хаттамаларды және алдыңғы есепті WhatsApp-қа жіберіңіз.';
    if (serviceSlug === 'roos') return 'Есептеуді жылдамдату үшін жобаны, бас жоспарды немесе қолда бар бастапқы құжаттарды WhatsApp-қа жіберіңіз.';
    return 'Маман сұрауды алды. Есептеуді жылдамдату үшін қолда бар құжаттарды, жобаны немесе хаттамаларды WhatsApp-қа жіберіңіз.';
  }

  if (serviceSlug === 'waste-recycling') return 'Специалист получил запрос. Чтобы ускорить расчёт, отправьте перечень отходов, фото или паспорта отходов в WhatsApp.';
  if (serviceSlug === 'report-pek') return 'Специалист получил запрос. Чтобы ускорить расчёт, отправьте программу ПЭК, протоколы и предыдущий отчёт в WhatsApp.';
  if (serviceSlug === 'roos') return 'Специалист получил запрос. Чтобы ускорить расчёт, отправьте проект, генплан или имеющиеся исходные данные в WhatsApp.';
  return 'Специалист получил запрос. Если хотите ускорить расчёт, отправьте перечень отходов, проект или протоколы в WhatsApp.';
};

const LeadForm = ({ source = 'site_form', title = 'Получить консультацию', compact = false, defaultService = 'Не знаю, нужна консультация', variant = 'light', formId = source, ctaId, serviceSlug, sourcePage, locale = 'ru', submitLabel }: LeadFormProps) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [whatsAppFallbackUrl, setWhatsAppFallbackUrl] = useState('');
  const [started, setStarted] = useState(false);
  const isBlue = variant === 'blue';
  const isKk = locale === 'kk';
  const normalizedServiceSlug = normalizeServiceSlug(serviceSlug || '');
  const isLandingShortForm = compact && Boolean(serviceSlug);
  const isWasteForm = normalizedServiceSlug === 'waste-recycling';
  const isPekReportForm = normalizedServiceSlug === 'report-pek';
  const isRoosForm = normalizedServiceSlug === 'roos';
  const serviceDetailLabel: Record<string, string> = {
    ndv: 'Количество источников / оборудования',
    szz: 'Тип объекта / ближайшая застройка',
    ovos: 'Намечаемая деятельность',
    'waste-passport': 'Вид и происхождение отхода',
    'laboratory-tests': 'Что нужно измерить',
  };
  const documentsWhatsAppUrl = createWhatsAppUrl(isKk
    ? `Сәлеметсіз бе! «${defaultService}» қызметі бойынша өтінім қалдырдым. Есептеу үшін құжаттарды жіберемін.`
    : `Здравствуйте! Я оставил(а) заявку на услугу «${defaultService}». Отправляю документы для расчёта.`);
  const containerClassName = `rounded-[24px] border p-5 shadow-xl sm:p-7 ${isBlue ? 'border-eco-700 bg-eco-900 text-white shadow-eco-900/18' : 'border-slate-200 bg-white shadow-eco-900/8'}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const phone = String(form.get('phone') || '').trim();
    const city = String(form.get('city') || '').trim();
    const serviceType = String(form.get('serviceType') || '').trim();
    const comment = String(form.get('comment') || '').trim();
    const wasteType = String(form.get('wasteType') || '').trim();
    const estimatedVolume = String(form.get('estimatedVolume') || '').trim();
    const reportingPeriod = String(form.get('reportingPeriod') || '').trim();
    const objectType = String(form.get('objectType') || '').trim();
    const serviceDetail = String(form.get('serviceDetail') || '').trim();
    const enrichedComment = [
      wasteType && `Вид отходов: ${wasteType}`,
      estimatedVolume && `Примерный объём: ${estimatedVolume}`,
      reportingPeriod && `Отчётный период: ${reportingPeriod}`,
      objectType && `Вид объекта / проектируемая деятельность: ${objectType}`,
      serviceDetail && `${serviceDetailLabel[normalizedServiceSlug] || 'Параметр услуги'}: ${serviceDetail}`,
      comment && `Что нужно / комментарий: ${comment}`,
    ].filter(Boolean).join('\n');
    const selectedService = activeServices.find((item) => item.title === serviceType);
    setWhatsAppFallbackUrl('');
    if (!phone || !serviceType || (!isLandingShortForm && !comment)) {
      const validationMessage = isKk
        ? 'Телефон немесе WhatsApp нөмірін және тапсырманы көрсетіңіз.'
        : 'Укажите телефон или WhatsApp и кратко опишите, что вам нужно.';
      toast.error(isKk ? 'Міндетті жолдарды толтырыңыз' : 'Заполните обязательные поля', validationMessage);
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
      await createLead({ name: 'Заявка с сайта', phone, city, serviceType, comment: enrichedComment, source, attribution });
      trackContentEvent({ eventName: 'form_submit', pageType: attribution.sourceType || 'UNKNOWN', contentSlug: attribution.sourceSlug, serviceId: attribution.serviceId, serviceSlug: attribution.serviceSlug, ctaId, position: formId });
      setSent(true);
      toast.success(isKk ? 'Өтінім қабылданды' : 'Заявка принята', isKk ? 'Маман өтінімді алды және сізбен байланысады.' : 'Специалист получил запрос и свяжется с вами.');
      formEl.reset();
      try { trackLeadSubmit({ lead_source: source, service_type: serviceType }); } catch {}
    } catch {
      trackEvent('form_error', { lead_source: source, service_type: serviceType });
      const attribution = getLeadAttribution();
      trackContentEvent({ eventName: 'form_error', pageType: attribution.sourceType || 'UNKNOWN', contentSlug: attribution.sourceSlug, serviceSlug: selectedService?.slug || attribution.serviceSlug, ctaId, position: formId });
      setError(true);
      setWhatsAppFallbackUrl(createWhatsAppUrl(createWhatsAppLeadMessage({ service: serviceType, phone, city, comment: enrichedComment })));
      toast.error(isKk ? 'Өтінім жіберілмеді' : 'Не удалось создать заявку', isKk ? 'Деректерді тексеріп, қайталап көріңіз.' : 'Проверьте данные и попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <section className={containerClassName} role="status" aria-live="polite">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-eco-900 sm:p-6">
          <h2 className="text-2xl font-bold">{isKk ? 'Өтінім қабылданды' : 'Заявка принята'}</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-700">{successDocumentPrompt(normalizedServiceSlug, isKk)}</p>
          <a
            href={documentsWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick({ placement: 'lead_success_documents', service: defaultService })}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#20bd5a] sm:w-auto"
          >
            <FaWhatsapp size={18} aria-hidden="true" />
            {isKk ? 'Құжаттарды WhatsApp-қа жіберу' : 'Отправить документы в WhatsApp'}
          </a>
        </div>
      </section>
    );
  }

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
      className={containerClassName}
    >
      <h2 className={`text-2xl font-bold ${isBlue ? 'text-white' : 'text-eco-900'}`}>{title}</h2>
      {!compact && <p className={`mt-3 text-sm leading-6 ${isBlue ? 'text-white/72' : 'text-slate-600'}`}>{isKk ? 'Байланыс деректерін қалдырыңыз. EcoProgress маманы келесі қадамды түсіндіреді.' : 'Оставьте контакты. Специалист ecoprogress.kz свяжется с вами и подскажет следующий шаг.'}</p>}
      <div className="mt-6 grid gap-4">
        <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          <span className="inline-flex items-center gap-1.5"><FaWhatsapp className="text-[#25D366]" size={15} aria-hidden="true" /> Телефон / WhatsApp *</span>
          <input name="phone" required inputMode="tel" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>
        <input type="hidden" name="serviceType" value={defaultService} />
        {isLandingShortForm && <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          {isKk ? 'Қала' : 'Город'}
          <input name="city" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>}
        {isLandingShortForm && isWasteForm &&
          <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
            Вид отходов и примерный объём
            <input name="wasteType" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" placeholder="Например, строительный мусор — 2 тонны" />
          </label>
        }
        {isLandingShortForm && isPekReportForm && <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          Отчётный период
          <input name="reportingPeriod" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" placeholder="Например, II квартал 2026" />
        </label>}
        {isLandingShortForm && isRoosForm && <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          Вид объекта / проектируемая деятельность
          <input name="objectType" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>}
        {isLandingShortForm && serviceDetailLabel[normalizedServiceSlug] && <label className={`text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
          {serviceDetailLabel[normalizedServiceSlug]}
          <input name="serviceDetail" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" />
        </label>}
      </div>
      <label className={`mt-4 block text-sm font-semibold ${isBlue ? 'text-white/82' : 'text-slate-700'}`}>
        {isKk ? 'Сізге не қажет?' : 'Что вам нужно?'}{isLandingShortForm ? '' : ' *'}
        <textarea name="comment" required={!isLandingShortForm} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-eco-900" rows={3} />
      </label>
      <Button disabled={loading} className={`mt-5 w-full ${isBlue ? 'bg-accent text-eco-900 hover:bg-accent/90' : ''}`}>{loading ? (isKk ? 'Жіберіліп жатыр...' : 'Отправляем...') : submitLabel || (isKk ? 'Есеп алу' : 'Получить расчёт')}</Button>
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
