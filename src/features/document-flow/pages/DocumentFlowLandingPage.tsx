import { ArrowRight, FileCheck2, History, Network, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

const edoAppUrl = (import.meta.env.VITE_EDO_APP_URL || 'https://edo.ecoprogress.kz').replace(/\/$/, '');

const benefits: Array<[string, string, LucideIcon]> = [
  ['Несколько подписантов', 'Сотрудники, контрагенты и внешние подписанты в одном маршруте.', Users],
  ['Гибкие маршруты', 'Последовательные, параллельные и смешанные этапы согласования.', Network],
  ['ЭЦП через NCALayer', 'CMS-подпись проверяется backend и не хранится в браузере.', ShieldCheck],
  ['Версии и история', 'Версии документов, контроль целостности и журнал действий.', History],
];

const DocumentFlowLandingPage = () => (
  <div className="bg-[#f6fafc] text-slate-900">
    <section className="overflow-hidden bg-eco-900 px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.18em] text-eco-200">EcoProgress · Документооборот</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Документы, маршруты и ЭЦП в защищённом сервисе</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
            Создавайте и отправляйте документы, назначайте подписантов, контролируйте версии и подписывайте через NCALayer.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={`${edoAppUrl}/login`} className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 font-bold text-eco-950">
              Войти <ArrowRight size={18} />
            </a>
            <a href={`${edoAppUrl}/register/organization`} className="rounded-full border border-white/25 px-6 py-3.5 font-bold text-white">
              Зарегистрироваться
            </a>
            <a href="/document-flow/pricing" className="rounded-full border border-white/25 px-6 py-3.5 font-bold text-white">
              Посмотреть тарифы
            </a>
          </div>
        </div>
        <div className="rounded-[32px] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur">
          {['Договор поставки', 'Акт выполненных работ', 'Экологический отчёт'].map((name, index) => (
            <div key={name} className="mb-3 flex items-center gap-4 rounded-2xl bg-white p-4 text-eco-950 last:mb-0">
              <FileCheck2 className="text-eco-600" />
              <div className="flex-1"><p className="font-bold">{name}</p><p className="text-sm text-slate-500">{index + 1} из 3 подписей</p></div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">На подписи</span>
            </div>
          ))}
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {benefits.map(([title, text, Icon]) => (
          <article key={title} className="rounded-[28px] border border-eco-100 bg-white p-6 shadow-sm">
            <Icon className="text-eco-700" size={30} />
            <h2 className="mt-5 text-xl font-black text-eco-950">{title}</h2>
            <p className="mt-3 leading-7 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
    </section>
    <section className="bg-white px-5 py-20 text-center sm:px-8">
      <h2 className="text-3xl font-black text-eco-950">Готовы начать?</h2>
      <p className="mx-auto mt-4 max-w-2xl text-slate-600">Авторизация и работа с документами выполняются только в отдельном приложении EcoProgress EDO.</p>
      <a href={edoAppUrl} className="mt-8 inline-flex items-center gap-2 rounded-full bg-eco-900 px-6 py-3.5 font-bold text-white">
        Открыть EDO <ArrowRight size={18} />
      </a>
    </section>
  </div>
);

export default DocumentFlowLandingPage;
