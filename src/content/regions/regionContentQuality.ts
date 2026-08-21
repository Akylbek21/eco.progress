import { publishedCaseStudies } from '../cases/caseStudies.ts';
import type { RegionContent } from '../types.ts';

const approvedCaseSlugs = new Set(publishedCaseStudies.map((item) => item.slug));

const contentSignature = (content: RegionContent): string => [
  content.introduction,
  ...content.regionalFeatures ?? [],
  ...content.industries,
  ...content.commonTasks,
  content.logisticsNote,
].join('|').trim().toLocaleLowerCase('ru-RU');

export const hasCompleteRegionContent = (content: RegionContent | undefined): content is RegionContent => Boolean(
  content
  && content.status === 'published'
  && content.introduction.trim()
  && (content.regionalFeatures?.length ?? 0) >= 2
  && content.industries.length >= 3
  && content.commonTasks.length >= 3
  && content.remoteConditions.length >= 2
  && content.onSiteConditions.length >= 1
  && content.logisticsNote.trim()
  && content.estimatedTimeline?.trim()
  && content.faq.length >= 2
  && (content.completedWorkExamples?.length ?? 0) > 0
  && (content.confirmedCaseSlugs?.length ?? 0) > 0
  && content.confirmedCaseSlugs?.every((slug) => approvedCaseSlugs.has(slug)),
);

export const hasUniqueRegionContent = (content: RegionContent, allRegions: RegionContent[]): boolean => {
  const signature = contentSignature(content);
  return Boolean(signature) && allRegions.filter((item) => contentSignature(item) === signature).length === 1;
};

export const isRegionContentIndexable = (
  content: RegionContent | undefined,
  allRegions: RegionContent[],
): boolean => hasCompleteRegionContent(content) && hasUniqueRegionContent(content, allRegions);
