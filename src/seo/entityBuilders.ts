import { COMPANY } from '../config/companyData.ts';
import type { Expert } from '../content/types.ts';
import { normalizeArticleDates } from '../utils/articleDates.ts';
import { canonicalForPublicPath, PUBLIC_SITE_URL } from './indexingPolicy.ts';

export type SchemaEntity = Record<string, unknown>;
export type BreadcrumbEntity = { name: string; url: string };

export const entityIds = (canonical: string) => ({
  organization: `${PUBLIC_SITE_URL}/#organization`,
  localBusiness: `${PUBLIC_SITE_URL}/#local-business`,
  website: `${PUBLIC_SITE_URL}/#website`,
  webpage: `${canonical}#webpage`,
  service: `${canonical}#service`,
  article: `${canonical}#article`,
  breadcrumb: `${canonical}#breadcrumb`,
  author: `${canonical}#author`,
  reviewer: `${canonical}#reviewer`,
});

const organizationRef = () => ({ '@type': 'Organization', '@id': entityIds(PUBLIC_SITE_URL).organization, name: COMPANY.name });

export const buildOrganizationSchema = (): SchemaEntity => ({
  '@context': 'https://schema.org', '@type': 'Organization', '@id': entityIds(PUBLIC_SITE_URL).organization,
  name: COMPANY.name, alternateName: COMPANY.brandName, url: PUBLIC_SITE_URL,
  logo: { '@type': 'ImageObject', url: COMPANY.logo }, email: COMPANY.email, telephone: COMPANY.phone.display,
  address: { '@type': 'PostalAddress', streetAddress: COMPANY.address.street, addressLocality: COMPANY.address.city, addressCountry: COMPANY.address.country },
  sameAs: [COMPANY.instagramUrl, COMPANY.tiktokUrl, COMPANY.mapsUrl],
});

export const buildLocalBusinessSchema = (): SchemaEntity => ({
  '@context': 'https://schema.org', '@type': ['LocalBusiness', 'ProfessionalService'], '@id': entityIds(PUBLIC_SITE_URL).localBusiness,
  name: COMPANY.name, url: PUBLIC_SITE_URL, image: COMPANY.defaultOgImage, email: COMPANY.email, telephone: COMPANY.phone.display,
  parentOrganization: organizationRef(),
  address: { '@type': 'PostalAddress', streetAddress: COMPANY.address.street, addressLocality: COMPANY.address.city, addressCountry: COMPANY.address.country },
  areaServed: { '@type': 'City', name: COMPANY.address.city }, openingHours: 'Mo-Fr 09:00-18:00',
});

export const buildWebSiteSchema = (): SchemaEntity => ({
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': entityIds(PUBLIC_SITE_URL).website,
  name: COMPANY.brandName, url: PUBLIC_SITE_URL, publisher: organizationRef(),
});

export const buildWebPageSchema = (input: { canonical: string; name: string; description?: string; dateModified?: string; citationUrls?: string[] }): SchemaEntity => ({
  '@context': 'https://schema.org', '@type': 'WebPage', '@id': entityIds(input.canonical).webpage,
  url: input.canonical, name: input.name, ...(input.description ? { description: input.description } : {}),
  ...(input.dateModified ? { dateModified: input.dateModified } : {}), isPartOf: { '@id': entityIds(PUBLIC_SITE_URL).website },
  ...(input.citationUrls?.length ? { citation: input.citationUrls } : {}),
});

export const buildServiceEntity = (input: { canonical: string; name: string; description: string; serviceType?: string; areaServed?: string | string[]; image?: string; expertIds?: string[]; caseUrls?: string[]; citationUrls?: string[] }): SchemaEntity => ({
  '@context': 'https://schema.org', '@type': 'Service', '@id': entityIds(input.canonical).service,
  url: input.canonical, name: input.name, description: input.description, serviceType: input.serviceType ?? input.name,
  provider: organizationRef(),
  areaServed: Array.isArray(input.areaServed) ? input.areaServed.map((name) => ({ '@type': 'Place', name })) : input.areaServed ? { '@type': 'Place', name: input.areaServed } : { '@type': 'Country', name: 'Казахстан' },
  ...(input.image ? { image: input.image } : {}),
  ...(input.expertIds?.length ? { subjectOf: input.expertIds.map((id) => ({ '@id': id })) } : {}),
  ...(input.caseUrls?.length ? { hasPart: input.caseUrls.map((url) => ({ '@id': `${url}#article` })) } : {}),
  ...(input.citationUrls?.length ? { citation: input.citationUrls } : {}),
});

export const buildPersonSchema = (expert: Expert, id: string): SchemaEntity => ({
  '@context': 'https://schema.org', '@type': 'Person', '@id': id, name: expert.fullName,
  url: expert.profileUrl.startsWith('http') ? expert.profileUrl : canonicalForPublicPath(expert.profileUrl),
  ...(expert.position ? { jobTitle: expert.position } : {}),
  ...(expert.bio ? { description: expert.bio } : {}),
  ...(expert.photo ? { image: expert.photo } : {}),
  ...(expert.specialization.length ? { knowsAbout: expert.specialization } : {}),
  ...(expert.credentials.length ? { hasCredential: expert.credentials.map((item) => ({
    '@type': 'EducationalOccupationalCredential', name: item.title, credentialCategory: item.document,
    recognizedBy: { '@type': 'Organization', name: item.issuedBy },
    ...(item.number ? { identifier: item.number } : {}),
  })) } : {}),
  worksFor: organizationRef(),
});

export const buildArticleSchema = (input: { canonical: string; headline: string; description: string; datePublished: string; dateModified?: string; image: string; authorId?: string; reviewerId?: string; serviceId?: string; caseUrls?: string[] }): SchemaEntity => {
  const dates = normalizeArticleDates(input.datePublished, input.dateModified);
  return {
    '@context': 'https://schema.org', '@type': 'Article', '@id': entityIds(input.canonical).article,
    url: input.canonical, headline: input.headline, description: input.description, image: input.image, ...dates,
    author: input.authorId ? { '@id': input.authorId } : organizationRef(),
    ...(input.reviewerId ? { reviewedBy: { '@id': input.reviewerId } } : {}),
    publisher: organizationRef(), mainEntityOfPage: { '@id': entityIds(input.canonical).webpage },
    ...(input.serviceId ? { about: { '@id': input.serviceId } } : {}),
    ...(input.caseUrls?.length ? { citation: input.caseUrls } : {}),
  };
};

export const buildBreadcrumbSchema = (items: BreadcrumbEntity[], canonical = items[items.length - 1]?.url ?? PUBLIC_SITE_URL): SchemaEntity => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList', '@id': entityIds(canonical).breadcrumb,
  itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url.startsWith('http') ? item.url : canonicalForPublicPath(item.url) })),
});

export const buildCorePageEntities = (input: { canonical: string; name: string; description?: string; dateModified?: string; localBusiness?: boolean; citationUrls?: string[] }): SchemaEntity[] => [
  buildOrganizationSchema(),
  ...(input.localBusiness ? [buildLocalBusinessSchema()] : []),
  buildWebSiteSchema(),
  buildWebPageSchema(input),
];
