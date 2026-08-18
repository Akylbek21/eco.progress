import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapProtocolResultFormToRequest } from '../src/features/protocols/api/protocolMappers';
import {
  hasProtocolAction,
  normalizeProtocolWorkflowBlockers,
  protocolTransitionBlockers,
} from '../src/features/protocols/utils/protocolActions';
import { getProtocolPermissions } from '../src/utils/protocolPermissions';
import type { Protocol } from '../src/types/protocols';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protocol backend actions and optimistic-lock contracts', () => {
  it('uses availableActions as the only source for protocol action buttons', () => {
    const protocol = {
      status: 'APPROVED',
      permissions: { canSign: true, canEdit: true },
      availableActions: { downloadPdf: true, downloadDocx: false, sign: false, edit: true, returnToDraft: true },
    } as unknown as Protocol;

    expect(hasProtocolAction(protocol, 'downloadPdf')).toBe(true);
    expect(hasProtocolAction(protocol, 'downloadDocx')).toBe(false);
    expect(getProtocolPermissions(protocol, 'ADMIN')).toMatchObject({
      canEdit: false,
      canSign: false,
      canDownloadPdf: true,
      canDownloadDocx: false,
      canReturnToDraft: true,
    });
  });

  it('normalizes and exposes backend approval/sign blockers', () => {
    const blockingReasons = normalizeProtocolWorkflowBlockers([
      'NORMATIVE_NOT_SELECTED',
      'NORMATIVE_NOT_FOUND',
      { code: 'NORMATIVE_INACTIVE', message: 'Норматив больше не действует', actions: ['approve'] },
      'UNIT_MISMATCH',
      'EMPTY_RESULT',
    ]);
    const protocol = { blockingReasons } as Protocol;

    expect(protocolTransitionBlockers(protocol, 'sendToApproval').map((item) => item.code)).toEqual([
      'NORMATIVE_NOT_SELECTED', 'NORMATIVE_NOT_FOUND', 'UNIT_MISMATCH', 'EMPTY_RESULT',
    ]);
    expect(protocolTransitionBlockers(protocol, 'approve').map((item) => item.code)).toContain('NORMATIVE_INACTIVE');
  });

  it('requires a reason for every manual normative result request', () => {
    expect(() => mapProtocolResultFormToRequest({
      normativeId: null,
      values: { normativeSource: 'MANUAL', normativeValue: 2.5, manualNormativeReason: '' },
    })).toThrow('Укажите причину использования ручного норматива.');

    expect(mapProtocolResultFormToRequest({
      normativeId: null,
      values: { normativeSource: 'MANUAL', normativeValue: 2.5, manualNormativeReason: 'Нет записи в справочнике' },
    }).values).toMatchObject({
      normativeSource: 'MANUAL',
      normativeValue: 2.5,
      manualNormativeReason: 'Нет записи в справочнике',
    });
  });

  it('has no fresh-version GET in signing, bulk changes or wizard result save', () => {
    expect(source('src/features/protocols/hooks/useSignProtocolMutation.ts')).not.toContain('getProtocol(');
    expect(source('src/features/protocols/api/saveProtocolWizardDraft.ts')).not.toContain('getProtocol(');
    const api = source('src/services/apiProtocolService.ts');
    expect(api).not.toContain('currentDraftForVersion');
    expect(api).not.toMatch(/api\.(?:post|put|patch|delete)[\s\S]{0,120}`\/protocols\/\$\{protocolId\}\/results\/\$\{resultId\}`/);
  });

  it('guards every existing-protocol mutation with requireProtocolVersion', () => {
    const api = source('src/services/apiProtocolService.ts');
    const mutationFunctions = [
      'refreshLaboratoryData', 'updateProtocol', 'updateProtocolDraft', 'saveProtocolDraftResults',
      'deleteProtocol', 'addProtocolResult', 'updateProtocolResult', 'deleteProtocolResult',
      'bulkAssignDevice', 'bulkUpdatePlace', 'bulkDeleteResults', 'checkNormatives',
      'readyForApproval', 'approveProtocol', 'returnForRevision', 'returnToDraft', 'signProtocol',
      'publishToClient', 'createCorrection', 'cancelProtocol', 'archiveProtocol',
      'generateDocx', 'generatePdf', 'importExcel', 'addProtocolMeasurementDevice',
      'removeProtocolMeasurementDevice', 'saveRawMeasurements', 'calculateResult',
      'calculateProtocolSummary',
    ];

    mutationFunctions.forEach((name) => {
      const start = api.indexOf(`export async function ${name}`);
      const next = api.indexOf('\nexport ', start + 1);
      const body = api.slice(start, next < 0 ? api.length : next);
      expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
      expect(body, `${name} must validate and send version`).toContain('requireProtocolVersion');
    });
  });

  it('sends Excel as multipart file plus validated version and restricts extensions', () => {
    const api = source('src/services/apiProtocolService.ts');
    const start = api.indexOf('export async function importExcel');
    const end = api.indexOf('\nexport async function', start + 1);
    const implementation = api.slice(start, end);
    expect(implementation).toContain('/\\.(xlsx|xls)$/i');
    expect(implementation).toContain("formData.append('file', file)");
    expect(implementation).toContain("formData.append('version', String(requireProtocolVersion(version)))");
  });

  it('offers reload on 409 without automatically replacing the edited version', () => {
    const editor = source('src/pages/ProtocolEditorPage.tsx');
    const results = source('src/components/protocols/ProtocolResultsTable.tsx');
    expect(editor).toContain('setConflictOpen(true)');
    expect(editor).toContain('Текущая операция не повторялась');
    expect(results).toContain('window.confirm(`${protocolVersionConflictMessage}\\nПерезагрузить данные?`)');
  });

  it('returns an approved protocol through a versioned server transition and never renders SIGNED preview', () => {
    const editor = source('src/pages/ProtocolEditorPage.tsx');
    const api = source('src/services/apiProtocolService.ts');
    const signing = source('src/features/protocols/hooks/useSignProtocolMutation.ts');
    expect(editor).toContain("hasProtocolAction(current, 'returnToDraft')");
    expect(editor).toContain('protocolService.returnToDraft(current.id, request)');
    expect(api).toContain('`/protocols/${protocolId}/return-to-draft`');
    expect(editor).toMatch(/current\.status === 'SIGNED'[\s\S]{0,120}protocolService\.downloadPdf/);
    expect(signing).not.toContain('generatePdf(');
  });

  it('shows document generation only for format-specific backend actions', () => {
    const documents = source('src/features/protocols/details/ProtocolDocumentsTab.tsx');
    const menu = source('src/features/protocols/details/ProtocolActionsMenu.tsx');
    for (const flag of ['canGeneratePdf', 'canRegeneratePdf', 'canGenerateDocx', 'canRegenerateDocx']) {
      expect(documents).toContain(flag);
      expect(menu).toContain(flag);
    }
  });
});
