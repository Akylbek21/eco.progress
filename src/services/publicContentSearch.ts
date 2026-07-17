import { publicContentRepository } from '../content/apiRepository';
import { regions } from '../content/regions';

export interface PublicSearchResult {
  type: 'service' | 'article' | 'region';
  slug: string;
  title: string;
  description: string;
  url: string;
}

const normalize = (value: string) => value.toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim();

export const searchPublicContent = async (query: string): Promise<PublicSearchResult[]> => {
  const needle = normalize(query);
  if (needle.length < 2) return [];
  const [services, articles, regionItems] = await Promise.all([
    publicContentRepository.getServices(),
    publicContentRepository.getArticles(),
    publicContentRepository.getRegions(),
  ]);
  const results: PublicSearchResult[] = [];
  for (const item of services) {
    const haystack = normalize(`${item.hero.title} ${item.hero.subtitle} ${item.summary.shortDescription} ${item.summary.clientResult}`);
    if (haystack.includes(needle)) results.push({ type: 'service', slug: item.serviceSlug, title: item.hero.title, description: item.summary.shortDescription, url: `/services/${item.serviceSlug}` });
  }
  for (const item of articles) {
    const haystack = normalize(`${item.title} ${item.description} ${item.excerpt} ${item.shortAnswer} ${item.sections.map((section) => `${section.title} ${section.paragraphs.join(' ')}`).join(' ')}`);
    if (haystack.includes(needle)) results.push({ type: 'article', slug: item.slug, title: item.title, description: item.excerpt, url: `/news/${item.slug}` });
  }
  for (const item of regionItems) {
    const forms = regions.find((region) => region.slug === item.regionSlug);
    const title = forms?.regionNominative || item.regionSlug;
    const haystack = normalize(`${title} ${item.introduction} ${item.industries.join(' ')} ${item.commonTasks.join(' ')}`);
    if (haystack.includes(needle)) results.push({ type: 'region', slug: item.regionSlug, title, description: item.introduction, url: `/${item.regionSlug}` });
  }
  return results.slice(0, 50);
};
