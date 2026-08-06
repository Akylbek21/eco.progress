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
  resultIds: Array<string | undefined>;
};

export const saveProtocolWizardDraft = async (
  form: ProtocolWizardForm,
  current: Protocol | null,
  service: ProtocolService = protocolService,
): Promise<SavedProtocolWizardDraft> => {
  let protocol = current
    ? await service.updateProtocolDraft(current.id, mapWizardToUpdateDraft(form, current))
    : await service.createProtocolDraft(mapWizardToCreateDraft(form), `protocol-draft-${crypto.randomUUID()}`);

  if (!protocol.id) throw new Error('Не удалось сохранить протокол: сервер не вернул идентификатор.');

  const retained = new Set(form.results.map((row) => row.serverResultId).filter(Boolean));
  for (const persisted of protocol.results) {
    if (!retained.has(String(persisted.id))) {
      await service.deleteProtocolResult(protocol.id, String(persisted.id), protocol.version);
      protocol = await service.getProtocol(protocol.id);
    }
  }

  const resultIds: Array<string | undefined> = [];
  for (let index = 0; index < form.results.length; index += 1) {
    const row = form.results[index];
    if (!isNonEmptyResult(row)) {
      resultIds.push(undefined);
      continue;
    }
    const payload = mapWizardResultToDraftRequest(row, form, index);
    const saved = row.serverResultId
      ? await service.updateProtocolResult(protocol.id, row.serverResultId, payload, protocol.version)
      : await service.addProtocolResult(protocol.id, payload, protocol.version);
    resultIds.push(String(saved.id));
    protocol = await service.getProtocol(protocol.id);
  }

  return { protocol, resultIds };
};
