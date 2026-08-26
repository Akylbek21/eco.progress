import { canonicalForPublicPath, type PublicIndexingCandidate } from './indexingPolicy.ts';

const privateOrSystemPath = /^\/(?:404|api|staff|admin|cabinet|client|dashboard|internal|login|register|reset-password|document-flow|sign|public\/document-flow\/sign)(?:\/|$)/u;
const staticLegacyPath = /^\/(?:services\/(?:eco-design|laboratory|permits|landfill|enterprise-support)|passport-othodov-kazakhstan|otchet-pek-kazakhstan|shtrafy-za-ekologiyu-kazakhstan|shtrafy-za-ekologicheskie-narusheniya-kazakhstan|news\/(?:kakie-shtrafy-za-ekologiyu-v-kazakhstane|komu-nuzhen-proizvodstvennyy-kontrol-ses|kak-poluchit-razreshenie-na-emissii|chto-takoe-pasport-othodov|kakie-dokumenty-proveryaet-ses|ekologicheskoe-soprovozhdenie-biznesa))\/*$/u;
const regionalLegacyPath = /^\/(?:passport-othodov|ovos-skrining-vozdeystviya|razreshenie-na-emissii|ekologicheskoe-proektirovanie|proizvodstvennyy-kontrol-ses|laboratornye-izmereniya|proekt-ndv|programma-pek|razrabotka-pek|proizvodstvennyy-ekologicheskiy-kontrol|proekt-szz|razdel-oos|programma-upravleniya-othodami|ekologicheskoe-razreshenie-na-vozdeystvie)-[a-z-]+\/*$/u;

export const isPrivateOrSystemPath = (routePath: string): boolean => privateOrSystemPath.test(routePath);
export const isLegacyPublicPath = (routePath: string): boolean =>
  staticLegacyPath.test(routePath) || regionalLegacyPath.test(routePath);

export interface SitemapCandidate extends PublicIndexingCandidate {
  canonical: string;
  robots: string;
  includeInSitemap: boolean;
}

export const sitemapEligibilityErrors = (entry: SitemapCandidate): string[] => {
  const errors: string[] = [];
  const expectedCanonical = canonicalForPublicPath(entry.path);
  let canonical: URL | undefined;
  try { canonical = new URL(entry.canonical); } catch { errors.push('invalid canonical URL'); }

  if (entry.robots !== 'index,follow') errors.push(`robots=${entry.robots}`);
  if (!entry.includeInSitemap) errors.push('includeInSitemap=false');
  if (entry.canonical !== expectedCanonical) errors.push(`canonical is not self: ${entry.canonical}`);
  if (canonical?.origin !== 'https://ecoprogress.kz') errors.push(`wrong origin: ${canonical?.origin ?? entry.canonical}`);
  if (canonical?.search || canonical?.hash) errors.push('canonical contains query or fragment');
  if (canonical?.pathname !== '/' && canonical?.pathname.endsWith('/')) errors.push('canonical has trailing slash');
  if (isPrivateOrSystemPath(entry.path)) errors.push('private/system path');
  if (isLegacyPublicPath(entry.path)) errors.push('legacy path');

  return errors;
};
