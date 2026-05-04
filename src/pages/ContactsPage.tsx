import { FormEvent, useState } from 'react';
import { AtSign, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { companyContacts } from '../data/mockData';

const ContactsPage = () => {
  const [sent, setSent] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  };

  const items = [
    ['Телефон', companyContacts.phone, Phone],
    ['WhatsApp', companyContacts.whatsappDisplay, MessageCircle],
    ['Email', companyContacts.email, Mail],
    ['Адрес', companyContacts.address, MapPin],
    ['График работы', companyContacts.schedule, Clock],
    ['Instagram', companyContacts.instagram, AtSign],
  ] as const;

  return (
    <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Контакты</p>
            <h1 className="mt-3 text-4xl font-bold text-eco-900">Свяжитесь с ECOPROGRESS GROUP</h1>
            <p className="mt-4 leading-7 text-slate-600">Напишите нам, если нужна консультация, расчет стоимости или помощь с выбором услуги.</p>
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
              <a href={companyContacts.mapsUrl} target="_blank" rel="noreferrer" className="rounded-[20px] border border-eco-100 bg-eco-900 p-5 text-white shadow-sm sm:col-span-2">
                <MapPin className="text-accent" size={24} />
                <p className="mt-4 font-bold">Открыть карту</p>
                <p className="mt-2 text-sm text-white/70">Точная ссылка 2GIS / Google Maps будет добавлена после подтверждения адреса.</p>
              </a>
            </div>
          </Reveal>
          <Reveal direction="left">
            <form onSubmit={submit} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-xl shadow-eco-900/8 sm:p-7">
              <h2 className="text-2xl font-bold text-eco-900">Получить консультацию</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Имя<input required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label className="text-sm font-semibold text-slate-700">Телефон / WhatsApp<input required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label className="text-sm font-semibold text-slate-700 md:col-span-2">Что нужно?
                  <select className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
                    <option>Консультация</option>
                    <option>Экологические документы</option>
                    <option>Вывоз отходов</option>
                    <option>Лабораторные анализы</option>
                    <option>Не знаю, нужна помощь</option>
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold text-slate-700">Комментарий<textarea className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} /></label>
              <Button className="mt-5 w-full">Отправить</Button>
              {sent && <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">Спасибо! Мы свяжемся с вами.</p>}
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default ContactsPage;
