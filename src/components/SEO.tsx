import { useEffect } from 'react';
import { company } from '../config/company';
import { appConfig } from '../config/app';
import seoRegistryJson from '../data/seoRegistry.generated.json';

type SeoRegistryEntry = {
  path: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogImage: string;
};

const seoRegistry = new Map((seoRegistryJson as SeoRegistryEntry[]).map((entry) => [entry.path, entry]));

type SEOProps = {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  type?: 'website' | 'article';
  robots?: string;
  schema?: Record<string, unknown> | Record<string, unknown>[];
};

const setMeta = (selector: string, attr: 'content' | 'href', value: string) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (!element) {
    element = selector.startsWith('link') ? document.createElement('link') : document.createElement('meta');
    const match = selector.match(/\[(name|property|rel)="(.+)"\]/);
    if (match) element.setAttribute(match[1], match[2]);
    document.head.appendChild(element);
  }
  element.setAttribute(attr, value);
};

const SEO = ({ title, description, canonical, ogImage = `${company.siteUrl}/og-cover.jpg`, type = 'website', robots = 'index,follow', schema }: SEOProps) => {
  useEffect(() => {
    const path = window.location.pathname.length > 1 ? window.location.pathname.replace(/\/+$/, '') : '/';
    const registered = seoRegistry.get(path);
    const resolvedTitle = registered?.title || title;
    const resolvedDescription = registered?.description || description;
    const url = registered?.canonical || canonical || `${company.siteUrl}${path === '/' ? '/' : path}`;
    const resolvedRobots = registered?.robots || robots;
    const resolvedImage = registered?.ogImage || (ogImage.startsWith('http') ? ogImage : `${company.siteUrl}${ogImage}`);
    document.title = resolvedTitle;
    setMeta('meta[name="description"]', 'content', resolvedDescription);
    setMeta('meta[property="og:title"]', 'content', resolvedTitle);
    setMeta('meta[name="robots"]', 'content', resolvedRobots);
    setMeta('meta[property="og:description"]', 'content', resolvedDescription);
    setMeta('meta[property="og:type"]', 'content', type);
    setMeta('meta[property="og:site_name"]', 'content', company.name);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:image"]', 'content', resolvedImage);
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'content', resolvedTitle);
    setMeta('meta[name="twitter:description"]', 'content', resolvedDescription);
    setMeta('meta[name="twitter:image"]', 'content', resolvedImage);
    setMeta('link[rel="canonical"]', 'href', url);

    if (appConfig.googleSiteVerification) {
      setMeta('meta[name="google-site-verification"]', 'content', appConfig.googleSiteVerification);
    } else {
      document.head.querySelector('meta[name="google-site-verification"]')?.remove();
    }

    const id = 'page-schema-json-ld';
    document.getElementById(id)?.remove();
    if (schema) {
      const script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [title, description, canonical, ogImage, type, robots, schema]);

  return null;
};

export default SEO;
