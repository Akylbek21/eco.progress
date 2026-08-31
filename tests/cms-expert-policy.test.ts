import { describe, expect, it } from 'vitest';
import { normalizeExpert } from '../src/content/apiRepository';
import { isExpertWithCredentials, isPublishableExpert, isVerifiedCmsExpert } from '../src/content/experts/experts';
import { isPublishableCaseStudy } from '../src/content/cases/caseStudyPolicy';
import type { CaseStudy, CmsExpertDto, ExpertCredential } from '../src/content/types';

const cmsExpert: CmsExpertDto = {
  id: 'cms-expert', fullName: 'CMS Expert', position: 'Эколог', specializations: ['ПЭК'],
  experienceYears: 8, bio: 'Профильный эколог.', photoUrl: '/cms-expert.jpg',
  profileUrl: '/experts/cms-expert', verificationStatus: 'VERIFIED',
  verifiedAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-31T10:00:00Z',
};

describe('CMS expert publication policy', () => {
  it('keeps a VERIFIED CMS expert even when the endpoint omits credentials', () => {
    expect(isVerifiedCmsExpert(cmsExpert)).toBe(true);
    const expert = normalizeExpert(cmsExpert);
    expect(expert.credentials).toEqual([]);
    expect(isPublishableExpert(expert)).toBe(true);
    expect(isExpertWithCredentials(expert)).toBe(false);
  });

  it('preserves credential objects when the endpoint provides them', () => {
    const credential: ExpertCredential = { title: 'ПЭК', document: 'Сертификат', issuedBy: 'Учебный центр', date: '2026-01-10' };
    const expert = normalizeExpert({ ...cmsExpert, credentials: [credential] });
    expect(expert.credentials).toEqual([credential]);
    expect(isExpertWithCredentials(expert)).toBe(true);
  });

  it('does not remove a published CMS case owned by a credential-less VERIFIED expert', () => {
    const expert = normalizeExpert(cmsExpert);
    const item: CaseStudy = {
      id: 'case-1', slug: 'cms-case', title: 'CMS case', service: 'program-pek', industry: 'Производство',
      city: 'Шымкент', region: 'Шымкент', objectType: 'Предприятие', objectCategory: 'II',
      problem: 'Подготовить ПЭК', initialData: 'Документы предприятия', workPerformed: ['Провели аудит'],
      regulations: [], result: 'Программа подготовлена', completedAt: '2026-08-01', expert, reviewer: expert,
      clientAnonymous: true, status: 'published', publishedAt: '2026-08-10', updatedAt: '2026-08-31',
    };
    expect(isPublishableCaseStudy(item)).toBe(true);
  });
});
