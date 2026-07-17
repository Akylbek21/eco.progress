import type { ContentAuditItem } from './types.ts';
import { serviceContent } from './services/serviceContent.ts';
import { articleContent } from './articles/articleContent.ts';
import { regionContent } from './regions/regionContent.ts';

const countWords = (parts: string[]) => parts.join(' ').trim().split(/\s+/u).filter(Boolean).length;

const serviceAudit: ContentAuditItem[] = serviceContent.map((item) => ({
  url: `/services/${item.serviceSlug}`,
  pageType: 'service',
  primaryIntent: 'commercial',
  targetAudience: item.targetClients.map((client) => client.title).join(', '),
  currentWordCount: countWords([
    item.hero.subtitle, item.summary.shortDescription, item.summary.clientResult,
    ...item.whenRequired.flatMap((entry) => [entry.title, entry.description]),
    ...item.workflow.flatMap((entry) => [entry.title, entry.description, entry.result || '']),
    ...item.deliverables.flatMap((entry) => [entry.title, entry.description]),
    ...item.faq.flatMap((entry) => [entry.question, entry.answer]),
  ]),
  hasLegalBasis: item.legalBasis.length > 0,
  hasAuthor: Boolean(item.contentReview.preparedBy),
  hasRealExamples: false,
  hasUsefulFaq: item.faq.length >= 5,
  hasInternalLinks: item.relatedServices.length + item.relatedArticles.length > 0,
  hasCallToAction: true,
  problems: item.contentReview.reviewStatus === 'approved' ? [] : ['Требуется проверка профильным экологом', 'Нет согласованного реального кейса'],
  recommendedAction: item.contentReview.reviewStatus === 'approved' ? 'keep' : 'expand',
  priority: 'P0',
}));

const articleAudit: ContentAuditItem[] = articleContent.map((item) => ({
  url: `/news/${item.slug}`,
  pageType: 'article',
  primaryIntent: item.intent,
  targetAudience: item.targetAudience.join(', '),
  currentWordCount: countWords([item.shortAnswer, ...item.sections.flatMap((section) => [...section.paragraphs, ...(section.bullets || []), ...(section.checklist || []), section.warning || '']), ...item.faq.flatMap((entry) => [entry.question, entry.answer])]),
  hasLegalBasis: item.sources.length > 0,
  hasAuthor: Boolean(item.authorSlug),
  hasRealExamples: item.intent === 'case-study',
  hasUsefulFaq: item.faq.length > 0,
  hasInternalLinks: item.relatedServiceSlugs.length + item.relatedArticleSlugs.length > 0,
  hasCallToAction: true,
  problems: item.reviewStatus === 'approved' ? [] : ['Требуется проверка профильным экологом'],
  recommendedAction: 'expand',
  priority: 'P1',
}));

const regionAudit: ContentAuditItem[] = regionContent.map((item) => ({
  url: `/ecologicheskie-uslugi-${item.regionSlug}`,
  pageType: 'regional',
  primaryIntent: 'regional-commercial',
  targetAudience: item.industries.join(', '),
  currentWordCount: countWords([item.introduction, ...item.commonTasks, ...item.remoteConditions, ...item.onSiteConditions, item.logisticsNote, ...item.faq.flatMap((entry) => [entry.question, entry.answer])]),
  hasLegalBasis: false,
  hasAuthor: false,
  hasRealExamples: false,
  hasUsefulFaq: item.faq.length > 0,
  hasInternalLinks: item.availableServiceSlugs.length + item.relatedArticleSlugs.length > 0,
  hasCallToAction: true,
  problems: ['Нет согласованного регионального кейса', 'Требуется редакционное расширение до экспертного объёма'],
  recommendedAction: 'expand',
  priority: 'P1',
}));

export const contentAudit: ContentAuditItem[] = [...serviceAudit, ...articleAudit, ...regionAudit];
