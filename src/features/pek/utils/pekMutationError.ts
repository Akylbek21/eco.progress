import { isPekVersionConflict, mapPekError, type PekUiError } from './pekErrorMapper';

export const PEK_VERSION_CONFLICT_MESSAGE = 'Данные были изменены другим сотрудником.\nОбновите страницу и повторите действие.';

export const handlePekMutationError = async (
  error: unknown,
  refreshEntity: () => Promise<unknown>,
): Promise<PekUiError> => {
  const mapped = mapPekError(error);
  if (!isPekVersionConflict(mapped)) return mapped;

  await refreshEntity();
  return { ...mapped, message: PEK_VERSION_CONFLICT_MESSAGE };
};
