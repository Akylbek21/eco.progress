import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { publicEdoApiClient } from '../src/shared/api/publicEdoApiClient';
import { useDebouncedValue } from '../src/shared/hooks/useDebouncedValue';
import {
  downloadAuthorizedFile,
  fileNameFromContentDisposition,
  sanitizeFileName,
} from '../src/shared/lib/authorizedDownload';

describe('document infrastructure', () => {
  it('uses an isolated public client for external signing', () => {
    expect(publicEdoApiClient.defaults.withCredentials).toBe(false);
    expect(publicEdoApiClient.defaults.headers.common.Authorization).toBeUndefined();
  });

  it('debounces search values', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: '' },
    });
    rerender({ value: 'company' });
    expect(result.current).toBe('');
    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe('company');
    vi.useRealTimers();
  });

  it('normalizes authorized download filenames and revokes object URLs', async () => {
    vi.useFakeTimers();
    expect(fileNameFromContentDisposition("attachment; filename*=UTF-8''report%20final.zip")).toBe('report final.zip');
    expect(sanitizeFileName('../bad:name.pdf')).toBe('.._bad_name.pdf');
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const fileName = await downloadAuthorizedFile({
      request: async () => ({
        blob: new Blob(['file'], { type: 'application/zip' }),
        contentType: 'application/zip',
        contentDisposition: 'attachment; filename="package.zip"',
      }),
      suggestedFileName: 'fallback.zip',
    });
    expect(fileName).toBe('package.zip');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    await act(async () => vi.runAllTimersAsync());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    click.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
