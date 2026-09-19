import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Calculator, CalendarClock, CheckCircle2, ClipboardCheck, Factory, FileCheck2, HardHat, HeartPulse, MessageSquareQuote, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import SEO from '../components/SEO';
import { DocumentsSection } from '../components/TrustBlocks';
import Button from '../components/ui/Button';
import { company } from '../config/company';
import { buildBreadcrumbSchema, buildCorePageEntities } from '../seo/entityBuilders';

const PageIntro = ({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) => <section className="relative isolate overflow-hidden bg-eco-900 px-5 py-16 text-white sm:px-8 sm:py-20"><div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" /><div className="mx-auto max-w-7xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p><h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">{title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">{description}</p></div></section>;

const PageSEO = ({ path, title, description }: { path: string; title: string; description: string }) => {
  const canonical = `${company.siteUrl}${path}`;
  return <SEO title={`${title} | EcoProgress`} description={description} canonical={canonical} schema={[...buildCorePageEntities({ canonical, name: title, description }), buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: title, url: canonical }])]} />;
};

export const ReviewsPage = () => {
  const description = 'Проверенные отзывы клиентов EcoProgress об экологических услугах, документах, лабораторных работах и сопровождении.';
  return <main className="min-h-screen bg-eco-50"><PageSEO path="/reviews" title="Отзывы клиентов" description={description} /><PageIntro eyebrow="Обратная связь" title="Отзывы клиентов EcoProgress" description="Здесь будут публиковаться только отзывы, которые можно связать с реальным заказом и согласованием клиента." /><section className="mx-auto max-w-5xl px-5 py-16 sm:px-8"><div className="rounded-[28px] border border-dashed border-eco-200 bg-white p-8 text-center sm:p-12"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-eco-50 text-eco-700"><MessageSquareQuote size={26} /></span><h2 className="mt-5 text-2xl font-bold text-eco-900">Раздел готов к наполнению</h2><p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">Добавим имя, должность, компанию, выполненную услугу и подтверждённый результат после получения разрешения на публикацию.</p><Button asChild className="mt-7"><Link to="/contacts">Связаться с EcoProgress</Link></Button></div></section></main>;
};

export const LicensesPage = () => {
  const description = 'Проверяемые лицензии, разрешения, сертификаты и сведения о компетенциях EcoProgress.';
  return <main className="min-h-screen bg-white"><PageSEO path="/licenses" title="Лицензии и документы" description={description} /><PageIntro eyebrow="Прозрачность" title="Лицензии, разрешения и сертификаты" description="Показываем статус реквизитов и не обозначаем документ действующим, пока сведения не подтверждены." /><DocumentsSection /></main>;
};

const calculatorServices = ['Экологические документы', 'Программа или отчёт ПЭК', 'Экологическое разрешение', 'Лабораторные исследования', 'Утилизация отходов', 'Экологическое сопровождение'];
const calculatorCategories = ['Категория неизвестна', 'I категория', 'II категория', 'III категория', 'IV категория'];

export const CalculatorPage = () => {
  const [service, setService] = useState(calculatorServices[0]);
  const [category, setCategory] = useState(calculatorCategories[0]);
  const [city, setCity] = useState('');
  const description = 'Предварительный подбор состава экологических услуг по задаче, категории объекта и региону.';
  return <main className="min-h-screen bg-eco-50"><PageSEO path="/calculator" title="Предварительный расчёт экологических услуг" description={description} /><PageIntro eyebrow="Предварительная оценка" title="Подберите состав экологических услуг" description="Укажите основные параметры. Точную стоимость специалист определит после проверки исходных данных." /><section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.8fr]"><div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><label className="block text-sm font-bold text-eco-900">Какая услуга нужна?<select value={service} onChange={(event) => setService(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-700">{calculatorServices.map((item) => <option key={item}>{item}</option>)}</select></label><label className="mt-6 block text-sm font-bold text-eco-900">Категория объекта<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-700">{calculatorCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="mt-6 block text-sm font-bold text-eco-900">Город<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Например, Алматы" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-700" /></label></div><aside className="rounded-[28px] bg-eco-900 p-7 text-white"><Calculator className="text-accent" size={30} /><h2 className="mt-5 text-2xl font-bold">Предварительные параметры</h2><dl className="mt-6 space-y-4 text-sm"><div className="border-b border-white/10 pb-4"><dt className="text-white/55">Услуга</dt><dd className="mt-1 font-bold">{service}</dd></div><div className="border-b border-white/10 pb-4"><dt className="text-white/55">Категория</dt><dd className="mt-1 font-bold">{category}</dd></div><div><dt className="text-white/55">Регион</dt><dd className="mt-1 font-bold">{city.trim() || 'Нужно уточнить'}</dd></div></dl><p className="mt-6 text-sm leading-6 text-white/65">Цена не рассчитывается автоматически: объём работ зависит от объекта и полноты документов.</p><Button asChild className="mt-7 w-full bg-accent text-eco-900 hover:bg-accent/90"><Link to="/contacts">Отправить параметры специалисту</Link></Button></aside></section></main>;
};

