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

  if (!title) errors.push(`Missing title: ${parsed.pathname}`);
  if (!description) errors.push(`Missing description: ${parsed.pathname}`);
  if (h1Count !== 1) errors.push(`Expected one H1, found ${h1Count}: ${parsed.pathname}`);
  if (canonical !== url) errors.push(`Canonical mismatch at ${parsed.pathname}: ${canonical || 'missing'}`);
  if (ogUrl !== url) errors.push(`OG URL mismatch at ${parsed.pathname}: ${ogUrl || 'missing'}`);
  if (robots !== 'index,follow') errors.push(`Unexpected robots at ${parsed.pathname}: ${robots || 'missing'}`);
  if (!/application\/ld\+json/i.test(html)) errors.push(`Missing JSON-LD: ${parsed.pathname}`);
  if (!ogImage.startsWith(`${SITE_URL}/`)) errors.push(`Invalid OG image: ${parsed.pathname}`);
  else if (!fs.existsSync(path.join(dist, decodeURIComponent(new URL(ogImage).pathname).replace(/^\//, '')))) errors.push(`Missing OG image file: ${ogImage}`);
  if (title.length < 35 || title.length > 75) warnings.push(`Title length ${title.length}: ${parsed.pathname}`);
  if (description.length < 100 || description.length > 180) warnings.push(`Description length ${description.length}: ${parsed.pathname}`);

  if (titles.has(title)) errors.push(`Duplicate title: ${title} (${titles.get(title)}, ${parsed.pathname})`);
  else titles.set(title, parsed.pathname);
  if (descriptions.has(description)) errors.push(`Duplicate description: ${parsed.pathname} and ${descriptions.get(description)}`);
  else descriptions.set(description, parsed.pathname);
}

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
console.log(`SEO audit passed: ${urls.length} indexable pages, ${warnings.length} non-blocking length warnings.`);
