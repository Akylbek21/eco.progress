import type { AxiosRequestConfig } from 'axios';

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

