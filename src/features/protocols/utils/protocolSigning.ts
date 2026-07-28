import {
  createCmsSignatureWithNCALayer,
  type NCALayerSigningPhase,
} from '../../../services/ncalayer';

export type ProtocolSigningPhase =
  | 'IDLE'
  | 'LOADING_DOCUMENT'
  | NCALayerSigningPhase
  | 'VERIFYING_SIGNATURE'
  | 'SIGNED';

export const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось прочитать финальный PDF протокола.'));
  reader.onload = () => {
    const result = String(reader.result || '');
    const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
    if (!base64) reject(new Error('Финальный PDF протокола пуст.'));
    else resolve(base64);
  };
  reader.readAsDataURL(blob);
});

export const createProtocolCmsSignature = async (
  pdf: Blob,
  onPhase?: (phase: ProtocolSigningPhase) => void,
): Promise<string> => {
  if (!pdf.size) throw new Error('Финальный PDF протокола не сформирован.');
  onPhase?.('LOADING_DOCUMENT');
  const pdfBase64 = await blobToBase64(pdf);
  return createCmsSignatureWithNCALayer(pdfBase64, onPhase);
};

export const protocolSigningPhaseLabel: Record<ProtocolSigningPhase, string> = {
  IDLE: 'Подписать',
  LOADING_DOCUMENT: 'Получение финального PDF…',
  CONNECTING: 'Подключение к NCALayer…',
  SELECTING_CERTIFICATE: 'Выбор сертификата…',
  CREATING_SIGNATURE: 'Формирование подписи…',
  VERIFYING_SIGNATURE: 'Проверка подписи сервером…',
  SIGNED: 'Подписано',
};
