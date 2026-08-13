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
  // Build the complete replacement before creating/updating the server draft. A
  // client-side mapping error must not leave behind a header-only protocol.
  const results = form.results.flatMap((row, index) => {
    if (!isNonEmptyResult(row)) return [];
    const payload = mapWizardResultToDraftRequest(row, form, index);
    return [{ row, request: mapProtocolResultFormToRequest(payload) }];
  });

  let protocol = current
    ? await service.updateProtocolDraft(current.id, mapWizardToUpdateDraft(form, current))
    : await service.createProtocolDraft(mapWizardToCreateDraft(form), idempotencyKey);

  if (!protocol.id) throw new Error('Не удалось сохранить протокол: сервер не вернул идентификатор.');

  const retainedIds = new Set(results.flatMap(({ row }) => row.serverResultId ? [String(row.serverResultId)] : []));
  protocol = await service.saveProtocolDraftResults(protocol.id, {
    version: protocol.version,
    added: results.flatMap(({ row, request }) => row.serverResultId ? [] : [{ ...request, clientRowId: row.clientRowId }]),
    updated: results.flatMap(({ row, request }) => row.serverResultId ? [{ ...request, id: row.serverResultId }] : []),
    deletedIds: protocol.results.flatMap((row) => retainedIds.has(String(row.id)) ? [] : [row.id]),
  });

  const resultIdsByClientRowId = new Map<string, string>();
  protocol.results.forEach((row) => {
    const clientRowId = String(row.values.clientRowId ?? '').trim();
    if (clientRowId) resultIdsByClientRowId.set(clientRowId, String(row.id));
  });
  return { protocol, resultIdsByClientRowId };
};
