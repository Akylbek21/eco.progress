export type AuthorizedDownloadResponse = {
  blob: Blob;
  contentDisposition?: string;
  contentType?: string;
};

type DownloadOptions = {
  request: () => Promise<AuthorizedDownloadResponse>;
  suggestedFileName: string;
};

const decodeFileName = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const sanitizeFileName = (value: string) => {
  const withoutControlCharacters = [...value]
    .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('');
  const sanitized = withoutControlCharacters
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.+$/g, '')
    .trim()
    .slice(0, 180);
  return sanitized || 'download';
};

export const fileNameFromContentDisposition = (header?: string) => {
  if (!header) return undefined;
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) return sanitizeFileName(decodeFileName(encoded.replace(/^["']|["']$/g, '')));
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1];
  return plain ? sanitizeFileName(plain) : undefined;
};

export const downloadAuthorizedFile = async ({ request, suggestedFileName }: DownloadOptions) => {
  const response = await request();
  const contentType = (response.contentType || response.blob.type || '').toLowerCase();
  if (contentType.includes('application/json') || contentType.includes('problem+json')) {
    const payload = JSON.parse(await response.blob.text()) as { message?: unknown; detail?: unknown };
    const message = typeof payload.message === 'string'
      ? payload.message
      : typeof payload.detail === 'string' ? payload.detail : 'Backend вернул JSON вместо файла.';
    throw new Error(message);
  }
  if (!contentType || contentType.includes('text/html')) {
    throw new Error('Backend вернул файл с неподдерживаемым Content-Type.');
  }

  const fileName = fileNameFromContentDisposition(response.contentDisposition)
    || sanitizeFileName(suggestedFileName);
  const objectUrl = URL.createObjectURL(response.blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
  return fileName;
};
