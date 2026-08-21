import type { CaseStudy } from '../types';

// Production case studies are supplied by the CMS API. No placeholder project is
// treated as evidence of completed work.
export const caseStudies: CaseStudy[] = [];

export const publishedCaseStudies = caseStudies.filter((item) => item.status === 'published' && Boolean(item.publishedAt));
