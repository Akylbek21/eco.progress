import protocolService, { type ProtocolService } from '../../../services/protocolService';
import type { Protocol } from '../../../types/protocols';
import type { ProtocolWizardForm } from '../components/wizardTypes';
import { isNonEmptyResult } from '../mappers/mapProtocolWizardToRequest';
import {
  mapWizardResultToDraftRequest,
  mapWizardToCreateDraft,
  mapWizardToUpdateDraft,
} from '../mappers/protocolWizardDraftMapper';
import { mapProtocolResultFormToRequest } from './protocolMappers';

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

  const results = form.results.flatMap((row, index) => {
    if (!isNonEmptyResult(row)) return [];
    const payload = mapWizardResultToDraftRequest(row, form, index);
    payload.values.clientRowId = row.clientRowId;
    return [mapProtocolResultFormToRequest(payload)];
  });
  protocol = await service.saveProtocolDraftResults(protocol.id, { version: protocol.version, results });

  const resultIdsByClientRowId = new Map<string, string>();
  protocol.results.forEach((row) => {
    const clientRowId = String(row.values.clientRowId ?? '').trim();
    if (clientRowId) resultIdsByClientRowId.set(clientRowId, String(row.id));
  });
  return { protocol, resultIdsByClientRowId };
};