const checklists = [
  ['Перед экологической проверкой', 'Документы, сроки, ответственные лица и основные точки контроля.'],
  ['Для разработки программы ПЭК', 'Исходные данные об объекте, источниках воздействия и мероприятиях.'],
  ['Для экологического разрешения', 'Сведения, которые потребуются для определения состава разрешительной процедуры.'],
  ['Для лабораторных исследований', 'Цель контроля, точки отбора, показатели и желаемые сроки.'],
  ['Для передачи отходов', 'Вид, происхождение, объём отходов и необходимые закрывающие документы.'],
] as const;

export const ChecklistsPage = () => {
  const description = 'Практические экологические чек-листы для подготовки документов, проверок, ПЭК, лаборатории и работы с отходами.';
  return <main className="min-h-screen bg-eco-50"><PageSEO path="/checklists" title="Экологические чек-листы" description={description} /><PageIntro eyebrow="Практические материалы" title="Чек-листы для предприятий" description="Структура раздела подготовлена. Материалы будут опубликованы после проверки экологом и утверждения даты актуальности." /><section className="mx-auto max-w-7xl px-5 py-16 sm:px-8"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{checklists.map(([title, text], index) => <article key={title} className="flex min-h-64 flex-col rounded-[24px] border border-slate-200 bg-white p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-eco-50 text-eco-700"><ClipboardCheck size={22} /></span><p className="mt-5 text-xs font-black text-eco-400">0{index + 1}</p><h2 className="mt-2 text-xl font-bold text-eco-900">{title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{text}</p><span className="mt-5 text-sm font-semibold text-slate-400">Готовится к публикации</span></article>)}</div></section></main>;
};

const industries = [
  ['Промышленность', Factory, 'Проектирование, ПЭК, выбросы, отходы и разрешительные процедуры.'],
  ['Строительство', HardHat, 'РООС, экологическая оценка, отходы и лабораторный контроль.'],
  ['Медицина', HeartPulse, 'Производственный контроль, исследования и обращение с отходами.'],
  ['Склады и логистика', Truck, 'Инвентаризация источников, отходы, контроль и сопровождение.'],
  ['Торговля и услуги', ShoppingBag, 'Документы, производственный контроль и практические требования к объекту.'],
  ['Корпоративные объекты', Building2, 'Аудит документов и постоянное экологическое сопровождение.'],
] as const;

export const IndustriesPage = () => {
  const description = 'Экологические решения EcoProgress для промышленности, строительства, медицины, логистики, торговли и корпоративных объектов.';
  return <main className="min-h-screen bg-white"><PageSEO path="/industries" title="Решения по отраслям" description={description} /><PageIntro eyebrow="Отраслевой подход" title="Экологические решения для разных отраслей" description="Состав требований зависит от процессов, категории объекта и фактического воздействия — не только от названия отрасли." /><section className="mx-auto max-w-7xl px-5 py-16 sm:px-8"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{industries.map(([title, Icon, text]) => <article key={title} className="group rounded-[24px] border border-slate-200 bg-eco-50 p-6 transition hover:-translate-y-1 hover:border-eco-300 hover:bg-white hover:shadow-xl"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-eco-700 shadow-sm"><Icon size={23} /></span><h2 className="mt-5 text-xl font-bold text-eco-900">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p><Link to="/services" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-eco-700">Подобрать услуги <ArrowRight size={16} /></Link></article>)}</div></section></main>;
};

const deadlineGroups = ['Производственный экологический контроль', 'Экологическая отчётность', 'Лабораторный контроль', 'Разрешения и документы'] as const;

export const DeadlinesPage = () => {
  const description = 'Календарь экологической отчётности и обязательных мероприятий для предприятий Казахстана.';
  return <main className="min-h-screen bg-eco-50"><PageSEO path="/deadlines" title="Календарь экологических сроков" description={description} /><PageIntro eyebrow="Контроль обязательств" title="Календарь экологической отчётности" description="Раздел подготовлен для публикации проверенных сроков. Конкретные обязательства будут определяться по категории и условиям объекта." /><section className="mx-auto max-w-6xl px-5 py-16 sm:px-8"><div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><strong>Важно:</strong> даты появятся только после проверки нормативного основания и указания даты актуальности.</div><div className="mt-8 grid gap-5 md:grid-cols-2">{deadlineGroups.map((title) => <article key={title} className="rounded-[24px] border border-slate-200 bg-white p-6"><CalendarClock className="text-eco-600" size={25} /><h2 className="mt-4 text-xl font-bold text-eco-900">{title}</h2><div className="mt-5 flex items-center gap-3 rounded-2xl bg-eco-50 p-4 text-sm text-slate-600"><CheckCircle2 className="shrink-0 text-eco-500" size={18} />Ожидает юридической и экспертной проверки</div></article>)}</div><div className="mt-10 rounded-[28px] bg-eco-900 p-7 text-white sm:flex sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold">Нужно проверить сроки вашего предприятия?</h2><p className="mt-2 text-sm text-white/65">Специалист сопоставит документы, категорию объекта и действующие обязательства.</p></div><Button asChild className="mt-5 bg-accent text-eco-900 hover:bg-accent/90 sm:mt-0"><Link to="/contacts">Запросить проверку</Link></Button></div></section></main>;
};
