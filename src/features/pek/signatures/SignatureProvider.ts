export interface SignatureProvider {
  connect(): Promise<void>;
  sign(payload: string): Promise<string>;
  disconnect(): Promise<void>;
}

export class ProductionSignatureProvider implements SignatureProvider {
  async connect(): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: NCALayer provider contract is not connected');
  }

  async sign(_payload: string): Promise<string> {
    throw new Error('NOT_IMPLEMENTED: production CMS signing is unavailable');
  }

  async disconnect(): Promise<void> {
    // There is no production connection until the NCALayer contract is approved.
  }
}

export class MockSignatureProvider implements SignatureProvider {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async sign(payload: string): Promise<string> {
    if (!this.connected) throw new Error('SIGNATURE_PROVIDER_NOT_CONNECTED');
    if (!payload) throw new Error('SIGNATURE_PAYLOAD_EMPTY');
    return `MSW_TEST_CMS:${payload}`;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}
