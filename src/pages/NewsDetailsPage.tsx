import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { company, getWhatsAppUrl } from '../config/company';
import type { SeoArticleConfig } from '../data/seoArticles';
import { buildArticleSchema, buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema, entityIds } from '../seo/entityBuilders';
import { normalizeArticleDates } from '../utils/articleDates';
import { expertMap, experts, isPublishableExpert } from '../content/experts/experts';
import { ArticleAuthorCard, ArticleChecklist, ArticleOrganizationAuthorCard, ArticleReviewerCard, ArticleSources, ArticleTableOfContents, ArticleWarning, ContentLastUpdated, RelatedArticles, RelatedServices } from '../components/content/ContentBlocks';
import { normalizeArticleSlug } from '../content/articles/articleSlugs';
import { publicContentRepository } from '../content/apiRepository';
import type { ArticleContent } from '../content/types';
import { isArticleApproved, isArticleIndexable } from '../content/articleReview';
import { AeoFaqList, RelatedCaseStudies, VerifiedExperts } from '../components/content/AeoContent';
import { articleContentMap } from '../content/articles/articleContent';
import { getArticleImage } from '../data/pageHeroImages';

const toSeoArticle = (article: ArticleContent): SeoArticleConfig => ({
  id: article.slug,
  slug: `/news/${article.slug}`,
  title: article.title,
  description: article.description,
  h1: article.title,
  excerpt: article.excerpt,
  shortAnswer: article.shortAnswer,
  intent: article.intent,
  targetAudience: article.targetAudience,
  category: 'Полезные материалы',
  datePublished: article.datePublished,
  dateModified: article.dateModified,
  image: article.heroImage || '/og-cover.jpg',
  imageAlt: article.heroImageAlt,
  tableOfContents: article.tableOfContents,
  authorSlug: article.authorSlug,
  reviewerSlug: article.reviewerSlug,
  author: article.author,
  reviewer: article.reviewer,
  lastReviewedAt: article.lastReviewedAt,
  reviewStatus: article.reviewStatus,
  relatedServiceSlugs: article.relatedServiceSlugs,
  relatedArticleSlugs: article.relatedArticleSlugs,
  sources: article.sources,
  sections: article.sections.map((section) => ({ ...section, body: section.paragraphs.join(' ') })),
  faq: article.faq,
  relatedLinks: [],
});

