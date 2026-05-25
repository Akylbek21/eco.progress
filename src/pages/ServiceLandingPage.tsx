import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import WhatsAppButton from '../components/WhatsAppButton';
import WhatsAppLeadForm from '../components/WhatsAppLeadForm';
import SEO from '../components/SEO';
import { TrustCompact } from '../components/TrustBlocks';
import { company } from '../config/company';
import { trackServiceView } from '../services/analytics';
import { createBlankWhatsAppRequestMessage } from '../utils/whatsapp';

type ServiceLanding = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  h1: string;
  intro: string;
  forWhom: string[];
  includes: string[];
  documents: string[];
  duration: string;
  faq: Array<[string, string]>;
  leadDefault: string;
  image: string;
};

const landingPages: Record<string, ServiceLanding> = {
  'ecological-documents': {
    slug: 'ecological-documents',
    title: 'Экологические документы',
    metaTitle: 'Экологические документы для бизнеса | ecoprogress.kz',
    description: 'Подготовка экологических документов: ОВОС, РООС, ПУО, ПЭК, НДВ, отчеты, разрешения и сопровождение по требованиям РК.',
    h1: 'Экологические документы для бизнеса',
    intro: 'Поможем понять, какие документы нужны вашему объекту, подготовим пакет материалов и сопроводим процесс.',
    forWhom: ['ТОО и ИП', 'производственным объектам', 'строительным компаниям', 'новым объектам перед запуском'],
    includes: ['ОВОС и РООС', 'ПУО и ПЭК', 'НДВ и экологические нормативы', 'отчеты и разрешительная документация', 'консультация по требованиям РК'],
    documents: ['реквизиты компании', 'описание деятельности', 'данные по выбросам, сбросам и отходам', 'схемы площадки при наличии'],
    duration: 'Срок зависит от объекта, категории и состава документов.',
    faq: [['Что делать, если я не знаю, какие документы нужны?', 'Оставьте заявку — специалист определит перечень документов после уточнения объекта.'], ['Можно ли начать без полного пакета данных?', 'Да, мы подскажем, какие сведения собрать в первую очередь.']],
    leadDefault: 'Экологические документы',
    image: '/cottonbro.jpg',
  },
  'waste-transportation': {
    slug: 'waste-transportation',
    title: 'Вывоз отходов',
    metaTitle: 'Вывоз и утилизация отходов | ecoprogress.kz',
    description: 'Сбор, транспортировка, утилизация, переработка и документы по отходам для организаций.',
    h1: 'Вывоз и утилизация отходов',
    intro: 'Организуем сбор отходов, транспортировку, утилизацию и документы для бизнеса.',
    forWhom: ['предприятиям', 'строительным объектам', 'коммунальным службам', 'организациям с регулярными отходами'],
    includes: ['сбор отходов', 'транспортировка', 'утилизация', 'переработка', 'документы по отходам'],
    documents: ['вид отходов', 'примерный объем', 'адрес забора', 'контакт ответственного лица'],
    duration: 'Срок зависит от объема, вида отходов и маршрута.',
    faq: [['Вывозите опасные отходы?', 'Возможность зависит от вида отходов. Специалист уточнит детали и предложит решение.'], ['Какие документы выдаются?', 'Перечень документов зависит от операции с отходами и условий договора.']],
    leadDefault: 'Вывоз отходов',
    image: '/jose.jpg',
  },
  'waste-recycling': {
    slug: 'waste-recycling',
    title: 'Утилизация отходов',
    metaTitle: 'Утилизация и переработка отходов | ecoprogress.kz',
    description: 'Подбор решения для утилизации и переработки отходов с документальным сопровождением.',
    h1: 'Утилизация и переработка отходов',
    intro: 'Поможем подобрать законный способ утилизации или переработки отходов и подготовить документы.',
    forWhom: ['производственным компаниям', 'строительным организациям', 'торговым объектам', 'предприятиям с отходами'],
    includes: ['анализ вида отходов', 'подбор способа утилизации', 'переработка при возможности', 'сопроводительные документы'],
    documents: ['паспорт или описание отходов', 'объем', 'фото при наличии', 'адрес объекта'],
    duration: 'Срок зависит от вида отходов и доступного способа утилизации.',
    faq: [['Можно ли переработать отходы?', 'Это зависит от состава отходов. Мы уточним данные и предложим вариант.'], ['Можно ли заказать разовую услугу?', 'Да, можно оставить заявку на разовую партию отходов.']],
    leadDefault: 'Утилизация отходов',
    image: '/utilizacija-othodov-3.jpg',
  },
  'laboratory-tests': {
    slug: 'laboratory-tests',
    title: 'Лабораторные исследования',
    metaTitle: 'Лабораторные исследования воды, воздуха и почвы | ecoprogress.kz',
    description: 'Анализ воды, воздуха, почвы, замеры выбросов и протоколы лабораторных исследований.',
    h1: 'Лабораторные исследования воды, воздуха и почвы',
    intro: 'Организуем лабораторные анализы и замеры с протоколами для документов, проверок и внутреннего контроля.',
    forWhom: ['предприятиям', 'строительным объектам', 'производственным площадкам', 'организациям перед проверкой'],
    includes: ['анализ воды', 'анализ воздуха', 'анализ почвы', 'замеры выбросов', 'протоколы исследований'],
    documents: ['адрес объекта', 'точки отбора', 'параметры анализа', 'описание задачи'],
    duration: 'Срок зависит от вида анализа, количества точек и лабораторной нагрузки.',
    faq: [['Можно ли получить протокол?', 'Да, по результатам исследований предоставляются протоколы.'], ['Вы делаете замеры выбросов?', 'Да, замеры выбросов входят в перечень лабораторных услуг.']],
    leadDefault: 'Лабораторные анализы',
    image: '/edward.jpg',
  },
  'poligon-tbo': {
    slug: 'poligon-tbo',
    title: 'Полигон ТБО',
    metaTitle: 'Полигон ТБО | ecoprogress.kz',
    description: 'Приём ТБО, законное размещение отходов, документы и работа с организациями.',
    h1: 'Полигон ТБО для организаций',
    intro: 'Предоставляем услуги по приёму и законному размещению ТБО с документальным сопровождением.',
    forWhom: ['организациям', 'коммунальным службам', 'строительным компаниям', 'предприятиям региона'],
    includes: ['приём ТБО', 'законное размещение', 'оформление документов', 'работа с организациями'],
    documents: ['вид отходов', 'объем', 'данные отправителя', 'сопроводительные документы при наличии'],
    duration: 'Условия и сроки зависят от объема и графика приёма.',
    faq: [['Можно ли привезти отходы на полигон?', 'Да, условия приёма уточняются по виду и объему отходов.'], ['Работаете с организациями?', 'Да, оказываем услуги для юридических лиц и ИП.']],
    leadDefault: 'Полигон ТБО',
    image: '/poligon-tbo-2.jpg',
  },
  'environmental-audit': {
    slug: 'environmental-audit',
    title: 'Сопровождение проверок',
    metaTitle: 'Сопровождение экологических проверок | ecoprogress.kz',
    description: 'Подготовка к экологической проверке, проверка документов, консультации и сопровождение бизнеса.',
    h1: 'Сопровождение экологических проверок',
    intro: 'Поможем подготовиться к проверке, собрать документы и понять риски до визита инспекции.',
    forWhom: ['ТОО и ИП', 'производственным объектам', 'компаниям перед проверкой', 'организациям с замечаниями'],
    includes: ['проверка документов', 'анализ рисков', 'подготовка пояснений', 'план действий', 'консультация специалиста'],
    documents: ['имеющиеся разрешения', 'отчеты', 'договоры по отходам', 'протоколы исследований при наличии'],
    duration: 'Срок зависит от количества документов и срочности проверки.',
    faq: [['Что делать, если проверка уже пришла?', 'Оставьте заявку срочно — специалист поможет определить первые шаги.'], ['Можно ли проверить документы заранее?', 'Да, это снижает риск замечаний при проверке.']],
    leadDefault: 'Сопровождение проверки',
    image: '/images (1).jpg',
  },
};

