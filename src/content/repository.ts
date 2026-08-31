import { normalizeServiceSlug } from './serviceCatalog.ts';
import { serviceContent, serviceContentMap } from './services/serviceContent.ts';
import { articleContent, articleContentMap } from './articles/articleContent.ts';
import { normalizeArticleSlug } from './articles/articleSlugs.ts';
import { regionContent, regionContentMap } from './regions/regionContent.ts';
import { experts } from './experts/experts.ts';
import { trustDocuments } from './trust-documents/trustDocuments.ts';
import { caseStudies } from './cases/caseStudies.ts';
import { isPublishableCaseStudy } from './cases/caseStudyPolicy.ts';
import { isPublicContent, type ArticleContent, type CaseStudy, type ContentRepository, type Expert, type RegionContent, type ServiceContent, type TrustDocument } from './types.ts';

export class LocalContentRepository implements ContentRepository {
  async getServices(): Promise<ServiceContent[]> { return serviceContent.filter((item) => isPublicContent(item.status)); }
  async getServiceBySlug(slug: string): Promise<ServiceContent | null> { const item = serviceContentMap.get(normalizeServiceSlug(slug)); return item && isPublicContent(item.status) ? item : null; }
  async getArticles(): Promise<ArticleContent[]> { return articleContent.filter((item) => isPublicContent(item.status)); }
  async getArticleBySlug(slug: string): Promise<ArticleContent | null> { const item = articleContentMap.get(normalizeArticleSlug(slug)); return item && isPublicContent(item.status) ? item : null; }
  async getRegions(): Promise<RegionContent[]> { return regionContent.filter((item) => isPublicContent(item.status)); }
  async getRegionBySlug(slug: string): Promise<RegionContent | null> { const item = regionContentMap.get(slug); return item && isPublicContent(item.status) ? item : null; }
  async getExperts(): Promise<Expert[]> { return experts; }
  async getTrustDocuments(): Promise<TrustDocument[]> { return trustDocuments; }
  async getCases(): Promise<CaseStudy[]> { return caseStudies.filter(isPublishableCaseStudy); }
  async getCaseBySlug(slug: string): Promise<CaseStudy | null> { return (await this.getCases()).find((item) => item.slug === slug) ?? null; }
}

export class FallbackContentRepository implements ContentRepository {
  private readonly primary: ContentRepository;
  private readonly fallback: ContentRepository;
  constructor(primary: ContentRepository, fallback: ContentRepository = new LocalContentRepository()) { this.primary = primary; this.fallback = fallback; }
  private async value<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> { try { return await primary(); } catch { return fallback(); } }
  getServices() { return this.value(() => this.primary.getServices(), () => this.fallback.getServices()); }
  getServiceBySlug(slug: string) { return this.value(() => this.primary.getServiceBySlug(slug), () => this.fallback.getServiceBySlug(slug)); }
  getArticles() { return this.value(() => this.primary.getArticles(), () => this.fallback.getArticles()); }
  getArticleBySlug(slug: string) { return this.value(() => this.primary.getArticleBySlug(slug), () => this.fallback.getArticleBySlug(slug)); }
  getRegions() { return this.value(() => this.primary.getRegions(), () => this.fallback.getRegions()); }
  getRegionBySlug(slug: string) { return this.value(() => this.primary.getRegionBySlug(slug), () => this.fallback.getRegionBySlug(slug)); }
  getExperts() { return this.value(() => this.primary.getExperts(), () => this.fallback.getExperts()); }
  getTrustDocuments() { return this.value(() => this.primary.getTrustDocuments(), () => this.fallback.getTrustDocuments()); }
  getCases() { return this.value(() => this.primary.getCases(), () => this.fallback.getCases()); }
  getCaseBySlug(slug: string) { return this.value(() => this.primary.getCaseBySlug(slug), () => this.fallback.getCaseBySlug(slug)); }
}
