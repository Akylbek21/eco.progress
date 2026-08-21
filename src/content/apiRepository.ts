import { fetcher } from '../services/api';
import { LocalContentRepository } from './repository';
import type { ArticleContent, CaseStudy, ContentRepository, Expert, RegionContent, ServiceContent, TrustDocument } from './types';
import { normalizeArticleSlug } from './articles/articleSlugs';
import { normalizeServiceSlug } from './serviceCatalog';
import { trackEvent } from '../services/analytics';

type PublicCollection = 'services' | 'articles' | 'regions' | 'experts' | 'trust-documents' | 'cases';
type CacheRecord<T> = { storedAt: number; version: string; items: T[] };
export type PublicContentSource = 'api' | 'cache' | 'fallback';

const CACHE_PREFIX = 'ecoprogress_public_content_v1';
const CACHE_TTL = 15 * 60 * 1000;

const readCache = <T>(collection: PublicCollection, allowStale = false): T[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${collection}`);
    if (!raw) return null;
    const record = JSON.parse(raw) as CacheRecord<T>;
    if (!Array.isArray(record.items) || (!allowStale && Date.now() - record.storedAt > CACHE_TTL)) return null;
    return record.items;
  } catch { return null; }
};

const writeCache = <T>(collection: PublicCollection, items: T[], version = 'unknown') => {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`${CACHE_PREFIX}:${collection}`, JSON.stringify({ storedAt: Date.now(), version, items } satisfies CacheRecord<T>)); } catch { /* Storage can be unavailable. */ }
};

export class ApiContentRepository implements ContentRepository {
  private readonly devFallback?: ContentRepository;
  private source: PublicContentSource = 'api';
  constructor(devFallback?: ContentRepository) { this.devFallback = devFallback; }
  getLastSource() { return this.source; }

  private async collection<T>(name: PublicCollection, fallback: () => Promise<T[]>): Promise<T[]> {
    try {
      const response = await fetcher<{ items: T[]; version?: string } | T[]>(`/public/content/${name}`);
      const items = Array.isArray(response) ? response : response.items;
      if (!Array.isArray(items)) throw new Error(`Invalid public content payload: ${name}`);
      writeCache(name, items, Array.isArray(response) ? 'unknown' : response.version);
      this.source = 'api';
      trackEvent('content_cache_miss', { collection: name });
      return items;
    } catch (error) {
      if (!import.meta.env.DEV || !this.devFallback) throw error;
      const cached = readCache<T>(name, true);
      if (cached) { this.source = 'cache'; trackEvent('content_cache_hit', { collection: name }); return cached; }
      this.source = 'fallback';
      trackEvent('content_fallback_usage', { collection: name });
      if (import.meta.env.DEV) {
        const status = typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
        console.warn(`[content] ${name}: public API unavailable${status ? ` (HTTP ${status})` : ''}; using dev fallback.`);
      }
      return fallback();
    }
  }

  getServices() { return this.collection<ServiceContent>('services', () => this.devFallback!.getServices()); }
  async getServiceBySlug(slug: string) {
    const canonical = normalizeServiceSlug(slug);
    const items = await this.getServices();
    return items.find((item) => item.serviceSlug === canonical) ?? null;
  }
  getArticles() { return this.collection<ArticleContent>('articles', () => this.devFallback!.getArticles()); }
  async getArticleBySlug(slug: string) {
    const canonical = normalizeArticleSlug(slug);
    const items = await this.getArticles();
    return items.find((item) => item.slug === canonical) ?? null;
  }
  getRegions() { return this.collection<RegionContent>('regions', () => this.devFallback!.getRegions()); }
  async getRegionBySlug(slug: string) {
    const items = await this.getRegions();
    return items.find((item) => item.regionSlug === slug) ?? null;
  }
  getExperts() { return this.collection<Expert>('experts', () => this.devFallback!.getExperts()); }
  getTrustDocuments() { return this.collection<TrustDocument>('trust-documents', () => this.devFallback!.getTrustDocuments()); }
  getCases() { return this.collection<CaseStudy>('cases', () => this.devFallback!.getCases()); }
  async getCaseBySlug(slug: string) {
    const items = await this.getCases();
    return items.find((item) => item.slug === slug) ?? null;
  }
}

export const publicContentRepository = new ApiContentRepository(
  import.meta.env.DEV ? new LocalContentRepository() : undefined,
);
