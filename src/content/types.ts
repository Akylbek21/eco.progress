export type ContentStatus = 'draft' | 'specialist-review' | 'legal-review' | 'approved' | 'published' | 'outdated' | 'archived';
export type LegalClaimStatus = 'verified' | 'requires-review' | 'general-information';
export type ReviewStatus = 'approved' | 'requires-specialist-review' | 'draft' | 'rejected';

export interface AeoFaqItem {
  question: string;
  shortAnswer?: string;
  explanation?: string;
  /** Compatibility with content created before the AEO migration. */
  answer: string;
}

export interface ServiceAeoContent {
  shortAnswer: string;
  targetAudience: string;
  whenRequired: string;
  whenNotRequired: string;
  requiredDocuments: string;
  deliverables: string;
  duration: string;
  pricing: string;
  legalBasis: string;
  commonMistakes: string;
  faq: AeoFaqItem[];
}

export interface ContentAuditItem {
  url: string;
  pageType: 'service' | 'article' | 'regional' | 'special' | 'category' | 'trust';
  primaryIntent: string;
  targetAudience: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  currentWordCount: number;
  duplicateContentPercent?: number;
  hasLegalBasis: boolean;
  hasAuthor: boolean;
  hasRealExamples: boolean;
  hasUsefulFaq: boolean;
  hasInternalLinks: boolean;
  hasCallToAction: boolean;
  problems: string[];
  recommendedAction: 'rewrite' | 'expand' | 'merge' | 'redirect' | 'noindex' | 'keep';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

export interface ServiceContent {
  serviceSlug: string;
  status: ContentStatus;
  hero: { eyebrow?: string; title: string; subtitle: string; primaryCta: string; secondaryCta?: string; benefits?: string[] };
  sections?: Array<{ title: string; body: string }>;
  summary: { shortDescription: string; clientResult: string; availability: string; durationText: string; priceText: string };
  whenRequired: Array<{ title: string; description: string }>;
  targetClients: Array<{ title: string; description?: string }>;
  problemsSolved: Array<{ problem: string; solution: string }>;
  legalBasis: Array<{ title: string; number?: string; date?: string; sourceUrl?: string; note?: string; verificationStatus: 'verified' | 'requires-review' | 'historical'; claimStatus: LegalClaimStatus }>;
  requiredDocuments: Array<{ title: string; required: boolean; description?: string; source?: 'client' | 'ecoprogress' | 'government' }>;
  workflow: Array<{ order: number; title: string; description: string; responsibleParty: 'client' | 'ecoprogress' | 'government' | 'joint'; estimatedDuration?: string; result?: string }>;
  deliverables: Array<{ title: string; description: string; format?: string }>;
  notIncluded: string[];
  pricingFactors: Array<{ title: string; description: string }>;
  risks: Array<{ risk: string; prevention: string }>;
  faq: AeoFaqItem[];
  aeo: ServiceAeoContent;
  relatedServices: string[];
  relatedArticles: string[];
  contentReview: { preparedBy?: string; reviewedBy?: string; lastReviewedAt?: string; reviewStatus: ReviewStatus };
}

export interface ArticleSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  checklist?: string[];
  warning?: string;
}

export interface ArticleContent {
  slug: string;
  status: ContentStatus;
  title: string;
  description: string;
  excerpt: string;
  shortAnswer: string;
  intent: 'informational' | 'how-to' | 'comparison' | 'legal-update' | 'checklist' | 'case-study';
  targetAudience: string[];
  relatedServiceSlugs: string[];
  relatedArticleSlugs: string[];
  datePublished: string;
  dateModified: string;
  authorSlug: string;
  reviewerSlug?: string;
  author?: Expert;
  reviewer?: Expert;
  lastReviewedAt?: string;
  heroImage?: string;
  heroImageAlt: string;
  imageRequiresReplacement?: boolean;
  tableOfContents: boolean;
  sections: ArticleSection[];
  sources: Array<{ title: string; url: string; accessedAt?: string; claimStatus: LegalClaimStatus }>;
  faq: AeoFaqItem[];
  reviewStatus: ReviewStatus;
}

export interface ArticleAuthor {
  name: string;
  role: string;
  profileUrl?: string;
}

export interface ArticleReviewer {
  name: string;
  role: string;
  reviewedAt: string;
}

export interface RegionContent {
  regionSlug: string;
  status: ContentStatus;
  introduction: string;
  industries: string[];
  commonTasks: string[];
  remoteConditions: string[];
  onSiteConditions: string[];
  logisticsNote: string;
  availableServiceSlugs: string[];
  relatedArticleSlugs: string[];
  faq: AeoFaqItem[];
  regionalFeatures?: string[];
  estimatedTimeline?: string;
  confirmedCaseSlugs?: string[];
  completedWorkExamples?: string[];
}

export interface Expert {
  id: string;
  fullName: string;
  position: string;
  specialization: string[];
  experienceYears: number;
  bio: string;
  photo: string;
  profileUrl: string;
}

export type ExpertProfile = Expert;

export interface TrustDocument {
  id: string; title: string; documentType: 'accreditation' | 'license' | 'permit' | 'certificate' | 'protocol' | 'other';
  number?: string; issuedBy?: string; issueDate?: string; validUntil?: string; fileUrl?: string; previewImage?: string;
  publicDescription: string; verificationStatus: 'verified' | 'requires-verification' | 'expired';
}

export interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  service: string;
  industry: string;
  city: string;
  region: string;
  objectType: string;
  objectCategory: string;
  problem: string;
  initialData: string;
  workPerformed: string[];
  regulations: Array<{ title: string; url?: string }>;
  result: string;
  completedAt: string;
  expert: Expert;
  reviewer: Expert;
  clientName?: string;
  clientAnonymous: boolean;
  status: 'draft' | 'review' | 'approved' | 'published' | 'rejected' | 'archived';
  publishedAt?: string;
  updatedAt: string;
}

export interface ContentRepository {
  getServices(): Promise<ServiceContent[]>;
  getServiceBySlug(slug: string): Promise<ServiceContent | null>;
  getArticles(): Promise<ArticleContent[]>;
  getArticleBySlug(slug: string): Promise<ArticleContent | null>;
  getRegions(): Promise<RegionContent[]>;
  getRegionBySlug(slug: string): Promise<RegionContent | null>;
  getExperts(): Promise<Expert[]>;
  getTrustDocuments(): Promise<TrustDocument[]>;
  getCases(): Promise<CaseStudy[]>;
  getCaseBySlug(slug: string): Promise<CaseStudy | null>;
}

export const isPublicContent = (status: ContentStatus) => status === 'published' || status === 'outdated';
export const isIndexableContent = (status: ContentStatus) => status === 'published';
