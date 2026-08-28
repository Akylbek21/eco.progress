import type { CaseStudy } from '../types';
// Реестр намеренно пуст, пока нет подтверждённых фактов и разрешения на публикацию.
export const caseStudies: CaseStudy[] = [];

export const publishedCaseStudies = caseStudies.filter((item) => item.status === 'published' && Boolean(item.publishedAt));
