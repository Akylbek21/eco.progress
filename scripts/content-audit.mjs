import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serviceCatalog, serviceSlugAliases } from '../src/content/serviceCatalog.ts';
import { serviceContent } from '../src/content/services/serviceContent.ts';
import { articleContent } from '../src/content/articles/articleContent.ts';
import { regionContent } from '../src/content/regions/regionContent.ts';
import { experts } from '../src/content/experts/experts.ts';
import { trustDocuments } from '../src/content/trust-documents/trustDocuments.ts';
import { caseStudies } from '../src/content/cases/caseStudies.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = [];
const add = (level, code, target, message) => findings.push({ level, code, target, message });
const unique = (items, label) => {
  const seen = new Set();
  for (const item of items) seen.has(item) ? add('ERROR', 'duplicate', label, `Повторяется значение «${item}»`) : seen.add(item);
};
const words = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const wordCount = (value) => words(value).length;
const textualValues = (value) => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(textualValues) : value && typeof value === 'object' ? Object.values(value).flatMap(textualValues) : [];
const articleText = (article) => [article.shortAnswer, ...article.sections.flatMap((section) => [...section.paragraphs, ...(section.bullets || []), ...(section.checklist || []), section.warning || '']), ...article.faq.flatMap((item) => [item.question, item.answer])].join(' ');
const similarity = (left, right) => {
  const a = new Set(words(left)); const b = new Set(words(right));
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(1, new Set([...a, ...b]).size);
};

unique(serviceCatalog.map((item) => item.slug), 'serviceCatalog.slug');
unique(serviceContent.map((item) => item.serviceSlug), 'serviceContent.serviceSlug');
unique(articleContent.map((item) => item.slug), 'articleContent.slug');
unique(articleContent.map((item) => item.title), 'articleContent.title');
unique(regionContent.map((item) => item.regionSlug), 'regionContent.regionSlug');

const serviceSlugs = new Set(serviceCatalog.map((item) => item.slug));
const articleSlugs = new Set(articleContent.map((item) => item.slug));
const expertSlugs = new Set(experts.map((item) => item.slug));
for (const [alias, canonical] of Object.entries(serviceSlugAliases)) if (!serviceSlugs.has(canonical)) add('ERROR', 'alias-target', alias, `Каноническая услуга ${canonical} не существует`);

for (const content of serviceContent) {
  const target = `/services/${content.serviceSlug}`;
  const count = wordCount(textualValues(content).join(' '));
  if (count < 1500) add('WARNING', 'word-count', target, `${count} слов; рекомендовано 1500–2500 для приоритетной услуги`);
  if (!serviceSlugs.has(content.serviceSlug)) add('ERROR', 'orphan-service-content', target, 'Нет записи в едином каталоге услуг');
  if (content.workflow.length < 3) add('ERROR', 'workflow', target, 'Менее трёх этапов работы');
  if (content.deliverables.length === 0) add('ERROR', 'deliverables', target, 'Не описан результат для клиента');
  if (content.faq.length < 5) add('ERROR', 'faq', target, 'Для подробной услуги требуется минимум 5 FAQ');
  if (content.legalBasis.length === 0) add('WARNING', 'legal-basis', target, 'Нет нормативной основы');
  for (const slug of content.relatedServices) if (!serviceSlugs.has(slug)) add('ERROR', 'related-service', target, `Несуществующая услуга ${slug}`);
  for (const slug of content.relatedArticles) if (!articleSlugs.has(slug)) add('ERROR', 'related-article', target, `Несуществующая статья ${slug}`);
  if (content.contentReview.reviewStatus !== 'approved') add('WARNING', 'specialist-review', target, 'Контент требует проверки профильным экологом');
}

