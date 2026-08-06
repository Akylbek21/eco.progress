const DATABASE = 'eco-progress-pek';
const STORE = 'drafts';
const CONTRACT_VERSION = 2;

const migrateLegacyDraft = <T>(draft: PekStoredDraft<T>): PekStoredDraft<T> | undefined => {
  if (draft.contractVersion !== 1) return undefined;
  const form = draft.form as Record<string, unknown>;
  if (!form || typeof form !== 'object') return undefined;
  const indicators = Array.isArray(form.indicators)
    ? form.indicators.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const row = item as Record<string, unknown>;
      const comparisonType = row.comparisonType === 'MAX' ? 'LESS_OR_EQUAL'
        : row.comparisonType === 'MIN' ? 'GREATER_OR_EQUAL'
          : row.comparisonType === 'INFORMATIONAL' ? 'INFO'
            : row.comparisonType;
      return { ...row, comparisonType };
    })
    : form.indicators;
  return { ...draft, contractVersion: CONTRACT_VERSION, form: { ...form, indicators } as T };
};

export type PekStoredDraft<T> = {
  key: string;
  contractVersion: number;
  backendVersion: string;
  savedAt: string;
  form: T;
};

const normalizePart = (value: string | number | undefined) =>
  encodeURIComponent(String(value ?? 'new').trim() || 'new');

export const pekDraftKey = (
  kind: 'program' | 'report',
  userId: string | number | undefined,
  entityId?: string | number,
  backendVersion: string | number = 'new',
  companyId?: string | number,
) => `pek-${kind}-draft:${normalizePart(userId)}:${normalizePart(entityId)}:${normalizePart(companyId)}:${normalizePart(backendVersion)}`;

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('INDEXED_DB_UNAVAILABLE'));
    return;
  }
  const request = indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('INDEXED_DB_OPEN_FAILED'));
});

const transaction = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('INDEXED_DB_REQUEST_FAILED'));
    tx.oncomplete = () => database.close();
    tx.onerror = () => reject(tx.error || new Error('INDEXED_DB_TRANSACTION_FAILED'));
  });
};

export const savePekDraft = async <T>(key: string, form: T, backendVersion: string | number = 'new') => {
  const draft: PekStoredDraft<T> = {
    key,
    contractVersion: CONTRACT_VERSION,
    backendVersion: String(backendVersion),
    savedAt: new Date().toISOString(),
    form,
  };
  await transaction('readwrite', (store) => store.put(draft));
  localStorage.setItem(`${key}:metadata`, JSON.stringify({
    contractVersion: draft.contractVersion,
    backendVersion: draft.backendVersion,
    savedAt: draft.savedAt,
  }));
  return draft;
};

export const loadPekDraft = async <T>(key: string, backendVersion: string | number = 'new') => {
  const draft = await transaction<PekStoredDraft<T> | undefined>('readonly', (store) => store.get(key));
  if (!draft || draft.backendVersion !== String(backendVersion)) return undefined;
  if (draft.contractVersion === CONTRACT_VERSION) return draft;
  const migrated = migrateLegacyDraft(draft);
  if (migrated) await transaction('readwrite', (store) => store.put(migrated));
  return migrated;
};

export { CONTRACT_VERSION, migrateLegacyDraft };

export const removePekDraft = async (key: string) => {
  await transaction('readwrite', (store) => store.delete(key));
  localStorage.removeItem(`${key}:metadata`);
};
