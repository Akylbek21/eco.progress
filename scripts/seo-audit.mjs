import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const sitemapPath = path.join(dist, 'sitemap.xml');
const SITE_URL = 'https://ecoprogress.kz';
const errors = [];
const warnings = [];

const read = (file) => fs.readFileSync(file, 'utf8');
const one = (html, pattern) => html.match(pattern)?.[1]?.trim() || '';
const count = (html, pattern) => [...html.matchAll(pattern)].length;
const pageFile = (pathname) => pathname === '/'
  ? path.join(dist, 'index.html')
  : path.join(dist, pathname.replace(/^\//, ''), 'index.html');

if (!fs.existsSync(sitemapPath)) throw new Error('SEO audit: dist/sitemap.xml not found');
const sitemap = read(sitemapPath);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const cmsSnapshot = JSON.parse(read(path.join(root, 'src', 'data', 'seoCmsSnapshot.generated.json')));
const snapshotExperts = Array.isArray(cmsSnapshot.experts) ? cmsSnapshot.experts : [];
const snapshotCases = Array.isArray(cmsSnapshot.cases) ? cmsSnapshot.cases : [];
const snapshotArticleReviews = Array.isArray(cmsSnapshot.articleReviews) ? cmsSnapshot.articleReviews : [];
const cmsContentUnavailable = !snapshotExperts.length && !snapshotCases.length && !snapshotArticleReviews.length;
const sitemapBaseline = JSON.parse(read(path.join(root, 'scripts', 'seo-sitemap-baseline.json')));
const baselineUrlCount = Number(sitemapBaseline.indexableUrlCount);
const maximumDropPercent = Number(sitemapBaseline.maximumDropPercent);
if (!Number.isInteger(baselineUrlCount) || baselineUrlCount <= 0) {
  errors.push('Invalid sitemap baseline: indexableUrlCount must be a positive integer');
} else if (!Number.isFinite(maximumDropPercent) || maximumDropPercent < 0 || maximumDropPercent >= 100) {
  errors.push('Invalid sitemap baseline: maximumDropPercent must be between 0 and 100');
} else {
  const dropPercent = ((baselineUrlCount - urls.length) / baselineUrlCount) * 100;
  if (dropPercent > maximumDropPercent) {
    const message = `Indexable sitemap regression: ${urls.length} URLs vs ${baselineUrlCount} in ${sitemapBaseline.source} `
      + `(${dropPercent.toFixed(1)}% drop; allowed ${maximumDropPercent}%)`;
    errors.push(message);
  }
}
if (cmsContentUnavailable) warnings.push('SEO CMS snapshot is empty: expert and case markup stays disabled until verified records are published');
if (!snapshotExperts.length) warnings.push('SEO CMS snapshot contains no confirmed experts; personal expert markup remains disabled');
if (!snapshotCases.some((item) => item.status === 'published' && item.publishedAt)) warnings.push('SEO CMS snapshot contains no verified published case studies; case-study pages remain unpublished');
const snapshotExpertIds = new Set(snapshotExperts.map((item) => item.id));
for (const review of snapshotArticleReviews.filter((item) => item.reviewStatus === 'approved')) {
  if (!snapshotExpertIds.has(review.authorSlug) || !snapshotExpertIds.has(review.reviewerSlug) || !review.lastReviewedAt) {
    errors.push(`Approved article review is not linked to confirmed author/reviewer data: ${review.slug || 'unknown slug'}`);
  }
}
if (!/^<\?xml[^>]+>\s*<urlset[\s\S]*<\/urlset>\s*$/i.test(sitemap)) errors.push('Invalid sitemap XML document');
if (new Set(urls).size !== urls.length) errors.push('Duplicate URLs in sitemap');
const registry = JSON.parse(read(path.join(root, 'src', 'data', 'seoRegistry.generated.json')));
const seoPageContent = JSON.parse(read(path.join(root, 'src', 'data', 'seoPages.generated.json')));
const seoPageByPath = new Map(seoPageContent.map((entry) => [`/${entry.slug}`, entry]));
const registryByCanonical = new Map(registry.map((entry) => [entry.canonical, entry]));
const registryByPath = new Map(registry.map((entry) => [entry.path === '/kk/' ? '/kk' : entry.path, entry]));
const registryPaths = new Set(registry.map((entry) => entry.path));
const redirectConfig = read(path.join(root, 'deploy', 'nginx-host', 'snippets', 'legacy-redirects.conf'));
const redirectRules = [...redirectConfig.matchAll(/location\s+~\s+(\S+)\s*\{\s*return\s+301\s+([^;]+);/g)].map((match) => {
  try {
    return { source: match[1], destination: match[2], pattern: new RegExp(match[1]) };
  } catch {
    errors.push(`Invalid redirect regex in nginx config: ${match[1]}`);
    return undefined;
  }
}).filter(Boolean);
const redirectForPath = (pathname) => redirectRules.find((rule) => rule.pattern.test(pathname));
const titles = new Map();
const descriptions = new Map();
const headings = new Map();
const paragraphs = new Map();
const sitemapPaths = new Set(urls.map((url) => new URL(url).pathname));
const paragraphAllowlist = new Set([
  'расчёт является предварительным итоговая стоимость определяется после анализа объекта категории предприятия объёма работ и исходных документов',
  'ecoprogress group экологические документы лабораторные замеры пэк отходы и сопровождение бизнеса в казахстане',
]);
const normalizeText = (value) => value.replace(/<[^>]+>/g, ' ').replace(/&\w+;/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
const visibleText = (html) => normalizeText(html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
  .replace(/<header[\s\S]*?<\/header>/gi, ' ')
  .replace(/<footer[\s\S]*?<\/footer>/gi, ' '));
const schemas = (html) => [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
  try { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; } catch { return []; }
});

for (const url of urls) {
  let parsed;
  try { parsed = new URL(url); } catch { errors.push(`Invalid sitemap URL: ${url}`); continue; }
  if (parsed.origin !== SITE_URL) errors.push(`Wrong sitemap origin: ${url}`);
  if (parsed.search || parsed.hash) errors.push(`Query or fragment in sitemap: ${url}`);
  if (parsed.hostname.startsWith('www.')) errors.push(`WWW URL in sitemap: ${url}`);
  if (/^\/(?:staff|cabinet|client|admin|dashboard|internal|login|register|reset-password|api)(?:\/|$)/.test(parsed.pathname)) errors.push(`Private URL in sitemap: ${url}`);
  const registryEntry = registryByCanonical.get(url);
  if (!registryEntry) errors.push(`Sitemap URL missing from SEO registry: ${url}`);
  else if (registryEntry.robots !== 'index,follow' || !registryEntry.includeInSitemap) errors.push(`Noindex/excluded registry URL in sitemap: ${url}`);
  if (parsed.pathname === '/404') errors.push('404 must not be in sitemap');
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) errors.push(`Trailing slash in sitemap: ${url}`);
  if (redirectForPath(parsed.pathname)) errors.push(`Redirect URL present in sitemap: ${url}`);

  const file = pageFile(parsed.pathname);
  if (!fs.existsSync(file)) { errors.push(`Missing prerendered page: ${parsed.pathname}`); continue; }
  const html = read(file);
  const title = one(html, /<title>([\s\S]*?)<\/title>/i);
  const description = one(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const canonical = one(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const canonicalCount = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)].length;
  const robots = one(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const ogUrl = one(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  const ogImage = one(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const twitterCard = one(html, /<meta\s+name=["']twitter:card["']\s+content=["']([^"']+)["']/i);
  const h1Count = count(html, /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/gi);
  const h1 = normalizeText(one(html, /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i));
  const pageSchemas = schemas(html);
  const words = visibleText(html).split(' ').filter(Boolean);
  const htmlLang = one(html, /<html\s+[^>]*lang=["']([^"']+)["']/i);
  const hreflangs = new Map([...html.matchAll(/<link\s+rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => [match[1], match[2]]));

  if (!title) errors.push(`Missing title: ${parsed.pathname}`);
  if (!description) errors.push(`Missing description: ${parsed.pathname}`);
  if (h1Count !== 1) errors.push(`Expected one H1, found ${h1Count}: ${parsed.pathname}`);
  if (canonicalCount !== 1) errors.push(`Expected one canonical, found ${canonicalCount}: ${parsed.pathname}`);
  if (canonical !== url) errors.push(`Canonical mismatch at ${parsed.pathname}: ${canonical || 'missing'}`);
  if (htmlLang !== registryEntry?.locale) errors.push(`HTML lang mismatch at ${parsed.pathname}: ${htmlLang || 'missing'} !== ${registryEntry?.locale || 'missing locale'}`);
  if (registryEntry?.alternatePath) {
    const alternateEntry = registryByPath.get(registryEntry.alternatePath === '/kk/' ? '/kk' : registryEntry.alternatePath);
    if (!alternateEntry || alternateEntry.alternatePath !== registryEntry.path) errors.push(`Non-reciprocal locale pair: ${parsed.pathname}`);
    for (const alternate of registryEntry.alternates || []) {
      if (hreflangs.get(alternate.locale) !== alternate.url) errors.push(`Missing or wrong ${alternate.locale} hreflang: ${parsed.pathname}`);
      if (!sitemap.includes(`hreflang="${alternate.locale}" href="${alternate.url}"`)) errors.push(`Sitemap missing ${alternate.locale} alternate: ${parsed.pathname}`);
    }
  }
  if (ogUrl !== url) errors.push(`OG URL mismatch at ${parsed.pathname}: ${ogUrl || 'missing'}`);
  for (const property of ['og:type', 'og:title', 'og:description', 'og:image:width', 'og:image:height', 'og:locale', 'og:site_name']) {
    if (!new RegExp(`<meta\\s+property=["']${property}["']`, 'i').test(html)) errors.push(`Missing ${property}: ${parsed.pathname}`);
  }
  if (!twitterCard) errors.push(`Missing Twitter Card: ${parsed.pathname}`);
  if (robots !== 'index,follow') errors.push(`Unexpected robots at ${parsed.pathname}: ${robots || 'missing'}`);
  if (!/application\/ld\+json/i.test(html)) errors.push(`Missing JSON-LD: ${parsed.pathname}`);
  if (!/data-prerendered=["']true["']/i.test(html)) errors.push(`Missing prerender marker: ${parsed.pathname}`);
  const minimumWords = parsed.pathname === '/about' ? 220
    : parsed.pathname.startsWith('/services/') ? 150
      : parsed.pathname.startsWith('/ecologicheskie-uslugi-') ? 300
        : /^\/(?:ndv|pek|ovos|szz|puo|roos|pasport-othodov|ekologicheskoe-razreshenie|laboratornye-zamery|utilizaciya-othodov)-/.test(parsed.pathname) ? 300 : 0;
  if (minimumWords && words.length < minimumWords) errors.push(`Thin prerender content (${words.length}/${minimumWords} words): ${parsed.pathname}`);
  if (h1 && headings.has(h1)) errors.push(`Duplicate H1: ${parsed.pathname} and ${headings.get(h1)}`);
  else if (h1) headings.set(h1, parsed.pathname);
  if (!ogImage.startsWith(`${SITE_URL}/`)) errors.push(`Invalid OG image: ${parsed.pathname}`);
  else if (!fs.existsSync(path.join(dist, decodeURIComponent(new URL(ogImage).pathname).replace(/^\//, '')))) errors.push(`Missing OG image file: ${ogImage}`);
  if (title.length < 35 || title.length > 75) warnings.push(`Title length ${title.length}: ${parsed.pathname}`);
  if (description.length < 100 || description.length > 180) warnings.push(`Description length ${description.length}: ${parsed.pathname}`);
  if (/(?:localhost|127\.0\.0\.1|example\.(?:com|org)|test\.)/i.test(html)) errors.push(`Development/test host found: ${parsed.pathname}`);
  if (/href=["'](?:https:\/\/ecoprogress\.kz)?\/(?:services\/(?:eco-design|laboratory|permits|landfill|enterprise-support)(?=[/"'?#])|passport-othodov-kazakhstan|otchet-pek-kazakhstan|shtrafy-za-ekologiyu-kazakhstan|shtrafy-za-ekologicheskie-narusheniya-kazakhstan|news\/(?:kakie-shtrafy-za-ekologiyu-v-kazakhstane|komu-nuzhen-proizvodstvennyy-kontrol-ses|kak-poluchit-razreshenie-na-emissii|chto-takoe-pasport-othodov|kakie-dokumenty-proveryaet-ses|ekologicheskoe-soprovozhdenie-biznesa)|(?:passport-othodov|ovos-skrining-vozdeystviya|razreshenie-na-emissii|ekologicheskoe-proektirovanie|proizvodstvennyy-kontrol-ses|laboratornye-izmereniya|proekt-ndv|programma-pek|razrabotka-pek|proizvodstvennyy-ekologicheskiy-kontrol|proekt-szz|razdel-oos|programma-upravleniya-othodami|ekologicheskoe-razreshenie-na-vozdeystvie)-[^/"'#?]+)(?:["'#?])/i.test(html)) errors.push(`Legacy URL used internally: ${parsed.pathname}`);

  for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = image[1];
    if (!/\balt=["'][^"']*["']/i.test(attrs)) errors.push(`Image without alt: ${parsed.pathname}`);
    if (!/\bwidth=["'][^"']+["']/i.test(attrs) || !/\bheight=["'][^"']+["']/i.test(attrs)) errors.push(`Image without width/height: ${parsed.pathname}`);
  }

  if (titles.has(title)) errors.push(`Duplicate title: ${title} (${titles.get(title)}, ${parsed.pathname})`);
  else titles.set(title, parsed.pathname);
  if (descriptions.has(description)) errors.push(`Duplicate description: ${parsed.pathname} and ${descriptions.get(description)}`);
  else descriptions.set(description, parsed.pathname);

  for (const schema of pageSchemas) {
    if (schema['@type'] === 'Article' || schema['@type'] === 'BlogPosting') {
      for (const field of ['headline', 'description', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage', 'image']) if (!schema[field]) errors.push(`Article schema missing ${field}: ${parsed.pathname}`);
      if (schema.serviceType || schema.provider || schema.areaServed) errors.push(`Article contains Service fields: ${parsed.pathname}`);
      if (new Date(schema.dateModified).getTime() < new Date(schema.datePublished).getTime()) errors.push(`dateModified before datePublished: ${parsed.pathname}`);
    }
    if (schema['@type'] === 'Service') {
      for (const field of ['name', 'description', 'provider', 'areaServed', 'serviceType', 'url']) if (!schema[field]) errors.push(`Service schema missing ${field}: ${parsed.pathname}`);
      if (schema.offers && (!schema.offers.price || schema.offers.priceCurrency !== 'KZT')) errors.push(`Invalid Service offer: ${parsed.pathname}`);
    }
    if (schema['@type'] === 'LocalBusiness') {
      if (schema.address?.addressLocality !== 'Шымкент') errors.push(`LocalBusiness uses a non-office locality: ${parsed.pathname}`);
      if (!/(?:^|-)shymkent$/.test(parsed.pathname)) errors.push(`Non-Shymkent page must not claim LocalBusiness: ${parsed.pathname}`);
    }
  }
  for (const phrase of [/для Алматы и Алматинская область/iu, /в Караганда и Карагандинская область/iu, /для Астана и Акмолинская область/iu]) if (phrase.test(html)) errors.push(`Invalid region form at ${parsed.pathname}: ${phrase}`);
  for (const match of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    const href = match[1];
    let internalUrl;
    try { internalUrl = new URL(href, SITE_URL); } catch { continue; }
    if (!['ecoprogress.kz', 'www.ecoprogress.kz'].includes(internalUrl.hostname)) continue;
    if (/^\/(?:cabinet|staff|login|register)/.test(internalUrl.pathname)) continue;
    const redirectsByOrigin = internalUrl.protocol !== 'https:' || internalUrl.hostname !== 'ecoprogress.kz';
    const redirectsBySlash = internalUrl.pathname !== '/' && internalUrl.pathname.endsWith('/');
    const redirectRule = redirectForPath(internalUrl.pathname);
    if (redirectsByOrigin || redirectsBySlash || redirectRule) {
      errors.push(`Internal link leads through 301: ${parsed.pathname} -> ${href}`);
    }
    const target = internalUrl.pathname.replace(/\/$/, '') || '/';
    if (!registryPaths.has(target) && !fs.existsSync(pageFile(target))) warnings.push(`Broken internal link: ${parsed.pathname} -> ${target}`);
  }
  for (const match of html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)) {
    const paragraph = normalizeText(match[1]);
    if (paragraph.length <= 80 || paragraphAllowlist.has(paragraph)) continue;
    const paths = paragraphs.get(paragraph) || new Set(); paths.add(parsed.pathname); paragraphs.set(paragraph, paths);
  }
}

const indexableTitles = new Map();
const indexableHeadings = new Map();
for (const entry of registry.filter((item) => item.robots === 'index,follow')) {
  const sitemapPath = entry.path === '/kk/' ? '/kk' : entry.path;
  const expectedCanonical = `${SITE_URL}${sitemapPath === '/' ? '' : sitemapPath}`;
  if (!entry.includeInSitemap) errors.push(`Indexable registry page is excluded from sitemap: ${entry.path}`);
  if (!sitemapPaths.has(sitemapPath)) errors.push(`Indexable registry page missing from sitemap: ${entry.path}`);
  const file = pageFile(entry.path);
  if (!fs.existsSync(file)) {
    errors.push(`Static HTTP status would be 404: ${entry.path}`);
    continue;
  }
  const html = read(file);
  const canonical = one(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const canonicalCount = count(html, /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi);
  const title = one(html, /<title>([\s\S]*?)<\/title>/i);
  const h1 = normalizeText(one(html, /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i));
  if (entry.canonical !== expectedCanonical) errors.push(`Registry canonical is not final URL: ${entry.path} -> ${entry.canonical}`);
  if (canonicalCount !== 1 || canonical !== expectedCanonical) errors.push(`Indexable page has no valid self-canonical: ${entry.path}`);
  if (!title) errors.push(`Indexable page has no title: ${entry.path}`);
  else if (indexableTitles.has(title)) errors.push(`Duplicate indexable title: ${entry.path} and ${indexableTitles.get(title)}`);
  else indexableTitles.set(title, entry.path);
  if (!h1) errors.push(`Indexable page has no H1: ${entry.path}`);
  else if (indexableHeadings.has(h1)) errors.push(`Duplicate indexable H1: ${entry.path} and ${indexableHeadings.get(h1)}`);
  else indexableHeadings.set(h1, entry.path);
}

for (const [paragraph, paths] of paragraphs) {
  const cities = new Set([...paths].map((pathname) => seoPageByPath.get(pathname)?.city).filter(Boolean));
  if (cities.size > 5) warnings.push(`Repeated regional paragraph across ${cities.size} cities (${paths.size} pages): ${paragraph.slice(0, 100)}…`);
}

const regionEntries = seoPageContent.filter((entry) => entry.type === 'city' && entry.indexable !== false);
const tokens = (value) => {
  const words = normalizeText(value).split(' ').filter(Boolean);
  return new Set(words.slice(0, Math.max(0, words.length - 4)).map((_, index) => words.slice(index, index + 5).join(' ')));
};
for (let index = 0; index < regionEntries.length; index += 1) {
  for (let other = index + 1; other < regionEntries.length; other += 1) {
    const regionText = (entry) => [entry.intro, ...entry.sections.map((section) => `${section.title} ${section.body}`), ...entry.faq.map((faq) => `${faq.question} ${faq.answer}`)].join(' ');
    const left = tokens(regionText(regionEntries[index]));
    const right = tokens(regionText(regionEntries[other]));
    const intersection = [...left].filter((token) => right.has(token)).length;
    const similarity = intersection / Math.max(1, new Set([...left, ...right]).size);
    const message = `Regional text similarity ${(similarity * 100).toFixed(0)}%: /${regionEntries[index].slug} and /${regionEntries[other].slug}`;
    if (similarity >= 0.82) errors.push(message);
    else if (similarity >= 0.68) warnings.push(message);
  }
}

const serviceCityEntries = seoPageContent.filter((entry) => entry.type === 'service-city' && entry.indexable !== false);
const shingles = (value, width = 5) => {
  const words = normalizeText(value).split(' ').filter(Boolean);
  return new Set(words.slice(0, Math.max(0, words.length - width + 1)).map((_, index) => words.slice(index, index + width).join(' ')));
};
const pageBody = (entry) => [entry.intro, ...entry.sections.map((section) => `${section.title} ${section.body}`), ...entry.faq.map((faq) => `${faq.question} ${faq.answer}`), entry.ctaTitle, entry.ctaText].filter(Boolean).join(' ');
const groupedServiceCities = new Map();
for (const entry of serviceCityEntries) groupedServiceCities.set(entry.service, [...(groupedServiceCities.get(entry.service) || []), entry]);
for (const [service, entries] of groupedServiceCities) {
  for (let index = 0; index < entries.length; index += 1) {
    const left = shingles(pageBody(entries[index]));
    for (let other = index + 1; other < entries.length; other += 1) {
      const right = shingles(pageBody(entries[other]));
      const intersection = [...left].filter((item) => right.has(item)).length;
      const union = new Set([...left, ...right]).size;
      const similarity = intersection / Math.max(1, union);
      const message = `Service-city text similarity ${(similarity * 100).toFixed(0)}% (${service}): /${entries[index].slug} and /${entries[other].slug}`;
      if (similarity >= 0.82) errors.push(message);
      else if (similarity >= 0.68) warnings.push(message);
    }
  }
}

const serviceCatalogSource = read(path.join(root, 'src', 'content', 'serviceCatalog.ts'));
if (/\b150000\b/.test(serviceCatalogSource) || /\?\?\s*150000/.test(read(path.join(root, 'src', 'pages', 'ServicesPage.tsx')))) errors.push('Invented default price 150000 is still present');

const notFoundFile = path.join(dist, '404.html');
if (!fs.existsSync(notFoundFile)) errors.push('Missing dist/404.html');
else {
  const notFound = read(notFoundFile);
  if (!/name=["']robots["']\s+content=["']noindex,follow["']/i.test(notFound)) errors.push('404 must contain noindex,follow');
  if (count(notFound, /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/gi) !== 1) errors.push('404 must contain exactly one H1');
}

const contactsHtml = read(pageFile('/contacts'));
const contactOrganization = registry.find((entry) => entry.path === '/contacts')?.schema.find((item) => {
  const type = item['@type'];
  return type === 'Organization' || (Array.isArray(type) && type.includes('Organization'));
});
for (const expected of [contactOrganization?.telephone, contactOrganization?.email, contactOrganization?.address?.streetAddress, 'Пн-Пт, 09:00-18:00'].filter(Boolean)) {
  if (!contactsHtml.includes(expected)) errors.push(`Contacts prerender missing real contact field: ${expected}`);
}
if (/Основные услуги[\s\S]*Города Казахстана/.test(contactsHtml)) errors.push('Contacts prerender still contains the generic static-page template');

for (const warning of warnings) console.warn(`WARNING ${warning}`);
if (errors.length) {
  console.error(errors.map((error) => `ERROR ${error}`).join('\n'));
  process.exit(1);
}
console.log(`PASS SEO audit: ${urls.length} indexable pages, ${warnings.length} non-blocking warnings.`);
