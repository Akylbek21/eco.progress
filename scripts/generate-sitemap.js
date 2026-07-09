import fs from 'node:fs';
import path from 'node:path';
import { getAllPublicUrls, seoArticles, seoPages } from './seo-data.mjs';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'src', 'data');

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'seoPages.generated.json'), `${JSON.stringify(seoPages, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(dataDir, 'seoArticles.generated.json'), `${JSON.stringify(seoArticles, null, 2)}\n`, 'utf8');

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
