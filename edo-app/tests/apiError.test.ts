import { describe, expect, it } from 'vitest';
import { mapApiError } from '../src/shared/api/apiError';

describe('EDO API error mapper', () => {
  it('preserves safe backend diagnostics', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: 'VERSION_CONFLICT', message: 'Документ был изменён', requestId: 'req-1', fieldErrors: { title: 'Обязательное поле' } },
      },
    };
    expect(mapApiError(error)).toEqual({
      code: 'VERSION_CONFLICT',
      message: 'Документ был изменён',
      requestId: 'req-1',
      fieldErrors: { title: 'Обязательное поле' },
      status: 409,
    });
  });

  it('does not expose technical HTML', () => {
    const error = { isAxiosError: true, response: { status: 500, data: { message: '<html>nginx</html>' } } };
    expect(mapApiError(error, 'Безопасное сообщение').message).toBe('Безопасное сообщение');
  });
});
