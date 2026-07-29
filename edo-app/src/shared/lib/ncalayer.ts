import { env } from '../../app/config/env';

const NCALAYER_URL = 'wss://127.0.0.1:13579/';

type NcaResponse = { result?: string; errorCode?: string; errorMessage?: string };

export const createDetachedCms = (dataBase64: string, onState?: (state: string) => void) => {
  if (!env.ncaLayerEnabled) return Promise.reject(new Error('NCALayer отключён конфигурацией приложения.'));
  onState?.('Проверка NCALayer…');
  return new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(NCALAYER_URL);
    const timer = window.setTimeout(() => {
      socket.close();
      reject(new Error('NCALayer не отвечает. Запустите приложение NCALayer и повторите попытку.'));
    }, 120_000);
    socket.onerror = () => reject(new Error('Не удалось подключиться к NCALayer.'));
    socket.onopen = () => {
      onState?.('Выберите сертификат подписи…');
      socket.send(JSON.stringify({
        module: 'kz.gov.pki.knca.commonUtils',
        method: 'createCMSSignatureFromBase64',
        args: ['PKCS12', 'SIGNATURE', dataBase64, false],
      }));
    };
    socket.onmessage = (event) => {
      window.clearTimeout(timer);
      try {
        const response = JSON.parse(String(event.data)) as NcaResponse;
        if (response.errorCode && response.errorCode !== '0') throw new Error(response.errorMessage || `Ошибка NCALayer: ${response.errorCode}`);
        if (!response.result) throw new Error('NCALayer не вернул CMS-подпись.');
        resolve(response.result);
      } catch (error) {
        reject(error);
      } finally {
        socket.close();
      }
    };
  });
};
