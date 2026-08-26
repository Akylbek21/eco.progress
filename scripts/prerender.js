import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const templatePath = path.join(distDir, 'index.html');
const serverEntryPath = path.join(projectRoot, 'dist-ssr', 'entry-server.js');
const registryPath = path.join(projectRoot, 'src', 'data', 'seoRegistry.generated.json');

for (const requiredPath of [templatePath, serverEntryPath, registryPath]) {
  if (!fs.existsSync(requiredPath)) throw new Error(`Required prerender input is missing: ${requiredPath}`);
}

const { renderPublicApp } = await import(pathToFileURL(serverEntryPath).href);
const rawTemplate = fs.readFileSync(templatePath, 'utf8');
const seoRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const rootStart = rawTemplate.indexOf('<div id="root"');
const bodyEnd = rawTemplate.lastIndexOf('</body>');
const rootEnd = rawTemplate.lastIndexOf('</div>', bodyEnd);
if (rootStart < 0 || rootEnd < rootStart) throw new Error('dist/index.html does not contain the expected root markers');

const template = `${rawTemplate.slice(0, rootStart)}<div id="root"></div>${rawTemplate.slice(rootEnd + '</div>'.length)}`;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const safeJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const schemaGraph = (schema = []) => ({
  '@context': 'https://schema.org',
  '@graph': schema.map(({ '@context': _context, ...node }) => node),
});

const stripSeoHead = (html) => html
  .replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/\s*<meta\s+name=["']description["'][^>]*>\s*/gi, '')
  .replace(/\s*<meta\s+name=["']robots["'][^>]*>\s*/gi, '')
  .replace(/\s*<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
  .replace(/\s*<link\s+rel=["']alternate["'][^>]*>\s*/gi, '')
  .replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
  .replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
  .replace(/\s*<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>\s*/gi, '');

const renderHeadBlock = (entry) => {
  const verification = process.env.VITE_GOOGLE_SITE_VERIFICATION
    ? `<meta name="google-site-verification" content="${escapeHtml(process.env.VITE_GOOGLE_SITE_VERIFICATION)}" />`
    : '<!-- Google Search Console: set VITE_GOOGLE_SITE_VERIFICATION to render verification meta. -->';
  const type = entry.ogType || 'website';
  const image = entry.ogImage;

  return [
    `<title>${escapeHtml(entry.title)}</title>`,
    `<meta name="description" content="${escapeHtml(entry.description)}" />`,
    `<meta name="robots" content="${escapeHtml(entry.robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(entry.canonical)}" />`,
    ...(entry.alternates || []).map((alternate) => `<link rel="alternate" hreflang="${escapeHtml(alternate.locale)}" href="${escapeHtml(alternate.url)}" data-ecoprogress-hreflang="true" />`),
    '<meta property="og:site_name" content="ECOPROGRESS GROUP" />',
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    `<meta property="og:title" content="${escapeHtml(entry.ogTitle || entry.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(entry.ogDescription || entry.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(entry.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="${entry.ogImageWidth || 1200}" />`,
    `<meta property="og:image:height" content="${entry.ogImageHeight || 630}" />`,
    `<meta property="og:locale" content="${entry.locale === 'kk' ? 'kk_KZ' : 'ru_KZ'}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(entry.ogTitle || entry.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(entry.ogDescription || entry.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ...(type === 'article' && entry.datePublished ? [
      `<meta property="article:published_time" content="${escapeHtml(entry.datePublished)}" />`,
      `<meta property="article:modified_time" content="${escapeHtml(entry.lastModified || entry.datePublished)}" />`,
    ] : []),
    verification,
    `<script id="page-schema-json-ld" data-ecoprogress-schema="true" type="application/ld+json">${safeJson(schemaGraph(entry.schema))}</script>`,
  ].join('\n    ');
};

const pageShell = (entry, body) => stripSeoHead(template)
  .replace(/<html\s+lang=["'][^"']+["']/i, `<html lang="${entry.locale === 'kk' ? 'kk' : 'ru'}"`)
  .replace('</head>', `    ${renderHeadBlock(entry)}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${body}</div>`);

const outputPathFor = (urlPath) => urlPath === '/'
  ? path.join(distDir, 'index.html')
  : path.join(distDir, urlPath.replace(/^\//, ''), 'index.html');

const writePage = (urlPath, html) => {
  const outputPath = outputPathFor(urlPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
};

const assertReactBody = (urlPath, body) => {
  if (body.includes('\0')) throw new Error(`React prerender contains a NUL byte: ${urlPath}`);
  if (!/<h1(?:\s|>)/i.test(body)) throw new Error(`React prerender contains no H1: ${urlPath}`);
  if (body.includes('seo-static-page')) throw new Error(`Legacy handcrafted prerender markup detected: ${urlPath}`);
};

let count = 0;
for (const entry of seoRegistry) {
  const body = await renderPublicApp(entry.path);
  assertReactBody(entry.path, body);
  writePage(entry.path, pageShell(entry, body));
  count += 1;
}

const notFoundEntry = {
  path: '/404',
  locale: 'ru',
  title: 'Страница не найдена | ECOPROGRESS',
  description: 'Страница не найдена. Перейдите на главную или оставьте заявку на экологические услуги.',
  canonical: 'https://ecoprogress.kz/404',
  robots: 'noindex,follow',
  ogType: 'website',
  ogImage: 'https://ecoprogress.kz/media/social/ecoprogress-og-1200x630.jpg',
  schema: [],
};
const notFoundBody = await renderPublicApp('/404');
assertReactBody('/404', notFoundBody);
const notFoundHtml = pageShell(notFoundEntry, notFoundBody);
writePage('/404', notFoundHtml);
fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf8');

console.log(`Prerendered ${count} public pages with the shared React tree and a noindex 404 into dist/.`);
