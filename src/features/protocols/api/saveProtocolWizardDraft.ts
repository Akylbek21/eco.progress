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

  const previousResults = current?.results ?? [];
  const draft = current
    ?? await service.createProtocolDraft(mapWizardToCreateDraft(form), idempotencyKey);

  if (!draft.id) throw new Error('Не удалось сохранить протокол: сервер не вернул идентификатор.');

  // The canonical creation sequence always persists the editable header after
  // POST /drafts, even when the draft was created just now.
  let protocol = await service.updateProtocolDraft(
    draft.id,
    mapWizardToUpdateDraft(form, draft),
  );

  const retainedIds = new Set(results.flatMap(({ row }) => row.serverResultId ? [String(row.serverResultId)] : []));
  protocol = await service.saveProtocolDraftResults(protocol.id, {
    version: protocol.version,
    added: results.flatMap(({ row, request }) => row.serverResultId ? [] : [{ ...request, clientRowId: row.clientRowId }]),
    updated: results.flatMap(({ row, request }) => row.serverResultId ? [{ ...request, id: row.serverResultId }] : []),
    deletedIds: previousResults.flatMap((row) => retainedIds.has(String(row.id)) ? [] : [row.id]),
  });

  const resultIdsByClientRowId = new Map<string, string>();
  results.forEach(({ row }) => {
    if (row.serverResultId) resultIdsByClientRowId.set(row.clientRowId, String(row.serverResultId));
  });
  protocol.results.forEach((row) => {
    const clientRowId = String(row.values.clientRowId ?? '').trim();
    if (clientRowId) resultIdsByClientRowId.set(clientRowId, String(row.id));
  });
  const assignedServerIds = new Set(resultIdsByClientRowId.values());
  const unmatchedServerRows = protocol.results.filter((row) => !assignedServerIds.has(String(row.id)));
  results.filter(({ row }) => !resultIdsByClientRowId.has(row.clientRowId)).forEach(({ row }, index) => {
    const persisted = unmatchedServerRows[index];
    if (persisted) resultIdsByClientRowId.set(row.clientRowId, String(persisted.id));
  });
  return { protocol, resultIdsByClientRowId };
};
