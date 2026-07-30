// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { pekService } from '../src/features/pek/api/pekService';
import { pekMockServer } from '../src/features/pek/mocks/server';
import { resetPekMockState } from '../src/features/pek/mocks/handlers';
import { programActive, reportPartiallySigned } from '../src/features/pek/mocks/fixtures';
import { pekProgramSchema, validatePekResponse } from '../src/features/pek/schemas/pekResponseSchemas';
import { MockSignatureProvider, ProductionSignatureProvider } from '../src/features/pek/signatures/SignatureProvider';
import { pekDraftKey } from '../src/features/pek/utils/pekDraftStorage';

beforeAll(() => pekMockServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => resetPekMockState());
afterAll(() => pekMockServer.close());

describe('PEK MSW contract boundary', () => {
  it('serves stable paginated fixtures through Axios and the canonical PEK API', async () => {
    const page = await pekService.getPrograms({ page: 0, size: 2 });
    expect(page.content).toHaveLength(2);
    expect(page.totalElements).toBe(4);
    expect(page.content[0].id).toBe(1001);
  });

  it('runtime-validates critical program and report responses', async () => {
    await expect(pekService.getProgram(programActive.id)).resolves.toMatchObject({ status: 'ACTIVE', readOnly: true });
    await expect(pekService.getReport(reportPartiallySigned.id)).resolves.toMatchObject({ status: 'PARTIALLY_SIGNED', readOnly: true });
    expect(() => validatePekResponse(pekProgramSchema, { id: 1 }, 'broken fixture')).toThrow('PEK_API_CONTRACT_MISMATCH');
  });

  it('polls deterministic collection progress and reaches a terminal result', async () => {
    await pekService.collectReport(2001, { version: 4 });
    const first = await pekService.getLatestCollectionRun(2001);
    const second = await pekService.getLatestCollectionRun(2001);
    const third = await pekService.getLatestCollectionRun(2001);
    expect(first.status).toBe('RUNNING');
    expect(second.progressPercent).toBeGreaterThan(first.progressPercent);
    expect(third.status).toBe('COMPLETED');
  });

  it('keeps draft keys scoped by user and entity', () => {
    expect(pekDraftKey('program', 'user-7', 1001, 4)).toBe('pek-program-draft:user-7:1001:4');
    expect(pekDraftKey('program', 'user-7', 1001, 4)).not.toBe(pekDraftKey('program', 'user-7', 1001, 5));
    expect(pekDraftKey('program', 'user-8', 1001, 4)).not.toBe(pekDraftKey('program', 'user-7', 1001, 4));
  });

  it('never returns fake CMS from the production signature provider', async () => {
    const production = new ProductionSignatureProvider();
    await expect(production.connect()).rejects.toThrow('NOT_IMPLEMENTED');

    const mock = new MockSignatureProvider();
    await mock.connect();
    await expect(mock.sign('payload-for-msw')).resolves.toBe('MSW_TEST_CMS:payload-for-msw');
    await mock.disconnect();
  });
});
