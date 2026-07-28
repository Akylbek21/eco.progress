import { regions } from '../regions';
import { regionContentMap } from './regionContent';

export interface RegionSeoProfile {
  slug: string;
  nominative: string;
  prepositional: string;
  genitive: string;
  regionName: string;
  indexed: boolean;
  industries: string[];
  serviceAreas: string[];
  intro: string;
  uniqueAdvantages: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
}

export const regionSeoProfiles: RegionSeoProfile[] = regions.map((name) => {
  const content = regionContentMap.get(name.slug);
  return {
    slug: name.slug,
    nominative: name.city,
    prepositional: name.cityPrepositional || name.city,
    genitive: name.cityGenitive || name.city,
    regionName: name.regionNominative,
    indexed: Boolean(content && content.status === 'published'),
    industries: content?.industries || [],
    serviceAreas: content?.availableServiceSlugs || [],
    intro: content?.introduction || '',
    uniqueAdvantages: [
      ...(content?.remoteConditions || []),
      ...(content?.onSiteConditions || []),
      ...(content?.logisticsNote ? [content.logisticsNote] : []),
    ],
    faq: content?.faq || [],
  };
});

export const regionSeoProfileMap = new Map(regionSeoProfiles.map((profile) => [profile.slug, profile]));
