import { normalizeServiceSlug } from './serviceCatalog';
import type { AeoFaqItem, ContentStatus, ReviewStatus, ServiceContent } from './types';
import { getServiceCommercialContent } from './services/serviceCommercial';

type NullableText = string | null | undefined;

export interface PublicServiceDto {
  id: string;
  title: string;
  category: string;
  description: string;
  forWhom: string;
  result: string;
  includes: string[];
  documents: string[];
  workflow: string[];
  duration: string;
  status: string;
  reviewStatus: string;
  author?: string | null;
  reviewer?: string | null;
  reviewedAt?: string | null;
  legalBasisCheckedAt?: string | null;
  updatedAt?: string | null;
  aeo?: {
    shortAnswer?: NullableText;
    whoNeeds?: NullableText;
    whenRequired?: NullableText;
    whenNotRequired?: NullableText;
    requiredDocuments?: string[] | null;
    customerReceives?: string[] | null;
    timeline?: NullableText;
    pricingFactors?: string[] | null;
    legalBasis?: string[] | null;
    commonMistakes?: string[] | null;
    faq?: Array<{ question?: string; answer?: string; shortAnswer?: string; explanation?: string }> | null;
  } | null;
  relatedCases?: unknown[];
}

const text = (value: NullableText) => typeof value === 'string' ? value.trim() : '';
const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
  : [];

const status = (value: string): ContentStatus => {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'APPROVED') return 'approved';
  if (normalized === 'PUBLISHED') return 'published';
  if (normalized === 'ARCHIVED') return 'archived';
  if (normalized === 'OUTDATED') return 'outdated';
  return 'draft';
};

const reviewStatus = (value: string): ReviewStatus => {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'APPROVED') return 'approved';
  if (normalized === 'REJECTED') return 'rejected';
  if (normalized === 'REQUIRES_SPECIALIST_REVIEW') return 'requires-specialist-review';
  return 'draft';
};

const faq = (value: PublicServiceDto['aeo']): AeoFaqItem[] => (value?.faq ?? []).flatMap((item) => {
  const question = text(item.question);
  const answer = text(item.answer ?? item.explanation ?? item.shortAnswer);
  return question && answer ? [{ question, answer, shortAnswer: text(item.shortAnswer) || undefined, explanation: text(item.explanation) || undefined }] : [];
});

export const isStructuredServiceContent = (value: ServiceContent | PublicServiceDto): value is ServiceContent =>
  'serviceSlug' in value && typeof value.serviceSlug === 'string' && 'summary' in value;

export const normalizePublicService = (value: ServiceContent | PublicServiceDto): ServiceContent => {
  if (isStructuredServiceContent(value)) return value;

  const aeo = value.aeo;
  const requiredDocuments = strings(value.documents);
  const deliverables = strings(value.includes);
  const aeoDocuments = strings(aeo?.requiredDocuments);
  const aeoDeliverables = strings(aeo?.customerReceives);
  const pricingFactors = strings(aeo?.pricingFactors);
  const legalBasis = strings(aeo?.legalBasis);
  const commonMistakes = strings(aeo?.commonMistakes);
  const serviceSlug = normalizeServiceSlug(value.id);

  return {
    serviceSlug,
    status: status(value.status),
    hero: {
      title: text(value.title),
      subtitle: text(value.description),
      primaryCta: 'Получить расчёт',
    },
    summary: {
      shortDescription: text(value.description),
      clientResult: text(value.result),
      availability: '',
      durationText: text(value.duration),
      priceText: '',
    },
    whenRequired: text(aeo?.whenRequired) ? [{ title: 'Когда требуется', description: text(aeo?.whenRequired) }] : [],
    targetClients: text(value.forWhom) ? [{ title: text(value.forWhom) }] : [],
    problemsSolved: [],
    legalBasis: legalBasis.map((title) => ({ title, verificationStatus: 'requires-review', claimStatus: 'requires-review' })),
    requiredDocuments: (aeoDocuments.length ? aeoDocuments : requiredDocuments).map((title) => ({ title, required: true })),
    workflow: strings(value.workflow).map((title, index) => ({
      order: index + 1,
      title,
      description: '',
      responsibleParty: 'ecoprogress',
    })),
    deliverables: (aeoDeliverables.length ? aeoDeliverables : deliverables).map((title) => ({ title, description: '' })),
    notIncluded: [],
    pricingFactors: pricingFactors.map((title) => ({ title, description: '' })),
    risks: commonMistakes.map((risk) => ({ risk, prevention: '' })),
    faq: faq(aeo),
    aeo: {
      shortAnswer: text(aeo?.shortAnswer) || text(value.description),
      targetAudience: text(aeo?.whoNeeds) || text(value.forWhom),
      whenRequired: text(aeo?.whenRequired),
      whenNotRequired: text(aeo?.whenNotRequired),
      requiredDocuments: aeoDocuments.join('; ') || requiredDocuments.join('; '),
      deliverables: aeoDeliverables.join('; ') || text(value.result),
      duration: text(aeo?.timeline) || text(value.duration),
      pricing: pricingFactors.join('; '),
      legalBasis: legalBasis.join('; '),
      commonMistakes: commonMistakes.join('; '),
      faq: faq(aeo),
    },
    commercial: getServiceCommercialContent(serviceSlug, text(value.title)),
    relatedServices: [],
    relatedArticles: [],
    contentReview: {
      preparedBy: text(value.author) || undefined,
      reviewedBy: text(value.reviewer) || undefined,
      lastReviewedAt: text(value.reviewedAt ?? value.updatedAt) || undefined,
      legalBasisCheckedAt: text(value.legalBasisCheckedAt) || undefined,
      reviewStatus: reviewStatus(value.reviewStatus),
    },
  };
};
