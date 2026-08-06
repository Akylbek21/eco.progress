import { describe, expect, it, vi } from 'vitest';
import { hasPermission } from '../src/config/permissions';
import { createWizardDefaults, emptyWizardResult } from '../src/features/protocols/components/wizardTypes';
import { saveProtocolWizardDraft } from '../src/features/protocols/api/saveProtocolWizardDraft';
import { mapWizardToCreateDraft, mapWizardToUpdateDraft } from '../src/features/protocols/mappers/protocolWizardDraftMapper';
import {
  createProtocolDraftIdempotencyKey,
  findLatestLocalProtocolDraft,
  localProtocolDraftKey,
  LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION,
  readLocalProtocolDraft,
  writeLocalProtocolDraft,
} from '../src/features/protocols/utils/protocolDraftRecovery';
import { canDownloadProtocolDocument } from '../src/utils/protocolPermissions';
import { normativeSearchQueryKey } from '../src/services/normativeSearchService';
import type { Protocol } from '../src/types/protocols';
import type { ProtocolService } from '../src/services/protocolService';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as Storage;
};

const draftProtocol = (version = 1): Protocol => ({
  id: 'draft-1', version, status: 'DRAFT', results: [], protocolDate: '2026-08-06',
  templateId: 'ambient_air', number: '', protocolNumber: '', laboratory: {}, organization: {},
  companySnapshot: { companyId: 10, companyName: 'Eco Test' }, testing: {}, permissions: { canView: true, canEdit: true },
} as Protocol);

describe('protocol role matrix v18', () => {
  it.each(['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'] as const)('%s can create protocols', (role) => {
    expect(hasPermission({ role }, 'create_protocols')).toBe(true);
  });

  it('WASTE_SPECIALIST cannot create protocols', () => {
    expect(hasPermission({ role: 'WASTE_SPECIALIST' }, 'create_protocols')).toBe(false);
  });
});

describe('server draft boundary and idempotency', () => {
  it('requires a template and company before the modal starts a server draft', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('src/features/protocols/components/CreateProtocolWizardModalV2.tsx', 'utf8'));
    expect(source).toContain('values.templateId && values.companyId');
    expect(source).toContain('companyLocked={Boolean(serverDraft)}');
    expect(source).toContain("setSaveState('conflict')");
  });

  it('does not generate an idempotency key inside the API operation', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('src/features/protocols/api/saveProtocolWizardDraft.ts', 'utf8'));
    expect(source).not.toContain('randomUUID');
    expect(source).toContain('idempotencyKey: string');
  });

  it('creates with companyId and never patches companyId or PEK ids', () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10', pekProgramId: '55', pekControlEventId: '66' });
    const create = mapWizardToCreateDraft(form) as unknown as Record<string, unknown>;
    const update = mapWizardToUpdateDraft(form, draftProtocol()) as unknown as Record<string, unknown>;
    expect(create.companyId).toBe(10);
    expect(update).not.toHaveProperty('companyId');
    expect(create).not.toHaveProperty('pekProgramId');
    expect(update).not.toHaveProperty('pekProgramId');
  });

  it('uses the same idempotency key after a failed attempt', async () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10' });
    const keys: string[] = [];
    const createProtocolDraft = vi.fn(async (_payload, key: string) => {
      keys.push(key);
      if (keys.length === 1) throw new Error('timeout');
      return draftProtocol();
    });
    const service = { createProtocolDraft } as unknown as ProtocolService;
    const key = 'protocol-draft-stable';
    await expect(saveProtocolWizardDraft(form, null, key, service)).rejects.toThrow('timeout');
    await saveProtocolWizardDraft(form, null, key, service);
    expect(keys).toEqual([key, key]);
  });

  it('generates a different key for a new master lifecycle', () => {
    expect(createProtocolDraftIdempotencyKey('one')).not.toBe(createProtocolDraftIdempotencyKey('two'));
  });
});

describe('local protocol draft recovery', () => {
  it('restores form, step, results, conditions and idempotency key for the same user', () => {
    const storage = memoryStorage();
    const form = createWizardDefaults();
    form.templateId = 'lighting';
    form.companyId = '10';
    form.workplaceType = 'PERMANENT';
    form.results = [{ ...emptyWizardResult(), indicatorName: 'Освещённость', value: '0' }];
    const key = writeLocalProtocolDraft(storage, {
      schemaVersion: LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION, userId: '7', protocolId: null,
      backendVersion: null, idempotencyKey: 'stable-key', currentStep: 2, formValues: form,
      savedAt: new Date().toISOString(), hasUnsavedChanges: true,
    });
    const restored = readLocalProtocolDraft(storage, key, '7');
    expect(restored).toMatchObject({ currentStep: 2, idempotencyKey: 'stable-key' });
    expect(restored?.formValues).toMatchObject({ workplaceType: 'PERMANENT' });
    expect(restored?.formValues.results[0].value).toBe('0');
    expect(findLatestLocalProtocolDraft(storage, '7')?.key).toBe(key);
  });

  it('ignores another user and an old schema', () => {
    const storage = memoryStorage();
    const key = localProtocolDraftKey('7');
    storage.setItem(key, JSON.stringify({ schemaVersion: LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION - 1, userId: '7' }));
    expect(readLocalProtocolDraft(storage, key, '7')).toBeNull();
    const form = createWizardDefaults();
    writeLocalProtocolDraft(storage, { schemaVersion: LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION, userId: '8', protocolId: null, backendVersion: null, idempotencyKey: 'x', currentStep: 0, formValues: form, savedAt: new Date().toISOString(), hasUnsavedChanges: true });
    expect(findLatestLocalProtocolDraft(storage, '7')).toBeNull();
  });
});

describe('protocol document download guard', () => {
  const protocol = { status: 'SIGNED', permissions: { canView: true } } as Protocol;
  it('fails closed for read-only and missing roles', () => {
    expect(canDownloadProtocolDocument(protocol, 'MANAGER')).toBe(false);
    expect(canDownloadProtocolDocument(protocol, undefined)).toBe(false);
    expect(canDownloadProtocolDocument({ status: 'SIGNED' } as Protocol, 'HEAD')).toBe(false);
  });
  it.each(['HEAD', 'LABORATORY'] as const)('%s can download a visible protocol', (role) => {
    expect(canDownloadProtocolDocument(protocol, role)).toBe(true);
  });
});

describe('normative cache key completeness', () => {
  it('changes for normLevel and visualWorkCategory', () => {
    const base = { query: 'освещение', templateId: 'lighting', status: 'ACTIVE' as const };
    expect(normativeSearchQueryKey({ ...base, normLevel: 'A' })).not.toEqual(normativeSearchQueryKey({ ...base, normLevel: 'B' }));
    expect(normativeSearchQueryKey({ ...base, visualWorkCategory: 'I' })).not.toEqual(normativeSearchQueryKey({ ...base, visualWorkCategory: 'II' }));
  });
});
