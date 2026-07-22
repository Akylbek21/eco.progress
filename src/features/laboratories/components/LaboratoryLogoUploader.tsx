export const LABORATORY_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const LABORATORY_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export const validateLaboratoryLogo = (file: Pick<File, 'type' | 'size'>): string | null => {
  if (!LABORATORY_LOGO_TYPES.includes(file.type as (typeof LABORATORY_LOGO_TYPES)[number])) return 'Поддерживаются только PNG, JPEG и WEBP.';
  if (!file.size || file.size > LABORATORY_LOGO_MAX_BYTES) return 'Максимальный размер логотипа — 5 МБ.';
  return null;
};
