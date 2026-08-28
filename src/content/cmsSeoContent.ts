import snapshot from '../data/seoCmsSnapshot.generated.json' with { type: 'json' };
import type { CaseStudy, CmsArticleReviewDto, CmsCaseDto, CmsExpertDto, Expert } from './types';

type Snapshot = {
  schemaVersion: number;
  generatedAt: string | null;
  source: string | null;
  experts: CmsExpertDto[];
  cases: CmsCaseDto[];
  articleReviews: CmsArticleReviewDto[];
};

export const seoCmsSnapshot = snapshot as Snapshot;

export const verifiedExperts: Expert[] = seoCmsSnapshot.experts
  .filter((item) => item.verificationStatus === 'VERIFIED')
  .map((item) => ({
    id: item.id,
    fullName: item.fullName,
    slug: item.profileUrl.split('/').filter(Boolean).slice(-1)[0] || item.id,
    published: true,
    verificationStatus: item.verificationStatus,
    position: item.position,
    specialization: item.specializations,
    experienceYears: item.experienceYears,
    bio: item.bio,
    photo: item.photoUrl,
    profileUrl: item.profileUrl,
    credentials: [],
  }));

const expertById = new Map(verifiedExperts.map((expert) => [expert.id, expert]));

export const publishedCases: CaseStudy[] = seoCmsSnapshot.cases.flatMap((item) => {
  if (!item.published) return [];
  const expert = expertById.get(item.expertId);
  if (!expert) return [];
  return [{
    id: item.id,
    slug: item.slug,
    title: item.title,
    service: item.serviceType,
    industry: item.objectType,
    city: item.city,
    region: item.city,
    objectType: item.objectType,
    objectCategory: item.objectType,
    problem: item.task,
    initialData: item.description,
    workPerformed: [item.solution],
    regulations: [],
    result: item.result,
    completedAt: item.completedAt,
    expert,
    clientAnonymous: true,
    status: 'published',
    publishedAt: item.completedAt,
    updatedAt: item.updatedAt,
    duration: item.duration,
    images: item.images,
  }];
});

export const articleReviewBySlug = new Map(
  seoCmsSnapshot.articleReviews.map((review) => [review.articleSlug, review] as const),
);
