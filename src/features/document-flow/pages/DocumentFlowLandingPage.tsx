import { useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, FileCheck2, History, Network, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { documentFlowAccessApi, documentFlowPlansApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { accessDestination } from '../utils/access';
import { AccessRequestDialog } from '../components/AccessRequestDialog';

const benefits: Array<[string, string, ComponentType<{ className?: string; size?: number }>]> = [
  ['Несколько подписантов', 'Сотрудники, контрагенты и внешние подписанты в одном документе.', Users],
  ['Гибкие маршруты', 'Последовательные, параллельные и смешанные этапы согласования.', Network],
  ['ЭЦП через NCALayer', 'Detached CMS отправляется backend для обязательной проверки.', ShieldCheck],
  ['Версии и история', 'Неизменяемые версии, хэш, журнал действий и проверка подписей.', History],
];

const faqs = [
  ['Кто управляет доступом?', 'Статус подписки, функции, лимиты и доступные действия возвращает backend EcoProgress.'],
  ['Можно ли работать после окончания подписки?', 'Если backend разрешает, документы остаются доступны в режиме просмотра и скачивания.'],
  ['Подпись хранится в браузере?', 'Нет. Закрытый ключ и пароль не покидают NCALayer, CMS не сохраняется в localStorage.'],
];

const DocumentFlowLandingPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [requestOpen, setRequestOpen] = useState(false);
  const plansQuery = useQuery({ queryKey: documentFlowKeys.plans(), queryFn: documentFlowPlansApi.list, retry: false });

  const openModule = async () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=%2Fdocument-flow%2Fapp');
      return;
    }
    try {
      navigate(accessDestination(await documentFlowAccessApi.get()));
    } catch {
      navigate('/document-flow/access-required');
    }
  };

  return (
    <div className="bg-[#f6fafc] text-slate-900">
      <section className="overflow-hidden bg-eco-900 px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.18em] text-eco-200">EcoProgress · Документооборот</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Документы, маршруты и ЭЦП — в одном защищённом разделе</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">Создавайте и отправляйте документы, назначайте несколько подписантов, контролируйте версии и подписывайте через NCALayer.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button onClick={() => void openModule()} className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 font-bold text-eco-950">
                {isAuthenticated ? 'Открыть документооборот' : 'Войти'} <ArrowRight size={18} />
              </button>
              {!isAuthenticated && <Link to="/register" className="rounded-full border border-white/25 px-6 py-3.5 font-bold text-white">Зарегистрироваться</Link>}
              <Link to="/document-flow/pricing" className="rounded-full border border-white/25 px-6 py-3.5 font-bold text-white">Посмотреть тарифы</Link>
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
            <article key={String(title)} className="rounded-[28px] border border-eco-100 bg-white p-6 shadow-sm">
              <Icon className="text-eco-700" size={30} />
              <h2 className="mt-5 text-xl font-black text-eco-950">{title}</h2>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-black text-eco-950 sm:text-4xl">Полный жизненный цикл документа</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {['Создание, файлы и проверка', 'Маршрут и несколько подписантов', 'Подпись, версии и аудит'].map((item, index) => (
              <div key={item} className="rounded-3xl bg-eco-50 p-6"><span className="text-sm font-black text-eco-600">0{index + 1}</span><p className="mt-3 text-lg font-bold">{item}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
        <h2 className="text-3xl font-black text-eco-950">Частые вопросы</h2>
        <div className="mt-8 space-y-4">
          {faqs.map(([question, answer]) => <details key={question} className="rounded-2xl border border-eco-100 bg-white p-5"><summary className="cursor-pointer font-bold">{question}</summary><p className="mt-3 leading-7 text-slate-600">{answer}</p></details>)}
        </div>
        <div className="mt-12 rounded-[28px] bg-eco-900 p-8 text-white">
          <CheckCircle2 />
          <h2 className="mt-4 text-2xl font-black">Подключите документооборот к вашей организации</h2>
          <p className="mt-2 text-white/70">Доступ активируется только после подтверждения backend.</p>
          <button onClick={() => setRequestOpen(true)} className="mt-6 rounded-full bg-accent px-6 py-3 font-bold text-eco-950">Оставить заявку</button>
        </div>
      </section>
      <AccessRequestDialog open={requestOpen} plans={plansQuery.data || []} onClose={() => setRequestOpen(false)} />
    </div>
  );
};

export default DocumentFlowLandingPage;
