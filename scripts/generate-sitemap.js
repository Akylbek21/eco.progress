import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { OG_IMAGE, publicStaticPages, seoArticles, seoPages, SITE_URL } from './seo-data.mjs';
import { canonicalForPublicPath, robotsForPublicPage } from '../src/seo/indexingPolicy.ts';
import { buildArticleSchema, buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema, buildServiceEntity, entityIds } from '../src/seo/entityBuilders.ts';
import { expertMap, experts, isCompleteExpert } from '../src/content/experts/experts.ts';
import { caseStudies } from '../src/content/cases/caseStudies.ts';
import { isPublishableCaseStudy } from '../src/content/cases/caseStudyPolicy.ts';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'src', 'data');
const isoDate = (value) => new Date(value).toISOString().slice(0, 10);
const escapeXml = (value) => value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);
const optimizedImagePaths = {
  '/cottonbro.jpg': '/media/ekologicheskoe-proektirovanie-1280.jpg',
  '/edward.jpg': '/media/laboratornye-izmereniya-1280.jpg',
  '/jose.jpg': '/media/vyvoz-othodov-1280.jpg',
  '/pexels-enginakyurt.jpg': '/media/ekologicheskiy-monitoring-1280.jpg',
  '/pexels-jan-van.jpg': '/media/otbor-prob-vody-1280.jpg',
  '/para.jpg': '/media/ecoprogress-og-cover-1280.jpg',
  '/ekologicheskoe-soprovozhdenie.jpg': '/media/ekologicheskoe-soprovozhdenie-1280.jpg',
  '/utilizacija-othodov-3.jpg': '/media/utilizaciya-othodov-1280.jpg',
  '/poligon-tbo-2.jpg': '/media/poligon-tbo-1280.jpg',
  '/og-cover.jpg': '/media/social/ecoprogress-og-1200x630.jpg',
};
const optimizedImage = (image) => optimizedImagePaths[image] || image;
const verifiedExperts = experts.filter(isCompleteExpert);
const verifiedCases = caseStudies.filter(isPublishableCaseStudy);

const pageSource = (routePath) => {
  if (routePath === '/') return 'src/pages/HomePage.tsx';
  const names = {
    '/about': 'AboutPage.tsx', '/contacts': 'ContactsPage.tsx', '/employees': 'EmployeesPage.tsx',
    '/faq': 'FaqPage.tsx', '/news': 'NewsPage.tsx', '/partners': 'PartnersPage.tsx',
    '/regions': 'RegionsPage.tsx', '/services': 'ServicesPage.tsx', '/tariffs': 'TariffsPage.tsx',
  };
  return names[routePath] ? `src/pages/${names[routePath]}` : routePath.startsWith('/services/') ? 'src/content/serviceCatalog.ts' : 'scripts/seo-data.mjs';
};

const gitDate = (source, fallback) => {
  try {
    const result = execFileSync('git', ['log', '-1', '--format=%cI', '--', source], { cwd: root, encoding: 'utf8' }).trim();
    if (result) return isoDate(result);
  } catch { /* mtime fallback below */ }
  try {
    return isoDate(fs.statSync(path.join(root, source)).mtime);
  } catch {
    return fallback;
  }
};

