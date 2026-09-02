import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const registryPath = path.join(root, 'src', 'data', 'seoRegistry.generated.json');
const sourceArgument = process.argv[2];
const liveAll = sourceArgument === '--live';
const sourceUrl = liveAll ? undefined : sourceArgument;
const detailedRoute = '/services/report-pek';
const siteOrigin = 'https://ecoprogress.kz';
if (!fs.existsSync(registryPath)) throw new Error(`Prerender SEO content check: missing ${registryPath}.`);
const indexable = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  .filter((entry) => entry.robots === 'index,follow');
const redirectConfig = fs.readFileSync(
  path.join(root, 'deploy', 'nginx-host', 'snippets', 'legacy-redirects.conf'),
  'utf8',
);
const redirectRules = [...redirectConfig.matchAll(/location\s+~\s+(\S+)\s*\{\s*return\s+301\s+([^;]+);/g)]
  .map((match) => new RegExp(match[1]));

const pageFile = (route) => route === '/'
  ? path.join(dist, 'index.html')
  : path.join(dist, route.replace(/^\//, ''), 'index.html');
const fail = (route, message) => {
  throw new Error(`Prerender SEO content check (${route}): ${message}`);
};
const countTags = (html, tag) => (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || []).length;
const visibleTextFor = (html) => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(?:nbsp|amp|quot|#39);/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const verifyPage = ({ route, canonical, html, detailed = false }) => {
  if (html.includes('\0')) fail(route, 'HTML contains a NUL byte.');
  if (!html.includes('data-prerendered="true"')) fail(route, 'root is not marked as prerendered.');
  if (!/<main(?:\s|>)/i.test(html)) fail(route, 'shared React tree contains no main element.');
  if (html.includes('seo-static-page') || html.includes('seo-static-header')) {
    fail(route, 'legacy handcrafted SEO body is present instead of the shared React tree.');
  }

  const requiredHead = [
    ['title', /<title>[^<]{20,}<\/title>/i],
    ['meta description', /<meta\s+name=["']description["']\s+content=["'][^"']{80,}["']\s*\/?>/i],
    ['index,follow', /<meta\s+name=["']robots["']\s+content=["']index,follow["']\s*\/?>/i],
    ['self canonical', new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${canonical}["']\\s*\\/?>`, 'i')],
  ];
  for (const [label, pattern] of requiredHead) {
    if (!pattern.test(html)) fail(route, `${label} is missing or incomplete.`);
  }

  const h1Count = countTags(html, 'h1');
  if (h1Count !== 1) fail(route, `expected exactly one H1, found ${h1Count}.`);
  const visibleText = visibleTextFor(html);
  const wordCount = visibleText.split(/\s+/u).filter(Boolean).length;
  if (wordCount < 100) fail(route, `HTML is too thin to be a complete page (${wordCount} visible words).`);

  if (route === '/kk' || route.startsWith('/kk/')) {
    const forbiddenRussianUi = [
      'Нормативная база', 'Подтверждает', 'Источник:', 'Статус:', 'Проверено:', 'Короткий ответ',
      'Получить консультацию эколога', 'Социальные сети', 'Поиск по сайту', 'Регистрация',
      'Войти', 'Частые вопросы', 'Написать в WhatsApp', 'г. Шымкент',
    ];
    const leakedLabel = forbiddenRussianUi.find((label) => visibleText.includes(label));
    if (leakedLabel) fail(route, `Russian interface text leaked into kk-KZ: ${leakedLabel}.`);
  }

  const internalLinks = new Set(
    [...html.matchAll(/href=["'](\/[^"'#?]*)["']/gi)].map((match) => match[1]),
  );
  if (internalLinks.size < 3) fail(route, `too few internal links (${internalLinks.size}).`);
  for (const match of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    const href = match[1];
    let url;
    try { url = new URL(href, siteOrigin); } catch { continue; }
    if (!['ecoprogress.kz', 'www.ecoprogress.kz'].includes(url.hostname)) continue;
    const redirects = url.protocol !== 'https:' || url.hostname !== 'ecoprogress.kz'
      || (url.pathname !== '/' && url.pathname.endsWith('/'))
      || redirectRules.some((pattern) => pattern.test(url.pathname));
    if (redirects) fail(route, `internal link leads through 301: ${href}.`);
  }

  if (detailed) {
    if (countTags(html, 'h2') < 8) fail(route, 'service document must contain at least eight H2 sections.');
    if (wordCount < 350) fail(route, `service document is too thin (${wordCount} visible words).`);
    const requiredContent = [
      ['main service text', /Проверяем результаты производственного экологического контроля/u],
      ['price', /Стоимость/u],
      ['delivery terms', /Срок/u],
      ['FAQ', /(?:FAQ|Частые вопросы)/u],
      ['legal basis', /Нормативная база/u],
      ['related services', /Связанные услуги/u],
    ];
    for (const [label, pattern] of requiredContent) {
      if (!pattern.test(visibleText)) fail(route, `${label} is absent from HTML visible without JavaScript.`);
    }
    for (const href of ['/services/program-pek', '/services/laboratory-tests', '/services/ecological-support']) {
      if (!internalLinks.has(href)) fail(route, `required internal link is missing: ${href}.`);
    }
  }

  return { route, wordCount, h2Count: countTags(html, 'h2'), internalLinkCount: internalLinks.size };
};

if (liveAll) {
  const sitemapResponse = await fetch(`${siteOrigin}/sitemap.xml`, { redirect: 'error' });
  if (sitemapResponse.status !== 200) throw new Error(`Live sitemap returned HTTP ${sitemapResponse.status}.`);
  const sitemap = await sitemapResponse.text();
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const expectedUrls = new Set(indexable.map((entry) => entry.canonical));
  if (sitemapUrls.size !== expectedUrls.size || [...expectedUrls].some((url) => !sitemapUrls.has(url))) {
    const missing = [...expectedUrls].filter((url) => !sitemapUrls.has(url));
    const extra = [...sitemapUrls].filter((url) => !expectedUrls.has(url));
    throw new Error(
      `Live sitemap differs from registry: expected ${expectedUrls.size}, got ${sitemapUrls.size}; `
      + `missing ${missing.length}${missing[0] ? ` (${missing[0]})` : ''}; `
      + `extra ${extra.length}${extra[0] ? ` (${extra[0]})` : ''}.`,
    );
  }
  const results = [];
  for (const entry of indexable) {
    const response = await fetch(entry.canonical, { redirect: 'error' });
    if (response.status !== 200) fail(entry.path, `live URL returned HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.includes('text/html')) fail(entry.path, 'live URL did not return HTML.');
    results.push(verifyPage({
      route: entry.path,
      canonical: entry.canonical,
      html: await response.text(),
      detailed: entry.path === detailedRoute,
    }));
  }
  console.log(`Live prerender SEO content check passed for all ${results.length} indexable pages.`);
} else if (sourceUrl) {
  const response = await fetch(sourceUrl, { redirect: 'error' });
  if (response.status !== 200) throw new Error(`Prerender SEO content check: ${sourceUrl} returned HTTP ${response.status}.`);
  if (!response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`Prerender SEO content check: ${sourceUrl} did not return HTML.`);
  }
  const result = verifyPage({
    route: detailedRoute,
    canonical: `${siteOrigin}${detailedRoute}`,
    html: await response.text(),
    detailed: true,
  });
  console.log(
    `Prerender SEO content check passed for ${sourceUrl}: ${result.wordCount} visible words, `
    + `${result.h2Count} H2 sections and ${result.internalLinkCount} internal links.`,
  );
} else {
  const results = indexable.map((entry) => {
    const file = pageFile(entry.path);
    if (!fs.existsSync(file)) fail(entry.path, 'prerendered HTML file is missing (not 200-ready).');
    return verifyPage({
      route: entry.path,
      canonical: entry.canonical,
      html: fs.readFileSync(file, 'utf8'),
      detailed: entry.path === detailedRoute,
    });
  });
  const thinnest = results.reduce((lowest, result) => result.wordCount < lowest.wordCount ? result : lowest);
  console.log(
    `Prerender SEO content check passed for all ${results.length} indexable pages; `
    + `thinnest is ${thinnest.route} with ${thinnest.wordCount} visible words.`,
  );
}
