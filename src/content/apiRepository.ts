import { fetcher } from '../services/api';
import { LocalContentRepository } from './repository';
import type { ArticleContent, ContentRepository, RegionContent, ServiceContent } from './types';
import { normalizeArticleSlug } from './articles/articleContent';
import { normalizeServiceSlug } from './serviceCatalog';
import { trackEvent } from '../services/analytics';

type PublicCollection = 'services' | 'articles' | 'regions';
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
  private readonly fallback: ContentRepository;
  private source: PublicContentSource = 'api';
  constructor(fallback: ContentRepository = new LocalContentRepository()) { this.fallback = fallback; }
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
      const cached = readCache<T>(name, true);
      if (cached) { this.source = 'cache'; trackEvent('content_cache_hit', { collection: name }); return cached; }
      this.source = 'fallback';
      trackEvent('content_fallback_usage', { collection: name });
      if (import.meta.env.DEV) console.info(`[content] ${name} loaded from static fallback`, error);
      return fallback();
    }
  }

  getServices() { return this.collection<ServiceContent>('services', () => this.fallback.getServices()); }
  async getServiceBySlug(slug: string) {
    const canonical = normalizeServiceSlug(slug);
    const items = await this.getServices();
    return items.find((item) => item.serviceSlug === canonical) ?? null;
  }
  getArticles() { return this.collection<ArticleContent>('articles', () => this.fallback.getArticles()); }
  async getArticleBySlug(slug: string) {
    const canonical = normalizeArticleSlug(slug);
    const items = await this.getArticles();
    return items.find((item) => item.slug === canonical) ?? null;
  }
  getRegions() { return this.collection<RegionContent>('regions', () => this.fallback.getRegions()); }
  async getRegionBySlug(slug: string) {
    const items = await this.getRegions();
    return items.find((item) => item.regionSlug === slug) ?? null;
  }
}

export const publicContentRepository = new ApiContentRepository();
