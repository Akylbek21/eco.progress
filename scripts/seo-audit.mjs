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
const schemas = (html) => [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
  try { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; } catch { return []; }
});

for (const url of urls) {
  let parsed;
  try { parsed = new URL(url); } catch { errors.push(`Invalid sitemap URL: ${url}`); continue; }
  if (parsed.origin !== SITE_URL) errors.push(`Wrong sitemap origin: ${url}`);
  if (/^\/(?:staff|cabinet|admin|login|register|reset-password)(?:\/|$)/.test(parsed.pathname)) errors.push(`Private URL in sitemap: ${url}`);
  if (parsed.pathname === '/404') errors.push('404 must not be in sitemap');
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) errors.push(`Trailing slash in sitemap: ${url}`);

  const file = pageFile(parsed.pathname);
  if (!fs.existsSync(file)) { errors.push(`Missing prerendered page: ${parsed.pathname}`); continue; }
  const html = read(file);
  const title = one(html, /<title>([\s\S]*?)<\/title>/i);
  const description = one(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const canonical = one(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const robots = one(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const ogUrl = one(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  const ogImage = one(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const h1Count = count(html, /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/gi);
  const h1 = normalizeText(one(html, /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i));
  const pageSchemas = schemas(html);

  if (!title) errors.push(`Missing title: ${parsed.pathname}`);
  if (!description) errors.push(`Missing description: ${parsed.pathname}`);
  if (h1Count !== 1) errors.push(`Expected one H1, found ${h1Count}: ${parsed.pathname}`);
  if (canonical !== url) errors.push(`Canonical mismatch at ${parsed.pathname}: ${canonical || 'missing'}`);
  if (ogUrl !== url) errors.push(`OG URL mismatch at ${parsed.pathname}: ${ogUrl || 'missing'}`);
  if (robots !== 'index,follow') errors.push(`Unexpected robots at ${parsed.pathname}: ${robots || 'missing'}`);
  if (!/application\/ld\+json/i.test(html)) errors.push(`Missing JSON-LD: ${parsed.pathname}`);
  if (h1 && headings.has(h1)) errors.push(`Duplicate H1: ${parsed.pathname} and ${headings.get(h1)}`);
  else if (h1) headings.set(h1, parsed.pathname);
  if (!ogImage.startsWith(`${SITE_URL}/`)) errors.push(`Invalid OG image: ${parsed.pathname}`);
  else if (!fs.existsSync(path.join(dist, decodeURIComponent(new URL(ogImage).pathname).replace(/^\//, '')))) errors.push(`Missing OG image file: ${ogImage}`);
  if (title.length < 35 || title.length > 75) warnings.push(`Title length ${title.length}: ${parsed.pathname}`);
  if (description.length < 100 || description.length > 180) warnings.push(`Description length ${description.length}: ${parsed.pathname}`);

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
      if (parsed.pathname.startsWith('/ecologicheskie-uslugi-')) errors.push(`Regional page must not claim LocalBusiness: ${parsed.pathname}`);
    }
  }
  for (const phrase of [/для Алматы и Алматинская область/iu, /в Караганда и Карагандинская область/iu, /для Астана и Акмолинская область/iu]) if (phrase.test(html)) errors.push(`Invalid region form at ${parsed.pathname}: ${phrase}`);
  for (const match of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    const href = match[1];
    if (!href.startsWith('/') || /^\/(?:cabinet|staff|login|register)/.test(href)) continue;
    const target = href.replace(/\?.*$/, '').replace(/\/$/, '') || '/';
    if (!sitemapPaths.has(target)) warnings.push(`Internal link target is not indexable: ${parsed.pathname} -> ${target}`);
  }
  for (const match of html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)) {
    const paragraph = normalizeText(match[1]);
    if (paragraph.length <= 80 || paragraphAllowlist.has(paragraph)) continue;
    const paths = paragraphs.get(paragraph) || new Set(); paths.add(parsed.pathname); paragraphs.set(paragraph, paths);
  }
}

for (const [paragraph, paths] of paragraphs) if (paths.size > 5) warnings.push(`Repeated paragraph on ${paths.size} pages: ${paragraph.slice(0, 100)}…`);

const serviceCatalogSource = read(path.join(root, 'src', 'content', 'serviceCatalog.ts'));
if (/\b150000\b/.test(serviceCatalogSource) || /\?\?\s*150000/.test(read(path.join(root, 'src', 'pages', 'ServicesPage.tsx')))) errors.push('Invented default price 150000 is still present');

const notFoundFile = path.join(dist, '404.html');
if (!fs.existsSync(notFoundFile)) errors.push('Missing dist/404.html');
else {
  const notFound = read(notFoundFile);
  if (!/name=["']robots["']\s+content=["']noindex,follow["']/i.test(notFound)) errors.push('404 must contain noindex,follow');
  if (count(notFound, /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/gi) !== 1) errors.push('404 must contain exactly one H1');
}

for (const warning of warnings) console.warn(`SEO warning: ${warning}`);
if (errors.length) {
  console.error(errors.map((error) => `SEO error: ${error}`).join('\n'));
  process.exit(1);
}
console.log(`SEO audit passed: ${urls.length} indexable pages, ${warnings.length} non-blocking warnings.`);
