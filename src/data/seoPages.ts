import seoPagesJson from './seoPages.generated.json';
import type { Expert } from '../content/types';

export interface RelatedLink {
  label: string;
  path: string;
}

export interface SeoSection {
  title: string;
  body: string;
}

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoPageConfig {
  slug: string;
  city?: string;
  cityNominative?: string;
  cityGenitive?: string;
  cityDative?: string;
  cityAccusative?: string;
  cityInstrumental?: string;
  cityPrepositional?: string;
  regionNominative?: string;
  regionGenitive?: string;
  regionDative?: string;
  regionInstrumental?: string;
  regionPrepositional?: string;
  service?: string;
  serviceSlug?: string;
  type: 'city' | 'service-city' | 'article' | 'service' | 'main';
  title: string;
  description: string;
  h1: string;
  canonical: string;
  keywords?: string[];
  intro: string;
  sections: SeoSection[];
  services?: RelatedLink[];
  audience?: string[];
  outcomes?: string[];
  faq: SeoFaqItem[];
  relatedLinks: RelatedLink[];
  breadcrumbs: RelatedLink[];
  schemaType: 'LocalBusiness' | 'Service' | 'Article' | 'FAQPage' | 'WebPage';
  image?: string;
  priority?: number;
  changefreq?: string;
  lastmod?: string;
  indexable?: boolean;
  reviewStatus?: 'approved' | 'requires-specialist-review' | 'draft' | 'rejected';
  authorSlug?: string;
  reviewerSlug?: string;
  author?: Expert;
  reviewer?: Expert;
  datePublished?: string;
  lastReviewedAt?: string;
  sources?: Array<{ title: string; url: string; accessedAt?: string; claimStatus: 'verified' | 'requires-review' | 'general-information' }>;
  ctaTitle?: string;
  ctaText?: string;
}

export const seoPages = seoPagesJson as SeoPageConfig[];

export const seoPageMap = new Map(seoPages.map((page) => [page.slug, page]));

export const citySeoPages = seoPages.filter((page) => page.type === 'city');
export const serviceCitySeoPages = seoPages.filter((page) => page.type === 'service-city');
export const articleSeoPages = seoPages.filter((page) => page.type === 'article');

export const publicSeoSlugs = seoPages.map((page) => page.slug);
