import { ArrowRight, Check } from 'lucide-react';

const edoAppUrl = (import.meta.env.VITE_EDO_APP_URL || 'https://edo.ecoprogress.kz').replace(/\/$/, '');

const capabilities = [
  'Документы и версии',
  'Маршруты согласования',
  'Подписание через NCALayer',
  'Внешние подписанты',
  'Журнал действий',
  'Скачивание подписанного пакета',
];

const DocumentFlowPricingPage = () => (
  <main className="min-h-[70vh] bg-[#f6fafc] px-5 py-16 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <p className="text-center text-sm font-black uppercase tracking-[.18em] text-eco-600">Тарифы документооборота</p>
      <h1 className="mx-auto mt-4 max-w-3xl text-center text-4xl font-black text-eco-950 sm:text-5xl">Подберите условия для вашей организации</h1>
      <p className="mx-auto mt-5 max-w-2xl text-center leading-7 text-slate-600">
        Актуальная стоимость, лимиты и доступные функции подтверждаются в защищённом сервисе перед подключением.
      </p>
      <section className="mx-auto mt-12 max-w-2xl rounded-[28px] border border-eco-100 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-black text-eco-950">EcoProgress EDO</h2>
        <p className="mt-2 text-slate-600">Стоимость зависит от количества участников, документов и требуемых функций.</p>
        <ul className="mt-7 grid gap-3 sm:grid-cols-2">
          {capabilities.map((item) => <li key={item} className="flex gap-2 text-sm"><Check size={18} className="text-emerald-600" />{item}</li>)}
        </ul>
        <a href={`${edoAppUrl}/register/organization`} className="mt-8 inline-flex items-center gap-2 rounded-full bg-eco-900 px-6 py-3 font-bold text-white">
          Подключить EDO <ArrowRight size={18} />
        </a>
      </section>
    </div>
  </main>
);

export default DocumentFlowPricingPage;
