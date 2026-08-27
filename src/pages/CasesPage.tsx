import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { company } from '../config/company';
import { publicContentRepository } from '../content/apiRepository';
import { isPublishableCaseStudy } from '../content/cases/caseStudyPolicy';
import { pageHeroImages } from '../data/pageHeroImages';
import { buildBreadcrumbSchema, buildCorePageEntities } from '../seo/entityBuilders';

const CasesPage = () => {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['public-content', 'cases'],
    queryFn: () => publicContentRepository.getCases(),
    staleTime: 5 * 60 * 1000,
  });
  const cases = data.filter(isPublishableCaseStudy);
  const canonical = `${company.siteUrl}/cases`;

  return (
    <main className="bg-eco-50">
      <SEO
        title="Подтверждённые экологические кейсы | ECOPROGRESS"
        description="Опубликованные проекты EcoProgress с проверенными исходными данными, выполненными работами, нормативной базой и результатами."
        canonical={canonical}
        schema={[
          ...buildCorePageEntities({ canonical, name: 'Подтверждённые экологические кейсы', description: 'Реальные опубликованные проекты EcoProgress.' }),
          buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Кейсы', url: canonical }]),
        ]}
      />

      <section className="relative isolate min-h-[620px] overflow-hidden px-5 py-20 text-white sm:px-8 sm:py-24 lg:flex lg:items-center">
        <ResponsiveImage fill priority sizes="100vw" src={pageHeroImages.cases} alt="Природный горный рельеф" width={1600} height={900} wrapperClassName="-z-20" className="object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-eco-900/72 via-eco-900/36 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-[5] h-16 bg-gradient-to-t from-eco-50/90 to-transparent" />
        <div className="mx-auto w-full max-w-7xl [text-shadow:0_2px_18px_rgba(2,28,57,0.72)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-md"><Sparkles size={17} className="text-accent" />Практический опыт</div>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl">Подтверждённые экологические кейсы</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-white/82 sm:text-xl sm:leading-8">Публикуем только проекты с подтверждёнными исходными данными, выполненными работами и проверенным результатом.</p>
          <div className="mt-9 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md"><CheckCircle2 className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">проверенные результаты</span></div>
            <div className="rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md"><ShieldCheck className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">подтверждённые данные</span></div>
            <div className="col-span-2 rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md sm:col-span-1"><EyeOff className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">конфиденциальность клиента</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="max-w-4xl text-lg leading-8 text-slate-600">Название клиента скрывается, если раскрытие запрещено. Черновики и проекты без проверки клиента или специалиста в этом разделе не показываются.</p>
        {isLoading && <p className="mt-10 text-slate-600">Загрузка кейсов…</p>}
        {isError && <p className="mt-10 rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-rose-900">Не удалось загрузить кейсы с сервера.</p>}
        {!isLoading && !isError && !cases.length && (
          <div className="mt-10 rounded-[22px] border border-eco-200 bg-white p-6">
            <h2 className="text-xl font-bold text-eco-900">Подтверждённых публикаций пока нет</h2>
            <p className="mt-3 text-slate-600">Новые проверенные проекты появятся здесь после согласования публикации.</p>
          </div>
        )}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((item) => (
            <Link key={item.id} to={`/cases/${item.slug}`} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-eco-300 hover:shadow-lg">
              <p className="text-xs font-bold uppercase text-eco-500">{item.service} · {item.city}</p>
              <h2 className="mt-3 text-xl font-bold text-eco-900">{item.title}</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">{item.problem}</p>
              <p className="mt-5 text-sm font-semibold text-eco-700">Открыть кейс →</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

export default CasesPage;
