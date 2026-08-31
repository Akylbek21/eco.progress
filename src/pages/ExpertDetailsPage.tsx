import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { company } from '../config/company';
import { articleContent } from '../content/articles/articleContent';
import { isArticleApproved } from '../content/articleReview';
import { publishedCaseStudies } from '../content/cases/caseStudies';
import { expertMap, expertProfileMap, isExpertWithCredentials } from '../content/experts/experts';
import { buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema } from '../seo/entityBuilders';

const ExpertDetailsPage = () => {
  const { id = '' } = useParams();
  const expert = expertProfileMap.get(`/experts/${id}`) ?? expertMap.get(id);
  if (!isExpertWithCredentials(expert)) return <main className="px-5 py-20 text-center"><SEO title="Эксперт не найден | ECOPROGRESS" description="Публичный подтверждённый профиль не найден." robots="noindex,follow" /><h1 className="text-3xl font-bold text-eco-900">Эксперт не найден</h1></main>;

  const canonical = `${company.siteUrl}${expert.profileUrl}`;
  const reviewedArticles = articleContent.filter((article) => article.reviewerSlug === expert.id && isArticleApproved(article));
  const relatedCases = publishedCaseStudies.filter((item) => item.expert.id === expert.id || item.reviewer?.id === expert.id);
  const description = `${expert.fullName}: подтверждённое обучение и компетенции — ${expert.specialization.join(', ')}.`;
  return <main className="bg-eco-50">
    <SEO title={`${expert.fullName} — эксперт ECOPROGRESS`} description={description} canonical={canonical} schema={[
      ...buildCorePageEntities({ canonical, name: expert.fullName, description }),
      buildPersonSchema(expert, `${canonical}#person`),
      buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Эксперты', url: `${company.siteUrl}/experts` }, { name: expert.fullName, url: canonical }]),
    ]} />
    <article className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <p className="font-semibold uppercase tracking-wide text-eco-600">Подтверждённый эксперт</p>
      <h1 className="mt-3 text-4xl font-bold text-eco-900 sm:text-5xl">{expert.fullName}</h1>
      <p className="mt-6 text-lg leading-8 text-slate-700">Компетенции: {expert.specialization.join(' · ')}</p>

      <section className="mt-12"><h2 className="text-3xl font-bold text-eco-900">Подтверждённое обучение и документы</h2>
        <div className="mt-6 space-y-5">{expert.credentials.map((item) => <div key={`${item.title}-${item.number ?? item.date}`} className="rounded-[22px] border border-slate-200 bg-white p-6">
          <h3 className="text-xl font-bold text-eco-900">{item.title}</h3>
          <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div><dt className="font-semibold">Документ</dt><dd>{item.document}</dd></div>
            <div><dt className="font-semibold">Выдан</dt><dd>{item.issuedBy}</dd></div>
            <div><dt className="font-semibold">Дата</dt><dd>{item.date}{item.location ? `, ${item.location}` : ''}</dd></div>
            {(item.hours || item.number) && <div><dt className="font-semibold">Объём / номер</dt><dd>{item.hours ? `${item.hours} часов` : ''}{item.hours && item.number ? ', ' : ''}{item.number ? `№ ${item.number}` : ''}</dd></div>}
          </dl>
        </div>)}</div>
      </section>

      <section className="mt-12"><h2 className="text-3xl font-bold text-eco-900">Проверенные статьи</h2>{reviewedArticles.length ? <ul className="mt-5 space-y-3">{reviewedArticles.map((item) => <li key={item.slug}><Link className="font-semibold text-eco-700 underline" to={`/news/${item.slug}`}>{item.title}</Link></li>)}</ul> : <p className="mt-4 text-slate-600">Подтверждённых рецензий пока нет.</p>}</section>
      <section className="mt-12"><h2 className="text-3xl font-bold text-eco-900">Опубликованные кейсы</h2>{relatedCases.length ? <ul className="mt-5 space-y-3">{relatedCases.map((item) => <li key={item.slug}><Link className="font-semibold text-eco-700 underline" to={`/cases/${item.slug}`}>{item.title}</Link></li>)}</ul> : <p className="mt-4 text-slate-600">Подтверждённых опубликованных кейсов пока нет.</p>}</section>
      <Link to="/experts" className="mt-12 inline-flex font-semibold text-eco-700 underline">Все эксперты</Link>
    </article>
  </main>;
};

export default ExpertDetailsPage;
