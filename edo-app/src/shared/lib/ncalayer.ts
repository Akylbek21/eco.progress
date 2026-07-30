import { env } from '../../app/config/env';

type NcaResponse = { result?: string; errorCode?: string; errorMessage?: string };

export type NcaLayerStateListener = (state: string) => void;

export interface NcaLayerClient {
  createDetachedCms(dataBase64: string, onState?: NcaLayerStateListener): Promise<string>;
}

export class WebSocketNcaLayerClient implements NcaLayerClient {
  constructor(private readonly url: string) {}

  createDetachedCms(dataBase64: string, onState?: NcaLayerStateListener) {
    onState?.('Проверка NCALayer…');
    return new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        socket.close();
        action();
      };
      const timer = window.setTimeout(() => {
        finish(() => reject(new Error('NCALayer не отвечает. Запустите приложение NCALayer и повторите попытку.')));
      }, 120_000);
      socket.onerror = () => finish(() => reject(new Error('Не удалось подключиться к NCALayer.')));
      socket.onopen = () => {
        onState?.('Выберите сертификат подписи…');
        socket.send(JSON.stringify({
          module: 'kz.gov.pki.knca.commonUtils',
          method: 'createCMSSignatureFromBase64',
          args: ['PKCS12', 'SIGNATURE', dataBase64, false],
        }));
      };
      socket.onmessage = (event) => {
        try {
          const response = JSON.parse(String(event.data)) as NcaResponse;
          if (response.errorCode && response.errorCode !== '0') {
            throw new Error(response.errorMessage || `Ошибка NCALayer: ${response.errorCode}`);
          }
          if (!response.result) throw new Error('NCALayer не вернул CMS-подпись.');
          finish(() => resolve(response.result as string));
        } catch (error) {
          finish(() => reject(error));
        }
      };
    });
  }
}

const productionClient = new WebSocketNcaLayerClient(env.ncaLayerWsUrl);

export const createDetachedCms = (dataBase64: string, onState?: NcaLayerStateListener) =>
  productionClient.createDetachedCms(dataBase64, onState);
