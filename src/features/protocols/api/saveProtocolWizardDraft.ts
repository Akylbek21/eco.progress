import protocolService, { type ProtocolService } from '../../../services/protocolService';
import type { Protocol } from '../../../types/protocols';
import type { ProtocolWizardForm } from '../components/wizardTypes';
import { isNonEmptyResult } from '../mappers/mapProtocolWizardToRequest';
import {
  mapWizardResultToDraftRequest,
  mapWizardToCreateDraft,
  mapWizardToUpdateDraft,
} from '../mappers/protocolWizardDraftMapper';

export type SavedProtocolWizardDraft = {
  protocol: Protocol;
  resultIdsByClientRowId: ReadonlyMap<string, string>;
};

export const saveProtocolWizardDraft = async (
  form: ProtocolWizardForm,
  current: Protocol | null,
  idempotencyKey: string,
  service: ProtocolService = protocolService,
): Promise<SavedProtocolWizardDraft> => {
  let protocol = current
    ? await service.updateProtocolDraft(current.id, mapWizardToUpdateDraft(form, current))
    : await service.createProtocolDraft(mapWizardToCreateDraft(form), idempotencyKey);

  if (!protocol.id) throw new Error('Не удалось сохранить протокол: сервер не вернул идентификатор.');

  let version = protocol.version;
  const retained = new Set(form.results.map((row) => row.serverResultId).filter(Boolean));
  for (const persisted of protocol.results) {
    if (!retained.has(String(persisted.id))) {
      await service.deleteProtocolResult(protocol.id, String(persisted.id), version);
      version += 1;
    }
  }

  const resultIdsByClientRowId = new Map<string, string>();
  for (let index = 0; index < form.results.length; index += 1) {
    const row = form.results[index];
    if (!isNonEmptyResult(row)) continue;
    const payload = mapWizardResultToDraftRequest(row, form, index);
    payload.values.clientRowId = row.clientRowId;
    const saved = row.serverResultId
      ? await service.updateProtocolResult(protocol.id, row.serverResultId, payload, version)
      : await service.addProtocolResult(protocol.id, payload, version);
    resultIdsByClientRowId.set(row.clientRowId, String(saved.id));
    version += 1;
  }

  if (version !== protocol.version) protocol = await service.getProtocol(protocol.id);
  return { protocol, resultIdsByClientRowId };
};
