import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createHash } from 'node:crypto';
const dir = new URL('./', import.meta.url);
const catalog = JSON.parse(await fs.readFile(new URL('npieco-catalog.json',dir),'utf8'));
const urls = catalog.filter(x => new URL(x.url).hostname === 'npieco.kz' && (new URL(x.url).pathname.split('/').filter(Boolean).length >= 3) && !x.url.includes('/kz/')).map(x=>x.url);
const hosts = ['npieco.kz','alm.npieco.kz','aktobe.npieco.kz','atyrau.npieco.kz','karaganda.npieco.kz','kostanay.npieco.kz','pavlodar.npieco.kz','semey.npieco.kz','taraz.npieco.kz','uralsk.npieco.kz','ust-kam.npieco.kz','shymkent.npieco.kz'];
urls.push(...hosts.map(h=>'https://'+h+'/services/'));
const ndv = catalog.find(x=>x.url.includes('proekt-ndv'))?.url;
urls.push(...hosts.slice(1,5).concat('shymkent.npieco.kz').map(h=>ndv.replace('npieco.kz',h)));
const results=[];
for(let i=0;i<urls.length;i+=4){
  results.push(...await Promise.all(urls.slice(i,i+4).map(async url=>{
    try {
      const r=await fetch(url,{signal:AbortSignal.timeout(25000)}); const html=await r.text(); const dom=new JSDOM(html,{url:r.url});const d=dom.window.document;
      const canonical=d.querySelector('link[rel="canonical"]')?.href;const title=d.title;const description=d.querySelector('meta[name="description"]')?.content;
      const links=[...d.querySelectorAll('a[href]')].map(a=>({url:a.href,text:a.textContent.trim()}));d.querySelectorAll('script,style,nav,footer,header').forEach(n=>n.remove());
      const main=d.querySelector('main')||d.body; const text=main.textContent.replace(/\s+/g,' ').trim();
      const segment=text.split('Что такое выбросы и НДВ?')[1]?.split('Почему стоит обратиться к нам?')[0];
      const row={url,status:r.status,title,description,canonical,headings:[...main.querySelectorAll('h1,h2,h3')].map(n=>({level:n.tagName,text:n.textContent.trim()})),links,text,ndvHash:segment?createHash('sha256').update(segment).digest('hex'):null};dom.window.close();return row;
    }catch(e){return {url,error:e.message};}
  })));
  console.log('NPI fetched',results.length,'of',urls.length);
}
await fs.writeFile(new URL('npieco-crawl.json',dir),JSON.stringify(results,null,2));
console.log('Errors',results.filter(x=>x.error));