export const serviceLandingSlugs = Object.keys(landingPages);

const ServiceLandingPage = ({ slug }: { slug: string }) => {
  const page = landingPages[slug];

  useEffect(() => {
    if (page) trackServiceView({ slug: page.slug, title: page.title });
  }, [page]);

  if (!page) return <Navigate to="/services" replace />;

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: company.name,
      telephone: company.phone,
      email: company.email,
      address: company.address,
      url: company.siteUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: page.title,
      description: page.description,
      provider: { '@type': 'Organization', name: company.name },
    },
  ];

  return (
    <div className="bg-white">
      <SEO title={page.metaTitle} description={page.description} canonical={`${company.siteUrl}/services/${page.slug}`} schema={schema} />
      <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-24">
        <img src={page.image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-eco-900/82" />
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{page.title}</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">{page.h1}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/76">{page.intro}</p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <a href="#lead"><Button className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto">Оставить заявку</Button></a>
              <WhatsAppButton label="Оставить заявку через WhatsApp" message={createBlankWhatsAppRequestMessage(page.title)} className="w-full sm:w-auto" />
            </div>
          </div>
          <WhatsAppLeadForm source={`service_${page.slug}_whatsapp`} title="Заявка через WhatsApp" compact defaultService={page.title} />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-8">
            <Block title="Кому нужна услуга" items={page.forWhom} />
            <Block title="Что входит в работу" items={page.includes} />
            <Block title="Какие документы могут понадобиться" items={page.documents} />
            <div className="rounded-[22px] border border-slate-200 bg-[#F7FBFD] p-6">
              <h2 className="text-2xl font-bold text-eco-900">Сроки</h2>
              <p className="mt-3 leading-7 text-slate-600">{page.duration}</p>
            </div>
          </div>
          <div className="rounded-[22px] bg-eco-50 p-5">
            <h2 className="text-2xl font-bold text-eco-900">Почему выбирают нас</h2>
            <div className="mt-5"><TrustCompact /></div>
          </div>
        </div>
      </section>

      <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-eco-900">FAQ</h2>
          <div className="mt-8 space-y-4">
            {page.faq.map(([q, a]) => (
              <div key={q} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-eco-900">{q}</h3>
                <p className="mt-3 leading-7 text-slate-600">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="lead" className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-bold text-eco-900">Получить консультацию по услуге</h2>
            <p className="mt-4 leading-7 text-slate-600">Опишите задачу, и специалист подскажет сроки, документы и примерный порядок работы.</p>
          </div>
          <WhatsAppLeadForm source={`service_bottom_${page.slug}_whatsapp`} defaultService={page.title} />
        </div>
      </section>
    </div>
  );
};

const Block = ({ title, items }: { title: string; items: string[] }) => (
  <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-2xl font-bold text-eco-900">{title}</h2>
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="rounded-2xl bg-eco-50 p-4 text-sm font-semibold leading-6 text-eco-900">{item}</li>
      ))}
    </ul>
  </div>
);

export default ServiceLandingPage;
