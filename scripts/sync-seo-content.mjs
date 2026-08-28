import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const snapshotPath = path.join(root, 'src', 'data', 'seoCmsSnapshot.generated.json');
const endpoint = process.env.SEO_CONTENT_API_URL?.trim();
const token = process.env.SEO_CONTENT_API_TOKEN?.trim();
const validateOnly = process.argv.includes('--validate-only');

const items = (value) => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const date = (value) => text(value) && !Number.isNaN(Date.parse(value));
const publicUrl = (value) => text(value) && (/^https?:\/\//i.test(value) || value.startsWith('/'));
const normalizeStatus = (value) => String(value ?? '').trim().toUpperCase().replaceAll('-', '_');

const normalizePayload = (body) => {
  const payload = body?.data ?? body;
  if (!payload || typeof payload !== 'object') throw new Error('SEO content API returned a non-object payload');
  return {
    experts: items(payload.experts).filter((item) => normalizeStatus(item?.verificationStatus) === 'VERIFIED'),
    cases: items(payload.cases).filter((item) => item?.published === true || normalizeStatus(item?.status) === 'PUBLISHED'),
    articleReviews: items(payload.articleReviews ?? payload.article_reviews)
      .map((item) => ({ ...item, status: normalizeStatus(item?.status) })),
  };
};

const validExpert = (item) => Boolean(item && text(item.id) && text(item.fullName) && text(item.position)
  && Array.isArray(item.specializations) && item.specializations.length && item.specializations.every(text)
  && Number.isFinite(item.experienceYears) && item.experienceYears >= 0 && text(item.bio)
  && publicUrl(item.photoUrl) && publicUrl(item.profileUrl)
  && normalizeStatus(item.verificationStatus) === 'VERIFIED' && date(item.verifiedAt) && date(item.updatedAt));

const validCase = (item) => Boolean(item && text(item.id) && text(item.slug) && text(item.title)
  && text(item.description) && text(item.city) && text(item.objectType) && text(item.serviceType)
  && text(item.task) && text(item.solution) && text(item.result) && text(item.duration)
  && date(item.completedAt) && text(item.expertId) && Array.isArray(item.images)
  && item.published === true && date(item.updatedAt));

const validReview = (item) => {
  const status = normalizeStatus(item?.status);
  return Boolean(item && text(item.articleSlug) && text(item.expertId)
    && ['REQUIRES_REVIEW', 'APPROVED', 'REJECTED'].includes(status)
    && (status !== 'APPROVED' || date(item.reviewedAt)) && date(item.updatedAt));
};

export const validateSeoSnapshot = (snapshot) => {
  const normalized = normalizePayload(snapshot);
  const problems = [];
  if (!normalized.experts.length && !normalized.cases.length && !normalized.articleReviews.length) problems.push('experts, cases and articleReviews are all empty');
  if (!normalized.experts.every(validExpert)) problems.push('one or more VERIFIED experts have an invalid public DTO');
  if (!normalized.cases.every(validCase)) problems.push('one or more published cases have an invalid public DTO');
  if (!normalized.articleReviews.every(validReview)) problems.push('one or more article reviews have an invalid public DTO');
  const expertIds = new Set(normalized.experts.map((item) => item.id));
  if (normalized.cases.some((item) => !expertIds.has(item.expertId))) problems.push('a published case references an unknown VERIFIED expert');
  if (normalized.articleReviews.some((item) => normalizeStatus(item.status) === 'APPROVED' && !expertIds.has(item.expertId))) problems.push('an APPROVED review references an unknown VERIFIED expert');
  if (problems.length) throw new Error(`SEO content snapshot is not deployment-safe: ${problems.join('; ')}. The previous valid snapshot was not overwritten.`);
  return normalized;
};

if (validateOnly) {
  const existing = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const verified = validateSeoSnapshot(existing);
  if (!date(existing.generatedAt) || !text(existing.source)) throw new Error('SEO content snapshot metadata is invalid: generatedAt and source are required.');
  console.log(`SEO CMS snapshot validated: ${verified.experts.length} VERIFIED experts, ${verified.cases.length} published cases, ${verified.articleReviews.length} article reviews.`);
  process.exit(0);
}

if (!endpoint) throw new Error('SEO_CONTENT_API_URL is required for production SEO content sync. Refusing to build from an implicit or empty snapshot.');

const response = await fetch(endpoint, {
  headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`SEO content API returned HTTP ${response.status} for ${endpoint}`);

let body;
try { body = await response.json(); } catch { throw new Error(`SEO content API returned invalid JSON for ${endpoint}`); }
const verified = validateSeoSnapshot(body);
const snapshot = { schemaVersion: 2, generatedAt: new Date().toISOString(), source: endpoint, ...verified };
const temporaryPath = `${snapshotPath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryPath, snapshotPath);
console.log(`SEO CMS snapshot updated: ${snapshot.experts.length} VERIFIED experts, ${snapshot.cases.length} published cases, ${snapshot.articleReviews.length} article reviews.`);
