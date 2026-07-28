import fs from 'node:fs';
import path from 'node:path';
import { LASTMOD, OG_IMAGE, SITE_URL, publicStaticPages, seoArticles, seoPages } from './seo-data.mjs';
import { COMPANY } from '../src/config/companyData.ts';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const templatePath = path.join(distDir, 'index.html');
const whatsappUrl = 'https://wa.me/77771858088';

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
  .replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
  .replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
  .replace(/\s*<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>\s*/gi, '');

const buildOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ECOPROGRESS GROUP',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  sameAs: ['https://www.instagram.com/ecoprogress.group'],
});

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'ECOPROGRESS GROUP',
  url: SITE_URL,
  image: OG_IMAGE,
  description: 'Экологические услуги для бизнеса в Казахстане',
  areaServed: ['Казахстан', 'Шымкент', 'Алматы', 'Астана', 'Тараз', 'Туркестан', 'Кызылорда'],
  serviceType: ['Экологическое проектирование', 'Лабораторные замеры', 'Производственный контроль', 'Паспорт отходов', 'Отчет ПЭК'],
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'г. Шымкент, Алимбетова 199/2а',
    addressLocality: 'Шымкент',
    addressCountry: 'KZ',
  },
};

const buildBreadcrumbSchema = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: `${SITE_URL}${item.path}`,
  })),
});

const buildFaqSchema = (faq = []) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
});

const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ECOPROGRESS',
  url: SITE_URL,
};

const buildServiceSchema = (page) => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.h1,
    description: page.description,
    url: page.canonical,
    image: `${SITE_URL}${page.image || '/og-cover.jpg'}`,
    provider: { '@type': 'Organization', name: 'ECOPROGRESS GROUP', url: SITE_URL },
    areaServed: page.city || 'Казахстан',
    serviceType: page.service || 'Экологические услуги',
    ...(page.type === 'service-city' ? { availableChannel: { '@type': 'ServiceChannel', serviceUrl: page.canonical } } : {}),
});

const schemaForSeoPage = (page) => [
  buildOrganizationSchema(),
  page.type === 'service-city' || page.type === 'service'
    ? buildServiceSchema(page)
    : { '@context': 'https://schema.org', '@type': 'WebPage', name: page.h1, description: page.description, url: page.canonical, dateModified: page.lastmod || LASTMOD },
  buildBreadcrumbSchema(page.breadcrumbs),
  buildFaqSchema(page.faq),
];

const schemaForArticle = (article) => [
  buildOrganizationSchema(),
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.h1,
    description: article.description,
    image: `${SITE_URL}${article.image}`,
    author: { '@type': 'Organization', name: 'ECOPROGRESS GROUP' },
    publisher: { '@type': 'Organization', name: 'ECOPROGRESS GROUP' },
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    mainEntityOfPage: `${SITE_URL}${article.slug}`,
  },
  buildBreadcrumbSchema([{ label: 'Главная', path: '/' }, { label: 'Статьи', path: '/news' }, { label: article.h1, path: article.slug }]),
  buildFaqSchema(article.faq),
];

const renderHeadBlock = ({ title, description, canonical, type = 'website', schema, robots = 'index,follow', ogImage = OG_IMAGE, ogImageWidth = 1200, ogImageHeight = 630, datePublished, dateModified }) => {
  const verification = process.env.VITE_GOOGLE_SITE_VERIFICATION
    ? `\n<meta name="google-site-verification" content="${escapeHtml(process.env.VITE_GOOGLE_SITE_VERIFICATION)}" />`
    : '\n<!-- Google Search Console: set VITE_GOOGLE_SITE_VERIFICATION to render verification meta. -->';

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    '<meta property="og:site_name" content="ECOPROGRESS GROUP" />',
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    `<meta property="og:image:width" content="${ogImageWidth}" />`,
    `<meta property="og:image:height" content="${ogImageHeight}" />`,
    '<meta property="og:locale" content="ru_KZ" />',
    ...(type === 'article' && datePublished ? [`<meta property="article:published_time" content="${escapeHtml(datePublished)}" />`, `<meta property="article:modified_time" content="${escapeHtml(dateModified || datePublished)}" />`] : []),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
    verification,
    `<script id="page-schema-json-ld" type="application/ld+json">${JSON.stringify(schema)}</script>`,
  ].join('\n    ');
};

const pageShell = (meta, body) => {
  const clean = stripSeoHead(template);
  const headBlock = renderHeadBlock(meta);
  return clean
    .replace('</head>', `    ${headBlock}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${body}</div>`);
};

const renderLinks = (links = []) => links.map((item) => `<a href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a>`).join('');
const renderList = (items = []) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

const layout = (content) => `
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
    <a href="/services/waste-management">Утилизация отходов в Шымкенте</a>
    <a href="/contacts">Контакты</a>
  </nav>
</footer>`;

