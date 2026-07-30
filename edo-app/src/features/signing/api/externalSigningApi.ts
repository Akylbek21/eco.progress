import { publicEdoApiClient } from '../../../shared/api/publicEdoApiClient';

export type ExternalSigningView = {
  sender: string;
  title: string;
  status: string;
  version: number;
  hash: string;
  canSign: boolean;
  signingDataBase64?: string;
};

export const externalSigningApi = {
  async get(token: string, signal?: AbortSignal) {
    const { data } = await publicEdoApiClient.get<ExternalSigningView>(`/external-sign/${token}`, { signal });
    return data;
  },
  async submit(token: string, value: ExternalSigningView, cmsSignatureBase64: string) {
    await publicEdoApiClient.post(`/external-sign/${token}/signature`, {
      version: value.version,
      hash: value.hash,
      cmsSignatureBase64,
    }, {
      headers: { 'If-Match': `"${value.version}"` },
    });
  },
};
