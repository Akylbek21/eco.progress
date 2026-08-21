import type { CaseStudy } from '../types';
import snapshot from '../../data/seoCmsSnapshot.generated.json' with { type: 'json' };

// Production case studies are supplied by the CMS API. No placeholder project is
// treated as evidence of completed work.
export const caseStudies = snapshot.cases as CaseStudy[];

export const publishedCaseStudies = caseStudies.filter((item) => item.status === 'published' && Boolean(item.publishedAt));
