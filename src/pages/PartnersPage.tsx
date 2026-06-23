import { Building2, Handshake, ShieldCheck, type LucideIcon } from 'lucide-react';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';

const partners = [
  {
    title: 'Tumar Construction Group',
    description: 'Партнер по экологическому проектированию, сопровождению предприятий и комплексным решениям для бизнеса.',
    logo: '/Tumar.jpeg',
  },
  {
    title: 'Tumar Partners',
    description: 'Партнерское направление по размещению, сопровождению и работе с объектами обращения отходов.',
    logo: '/tumar partners.jpeg',
  },
  {
    title: 'EcoTrans',
    description: 'Партнер по транспортировке отходов и организации вывоза с документальным сопровождением.',
    logo: '/ecotrans.jpeg',
  },
  {
    title: 'EcoAnalytics',
    description: 'Партнер по аналитике, лабораторному контролю и экологическим исследованиям.',
    logo: '/ecoanalytics.jpeg',
  },
  {
    title: 'Aleana',
    description: 'Партнерское направление для комплексной работы с клиентами и экологическими задачами.',
    logo: '/aleana.jpeg',
  },
];

const strengths: Array<{ title: string; text: string; Icon: LucideIcon }> = [
  {
    title: 'Единый стандарт',
    text: 'Работаем с партнерами по единым требованиям к срокам, документам и качеству.',
    Icon: ShieldCheck,
  },
  {
    title: 'Комплекс услуг',
    text: 'Закрываем проектирование, лабораторию, транспортировку, утилизацию и сопровождение.',
    Icon: Building2,
  },
  {
    title: 'Надежная коммуникация',
    text: 'Клиент получает понятный маршрут заявки и прозрачные статусы на каждом этапе.',
    Icon: Handshake,
  },
];

const PartnersPage = () => (
  <div className="bg-white">
    <SEO
      title="Наши партнеры | ecoprogress.kz"
      description="Партнеры ecoprogress.kz: компании и направления, которые помогают закрывать экологические задачи бизнеса в Казахстане."
    />

    <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20">
      <img src="/para.jpg" alt="" width="1600" height="900" loading="eager" fetchPriority="high" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 -z-30 h-full w-full bg-eco-900 object-cover" />
      <div className="absolute inset-0 -z-20 bg-eco-900/82" />
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">Наши партнеры</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">
            Компании, с которыми мы решаем экологические задачи бизнеса
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/78">
            Партнерская сеть помогает нам закрывать разные направления: экологические документы, лабораторный контроль, транспортировку отходов, утилизацию и сопровождение проектов.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {partners.slice(0, 5).map((partner) => (
              <div key={partner.title} className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[18px] border border-white/14 bg-white p-3 shadow-xl shadow-eco-950/20">
                <img src={partner.logo} alt={partner.title} width="640" height="480" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="max-h-full max-w-full object-contain" />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>

    <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-eco-600">Логотипы компаний</p>
            <h2 className="mt-4 text-3xl font-bold text-eco-900 sm:text-4xl">Партнеры ecoprogress.kz</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {partners.map((partner, index) => (
            <Reveal key={partner.title} delay={index * 0.04}>
              <article className="flex h-full flex-col rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex aspect-[5/3] items-center justify-center rounded-2xl bg-slate-50 p-4">
                  <img src={partner.logo} alt={partner.title} width="640" height="384" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="max-h-full max-w-full object-contain" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-eco-900">{partner.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{partner.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-white px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
        {strengths.map(({ title, text, Icon }, index) => (
          <Reveal key={title} delay={index * 0.04}>
            <div className="h-full rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
              <Icon className="text-eco-600" size={26} />
              <h3 className="mt-5 text-lg font-bold text-eco-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  </div>
);

export default PartnersPage;
