import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, FileText, MessageCircle, ShieldCheck } from 'lucide-react';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import LeadForm from '../components/LeadForm';
import Button from '../components/ui/Button';
import { company, getWhatsAppUrl } from '../config/company';
import { seoPageMap, type SeoPageConfig } from '../data/seoPages';
import NotFoundPage from './NotFoundPage';
import { buildArticleSchema, buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema, buildServiceEntity, entityIds } from '../seo/entityBuilders';
import { regionContentMap } from '../content/regions/regionContent';
import { ArticleAuthorCard, ArticleOrganizationAuthorCard, ArticleReviewerCard, ArticleSources, RelatedArticles, RelatedServices } from '../components/content/ContentBlocks';
import { expertMap, experts, isCompleteExpert } from '../content/experts/experts';
import type { CaseStudy, Expert } from '../content/types';
import { publicContentRepository } from '../content/apiRepository';
import { articleRobotsForReviewStatus } from '../content/articleReview';
import { AeoFaqList, RelatedCaseStudies, VerifiedExperts } from '../components/content/AeoContent';

const buildSchema = (page: SeoPageConfig, author?: Expert, reviewer?: Expert, experts: Expert[] = [], cases: CaseStudy[] = []) => {
  const ids = entityIds(page.canonical);
  const expertNodes = experts.map((expert, index) => buildPersonSchema(expert, `${page.canonical}#expert-${index + 1}`));
  const caseUrls = cases.map((item) => `${company.siteUrl}/cases/${item.slug}`);
  const primary = page.type === 'article'
    ? buildArticleSchema({ canonical: page.canonical, headline: page.h1, description: page.description, datePublished: page.datePublished!, dateModified: page.lastmod, image: `${company.siteUrl}${page.image || '/og-cover.jpg'}`, authorId: author ? ids.author : undefined, reviewerId: reviewer ? ids.reviewer : undefined, caseUrls })
    : page.type === 'service-city' || page.type === 'service'
      ? buildServiceEntity({ canonical: page.canonical, name: page.h1, description: page.description, serviceType: page.service, areaServed: page.cityNominative ?? page.city, expertIds: expertNodes.map((node) => String(node['@id'])), caseUrls })
      : undefined;
  return [
    ...buildCorePageEntities({ canonical: page.canonical, name: page.h1, description: page.description, dateModified: page.lastmod, localBusiness: (page.cityNominative ?? page.city) === 'Шымкент' }),
    ...(primary ? [primary] : []),
    ...(author ? [buildPersonSchema(author, ids.author)] : []),
    ...(reviewer ? [buildPersonSchema(reviewer, ids.reviewer)] : []),
    ...expertNodes,
    buildBreadcrumbSchema(page.breadcrumbs.map((item) => ({ name: item.label, url: item.path })), page.canonical),
  ];
};

const ListBlock = ({ title, items }: { title: string; items: string[] }) => (
  <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-2xl font-bold text-eco-900">{title}</h2>
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
          <CheckCircle2 className="mt-0.5 shrink-0 text-eco-600" size={18} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </section>
);