const renderSeoPage = (page) => layout(`
<main class="seo-static-page">
  <nav class="seo-breadcrumbs">${renderLinks(page.breadcrumbs)}</nav>
  <section>
    <p>${escapeHtml(page.city || page.service || 'ECOPROGRESS')}</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <p><a href="/contacts">Получить консультацию</a> <a href="${whatsappUrl}">Написать в WhatsApp</a></p>
  </section>
  <section><h2>Услуги</h2>${renderLinks(page.services)}</section>
  <section><h2>Кому нужно</h2>${renderList(page.audience)}</section>
  <section><h2>Что получает клиент</h2>${renderList(page.outcomes)}</section>
  ${page.sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
  <section><h2>Частые вопросы</h2>${page.faq.map((item) => `<article><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`).join('')}</section>
  <section><h2>Внутренние ссылки</h2>${renderLinks(page.relatedLinks)}</section>
</main>`);

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
    <section><h2>Частые вопросы</h2>${article.faq.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join('')}</section>
    <section><h2>Источники</h2><ul>${article.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul></section>
    <aside><h2>Автор</h2><p>Редакция EcoProgress</p><p>${article.reviewStatus === 'approved' ? 'Материал проверен' : 'Материал требует проверки профильным экологом'}</p></aside>
    <section><h2>Полезные ссылки</h2>${renderLinks(article.relatedLinks)}</section>
  </article>
</main>`);

const renderStaticPage = (page) => {
  const cityLinks = seoPages.filter((item) => item.type === 'city' && item.indexable !== false).slice(0, 18).map((item) => ({ label: item.h1, path: `/${item.slug}` }));
  const serviceLinks = seoPages.filter((item) => item.type === 'service-city').slice(0, 18).map((item) => ({ label: item.h1, path: `/${item.slug}` }));
  const articleLinks = seoArticles.map((item) => ({ label: item.h1, path: item.slug }));
  const hero = `<section><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.description)}</p><p><a href="/contacts">Получить консультацию</a> <a href="${whatsappUrl}">WhatsApp</a></p></section>`;
  const contentByPath = {
    '/contacts': `${hero}<section><h2>Контактные данные</h2><address><p>${escapeHtml(COMPANY.name)}</p><p>${escapeHtml(`г. ${COMPANY.address.city}, ${COMPANY.address.street}`)}</p><p><a href="tel:+${COMPANY.phone.value}">${escapeHtml(COMPANY.phone.display)}</a></p><p><a href="mailto:${escapeHtml(COMPANY.email)}">${escapeHtml(COMPANY.email)}</a></p><p>${escapeHtml(COMPANY.workingHours)}</p></address></section>`,
    '/about': `${hero}<section><h2>Чем занимается компания</h2><p>ECOPROGRESS GROUP сопровождает предприятия по экологическим документам, лабораторным исследованиям, обращению с отходами и производственному контролю.</p></section><section><h2>Подход к работе</h2><p>Специалисты проверяют исходные данные и применимость требований, согласуют состав работ и фиксируют результат для клиента.</p></section>`,
    '/employees': `${hero}<section><h2>Компетенции команды</h2><p>В проектах участвуют специалисты по экологическому проектированию, лабораторным исследованиям, отходам и сопровождению предприятий. Персональные данные публикуются только после подтверждения сотрудником.</p></section>`,
    '/partners': `${hero}<section><h2>Направления сотрудничества</h2><p>Компания взаимодействует с лабораториями, проектными организациями, перевозчиками и площадками обращения с отходами в рамках конкретных договоров и задач.</p></section>`,
    '/tariffs': `${hero}<section><h2>Как формируется стоимость</h2><p>Стоимость зависит от категории объекта, полноты исходных данных, числа источников воздействия, состава измерений, выезда и требуемого результата.</p><p>Точный расчёт предоставляется после проверки задачи.</p></section>`,
    '/faq': `${hero}<section><h2>Как начать работу?</h2><p>Передайте описание объекта, город и имеющиеся документы. Специалист уточнит обязательный состав работ.</p></section><section><h2>Можно ли работать дистанционно?</h2><p>Документальные этапы доступны дистанционно; обследование и измерения требуют отдельно согласованного выезда.</p></section>`,
    '/services': `${hero}<section><h2>Каталог экологических услуг</h2>${renderLinks(serviceLinks)}</section>`,
    '/news': `${hero}<section><h2>Опубликованные материалы</h2>${renderLinks(articleLinks)}</section>`,
    '/regions': `${hero}<section><h2>Регионы обслуживания</h2>${renderLinks(cityLinks)}</section>`,
  };
  const specificContent = contentByPath[page.path] || (page.path.startsWith('/services/')
    ? `${hero}<section><h2>Что входит в услугу «${escapeHtml(page.h1)}»</h2><p>${escapeHtml(page.description)} Состав работ уточняется по объекту и подтверждённым исходным данным клиента.</p></section><section><h2>Связанные материалы</h2>${renderLinks(articleLinks.slice(0, 4))}</section>`
    : `${hero}<section><h2>Основные направления</h2>${renderLinks(serviceLinks.slice(0, 8))}</section>`);
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
  schema: [buildOrganizationSchema()],
}, layout(`
  <main class="seo-static-page">
    <section><p>Ошибка 404</p><h1>Страница не найдена</h1><p>Возможно, адрес изменился или был введен неверно.</p><p><a href="/">Перейти на главную</a> <a href="/contacts">Связаться с нами</a></p></section>
  </main>`));
writePage('/404', notFoundHtml);
fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf8');

console.log(`Prerendered ${count} public pages and a noindex 404 into dist/.`);
