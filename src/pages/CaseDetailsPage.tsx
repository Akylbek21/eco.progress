import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SEO from '../components/SEO';
import { company } from '../config/company';
import { publicContentRepository } from '../content/apiRepository';
import { isPublishableCaseStudy } from '../content/cases/caseStudyPolicy';
import { buildBreadcrumbSchema, buildOrganizationSchema, buildPersonSchema } from '../utils/schema';
import { ArticleAuthorCard, ArticleReviewerCard } from '../components/content/ContentBlocks';

const CaseDetailsPage = () => {
  const { slug = '' } = useParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ['public-content', 'case', slug], queryFn: () => publicContentRepository.getCaseBySlug(slug), enabled: Boolean(slug), staleTime: 5 * 60 * 1000 });
  if (isLoading) return <div className="px-5 py-20 text-center text-slate-600">Загрузка кейса…</div>;
  if (isError || !data || !isPublishableCaseStudy(data)) return <main className="px-5 py-20 text-center"><SEO title="Кейс не найден | ECOPROGRESS" description="Кейс не опубликован или не прошёл проверку." robots="noindex,follow" /><h1 className="text-3xl font-bold text-eco-900">Кейс не найден</h1><p className="mt-3 text-slate-600">Материал не опубликован или ещё проходит проверку.</p><Link to="/cases" className="mt-6 inline-flex font-semibold text-eco-700 underline">Вернуться к кейсам</Link></main>;

  const item = data;
  const canonical = `${company.siteUrl}/cases/${item.slug}`;
  const authorId = `${canonical}#person`;
  const reviewerId = `${canonical}#person-reviewer`;
  const schema = [
    buildOrganizationSchema(),
    { '@context': 'https://schema.org', '@type': 'Article', headline: item.title, description: item.problem, url: canonical, datePublished: item.publishedAt, dateModified: item.updatedAt, author: { '@id': authorId }, reviewedBy: { '@id': reviewerId }, about: { '@id': `${canonical}#service` } },
    { '@context': 'https://schema.org', '@type': 'Service', '@id': `${canonical}#service`, name: item.service, areaServed: { '@type': 'City', name: item.city } },
    buildPersonSchema(item.expert, authorId), buildPersonSchema(item.reviewer, reviewerId),
    buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Кейсы', url: `${company.siteUrl}/cases` }, { name: item.title, url: canonical }]),
  ];
  const client = item.clientAnonymous ? `Промышленное предприятие, ${item.city}` : item.clientName;
  return <article className="bg-white">
    <SEO title={`${item.title} | ECOPROGRESS`} description={item.problem} canonical={canonical} type="article" schema={schema} datePublished={item.publishedAt} dateModified={item.updatedAt} />
    <header className="bg-eco-900 px-5 py-16 text-white sm:px-8"><div className="mx-auto max-w-5xl"><nav className="text-sm text-white/70"><Link to="/">Главная</Link> / <Link to="/cases">Кейсы</Link></nav><p className="mt-8 text-sm font-bold uppercase tracking-wide text-accent">{item.service} · {item.city}</p><h1 className="mt-4 text-4xl font-bold sm:text-5xl">{item.title}</h1><p className="mt-5 text-white/75">Клиент: {client}</p></div></header>
    <div className="mx-auto max-w-5xl space-y-10 px-5 py-14 sm:px-8">
      <CaseSection title="Задача" text={item.problem} />
      <CaseSection title="Исходные данные" text={item.initialData} />
      <CaseSection title="Характеристика объекта" text={`${item.objectType}. Категория объекта: ${item.objectCategory}. Отрасль: ${item.industry}. Регион: ${item.region}.`} />
      <section><h2 className="text-3xl font-bold text-eco-900">Что сделали</h2><ul className="mt-5 list-disc space-y-3 pl-6 text-slate-700">{item.workPerformed.map((work) => <li key={work}>{work}</li>)}</ul></section>
      <section><h2 className="text-3xl font-bold text-eco-900">Какие нормативы использовали</h2><ul className="mt-5 space-y-3">{item.regulations.map((regulation) => <li key={regulation.title}>{regulation.url ? <a href={regulation.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-eco-700 underline">{regulation.title}</a> : regulation.title}</li>)}</ul></section>
      <CaseSection title="Результат" text={item.result} />
      <CaseSection title="Срок выполнения" text={`Работа завершена ${item.completedAt}. Опубликованный кейс не дополняется неподтверждёнными сроками.`} />
      <section><h2 className="text-3xl font-bold text-eco-900">Специалист и проверка</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><ArticleAuthorCard expert={item.expert} /><ArticleReviewerCard expert={item.reviewer} /></div></section>
    </div>
  </article>;
};

const CaseSection = ({ title, text }: { title: string; text: string }) => <section><h2 className="text-3xl font-bold text-eco-900">{title}</h2><p className="mt-4 leading-8 text-slate-700">{text}</p></section>;

export default CaseDetailsPage;
