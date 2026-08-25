import fs from 'node:fs';
import path from 'node:path';
import { LASTMOD, OG_IMAGE, SITE_URL, publicStaticPages, seoArticles, seoPages } from './seo-data.mjs';
import { COMPANY } from '../src/config/companyData.ts';
import { activeServices, formatKztPrice, PRELIMINARY_PRICE_NOTICE } from '../src/content/serviceCatalog.ts';
import { serviceContentMap } from '../src/content/services/serviceContent.ts';
import { aboutPublicContent } from '../src/content/aboutPublicContent.ts';
import { expertMap, experts, isCompleteExpert } from '../src/content/experts/experts.ts';
import { caseStudies } from '../src/content/cases/caseStudies.ts';
import { isPublishableCaseStudy } from '../src/content/cases/caseStudyPolicy.ts';
import { createSchemaGraph } from '../src/seo/schemaGraph.ts';
import { buildArticleSchema, buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema, buildServiceEntity, entityIds } from '../src/seo/entityBuilders.ts';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const templatePath = path.join(distDir, 'index.html');
const whatsappUrl = 'https://wa.me/77771858088';
const verifiedExperts = experts.filter(isCompleteExpert);
const verifiedCases = caseStudies.filter(isPublishableCaseStudy);

if (!fs.existsSync(templatePath)) {
  throw new Error('dist/index.html not found. Run vite build before prerender.');
}

