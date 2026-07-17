import fs from 'node:fs';
import path from 'node:path';
import { getAllPublicUrls, OG_IMAGE, publicStaticPages, seoArticles, seoPages, SITE_URL } from './seo-data.mjs';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'src', 'data');

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'seoPages.generated.json'), `${JSON.stringify(seoPages, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(dataDir, 'seoArticles.generated.json'), `${JSON.stringify(seoArticles, null, 2)}\n`, 'utf8');

const seoRegistry = [
  ...publicStaticPages.map((page) => ({
    path: page.path,
    title: page.title,
    description: page.description,
    h1: page.h1,
    canonical: `${SITE_URL}${page.path === '/' ? '/' : page.path}`,
    robots: page.indexable === false ? 'noindex,follow' : 'index,follow',
    ogImage: OG_IMAGE,
    schemaType: page.type === 'article' ? 'Article' : page.type === 'service' ? 'Service' : 'WebPage',
  })),
  ...seoPages.map((page) => ({
    path: `/${page.slug}`,
    title: page.title,
    description: page.description,
    h1: page.h1,
    canonical: page.canonical,
    robots: page.indexable === false ? 'noindex,follow' : 'index,follow',
    ogImage: `${SITE_URL}${page.image || '/og-cover.jpg'}`,
    schemaType: page.schemaType,
  })),
  ...seoArticles.map((article) => ({
    path: article.slug,
    title: `${article.title} | ECOPROGRESS`,
    description: article.description,
    h1: article.h1,
    canonical: `${SITE_URL}${article.slug}`,
    robots: 'index,follow',
    ogImage: `${SITE_URL}${article.image}`,
    schemaType: 'Article',
  })),
];
fs.writeFileSync(path.join(dataDir, 'seoRegistry.generated.json'), `${JSON.stringify(seoRegistry, null, 2)}\n`, 'utf8');

const urls = getAllPublicUrls();
const body = urls
  .map(({ loc, lastmod, changefreq, priority }) => [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n'))
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8');

console.log(`Generated sitemap.xml with ${urls.length} public URLs.`);