const schemasFor = (source) => {
  const { path: pathName, h1, description, type, canonical, image, datePublished, dateModified, cityNominative, city, service } = source;
  const schemas = buildCorePageEntities({ canonical, name: h1, description, dateModified, localBusiness: cityNominative === 'Шымкент' });
  if (type === 'service' || type === 'service-city') {
    const expertNodes = verifiedExperts.map((expert, index) => buildPersonSchema(expert, `${canonical}#expert-${index + 1}`));
    const caseUrls = verifiedCases.filter((item) => !source.serviceSlug || item.service === source.serviceSlug).map((item) => `${SITE_URL}/cases/${item.slug}`);
    schemas.push(buildServiceEntity({ canonical, name: h1, serviceType: service || h1, description, areaServed: cityNominative || city || 'Казахстан', image, expertIds: expertNodes.map((node) => node['@id']), caseUrls }), ...expertNodes);
  }
  if (type === 'article' && pathName !== '/news') {
    const author = source.reviewStatus === 'approved' ? expertMap.get(source.authorSlug) : undefined;
    const reviewer = source.reviewStatus === 'approved' ? expertMap.get(source.reviewerSlug) : undefined;
    const ids = entityIds(canonical);
    const caseUrls = verifiedCases.filter((item) => source.relatedServiceSlugs?.includes(item.service)).map((item) => `${SITE_URL}/cases/${item.slug}`);
    schemas.push(buildArticleSchema({ canonical, headline: h1, description, image: image || OG_IMAGE, datePublished, dateModified, authorId: isCompleteExpert(author) ? ids.author : undefined, reviewerId: isCompleteExpert(reviewer) ? ids.reviewer : undefined, caseUrls }));
    if (isCompleteExpert(author)) schemas.push(buildPersonSchema(author, ids.author));
    if (isCompleteExpert(reviewer)) schemas.push(buildPersonSchema(reviewer, ids.reviewer));
  }
  if (pathName !== '/') schemas.push(buildBreadcrumbSchema([{ name: 'Главная', url: SITE_URL }, { name: h1, url: canonical }], canonical));
  return schemas;
};

const normalizeEntry = (source) => {
  const pathName = source.path;
  const canonical = canonicalForPublicPath(pathName);
  if (source.canonical && source.canonical !== canonical) {
    throw new Error(`Canonical mismatch for ${pathName}: ${source.canonical} !== ${canonical}`);
  }
  const robots = robotsForPublicPage({ ...source, path: pathName });
  const lastModified = source.lastModified || source.lastmod || gitDate(pageSource(pathName), isoDate(new Date()));
  const ogImage = source.ogImage || (source.image ? `${SITE_URL}${optimizedImage(source.image)}` : OG_IMAGE);
  const ogType = source.type === 'article' && pathName !== '/news' ? 'article' : 'website';
  return {
    path: pathName,
    title: source.title,
    description: source.description,
    h1: source.h1,
    canonical,
    robots,
    ...(source.type === 'article' && pathName !== '/news' ? { reviewStatus: source.reviewStatus ?? null } : {}),
    ogType,
    ogTitle: source.title,
    ogDescription: source.description,
    ogImage,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    twitterCard: 'summary_large_image',
    schema: schemasFor({ ...source, canonical, image: ogImage, dateModified: lastModified }),
    includeInSitemap: robots === 'index,follow',
    priority: source.priority ?? 0.7,
    changeFrequency: source.changefreq || 'monthly',
    lastModified,
  };
};

const registry = [
  ...publicStaticPages.map((page) => normalizeEntry({ ...page, path: page.path })),
  ...seoPages.map((page) => normalizeEntry({ ...page, path: `/${page.slug}` })),
  ...seoArticles.map((article) => normalizeEntry({
    ...article, path: article.slug, title: `${article.title} | ECOPROGRESS`,
    type: 'article', priority: 0.7, changefreq: 'weekly', lastModified: article.dateModified,
  })),
];

const duplicatePaths = registry.filter((entry, index) => registry.findIndex((item) => item.path === entry.path) !== index);
if (duplicatePaths.length) throw new Error(`Duplicate SEO registry paths: ${duplicatePaths.map((entry) => entry.path).join(', ')}`);

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'seoPages.generated.json'), `${JSON.stringify(seoPages, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(dataDir, 'seoArticles.generated.json'), `${JSON.stringify(seoArticles, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(dataDir, 'seoRegistry.generated.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

const sitemapEntries = registry.filter((entry) => entry.includeInSitemap && entry.robots === 'index,follow');
const body = sitemapEntries.map((entry) => [
  '  <url>',
  `    <loc>${escapeXml(entry.canonical)}</loc>`,
  `    <lastmod>${entry.lastModified}</lastmod>`,
  `    <changefreq>${entry.changeFrequency}</changefreq>`,
  `    <priority>${entry.priority.toFixed(1)}</priority>`,
  '  </url>',
].join('\n')).join('\n');
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
const distDir = path.join(root, 'dist');
if (fs.existsSync(distDir)) fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');

console.log(`Generated unified SEO registry and sitemap.xml with ${sitemapEntries.length} public URLs.`);
