import type { CaseStudy } from '../types';
import { isPublishableExpert } from '../experts/experts.ts';

const containsPlaceholder = (value: string) => /\[.*(?:ДОБАВИТЬ|TODO|PLACEHOLDER).*\]/i.test(value);

export const isPublishableCaseStudy = (item: CaseStudy): boolean => {
  const requiredText = [item.id, item.slug, item.title, item.service, item.industry, item.city, item.region, item.objectType, item.objectCategory, item.problem, item.initialData, item.result, item.completedAt, item.updatedAt];
  return item.status === 'published'
    && Boolean(item.publishedAt)
    && requiredText.every((value) => Boolean(value?.trim()) && !containsPlaceholder(value))
    && item.workPerformed.length > 0
    && item.workPerformed.every((value) => Boolean(value.trim()) && !containsPlaceholder(value))
    && isPublishableExpert(item.expert)
    && isPublishableExpert(item.reviewer)
    && (item.clientAnonymous || Boolean(item.clientName?.trim()));
};
