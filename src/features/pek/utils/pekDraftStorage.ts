const normalizePart = (value: string | number | undefined) =>
  encodeURIComponent(String(value ?? 'new').trim() || 'new');

export const pekDraftKey = (
  kind: 'program' | 'report',
  userId: string | number | undefined,
  entityId?: string | number,
) => `eco-progress:pek-draft:v1:${kind}:${normalizePart(userId)}:${normalizePart(entityId)}`;

export const savePekDraft = <T>(key: string, form: T) => {
  localStorage.setItem(key, JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    form,
  }));
};
