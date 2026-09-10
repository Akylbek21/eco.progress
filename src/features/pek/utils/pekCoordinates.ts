export function coordinateError(value: string, axis: 'latitude' | 'longitude'): string | null {
  if (!value.trim()) return null;
  const limit = axis === 'latitude' ? 90 : 180;
  const number = Number(value.trim().replace(',', '.'));
  return /^-?\d+(?:[.,]\d+)?$/.test(value.trim()) && Number.isFinite(number) && Math.abs(number) <= limit
    ? null : `Укажите ${axis === 'latitude' ? 'широту' : 'долготу'} числом от −${limit} до ${limit}.`;
}

export function serializeCoordinates(latitude: string, longitude: string): string | null {
  const error = coordinateError(latitude, 'latitude') || coordinateError(longitude, 'longitude');
  if (error) throw new Error(error);
  if (Boolean(latitude.trim()) !== Boolean(longitude.trim())) throw new Error('Укажите и широту, и долготу.');
  return latitude.trim() ? `${Number(latitude.trim().replace(',', '.'))}, ${Number(longitude.trim().replace(',', '.'))}` : null;
}
