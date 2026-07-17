export interface NormalizedArticleDates { datePublished: string; dateModified: string }

const isoDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid ISO date: ${value}`);
  return date.toISOString();
};

export const normalizeArticleDates = (datePublished: string, dateModified?: string): NormalizedArticleDates => {
  const published = isoDate(datePublished);
  let modified = published;
  if (dateModified) {
    const candidate = isoDate(dateModified);
    if (candidate >= published) modified = candidate;
  }
  return { datePublished: published, dateModified: modified };
};
