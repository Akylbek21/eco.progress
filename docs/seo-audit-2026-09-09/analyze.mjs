import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,dir),'utf8'));
const esc=s=>String(s??'').replace(/\|/g,'/').replace(/\s+/g,' ').trim();
const normalize=u=>new URL(u).href.replace(/\/$/,'');
const sets=s=>new Set((s||'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);
const rows=await read('ecoprogress.kz-crawl.json');
const byUrl=new Map(rows.map(r=>[normalize(r.url),r]));
const incoming=new Map();for(const r of rows)for(const url of new Set(r.links.map(l=>l.url)))incoming.set(normalize(url),(incoming.get(normalize(url))||0)+1);
const dupe=(rs,key)=>Object.values(Object.groupBy(rs.filter(r=>r[key]),r=>r[key])).filter(g=>g.length>1).map(g=>g.map(r=>r.url));
const reciprocal=[];for(const r of rows)for(const alt of r.hreflang||[]){if(alt.lang==='x-default')continue;const target=byUrl.get(normalize(alt.url));if(!target||!target.hreflang?.some(x=>normalize(x.url)===normalize(r.url)))reciprocal.push({url:r.url,alternate:alt.url});}
const privateLink=/\/(staff|login|register|cabinet)(\/|$)/;
const broken=[];for(const r of rows)for(const l of r.links){if(l.url.startsWith('https://ecoprogress.kz/')&&!privateLink.test(l.url)&&!byUrl.has(normalize(l.url))&&!/[?]|\.(pdf|jpg|png|svg|webp|docx?|xlsx?)$/i.test(l.url))broken.push({from:r.url,to:l.url});}
const city=rows.filter(r=>/^\/ecologicheskie-uslugi-/.test(new URL(r.url).pathname));
const similarity=[];for(let i=0;i<city.length;i++)for(let j=i+1;j<city.length;j++){const a=sets(city[i].text),b=sets(city[j].text);const score=[...a].filter(x=>b.has(x)).length/new Set([...a,...b]).size;if(score>.7)similarity.push({a:city[i].url,b:city[j].url,jaccard:Math.round(score*100)});}
const summary={total:rows.length,sitemap:rows.filter(r=>r.inSitemap).length,statuses:Object.fromEntries(Object.entries(Object.groupBy(rows,r=>r.status||'error')).map(([k,v])=>[k,v.length])),duplicateTitles:dupe(rows,'title'),duplicateDescriptions:dupe(rows,'description'),duplicateText:dupe(rows,'textHash'),missingCanonical:rows.filter(r=>!r.canonical).map(r=>r.url),nonSelfCanonical:rows.filter(r=>r.canonical&&normalize(r.canonical)!==normalize(r.url)).map(r=>({url:r.url,canonical:r.canonical})),missingDescription:rows.filter(r=>!r.description).map(r=>r.url),h1Issues:rows.filter(r=>r.headings?.filter(h=>h.level==='H1').length!==1).map(r=>r.url),hreflangIssues:reciprocal,unresolvedLinks:broken,similarCityPairs:similarity,services:rows.filter(r=>new URL(r.url).pathname.startsWith('/services/')).map(r=>({url:r.url,roughWords:r.wordCount,legalLinks:r.legalLinks.length})),schemaCounts:Object.fromEntries([...new Set(rows.flatMap(r=>r.schemaTypes||[]))].map(t=>[t,rows.filter(r=>r.schemaTypes?.includes(t)).length]))};
await fs.writeFile(new URL('ecoprogress-summary.json',dir),JSON.stringify(summary,null,2));
const thin=new Set(summary.services.filter(r=>r.roughWords<250).map(r=>r.url));
const classify=r=>{const p=new URL(r.url).pathname;return p.startsWith('/kk')?'KK':p.startsWith('/services/')?'Услуга':p.startsWith('/news/')?'Статья':p.startsWith('/experts/')?'Эксперт':p.startsWith('/ecologicheskie-uslugi-')?'Городской хаб':p.split('/').filter(Boolean).length===1&&!['/about','/contacts','/news','/cases','/experts','/partners','/tariffs','/faq','/services','/regions'].includes(p)?'Посадочная':'Общая';};
let md='# Постраничная матрица EcoProgress\n\nДата: 09.09.2026. Все URL из актуального sitemap и обнаруженные публичные HTML-ссылки основного домена; кабинеты проверены отдельно в probes.json. Автоматическая техническая проверка выполнена для каждой строки. Редакторские рекомендации по группе не равны ручной юридической проверке каждой страницы. Указанное число текстовых токенов — приблизительный результат textContent, не норматив длины и не SEO-балл. GEO = пригодность для генеративных ответов; локальный поиск отмечен отдельно. DCT не расшифрован пользователем.\n\n| URL | Тип | HTTP / H1 | Title / Description | Canonical | JSON-LD | Приоритет и действие SEO / GEO / AEO |\n|---|---|---|---|---|---|---|\n';
for(const r of rows){const type=classify(r);let action='P2: сохранить метаданные; проверять переходы к услугам и измерять обращения.';
if(type==='Услуга')action=thin.has(r.url)?'P1: заменить общие блоки конкретными составом работ, исходными данными, результатом, условиями цены и ответами; добавить подтверждённый кейс.':'P1: добавить подтверждённый кейс/образец результата; связать ответы с конкретными источниками и экспертом; измерять обращения.';
if(type==='Городской хаб'||type==='Посадочная')action='P1: подтвердить местные условия, выезд/логистику и кейс; отличить от национальной услуги; не заявлять неподтверждённый офис.';
if(type==='Статья')action='P2: проверить точность тезис→источник, дату и рецензента; добавить краткий ответ и переход к подходящей услуге; проверять цитирование отдельно.';
if(type==='Эксперт')action='P1: добавить должность, специализацию, опыт, проверяемые документы и работы; проверить возможные дубли личности.';
if(type==='KK')action='P2: редактура носителем языка, равнозначность RU/KK ответа и услуг; сохранить взаимный hreflang.';
if(r.url.endsWith('/cases'))action='P1: раздел пуст; опубликовать согласованные фактические кейсы, связать с услугами и экспертами.';
if(r.url.endsWith('/contacts'))action='P1: связать юридическое лицо, БИН, адрес и реквизиты с доказательствами; проверить единообразие NAP.';
if(r.url.endsWith('/services'))action='P2: новая группировка уже опубликована; развивать узкие услуги только при подтверждённой возможности выполнения.';
md+=`| [${esc(new URL(r.url).pathname)}](${r.url}) | ${type} | ${r.status} / ${r.headings.filter(h=>h.level==='H1').length} | ${r.title.length} / ${r.description.length} знаков, заполнены | ${normalize(r.url)===normalize(r.canonical)?'self':'проверить'} | ${r.schemaTypes.filter(t=>['Service','Article','Person','WebPage','FAQPage','BreadcrumbList'].includes(t)).join(', ')} | ${action} |\n`;
}
await fs.writeFile(new URL('pages-ecoprogress.md',dir),md);
console.log(JSON.stringify(summary,null,2));
