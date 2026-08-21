import type { Expert } from '../types';

// Production expert profiles arrive with the published article DTO from the CMS.
// Keep this list empty until real names and qualifications are independently confirmed.
export const experts: Expert[] = [];
export const expertMap = new Map(experts.map((item) => [item.id, item]));

export const isCompleteExpert = (expert: Expert | null | undefined): expert is Expert => Boolean(
  expert?.id.trim()
  && expert.fullName.trim()
  && expert.position.trim()
  && expert.specialization.length
  && Number.isFinite(expert.experienceYears)
  && expert.experienceYears >= 0
  && expert.bio.trim()
  && expert.photo.trim()
  && expert.profileUrl.trim(),
);
