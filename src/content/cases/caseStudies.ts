import type { CaseStudy, CmsCaseDto } from '../types';
import snapshot from '../../data/caseStudies.generated.json' with { type: 'json' };
import { expertMap } from '../experts/experts.ts';
import { normalizePublicCase } from '../publicCaseNormalizer.ts';
import { isPublishableCaseStudy } from './caseStudyPolicy.ts';
// Snapshot remains empty until CMS supplies verified facts and publication approval.
const cmsCases = snapshot.cases as CmsCaseDto[];
const normalizedCases = cmsCases.map((item) => normalizePublicCase(item, expertMap));
if (normalizedCases.some((item) => item === null)) {
  throw new Error('CMS case snapshot contains a case that cannot be published with the confirmed expert registry.');
}

export const caseStudies: CaseStudy[] = normalizedCases as CaseStudy[];

export const publishedCaseStudies = caseStudies.filter(isPublishableCaseStudy);
