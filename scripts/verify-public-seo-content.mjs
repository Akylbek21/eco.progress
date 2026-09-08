import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const registryPath = path.join(root, 'src', 'data', 'seoRegistry.generated.json');

if (!fs.existsSync(dist) || !fs.existsSync(registryPath)) {
  throw new Error('Public SEO content test requires build and prerender output');
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const publicPages = [...registry, { path: '/404', robots: 'noindex,follow' }];
const failures = [];

const decodeEntities = (value) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
  .replace(/&(?:nbsp|#160);/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const searchableText = (html) => {
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join(' ');
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ?? '';
  const visibleBody = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(`${title} ${description} ${visibleBody} ${jsonLd}`)
    .replace(/\s+/g, ' ')
    .trim();
};

const forbidden = [
  ['undefined', /\bundefined\b/i],
  ['null', /\bnull\b/i],
  ['NaN', /\bNaN\b/],
  ['пустой опыт', /\bопыт\s*:?\s*лет\b/i],
  ['невалидный опыт', /\b(?:опыт\s*:?\s*)?(?:undefined|null|NaN)\s+лет\b/i],
  ['внутренний review status', /материал\s+требует\s+проверки\s+профильным\s+экологом/i],
  ['submissionDueDate', /\bsubmissionDueDate\b/i],
  ['regulationVersion', /\bregulationVersion\b/i],
  ['templateVersion', /\btemplateVersion\b/i],
  ['contentRevision', /\bcontentRevision\b/i],
  ['reportContentRevision', /\breportContentRevision\b/i],
  ['availableActions', /\bavailableActions\b/i],
  ['If-Match', /\bIf-Match\b/i],
  ['internal reviewer field', /\breviewer(?:Slug|Id)\b/i],
  ['устаревший адрес Алимбетова', /\bАлимбетова\b/iu],
  ['устаревший номер адреса 199/2', /\b199\/2\b/u],
  ['для Шымкент', /\bдля\s+Шымкент(?=[\s.,;:!?])/iu],
  ['в Шымкент', /\bв\s+Шымкент(?=\s)/iu],
  ['из Шымкент', /\bиз\s+Шымкент(?=[\s.,;:!?])/iu],
];

const pageFile = (routePath) => routePath === '/'
  ? path.join(dist, 'index.html')
  : path.join(dist, routePath.replace(/^\//, ''), 'index.html');

for (const entry of publicPages) {
  const file = pageFile(entry.path);
  if (!fs.existsSync(file)) {
    failures.push(`${entry.path}: prerendered HTML is missing`);
    continue;
  }
  const text = searchableText(fs.readFileSync(file, 'utf8'));
  for (const [label, pattern] of forbidden) {
    const match = text.match(pattern);
    if (match) failures.push(`${entry.path}: ${label} -> "${match[0]}"`);
  }
}

const publicAddresses = new Set(registry.flatMap((entry) => entry.schema ?? [])
  .filter((entity) => {
    const type = entity['@type'];
    return type === 'Organization' || type === 'LocalBusiness' || (Array.isArray(type) && type.includes('LocalBusiness'));
  })
  .map((entity) => [entity.address?.addressLocality, entity.address?.streetAddress].filter(Boolean).join(', '))
  .filter(Boolean));

if (publicAddresses.size !== 1) failures.push(`public company address conflict: ${[...publicAddresses].join(' | ') || 'address missing'}`);
if ([...publicAddresses].some((address) => /Алимбетова|199\/2/iu.test(address))) failures.push('legacy company address is present in public schema');

if (failures.length) {
  console.error(failures.map((failure) => `ERROR ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Public SEO content check passed: ${publicPages.length} prerendered HTML pages, one company address (${[...publicAddresses][0]}).`);
