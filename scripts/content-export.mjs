import fs from 'node:fs';
import path from 'node:path';
import { serviceCatalog, serviceSlugAliases } from '../src/content/serviceCatalog.ts';
import { serviceContent } from '../src/content/services/serviceContent.ts';
import { articleContent, articleSlugAliases } from '../src/content/articles/articleContent.ts';
import { regionContent } from '../src/content/regions/regionContent.ts';
import { regions } from '../src/content/regions.ts';
import { caseStudies } from '../src/content/cases/caseStudies.ts';
import { experts } from '../src/content/experts/experts.ts';
import { trustDocuments } from '../src/content/trust-documents/trustDocuments.ts';

const dryRun = process.argv.includes('--dry-run');
const outputArg = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = path.resolve(process.cwd(), outputArg?.slice('--output='.length) || 'artifacts/content-export.json');

const serviceSlugs = new Set(serviceCatalog.map((item) => item.slug));
const articleSlugs = new Set(articleContent.map((item) => item.slug));
const regionSlugs = new Set(regionContent.map((item) => item.regionSlug));
const conflicts = [];
const missingRelations = [];
const requiresVerification = [];
const dateErrors = [];

const findDuplicates = (values, entity) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) conflicts.push({ entity, key: value, reason: 'duplicate-key' });
    seen.add(value);
  }
};

findDuplicates([...serviceSlugs], 'service');
findDuplicates([...articleSlugs], 'article');
findDuplicates([...regionSlugs], 'region');

for (const item of serviceCatalog) {
  if (!serviceContent.some((content) => content.serviceSlug === item.slug)) requiresVerification.push({ entity: `service:${item.slug}`, field: 'structured-content' });
  for (const slug of item.relatedServiceSlugs) if (!serviceSlugs.has(slug)) missingRelations.push({ from: `service:${item.slug}`, to: `service:${slug}` });
  for (const slug of item.relatedArticleSlugs) if (!articleSlugs.has(slug)) missingRelations.push({ from: `service:${item.slug}`, to: `article:${slug}` });
  for (const basis of item.legalBasis || []) if (!basis.url) requiresVerification.push({ entity: `service:${item.slug}`, field: `legalBasis:${basis.title}` });
}

for (const item of articleContent) {
  if (Number.isNaN(Date.parse(item.datePublished)) || Number.isNaN(Date.parse(item.dateModified)) || new Date(item.dateModified) < new Date(item.datePublished)) dateErrors.push({ entity: `article:${item.slug}`, datePublished: item.datePublished, dateModified: item.dateModified });
  for (const slug of item.relatedServiceSlugs) if (!serviceSlugs.has(slug)) missingRelations.push({ from: `article:${item.slug}`, to: `service:${slug}` });
  for (const slug of item.relatedArticleSlugs) if (!articleSlugs.has(slug)) missingRelations.push({ from: `article:${item.slug}`, to: `article:${slug}` });
  for (const source of item.sources) if (source.claimStatus !== 'verified') requiresVerification.push({ entity: `article:${item.slug}`, field: `source:${source.title}` });
}

for (const item of regionContent) {
  for (const slug of item.availableServiceSlugs) if (!serviceSlugs.has(slug)) missingRelations.push({ from: `region:${item.regionSlug}`, to: `service:${slug}` });
  for (const slug of item.relatedArticleSlugs) if (!articleSlugs.has(slug)) missingRelations.push({ from: `region:${item.regionSlug}`, to: `article:${slug}` });
}

for (const item of experts) if (item.verificationStatus !== 'verified') requiresVerification.push({ entity: `expert:${item.slug}`, field: 'profile' });
for (const item of trustDocuments) if (item.verificationStatus !== 'verified') requiresVerification.push({ entity: `trust-document:${item.id}`, field: 'document' });
for (const item of caseStudies) if (item.verificationStatus !== 'approved') requiresVerification.push({ entity: `case:${item.slug}`, field: 'client-approval' });

const exported = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'frontend-static-content',
  services: serviceCatalog.map((catalogItem) => ({
    contentType: 'SERVICE',
    slug: catalogItem.slug,
    title: catalogItem.title,
    status: catalogItem.isActive ? 'DRAFT' : 'ARCHIVED',
    locale: 'ru',
    payload: { catalog: catalogItem, content: serviceContent.find((item) => item.serviceSlug === catalogItem.slug) || null },
    seo: catalogItem.seo,
  })),
  articles: articleContent.map((item) => ({ contentType: 'ARTICLE', slug: item.slug, title: item.title, status: item.status.toUpperCase().replaceAll('-', '_'), locale: 'ru', payload: item })),
  regions: regionContent.map((item) => ({
    contentType: 'REGION', slug: item.regionSlug, title: regions.find((region) => region.slug === item.regionSlug)?.regionNominative || item.regionSlug,
    status: item.status.toUpperCase().replaceAll('-', '_'), locale: 'ru', payload: item,
  })),
  cases: caseStudies,
  experts,
  trustDocuments,
  aliases: {
    services: Object.entries(serviceSlugAliases).map(([source, target]) => ({ sourcePath: `/services/${source}`, targetPath: `/services/${target}`, statusCode: 301 })),
    articles: Object.entries(articleSlugAliases).map(([source, target]) => ({ sourcePath: `/news/${source}`, targetPath: `/news/${target}`, statusCode: 301 })),
  },
};

const report = {
  mode: dryRun ? 'dry-run' : 'export',
  counts: {
    services: exported.services.length,
    articles: exported.articles.length,
    regions: exported.regions.length,
    cases: exported.cases.length,
    experts: exported.experts.length,
    trustDocuments: exported.trustDocuments.length,
    redirects: exported.aliases.services.length + exported.aliases.articles.length,
  },
  creates: {
    contentItems: exported.services.length + exported.articles.length + exported.regions.length + exported.cases.length + exported.experts.length + exported.trustDocuments.length,
    redirects: exported.aliases.services.length + exported.aliases.articles.length,
  },
  updates: { contentItems: 0, redirects: 0 },
  conflicts,
  duplicates: conflicts.filter((entry) => entry.reason === 'duplicate-key'),
  missingRelations,
  dateErrors,
  requiresVerification,
  output: dryRun ? null : outputPath,
};

if (!dryRun) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(exported, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
if (conflicts.length || missingRelations.length || dateErrors.length) process.exitCode = 1;
