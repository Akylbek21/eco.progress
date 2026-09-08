export const validExperienceYears = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : null;

export const formatRussianExperience = (value: unknown): string | null => {
  const years = validExperienceYears(value);
  if (years === null) return null;

  const lastTwo = years % 100;
  const last = years % 10;
  const unit = lastTwo >= 11 && lastTwo <= 14
    ? 'лет'
    : last === 1
      ? 'год'
      : last >= 2 && last <= 4
        ? 'года'
        : 'лет';

  return `${years} ${unit}`;
};
