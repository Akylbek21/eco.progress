import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const dir = new URL('./', import.meta.url);
const sitemap = await fs.readFile(new URL('sitemap.xml', dir), 'utf8');
const queue = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
const seen = new Set(queue), results = [];
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
async function crawl(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const dom = new JSDOM(html, { url }); const doc = dom.window.document;
  const allLinks = [...doc.querySelectorAll('a[href]')].map(a => ({ href: a.href.split('#')[0], text: clean(a.textContent) }));
  const structured = [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(s => { try { return JSON.parse(s.textContent); } catch { return []; } });
  doc.querySelectorAll('script,style,nav,footer').forEach(el => el.remove());
  const main = doc.querySelector('main') || doc.body;
  const text = clean(main.textContent);
  const data = {
    url, finalUrl: response.url, status: response.status, date: new Date().toISOString(), bytes: Buffer.byteLength(html),
    title: clean(doc.title), description: doc.querySelector('meta[name="description"]')?.content || '',
    robots: doc.querySelector('meta[name="robots"]')?.content || '', xRobots: response.headers.get('x-robots-tag'),
    canonical: doc.querySelector('link[rel="canonical"]')?.href || '',
    hreflang: [...doc.querySelectorAll('link[hreflang]')].map(n => [n.hreflang,n.href]),
    headings: [...main.querySelectorAll('h1,h2,h3')].map(n => ({ level: n.tagName, text: clean(n.textContent) })),
    wordCount: text.split(/\s+/).length,
    cta: [...main.querySelectorAll('a,button')].map(n => clean(n.textContent)).filter(s => /получить|заказать|рассчитать|консультац|заявк|WhatsApp|расчёт/i.test(s)),
    internalLinks: [...new Set(allLinks.filter(l => l.href.startsWith('https://ecoprogress.kz')).map(l => l.href))],
    contextualLinks: [...new Set([...main.querySelectorAll('a[href]')].map(n => n.href).filter(h => h.startsWith('https://ecoprogress.kz')))],
    caseLinks: [...new Set(allLinks.filter(l => /ecoprogress.kz\/cases\//.test(l.href)).map(l => l.href))],
    expertLinks: [...new Set(allLinks.filter(l => /ecoprogress.kz\/experts\//.test(l.href)).map(l => l.href))],
    legalLinks: [...new Set(allLinks.filter(l => /adilet|gov.kz|egov|elicense|nca.kz/.test(l.href)).map(l => l.href))],
    fileLinks: [...new Set(allLinks.filter(l => /\.(pdf|jpg|png|docx?)(\?|$)/i.test(l.href)).map(l => l.href))],
    structured, text,
  };
  for (const link of allLinks) if (link.href.startsWith('https://ecoprogress.kz/') && /\/(services|news|experts|cases)\//.test(link.href) && !seen.has(link.href) && !link.href.includes('?')) { seen.add(link.href); queue.push(link.href); }
  dom.window.close(); return data;
}
while (queue.length) {
  const batch = queue.splice(0, 4);
  const items = await Promise.all(batch.map(url => crawl(url).catch(e => ({ url, error: e.message }))));
  results.push(...items);
  console.log('Fetched',results.length,'pending',queue.length);
}
await fs.writeFile(new URL('ecoprogress-crawl.json',dir),JSON.stringify(results,null,2));
const services = results.filter(r => new URL(r.url).pathname.startsWith('/services/'));
console.log(JSON.stringify(services.map(s => ({url:s.url,title:s.title,description:s.description,h1:s.headings?.filter(h=>h.level==='H1'),words:s.wordCount,h2:s.headings?.filter(h=>h.level==='H2').map(h=>h.text),cases:s.caseLinks?.length,experts:s.expertLinks?.length,legal:s.legalLinks?.length})),null,2));
