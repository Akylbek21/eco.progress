import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Mail, Monitor, X } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from './ui/Button';
import LeadForm from './LeadForm';
import { trackEmailClick, trackWhatsAppClick } from '../services/analytics';
import { getServices } from '../services/serviceService';
import { createBlankWhatsAppRequestMessage, createWhatsAppUrl } from '../utils/whatsapp';
import { getCatalogService } from '../content/serviceCatalog';
import { company } from '../config/company';

type Props = {
  open: boolean;
  onClose: () => void;
  preSelectedService?: string;
  locale?: 'ru' | 'kk';
  leadContext?: {
    source: 'PROJECT_MAP';
    cityId?: string;
    regionId?: string;
    locationName?: string;
    serviceCode?: string;
    caseId?: string;
  };
};

type EcoService = { id: string; title: string };

const createKkWhatsAppMessage = (service = '') => `Сәлеметсіз бе! Өтінім қалдырғым келеді.

Қызмет: ${service}
Қала:
Телефон / WhatsApp:
Сұрақ:`;

const OrderChoiceModal = ({ open, onClose, preSelectedService, locale = 'ru', leadContext }: Props) => {
  const isKk = locale === 'kk';
  const [services, setServices] = useState<EcoService[]>([]);
  const [view, setView] = useState<'choices' | 'site-form'>('choices');

  useEffect(() => {
    if (open) {
      setView('choices');
      getServices()
        .then((list) => setServices(list.map((service) => ({ id: service.id, title: service.title }))))
        .catch(() => setServices([]));
    }
  }, [open]);

  const selectedServiceTitle = useMemo(
    () => services.find((service) => service.id === preSelectedService)?.title || (preSelectedService ? getCatalogService(preSelectedService)?.title : '') || '',
    [preSelectedService, services],
  );

  if (!open) return null;

  const contextLines = leadContext ? [
    leadContext.locationName && `Город / область: ${leadContext.locationName}`,
    leadContext.serviceCode && `Код услуги: ${leadContext.serviceCode}`,
    leadContext.caseId && `Похожий кейс: ${leadContext.caseId}`,
    `Источник: ${leadContext.source}`,
  ].filter(Boolean).join('\n') : '';
  const whatsappUrl = createWhatsAppUrl(
    `${isKk ? createKkWhatsAppMessage(selectedServiceTitle) : createBlankWhatsAppRequestMessage(selectedServiceTitle)}${contextLines ? `\n\n${contextLines}` : ''}`,
  );
  const serviceLabel = selectedServiceTitle || (isKk ? 'Экологиялық қызметтер' : 'Экологические услуги');
  const emailSubject = isKk ? `EcoProgress өтінімі: ${serviceLabel}` : `Заявка EcoProgress: ${serviceLabel}`;
  const emailBody = isKk
    ? `Сәлеметсіз бе! Өтінім қалдырғым келеді.\n\nҚызмет: ${serviceLabel}\nҚала:\nТелефон / WhatsApp:\nСұрақ:\n${contextLines ? `\n${contextLines}` : ''}`
    : `Здравствуйте! Хочу оставить заявку.\n\nУслуга: ${serviceLabel}\nГород:\nТелефон / WhatsApp:\nЧто вам нужно:\n${contextLines ? `\n${contextLines}` : ''}`;
  const emailUrl = `mailto:${company.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={isKk ? 'Тапсырыс тәсілін таңдау' : 'Выбор способа заказа'} className={`relative max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-7 ${view === 'site-form' ? 'max-w-2xl' : 'max-w-5xl'}`} onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label={isKk ? 'Жабу' : 'Закрыть'}>
          <X size={20} />
        </button>

        {view === 'site-form' ? (
          <div>
            <button type="button" onClick={() => setView('choices')} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
              <ArrowLeft size={17} /> {isKk ? 'Өтінім беру тәсілдеріне оралу' : 'Вернуться к способам подачи'}
            </button>
            <LeadForm
              source="order_modal_site"
              formId="order_modal_site"
              ctaId="order_modal_site_submit"
              serviceSlug={preSelectedService}
              defaultService={serviceLabel}
              locale={locale}
              title={isKk ? 'Сайт арқылы өтінім қалдыру' : 'Оставить заявку через сайт'}
              submitLabel={isKk ? 'Өтінім жіберу' : 'Отправить заявку'}
              compact
            />
          </div>
        ) : (
          <>
            <h2 className="pr-10 text-2xl font-bold text-eco-900">{isKk ? 'Эколог маманнан кеңес алу' : 'Получить консультацию эколога'}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {isKk ? 'Өтінімді сайт арқылы жіберіңіз, WhatsApp-қа жазыңыз немесе электрондық пошта арқылы хабарласыңыз.' : 'Отправьте заявку через сайт, напишите в WhatsApp или свяжитесь с нами по электронной почте.'}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col rounded-[20px] border border-slate-200 bg-eco-50 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-eco-700 shadow-sm"><Monitor size={23} /></div>
                <h3 className="mt-4 text-lg font-bold text-eco-900">{isKk ? 'Сайт арқылы өтінім қалдыру' : 'Оставить заявку через сайт'}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{isKk ? 'Қысқа нысанды толтырыңыз. Өтінім CRM жүйесіндегі «Лидтер» бөліміне түседі, менеджер сізбен байланысады.' : 'Заполните короткую форму. Заявка поступит в раздел «Лиды» CRM, и менеджер свяжется с вами.'}</p>
                <Button type="button" onClick={() => setView('site-form')} className="mt-5 w-full">
                  {isKk ? 'Сайтта өтінім қалдыру' : 'Оставить заявку'}
                </Button>
              </div>

              <div className="flex min-w-0 flex-col rounded-[20px] border border-green-100 bg-green-50 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#25D366] shadow-sm"><FaWhatsapp size={24} aria-hidden="true" /></div>
                <h3 className="mt-4 inline-flex items-center gap-2 text-lg font-bold text-eco-900"><FaWhatsapp className="text-[#25D366]" size={18} aria-hidden="true" /> {isKk ? 'WhatsApp арқылы жазу' : 'Написать в WhatsApp'}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{isKk ? 'Тіркелу қажет емес. Менеджер хабарламаңызды алып, сізбен байланысады.' : 'Без регистрации. Менеджер получит сообщение и свяжется с вами.'}</p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackWhatsAppClick({ placement: 'order_modal', service: selectedServiceTitle || preSelectedService });
                    onClose();
                  }}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#20bd5a]"
                >
                  <FaWhatsapp size={18} aria-hidden="true" /> {isKk ? 'WhatsApp арқылы жазу' : 'Написать в WhatsApp'}
                </a>
              </div>

              <div className="flex min-w-0 flex-col rounded-[20px] border border-sky-100 bg-sky-50 p-5 md:col-span-2 lg:col-span-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm"><Mail size={23} aria-hidden="true" /></div>
                <h3 className="mt-4 inline-flex items-center gap-2 text-lg font-bold text-eco-900"><Mail className="text-sky-700" size={18} aria-hidden="true" /> {isKk ? 'Email арқылы жіберу' : 'Отправить по email'}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{isKk ? `Хат үлгісін ашамыз. Оны толтырып, ${company.email} мекенжайына жіберіңіз.` : `Откроем готовый шаблон письма. Заполните его и отправьте на ${company.email}.`}</p>
                <a
                  href={emailUrl}
                  onClick={() => trackEmailClick({ placement: 'order_modal', service: selectedServiceTitle || preSelectedService })}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-700 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-sky-800"
                >
                  <Mail size={18} aria-hidden="true" /> {isKk ? 'Email ашу' : 'Открыть email'}
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderChoiceModal;
