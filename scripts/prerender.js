import fs from 'node:fs';
import path from 'node:path';
import { LASTMOD, OG_IMAGE, SITE_URL, publicStaticPages, seoArticles, seoPages } from './seo-data.mjs';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const templatePath = path.join(distDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  throw new Error('dist/index.html not found. Run vite build before prerender.');
}

const template = fs.readFileSync(templatePath, 'utf8');

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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ECOPROGRESS GROUP',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  sameAs: ['https://www.instagram.com/ecoprogress.group'],
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'ECOPROGRESS GROUP',
  url: SITE_URL,
  image: OG_IMAGE,
  description: 'Экологические услуги для бизнеса в Казахстане',
  areaServed: ['Казахстан', 'Шымкент', 'Алматы', 'Астана', 'Тараз', 'Туркестан', 'Кызылорда'],
  serviceType: ['Экологическое проектирование', 'Лабораторные замеры', 'Производственный контроль', 'Паспорт отходов', 'Отчет ПЭК', 'Утилизация отходов'],
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'г. Шымкент, Алимбетова 199/2а',
    addressLocality: 'Шымкент',
    addressCountry: 'KZ',
  },
};

const breadcrumbSchema = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: `${SITE_URL}${item.path}`,
  })),
});

const faqSchema = (faq = []) => ({
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

const schemaForSeoPage = (page) => [
  organizationSchema,
  localBusinessSchema,
  {
    '@context': 'https://schema.org',
    '@type': page.type === 'article' ? 'Article' : 'Service',
    name: page.h1,
    headline: page.h1,
    description: page.description,
    url: page.canonical,
    image: `${SITE_URL}${page.image || '/og-cover.jpg'}`,
    provider: { '@type': 'Organization', name: 'ECOPROGRESS GROUP', url: SITE_URL },
    areaServed: page.city || 'Казахстан',
    serviceType: page.service || 'Экологические услуги',
    dateModified: LASTMOD,
  },
  breadcrumbSchema(page.breadcrumbs),
  faqSchema(page.faq),
];

const schemaForArticle = (article) => [
  organizationSchema,
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
  breadcrumbSchema([{ label: 'Главная', path: '/' }, { label: 'Статьи', path: '/news' }, { label: article.h1, path: article.slug }]),
  faqSchema(article.faq),
];

const renderHeadBlock = ({ title, description, canonical, type = 'website', schema }) => {
  const verification = process.env.VITE_GOOGLE_SITE_VERIFICATION
    ? `\n<meta name="google-site-verification" content="${escapeHtml(process.env.VITE_GOOGLE_SITE_VERIFICATION)}" />`
    : '\n<!-- Google Search Console: set VITE_GOOGLE_SITE_VERIFICATION to render verification meta. -->';

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    '<meta name="robots" content="index,follow" />',
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    '<meta property="og:site_name" content="ECOPROGRESS GROUP" />',
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    verification,
    `<script id="page-schema-json-ld" type="application/ld+json">${JSON.stringify(schema)}</script>`,
  ].join('\n    ');
};

const pageShell = (meta, body) => {
  const clean = stripSeoHead(template);
  const headBlock = renderHeadBlock(meta);
  return clean
    .replace('</head>', `    ${headBlock}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
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
    <a href="/services/waste-management">Утилизация отходов</a>
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
    <p><a href="/contacts">Получить консультацию</a> <a href="https://wa.me/77082553000">Написать в WhatsApp</a></p>
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
    ${article.sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
    <section><h2>Частые вопросы</h2>${article.faq.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join('')}</section>
    <section><h2>Полезные ссылки</h2>${renderLinks(article.relatedLinks)}</section>
  </article>
</main>`);

const renderStaticPage = (page) => {
  const cityLinks = seoPages.filter((item) => item.type === 'city').slice(0, 18).map((item) => ({ label: item.h1, path: `/${item.slug}` }));
  const serviceLinks = seoPages.filter((item) => item.type === 'service-city').slice(0, 18).map((item) => ({ label: item.h1, path: `/${item.slug}` }));
  const articleLinks = seoArticles.map((item) => ({ label: item.h1, path: item.slug }));
  return layout(`
  <main class="seo-static-page">
    <nav class="seo-breadcrumbs"><a href="/">Главная</a></nav>
    <section><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.description)}</p><p><a href="/contacts">Получить консультацию</a> <a href="https://wa.me/77082553000">WhatsApp</a></p></section>
    <section><h2>Основные услуги</h2>${renderLinks([
      { label: 'Экологическое проектирование', path: '/services/environmental-design' },
      { label: 'Лабораторные замеры', path: '/services/laboratory-tests' },
      { label: 'Производственный контроль СЭС', path: '/services/industrial-control' },
      { label: 'Утилизация отходов', path: '/services/waste-management' },
      { label: 'Паспорт отходов', path: '/passport-othodov-kazakhstan' },
      { label: 'Отчет ПЭК', path: '/otchet-pek-kazakhstan' },
    ])}</section>
    <section><h2>Города Казахстана</h2>${renderLinks(cityLinks)}</section>
    <section><h2>Популярные страницы</h2>${renderLinks(serviceLinks)}</section>
    <section><h2>Статьи</h2>${renderLinks(articleLinks)}</section>
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
  writePage(page.path, pageShell({
    title: page.title,
    description: page.description,
    canonical: `${SITE_URL}${page.path === '/' ? '/' : page.path}`,
    schema: page.path === '/' ? [organizationSchema, localBusinessSchema, webSiteSchema] : [organizationSchema, localBusinessSchema],
  }, renderStaticPage(page)));
  count += 1;
}

for (const page of seoPages) {
  writePage(`/${page.slug}`, pageShell({
    title: page.title,
    description: page.description,
    canonical: page.canonical,
    schema: schemaForSeoPage(page),
    type: page.type === 'article' ? 'article' : 'website',
  }, renderSeoPage(page)));
  count += 1;
}

for (const article of seoArticles) {
  writePage(article.slug, pageShell({
    title: `${article.title} | ECOPROGRESS`,
    description: article.description,
    canonical: `${SITE_URL}${article.slug}`,
    schema: schemaForArticle(article),
    type: 'article',
  }, renderArticle(article)));
  count += 1;
}

console.log(`Prerendered ${count} public pages into dist/.`);
