import type { ProtocolWizardForm } from '../components/wizardTypes';

export const LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION = 5;
export const LOCAL_PROTOCOL_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface LocalProtocolDraftEnvelope {
  schemaVersion: number;
  userId: string;
  protocolId: string | null;
  backendVersion: number | null;
  idempotencyKey: string;
  currentStep: number;
  formValues: ProtocolWizardForm;
  savedAt: string;
  hasUnsavedChanges: boolean;
  creationContext: ProtocolCreationContext;
}

export interface ProtocolCreationContext {
  orderId: string;
  orderServiceItemId: string;
  pekReportId: string;
  companyId: string;
  objectId: string;
  source: string;
}

export const normalizeProtocolCreationContext = (context: Partial<ProtocolCreationContext> = {}): ProtocolCreationContext => ({
  orderId: String(context.orderId ?? ''),
  orderServiceItemId: String(context.orderServiceItemId ?? ''),
  pekReportId: String(context.pekReportId ?? ''),
  companyId: String(context.companyId ?? ''),
  objectId: String(context.objectId ?? ''),
  source: String(context.source ?? 'PROTOCOLS'),
});

const contextToken = (context: Partial<ProtocolCreationContext>) =>
  encodeURIComponent(JSON.stringify(normalizeProtocolCreationContext(context)));

export const createProtocolDraftIdempotencyKey = (uuid = crypto.randomUUID()): string =>
  `protocol-draft-${uuid}`;

export const localProtocolDraftKey = (
  userId: string | number,
  protocolId: string | number | null = null,
  creationContext: Partial<ProtocolCreationContext> = {},
): string => `protocol-draft:${userId}:${contextToken(creationContext)}:${protocolId ?? 'new'}:${LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION}`;

const isEnvelope = (value: unknown): value is LocalProtocolDraftEnvelope => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION
    && typeof record.userId === 'string'
    && typeof record.idempotencyKey === 'string'
    && typeof record.currentStep === 'number'
    && typeof record.savedAt === 'string'
    && Boolean(record.creationContext && typeof record.creationContext === 'object')
    && Boolean(record.formValues && typeof record.formValues === 'object');
};

export const readLocalProtocolDraft = (
  storage: Pick<Storage, 'getItem'>,
  key: string,
  userId: string | number,
  now = Date.now(),
): LocalProtocolDraftEnvelope | null => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed) || parsed.userId !== String(userId)) return null;
    const savedAt = Date.parse(parsed.savedAt);
    if (!Number.isFinite(savedAt) || now - savedAt > LOCAL_PROTOCOL_DRAFT_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const findLatestLocalProtocolDraft = (
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>,
  userId: string | number,
  creationContext: Partial<ProtocolCreationContext> = {},
  now = Date.now(),
): { key: string; envelope: LocalProtocolDraftEnvelope } | null => {
  const prefix = `protocol-draft:${userId}:`;
  const expectedContext = normalizeProtocolCreationContext(creationContext);
  let latest: { key: string; envelope: LocalProtocolDraftEnvelope } | null = null;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const envelope = readLocalProtocolDraft(storage, key, userId, now);
    if (!envelope) continue;
    if (JSON.stringify(normalizeProtocolCreationContext(envelope.creationContext)) !== JSON.stringify(expectedContext)) continue;
    if (!latest || Date.parse(envelope.savedAt) > Date.parse(latest.envelope.savedAt)) latest = { key, envelope };
  }
  return latest;
};

export const writeLocalProtocolDraft = (
  storage: Pick<Storage, 'setItem'>,
  envelope: LocalProtocolDraftEnvelope,
): string => {
  const key = localProtocolDraftKey(envelope.userId, envelope.protocolId, envelope.creationContext);
  storage.setItem(key, JSON.stringify(envelope));
  return key;
};
