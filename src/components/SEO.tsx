import { useEffect } from 'react';
import { company } from '../config/company';

type SEOProps = {
  title: string;
  description: string;
  canonical?: string;
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

const SEO = ({ title, description, canonical, schema }: SEOProps) => {
  useEffect(() => {
    const url = canonical ?? `${company.siteUrl}${window.location.pathname}`;
    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('link[rel="canonical"]', 'href', url);

    const id = 'page-schema-json-ld';
    document.getElementById(id)?.remove();
    if (schema) {
      const script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [title, description, canonical, schema]);

  return null;
};

export default SEO;
