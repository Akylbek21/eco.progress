export const normalizeBin = (value: string): string => value.replace(/\D/g, '').slice(0, 12);

export const emptyToUndefined = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized || undefined;
};

export const isValidEmail = (value: string): boolean =>
  !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidPhone = (value: string): boolean =>
  !value.trim() || /^\+?[\d\s()-]{7,20}$/.test(value.trim());
