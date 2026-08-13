import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { COMPANY } from '../src/config/companyData.ts';
import { OG_IMAGE, publicStaticPages, seoArticles, seoPages, SITE_URL } from './seo-data.mjs';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'src', 'data');
const isoDate = (value) => new Date(value).toISOString().slice(0, 10);
const escapeXml = (value) => value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);
const canonicalForPath = (routePath) => routePath === '/' ? SITE_URL : `${SITE_URL}${routePath.replace(/\/+$/, '')}`;
const optimizedImagePaths = {
  '/cottonbro.jpg': '/media/ekologicheskoe-proektirovanie-1280.jpg',
  '/edward.jpg': '/media/laboratornye-izmereniya-1280.jpg',
  '/jose.jpg': '/media/vyvoz-othodov-1280.jpg',
  '/pexels-enginakyurt.jpg': '/media/ekologicheskiy-monitoring-1280.jpg',
  '/pexels-jan-van.jpg': '/media/otbor-prob-vody-1280.jpg',
  '/para.jpg': '/media/ecoprogress-og-cover-1280.jpg',
  '/images (1).jpg': '/media/ekologicheskoe-soprovozhdenie-1280.jpg',
  '/og-cover.jpg': '/media/social/ecoprogress-og-1200x630.jpg',
};
const optimizedImage = (image) => optimizedImagePaths[image] || image;

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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness', 'ProfessionalService'],
  '@id': `${SITE_URL}/#organization`,
  name: COMPANY.name,
  alternateName: COMPANY.brandName,
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: COMPANY.logo },
  telephone: COMPANY.phone.display,
  email: COMPANY.email,
  address: {
    '@type': 'PostalAddress',
    addressCountry: COMPANY.address.country,
    addressLocality: COMPANY.address.city,
    streetAddress: COMPANY.address.street,
    ...(COMPANY.address.postalCode ? { postalCode: COMPANY.address.postalCode } : {}),
  },
  areaServed: { '@type': 'Country', name: 'Казахстан' },
  openingHours: 'Mo-Fr 09:00-18:00',
  sameAs: [COMPANY.instagramUrl],
};

const breadcrumbSchema = (pathName, h1) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
    ...(pathName === '/' ? [] : [{ '@type': 'ListItem', position: 2, name: h1, item: canonicalForPath(pathName) }]),
  ],
});

const schemasFor = ({ path: pathName, h1, description, type, canonical, image, datePublished, dateModified, faq }) => {
  const schemas = [];
  if (pathName === '/' || pathName === '/contacts') {
    schemas.push(organizationSchema);
    if (pathName === '/') schemas.push({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: COMPANY.brandName, publisher: { '@id': `${SITE_URL}/#organization` } });
  }
  if (type === 'service') {
    schemas.push({ '@context': 'https://schema.org', '@type': 'Service', name: h1, serviceType: h1, description, url: canonical, provider: { '@id': `${SITE_URL}/#organization` }, areaServed: { '@type': 'Country', name: 'Казахстан' } });
  }
  if (type === 'article' && pathName !== '/news') {
    schemas.push({
      '@context': 'https://schema.org', '@type': 'Article', headline: h1, description, url: canonical,
      image: { '@type': 'ImageObject', url: image || OG_IMAGE },
      datePublished, dateModified, author: { '@type': 'Organization', name: COMPANY.name, url: SITE_URL },
      publisher: { '@id': `${SITE_URL}/#organization` }, mainEntityOfPage: canonical,
    });
  }
  if (pathName !== '/') schemas.push(breadcrumbSchema(pathName, h1));
  if (Array.isArray(faq) && faq.length) schemas.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) });
  return schemas;
};

const normalizeEntry = (source) => {
  const pathName = source.path;
  const canonical = source.canonical || canonicalForPath(pathName);
  const robots = source.indexable === false
    || pathName === '/employees'
    || (source.type === 'article' && source.reviewStatus && source.reviewStatus !== 'approved')
    ? 'noindex,follow'
    : 'index,follow';
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
