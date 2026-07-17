import { company } from '../config/company';
import { normalizeArticleDates } from './articleDates';
import type { ServiceCatalogItem } from '../content/serviceCatalog';

type Schema = Record<string, unknown>;
const organizationRef = { '@type': 'Organization', name: company.name, url: company.siteUrl };

export const buildOrganizationSchema = (): Schema => ({
  '@context': 'https://schema.org', '@type': 'Organization', name: company.name, url: company.siteUrl,
  logo: `${company.siteUrl}/favicon.png`, email: company.email, telephone: company.phone,
  address: { '@type': 'PostalAddress', streetAddress: company.address, addressLocality: 'Шымкент', addressCountry: 'KZ' },
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

export const buildArticleSchema = (article: { headline: string; description: string; datePublished: string; dateModified?: string; url: string; image: string }): Schema => {
  const dates = normalizeArticleDates(article.datePublished, article.dateModified);
  return { '@context': 'https://schema.org', '@type': 'Article', headline: article.headline, description: article.description,
    ...dates, author: organizationRef, publisher: organizationRef, mainEntityOfPage: article.url, image: article.image };
};

export const buildFaqSchema = (faq: Array<{ question: string; answer: string }>): Schema => ({
  '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
});

export const buildBreadcrumbSchema = (items: Array<{ name: string; url: string }>): Schema => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })),
});
