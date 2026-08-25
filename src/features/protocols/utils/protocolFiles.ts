import type { DownloadedProtocolFile } from '../api/protocolDocumentsApi';

/** Starts the browser's real file-open/save flow only after the binary response was validated. */
export const openProtocolDownload = (file: DownloadedProtocolFile, fallbackName: string): void => {
  if (!file.blob?.size) throw new Error('Файл не получен от backend.');
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName || fallbackName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  try {
    link.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    link.remove();
  }
  // Immediate revocation can cancel the browser download before it opens the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
