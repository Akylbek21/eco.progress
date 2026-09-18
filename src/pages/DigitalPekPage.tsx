import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, ClipboardCheck, Clock3, FileArchive, FileCheck2, Files, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import SEO from '../components/SEO';
import LeadForm from '../components/LeadForm';
import Button from '../components/ui/Button';
import { company } from '../config/company';
import { trackEvent } from '../services/analytics';
import { buildBreadcrumbSchema } from '../seo/entityBuilders';

const features = [
  { title: 'Программа ПЭК', Icon: ClipboardCheck, items: ['Хранение программы', 'Мероприятия контроля', 'Периодичность', 'Объекты и точки контроля', 'История изменений'] },
  { title: 'ПЭК-отчёт', Icon: FileCheck2, items: ['Квартальные периоды', 'Подготовка данных', 'Контроль заполнения', 'Связь с результатами контроля', 'Архив предыдущих отчётов'] },
  { title: 'Протоколы', Icon: Files, items: ['Лабораторные протоколы', 'Привязка к объекту и мероприятию', 'Дата и статус', 'Файл протокола', 'История'] },
  { title: 'Календарь', Icon: CalendarDays, items: ['Сроки мероприятий', 'Квартальные задачи', 'Контроль приближающихся сроков', 'Просроченные мероприятия'] },
  { title: 'Документы', Icon: FileArchive, items: ['Программы', 'Отчёты', 'Протоколы', 'Разрешительные документы', 'Архив'] },
  { title: 'Доступ сотрудников', Icon: Users, items: ['Компания видит только свои данные', 'Разграничение доступа', 'Сопровождение командой EcoProgress', 'Актуальная информация по организации'] },
] as const;

const steps = [
  'EcoProgress разрабатывает программу ПЭК.',
  'Программа и мероприятия появляются в цифровом кабинете.',
  'По мере выполнения загружаются протоколы и результаты контроля.',
  'Система показывает статус выполнения и приближающиеся сроки.',
  'На основании собранных данных формируется ПЭК-отчёт.',
  'Клиент получает доступ ко всем документам и истории работ.',
] as const;

const benefits = ['Не нужно искать документы по почте и мессенджерам', 'Видно, что уже выполнено по ПЭК', 'Проще контролировать квартальные сроки', 'Протоколы и результаты хранятся в одном месте', 'Сотрудники предприятия видят актуальный статус', 'Меньше риска пропустить обязательное мероприятие', 'История документов сохраняется в одном кабинете'] as const;

