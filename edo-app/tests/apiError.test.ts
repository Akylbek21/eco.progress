import { describe, expect, it } from 'vitest';
import { mapApiError, parseRetryAfterSeconds } from '../src/shared/api/apiError';

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

  it('maps RFC problem detail and traceId without exposing technical fields', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 422,
        data: { code: 'INVALID_SIGNING_ORDER', detail: 'Исправьте порядок подписантов', traceId: 'trace-42' },
      },
    };
    expect(mapApiError(error)).toMatchObject({
      code: 'INVALID_SIGNING_ORDER',
      message: 'Исправьте порядок подписантов',
      requestId: 'trace-42',
      status: 422,
    });
  });

  it('maps rate limits and supports both Retry-After formats', () => {
    expect(parseRetryAfterSeconds('12')).toBe(12);
    expect(parseRetryAfterSeconds('Thu, 30 Jul 2026 12:00:10 GMT', Date.parse('Thu, 30 Jul 2026 12:00:00 GMT'))).toBe(10);
    const mapped = mapApiError({
      isAxiosError: true,
      response: { status: 429, headers: { 'retry-after': '7' }, data: {} },
    });
    expect(mapped).toMatchObject({ status: 429, retryAfterSeconds: 7 });
    expect(mapped.message).toContain('7');
  });
});
