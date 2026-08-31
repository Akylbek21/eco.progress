import type { CaseStudy, CmsCaseDto, Expert } from './types.ts';
import { isPublishableCaseStudy } from './cases/caseStudyPolicy.ts';

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));

export const normalizePublicCase = (
  item: CmsCaseDto,
  expertsById: ReadonlyMap<string, Expert>,
): CaseStudy | null => {
  const expert = expertsById.get(item.expertId);
  const reviewer = expertsById.get(item.reviewerId);
  if (!item.published || item.reviewStatus !== 'APPROVED' || !expert || !reviewer
    || !validDate(item.reviewedAt) || !validDate(item.publishedAt)) return null;

  const normalized: CaseStudy = {
    id: item.id,
    slug: item.slug,
    title: item.title,
    service: item.serviceType,
    industry: item.industry,
    city: item.city,
    region: item.region,
    objectType: item.objectType,
    objectCategory: item.objectCategory,
    problem: item.task,
    initialData: item.description,
    workPerformed: item.workPerformed,
    regulations: item.regulations,
    result: item.result,
    completedAt: item.completedAt,
    expert,
    reviewer,
    clientName: item.clientName,
    clientAnonymous: item.clientAnonymous,
    status: 'published',
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    duration: item.duration,
    images: item.images,
    metrics: item.metrics,
  };
  return isPublishableCaseStudy(normalized) ? normalized : null;
};
