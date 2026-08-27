const batch2 = '/web-images-batch2-1600x900';

export const pageHeroImages = {
  services: `${batch2}/city-photo-06-1600x900.webp`,
  regions: `${batch2}/city-photo-02-1600x900.webp`,
  news: `${batch2}/city-photo-04-1600x900.webp`,
  cases: `${batch2}/city-photo-03-1600x900.webp`,
  about: `${batch2}/city-photo-07-1600x900.webp`,
} as const;

export const newsCardImages = [
  `${batch2}/city-photo-01-1600x900.webp`,
  `${batch2}/city-photo-05-1600x900.webp`,
  `${batch2}/city-photo-06-1600x900.webp`,
  `${batch2}/city-photo-02-1600x900.webp`,
  `${batch2}/city-photo-07-1600x900.webp`,
] as const;

const genericArticleImages = new Set(['/og-cover.jpg', '/para.jpg']);

export const getArticleImage = (slug: string, configuredImage?: string) => {
  if (configuredImage && !genericArticleImages.has(configuredImage)) return configuredImage;

  const hash = Array.from(slug).reduce(
    (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
    0,
  );

  return newsCardImages[hash % newsCardImages.length];
};
