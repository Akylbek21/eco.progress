import { fetcher } from './api';
import type { ServiceItem } from '../types';
import {
  activeServices,
  getCatalogService,
  normalizeServiceSlug,
  type CatalogSource,
  type ServiceCatalogItem,
} from '../content/serviceCatalog';
import type { ServiceContent } from '../content/types';
import { trackEvent } from './analytics';

export interface ServiceCatalogResult {
  items: ServiceItem[];
  source: CatalogSource;
}

export const catalogItemToServiceItem = (service: ServiceCatalogItem): ServiceItem => ({
  id: service.slug,
  businessCompanyId: String(service.apiId ?? service.id),
  title: service.title,
  category: service.category,
  description: service.shortDescription,
  forWhom: service.targetClients.join(', '),
  result: service.deliverables.join('; '),
  includes: service.deliverables,
  documents: service.requiredDocuments,
  workflow: service.workflow.sort((a, b) => a.order - b.order).map((step) => step.title),
  duration: service.duration.text,
  icon: service.icon,
});

export const fallbackServices: ServiceItem[] = activeServices.map(catalogItemToServiceItem);

const canonicalizeApiServices = (items: ServiceContent[]): ServiceItem[] => {
  return items.flatMap((apiItem) => {
    const catalogItem = getCatalogService(normalizeServiceSlug(apiItem.serviceSlug));
    if (!catalogItem || !catalogItem.isActive) return [];
    return {
      ...catalogItemToServiceItem(catalogItem),
      id: catalogItem.slug,
      title: catalogItem.title,
      category: catalogItem.category,
      description: apiItem.summary.shortDescription,
      forWhom: apiItem.targetClients.map((client) => client.title).join(', '),
      result: apiItem.summary.clientResult,
      includes: apiItem.deliverables.map((deliverable) => deliverable.title),
      documents: apiItem.requiredDocuments.map((document) => document.title),
      workflow: [...apiItem.workflow].sort((left, right) => left.order - right.order).map((step) => step.title),
      duration: apiItem.summary.durationText,
    };
  });
};

const devLog = (message: string, error?: unknown) => {
  if (import.meta.env.DEV) console.info(`[service catalog] ${message}`, error ?? '');
};

export const getServiceCatalog = async (): Promise<ServiceCatalogResult> => {
  try {
    const services = await fetcher<ServiceContent[]>('/public/content/services');
    if (Array.isArray(services)) {
      return { items: canonicalizeApiServices(services), source: 'api' };
    }
    throw new Error('Public services API returned an invalid payload.');
  } catch (error) {
    devLog('API request failed; the complete local catalog is used.', error);
    trackEvent('content_fallback_usage', { collection: 'services' });
  }
  return { items: fallbackServices, source: 'fallback' };
};

export const getServices = async (): Promise<ServiceItem[]> => (await getServiceCatalog()).items;

export const getServiceById = async (id: string): Promise<ServiceItem | undefined> => {
  const slug = normalizeServiceSlug(id);
  const catalogItem = getCatalogService(slug);
  if (!catalogItem) return undefined;
  try {
    const apiItem = await fetcher<ServiceContent>(`/public/content/services/${encodeURIComponent(slug)}`);
    return canonicalizeApiServices([apiItem])[0] ?? catalogItemToServiceItem(catalogItem);
  } catch (error) {
    devLog(`Service ${slug} loaded from the local catalog.`, error);
    trackEvent('content_fallback_usage', { collection: 'service', slug });
    return catalogItemToServiceItem(catalogItem);
  }
};