const NewsDetailsPage = () => {
  const { id } = useParams();
  const canonicalId = id ? normalizeArticleSlug(id) : '';
  const staticContent = articleContentMap.get(canonicalId);
  const { data: apiContent, isLoading, isError } = useQuery({
    queryKey: ['public-content', 'article', canonicalId],
    queryFn: () => publicContentRepository.getArticleBySlug(canonicalId),
    enabled: Boolean(canonicalId),
    initialData: staticContent,
    staleTime: 5 * 60 * 1000,
  });
  const { data: apiExperts = [] } = useQuery({
    queryKey: ['public-content', 'experts'],
    queryFn: () => publicContentRepository.getExperts(),
    initialData: experts,
    staleTime: 5 * 60 * 1000,
  });
  const item = apiContent ? toSeoArticle(apiContent) : undefined;

  if (id && canonicalId !== id) return <Navigate to={`/news/${canonicalId}`} replace />;

  if (isLoading) return <div className="bg-eco-50 px-5 py-20 text-center text-slate-600">Загрузка статьи…</div>;

  if (isError && !item) return <div className="bg-eco-50 px-5 py-20 text-center text-rose-800">Не удалось загрузить статью с сервера.</div>;

  if (!item) {
    return (
      <div className="bg-eco-50 px-5 py-20">
        <SEO title="Новость не найдена | ECOPROGRESS" description="Материал не найден или был снят с публикации." robots="noindex,follow" />
        <div className="mx-auto max-w-3xl rounded-[24px] bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-eco-900">Новость не найдена</h1>
          <p className="mt-3 text-slate-600">Материал мог быть снят с публикации или ссылка устарела.</p>
          <Link to="/news" className="mt-6 inline-flex rounded-full bg-eco-800 px-5 py-3 text-sm font-semibold text-white">
            Вернуться к статьям
          </Link>
        </div>
      </div>
    );
  }

  const canonical = `${company.siteUrl}${item.slug}`;
  const heroImage = getArticleImage(item.id, item.image);
  const dates = normalizeArticleDates(item.datePublished, item.dateModified);
  const backendExpertMap = new Map(apiExperts.map((expert) => [expert.id, expert]));
  const approvalExpertMap = new Map([...expertMap, ...backendExpertMap]);
  const approved = isArticleApproved(apiContent, approvalExpertMap);
  const indexable = isArticleIndexable(apiContent);
  const authorCandidate = item.author ?? backendExpertMap.get(item.authorSlug) ?? expertMap.get(item.authorSlug);
  const reviewerCandidate = item.reviewer ?? (item.reviewerSlug ? backendExpertMap.get(item.reviewerSlug) ?? expertMap.get(item.reviewerSlug) : undefined);
  const author = isPublishableExpert(authorCandidate) ? authorCandidate : undefined;
  const reviewer = approved && isPublishableExpert(reviewerCandidate) ? reviewerCandidate : undefined;
  const authorId = approved && author ? entityIds(canonical).author : undefined;
  const reviewerId = approved && reviewer ? entityIds(canonical).reviewer : undefined;
  const schema = [
    ...buildCorePageEntities({ canonical, name: item.h1, description: item.description, dateModified: dates.dateModified }),
    buildArticleSchema({ headline: item.h1, description: item.description, image: `${company.siteUrl}${heroImage}`, datePublished: dates.datePublished, dateModified: dates.dateModified, canonical, authorId, reviewerId }),
    ...(authorId && author ? [buildPersonSchema(author, authorId)] : []),
    ...(reviewerId && reviewer ? [buildPersonSchema(reviewer, reviewerId)] : []),
    buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Статьи', url: `${company.siteUrl}/news` }, { name: item.h1, url: canonical }]),
  ];
  const reviewedAtLabel = approved && item.lastReviewedAt
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC' }).format(new Date(item.lastReviewedAt))
    : undefined;

  return (
    <article className="bg-white">
      <SEO title={`${item.title} | ECOPROGRESS`} description={item.description} canonical={canonical} robots={indexable ? 'index,follow' : 'noindex,follow'} type="article" schema={schema} datePublished={dates.datePublished} dateModified={dates.dateModified} />
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <ResponsiveImage fill sizes="100vw" src={heroImage} alt={item.imageAlt} priority width={1600} height={900} className="object-cover" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto max-w-4xl">
          <nav className="flex flex-wrap gap-2 text-sm text-white/72" aria-label="Хлебные крошки">
            <Link to="/" className="hover:text-white">Главная</Link><span>/</span><Link to="/news" className="hover:text-white">Статьи</Link>
          </nav>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-eco-200">{item.category} · {item.datePublished}</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">{item.h1}</h1>
          <p className="mt-5 text-lg leading-8 text-white/80">{item.description}</p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 py-14 text-lg leading-8 text-slate-700 sm:px-8">
        <aside className="mb-8 rounded-[22px] border border-eco-200 bg-eco-50 p-6"><p className="text-sm font-bold uppercase tracking-wide text-eco-600">Короткий ответ</p><p className="mt-3 leading-8 text-eco-950">{item.shortAnswer}</p></aside>
        {item.tableOfContents && <div className="mb-10"><ArticleTableOfContents sections={item.sections} /></div>}
        {item.sections.map((section) => (
          <section id={section.id} key={section.id} className="mb-10 scroll-mt-24">
            <h2 className="text-2xl font-bold text-eco-900">{section.title}</h2>
            <div className="mt-3 space-y-4">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            {section.table && (
              <div className="relative left-1/2 mt-8 w-[calc(100vw-2rem)] max-w-[1120px] -translate-x-1/2 overflow-x-auto rounded-[16px] border border-slate-200 bg-white shadow-sm sm:w-[calc(100vw-4rem)]">
                <table className="w-full min-w-[980px] border-collapse text-left text-[15px] leading-6">
                  {section.table.caption && <caption className="border-b bg-eco-50 px-5 py-4 text-left font-semibold text-eco-950">{section.table.caption}</caption>}
                  <thead className="bg-slate-100 text-eco-950">
                    <tr>{section.table.headers.map((header) => <th key={header} scope="col" className="border-r border-slate-200 px-5 py-4 align-top last:border-r-0">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, rowIndex) => (
                      <tr key={`${section.id}-row-${rowIndex}`} className="border-t border-slate-200 even:bg-slate-50/70">
                        {row.cells.map((cell, cellIndex) => cellIndex === 0
                          ? <th key={`${section.id}-${rowIndex}-${cellIndex}`} scope="row" className="w-44 whitespace-pre-line border-r border-slate-200 px-5 py-5 align-top font-bold text-eco-950">{cell}</th>
                          : <td key={`${section.id}-${rowIndex}-${cellIndex}`} className="whitespace-pre-line border-r border-slate-200 px-5 py-5 align-top last:border-r-0">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.bullets && <ul className="mt-5 list-disc space-y-2 pl-6">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
            {section.checklist && <div className="mt-5"><ArticleChecklist items={section.checklist} /></div>}
            {section.warning && <div className="mt-5"><ArticleWarning>{section.warning}</ArticleWarning></div>}
          </section>
        ))}
        <section className="mt-12 rounded-[8px] bg-eco-900 p-6 text-white">
          <h2 className="text-2xl font-bold">Нужна консультация по экологии?</h2>
          <p className="mt-3 text-base leading-7 text-white/75">Отправьте город, объект и вопрос. Специалист подскажет документы, сроки и следующий шаг.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-accent text-eco-900 hover:bg-accent/90"><Link to="/contacts">Получить консультацию эколога</Link></Button>
            <a href={getWhatsAppUrl(`Здравствуйте! Хочу консультацию по статье: ${item.h1}`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              <MessageCircle size={18} /> WhatsApp
            </a>
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-eco-900">Частые вопросы</h2>
          <AeoFaqList faq={item.faq} />
        </section>
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-eco-900">Полезные ссылки</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {item.relatedLinks.map((link) => (
              <Link key={link.path} to={link.path} className="rounded-full border border-eco-200 bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800 hover:bg-eco-100">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
        <div className="mt-12 space-y-8">
          {item.relatedServiceSlugs.length > 0 && <RelatedServices slugs={item.relatedServiceSlugs} title="Услуги по теме материала" />}
          {item.relatedArticleSlugs.length > 0 && <RelatedArticles slugs={item.relatedArticleSlugs} />}
          <ArticleSources sources={item.sources} />
          <div className="grid gap-4 md:grid-cols-2">{author ? <ArticleAuthorCard expert={author} /> : <ArticleOrganizationAuthorCard />}<ArticleReviewerCard expert={reviewer} /></div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 text-sm text-slate-600">
            <p>Дата публикации: <time dateTime={dates.datePublished}>{dates.datePublished}</time></p>
            <p className="mt-2">Последняя экспертная проверка: {approved && item.lastReviewedAt ? <time dateTime={item.lastReviewedAt}>{reviewedAtLabel}</time> : 'не завершена'}</p>
          </div>
          <ContentLastUpdated date={dates.dateModified} requiresReview={!approved} />
          <VerifiedExperts />
          <RelatedCaseStudies service={item.relatedServiceSlugs[0]} />
        </div>
      </section>
    </article>
  );
};

export default NewsDetailsPage;
