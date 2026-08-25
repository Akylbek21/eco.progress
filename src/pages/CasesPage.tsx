import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SEO from '../components/SEO';
import { company } from '../config/company';
import { publicContentRepository } from '../content/apiRepository';
import { isPublishableCaseStudy } from '../content/cases/caseStudyPolicy';
import { buildBreadcrumbSchema, buildCorePageEntities } from '../seo/entityBuilders';

const CasesPage = () => {
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['public-content', 'cases'], queryFn: () => publicContentRepository.getCases(), staleTime: 5 * 60 * 1000 });
  const cases = data.filter(isPublishableCaseStudy);
  const canonical = `${company.siteUrl}/cases`;
  return <main className="bg-eco-50 px-5 py-16 sm:px-8">
    <SEO title="Подтверждённые экологические кейсы | ECOPROGRESS" description="Опубликованные проекты EcoProgress с проверенными исходными данными, выполненными работами, нормативной базой и результатами." canonical={canonical} schema={[...buildCorePageEntities({ canonical, name: 'Подтверждённые экологические кейсы', description: 'Реальные опубликованные проекты EcoProgress.' }), buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Кейсы', url: canonical }])]} />
    <div className="mx-auto max-w-7xl">
      <h1 className="text-4xl font-bold text-eco-900 sm:text-5xl">Подтверждённые экологические кейсы</h1>
      <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-600">Раздел содержит только опубликованные проекты, для которых подтверждены исходные данные, выполненные работы, результат, нормативная база, специалист и reviewer. Название клиента скрывается, если раскрытие запрещено.</p>
      {isLoading && <p className="mt-10 text-slate-600">Загрузка кейсов…</p>}
      {isError && <p className="mt-10 rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-rose-900">Не удалось загрузить кейсы с сервера.</p>}
      {!isLoading && !isError && !cases.length && <div className="mt-10 rounded-[22px] border border-eco-200 bg-white p-6"><h2 className="text-xl font-bold text-eco-900">Подтверждённых публикаций пока нет</h2><p className="mt-3 text-slate-600">Черновики и проекты без проверки клиента или специалиста здесь не показываются.</p></div>}
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{cases.map((item) => <Link key={item.id} to={`/cases/${item.slug}`} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm hover:border-eco-300"><p className="text-xs font-bold uppercase text-eco-500">{item.service} · {item.city}</p><h2 className="mt-3 text-xl font-bold text-eco-900">{item.title}</h2><p className="mt-4 text-sm leading-6 text-slate-600">{item.problem}</p><p className="mt-5 text-sm font-semibold text-eco-700">Открыть кейс →</p></Link>)}</div>
    </div>
  </main>;
};

export default CasesPage;
