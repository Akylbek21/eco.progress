import { AtSign, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import WhatsAppButton from '../components/WhatsAppButton';
import WhatsAppLeadForm from '../components/WhatsAppLeadForm';
import SEO from '../components/SEO';
import { company } from '../config/company';
import { trackPhoneClick } from '../services/analytics';

const ContactsPage = () => {
  const items = [
    ['Телефон', company.phone, Phone],
    ['WhatsApp', company.whatsappDisplay, MessageCircle],
    ['Email', company.email, Mail],
    ['Адрес', company.address, MapPin],
    ['График работы', company.schedule, Clock],
    ['Instagram', company.instagram, AtSign],
  ] as const;

  return (
    <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <SEO title="Контакты | ECOPROGRESS GROUP" description="Контакты ECOPROGRESS GROUP: телефон, WhatsApp, email, адрес и форма консультации по экологическим услугам." />
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Контакты</p>
            <h1 className="mt-3 text-4xl font-bold text-eco-900">Напишите нам — специалист подскажет, какая услуга нужна именно вам</h1>
            <p className="mt-4 leading-7 text-slate-600">Свяжитесь с нами для консультации, расчета стоимости или быстрой проверки ситуации.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={company.phoneHref} onClick={() => trackPhoneClick({ placement: 'contacts_page' })}><Button>Позвонить</Button></a>
              <WhatsAppButton label="Оставить заявку через WhatsApp" />
            </div>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal direction="right">
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map(([label, value, Icon]) => (
                <div key={label} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                  <Icon className="text-eco-600" size={23} />
                  <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
                  <p className="mt-2 break-words font-bold text-eco-900">{value}</p>
                </div>
              ))}
              <a href={company.mapsUrl} target="_blank" rel="noreferrer" className="rounded-[20px] border border-eco-100 bg-eco-900 p-5 text-white shadow-sm sm:col-span-2">
                <MapPin className="text-accent" size={24} />
                <p className="mt-4 font-bold">Открыть карту</p>
                <p className="mt-2 text-sm text-white/70">Откроется карта с расположением офиса ECOPROGRESS GROUP.</p>
              </a>
            </div>
          </Reveal>
          <Reveal direction="left">
            <WhatsAppLeadForm source="contacts_page_whatsapp" title="Заявка через WhatsApp" />
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default ContactsPage;
