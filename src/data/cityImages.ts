import { regions } from '../content/regions';

const cityPhotoPaths = [
  ...Array.from(
    { length: 12 },
    (_, index) => `/web-images-1600x900/city-photo-${String(index + 1).padStart(2, '0')}-1600x900.webp`,
  ),
  ...Array.from(
    { length: 6 },
    (_, index) => `/web-images-batch2-1600x900/city-photo-${String(index + 1).padStart(2, '0')}-1600x900.webp`,
  ),
];

export const cityImageBySlug = new Map(
  regions.map((region, index) => [region.slug, cityPhotoPaths[index]]),
);

export const getCityImage = (slug: string) => cityImageBySlug.get(slug);
