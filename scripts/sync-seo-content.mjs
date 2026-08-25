import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const snapshotPath = path.join(root, 'src', 'data', 'seoCmsSnapshot.generated.json');
const endpoint = process.env.SEO_CONTENT_API_URL?.trim();
const token = process.env.SEO_CONTENT_API_TOKEN?.trim();

const collection = (value) => Array.isArray(value)
  ? value
  : Array.isArray(value?.items)
    ? value.items
    : [];

const reviewStatusMap = {
  APPROVED: 'approved',
  REQUIRES_SPECIALIST_REVIEW: 'requires-specialist-review',
  'REQUIRES-SPECIALIST-REVIEW': 'requires-specialist-review',
  DRAFT: 'draft',
  REJECTED: 'rejected',
};

const normalizeArticleReview = (item) => {
  if (!item || typeof item !== 'object') return item;
  const rawStatus = String(item.reviewStatus ?? '').trim();
  return {
    ...item,
    reviewStatus: reviewStatusMap[rawStatus.toUpperCase()] ?? rawStatus.toLowerCase(),
  };
};

const completeExpert = (item) => Boolean(
  item && typeof item.id === 'string' && item.id.trim()
  && typeof item.fullName === 'string' && item.fullName.trim()
  && typeof item.position === 'string' && item.position.trim()
  && Array.isArray(item.specialization) && item.specialization.length
  && Number.isFinite(item.experienceYears) && item.experienceYears >= 0
  && typeof item.bio === 'string' && item.bio.trim()
  && typeof item.photo === 'string' && item.photo.trim()
  && typeof item.profileUrl === 'string' && item.profileUrl.trim(),
);

const publishedCase = (item) => Boolean(
  item && item.status === 'published' && item.publishedAt
  && typeof item.result === 'string' && item.result.trim()
  && Array.isArray(item.workPerformed) && item.workPerformed.length
  && Array.isArray(item.regulations) && item.regulations.length
  && completeExpert(item.expert) && completeExpert(item.reviewer),
);

const validArticleReview = (item, expertIds) => Boolean(
  item && typeof item.slug === 'string' && item.slug.trim()
  && ['approved', 'requires-specialist-review', 'draft', 'rejected'].includes(item.reviewStatus)
  && (item.reviewStatus !== 'approved' || (
    typeof item.authorSlug === 'string' && expertIds.has(item.authorSlug)
    && typeof item.reviewerSlug === 'string' && expertIds.has(item.reviewerSlug)
    && typeof item.lastReviewedAt === 'string' && !Number.isNaN(Date.parse(item.lastReviewedAt))
  )),
);

const validate = (snapshot) => {
  const experts = collection(snapshot?.experts);
  const cases = collection(snapshot?.cases);
  const articleReviews = collection(snapshot?.articleReviews ?? snapshot?.article_reviews).map(normalizeArticleReview);
  const problems = [];
  if (!experts.length && !cases.length && !articleReviews.length) {
    problems.push('experts, cases and articleReviews are all empty');
  }
  if (!experts.every(completeExpert)) problems.push('one or more expert profiles are incomplete');
  if (cases.some((item) => item?.status === 'published' && !publishedCase(item))) {
    problems.push('one or more published case studies are incomplete or unverified');
  }
  const expertIds = new Set(experts.map((item) => item.id));
  if (!articleReviews.every((item) => validArticleReview(item, expertIds))) {
    problems.push('one or more article review records are incomplete or reference an unknown expert');
  }
  if (problems.length) throw new Error(`SEO content snapshot is not deployment-safe: ${problems.join('; ')}. Previous production must remain active.`);
  return { experts, cases, articleReviews };
};

let snapshot;
if (endpoint) {
  const response = await fetch(endpoint, {
    headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`SEO content API returned HTTP ${response.status} for ${endpoint}`);
  const body = await response.json();
  const payload = body?.data ?? body;
  const verified = validate(payload);
  snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: endpoint,
    experts: verified.experts,
    cases: verified.cases,
    articleReviews: verified.articleReviews,
  };
  const temporaryPath = `${snapshotPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, snapshotPath);
  console.log(`SEO CMS snapshot updated: ${snapshot.experts.length} experts, ${snapshot.cases.length} cases, ${snapshot.articleReviews.length} article reviews.`);
} else {
  snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const verified = validate(snapshot);
  console.log(`SEO CMS snapshot validated: ${verified.experts.length} experts, ${verified.cases.length} cases, ${verified.articleReviews.length} article reviews.`);
}
