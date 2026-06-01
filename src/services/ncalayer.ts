interface NCALayerResponse {
  result?: string;
  errorCode?: string;
  errorMessage?: string;
}

const NCALAYER_URL = 'ws://127.0.0.1:13579';
const CONNECT_TIMEOUT_MS = 5_000;
const SIGN_TIMEOUT_MS = 120_000;
const MODULE = 'kz.gov.pki.knca.commonUtils';

class NCALayerClient {
  private ws: WebSocket | null = null;
  private pendingResolve: ((value: string) => void) | null = null;
  private pendingReject: ((reason: Error) => void) | null = null;

  async connect(): Promise<void> {
    if (this.isConnected()) return;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cleanup();
        reject(
          new Error(
            'Не удалось подключиться к NCALayer. ' +
              'Убедитесь, что NCALayer запущен на вашем компьютере. ' +
              'Скачать: https://pki.gov.kz/ncalayer/',
          ),
        );
      }, CONNECT_TIMEOUT_MS);

      try {
        this.ws = new WebSocket(NCALAYER_URL);
      } catch {
        clearTimeout(timer);
        reject(
          new Error(
            'Не удалось создать соединение с NCALayer. ' +
              'Проверьте, что NCALayer установлен и запущен.',
          ),
        );
        return;
      }

      this.ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      this.ws.onerror = () => {
        clearTimeout(timer);
        this.cleanup();
        reject(
          new Error(
            'Ошибка подключения к NCALayer. ' +
              'Убедитесь, что NCALayer запущен и доступен по адресу ' +
              NCALAYER_URL,
          ),
        );
      };

      this.ws.onclose = () => {
        if (this.pendingReject) {
          this.pendingReject(new Error('Соединение с NCALayer было закрыто'));
          this.pendingResolve = null;
          this.pendingReject = null;
        }
        this.ws = null;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event);
      };
    });
  }

  private handleMessage(event: MessageEvent): void {
    if (!this.pendingResolve || !this.pendingReject) return;

    const resolve = this.pendingResolve;
    const reject = this.pendingReject;
    this.pendingResolve = null;
    this.pendingReject = null;

    try {
      const response: NCALayerResponse = JSON.parse(event.data as string);

      if (response.errorCode && response.errorCode !== '0') {
        const message = mapNCAError(response.errorCode, response.errorMessage);
        reject(new Error(message));
        return;
      }

      resolve(response.result ?? '');
    } catch {
      reject(new Error('Некорректный ответ от NCALayer'));
    }
  }

  private sendRequest(
    method: string,
    args: unknown[],
    timeoutMs = SIGN_TIMEOUT_MS,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('NCALayer не подключён'));
        return;
      }

      this.pendingResolve = resolve;
      this.pendingReject = reject;

      const timer = setTimeout(() => {
        if (this.pendingReject) {
          this.pendingReject(
            new Error('Превышено время ожидания ответа от NCALayer'),
          );
          this.pendingResolve = null;
          this.pendingReject = null;
        }
      }, timeoutMs);

      const origResolve = resolve;
      const origReject = reject;
      this.pendingResolve = (value: string) => {
        clearTimeout(timer);
        origResolve(value);
      };
      this.pendingReject = (reason: Error) => {
        clearTimeout(timer);
        origReject(reason);
      };

      const request = JSON.stringify({ module: MODULE, method, args });
      this.ws!.send(request);
    });
  }

  async sign(data: string): Promise<string> {
    return this.sendRequest('createCMSSignatureFromBase64', [
      'PKCS12',
      'SIGNATURE',
      data,
      true,
    ]);
  }

  async signXml(xml: string): Promise<string> {
    return this.sendRequest('signXml', ['PKCS12', 'SIGNATURE', xml, '', '']);
  }

  async getActiveTokens(): Promise<string[]> {
    const result = await this.sendRequest('getActiveTokens', [], 10_000);
    try {
      return JSON.parse(result) as string[];
    } catch {
      return result ? [result] : [];
    }
  }

  async getSubjectDN(): Promise<string> {
    return this.sendRequest('getKeyInfo', ['PKCS12'], 30_000);
  }

  disconnect(): void {
    this.cleanup();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private cleanup(): void {
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.pendingResolve = null;
    this.pendingReject = null;
  }
}

function mapNCAError(
  code: string | undefined,
  message: string | undefined,
): string {
  switch (code) {
    case '500':
      return 'Внутренняя ошибка NCALayer. Попробуйте перезапустить приложение.';
    case '400':
      return message || 'Некорректный запрос к NCALayer';
    case 'EMPTY_KEY_LIST':
      return 'Не найдены ключи ЭЦП. Вставьте носитель ключа или укажите путь к файлу.';
    case 'WRONG_PASSWORD':
      return 'Неверный пароль от ключа ЭЦП.';
    case 'CANCELLED':
    case 'CANCEL':
      return 'Подписание отменено пользователем.';
    default:
      return message || `Ошибка NCALayer (код: ${code})`;
  }
}

export const ncaLayer = new NCALayerClient();

async function getSignerSubject(): Promise<string> {
  try {
    return await ncaLayer.getSubjectDN();
  } catch {
    return '';
  }
}

export async function signBase64WithNCALayer(
  dataBase64: string,
): Promise<{ signedCms: string; signerSubject: string }> {
  await ncaLayer.connect();
  try {
    const signedCms = await ncaLayer.sign(dataBase64);
    const signerSubject = await getSignerSubject();
    return { signedCms, signerSubject };
  } finally {
    ncaLayer.disconnect();
  }
}

export async function signContractWithNCALayer(
  contractData: string,
): Promise<{ signedCms: string; signerSubject: string }> {
  await ncaLayer.connect();
  try {
    const dataBase64 = btoa(unescape(encodeURIComponent(contractData)));
    const signedCms = await ncaLayer.sign(dataBase64);
    const signerSubject = await getSignerSubject();
    return { signedCms, signerSubject };
  } finally {
    ncaLayer.disconnect();
  }
}
