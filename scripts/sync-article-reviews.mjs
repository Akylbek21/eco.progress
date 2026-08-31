import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const snapshotPath = path.join(root, 'src', 'data', 'articleReviews.generated.json');
const caseSnapshotPath = path.join(root, 'src', 'data', 'caseStudies.generated.json');
const endpoint = process.env.SEO_CONTENT_API_URL?.trim();
const token = process.env.SEO_CONTENT_API_TOKEN?.trim();
const validateOnly = process.argv.includes('--validate-only');

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const date = (value) => text(value) && !Number.isNaN(Date.parse(value));
const status = (value) => String(value ?? '').trim().toUpperCase().replaceAll('-', '_');
const items = (value) => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];

const reviewsFrom = (body) => {
  const payload = body?.data ?? body;
  if (!Array.isArray(payload?.articleReviews) && !Array.isArray(payload?.article_reviews)) {
    throw new Error('SEO content payload does not contain an articleReviews collection. Previous snapshot was not overwritten.');
  }
  return items(payload.articleReviews ?? payload.article_reviews)
    .map((review) => ({ ...review, status: status(review?.status) }));
};

const casesFrom = (body) => {
  const payload = body?.data ?? body;
  if (!Array.isArray(payload?.cases) && !Array.isArray(payload?.caseStudies)) {
    throw new Error('SEO content payload does not contain a cases collection. Previous snapshot was not overwritten.');
  }
  return items(payload.cases ?? payload.caseStudies);
};

export const validateArticleReviews = (body) => {
  const reviews = reviewsFrom(body);
  const knownStatuses = new Set(['DRAFT', 'REQUIRES_REVIEW', 'APPROVED', 'REJECTED']);
  const invalid = reviews.filter((review) => !text(review?.articleSlug) || !knownStatuses.has(review?.status)
    || !date(review?.updatedAt) || (review.status === 'APPROVED' && (!text(review.expertId) || !date(review.reviewedAt))));
  if (invalid.length) throw new Error(`Article review snapshot is not deployment-safe: ${invalid.length} invalid CMS record(s). Previous snapshot was not overwritten.`);
  if (new Set(reviews.map((review) => review.articleSlug)).size !== reviews.length) {
    throw new Error('Article review snapshot is not deployment-safe: duplicate articleSlug values. Previous snapshot was not overwritten.');
  }
  return reviews;
};

export const validateCases = (body) => {
  const cases = casesFrom(body).filter((item) => item?.published === true);
  const approved = (value) => status(value) === 'APPROVED';
  const nonEmptyList = (value) => Array.isArray(value) && value.length > 0 && value.every(text);
  const invalid = cases.filter((item) => {
    const requiredText = [item?.id, item?.slug, item?.title, item?.description, item?.city, item?.region, item?.industry,
      item?.objectType, item?.objectCategory, item?.serviceType, item?.task, item?.solution, item?.result, item?.duration, item?.expertId, item?.reviewerId];
    return !requiredText.every(text) || !approved(item?.reviewStatus)
      || !date(item?.completedAt) || !date(item?.reviewedAt) || !date(item?.publishedAt) || !date(item?.updatedAt)
      || typeof item?.clientAnonymous !== 'boolean'
      || (!item.clientAnonymous && !text(item.clientName))
      || !nonEmptyList(item.workPerformed)
      || !Array.isArray(item.regulations) || item.regulations.length === 0
      || item.regulations.some((entry) => !text(entry?.title))
      || !Array.isArray(item.metrics) || item.metrics.length === 0
      || item.metrics.some((entry) => !text(entry?.label) || !text(entry?.value))
      || !Array.isArray(item.images);
  });
  if (invalid.length) throw new Error(`Case snapshot is not deployment-safe: ${invalid.length} invalid published CMS record(s). Previous snapshot was not overwritten.`);
  if (new Set(cases.map((item) => item.slug)).size !== cases.length || new Set(cases.map((item) => item.id)).size !== cases.length) {
    throw new Error('Case snapshot is not deployment-safe: duplicate id or slug values. Previous snapshot was not overwritten.');
  }
  return cases.map((item) => ({ ...item, reviewStatus: status(item.reviewStatus) }));
};

const existing = () => JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const existingCases = () => JSON.parse(fs.readFileSync(caseSnapshotPath, 'utf8'));

if (validateOnly || !endpoint) {
  const reviews = validateArticleReviews(existing());
  const cases = validateCases(existingCases());
  console.log(`CMS SEO snapshot validated: ${reviews.length} article decision(s), ${cases.length} confirmed case(s).${endpoint ? '' : ' SEO_CONTENT_API_URL is not set; existing fail-closed snapshots retained.'}`);
  process.exit(0);
}

const response = await fetch(endpoint, {
  headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`SEO content API returned HTTP ${response.status} for ${endpoint}`);

let body;
try { body = await response.json(); } catch { throw new Error(`SEO content API returned invalid JSON for ${endpoint}`); }
const articleReviews = validateArticleReviews(body);
const cases = validateCases(body);
const generatedAt = new Date().toISOString();
const snapshot = { schemaVersion: 1, generatedAt, source: endpoint, articleReviews };
const caseSnapshot = { schemaVersion: 1, generatedAt, source: endpoint, cases };
const temporaryPath = `${snapshotPath}.${process.pid}.tmp`;
const temporaryCasePath = `${caseSnapshotPath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
fs.writeFileSync(temporaryCasePath, `${JSON.stringify(caseSnapshot, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryPath, snapshotPath);
fs.renameSync(temporaryCasePath, caseSnapshotPath);
console.log(`CMS SEO snapshot updated: ${articleReviews.length} article decision(s), ${cases.length} confirmed case(s).`);
