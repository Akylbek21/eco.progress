import { useState } from 'react';
import {
  Beaker,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  FolderCheck,
  Globe2,
  Leaf,
  Recycle,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import LeadForm from '../components/LeadForm';
import OrderChoiceModal from '../components/OrderChoiceModal';
import { getWhatsAppUrl } from '../config/company';
import { trackWhatsAppClick } from '../services/analytics';

type CardItem = {
  title: string;
  text: string;
  Icon: LucideIcon;
  examples?: string[];
  image?: string;
};

const facts = ['Комплексный подход', 'Работа по Казахстану', 'Экологические документы', 'Лабораторные исследования', 'Транспортировка отходов', 'Утилизация и полигон'];

const aboutParagraphs = [
  'Мы оказываем комплексные экологические услуги для бизнеса на территории Республики Казахстан: от экологического проектирования и лабораторных исследований до сбора, транспортировки, переработки и утилизации отходов.',
  'В нашу деятельность входят разработка экологической документации, получение разрешений, производственный экологический контроль, лабораторные анализы воды, почвы и воздуха рабочей зоны, а также сопровождение проектов в уполномоченных органах.',
  'Компания работает с опасными и неопасными отходами, включая ТБО, производственные и промышленные отходы, нефтешлам, отработанные масла, химические отходы, строительные отходы, шины, РТИ и другие виды отходов. Все работы выполняются с соблюдением требований экологической, санитарной и промышленной безопасности Республики Казахстан.',
  'Наше преимущество — комплексный подход. Клиент может получить все необходимые услуги в одном месте: консультацию, подготовку документов, лабораторные протоколы, отчетность, вывоз и утилизацию отходов, а также сопровождение до готового результата.',
  'Мы используем квалифицированный персонал, специализированную технику, аккредитованную лабораторию и современные решения для контроля заявок и документов. Это позволяет соблюдать сроки, снижать риски при проверках и обеспечивать прозрачную работу с каждым клиентом.',
  'Наша цель — помогать бизнесу безопасно и законно выполнять экологические требования, минимизировать воздействие на окружающую среду и развивать устойчивые решения в сфере экологии.',
];

const directions: CardItem[] = [
  {
    title: 'Экологическое проектирование',
    text: 'Разрабатываем экологические проекты, программы и документы для предприятий и объектов.',
    Icon: FileText,
    image: '/cottonbro.jpg',
    examples: ['ОВОС', 'РООС', 'ПУО', 'ПЭК', 'НДВ', 'отчеты', 'разрешения'],
  },
  {
    title: 'Лабораторные исследования',
    text: 'Организуем анализы и замеры воды, воздуха, почвы и выбросов с оформлением протоколов.',
    Icon: Beaker,
    image: '/edward.jpg',
  },
  {
    title: 'Транспортировка отходов',
    text: 'Организуем безопасный вывоз отходов с соблюдением требований и документальным сопровождением.',
    Icon: Truck,
    image: '/jose.jpg',
  },
  {
    title: 'Утилизация и переработка',
    text: 'Принимаем и направляем отходы на переработку, утилизацию или безопасное размещение.',
    Icon: Recycle,
    image: '/utilizacija-othodov-3.jpg',
  },
  {
    title: 'Полигон ТБО',
    text: 'Предоставляем решения по законному и экологически безопасному размещению твердых бытовых отходов.',
    Icon: Globe2,
    image: '/poligon-tbo-2.jpg',
  },
  {
    title: 'Сопровождение бизнеса',
    text: 'Помогаем подготовиться к проверкам, собрать документы и снизить экологические риски.',
    Icon: ShieldCheck,
    image: '/images (1).jpg',
  },
];

const companies = [
  {
    title: 'Tumar Construction Group',
    text: 'Экологическое проектирование, лабораторный контроль и сопровождение предприятий.',
    logo: '/Tumar.jpeg',
  },
  {
    title: 'Tumar Partners',
    text: 'Полигон ТБО и услуги по законному размещению твердых бытовых отходов.',
    logo: '/tumar partners.jpeg',
  },
  {
    title: 'EcoTrans',
    text: 'Транспортировка отходов и сопровождение вывоза с учетом экологических требований.',
    logo: '/ecotrans.jpeg',
  },
  {
    title: 'EcoAnalytics',
    text: 'Аналитика, лабораторные исследования и контроль экологических показателей.',
    logo: '/ecoanalytics.jpeg',
  },
];

const trustItems: CardItem[] = [
  {
    title: 'Комплексный подход',
    text: 'Клиент получает не отдельную услугу, а решение всей задачи: документы, анализы, вывоз, утилизация и сопровождение.',
    Icon: CheckCircle2,
  },
  {
    title: 'Работа по требованиям РК',
    text: 'Помогаем бизнесу соблюдать экологические требования и готовить необходимые документы.',
    Icon: FileCheck2,
  },
  {
    title: 'Лабораторные исследования',
    text: 'Проводим анализы и замеры для подтверждения экологических показателей.',
    Icon: Beaker,
  },
  {
    title: 'Документальное сопровождение',
    text: 'Помогаем собрать документы, отчеты, протоколы и разрешения.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Безопасная транспортировка отходов',
    text: 'Организуем вывоз отходов с учетом требований безопасности.',
    Icon: Truck,
  },
  {
    title: 'Ответственный подход к экологии',
    text: 'Наша цель — снизить экологическую нагрузку и развивать культуру правильного обращения с отходами.',
    Icon: Leaf,
  },
];

const documents = ['Сертификаты специалистов', 'Разрешения', 'Лабораторные протоколы', 'Документы по транспортировке отходов', 'Документы по полигону', 'Экологические проекты'];
const steps = ['Вы оставляете заявку', 'Специалист уточняет задачу', 'Мы подбираем решение', 'Готовим документы / организуем услугу', 'Вы получаете результат и сопровождение'];

const AboutPage = () => {
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  return (
  <div className="bg-white">
    <SEO
      title="О компании | ecoprogress.kz"
      description="ecoprogress.kz оказывает комплексные экологические услуги для бизнеса в Казахстане: проектирование, лабораторные исследования, вывоз, переработка и утилизация отходов."
    />

    <section className="relative isolate overflow-hidden px-4 py-20 text-white sm:px-8 sm:py-28">
      <img src="/para.jpg" alt="" className="absolute inset-0 -z-30 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-20 bg-eco-900/78" />
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">О компании</p>
          <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-6xl">
            ecoprogress.kz — экологические решения для бизнеса
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 max-w-4xl text-lg leading-8 text-white/80">
            Мы объединяем экологическое проектирование, лабораторные исследования, транспортировку, утилизацию отходов и услуги полигона, чтобы бизнес мог работать безопасно, законно и с заботой об окружающей среде.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
            <Button type="button" onClick={() => setOrderModalOpen(true)} className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto">Оставить заявку</Button>
            <a href="#lead" className="w-full sm:w-auto"><Button variant="secondary" className="w-full border-white/35 bg-white/10 text-white hover:bg-white/18 sm:w-auto">Получить консультацию</Button></a>
            <a href={getWhatsAppUrl()} target="_blank" rel="noreferrer" onClick={() => trackWhatsAppClick({ placement: 'about_hero' })} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 sm:w-auto">
              <FaWhatsapp size={18} aria-hidden="true" /> Написать в WhatsApp
            </a>
          </div>
        </Reveal>
      </div>
    </section>

    <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-start">
        <Reveal direction="right">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Кто мы</p>
            <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Комплексные экологические услуги для бизнеса</h2>
            <div className="mt-6 space-y-5 text-base leading-8 text-slate-600">
              {aboutParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </div>
        </Reveal>
        <Reveal direction="left">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-xl shadow-eco-900/8 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {facts.map((item) => (
                <div key={item} className="rounded-2xl bg-eco-50 p-4 text-sm font-bold text-eco-900">{item}</div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>

    <section className="bg-white px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[28px] bg-eco-900 p-6 text-white shadow-2xl shadow-eco-900/15 sm:p-10">
            <img src="/para.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-eco-900/80" />
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/10 text-accent">
                <Leaf size={38} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Наша миссия</p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Объединённые усилия — чистое будущее</h2>
                <p className="mt-5 max-w-4xl text-lg leading-8 text-white/78">
                  Создавать и внедрять экологически устойчивые решения, которые помогают бизнесу соблюдать требования законодательства, безопасно обращаться с отходами и вносить вклад в чистое будущее.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>

    <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionIntro eyebrow="Направления" title="Чем мы занимаемся" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {directions.map(({ title, text, Icon, examples, image }, index) => (
            <Reveal key={title} delay={index * 0.04}>
              <div className="card-hover flex h-full flex-col rounded-[20px] border border-slate-200 bg-white shadow-lg shadow-eco-900/5">
                <div className="relative h-40 overflow-hidden">
                  <img src={image} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-eco-900/70 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/92 text-eco-700 shadow-sm">
                    <Icon size={22} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-bold text-eco-900">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{text}</p>
                  {examples && <div className="mt-5 flex flex-wrap gap-2">{examples.map((item) => <span key={item} className="rounded-full bg-eco-50 px-3 py-1 text-xs font-semibold text-eco-800">{item}</span>)}</div>}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-white px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionIntro eyebrow="Группа компаний" title="Группа компаний ecoprogress.kz" text="В группу входят компании и направления, которые закрывают разные экологические задачи бизнеса: проектирование, лаборатория, транспортировка отходов, утилизация и полигон." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {companies.map(({ title, text, logo }, index) => (
            <Reveal key={title} delay={index * 0.04}>
              <div className="relative flex min-h-[260px] h-full overflow-hidden rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
                <img src={logo} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/88 to-white/35" />
                <div className="relative mt-auto">
                  <h3 className="text-xl font-bold text-eco-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionIntro eyebrow="Доверие" title="Почему нам доверяют" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {trustItems.map(({ title, text, Icon }, index) => (
            <Reveal key={title} delay={index * 0.04}>
              <div className="h-full rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
                <Icon className="text-eco-600" size={26} />
                <h3 className="mt-5 text-lg font-bold text-eco-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section id="documents" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Документы"
          title="Документы, сертификаты и разрешения"
          text="Мы сопровождаем работу подтверждающими материалами: сертификатами специалистов, разрешительными документами, лабораторными протоколами и документами по направлениям деятельности."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Replace with real documents later. */}
          {documents.map((item) => (
            <div key={item} className="rounded-[20px] border border-dashed border-eco-200 bg-eco-50 p-5">
              <FolderCheck className="text-eco-600" size={24} />
              <p className="mt-4 text-sm font-bold text-eco-900">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section id="how-we-work" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <SectionIntro eyebrow="Процесс" title="Как мы работаем" />
        <div className="mt-10 grid gap-4 lg:grid-cols-5">
          {steps.map((step, index) => (
            <div key={step} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-eco-900 text-sm font-bold text-white">{index + 1}</span>
              <p className="mt-5 text-sm font-bold leading-6 text-eco-900">{step}</p>
            </div>
          ))}
        </div>
        <Button type="button" onClick={() => setOrderModalOpen(true)} className="mt-8">Оставить заявку</Button>
      </div>
    </section>

    <section id="lead" className="bg-white px-4 py-16 text-eco-900 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <Reveal direction="right">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Нужна помощь с экологическими документами или отходами?</h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-600">Оставьте заявку — специалист ecoprogress.kz свяжется с вами, уточнит задачу и подскажет оптимальное решение.</p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <a href="#lead-form"><Button className="w-full sm:w-auto">Получить консультацию</Button></a>
              <a href={getWhatsAppUrl()} target="_blank" rel="noreferrer" onClick={() => trackWhatsAppClick({ placement: 'about_bottom' })} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-eco-200 bg-white px-5 py-3 text-sm font-semibold text-eco-900 shadow-sm hover:bg-eco-50 sm:w-auto">
                <FaWhatsapp size={18} aria-hidden="true" /> Написать в WhatsApp
              </a>
              <Button type="button" variant="secondary" onClick={() => setOrderModalOpen(true)} className="w-full border-eco-200 bg-white text-eco-900 hover:bg-eco-50 sm:w-auto">Оставить заявку</Button>
            </div>
          </div>
        </Reveal>
        <Reveal direction="left">
          <div id="lead-form">
            <LeadForm source="about_page" title="Получить консультацию" compact variant="blue" />
          </div>
        </Reveal>
      </div>
    </section>
    <OrderChoiceModal open={orderModalOpen} onClose={() => setOrderModalOpen(false)} />
  </div>
  );
};

const SectionIntro = ({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) => (
  <Reveal>
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 leading-7 text-slate-600">{text}</p>}
    </div>
  </Reveal>
);

export default AboutPage;
