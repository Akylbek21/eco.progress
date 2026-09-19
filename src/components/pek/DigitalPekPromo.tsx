import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ClipboardCheck, FileArchive, FileCheck2, Files, Gauge, Users } from 'lucide-react';
import Button from '../ui/Button';
import { trackEvent } from '../../services/analytics';

const capabilities = [
  ['Программа ПЭК', ClipboardCheck],
  ['ПЭК-отчёт', FileCheck2],
  ['Лабораторные протоколы', Files],
  ['Календарь мероприятий', CalendarDays],
  ['Контроль сроков', Gauge],
  ['Документы и архив', FileArchive],
  ['Статус выполнения работ', FileCheck2],
  ['Доступ сотрудников предприятия', Users],
] as const;

export const DigitalPekServiceBanner = ({ placement }: { placement: string }) => (
  <section className="bg-white px-5 py-14 sm:px-8">
    <div className="mx-auto flex max-w-5xl flex-col gap-6 rounded-[26px] border border-eco-100 bg-eco-50 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-eco-600">Преимущество сопровождения EcoProgress</p>
        <h2 className="mt-2 text-2xl font-bold text-eco-950 sm:text-3xl">ПЭК в цифровом формате</h2>
        <p className="mt-3 leading-7 text-slate-650">При работе с EcoProgress клиент может получить доступ к цифровому кабинету, где собраны программа ПЭК, мероприятия, лабораторные протоколы, сроки и отчётность.</p>
      </div>
      <Button asChild className="shrink-0">
        <Link to="/pek-system" onClick={() => trackEvent('digital_pek_system_click', { placement })}>Посмотреть цифровой кабинет ПЭК <ArrowRight size={17} /></Link>
      </Button>
    </div>
  </section>
);

const DigitalPekPromo = () => (
  <section aria-labelledby="digital-pek-title" className="overflow-hidden bg-white px-4 py-16 sm:px-8">
    <div className="mx-auto max-w-7xl rounded-[30px] bg-eco-900 p-6 text-white shadow-2xl shadow-eco-900/15 sm:p-10 lg:p-12">
      <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Дополнительно для клиентов EcoProgress</p>
          <h2 id="digital-pek-title" className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">ПЭК под контролем в цифровом кабинете EcoProgress</h2>
          <p className="mt-5 text-lg leading-8 text-white/80">Клиенты EcoProgress могут контролировать программу ПЭК, квартальную отчётность, лабораторные протоколы, сроки и экологические документы в одном кабинете.</p>
          <p className="mt-4 leading-7 text-white/65">Система помогает предприятию видеть, какие мероприятия необходимо выполнить, какие документы уже готовы, какие сроки приближаются и что требуется для подготовки очередного ПЭК-отчёта.</p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <Button asChild className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto"><Link to="/services/program-pek" onClick={() => trackEvent('digital_pek_order_click', { placement: 'home_digital_pek' })}>Заказать ПЭК для предприятия</Link></Button>
            <Button asChild variant="secondary" className="w-full sm:w-auto"><Link to="/pek-system" onClick={() => trackEvent('digital_pek_system_click', { placement: 'home_digital_pek' })}>Посмотреть возможности системы <ArrowRight size={17} /></Link></Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-white/15 bg-white text-eco-900 shadow-2xl shadow-black/20" aria-label="Предпросмотр цифрового кабинета ПЭК">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-eco-500">Кабинет предприятия</p><p className="mt-1 font-bold">Экологический контроль</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Активен</span></div>
          <div className="p-5">
            <div className="rounded-2xl bg-eco-50 p-4"><div className="flex items-center justify-between text-sm"><span className="font-semibold">ПЭК за текущий период</span><span className="font-black text-eco-700">75%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full w-3/4 rounded-full bg-accent" /></div><p className="mt-3 text-xs text-slate-500">Следующий срок отображается в календаре</p></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{capabilities.slice(0, 4).map(([label, Icon]) => <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-eco-50 text-eco-700"><Icon size={18} /></span><span className="text-xs font-bold text-slate-700">{label}</span></div>)}</div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-xs"><span className="font-semibold text-slate-600">Ближайшее мероприятие</span><span className="font-bold text-eco-700">По графику</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default DigitalPekPromo;
