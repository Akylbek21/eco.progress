import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveProtocolPrimaryAction } from '../src/features/protocols/details/protocolDetailsModel';
import { normalizeProtocolAvailableActions } from '../src/features/protocols/utils/protocolActions';
import type { Protocol, ProtocolAction } from '../src/types/protocols';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const protocolWith = (action: ProtocolAction): Protocol => ({
  availableActions: normalizeProtocolAvailableActions({ [action]: true }),
} as Protocol);

describe('FE ↔ BE protocol button contract', () => {
  it.each([
    ['edit', 'edit', 'Продолжить'],
    ['calculate', 'calculate', 'Рассчитать'],
    ['checkNormatives', 'checkNormatives', 'Проверить'],
    ['sendToApproval', 'ready', 'Отправить на утверждение'],
    ['approve', 'approve', 'Утвердить'],
    ['sign', 'sign', 'Подписать'],
    ['publish', 'publish', 'Опубликовать'],
  ] as const)('maps backend %s to exactly one primary action', (backendAction, key, label) => {
    expect(resolveProtocolPrimaryAction(protocolWith(backendAction))).toEqual({ key, label });
  });

  it('does not infer a workflow button from status when backend returns false', () => {
    const protocol = {
      status: 'APPROVED',
      availableActions: normalizeProtocolAvailableActions({}),
    } as Protocol;
    expect(resolveProtocolPrimaryAction(protocol)).toEqual({ key: null, label: '' });
  });

  it('prefers the next backend workflow transition over editable draft fallback', () => {
    const protocol = {
      availableActions: normalizeProtocolAvailableActions({ edit: true, calculate: true }),
    } as Protocol;
    expect(resolveProtocolPrimaryAction(protocol)).toEqual({ key: 'calculate', label: 'Рассчитать' });
  });

  it('prefers approval transition over recalculation after calculation is complete', () => {
    const protocol = {
      status: 'CALCULATED',
      availableActions: normalizeProtocolAvailableActions({ calculate: true, sendToApproval: true }),
    } as Protocol;
    expect(resolveProtocolPrimaryAction(protocol)).toEqual({
      key: 'ready',
      label: 'Отправить на утверждение',
    });
  });

  it('prefers approval transition over the non-transitioning normative check', () => {
    const protocol = {
      status: 'CALCULATED',
      availableActions: normalizeProtocolAvailableActions({ checkNormatives: true, sendToApproval: true }),
    } as Protocol;
    expect(resolveProtocolPrimaryAction(protocol)).toEqual({
      key: 'ready',
      label: 'Отправить на утверждение',
    });
  });

  it('guards every document and row button with canonical availableActions', () => {
    const details = source('src/features/protocols/details/ProtocolDocumentsTab.tsx');
    const list = source('src/components/protocols/ProtocolList.tsx');
    for (const action of ['preview', 'generateDocx', 'generatePdf', 'regenerateDocx', 'regeneratePdf', 'downloadDocx', 'downloadPdf', 'sign']) {
      expect(details).toContain(`actions.${action}`);
    }
    for (const action of ['edit', 'downloadPdf', 'downloadDocx', 'createCorrection', 'viewAudit', 'delete', 'archive']) {
      expect(list).toContain(`hasProtocolAction(protocol, '${action}')`);
    }
    expect(details).not.toMatch(/previewSigned|generatePreview/);
  });

  it('renders publish only through the primary action', () => {
    const details = source('src/features/protocols/details/ProtocolDetailsView.tsx');
    expect(details.match(/onPublish\(\)/g)).toHaveLength(1);
    expect(details).not.toContain('actions.publish &&');
  });

  it('allows signing when preview is unavailable but backend permits sign', () => {
    const editor = source('src/pages/ProtocolEditorPage.tsx');
    expect(editor).toContain("if (hasProtocolAction(protocol, 'preview'))");
    expect(editor).toMatch(/if \(hasProtocolAction\(protocol, 'preview'\)\)[\s\S]*?void preview\(\);[\s\S]*?return;[\s\S]*?setSignOpen\(true\);/);
  });
});
