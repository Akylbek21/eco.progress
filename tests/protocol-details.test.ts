import { describe, expect, it } from 'vitest';
import type { Protocol, ProtocolStatus } from '../src/types/protocols';
import { complianceLabel, humanHistoryAction, lifecycleStage, protocolStatusLabel, resolveProtocolPrimaryAction } from '../src/features/protocols/details/protocolDetailsModel';

const protocol = (status: ProtocolStatus, extra: Partial<Protocol> = {}): Protocol => ({
  id: '1', protocolNumber: '123', templateId: 'ambient_air', status,
  companySnapshot: { companyName: 'Компания', objectName: 'Объект' }, protocolDate: '2026-07-22',
  organization: { organizationName: '', organizationAddress: '', objectName: '', productName: '', testingBasis: '' },
  laboratory: { laboratoryName: '', laboratoryAddress: '', accreditationNumber: '', accreditationValidUntil: '', director: '', laboratoryHead: '', executor: '' },
  testing: { productNormativeDocument: '', samplingMethodDocument: '', testingMethodDocument: '', samplingDate: '', testingStartDate: '', testingEndDate: '', testingDate: '', testingPurpose: '', environmentConditions: '' },
  results: [], measurementDevices: [], history: [], createdAt: '', updatedAt: '', ...extra,
});

describe('simplified protocol details', () => {
  it('uses human-readable status and compliance labels', () => {
    expect(protocolStatusLabel('READY_FOR_APPROVAL')).toBe('Готов к подписи');
    expect(protocolStatusLabel('UNDER_REVIEW')).toBe('На проверке');
    expect(protocolStatusLabel('NEEDS_REVISION')).toBe('Нужно исправить');
    expect(complianceLabel('NORMATIVE_NOT_FOUND')).toBe('Норматив не найден');
    expect(complianceLabel('EXCEEDED')).toBe('Есть превышение');
  });

  it('shows one backend-permission-aware primary action', () => {
    expect(resolveProtocolPrimaryAction(protocol('DRAFT', { availableActions: ['EDIT'], permissions: { canEdit: true } }), 'LABORATORY')).toEqual({ key: 'edit', label: 'Продолжить' });
    expect(resolveProtocolPrimaryAction(protocol('READY_FOR_APPROVAL'), 'LABORATORY').key).toBeNull();
    expect(resolveProtocolPrimaryAction(protocol('CALCULATED', { permissions: { canReadyForApproval: true } }), 'LABORATORY')).toEqual({ key: 'ready', label: 'Отправить на утверждение' });
    expect(resolveProtocolPrimaryAction(protocol('READY_FOR_APPROVAL', { permissions: { canApprove: true } }), 'DIRECTOR')).toEqual({ key: 'approve', label: 'Утвердить' });
    expect(resolveProtocolPrimaryAction(protocol('READY_FOR_APPROVAL', { availableActions: ['SIGN'], permissions: { canSign: true } }), 'LABORATORY')).toEqual({ key: 'sign', label: 'Подписать' });
    expect(resolveProtocolPrimaryAction(protocol('READY_TO_SIGN', { availableActions: ['SIGN'], signatureCount: 0, maxSignatures: 1, permissions: { canSign: true } }), 'LABORATORY')).toEqual({ key: 'sign', label: 'Подписать' });
    expect(resolveProtocolPrimaryAction(protocol('READY', { availableActions: ['PREPARE_SIGNING'] }), 'LABORATORY')).toEqual({ key: 'sign', label: 'Открыть предварительный просмотр' });
  });

  it('maps the lifecycle to five employee-facing stages', () => {
    expect(lifecycleStage('DRAFT')).toBe(0);
    expect(lifecycleStage('CALCULATED')).toBe(1);
    expect(lifecycleStage('READY_FOR_APPROVAL')).toBe(3);
    expect(lifecycleStage('APPROVED')).toBe(3);
    expect(lifecycleStage('SIGNED')).toBe(4);
  });

  it('turns technical history events into human phrases', () => {
    expect(humanHistoryAction({ id: '1', action: 'READY_FOR_APPROVAL', createdAt: '' })).toBe('Протокол передан на проверку');
    expect(humanHistoryAction({ id: '2', action: 'RESULT_UPDATED', createdAt: '' })).toBe('Изменены результаты измерений');
  });
});