const DigitalPekPage = () => {
  const title = 'Цифровая система ПЭК для предприятий | EcoProgress';
  const description = 'Программа ПЭК, отчёты, лабораторные протоколы, сроки и экологические документы в одном цифровом кабинете EcoProgress.';
  const canonical = `${company.siteUrl}/pek-system`;
  return <main className="bg-white">
    <SEO title={title} description={description} h1="Цифровой кабинет ПЭК для предприятий" canonical={canonical} schema={buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Цифровой кабинет ПЭК', url: canonical }])} />

    <section className="overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div><p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">Экологическое сопровождение + цифровой контроль</p><h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">Цифровой кабинет ПЭК для предприятий</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-white/78">Управляйте программой производственного экологического контроля, протоколами, сроками и ПЭК-отчётностью в одном месте вместе с EcoProgress.</p><div className="mt-8 grid gap-3 sm:flex"><Button asChild className="bg-accent text-eco-900 hover:bg-accent/90"><a href="#consultation" onClick={() => trackEvent('digital_pek_consultation_click', { placement: 'hero' })}>Получить консультацию</a></Button><Button asChild variant="secondary"><Link to="/services/program-pek" onClick={() => trackEvent('digital_pek_to_service_click', { placement: 'hero', service_slug: 'program-pek' })}>Заказать разработку ПЭК</Link></Button></div></div>
        <button type="button" onClick={() => trackEvent('digital_pek_screenshot_view', { placement: 'hero_dashboard' })} className="w-full rounded-[28px] border border-white/15 bg-white/10 p-4 text-left shadow-2xl sm:p-6" aria-label="Посмотреть демонстрационный экран цифрового кабинета">
          <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs uppercase tracking-[0.18em] text-white/45">Демонстрационный интерфейс</p><p className="mt-1 font-bold">ПЭК предприятия</p></div><LayoutDashboard className="text-accent" /></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white p-4 text-eco-950"><p className="text-xs text-slate-500">Текущий квартал</p><p className="mt-1 font-bold text-emerald-700">Мероприятия в работе</p></div><div className="rounded-2xl bg-white p-4 text-eco-950"><p className="text-xs text-slate-500">Ближайший срок</p><p className="mt-1 font-bold">Контроль по графику</p></div><div className="col-span-2 rounded-2xl bg-white p-4 text-eco-950"><div className="flex items-center justify-between"><span className="font-bold">Документы периода</span><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">требуют внимания</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-3/4 rounded-full bg-eco-500" /></div></div></div>
          <p className="mt-4 text-xs leading-5 text-white/45">Обезличенный демонстрационный экран. Состав данных зависит от сопровождения предприятия.</p>
        </button>
      </div>
    </section>

    <section className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-eco-600">Возможности системы</p><h2 className="mt-3 text-3xl font-bold text-eco-950 sm:text-4xl">Рабочая информация по ПЭК — в одном кабинете</h2><p className="mt-4 max-w-3xl leading-7 text-slate-600">Кабинет используется при экологическом сопровождении EcoProgress. Доступные разделы и состав данных определяются задачами предприятия.</p><div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{features.map(({ title: featureTitle, Icon, items }) => <article key={featureTitle} className="rounded-[24px] border border-slate-200 bg-eco-50 p-6"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-eco-700 shadow-sm"><Icon /></span><h3 className="mt-5 text-xl font-bold text-eco-950">{featureTitle}</h3><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-650">{items.map(item => <li key={item} className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-eco-600" />{item}</li>)}</ul></article>)}</div></div></section>

    <section className="bg-eco-50 px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><h2 className="text-3xl font-bold text-eco-950 sm:text-4xl">Как это работает</h2><ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{steps.map((step, index) => <li key={step} className="rounded-[22px] border border-eco-100 bg-white p-6"><span className="text-3xl font-black text-eco-200">{String(index + 1).padStart(2, '0')}</span><p className="mt-3 font-semibold leading-7 text-eco-950">{step}</p></li>)}</ol></div></section>

    <section className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-eco-600">Практическая польза</p><h2 className="mt-3 text-3xl font-bold text-eco-950 sm:text-4xl">Что получает предприятие</h2><p className="mt-4 leading-7 text-slate-600">Цифровой кабинет дополняет работу экологов EcoProgress и делает текущее состояние ПЭК понятным для ответственных сотрудников предприятия.</p></div><ul className="grid gap-3 sm:grid-cols-2">{benefits.map(item => <li key={item} className="flex gap-3 rounded-2xl border border-slate-200 p-4 font-semibold text-slate-700"><ShieldCheck className="shrink-0 text-eco-600" size={20} />{item}</li>)}</ul></div></section>

    <section className="bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Связанные услуги</p><h2 className="mt-3 text-3xl font-bold">ПЭК как постоянный рабочий процесс</h2><p className="mt-4 max-w-3xl leading-7 text-white/70">Кабинет связывает документы и результаты работ, которые EcoProgress выполняет в рамках согласованного сопровождения.</p></div><Clock3 className="hidden text-accent lg:block" size={48} /></div><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Программа ПЭК', 'program-pek'], ['ПЭК-отчёт', 'report-pek'], ['Лабораторные исследования', 'laboratory-tests'], ['Экологическое сопровождение', 'ecological-support']].map(([label, slug]) => <Link key={slug} to={`/services/${slug}`} onClick={() => trackEvent('digital_pek_to_service_click', { placement: 'related_services', service_slug: slug })} className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 p-5 font-bold transition hover:bg-white/15">{label}<ArrowRight size={17} /></Link>)}</div></div></section>

    <section id="consultation" className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-eco-600">Консультация</p><h2 className="mt-3 text-3xl font-bold text-eco-950 sm:text-4xl">Обсудите ведение ПЭК вашего предприятия</h2><p className="mt-5 leading-7 text-slate-600">Специалист уточнит задачи, состав действующей программы и подскажет, как цифровой кабинет может использоваться при сопровождении.</p></div><LeadForm source="digital_pek_page" sourcePage="/pek-system" formId="digital_pek_consultation" ctaId="digital_pek_submit" serviceSlug="program-pek" defaultService="Программа ПЭК" title="Получить консультацию" submitLabel="Отправить заявку" compact showIdentityFields /></div></section>
  </main>;
};

export default DigitalPekPage;
