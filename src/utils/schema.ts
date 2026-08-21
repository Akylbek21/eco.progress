import { company } from '../config/company';
import { normalizeArticleDates } from './articleDates';
import type { ServiceCatalogItem } from '../content/serviceCatalog';
import type { Expert } from '../content/types';

type Schema = Record<string, unknown>;
const organizationRef = { '@type': 'Organization', name: company.name, url: company.siteUrl };

export const buildOrganizationSchema = (): Schema => ({
  '@context': 'https://schema.org', '@type': 'Organization', name: company.name, url: company.siteUrl,
  logo: `${company.siteUrl}/favicon.png`, email: company.email, telephone: company.phone,
  sameAs: [company.instagramUrl, company.tiktokUrl, company.mapsUrl],
  address: { '@type': 'PostalAddress', streetAddress: company.address, addressLocality: 'Шымкент', addressCountry: 'KZ' },
});

export const buildLocalBusinessSchema = (): Schema => ({
  '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': `${company.siteUrl}/#local-business`,
  name: company.name, url: company.siteUrl, image: `${company.siteUrl}/media/social/ecoprogress-og-1200x630.jpg`,
  email: company.email, telephone: company.phone,
  address: { '@type': 'PostalAddress', streetAddress: company.address, addressLocality: 'Шымкент', addressCountry: 'KZ' },
  areaServed: { '@type': 'City', name: 'Шымкент' },
  openingHours: 'Mo-Fr 09:00-18:00',
});

export const buildServiceSchema = (service: ServiceCatalogItem, url = `${company.siteUrl}/services/${service.slug}`): Schema => {
  const schema: Schema = {
    '@context': 'https://schema.org', '@type': 'Service', name: service.title, description: service.fullDescription,
    provider: organizationRef, areaServed: service.areaServed.type === 'KAZAKHSTAN' ? 'Казахстан' : service.areaServed.regions,
    serviceType: service.category, url,
  };
  if (service.pricing.priceFrom !== undefined) {
    schema.offers = { '@type': 'Offer', priceCurrency: 'KZT', price: service.pricing.priceFrom, url };
  }
  if (service.areaServed.remote) schema.availableChannel = { '@type': 'ServiceChannel', serviceUrl: url, availableLanguage: ['ru', 'kk'] };
  return schema;
};

export const buildPersonSchema = (expert: Expert, id: string): Schema => ({
  '@context': 'https://schema.org', '@type': 'Person', '@id': id, name: expert.fullName,
  jobTitle: expert.position, description: expert.bio, image: expert.photo, url: expert.profileUrl,
  knowsAbout: expert.specialization,
});

export const buildArticleSchema = (article: { headline: string; description: string; datePublished: string; dateModified?: string; url: string; image: string; authorId?: string; reviewerId?: string }): Schema => {
  const dates = normalizeArticleDates(article.datePublished, article.dateModified);
  return { '@context': 'https://schema.org', '@type': 'Article', headline: article.headline, description: article.description,
    ...dates, author: article.authorId ? { '@id': article.authorId } : organizationRef,
    ...(article.reviewerId ? { reviewedBy: { '@id': article.reviewerId } } : {}),
    publisher: organizationRef, mainEntityOfPage: article.url, image: article.image };
};

export const buildFaqSchema = (faq: Array<{ question: string; answer: string }>): Schema => ({
  '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
});

export const buildBreadcrumbSchema = (items: Array<{ name: string; url: string }>): Schema => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })),
});