const SeoLandingPage = ({ slug: slugProp }: { slug?: string }) => {
  const { seoSlug } = useParams();
  const { pathname } = useLocation();
  const slug = slugProp || (pathname === '/kk' ? 'kk/' : pathname.startsWith('/kk/') ? pathname.replace(/^\//, '') : seoSlug) || '';
  const page = seoPageMap.get(slug);
  const { data: apiExperts = [] } = useQuery({
    queryKey: ['public-content', 'experts'],
    queryFn: () => publicContentRepository.getExperts(),
    initialData: import.meta.env.DEV ? experts : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(page),
  });
  const { data: apiCases = [] } = useQuery({ queryKey: ['public-content', 'cases'], queryFn: () => publicContentRepository.getCases(), staleTime: 5 * 60 * 1000, enabled: Boolean(page) });
  if (!page) return <NotFoundPage />;

  const isKk = page.locale === 'kk';
  const alternates = page.alternatePath ? [
    { locale: 'ru-KZ' as const, url: isKk ? page.alternatePath : `/${page.slug}` },
    { locale: 'kk-KZ' as const, url: isKk ? `/${page.slug}` : page.alternatePath },
    { locale: 'x-default' as const, url: isKk ? page.alternatePath : `/${page.slug}` },
  ] : [];

  const whatsAppUrl = getWhatsAppUrl(isKk ? `Сәлеметсіз бе! ${page.h1} қызметі бойынша кеңес алғым келеді.` : `Здравствуйте! Хочу получить консультацию: ${page.h1}.`);
  const services = page.services ?? [];
  const audience = page.audience ?? [];
  const outcomes = page.outcomes ?? [];
  const regionDetails = page.type === 'city' ? regionContentMap.get(page.slug.replace('ecologicheskie-uslugi-', '')) : undefined;
  const backendExpertMap = new Map(apiExperts.map((expert) => [expert.id, expert]));
  const authorCandidate = page.author ?? (page.authorSlug ? backendExpertMap.get(page.authorSlug) ?? expertMap.get(page.authorSlug) : undefined);
  const reviewerCandidate = page.reviewer ?? (page.reviewerSlug ? backendExpertMap.get(page.reviewerSlug) ?? expertMap.get(page.reviewerSlug) : undefined);
  const articleAuthor = isCompleteExpert(authorCandidate) ? authorCandidate : undefined;
  const articleReviewer = isCompleteExpert(reviewerCandidate) ? reviewerCandidate : undefined;
  const approvedArticleAuthor = page.reviewStatus === 'approved' ? articleAuthor : undefined;
  const approvedArticleReviewer = page.reviewStatus === 'approved' ? articleReviewer : undefined;
  const relatedCases = apiCases.filter((item) => (!page.serviceSlug || item.service === page.serviceSlug) && (!page.cityNominative || item.city === page.cityNominative));
  const robots = page.type === 'article'
    ? articleRobotsForReviewStatus(page.reviewStatus)
    : page.indexable === false ? 'noindex,follow' : 'index,follow';
  const startText = isKk
    ? 'Нысан мен қолда бар құжаттарды тексеріп, қызметтің қолданылуын, жұмыс құрамын, мерзімін және нысанға шығу қажеттілігін түсіндіреміз.'
    : page.type === 'service-city'
    ? `Проверим задачу «${page.service}» для объекта в ${page.cityPrepositional}: исходные документы, применимость требований, состав результата и необходимость выезда. После аудита дадим перечень недостающих данных и расчёт этапов.`
    : page.type === 'city'
      ? `Разберём деятельность объекта в ${page.cityPrepositional}, сопоставим её с экологическими документами, ПЭК, лабораторными исследованиями и обращением с отходами. Вы получите приоритетный план работ.`
      : 'Проверим объект, исходные документы и применимые требования. После консультации подготовим расчёт стоимости и понятный план работ.';
  const trustPoints = isKk
    ? ['талаптарды нақты нысан бойынша тексереміз', 'жұмыс құрамын басталғанға дейін бекітеміз', 'расталмаған мерзім мен нәтижені уәде етпейміз', 'бастапқы деректер мен келесі қадамды көрсетеміз']
    : page.type === 'service-city'
    ? [
      `учитываем отрасли и условия работы для ${page.cityGenitive}`,
      `фиксируем состав услуги «${page.service}» до начала работ`,
      'не обещаем выезд и срок до проверки адреса и исходных данных',
      'передаём результат, реестр исходных данных и следующий обязательный шаг',
    ]
    : [
      'работаем по Казахстану и ведём документальные этапы дистанционно',
      'объединяем проектирование, замеры, ПЭК и документы по отходам',
      'проверяем применимость требований к фактической деятельности',
      'объясняем состав результата, сроки и следующий шаг',
    ];

  return (
    <div className="bg-[#F7FBFD]">
      <SEO title={page.title} description={page.description} canonical={page.canonical} robots={robots} locale={page.locale || 'ru'} alternates={alternates} type={page.type === 'article' ? 'article' : 'website'} schema={buildSchema(page, approvedArticleAuthor, approvedArticleReviewer, apiExperts, relatedCases)} datePublished={page.datePublished} dateModified={page.lastmod} />

      <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20">
        <ResponsiveImage fill priority sizes="100vw" src={page.image || '/para.jpg'} alt={page.h1} width={1600} height={900} wrapperClassName="-z-20" className="object-cover" />
        <div className="absolute inset-0 -z-10 bg-eco-900/84" />
        <div className="mx-auto max-w-7xl">
          <nav className="flex flex-wrap gap-2 text-sm text-white/72" aria-label={isKk ? 'Навигациялық тізбек' : 'Хлебные крошки'}>
            {page.breadcrumbs.map((item, index) => (
              <span key={item.path} className="inline-flex items-center gap-2">
                {index > 0 && <span>/</span>}
                <Link to={item.path} className="hover:text-white">{item.label}</Link>
              </span>
            ))}
          </nav>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.08fr_0.72fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">{page.city || page.service || 'ECOPROGRESS'}</p>
              <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-5xl">{page.h1}</h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/84">{page.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="bg-accent px-6 py-4 text-eco-900 hover:bg-accent/90"><a href="#lead-form">{isKk ? 'Кеңес алу' : 'Получить консультацию'}</a></Button>
                <Button asChild variant="secondary" className="gap-2 border-white/30 bg-white/10 px-6 py-4 text-white hover:bg-white/18">
                  <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle size={18} /> {isKk ? 'WhatsApp арқылы жазу' : 'Написать в WhatsApp'}
                  </a>
                </Button>
              </div>
            </div>
            <div className="rounded-[8px] border border-white/15 bg-white/10 p-6 backdrop-blur">
              <ShieldCheck className="text-accent" size={34} />
              <h2 className="mt-5 text-2xl font-bold">{isKk ? 'Жұмысты неден бастаймыз' : 'Что сделаем на старте'}</h2>
              <p className="mt-4 text-sm leading-6 text-white/75">
                {startText}
              </p>
            </div>
          </div>
        </div>
      </section>

      {(services.length || audience.length || outcomes.length) && (
        <section className="px-4 py-14 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
            {services.length > 0 && (
              <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-eco-900">{isKk ? 'Қызметке не кіреді' : 'Что входит в услугу'}</h2>
                <div className="mt-5 grid gap-2">
                  {services.map((item) => <Link key={item.path} to={item.path} className="rounded-2xl bg-eco-50 px-4 py-3 text-sm font-semibold text-eco-900 hover:bg-eco-100">{item.label}</Link>)}
                </div>
              </section>
            )}
            {audience.length > 0 && <ListBlock title={isKk ? 'Кімге арналған' : 'Для каких объектов'} items={audience} />}
            {outcomes.length > 0 && <ListBlock title={isKk ? 'Клиент не алады' : 'Что получает клиент'} items={outcomes} />}
          </div>
        </section>
      )}

      <section className="bg-white px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-2">
            {page.sections.map((section) => (
              <article key={section.title} className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-eco-900">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {page.type === 'article' && (
        <section className="px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <ArticleSources sources={page.sources ?? []} />
            <div className="grid gap-4 md:grid-cols-2">
              {articleAuthor ? <ArticleAuthorCard expert={articleAuthor} /> : <ArticleOrganizationAuthorCard />}
              <ArticleReviewerCard expert={articleReviewer} />
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <p>Дата публикации: <time dateTime={page.datePublished}>{page.datePublished}</time></p>
              <p className="mt-2">Последняя экспертная проверка: {page.lastReviewedAt ? <time dateTime={page.lastReviewedAt}>{page.lastReviewedAt}</time> : 'не завершена'}</p>
            </div>
          </div>
        </section>
      )}

      {regionDetails && <section className="px-4 py-14 sm:px-8"><div className="mx-auto max-w-7xl space-y-12">
        <section className="rounded-[22px] border border-slate-200 bg-white p-6"><h2 className="text-3xl font-bold text-eco-900">Условия работы в регионе</h2><p className="mt-4 leading-7 text-slate-600">{regionDetails.introduction}</p><p className="mt-4 text-sm leading-6 text-slate-600"><strong>Логистика:</strong> {regionDetails.logisticsNote}</p>{regionDetails.estimatedTimeline && <p className="mt-4 text-sm leading-6 text-slate-600"><strong>Сроки:</strong> {regionDetails.estimatedTimeline}</p>}</section>
        <div className="grid gap-5 lg:grid-cols-2">{regionDetails.regionalFeatures?.length ? <ListBlock title="Особенности региона" items={regionDetails.regionalFeatures} /> : null}<ListBlock title="Что делаем дистанционно" items={regionDetails.remoteConditions} /><ListBlock title="Когда нужен выезд" items={regionDetails.onSiteConditions} /><ListBlock title="Типовые задачи" items={regionDetails.commonTasks} /><ListBlock title="Отрасли региона" items={regionDetails.industries} />{regionDetails.completedWorkExamples?.length ? <ListBlock title="Примеры выполненных работ" items={regionDetails.completedWorkExamples} /> : null}</div>
        <RelatedServices slugs={regionDetails.availableServiceSlugs} title="Доступные услуги" />
        {regionDetails.relatedArticleSlugs.length > 0 && <RelatedArticles slugs={regionDetails.relatedArticleSlugs} />}
      </div></section>}

      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-eco-900">{isKk ? 'EcoProgress жұмыс қағидалары' : 'Почему выбирают ECOPROGRESS'}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {trustPoints.map((item) => (
                <div key={item} className="rounded-[8px] bg-eco-50 p-4 text-sm font-semibold leading-6 text-eco-900">{item}</div>
              ))}
            </div>
          </div>
          <div id="lead-form">
            <div className="mb-5 rounded-[8px] border border-eco-200 bg-eco-50 p-5">
              <h2 className="text-2xl font-bold text-eco-900">{page.ctaTitle || (isKk ? 'Құнын есептеу' : 'Заказать расчет стоимости')}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{page.ctaText || (isKk ? 'Нысан мен қолда бар құжаттарды сипаттаңыз.' : 'Опишите объект и текущие документы — специалист уточнит состав, сроки и порядок работы.')}</p>
            </div>
            <LeadForm
              source={`seo_${page.slug}`}
              sourcePage={`/${page.slug}`}
              serviceSlug={page.serviceSlug}
              defaultService={page.service || 'Экологические услуги'}
              locale={isKk ? 'kk' : 'ru'}
              title={isKk ? 'Өтінім қалдыру' : 'Получить расчёт'}
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold text-eco-900">{isKk ? 'Жиі қойылатын сұрақтар' : 'Частые вопросы'}</h2>
          <AeoFaqList faq={page.faq} />
              {(page.type === 'city' || page.type === 'service-city') && <div className="mt-14"><RelatedCaseStudies service={page.type === 'service-city' ? page.serviceSlug : undefined} city={page.cityNominative ?? page.city} /></div>}
              {(page.type === 'city' || page.type === 'service-city') && <div className="mt-14"><VerifiedExperts /></div>}
        </div>
      </section>

      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-eco-900">{isKk ? 'Пайдалы сілтемелер' : 'Полезные ссылки'}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {page.relatedLinks.map((item) => (
              <Link key={item.path} to={item.path} className="group rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-eco-300">
                <FileText className="text-eco-600" size={24} />
                <h3 className="mt-4 font-bold text-eco-900 group-hover:text-eco-600">{item.label}</h3>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-eco-700">{isKk ? 'Ашу' : 'Открыть'} <ArrowRight size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SeoLandingPage;