for (const article of articleContent) {
  const target = `/news/${article.slug}`;
  const count = wordCount(articleText(article));
  if (count < 800) add('WARNING', 'word-count', target, `${count} слов; рекомендовано не менее 800 для экспертного материала`);
  if (new Date(article.dateModified) < new Date(article.datePublished)) add('ERROR', 'article-dates', target, 'dateModified раньше datePublished');
  if (!expertSlugs.has(article.authorSlug)) add('ERROR', 'author', target, `Не найден автор ${article.authorSlug}`);
  if (article.reviewerSlug && !expertSlugs.has(article.reviewerSlug)) add('ERROR', 'reviewer', target, `Не найден reviewer ${article.reviewerSlug}`);
  if (!article.heroImageAlt.trim()) add('ERROR', 'image-alt', target, 'Пустой alt изображения');
  if (article.sources.length === 0) add('ERROR', 'sources', target, 'Нет источников');
  for (const source of article.sources) if (!/^https:\/\//.test(source.url)) add('ERROR', 'source-url', target, `Некорректный URL источника ${source.url}`);
  for (const slug of article.relatedServiceSlugs) if (!serviceSlugs.has(slug)) add('ERROR', 'related-service', target, `Несуществующая услуга ${slug}`);
  for (const slug of article.relatedArticleSlugs) if (!articleSlugs.has(slug)) add('ERROR', 'related-article', target, `Несуществующая статья ${slug}`);
  if (article.status === 'published' && article.reviewStatus !== 'approved') add('WARNING', 'specialist-review', target, 'Опубликованный материал помечен как требующий проверки');
}

for (let left = 0; left < articleContent.length; left += 1) for (let right = left + 1; right < articleContent.length; right += 1) {
  const percent = Math.round(similarity(articleText(articleContent[left]), articleText(articleContent[right])) * 100);
  if (percent > 60) add('ERROR', 'article-similarity', `${articleContent[left].slug} ↔ ${articleContent[right].slug}`, `Сходство ${percent}%`);
  else if (percent > 40) add('WARNING', 'article-similarity', `${articleContent[left].slug} ↔ ${articleContent[right].slug}`, `Сходство ${percent}%`);
}

for (const region of regionContent) {
  const target = `/ecologicheskie-uslugi-${region.regionSlug}`;
  const count = wordCount(textualValues(region).join(' '));
  if (count < 500) add('WARNING', 'word-count', target, `${count} слов; рекомендовано не менее 500 уникальных слов`);
  if (!region.introduction || region.industries.length === 0 || region.commonTasks.length === 0) add('ERROR', 'region-content', target, 'Не заполнены обязательные региональные данные');
  for (const slug of region.availableServiceSlugs) if (!serviceSlugs.has(slug)) add('ERROR', 'related-service', target, `Несуществующая услуга ${slug}`);
  for (const slug of region.relatedArticleSlugs) if (!articleSlugs.has(slug)) add('ERROR', 'related-article', target, `Несуществующая статья ${slug}`);
}

for (const document of trustDocuments) {
  if (document.verificationStatus === 'verified' && (!document.number || !document.issuedBy)) add('ERROR', 'trust-verification', document.id, 'Документ помечен проверенным без реквизитов');
  if (document.validUntil && new Date(document.validUntil) < new Date()) add('WARNING', 'expired-document', document.id, 'Истёк срок действия');
  if (document.fileUrl && !fs.existsSync(path.join(root, 'public', document.fileUrl.replace(/^\//, '')))) add('ERROR', 'trust-file', document.id, `Файл не найден: ${document.fileUrl}`);
}
for (const item of caseStudies) if (item.verificationStatus === 'approved' && (item.result.length === 0 || item.workCompleted.length === 0)) add('ERROR', 'case-verification', item.slug, 'Одобренный кейс не содержит проверяемого результата');

const forbidden = ['для Алматы и Алматинская область', 'в Караганда и Карагандинская область', 'для Астана и Акмолинская область'];
const contentFiles = ['src/content', 'src/pages', 'src/components'].flatMap((directory) => {
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(current, entry.name)) : [path.join(current, entry.name)]);
  return walk(path.join(root, directory));
});
for (const file of contentFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const phrase of forbidden) if (source.toLowerCase().includes(phrase.toLowerCase())) add('ERROR', 'region-grammar', path.relative(root, file), `Запрещённая форма: ${phrase}`);
}

const summary = Object.groupBy(findings, (item) => item.level);
console.log(`Content audit: ${serviceContent.length} detailed services, ${articleContent.length} articles, ${regionContent.length} regions, ${trustDocuments.length} trust documents, ${caseStudies.length} case drafts.`);
for (const item of findings) console.log(`${item.level} [${item.code}] ${item.target}: ${item.message}`);
console.log(`Result: ${summary.ERROR?.length || 0} errors, ${summary.WARNING?.length || 0} warnings, ${summary.INFO?.length || 0} info.`);
if (summary.ERROR?.length) process.exitCode = 1;
