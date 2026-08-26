import { FormEvent, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from './ui/Button';
import { createWhatsAppLeadMessage, createWhatsAppUrl } from '../utils/whatsapp';
import { getLeadAttribution, trackContentEvent, trackWhatsAppClick } from '../services/analytics';
import { useToast } from '../hooks/useToast';
import { normalizeServiceSlug } from '../content/serviceCatalog';

type WhatsAppLeadFormProps = {
  title?: string;
  defaultService?: string;
  source?: string;
  compact?: boolean;
  serviceSlug?: string;
};

const WhatsAppLeadForm = ({
  title = 'Заявка через WhatsApp',
  defaultService = '',
  source = 'whatsapp_form',
  compact = false,
  serviceSlug,
}: WhatsAppLeadFormProps) => {
  const toast = useToast();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const normalizedServiceSlug = normalizeServiceSlug(serviceSlug || '');
  const isLandingShortForm = compact && Boolean(serviceSlug);
  const isWasteForm = normalizedServiceSlug === 'waste-recycling';
  const isPekReportForm = normalizedServiceSlug === 'report-pek';
  const isRoosForm = normalizedServiceSlug === 'roos';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get('phone') || '').trim();
    const service = String(form.get('service') || '').trim();
    const city = String(form.get('city') || '').trim();
    const comment = String(form.get('comment') || '').trim();
    const wasteType = String(form.get('wasteType') || '').trim();
    const estimatedVolume = String(form.get('estimatedVolume') || '').trim();
    const reportingPeriod = String(form.get('reportingPeriod') || '').trim();
    const objectType = String(form.get('objectType') || '').trim();
    const enrichedComment = [
      wasteType && `Вид отходов: ${wasteType}`,
      estimatedVolume && `Примерный объём: ${estimatedVolume}`,
      reportingPeriod && `Отчётный период: ${reportingPeriod}`,
      objectType && `Вид объекта / проектируемая деятельность: ${objectType}`,
      comment && `Что нужно / комментарий: ${comment}`,
    ].filter(Boolean).join('\n');

    setError('');
    setNotice('');
    setManualUrl('');

    if (!phone || !service || !comment) {
      const validationMessage = 'Укажите телефон или WhatsApp и кратко опишите, что вам нужно.';
      setError(validationMessage);
      toast.error('Ошибка', validationMessage);
      return;
    }

    const url = createWhatsAppUrl(createWhatsAppLeadMessage({ service, phone, city, comment: enrichedComment }));
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;

    trackWhatsAppClick({ placement: source, service });
    const attribution = getLeadAttribution();
    trackContentEvent({ eventName: 'whatsapp_click', pageType: attribution.sourceType || 'UNKNOWN', contentSlug: attribution.sourceSlug, serviceSlug: attribution.serviceSlug, ctaId: source, position: 'whatsapp_form' });
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
      <div className="mt-6 grid gap-4">
        <label className="text-sm font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1.5"><FaWhatsapp className="text-[#25D366]" size={15} aria-hidden="true" /> Телефон / WhatsApp *</span>
          <input name="phone" required inputMode="tel" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <input type="hidden" name="service" value={defaultService || 'Экологические услуги'} />
        {isLandingShortForm && <label className="text-sm font-semibold text-slate-700">
          Город
          <input name="city" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>}
        {isLandingShortForm && isWasteForm && <>
          <label className="text-sm font-semibold text-slate-700">
            Вид отходов
            <input name="wasteType" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Примерный объём
            <input name="estimatedVolume" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Например, 2 тонны" />
          </label>
        </>}
        {isLandingShortForm && isPekReportForm && <label className="text-sm font-semibold text-slate-700">
          Отчётный период
          <input name="reportingPeriod" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Например, II квартал 2026" />
        </label>}
        {isLandingShortForm && isRoosForm && <label className="text-sm font-semibold text-slate-700">
          Вид объекта / проектируемая деятельность
          <input name="objectType" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>}
      </div>
      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Что вам нужно? *
        <textarea name="comment" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
      </label>
      <Button type="submit" className="mt-5 w-full gap-2 bg-[#25D366] text-white hover:bg-[#20bd5a]">
        <FaWhatsapp size={18} aria-hidden="true" /> Получить расчёт
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
