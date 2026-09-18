import {
  Archive,
  Beaker,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  LayoutDashboard,
  Recycle,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import LeadForm from '../components/LeadForm';
import SEO from '../components/SEO';
import { DigitalPekServiceBanner } from '../components/pek/DigitalPekPromo';
import WhatsAppButton from '../components/WhatsAppButton';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { company } from '../config/company';
import {
  buildBreadcrumbSchema,
  buildCorePageEntities,
  buildServiceEntity,
} from '../seo/entityBuilders';

const title = 'Эколог на аутсорсинге в Казахстане | Экологическое сопровождение предприятий | ECOPROGRESS';
const description = 'Комплексное экологическое сопровождение предприятий по Казахстану: ПЭК, экологическая отчетность, отходы, разрешения, лабораторный контроль, проверки и экологические риски. Абонентское сопровождение ECOPROGRESS.';
const canonical = `${company.siteUrl}/services/ecological-support`;

const responsibilities = [
  { Icon: CalendarClock, title: 'Документация и сроки', items: ['ведение экологической документации', 'контроль сроков разрешений', 'контроль проектной документации', 'экологический календарь'] },
  { Icon: FileText, title: 'Отчётность', items: ['подготовка обязательной экологической отчётности', 'контроль сроков сдачи', 'проверка исходных данных', 'внутренние отчёты руководству'] },
  { Icon: ClipboardCheck, title: 'ПЭК', items: ['сопровождение производственного экологического контроля', 'контроль выполнения программы ПЭК', 'организация необходимых исследований', 'анализ результатов'] },
  { Icon: Recycle, title: 'Отходы', items: ['учёт образования отходов', 'реестр и классификация отходов', 'паспорта опасных отходов', 'документы при передаче отходов'] },
  { Icon: Beaker, title: 'Лабораторный контроль', items: ['воздух и выбросы', 'вода и почва', 'шум', 'иные необходимые показатели'] },
  { Icon: FileCheck2, title: 'Разрешения', items: ['контроль действующих разрешений', 'подготовка исходных данных', 'сопровождение получения и корректировки разрешений'] },
  { Icon: ShieldCheck, title: 'Проверки', items: ['предварительный экологический аудит', 'подготовка документов', 'ответы на уведомления', 'сопровождение замечаний и предписаний'] },
  { Icon: Gauge, title: 'Экологические риски', items: ['выявление несоответствий', 'контроль обязательств', 'рекомендации', 'контроль устранения замечаний'] },
];

const audiences = [
  ['Нет отдельного эколога', 'Экологические задачи распределены между бухгалтерией, производством и руководством.'],
  ['Есть штатный эколог, но большой объём', 'Нужна дополнительная команда для проектов, отчётности, ПЭК и контроля сроков.'],
  ['Несколько объектов', 'Нужно централизованно контролировать документы и обязательства по всем площадкам.'],
  ['Есть ПЭК и регулярная отчётность', 'Нужен постоянный контроль сроков, лаборатории и исходных данных.'],
  ['Предприятие готовится к проверке', 'Нужно заранее выявить экологические риски.'],
  ['Производство развивается', 'Меняются мощности, оборудование, источники выбросов или технологические процессы.'],
];

const packages = [
  {
    name: 'Базовый',
    text: 'Для небольших предприятий с относительно простой производственной деятельностью.',
    items: ['закреплённый специалист-эколог', 'дистанционные консультации', 'календарь экологической отчётности', 'контроль сроков разрешительных документов', 'контроль договоров по отходам', 'основные экологические журналы и реестры', 'помощь при подготовке обязательной отчётности', 'ежемесячная проверка документации', 'уведомления о предстоящих сроках', 'краткий ежемесячный отчёт'],
    cta: 'Получить расчёт',
  },
  {
    name: 'Бизнес',
    badge: 'Популярный',
    text: 'Для действующих производственных предприятий с выбросами, отходами, ПЭК и регулярной отчётностью.',
    prefix: 'Всё из тарифа «Базовый», а также:',
    items: ['ведение экологической отчётности', 'сопровождение и контроль программы ПЭК', 'организация лабораторных исследований', 'контроль выбросов', 'учёт и реестр отходов', 'сопровождение передачи отходов', 'анализ лабораторных результатов', 'внутренние экологические отчёты', 'проверка соблюдения экологических требований', 'официальные письма государственным органам', 'консультации производственного персонала', 'согласованные выезды специалиста'],
    cta: 'Получить расчёт',
  },
  {
    name: 'Полное сопровождение',
    subtitle: 'Внешняя экологическая служба предприятия',
    prefix: 'Всё из тарифа «Бизнес», а также:',
    items: ['комплексный контроль экологической деятельности', 'регулярные выезды', 'внутренний экологический аудит', 'подготовка и участие при государственных проверках', 'взаимодействие с государственными органами', 'работа с замечаниями и предписаниями', 'контроль устранения нарушений', 'анализ экологических рисков', 'контроль исходных данных для экологических платежей', 'подготовка технических заданий', 'сопровождение НДВ, ПЭК и проектов по отходам', 'сопровождение получения экологических разрешений', 'сопровождение общественных слушаний при необходимости', 'контроль обязательств подрядчиков', 'консультации руководства', 'электронный архив экологической документации'],
    cta: 'Получить индивидуальное предложение',
  },
];

const comparison = [
  ['Экологический календарь', '✓', '✓', '✓'],
  ['Контроль документов', '✓', '✓', '✓'],
  ['Отчётность', '◐', '✓', '✓'],
  ['ПЭК', '—', '✓', '✓'],
  ['Отходы', '◐', '✓', '✓'],
  ['Лабораторный контроль', '—', '✓', '✓'],
  ['Выезды', '—', '◐', '✓'],
  ['Подготовка к проверкам', '—', '◐', '✓'],
  ['Экологический аудит', '—', '—', '✓'],
  ['Работа с госорганами', '—', '◐', '✓'],
  ['Разрешения и проекты', 'отдельно', 'отдельно', 'сопровождение'],
  ['Электронный архив', '—', '◐', '✓'],
];

const steps = [
  ['Первичный аудит', 'Изучаем предприятие, категорию объекта, действующие документы, ПЭК, отчётность, отходы и разрешения.'],
  ['Формируем реестр', 'Фиксируем документы, обязательства, риски и ближайшие сроки.'],
  ['Составляем план', 'Определяем ежемесячные задачи, ответственных и необходимые работы.'],
  ['Заключаем договор', 'Фиксируем состав сопровождения, периодичность и стоимость.'],
  ['Берём предприятие на сопровождение', 'Ведём календарь, документы, отчётность и согласованные экологические процессы.'],
  ['Ежемесячный контроль', 'Руководство видит, что выполнено, что требуется, какие сроки приближаются и какие риски обнаружены.'],
];

const advantages = [
  ['Команда вместо одного специалиста', 'К задаче подключаются специалисты по проектированию, ПЭК, отходам, разрешительным процедурам и лабораторным исследованиям.'],
  ['Контроль сроков', 'Заранее отслеживаем отчётность, исследования, разрешения и другие обязательства.'],
  ['Меньше экологических рисков', 'Регулярная проверка помогает выявлять проблемы до проверок и критических сроков.'],
  ['Одна точка ответственности за работу', 'Предприятие взаимодействует с одной командой по согласованному перечню экологических задач.'],
  ['Понятный статус для руководства', 'Руководитель видит задачи, сроки, риски и результат работы.'],
  ['Электронный архив', 'Документы предприятия систематизируются и хранятся в единой структуре.'],
];

const additionalServices = [
  ['Проект НДВ', 'ndv'], ['Программа ПЭК', 'program-pek'], ['Отчёт ПЭК', 'report-pek'],
  ['РООС', 'roos'], ['ОВОС', 'ovos'], ['ПУО', 'puo'], ['СЗЗ', 'szz'],
  ['Экологическое разрешение', 'environmental-permits'], ['Паспорта отходов', 'waste-passport'],
  ['Лабораторные исследования', 'laboratory-tests'], ['Сопровождение экологических проверок', 'environmental-audit'],
];

const faqs = [
  ['Можно ли полностью заменить штатного эколога?', 'Состав работы определяется договором и особенностями предприятия. ECOPROGRESS может выполнять значительный объём функций экологического сопровождения, однако распределение юридической ответственности и необходимость назначения ответственных лиц определяются самим предприятием с учётом применимых требований.'],
  ['Какие предприятия можно сопровождать?', 'Производственные, строительные, логистические, сервисные и другие предприятия, имеющие экологические обязательства, документы, отходы, источники воздействия или регулярную отчётность.'],
  ['Работаете ли вы по всему Казахстану?', 'Документальное и консультационное сопровождение доступно по Казахстану. Возможность выездов и лабораторных исследований определяется отдельно по региону и объекту.'],
  ['Входят ли экологические проекты в абонентскую плату?', 'Текущая работа входит в согласованный пакет. Крупные проекты, исследования и отдельные разрешительные процедуры включаются только если это прямо предусмотрено договором либо рассчитываются отдельно.'],
  ['Как определяется стоимость?', 'Стоимость зависит от категории объекта, количества площадок, состава экологических обязательств, количества отчётов, ПЭК, объёма отходов, необходимости выездов и других факторов.'],
  ['Можно ли сопровождать несколько объектов одной компании?', 'Да. После первичной инвентаризации объектов формируется единый реестр документов, сроков и задач.'],
];

const schema = [
  ...buildCorePageEntities({ canonical, name: 'Эколог на аутсорсинге — комплексное экологическое сопровождение предприятия', description }),
  buildServiceEntity({ canonical, name: 'Эколог на аутсорсинге', description, serviceType: 'Абонентское экологическое сопровождение предприятия', areaServed: 'Казахстан' }),
  buildBreadcrumbSchema([
    { name: 'Главная', url: company.siteUrl },
    { name: 'Услуги', url: `${company.siteUrl}/services` },
    { name: 'Эколог на аутсорсинге', url: canonical },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${canonical}#faq`,
    mainEntity: faqs.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  },
];

const SectionHeading = ({ eyebrow, title, text, inverted = false }: { eyebrow?: string; title: string; text?: string; inverted?: boolean }) => (
  <div className="mx-auto max-w-3xl text-center">
    {eyebrow && <p className={`text-sm font-bold uppercase tracking-[0.2em] ${inverted ? 'text-accent' : 'text-eco-600'}`}>{eyebrow}</p>}
    <h2 className={`mt-3 text-3xl font-bold leading-tight sm:text-4xl ${inverted ? 'text-white' : 'text-eco-900'}`}>{title}</h2>
    {text && <p className={`mt-4 text-base leading-7 sm:text-lg ${inverted ? 'text-white/70' : 'text-slate-600'}`}>{text}</p>}
  </div>
);

const EcologicalSupportPage = () => (
  <div className="overflow-x-clip bg-white">
    <SEO title={title} description={description} h1="Эколог на аутсорсинге — комплексное экологическое сопровождение предприятия" canonical={canonical} schema={schema} />

    <nav aria-label="Хлебные крошки" className="bg-eco-900 px-4 pt-5 text-sm text-white/70 sm:px-8">
      <ol className="mx-auto flex max-w-7xl flex-wrap gap-2"><li><Link to="/">Главная</Link></li><li aria-hidden="true">/</li><li><Link to="/services">Услуги</Link></li><li aria-hidden="true">/</li><li className="text-white">Эколог на аутсорсинге</li></ol>
    </nav>

    <main>
      <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-24">
        <ResponsiveImage fill priority sizes="100vw" src="/media/ecologist-outsourcing-hero.png" alt="Эколог ECOPROGRESS проводит осмотр промышленного объекта" width={1792} height={1024} wrapperClassName="-z-30" className="object-cover object-center" />
        <div className="absolute inset-0 -z-20 bg-eco-900/90" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_25%,rgba(56,199,186,0.22),transparent_38%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">Экологическое сопровождение</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.08] sm:text-6xl">Эколог на аутсорсинге <span className="mt-3 block text-2xl font-semibold leading-tight text-white/78 sm:text-4xl">— комплексное экологическое сопровождение предприятия</span></h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-white/78 sm:text-lg">Вместо ведения экологических вопросов силами одного специалиста предприятие получает команду ECOPROGRESS, которая контролирует экологическую документацию, отчётность, ПЭК, разрешительные документы, отходы, лабораторный контроль и экологические риски.</p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Преимущества сопровождения">
              {['Работаем по Казахстану', 'Команда профильных специалистов', 'Контроль отчётности и обязательных сроков'].map((item) => <li key={item} className="flex items-start gap-2 text-sm font-semibold text-white/90"><CheckCircle2 className="mt-0.5 shrink-0 text-accent" size={18} />{item}</li>)}
            </ul>
            <div className="mt-8 flex flex-col gap-2 border-l-2 border-accent pl-5"><strong className="text-3xl text-accent">от 350 000 ₸ <span className="text-lg text-white/80">/ месяц</span></strong><span className="max-w-2xl text-sm leading-6 text-white/65">Итоговая стоимость определяется после анализа объекта, категории предприятия, количества площадок и состава работ.</span></div>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap"><Button asChild className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto"><a href="#support-lead">Получить расчёт сопровождения</a></Button><WhatsAppButton label="Написать в WhatsApp" className="w-full sm:w-auto" /></div>
          </div>
          <LeadForm source="ecological_support_hero" formId="ecological_support_hero" ctaId="hero_calculate" sourcePage="/services/ecological-support" title="Рассчитать сопровождение" submitLabel="Получить расчёт" compact defaultService="Эколог на аутсорсинге" serviceSlug="ecological-support" variant="blue" />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-eco-600">Формат работы</p><h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Внешний экологический отдел вашего предприятия</h2><p className="mt-5 leading-7 text-slate-650">ECOPROGRESS берёт на себя регулярное экологическое сопровождение предприятия. Мы формируем календарь обязательств, контролируем документацию и сроки, сопровождаем ПЭК, отчётность, отходы, лабораторные исследования, разрешительные процедуры и взаимодействие с государственными органами в пределах согласованного договора.</p><p className="mt-4 leading-7 text-slate-650">По объёму операционных задач такое сопровождение может закрывать функции отдельного штатного эколога или усиливать существующую экологическую службу предприятия.</p></div>
          <div className="rounded-[28px] border border-eco-100 bg-eco-50 p-5 shadow-xl shadow-eco-900/5 sm:p-8">
            <div className="rounded-2xl bg-white p-5 text-center font-bold text-eco-900 shadow-sm"><Building2 className="mx-auto mb-2 text-eco-600" />Предприятие</div>
            <div className="mx-auto h-7 w-px bg-eco-300" />
            <div className="rounded-2xl bg-eco-900 p-5 text-center font-bold text-white"><Users className="mx-auto mb-2 text-accent" />Команда ECOPROGRESS</div>
            <div className="mx-auto h-7 w-px bg-eco-300" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{['Документы', 'ПЭК', 'Отчётность', 'Отходы', 'Лаборатория', 'Разрешения', 'Проверки', 'Единый контроль'].map((item, index) => <div key={item} className={`rounded-xl border p-3 text-center text-sm font-semibold ${index === 7 ? 'border-accent bg-accent/15 text-eco-900' : 'border-eco-100 bg-white text-slate-700'}`}>{item}</div>)}</div>
          </div>
        </div>
      </section>

      <DigitalPekServiceBanner placement="service_ecological_support" />
      <section className="bg-eco-50 px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="Полный цикл" title="Что мы берём на себя" /><div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{responsibilities.map(({ Icon, title: itemTitle, items }) => <article key={itemTitle} className="rounded-[22px] border border-eco-100 bg-white p-6 shadow-sm"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-eco-50 text-eco-700"><Icon size={24} /></span><h3 className="mt-5 text-xl font-bold text-eco-900">{itemTitle}</h3><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-650">{items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 shrink-0 text-eco-600" size={16} />{item}</li>)}</ul></article>)}</div></div></section>

      <section className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><SectionHeading title="Когда предприятию нужен эколог на аутсорсинге" /><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{audiences.map(([itemTitle, text], index) => <article key={itemTitle} className="rounded-[22px] border border-slate-200 p-6"><span className="text-sm font-black text-eco-500">0{index + 1}</span><h3 className="mt-3 text-xl font-bold text-eco-900">{itemTitle}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></div></section>

      <section className="bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><SectionHeading inverted eyebrow="Форматы сопровождения" title="Выберите подходящий объём работы" text="Точный состав каждого пакета фиксируется в договоре после анализа предприятия." /><div className="mt-12 grid items-start gap-6 lg:grid-cols-3">{packages.map((item, index) => <article key={item.name} className={`relative flex h-full flex-col rounded-[26px] p-6 sm:p-8 ${index === 1 ? 'bg-white text-eco-900 ring-4 ring-accent' : 'border border-white/15 bg-white/10 text-white'}`}>{item.badge && <span className="absolute -top-3 left-6 rounded-full bg-accent px-4 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-eco-900">{item.badge}</span>}<h3 className="text-2xl font-bold">{item.name}</h3>{item.subtitle && <p className={`mt-2 font-semibold ${index === 1 ? 'text-eco-700' : 'text-accent'}`}>{item.subtitle}</p>}<p className={`mt-4 min-h-14 leading-6 ${index === 1 ? 'text-slate-600' : 'text-white/70'}`}>{item.text}</p>{item.prefix && <p className="mt-5 text-sm font-bold">{item.prefix}</p>}<ul className="mt-5 flex-1 space-y-2.5 text-sm leading-6">{item.items.map((entry) => <li key={entry} className="flex gap-2"><CheckCircle2 className={`mt-1 shrink-0 ${index === 1 ? 'text-eco-600' : 'text-accent'}`} size={16} />{entry}</li>)}</ul>{index === 0 && <p className="mt-6 text-sm font-bold">Стоимость: по результатам анализа предприятия</p>}<Button asChild className={`mt-7 w-full ${index !== 1 ? 'bg-accent text-eco-900 hover:bg-accent/90' : ''}`}><a href="#support-lead">{item.cta}</a></Button></article>)}</div><p className="mt-8 text-center text-sm leading-6 text-white/60">ECOPROGRESS оказывает услуги в пределах договора и не принимает автоматически на себя юридическую ответственность должностных лиц предприятия.</p></div></section>

      <section className="bg-eco-50 px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-6xl"><SectionHeading title="Сравнение пакетов" /><div className="mt-10 hidden overflow-hidden rounded-[22px] border border-eco-100 bg-white md:block"><table className="w-full table-fixed text-left"><thead className="bg-eco-900 text-white"><tr><th className="w-[40%] p-4">Задача</th>{packages.map((item) => <th key={item.name} className="p-4 text-center">{item.name}</th>)}</tr></thead><tbody>{comparison.map(([label, ...values]) => <tr key={label} className="border-t border-slate-100"><th className="p-4 text-sm font-semibold text-eco-950">{label}</th>{values.map((value, index) => <td key={`${label}-${index}`} className="p-4 text-center text-sm font-bold text-eco-700">{value}</td>)}</tr>)}</tbody></table></div><div className="mt-8 grid gap-4 md:hidden">{packages.map((item, packageIndex) => <article key={item.name} className="rounded-[22px] border border-eco-100 bg-white p-5"><h3 className="text-xl font-bold text-eco-950">{item.name}</h3><dl className="mt-4 space-y-3">{comparison.map(([label, ...values]) => <div key={label} className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3"><dt className="text-sm text-slate-600">{label}</dt><dd className="text-right text-sm font-bold text-eco-700">{values[packageIndex]}</dd></div>)}</dl></article>)}</div><p className="mt-5 text-sm text-slate-600"><strong>✓</strong> включено · <strong>◐</strong> входит в согласованном объёме · <strong>—</strong> не входит</p></div></section>

      <section className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><SectionHeading title="Как начинается экологическое сопровождение" /><ol className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{steps.map(([itemTitle, text], index) => <li key={itemTitle} className="relative rounded-[22px] border border-slate-200 p-6"><span className="text-4xl font-black text-eco-100">{String(index + 1).padStart(2, '0')}</span><h3 className="mt-2 text-xl font-bold text-eco-950">{itemTitle}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></li>)}</ol></div></section>

      <section className="bg-eco-50 px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><SectionHeading title="Почему предприятия передают экологию на аутсорсинг" /><div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{advantages.map(([itemTitle, text], index) => <article key={itemTitle} className="rounded-[22px] bg-white p-6 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-eco-800">{index === 0 ? <Users /> : index === 5 ? <Archive /> : <CheckCircle2 />}</span><h3 className="mt-5 text-xl font-bold text-eco-950">{itemTitle}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></div></section>

      <section className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><SectionHeading title="Что можно заказать дополнительно" /><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{additionalServices.map(([label, slug]) => <Link key={slug} to={`/services/${slug}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-semibold text-eco-900 transition hover:-translate-y-0.5 hover:border-eco-300 hover:shadow-md"><span>{label}</span><span className="text-eco-500 transition group-hover:translate-x-1" aria-hidden="true">→</span></Link>)}</div></div></section>

      <section className="bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Для руководителя</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Экологическая ситуация предприятия — в понятном виде</h2><p className="mt-4 leading-7 text-white/70">Единый статус помогает видеть ближайшие сроки, открытые задачи и готовность документов без погружения в каждый рабочий файл.</p></div><div className="rounded-[28px] border border-white/15 bg-white/10 p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5"><div><p className="text-sm text-white/55">Экологический статус</p><p className="mt-1 text-xl font-bold">Предприятие под контролем</p></div><LayoutDashboard className="text-accent" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[['Отчётность', '✓ в срок', 'ok'], ['ПЭК', '✓ выполняется', 'ok'], ['Разрешение', 'До окончания: 184 дня', 'info'], ['Лаборатория', 'Следующий контроль: октябрь', 'info'], ['Отходы', '2 задачи требуют внимания', 'warn'], ['Документы', '94% актуально', 'ok']].map(([label, value, tone]) => <div key={label} className="rounded-2xl bg-white p-4 text-eco-900"><p className="text-sm font-semibold text-slate-500">{label}</p><p className={`mt-2 font-bold ${tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-eco-800'}`}>{value}</p></div>)}</div><p className="mt-5 text-xs leading-5 text-white/50">Демонстрационный интерфейс. Реальные данные клиента здесь не выводятся.</p></div></div></section>

      <section className="bg-eco-50 px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-4xl"><SectionHeading title="Частые вопросы" /><div className="mt-10 space-y-3">{faqs.map(([question, answer]) => <details key={question} className="group rounded-[20px] border border-eco-100 bg-white p-5 open:shadow-md"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-bold text-eco-950"><span>{question}</span><span className="text-2xl font-light text-eco-600 transition group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-4 border-t border-slate-100 pt-4 leading-7 text-slate-600">{answer}</p></details>)}</div></div></section>

      <section id="support-lead" className="bg-white px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl overflow-hidden rounded-[30px] bg-eco-900 shadow-2xl shadow-eco-900/15 lg:grid-cols-[0.9fr_1.1fr]"><div className="p-6 text-white sm:p-10 lg:p-12"><p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">ECOPROGRESS GROUP</p><h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Передайте экологическое сопровождение предприятия профильной команде</h2><p className="mt-5 leading-7 text-white/72">Проведём первичную оценку предприятия, определим обязательные экологические задачи и предложим подходящий формат сопровождения.</p><WhatsAppButton label="Написать в WhatsApp" className="mt-7 w-full sm:w-auto" /><p className="mt-6 text-sm text-white/55">Первичная консультация • Работа по договору • По Казахстану</p></div><div className="bg-eco-800 p-5 sm:p-8"><LeadForm source="ecological_support_final" formId="ecological_support_final" ctaId="final_calculate" sourcePage="/services/ecological-support" title="Получить расчёт сопровождения" submitLabel="Получить расчёт сопровождения" compact defaultService="Эколог на аутсорсинге" serviceSlug="ecological-support" variant="blue" /></div></div></section>
    </main>
  </div>
);

export default EcologicalSupportPage;
