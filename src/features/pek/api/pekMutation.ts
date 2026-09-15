import type { AxiosRequestConfig } from 'axios';

export const PEK_DOCUMENT_GENERATION_TIMEOUT_MS = 120_000;

export const pekMutationOptions = (version: number): Pick<AxiosRequestConfig, 'headers'> => {
  if (!Number.isFinite(version) || version < 0) {
    throw new Error('Для изменения данных ПЭК требуется версия сущности.');
  }

  return {
    headers: {
      'If-Match': String(version),
    },
  };
};

export const pekDocumentMutationOptions = (
  version: number,
): Pick<AxiosRequestConfig, 'headers' | 'timeout'> => ({
  ...pekMutationOptions(version),
  timeout: PEK_DOCUMENT_GENERATION_TIMEOUT_MS,
});
