export const canSearchNormative = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const query = value.trim();
  if (!query) return false;
  if (/^\d{1,2}$/.test(query)) return true;
  if (/^[A-Za-z]{2}\d*$/.test(query)) return query.length >= 2;
  if (/^\d{2,7}-\d{2}-\d$/.test(query)) return true;
  return query.length >= 3;
};
