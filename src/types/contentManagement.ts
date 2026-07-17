export type CmsContentType = 'SERVICE' | 'ARTICLE' | 'REGION' | 'REGIONAL_PAGE' | 'CASE' | 'EXPERT' | 'TRUST_DOCUMENT' | 'LEGAL_SOURCE' | 'REDIRECT';
export type CmsContentStatus = 'DRAFT' | 'CONTENT_REVIEW' | 'EXPERT_REVIEW' | 'LEGAL_REVIEW' | 'SEO_REVIEW' | 'READY_TO_PUBLISH' | 'SCHEDULED' | 'PUBLISHED' | 'OUTDATED' | 'UNPUBLISHED' | 'ARCHIVED' | 'REJECTED';
export type CmsVersionStatus = 'draft' | 'approved' | 'published' | 'archived';

export interface CmsSeoFields {
  title: string;
  description: string;
  canonical: string;
  robots: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  keywords?: string[];
  openGraphTitle?: string;
  openGraphDescription?: string;
  openGraphImageFileId?: string;
}

export interface CmsContentSummary {
  id: string;
  type: CmsContentType;
  slug: string;
  title: string;
  category?: string;
  status: CmsContentStatus;
  versionNumber: number;
  publishedVersionId?: string;
  draftVersionId?: string;
  isActive: boolean;
  indexAllowed: boolean;
  updatedAt: string;
  updatedByName?: string;
  scheduledAt?: string;
  nextReviewAt?: string;
  validationErrors: number;
  validationWarnings: number;
}

export interface CmsContentDetail extends CmsContentSummary {
  locale: 'ru' | 'kk';
  schemaVersion: number;
  payload: Record<string, unknown>;
  seo: CmsSeoFields;
  optimisticLockVersion: number;
  createdAt: string;
  createdByName?: string;
}

export type CreateCmsContentInput = Pick<CmsContentDetail, 'slug' | 'title' | 'locale' | 'schemaVersion' | 'payload' | 'seo' | 'isActive' | 'indexAllowed'> & { category?: string };

export interface CmsContentVersion {
  id: string;
  contentType: CmsContentType;
  contentId: string;
  versionNumber: number;
  payload: Record<string, unknown>;
  seo: CmsSeoFields;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  changeSummary?: string;
  sourceVersionId?: string;
  status: CmsVersionStatus;
}

export interface CmsStatusHistory {
  id: string;
  contentType: CmsContentType;
  contentId: string;
  fromStatus?: CmsContentStatus;
  toStatus: CmsContentStatus;
  changedBy: string;
  changedByName?: string;
  changedAt: string;
  comment?: string;
}

export interface CmsComment {
  id: string;
  contentType: CmsContentType;
  contentId: string;
  versionId: string;
  fieldPath?: string;
  text: string;
  authorId: string;
  authorName?: string;
  createdAt: string;
  status: 'OPEN' | 'RESOLVED';
  blocking: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface CmsValidationMessage { code: string; field?: string; message: string }
export interface CmsValidationResult { valid: boolean; errors: CmsValidationMessage[]; warnings: CmsValidationMessage[]; info: Array<{ code: string; message: string }> }

export interface CmsPage<T> { items: T[]; page: number; size: number; total: number; totalPages: number }
export interface CmsListFilters { type?: CmsContentType; status?: CmsContentStatus; query?: string; page?: number; size?: number; indexAllowed?: boolean }

export interface CmsDashboard {
  publishedServices: number;
  draftServices: number;
  articlesInReview: number;
  outdatedMaterials: number;
  expiringDocuments: number;
  brokenLinks: number;
  seoErrors: number;
  materialsWithoutAuthor: number;
  pagesWithoutSources: number;
  weakRegionalPages: number;
  scheduledPublications: number;
  recentChanges: CmsStatusHistory[];
}

export interface CmsVersionDiff {
  leftVersionId: string;
  rightVersionId: string;
  fields: Array<{ path: string; kind: 'ADDED' | 'REMOVED' | 'CHANGED'; before?: unknown; after?: unknown }>;
}

export type CmsBlockType = 'paragraph' | 'heading' | 'list' | 'table' | 'quote' | 'warning' | 'checklist' | 'steps' | 'image' | 'gallery' | 'legal-source' | 'service-card' | 'faq' | 'cta' | 'comparison';

export interface CmsContentBlock {
  id: string;
  type: CmsBlockType;
  title?: string;
  text?: string;
  items?: string[];
  fileId?: string;
  alt?: string;
  referenceId?: string;
}

export interface CmsFile {
  id: string;
  originalName: string;
  mediaType: string;
  byteSize: number;
  publicUrl?: string;
  altText?: string;
  scanStatus: 'PENDING' | 'CLEAN' | 'REJECTED';
}

export interface CmsPreviewToken {
  url: string;
  expiresAt: string;
}

export type CmsWorkflowAction = 'submit-content-review' | 'approve-content' | 'submit-expert-review' | 'approve-expert' | 'submit-legal-review' | 'approve-legal' | 'submit-seo-review' | 'approve-seo' | 'schedule' | 'publish' | 'unpublish' | 'archive' | 'reject';

export interface LeadContentAttribution {
  sourceType?: 'SERVICE' | 'ARTICLE' | 'REGIONAL_PAGE' | 'CASE' | 'HOME' | 'TARIFF' | 'CALCULATOR';
  sourceId?: string;
  sourceSlug?: string;
  sourceUrl?: string;
  serviceId?: string;
  serviceSlug?: string;
  regionId?: string;
  ctaId?: string;
  formId?: string;
  firstTouchUrl?: string;
  lastTouchUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  calculatorValue?: number;
  calculatorCurrency?: 'KZT';
}

export type ContentAnalyticsEventName = 'content_view' | 'service_view' | 'article_view' | 'regional_page_view' | 'cta_click' | 'form_start' | 'form_submit' | 'form_error' | 'calculator_start' | 'calculator_complete' | 'phone_click' | 'whatsapp_click' | 'email_click' | 'related_service_click' | 'related_article_click' | 'document_view' | 'document_download' | 'table_of_contents_click' | 'scroll_depth';
export interface ContentAnalyticsEvent {
  eventName: ContentAnalyticsEventName;
  pageType: string;
  contentId?: string;
  contentSlug?: string;
  serviceId?: string;
  serviceSlug?: string;
  regionId?: string;
  ctaId?: string;
  position?: string;
  value?: number;
  currency?: 'KZT';
}

export interface ContentAnalyticsSummary {
  views: number; ctaClicks: number; formStarts: number; formSubmits: number; qualifiedLeads: number; commercialOffers: number; contracts: number;
  funnel: Array<{ stage: string; value: number; conversionFromPrevious?: number }>;
  topContent: Array<{ contentId: string; title: string; type: CmsContentType; views: number; leads: number; conversion: number }>;
}

export interface LocalizedContent {
  language: 'ru' | 'kk';
  status: CmsContentStatus;
  sourceContentId?: string;
  translationStatus: 'NOT_STARTED' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  title?: string;
  description?: string;
  slug?: string;
  seo?: CmsSeoFields;
  lastReviewedAt?: string;
}

export interface ContentExperimentVariant {
  id: string;
  name: string;
  trafficPercent: number;
  versionId: string;
}

export interface ContentExperiment {
  id: string;
  name: string;
  contentId: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  startAt?: string;
  endAt?: string;
  primaryMetric: 'CTA_CLICK' | 'FORM_START' | 'FORM_SUBMIT';
  variants: ContentExperimentVariant[];
}