const rawTemplate = fs.readFileSync(templatePath, 'utf8');
const rootStart = rawTemplate.indexOf('<div id="root"');
const bodyEnd = rawTemplate.lastIndexOf('</body>');
const rootEnd = rawTemplate.lastIndexOf('</div>', bodyEnd);
if (rootStart < 0 || rootEnd < rootStart) throw new Error('dist/index.html does not contain the expected root markers');
const template = `${rawTemplate.slice(0, rootStart)}<div id="root"></div>${rawTemplate.slice(rootEnd + '</div>'.length)}`;
const seoRegistry = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'seoRegistry.generated.json'), 'utf8'));
const registryByPath = new Map(seoRegistry.map((entry) => [entry.path, entry]));

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const stripSeoHead = (html) => html
  .replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/\s*<meta\s+name=["']description["'][^>]*>\s*/gi, '')
  .replace(/\s*<meta\s+name=["']robots["'][^>]*>\s*/gi, '')
  .replace(/\s*<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
  .replace(/\s*<link\s+rel=["']alternate["'][^>]*>\s*/gi, '')
  .replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
  .replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
  .replace(/\s*<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>\s*/gi, '');

const articleExperts = (article) => {
  if (article.reviewStatus !== 'approved') return {};
  const authorCandidate = article.author || expertMap.get(article.authorSlug);
  const reviewerCandidate = article.reviewer || expertMap.get(article.reviewerSlug);
  return {
    author: isCompleteExpert(authorCandidate) ? authorCandidate : undefined,
    reviewer: isCompleteExpert(reviewerCandidate) ? reviewerCandidate : undefined,
  };
};

const articleSchemaNodes = (article, canonical, modified = article.dateModified || article.lastmod) => {
  const { author, reviewer } = articleExperts(article);
  const ids = entityIds(canonical);
  const authorId = author ? ids.author : undefined;
  const reviewerId = reviewer ? ids.reviewer : undefined;
  return [
    buildArticleSchema({ canonical, headline: article.h1, description: article.description, image: `${SITE_URL}${article.image || '/og-cover.jpg'}`, datePublished: article.datePublished, dateModified: modified, authorId, reviewerId }),
    ...(author ? [buildPersonSchema(author, authorId)] : []),
    ...(reviewer ? [buildPersonSchema(reviewer, reviewerId)] : []),
  ];
};

const schemaForSeoPage = (page) => [
  ...buildCorePageEntities({ canonical: page.canonical, name: page.h1, description: page.description, dateModified: page.lastmod || LASTMOD, localBusiness: page.cityNominative === 'Шымкент' }),
  ...(page.type === 'article'
    ? articleSchemaNodes(page, page.canonical, page.lastmod || LASTMOD)
    : page.type === 'service-city' || page.type === 'service'
    ? (() => {
      const expertNodes = verifiedExperts.map((expert, index) => buildPersonSchema(expert, `${page.canonical}#expert-${index + 1}`));
      const caseUrls = verifiedCases.filter((item) => !page.serviceSlug || item.service === page.serviceSlug).map((item) => `${SITE_URL}/cases/${item.slug}`);
      return [buildServiceEntity({ canonical: page.canonical, name: page.h1, description: page.description, image: `${SITE_URL}${page.image || '/og-cover.jpg'}`, areaServed: page.cityNominative || page.city || 'Казахстан', serviceType: page.service || 'Экологические услуги', expertIds: expertNodes.map((node) => node['@id']), caseUrls }), ...expertNodes];
    })()
    : []),
  buildBreadcrumbSchema(page.breadcrumbs.map((item) => ({ name: item.label, url: item.path })), page.canonical),
];

const schemaForArticle = (article) => [
  ...buildCorePageEntities({ canonical: `${SITE_URL}${article.slug}`, name: article.h1, description: article.description, dateModified: article.dateModified }),
  ...articleSchemaNodes(article, `${SITE_URL}${article.slug}`),
  buildBreadcrumbSchema([{ name: 'Главная', url: '/' }, { name: 'Статьи', url: '/news' }, { name: article.h1, url: article.slug }], `${SITE_URL}${article.slug}`),
];

const renderHeadBlock = ({ title, description, canonical, type = 'website', schema, robots = 'index,follow', locale = 'ru', alternates = [], ogImage = OG_IMAGE, ogImageWidth = 1200, ogImageHeight = 630, datePublished, dateModified }) => {
  const verification = process.env.VITE_GOOGLE_SITE_VERIFICATION
    ? `\n<meta name="google-site-verification" content="${escapeHtml(process.env.VITE_GOOGLE_SITE_VERIFICATION)}" />`
    : '\n<!-- Google Search Console: set VITE_GOOGLE_SITE_VERIFICATION to render verification meta. -->';

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    ...alternates.map((alternate) => `<link rel="alternate" hreflang="${escapeHtml(alternate.locale)}" href="${escapeHtml(alternate.url)}" />`),
    '<meta property="og:site_name" content="ECOPROGRESS GROUP" />',
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    `<meta property="og:image:width" content="${ogImageWidth}" />`,
    `<meta property="og:image:height" content="${ogImageHeight}" />`,
    `<meta property="og:locale" content="${locale === 'kk' ? 'kk_KZ' : 'ru_KZ'}" />`,
    ...(type === 'article' && datePublished ? [`<meta property="article:published_time" content="${escapeHtml(datePublished)}" />`, `<meta property="article:modified_time" content="${escapeHtml(dateModified || datePublished)}" />`] : []),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
    verification,
    `<script id="page-schema-json-ld" data-ecoprogress-schema="true" type="application/ld+json">${JSON.stringify(createSchemaGraph(schema, canonical))}</script>`,
  ].join('\n    ');
};

const pageShell = (meta, body) => {
  const clean = stripSeoHead(template);
  const headBlock = renderHeadBlock(meta);
  return clean
    .replace(/<html\s+lang=["'][^"']+["']/i, `<html lang="${meta.locale === 'kk' ? 'kk' : 'ru'}"`)
    .replace('</head>', `    ${headBlock}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${body}</div>`);
};

const renderLinks = (links = []) => links.map((item) => `<a href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a>`).join('');
const renderList = (items = []) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
const renderCards = (items = [], title = (item) => item.title, body = (item) => item.description) =>
  items.map((item) => `<article><h3>${escapeHtml(title(item))}</h3>${body(item) ? `<p>${escapeHtml(body(item))}</p>` : ''}</article>`).join('');
const renderVisibleFaq = (faq = [], locale = 'ru') => faq.map((item) => {
  const explanation = String(item.explanation || item.answer || '').trim();
  const shortAnswer = String(item.shortAnswer || explanation.match(/^.*?[.!?](?:\s|$)/)?.[0] || explanation).trim();
  return `<article><h3>${escapeHtml(item.question)}</h3><p><strong>${locale === 'kk' ? 'Қысқаша жауап' : 'Короткий ответ'}:</strong> ${escapeHtml(shortAnswer)}</p><p><strong>${locale === 'kk' ? 'Толығырақ' : 'Подробнее'}:</strong> ${escapeHtml(explanation)}</p></article>`;
}).join('');
const expertName = (slug) => expertMap.get(slug)?.fullName || 'Редакция EcoProgress';
const renderArticleTrust = (article) => `
  <section><h2>Официальные источники</h2><ul>${(article.sources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul></section>
  <aside><h2>Автор</h2><p>${escapeHtml(expertName(article.authorSlug))}</p></aside>
  <aside><h2>Экспертная проверка</h2><p>${article.reviewerSlug ? escapeHtml(expertName(article.reviewerSlug)) : 'Экспертная проверка не завершена'}</p></aside>
  <p>Дата публикации: <time datetime="${escapeHtml(article.datePublished || '')}">${escapeHtml(article.datePublished || '')}</time></p>
  <p>Последняя экспертная проверка: ${article.lastReviewedAt ? `<time datetime="${escapeHtml(article.lastReviewedAt)}">${escapeHtml(article.lastReviewedAt)}</time>` : 'не завершена'}</p>`;

const renderServicePage = (page) => {
  const slug = page.path.replace('/services/', '');
  const service = activeServices.find((item) => item.slug === slug);
  if (!service) return '';
  const content = serviceContentMap.get(slug);
  const faq = content?.faq || service.faq;
  const related = [...new Set([...(service.relatedServiceSlugs || []), ...(content?.relatedServices || [])])]
    .map((relatedSlug) => activeServices.find((item) => item.slug === relatedSlug))
    .filter(Boolean)
    .map((item) => ({ label: item.title, path: `/services/${item.slug}` }));
  const heroTitle = content?.hero.title || service.title;
  const heroText = content?.hero.subtitle || service.fullDescription;
  const summary = content?.summary;
  return `${layout(`<main class="seo-static-page">
    <nav class="seo-breadcrumbs">${renderLinks([{ label: 'Главная', path: '/' }, { label: 'Услуги', path: '/services' }, { label: service.title, path: page.path }])}</nav>
    <section><p>${escapeHtml(service.category)}</p><h1>${escapeHtml(heroTitle)}</h1><p>${escapeHtml(heroText)}</p><p><strong>${escapeHtml(formatKztPrice(service.pricing))}</strong></p><p>${escapeHtml(service.areaServed.description)}</p><p><a href="#lead">Оставить заявку</a> <a href="${whatsappUrl}">WhatsApp</a></p></section>
    ${content ? `<section><h2>Об услуге</h2><p>${escapeHtml(summary.shortDescription)}</p><p><strong>Результат для клиента:</strong> ${escapeHtml(summary.clientResult)}</p><p><strong>Срок:</strong> ${escapeHtml(summary.durationText)}</p><p><strong>Стоимость:</strong> ${escapeHtml(formatKztPrice(service.pricing))}</p><p>${escapeHtml(PRELIMINARY_PRICE_NOTICE)}</p><p><strong>Региональная доступность:</strong> ${escapeHtml(summary.availability)}</p></section>
    <section><h2>Когда требуется услуга</h2>${renderCards(content.whenRequired)}</section>
    <section><h2>Для кого подходит</h2>${renderCards(content.targetClients)}</section>
    <section><h2>Какие задачи решаем</h2>${renderCards(content.problemsSolved, (item) => `Задача: ${item.problem}`, (item) => `Решение: ${item.solution}`)}</section>
    <section><h2>Что получает клиент</h2>${renderCards(content.deliverables, (item) => item.title, (item) => `${item.description}${item.format ? ` Формат: ${item.format}.` : ''}`)}</section>
    <section><h2>Этапы работы</h2>${renderCards(content.workflow, (item) => `${item.order}. ${item.title}`, (item) => `${item.description}${item.result ? ` Результат этапа: ${item.result}.` : ''}`)}</section>
    <section><h2>Необходимые документы</h2>${renderCards(content.requiredDocuments, (item) => item.title, (item) => item.description || (item.required ? 'Обязательный исходный документ.' : 'Предоставляется при наличии.'))}</section>
    <section><h2>Что влияет на стоимость</h2>${renderCards(content.pricingFactors)}</section>
    <section><h2>Что не входит</h2>${renderList(content.notIncluded)}</section>
    <section><h2>Нормативная база</h2>${renderCards(content.legalBasis, (item) => `${item.title}${item.number ? ` ${item.number}` : ''}`, (item) => item.note)}</section>
    <section><h2>Риски и профилактика</h2>${renderCards(content.risks, (item) => item.risk, (item) => `Как снизить риск: ${item.prevention}`)}</section>` : `<section><h2>Кому нужна услуга</h2>${renderList(service.targetClients)}</section>
    <section><h2>Что входит и какой результат</h2>${renderList(service.deliverables)}</section>
    <section><h2>Необходимые документы</h2>${renderList(service.requiredDocuments)}</section>
    <section><h2>Этапы работы</h2>${renderCards(service.workflow)}</section>
    <section><h2>Сроки</h2><p>${escapeHtml(service.duration.text)}</p></section>
    <section><h2>Нормативная база</h2>${renderCards(service.legalBasis || [], (item) => item.title, (item) => item.documentNumber || '')}</section>`}
    <section><h2>Частые вопросы</h2>${renderVisibleFaq(faq)}</section>
    <section><h2>Связанные услуги</h2>${renderLinks(related)}</section>
    <section id="lead"><h2>Получить консультацию по услуге</h2><p>Опишите задачу, и специалист подскажет сроки, документы и порядок работы.</p><p><a href="/contacts">Оставить заявку</a> <a href="${whatsappUrl}">WhatsApp</a></p></section>
  </main>`)}`;
};

const renderAboutPage = (hero) => `${hero}
  <section><h2>Комплексные экологические услуги для бизнеса</h2>${[
    'Мы оказываем экологическое проектирование, лабораторные исследования и сопровождение бизнеса по Казахстану. Утилизация отходов доступна в Шымкенте, Таразе и Туркестане; сбор и транспортировка — в Шымкенте.',
    'В нашу деятельность входят разработка экологической документации, получение разрешений, производственный экологический контроль, лабораторные анализы воды, почвы и воздуха рабочей зоны, а также сопровождение проектов в уполномоченных органах.',
    'Компания работает с опасными и неопасными отходами, включая ТБО, производственные и промышленные отходы, нефтешлам, отработанные масла, химические отходы, строительные отходы, шины и РТИ.',
    'Наше преимущество — комплексный подход: консультация, подготовка документов, лабораторные протоколы, отчетность и сопровождение до согласованного результата.',
    'Наша цель — помогать бизнесу безопасно и законно выполнять экологические требования и минимизировать воздействие на окружающую среду.',
  ].map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</section>
  <section><h2>Объединённые усилия — чистое будущее</h2><p>ECOPROGRESS объединяет проектное, лабораторное и операционное направления, чтобы задачи клиента велись последовательно и прозрачно.</p></section>
  <section><h2>Чем мы занимаемся</h2>${renderCards([
    ['Экологическое проектирование', 'ОВОС, РООС, ПУО, ПЭК, НДВ, отчеты и разрешения.'], ['Лабораторные исследования', 'Анализы и замеры воды, воздуха, почвы и выбросов с протоколами.'],
    ['Транспортировка отходов', 'Вывоз отходов в доступном регионе с документальным сопровождением.'], ['Утилизация и переработка', 'Передача отходов на переработку, утилизацию или безопасное размещение.'],
    ['Полигон ТБО', 'Решения по законному размещению твердых бытовых отходов.'], ['Сопровождение бизнеса', 'Подготовка к проверкам, документы и снижение экологических рисков.'],
  ], (item) => item[0], (item) => item[1])}</section>
  <section><h2>Группа компаний ecoprogress.kz</h2>${renderCards([['Tumar Construction Group', 'Экологическое проектирование, лабораторный контроль и сопровождение предприятий.'], ['Tumar Partners', 'Полигон ТБО и услуги по законному размещению твердых бытовых отходов.'], ['EcoTrans', 'Транспортировка отходов и сопровождение вывоза.'], ['EcoAnalytics', 'Аналитика, лабораторные исследования и контроль экологических показателей.']], (item) => item[0], (item) => item[1])}</section>
  <section><h2>Почему нам доверяют</h2>${renderList(['Комплексный подход', 'Работа по требованиям Республики Казахстан', 'Лабораторные исследования', 'Документальное сопровождение', 'Безопасная транспортировка отходов', 'Ответственный подход к экологии'])}</section>
  <section><h2>Документы, сертификаты и разрешения</h2>${renderList(['Сертификаты специалистов', 'Разрешения на деятельность', 'Лабораторные протоколы', 'Документы по полигону', 'Документы по транспортировке отходов'])}<p><a href="/about#documents">Открыть опубликованные документы</a></p></section>
  <section><h2>Как мы работаем</h2>${renderList(['Вы оставляете заявку', 'Специалист уточняет задачу', 'Мы подбираем решение', 'Готовим документы или организуем услугу', 'Вы получаете результат и сопровождение'])}</section>
  <section><h2>Кому нужны услуги</h2>${renderList(aboutPublicContent.audience)}</section>
  <section><h2>Что входит в работу</h2>${renderList(aboutPublicContent.included)}</section>
  <section><h2>Необходимые документы</h2>${renderList(aboutPublicContent.documents)}</section>
  <section><h2>Этапы</h2>${renderList(aboutPublicContent.steps)}</section>
  <section><h2>Сроки</h2><p>${escapeHtml(aboutPublicContent.timing)}</p></section>
  <section><h2>Результат</h2><p>${escapeHtml(aboutPublicContent.result)}</p></section>
  <section><h2>Нормативная база</h2><p>${escapeHtml(aboutPublicContent.legalBasis)}</p></section>
  <section><h2>Частые вопросы</h2>${renderVisibleFaq(aboutPublicContent.faq)}</section>
  <section><h2>Связанные услуги и разделы</h2>${renderLinks(aboutPublicContent.relatedLinks)}</section>
  <section><h2>Нужна помощь с экологическими документами или отходами?</h2><p>Опишите объект и задачу — специалист подскажет следующий шаг.</p><p><a href="/contacts">Получить консультацию</a> <a href="${whatsappUrl}">WhatsApp</a></p></section>`;

const layout = (content, locale = 'ru') => locale === 'kk' ? `
<header class="seo-static-header">
  <a href="/kk/">ecoprogress.kz</a>
  <nav><a href="/kk/ekologiyalyq-qyzmetter">Қызметтер</a><a href="/kk/pek-bagdarlamasy">ПЭК бағдарламасы</a><a href="/kk/zerthanalyq-zertteuler">Зертханалық зерттеулер</a><a href="/">RU</a><a href="/kk/">ҚАЗ</a></nav>
</header>
${content}
<footer class="seo-static-footer"><p>ECOPROGRESS GROUP: Қазақстандағы бизнеске арналған экологиялық құжаттар, зертханалық зерттеулер, ПЭК және қалдықтар бойынша қызметтер.</p><nav><a href="/kk/qaldyqtar-pasporty">Қалдықтар паспорты</a><a href="/kk/services/ndv">ШРШ жобасы</a><a href="/kk/ekologiyalyq-ruqsat">Экологиялық рұқсат</a><a href="/kk/qaldyqtardy-kadege-zharatu">Қалдықтарды кәдеге жарату</a></nav></footer>` : `
<header class="seo-static-header">
  <a href="/">ecoprogress.kz</a>
  <nav>
    <a href="/services">Услуги</a>
    <a href="/news">Статьи</a>
    <a href="/about">О компании</a>
    <a href="/contacts">Контакты</a>
    <a href="/login">Войти</a>
  </nav>
</header>
${content}
<footer class="seo-static-footer">
  <p>ECOPROGRESS GROUP: экологические документы, лабораторные замеры, ПЭК, отходы и сопровождение бизнеса в Казахстане.</p>
  <nav>
    <a href="/services/environmental-design">Экологическое проектирование</a>
    <a href="/services/laboratory-tests">Лабораторные замеры</a>
    <a href="/services/industrial-control">Производственный контроль</a>
    <a href="/services/waste-recycling">Утилизация: Шымкент, Тараз, Туркестан</a>
    <a href="/contacts">Контакты</a>
  </nav>
</footer>`;

const renderSeoPage = (page) => {
  const kk = page.locale === 'kk';
  return layout(`
<main class="seo-static-page">
  <nav class="seo-breadcrumbs">${renderLinks(page.breadcrumbs)}</nav>
  <section>
    <p>${escapeHtml(page.city || page.service || 'ECOPROGRESS')}</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <p><a href="${kk ? '#lead-form' : '/contacts'}">${kk ? 'Кеңес алу' : 'Получить консультацию'}</a> <a href="${whatsappUrl}">${kk ? 'WhatsApp арқылы жазу' : 'Написать в WhatsApp'}</a></p>
  </section>
  <section><h2>${kk ? 'Қызметтер' : 'Услуги'}</h2>${renderLinks(page.services)}</section>
  <section><h2>${kk ? 'Кімге қажет' : 'Кому нужно'}</h2>${renderList(page.audience)}</section>
  <section><h2>${kk ? 'Клиент не алады' : 'Что получает клиент'}</h2>${renderList(page.outcomes)}</section>
  ${page.sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
  ${page.type === 'article' ? renderArticleTrust(page) : ''}
  <section><h2>${kk ? 'Жиі қойылатын сұрақтар' : 'Частые вопросы'}</h2>${renderVisibleFaq(page.faq, page.locale)}</section>
  <section><h2>${kk ? 'Байланысты қызметтер мен беттер' : 'Связанные услуги и страницы'}</h2>${renderLinks(page.relatedLinks)}</section>
  <section id="lead-form"><h2>${escapeHtml(page.ctaTitle || (kk ? 'Құнын есептеу' : 'Заказать расчет стоимости'))}</h2><p>${escapeHtml(page.ctaText || (kk ? 'Нысан мен қолда бар құжаттарды сипаттаңыз.' : 'Опишите объект и текущие документы — специалист уточнит состав, сроки и порядок работы.'))}</p><p><a href="${kk ? '/kk/ekologiyalyq-qyzmetter' : '/contacts'}">${kk ? 'Өтінім қалдыру' : 'Оставить заявку'}</a> <a href="${whatsappUrl}">${kk ? 'WhatsApp арқылы жазу' : 'Написать в WhatsApp'}</a></p></section>
</main>`, page.locale);
};

const renderArticle = (article) => layout(`
<main class="seo-static-page">
  <nav class="seo-breadcrumbs">${renderLinks([{ label: 'Главная', path: '/' }, { label: 'Статьи', path: '/news' }, { label: article.h1, path: article.slug }])}</nav>
  <article>
    <p>${escapeHtml(article.category)} · ${escapeHtml(article.datePublished)}</p>
    <h1>${escapeHtml(article.h1)}</h1>
    <p>${escapeHtml(article.description)}</p>
    <aside><strong>Короткий ответ</strong><p>${escapeHtml(article.shortAnswer)}</p></aside>
    ${article.tableOfContents ? `<nav aria-label="Содержание"><h2>Содержание</h2><ol>${article.sections.map((section) => `<li><a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a></li>`).join('')}</ol></nav>` : ''}
    ${article.sections.map((section) => `<section id="${escapeHtml(section.id)}"><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}${section.bullets?.length ? renderList(section.bullets) : ''}${section.checklist?.length ? `<h3>Практический чек-лист</h3>${renderList(section.checklist)}` : ''}${section.warning ? `<aside><strong>Важно:</strong> ${escapeHtml(section.warning)}</aside>` : ''}</section>`).join('')}
    <section><h2>Частые вопросы</h2>${renderVisibleFaq(article.faq)}</section>
    ${renderArticleTrust(article)}
    <section><h2>Полезные ссылки</h2>${renderLinks(article.relatedLinks)}</section>
  </article>
</main>`);

const renderStaticPage = (page) => {
  if (page.path.startsWith('/services/')) return renderServicePage(page);
  const cityLinks = seoPages.filter((item) => item.type === 'city' && item.indexable !== false).slice(0, 18).map((item) => ({ label: item.h1, path: `/${item.slug}` }));
  const serviceLinks = seoPages.filter((item) => item.type === 'service-city').slice(0, 18).map((item) => ({ label: item.h1, path: `/${item.slug}` }));
  const articleLinks = seoArticles.map((item) => ({ label: item.h1, path: item.slug }));
  const hero = `<section><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.description)}</p><p><a href="/contacts">Получить консультацию</a> <a href="${whatsappUrl}">WhatsApp</a></p></section>`;
  const contentByPath = {
    '/contacts': `${hero}<section><h2>Контактные данные</h2><address><p>${escapeHtml(COMPANY.name)}</p><p>${escapeHtml(`г. ${COMPANY.address.city}, ${COMPANY.address.street}`)}</p><p><a href="tel:+${COMPANY.phone.value}">${escapeHtml(COMPANY.phone.display)}</a></p><p><a href="mailto:${escapeHtml(COMPANY.email)}">${escapeHtml(COMPANY.email)}</a></p><p>${escapeHtml(COMPANY.workingHours)}</p></address></section>`,
    '/about': renderAboutPage(hero),
    '/employees': `${hero}<section><h2>Компетенции команды</h2><p>В проектах участвуют специалисты по экологическому проектированию, лабораторным исследованиям, отходам и сопровождению предприятий. Персональные данные публикуются только после подтверждения сотрудником.</p></section>`,
    '/partners': `${hero}<section><h2>Направления сотрудничества</h2><p>Компания взаимодействует с лабораториями, проектными организациями, перевозчиками и площадками обращения с отходами в рамках конкретных договоров и задач.</p></section>`,
    '/tariffs': `${hero}<section><h2>Как формируется стоимость</h2><p>Стоимость зависит от категории объекта, полноты исходных данных, числа источников воздействия, состава измерений, выезда и требуемого результата.</p><p>Точный расчёт предоставляется после проверки задачи.</p></section>`,
    '/faq': `${hero}<section><h2>Как начать работу?</h2><p>Передайте описание объекта, город и имеющиеся документы. Специалист уточнит обязательный состав работ.</p></section><section><h2>Можно ли работать дистанционно?</h2><p>Документальные этапы доступны дистанционно; обследование и измерения требуют отдельно согласованного выезда.</p></section>`,
    '/services': `${hero}<section><h2>Каталог экологических услуг</h2>${renderLinks(serviceLinks)}</section>`,
    '/news': `${hero}<section><h2>Опубликованные материалы</h2>${renderLinks(articleLinks)}</section>`,
    '/regions': `${hero}<section><h2>Регионы обслуживания</h2>${renderLinks(cityLinks)}</section>`,
  };
  const specificContent = contentByPath[page.path] || `${hero}<section><h2>Основные направления</h2>${renderLinks(serviceLinks.slice(0, 8))}</section>`;
  return layout(`
  <main class="seo-static-page">
    <nav class="seo-breadcrumbs"><a href="/">Главная</a></nav>
    ${specificContent}
  </main>`);
};

const writePage = (urlPath, html) => {
  const normalized = urlPath === '/' ? '' : urlPath.replace(/^\//, '');
  const targetDir = path.join(distDir, normalized);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
};

let count = 0;

for (const page of publicStaticPages) {
  const meta = registryByPath.get(page.path);
  if (!meta) throw new Error(`SEO registry entry missing for ${page.path}`);
  writePage(page.path, pageShell({ ...meta, type: meta.ogType }, renderStaticPage(page)));
  count += 1;
}

for (const page of seoPages) {
  const meta = registryByPath.get(`/${page.slug}`);
  if (!meta) throw new Error(`SEO registry entry missing for /${page.slug}`);
  writePage(`/${page.slug}`, pageShell({ ...meta, type: meta.ogType }, renderSeoPage(page)));
  count += 1;
}

for (const article of seoArticles) {
  const meta = registryByPath.get(article.slug);
  if (!meta) throw new Error(`SEO registry entry missing for ${article.slug}`);
  writePage(article.slug, pageShell({
    ...meta,
    type: meta.ogType,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
  }, renderArticle(article)));
  count += 1;
}

// Permanent aliases are intentionally not emitted as HTML. Nginx returns HTTP 301.

const notFoundHtml = pageShell({
  title: 'Страница не найдена | ECOPROGRESS',
  description: 'Запрошенная страница не найдена. Перейдите на главную страницу ECOPROGRESS.',
  canonical: `${SITE_URL}/404`,
  robots: 'noindex,follow',
  schema: buildCorePageEntities({ canonical: `${SITE_URL}/404`, name: 'Страница не найдена', description: 'Запрошенная страница не найдена.' }),
}, layout(`
  <main class="seo-static-page">
    <section><p>Ошибка 404</p><h1>Страница не найдена</h1><p>Возможно, адрес изменился или был введен неверно.</p><p><a href="/">Перейти на главную</a> <a href="/contacts">Связаться с нами</a></p></section>
  </main>`));
writePage('/404', notFoundHtml);
fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf8');

console.log(`Prerendered ${count} public pages and a noindex 404 into dist/.`);
