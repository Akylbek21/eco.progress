import { useEffect } from 'react';
import { company } from '../config/company';
import { appConfig } from '../config/app';
import type { SeoRobots } from '../seo/types';
import { absoluteUrl, normalizePathname } from '../seo/url';
import { createSchemaGraph } from '../seo/schemaGraph';

type SEOProps = {
  title?: string;
  description?: string;
  h1?: string;
  canonical?: string;
  ogImage?: string;
  type?: 'website' | 'article';
  robots?: SeoRobots;
  schema?: Record<string, unknown> | Record<string, unknown>[];
  datePublished?: string;
  dateModified?: string;
  alternates?: Array<{ locale: 'ru' | 'kk' | 'x-default'; url: string }>;
};

const setUniqueHeadValue = (
  selector: string,
  attribute: 'content' | 'href',
  value: string,
) => {
  const matches = [...document.head.querySelectorAll(selector)] as Array<HTMLMetaElement | HTMLLinkElement>;
  const element = matches.shift() ?? (selector.startsWith('link') ? document.createElement('link') : document.createElement('meta'));
  if (!element.parentNode) {
    const match = selector.match(/\[(name|property|rel)="(.+)"\]/);
    if (match) element.setAttribute(match[1], match[2]);
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
  matches.forEach((duplicate) => duplicate.remove());
};

const safeJson = (value: unknown) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const warnInDevelopment = (entry: {
  title: string;
  description: string;
  canonical: string;
  robots: SeoRobots;
  expectedH1?: string;
}) => {
  if (!import.meta.env.DEV) return;
  const warnings: string[] = [];
  if (!entry.title.trim()) warnings.push('отсутствует title');
  if (!entry.description.trim()) warnings.push('отсутствует description');
  if (!entry.canonical.trim()) warnings.push('отсутствует canonical');
  if (entry.title.length > 65) warnings.push(`title длиннее 65 символов (${entry.title.length})`);
  if (entry.description.length < 120 || entry.description.length > 180) warnings.push(`description вне диапазона 120–180 (${entry.description.length})`);
  if (entry.robots === 'index,follow') {
    const h1 = document.querySelector('main h1, #root h1');
    if (!h1?.textContent?.trim()) warnings.push('на индексируемой странице отсутствует непустой H1');
    if (entry.expectedH1 && h1?.textContent?.trim() !== entry.expectedH1.trim()) warnings.push('H1 не совпадает с SEO-реестром');
  }
  warnings.forEach((message) => console.warn(`[SEO] ${window.location.pathname}: ${message}`));
};

const SEO = ({
  title,
  description,
  h1,
  canonical,
  ogImage,
  type,
  robots,
  schema,
  datePublished,
  dateModified,
  alternates = [],
}: SEOProps) => {
  useEffect(() => {
    const path = normalizePathname(window.location.pathname);
    const currentDescription = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
    const currentRobots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content as SeoRobots | undefined;
    const currentCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    const currentOgImage = document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
    const currentOgType = document.head.querySelector<HTMLMetaElement>('meta[property="og:type"]')?.content as SEOProps['type'] | undefined;

    // Explicit values are entity/page overrides. They intentionally win over route data.
    const resolvedTitle = title?.trim() || document.title || `${company.name} | Экологические услуги`;
    const resolvedDescription = description?.trim() || currentDescription || 'Экологические услуги и сопровождение бизнеса в Казахстане.';
    const currentCanonicalPath = currentCanonical ? normalizePathname(new URL(currentCanonical, window.location.origin).pathname) : undefined;
    const samePrerenderedRoute = currentCanonicalPath === path;
    const resolvedCanonical = absoluteUrl(canonical || (samePrerenderedRoute ? currentCanonical : undefined) || path);
    const resolvedRobots = robots || currentRobots || 'index,follow';
    const resolvedType = type || currentOgType || 'website';
    const resolvedImage = absoluteUrl(ogImage || currentOgImage || '/media/social/ecoprogress-og-1200x630.jpg');
    const resolvedSchema = schema ? (Array.isArray(schema) ? schema : [schema]) : undefined;

    document.title = resolvedTitle;
    setUniqueHeadValue('meta[name="description"]', 'content', resolvedDescription);
    setUniqueHeadValue('meta[name="robots"]', 'content', resolvedRobots);
    setUniqueHeadValue('link[rel="canonical"]', 'href', resolvedCanonical);
    setUniqueHeadValue('meta[property="og:type"]', 'content', resolvedType);
    setUniqueHeadValue('meta[property="og:url"]', 'content', resolvedCanonical);
    setUniqueHeadValue('meta[property="og:title"]', 'content', resolvedTitle);
    setUniqueHeadValue('meta[property="og:description"]', 'content', resolvedDescription);
    setUniqueHeadValue('meta[property="og:image"]', 'content', resolvedImage);
    setUniqueHeadValue('meta[property="og:image:width"]', 'content', '1200');
    setUniqueHeadValue('meta[property="og:image:height"]', 'content', '630');
    setUniqueHeadValue('meta[property="og:locale"]', 'content', 'ru_KZ');
    setUniqueHeadValue('meta[property="og:site_name"]', 'content', company.name);
    setUniqueHeadValue('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setUniqueHeadValue('meta[name="twitter:title"]', 'content', resolvedTitle);
    setUniqueHeadValue('meta[name="twitter:description"]', 'content', resolvedDescription);
    setUniqueHeadValue('meta[name="twitter:image"]', 'content', resolvedImage);

    const optionalMeta = [
      ['meta[property="article:published_time"]', datePublished],
      ['meta[property="article:modified_time"]', dateModified],
    ] as const;
    optionalMeta.forEach(([selector, value]) => {
      if (resolvedType === 'article' && value) setUniqueHeadValue(selector, 'content', value);
      else document.head.querySelectorAll(selector).forEach((node) => node.remove());
    });

    document.head.querySelectorAll('link[data-ecoprogress-hreflang]').forEach((element) => element.remove());
    alternates.forEach((alternate) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = alternate.locale;
      link.href = absoluteUrl(alternate.url);
      link.dataset.ecoprogressHreflang = 'true';
      document.head.appendChild(link);
    });

    if (appConfig.googleSiteVerification) setUniqueHeadValue('meta[name="google-site-verification"]', 'content', appConfig.googleSiteVerification);
    else document.head.querySelectorAll('meta[name="google-site-verification"]').forEach((node) => node.remove());

    const schemaScripts = [...document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')];
    const script = schemaScripts.find((node) => node.id === 'page-schema-json-ld') ?? document.createElement('script');
    schemaScripts.filter((node) => node !== script).forEach((node) => node.remove());
    script.id = 'page-schema-json-ld';
    script.type = 'application/ld+json';
    script.dataset.ecoprogressSchema = 'true';
    if (resolvedSchema || !script.parentNode || !samePrerenderedRoute) script.textContent = safeJson(createSchemaGraph(resolvedSchema, resolvedCanonical));
    if (!script.parentNode) document.head.appendChild(script);

    const warningFrame = window.requestAnimationFrame(() => warnInDevelopment({
      title: resolvedTitle,
      description: resolvedDescription,
      canonical: resolvedCanonical,
      robots: resolvedRobots,
      expectedH1: h1,
    }));
    return () => window.cancelAnimationFrame(warningFrame);
  }, [title, description, h1, canonical, ogImage, type, robots, schema, datePublished, dateModified, alternates]);

  return null;
};

export default SEO;
