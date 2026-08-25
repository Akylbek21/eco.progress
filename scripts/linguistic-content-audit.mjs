import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pages = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'seoPages.generated.json'), 'utf8'));
const regional = pages.filter((page) => page.type === 'city' || page.type === 'service-city');
const russianRegional = regional.filter((page) => page.locale !== 'kk');
const kazakhRegional = regional.filter((page) => page.locale === 'kk');
const errors = [];
const warnings = [];
const add = (target, message) => errors.push(`${target}: ${message}`);
const normalize = (value) => String(value ?? '').toLowerCase().replace(/ё/gu, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = (value) => new Set(normalize(value).split(/\s+/u).filter((word) => word.length > 2));
const similarity = (left, right) => {
  const a = tokens(left); const b = tokens(right);
  const common = [...a].filter((word) => b.has(word)).length;
  return common / Math.max(1, Math.min(a.size, b.size));
};
const forms = ['cityNominative', 'cityGenitive', 'cityDative', 'cityInstrumental', 'cityPrepositional', 'regionNominative', 'regionGenitive', 'regionDative', 'regionInstrumental', 'regionPrepositional'];

const cityPages = russianRegional.filter((page) => page.type === 'city');
const namesBySlug = new Map(cityPages.map((page) => [page.slug.replace('ecologicheskie-uslugi-', ''), page]));
for (const page of russianRegional) {
  const target = `/${page.slug}`;
  for (const field of forms) if (!String(page[field] ?? '').trim()) add(target, `не заполнена форма ${field}`);
  if (!page.h1.endsWith(`в ${page.cityPrepositional}`)) add(target, `H1 должен использовать предложный падеж «в ${page.cityPrepositional}»`);
  if (!page.title.includes(`в ${page.cityPrepositional}`)) add(target, `title должен использовать предложный падеж «в ${page.cityPrepositional}»`);
  const primary = [page.title, page.description, page.h1, page.intro].join(' ');
  if (page.cityGenitive !== page.cityPrepositional && new RegExp(`(?:в|на) ${page.cityGenitive}(?:\\b|$)`, 'iu').test(primary)) add(target, `после «в/на» использован родительный падеж города ${page.cityGenitive}`);
  if (page.cityGenitive !== page.cityPrepositional && new RegExp(`(?:из|для) ${page.cityPrepositional}(?:\\b|$)`, 'iu').test(primary)) add(target, `после «из/для» использован предложный падеж города ${page.cityPrepositional}`);
  for (const [, other] of namesBySlug) {
    if (other.cityNominative === page.cityNominative) continue;
    if (new RegExp(`(?:^|\\s)${other.cityNominative}(?:\\s|[,.!?]|$)`, 'iu').test([page.title, page.h1].join(' '))) add(target, `title/H1 содержит другой город: ${other.cityNominative}`);
  }
}
for (const page of kazakhRegional) {
  const target = `/${page.slug}`;
  if (page.locale !== 'kk') add(target, 'KK өңірлік бетінде locale=kk көрсетілмеген');
  if (page.city === 'Шымкент' && !`${page.title} ${page.h1}`.includes('Шымкенттегі')) add(target, 'қала атауы табиғи жатыс/қатыстық нысанда қолданылмаған: «Шымкенттегі»');
}

const metadata = ['title', 'description', 'h1'];
for (const field of metadata) {
  const seen = new Map();
  for (const page of regional) {
    const value = normalize(page[field]);
    if (seen.has(value)) add(`/${page.slug}`, `${field} полностью совпадает с /${seen.get(value)}`);
    else seen.set(value, page.slug);
  }
}

const mainText = (page) => [page.intro, ...(page.sections ?? []).map((section) => `${section.title} ${section.body}`)].join(' ');
const exactMain = new Map();
for (const page of regional) {
  const value = normalize(mainText(page));
  if (exactMain.has(value)) add(`/${page.slug}`, `основной региональный текст совпадает с /${exactMain.get(value)}`);
  else exactMain.set(value, page.slug);
}
for (let left = 0; left < regional.length; left += 1) for (let right = left + 1; right < regional.length; right += 1) {
  const a = regional[left]; const b = regional[right];
  if (a.type !== b.type || (a.type === 'service-city' && a.serviceSlug !== b.serviceSlug)) continue;
  const titleScore = similarity(`${a.title} ${a.description} ${a.h1}`, `${b.title} ${b.description} ${b.h1}`);
  const contentScore = similarity(mainText(a), mainText(b));
  if (titleScore >= 0.97) add(`/${a.slug} ↔ /${b.slug}`, `метаданные слишком похожи (${Math.round(titleScore * 100)}%)`);
  else if (titleScore >= 0.95) warnings.push(`/${a.slug} ↔ /${b.slug}: сходство метаданных ${Math.round(titleScore * 100)}%`);
  if (contentScore >= 0.97) add(`/${a.slug} ↔ /${b.slug}`, `основной контент слишком похож (${Math.round(contentScore * 100)}%)`);
  else if (contentScore >= 0.95) warnings.push(`/${a.slug} ↔ /${b.slug}: сходство основного контента ${Math.round(contentScore * 100)}%`);
}

for (const warning of warnings.slice(0, 25)) console.warn(`WARNING [linguistic-content] ${warning}`);
if (warnings.length > 25) console.warn(`WARNING [linguistic-content] ещё ${warnings.length - 25} сходных пар; полный список доступен при снижении порога в audit`);
for (const error of errors) console.error(`ERROR [linguistic-content] ${error}`);
console.log(`Linguistic/content audit: ${regional.length} regional pages, ${errors.length} errors, ${warnings.length} warnings.`);
if (errors.length) process.exitCode = 1;
