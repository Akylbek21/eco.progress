import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
const out = new URL('./', import.meta.url);
const clean = s => (s || '').replace(/\s+/g,' ').trim();
const hosts = ['ecoprogress.kz','npieco.kz'];
for (const host of hosts) {
  const base = `https://${host}`;
  const fetchText = async url => { const r = await fetch(url,{signal:AbortSignal.timeout(25000)}); return {r,text:await r.text()}; };
  const {text:sitemap} = await fetchText(base+'/sitemap.xml');
  await fs.writeFile(new URL(host+'-sitemap.xml',out),sitemap);
  const {text:robots} = await fetchText(base+'/robots.txt');
  await fs.writeFile(new URL(host+'-robots.txt',out),robots);
  const queue = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).href))];
  const seeded = new Set(queue), seen = new Set(queue), rows=[];
  while(queue.length) {
    const batch=queue.splice(0,3);
    rows.push(...await Promise.all(batch.map(async url=>{
      try {
        const start=Date.now(); const {r,text:html}=await fetchText(url); const elapsedMs=Date.now()-start;
        const dom=new JSDOM(html,{url:r.url}); const d=dom.window.document;
        const links=[...d.querySelectorAll('a[href]')].map(a=>({url:a.href.split('#')[0],text:clean(a.textContent)}));
        const structured=[]; let schemaErrors=0;
        for(const el of d.querySelectorAll('script[type="application/ld+json"]')) { try { structured.push(JSON.parse(el.textContent)); } catch { schemaErrors++; } }
        const schemaTypes=[]; const walk=x=>{if(Array.isArray(x))x.forEach(walk); else if(x&&typeof x==='object'){if(x['@type'])schemaTypes.push(...[x['@type']].flat());Object.values(x).forEach(walk);}};structured.forEach(walk);
        const row={url,finalUrl:r.url,status:r.status,checkedAt:new Date().toISOString(),inSitemap:seeded.has(url),elapsedMs,bytes:Buffer.byteLength(html),title:clean(d.title),description:d.querySelector('meta[name="description"]')?.content||'',canonical:d.querySelector('link[rel="canonical"]')?.href||'',robots:d.querySelector('meta[name="robots"]')?.content||'',xRobots:r.headers.get('x-robots-tag')||'',lang:d.documentElement.lang,hreflang:[...d.querySelectorAll('link[hreflang]')].map(n=>({lang:n.hreflang,url:n.href})),schemaTypes:[...new Set(schemaTypes)],schemaErrors,links,images:d.images.length,missingAlt:[...d.images].filter(n=>!n.hasAttribute('alt')).length,structured};
        d.querySelectorAll('script,style,nav,footer,header,noscript').forEach(n=>n.remove()); const main=d.querySelector('main')||d.body;
        row.headings=[...main.querySelectorAll('h1,h2,h3')].map(n=>({level:n.tagName,text:clean(n.textContent)}));
        row.text=clean(main.textContent); row.wordCount=row.text.split(/\s+/).filter(Boolean).length;row.textHash=createHash('sha256').update(row.text).digest('hex');
        row.legalLinks=links.filter(l=>/^https?:\/\/([^/]+\.)?(adilet.zan.kz|gov.kz|egov.kz|elicense.kz)(\/|$)/.test(l.url));
        for(const l of links) { try {const u=new URL(l.url);if(u.hostname===host&&!u.search&&!seen.has(u.href)&&! /\.(pdf|jpe?g|png|svg|zip|docx?|xlsx?|webp|xml)$/i.test(u.pathname)&& !/^\/(api|staff|client|cabinet|admin|login|register|reset-password|document-flow|sign)(\/|$)/.test(u.pathname)){seen.add(u.href);queue.push(u.href);}}catch{}}
        dom.window.close();return row;
      } catch(e){return {url,inSitemap:seeded.has(url),error:e.message};}
    })));
    await fs.writeFile(new URL(host+'-crawl.json',out),JSON.stringify(rows,null,2));
    console.log(host,'done',rows.length,'pending',queue.length);
  }
}
