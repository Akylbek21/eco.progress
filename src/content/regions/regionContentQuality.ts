import type { RegionContent } from '../types.ts';

const contentSignature = (content: RegionContent): string => [
  content.introduction,
  ...content.regionalFeatures ?? [],
  ...content.industries,
  ...content.commonTasks,
  content.logisticsNote,
].join('|').trim().toLocaleLowerCase('ru-RU');

const regionalContentWordCount = (content: RegionContent): number => [
  content.introduction,
  ...content.regionalFeatures ?? [],
  ...content.industries,
  ...content.commonTasks,
  ...content.remoteConditions,
  ...content.onSiteConditions,
  content.logisticsNote,
  content.estimatedTimeline ?? '',
  ...content.faq.flatMap((item) => [item.question, item.answer]),
].join(' ').trim().split(/\s+/u).filter(Boolean).length;

export const hasCompleteRegionContent = (content: RegionContent | undefined): content is RegionContent => Boolean(
  content
  && content.status === 'published'
  && content.introduction.trim().length >= 140
  && content.industries.length >= 3
  && content.commonTasks.length >= 3
  && content.remoteConditions.length >= 2
  && content.onSiteConditions.length >= 1
  && content.logisticsNote.trim().length >= 40
  && content.faq.length >= 2
  && content.faq.every((item) => item.question.trim() && item.answer.trim())
  && regionalContentWordCount(content) >= 65
);

export const hasUniqueRegionContent = (content: RegionContent, allRegions: RegionContent[]): boolean => {
  const signature = contentSignature(content);
  return Boolean(signature) && allRegions.filter((item) => contentSignature(item) === signature).length === 1;
};

export const isRegionContentIndexable = (
  content: RegionContent | undefined,
  allRegions: RegionContent[],
): boolean => hasCompleteRegionContent(content) && hasUniqueRegionContent(content, allRegions);
